import { randomUUID } from "node:crypto";
import { appendFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { runFlow } from "./langflow.js";
import { logInteraction } from "./mcp-logger.js";

export const RPC_ERRORS = {
  PARSE: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL: -32603,
  UPSTREAM: -32000,
  TASK_NOT_FOUND: -32001,
};

const PLACEHOLDER_PATTERNS = [
  /\[[^\]]*(?:ins[ée]rer|compl[ée]ter|num[ée]ro\s+de\s+contact|XXX)[^\]]*\]/gi,
  /\[[^\]]*contact[^\]]*\]/gi,
];

export function sanitizePlaceholders(text) {
  if (!text) return text;
  let output = text;
  for (const pattern of PLACEHOLDER_PATTERNS) {
    output = output.replace(pattern, "contact à confirmer");
  }
  output = output.replace(/au\s+num[ée]ro\s+contact\s+à\s+confirmer/gi, "au contact à confirmer");
  output = output.replace(/num[ée]ro\s+contact\s+à\s+confirmer/gi, "contact à confirmer");
  return output;
}

export function extractMessageText(params) {  const message = params?.message;
  if (!message || typeof message !== "object") return "";
  const parts = Array.isArray(message.parts) ? message.parts : [];
  return parts
    .filter((part) => part && part.kind === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n")
    .trim();
}

export function createTaskStore({ ttlMs = 30 * 60 * 1000 } = {}) {
  const tasks = new Map();

  function purge() {
    const now = Date.now();
    for (const [id, entry] of tasks) {
      if (now - entry.createdAt > ttlMs) tasks.delete(id);
    }
  }

  return {
    put(task) {
      purge();
      tasks.set(task.id, { task, createdAt: Date.now() });
    },
    get(id) {
      purge();
      return tasks.get(id)?.task ?? null;
    },
    size() {
      return tasks.size;
    },
  };
}

export function createLogger(logFile) {
  let ready = null;
  return async function log(record) {
    const line = `${JSON.stringify({ timestamp: new Date().toISOString(), ...record })}\n`;
    process.stdout.write(line);
    if (!logFile) return;
    try {
      ready ??= mkdir(dirname(logFile), { recursive: true });
      await ready;
      await appendFile(logFile, line, "utf8");
    } catch {
      // Logging must never break a request.
    }
  };
}

function scheduleAutoLog({ agent, question, answer, contextId, config, log }) {
  if (!config.autoLog || agent.id !== "orchestrator" || !config.mcpServerUrl) return;

  const record = {
    question,
    answer,
    source: "pcm-hub",
    session_id: contextId,
    created_at: new Date().toISOString(),
  };

  logInteraction({ mcpServerUrl: config.mcpServerUrl, record, timeoutMs: config.requestTimeoutMs })
    .then(({ text }) =>
      log({
        event: "autolog.interaction",
        agentId: "logger-agent",
        contextId,
        status: "completed",
        mcp: text.slice(0, 120),
      }),
    )
    .catch((error) =>
      log({
        event: "autolog.interaction",
        agentId: "logger-agent",
        contextId,
        status: "error",
        error: error?.message,
      }),
    );
}

function rpcError(id, code, message, data) {
  return {
    jsonrpc: "2.0",
    id: id ?? null,
    error: { code, message, ...(data ? { data } : {}) },
  };
}

function buildCompletedTask({ agent, text, question, contextId, durationMs, flowId }) {
  const now = new Date().toISOString();
  const taskId = randomUUID();
  const userMessage = {
    kind: "message",
    messageId: randomUUID(),
    role: "user",
    parts: [{ kind: "text", text: question }],
    contextId,
    taskId,
  };
  const agentMessage = {
    kind: "message",
    messageId: randomUUID(),
    role: "agent",
    parts: [{ kind: "text", text }],
    contextId,
    taskId,
  };

  return {
    kind: "task",
    id: taskId,
    contextId,
    status: {
      state: "completed",
      timestamp: now,
    },
    artifacts: [
      {
        artifactId: randomUUID(),
        name: `${agent.card.name} response`,
        parts: [{ kind: "text", text }],
      },
    ],
    history: [userMessage, agentMessage],
    metadata: {
      agentId: agent.id,
      flowId,
      durationMs,
    },
  };
}

/**
 * Handles one JSON-RPC request for one agent.
 * Returns a JSON-RPC response object.
 */
export async function handleRpcRequest({ requestId, body, agent, config, store, log }) {
  const id = body?.id;
  const startedAt = Date.now();

  if (!body || typeof body !== "object" || body.jsonrpc !== "2.0" || typeof body.method !== "string") {
    return rpcError(id, RPC_ERRORS.INVALID_REQUEST, "Invalid JSON-RPC request");
  }

  if (body.method === "tasks/get") {
    const taskId = body.params?.id;
    const task = taskId ? store.get(taskId) : null;
    if (!task) return rpcError(id, RPC_ERRORS.TASK_NOT_FOUND, "Task not found");
    return { jsonrpc: "2.0", id, result: task };
  }

  if (body.method !== "message/send") {
    return rpcError(id, RPC_ERRORS.METHOD_NOT_FOUND, `Method not supported: ${body.method}`);
  }

  const question = extractMessageText(body.params);
  if (!question) {
    return rpcError(id, RPC_ERRORS.INVALID_PARAMS, "message.parts must contain a text part");
  }

  const contextId = body.params?.message?.contextId || randomUUID();

  try {
    const { text: rawText } = await runFlow({
      baseUrl: config.langflowBaseUrl,
      apiKey: config.langflowApiKey,
      flowId: agent.flowId,
      text: question,
      timeoutMs: config.requestTimeoutMs,
      retryCount: config.retryCount,
      mode: config.langflowRunMode,
      userId: config.langflowPublicUserId,
    });

    const text = agent.id === "orchestrator" ? sanitizePlaceholders(rawText) : rawText;
    if (text !== rawText) {
      await log({ event: "answer.sanitized", agentId: agent.id, contextId, status: "completed" });
    }

    const task = buildCompletedTask({
      agent,
      text,
      question,
      contextId,
      durationMs: Date.now() - startedAt,
      flowId: agent.flowId,
    });
    store.put(task);

    scheduleAutoLog({ agent, question, answer: text, contextId, config, log });

    await log({
      event: "a2a.message.send",
      requestId,
      agentId: agent.id,
      flowId: agent.flowId,
      taskId: task.id,
      contextId,
      durationMs: task.metadata.durationMs,
      questionChars: question.length,
      answerChars: text.length,
      status: "completed",
    });

    return { jsonrpc: "2.0", id, result: task };
  } catch (error) {
    await log({
      event: "a2a.message.send",
      requestId,
      agentId: agent.id,
      flowId: agent.flowId,
      contextId,
      durationMs: Date.now() - startedAt,
      status: "error",
      error: error?.message,
    });
    return rpcError(id, RPC_ERRORS.UPSTREAM, error?.message || "Upstream flow failed");
  }
}

/**
 * Ensures a JSON body parses as JSON-RPC. Used for malformed body handling.
 */
export function parseJsonRpc(rawBody) {
  if (rawBody && typeof rawBody === "object") return { ok: true, body: rawBody };
  if (typeof rawBody !== "string") return { ok: false };
  try {
    return { ok: true, body: JSON.parse(rawBody) };
  } catch {
    return { ok: false };
  }
}
