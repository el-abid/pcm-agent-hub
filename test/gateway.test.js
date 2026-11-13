import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { createApp } from "../src/server.js";
import { sanitizePlaceholders } from "../src/a2a.js";

async function startStubLangflow() {
  const server = http.createServer((req, res) => {
    if (req.method !== "POST" || !req.url.startsWith("/api/v1/run/")) {
      res.writeHead(404).end();
      return;
    }
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (req.headers["x-api-key"] !== "test-key") {
        res.writeHead(401, { "content-type": "application/json" });
        res.end(JSON.stringify({ detail: "bad key" }));
        return;
      }
      const body = JSON.parse(raw);
      res.writeHead(200, { "content-type": "application/json" });
      res.end(
        JSON.stringify({
          outputs: [
            {
              outputs: [
                {
                  results: {
                    message: { text: `ECHO: ${body.input_value}` },
                  },
                },
              ],
            },
          ],
        }),
      );
    });
  });
  await new Promise((resolve) => server.listen(0, resolve));
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

async function startGateway(config) {
  const { app } = createApp(config);
  const server = await new Promise((resolve) => {
    const instance = app.listen(0, () => resolve(instance));
  });
  const { port } = server.address();
  return { server, url: `http://127.0.0.1:${port}` };
}

test("sanitizePlaceholders removes contact placeholders and keeps citations", () => {
  const withPlaceholder = sanitizePlaceholders(
    "Contactez le technicien au numéro [insérer numéro de contact]. Source [PROC-PAL-001 / §6].",
  );
  assert.equal(withPlaceholder.includes("[insérer"), false);
  assert.equal(withPlaceholder.includes("contact à confirmer"), true);
  assert.equal(withPlaceholder.includes("[PROC-PAL-001 / §6]"), true);

  const withXxx = sanitizePlaceholders("Appelez [XXX] pour intervenir.");
  assert.equal(withXxx.includes("XXX"), false);
  assert.equal(withXxx.includes("contact à confirmer"), true);
});

test("A2A gateway", async (t) => {  const stub = await startStubLangflow();
  const config = {
    publicBaseUrl: "https://hub.example.test",
    langflowBaseUrl: stub.url,
    langflowApiKey: "test-key",
    bearerToken: "secret-token",
    requestTimeoutMs: 5000,
    retryCount: 0,
    logFile: null,
    env: {
      LANGFLOW_FLOW_DOCS: "flow-docs",
      LANGFLOW_FLOW_DISTRIBUTOR: "flow-distributor",
      LANGFLOW_FLOW_SUPPORT: "flow-support",
    },
  };
  const gateway = await startGateway(config);

  t.after(() => {
    gateway.server.close();
    stub.server.close();
  });

  await t.test("serves an AgentCard", async () => {
    const response = await fetch(`${gateway.url}/docs-agent/.well-known/agent-card.json`);
    assert.equal(response.status, 200);
    const card = await response.json();
    assert.equal(card.protocolVersion, "0.3.0");
    assert.equal(card.url, "https://hub.example.test/docs-agent");
    assert.equal(card.preferredTransport, "JSONRPC");
    assert.ok(card.skills.length >= 1);
    assert.deepEqual(card.security, [{ bearer: [] }]);
  });

  await t.test("rejects a request without bearer token", async () => {
    const response = await fetch(`${gateway.url}/docs-agent`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "message/send", params: {} }),
    });
    assert.equal(response.status, 401);
  });

  await t.test("completes message/send and stores the task", async () => {
    const response = await fetch(`${gateway.url}/docs-agent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer secret-token",
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: "req-1",
        method: "message/send",
        params: {
          message: {
            kind: "message",
            messageId: "m-1",
            role: "user",
            parts: [{ kind: "text", text: "Porte palière bloquée" }],
          },
        },
      }),
    });

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.jsonrpc, "2.0");
    assert.equal(payload.id, "req-1");
    assert.equal(payload.result.kind, "task");
    assert.equal(payload.result.status.state, "completed");
    assert.equal(payload.result.artifacts[0].parts[0].text, "ECHO: Porte palière bloquée");

    const taskId = payload.result.id;
    const followUp = await fetch(`${gateway.url}/docs-agent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer secret-token",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: "req-2", method: "tasks/get", params: { id: taskId } }),
    });
    const taskPayload = await followUp.json();
    assert.equal(taskPayload.result.id, taskId);
    assert.equal(taskPayload.result.status.state, "completed");
  });

  await t.test("rejects an unknown method", async () => {
    const response = await fetch(`${gateway.url}/support-agent`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer secret-token",
      },
      body: JSON.stringify({ jsonrpc: "2.0", id: 3, method: "nope", params: {} }),
    });
    const payload = await response.json();
    assert.equal(payload.error.code, -32601);
  });

  await t.test("returns 404 for an unknown agent", async () => {
    const response = await fetch(`${gateway.url}/unknown-agent/.well-known/agent-card.json`);
    assert.equal(response.status, 404);
  });
});
