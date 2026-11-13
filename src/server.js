import express from "express";
import { createHash, timingSafeEqual, randomUUID } from "node:crypto";
import { pathToFileURL } from "node:url";
import { loadConfig } from "./config.js";
import { buildRegistry, buildAgentCard } from "./registry.js";
import { createTaskStore, createLogger, handleRpcRequest, parseJsonRpc, RPC_ERRORS } from "./a2a.js";
import { logInteraction } from "./mcp-logger.js";

function safeEqual(a, b) {
  const left = createHash("sha256").update(String(a)).digest();
  const right = createHash("sha256").update(String(b)).digest();
  return timingSafeEqual(left, right);
}

export function createApp(config = loadConfig()) {
  const app = express();
  const registry = buildRegistry(config);
  const agentsById = new Map(registry.map((agent) => [agent.id, agent]));
  const store = createTaskStore();
  const log = createLogger(config.logFile);

  app.disable("x-powered-by");
  app.use(express.json({ limit: "1mb" }));
  app.use((req, res, next) => {
    req.requestId = req.get("x-request-id") || randomUUID();
    res.set("x-request-id", req.requestId);
    res.set("access-control-allow-origin", "*");
    res.set("access-control-allow-headers", "authorization, content-type, x-request-id");
    res.set("access-control-allow-methods", "GET, POST, OPTIONS");
    if (req.method === "OPTIONS") return res.sendStatus(204);
    next();
  });

  app.get("/healthz", (_req, res) => {
    res.json({
      status: "ok",
      agents: registry.map((agent) => ({
        id: agent.id,
        configured: Boolean(agent.flowId),
      })),
    });
  });

  app.get("/", (_req, res) => {
    res.json({
      name: "PCM Agent Hub",
      protocol: "A2A 0.3.0 over JSON-RPC 2.0",
      agents: registry.map((agent) => ({
        id: agent.id,
        name: agent.card.name,
        card: `${config.publicBaseUrl}/${agent.id}/.well-known/agent-card.json`,
        rpc: `${config.publicBaseUrl}/${agent.id}`,
        configured: Boolean(agent.flowId),
      })),
    });
  });

  app.get("/agents", (_req, res) => {
    res.json(
      registry.map((agent) => ({
        id: agent.id,
        name: agent.card.name,
        description: agent.card.description,
        configured: Boolean(agent.flowId),
      })),
    );
  });

  app.get("/:agentId/.well-known/agent-card.json", (req, res) => {
    const agent = agentsById.get(req.params.agentId);
    if (!agent) return res.status(404).json({ error: "Unknown agent" });
    res.type("application/json").send(JSON.stringify(buildAgentCard(agent, config), null, 2));
  });

  app.get("/:agentId/agent-card.json", (req, res) => {
    const agent = agentsById.get(req.params.agentId);
    if (!agent) return res.status(404).json({ error: "Unknown agent" });
    res.json(buildAgentCard(agent, config));
  });

  app.post("/log", async (req, res) => {
    if (config.bearerToken) {
      const header = req.get("authorization") || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!token || !safeEqual(token, config.bearerToken)) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
      }
    }

    const { question, answer, session_id: sessionId } = req.body || {};
    if (!question || !answer) {
      return res.status(400).json({ ok: false, error: "question and answer are required" });
    }

    const record = {
      question: String(question),
      answer: String(answer),
      source: "pcm-hub",
      session_id: sessionId ? String(sessionId) : "unknown",
      created_at: new Date().toISOString(),
    };

    try {
      const result = await logInteraction({
        mcpServerUrl: config.mcpServerUrl,
        record,
        timeoutMs: config.requestTimeoutMs,
      });
      await log({ event: "mcp.interaction.log", source: record.source, sessionId: record.session_id, status: "completed" });
      res.json({ ok: true, inserted: 1, mcp: result.text.slice(0, 200) });
    } catch (error) {
      await log({ event: "mcp.interaction.log", source: record.source, sessionId: record.session_id, status: "error", error: error.message });
      res.status(502).json({ ok: false, error: error.message });
    }
  });

  app.post("/:agentId", async (req, res) => {
    const agent = agentsById.get(req.params.agentId);
    if (!agent) {
      return res.status(404).json({
        jsonrpc: "2.0",
        id: req.body?.id ?? null,
        error: { code: RPC_ERRORS.INVALID_REQUEST, message: "Unknown agent" },
      });
    }

    if (config.bearerToken) {
      const header = req.get("authorization") || "";
      const token = header.startsWith("Bearer ") ? header.slice(7) : "";
      if (!token || !safeEqual(token, config.bearerToken)) {
        return res.status(401).json({
          jsonrpc: "2.0",
          id: req.body?.id ?? null,
          error: { code: RPC_ERRORS.INVALID_REQUEST, message: "Unauthorized" },
        });
      }
    }

    const parsed = parseJsonRpc(req.body);
    if (!parsed.ok) {
      return res.status(400).json({
        jsonrpc: "2.0",
        id: null,
        error: { code: RPC_ERRORS.PARSE, message: "Invalid JSON body" },
      });
    }

    const response = await handleRpcRequest({
      requestId: req.requestId,
      body: parsed.body,
      agent,
      config,
      store,
      log,
    });

    const status = response.error ? 200 : 200;
    res.status(status).json(response);
  });

  app.use((req, res) => {
    res.status(404).json({ error: "Not found", path: req.path });
  });

  app.use((error, _req, res, _next) => {
    res.status(500).json({ error: "Internal error", detail: error?.message });
  });

  return { app, registry, config };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  const config = loadConfig();
  const { app, registry } = createApp(config);
  app.listen(config.port, () => {
    console.log(`PCM Agent Hub listening on http://localhost:${config.port}`);
    console.log(`Public base URL: ${config.publicBaseUrl}`);
    for (const agent of registry) {
      const status = agent.flowId ? "configured" : `missing ${agent.flowEnv}`;
      console.log(`- ${agent.id}: ${status}`);
    }
  });
}
