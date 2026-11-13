import { loadConfig } from "../src/config.js";
import { buildRegistry } from "../src/registry.js";

const questions = {
  "orchestrator": "La porte palière du 2e est bloquée ouverte, personne n'est bloqué. Que faire ?",
  "docs-agent": "Procédure pour une porte palière bloquée ouverte, sans personne bloquée.",
  "distributor-agent": "Quelle pièce et quel contact pour une porte palière qui ne se ferme plus ?",
  "support-agent": "Une personne est bloquée dans l'ascenseur, la porte palière est entrouverte. Que faire ?",
  "logger-agent": "Question : Test de journalisation via la passerelle A2A\nRéponse : Réponse de test.\nSession : smoke-logger",
};

const config = loadConfig();
const registry = buildRegistry(config);
const only = process.argv[2];
const targets = only ? registry.filter((agent) => agent.id === only) : registry;

if (!targets.length) {
  console.error(`Unknown agent: ${only}`);
  process.exit(1);
}
if (!config.bearerToken) {
  console.error("A2A_BEARER_TOKEN is missing in .env");
  process.exit(1);
}

let failures = 0;

for (const agent of targets) {
  const started = Date.now();
  try {
    const response = await fetch(`${config.publicBaseUrl}/${agent.id}`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.bearerToken}`,
      },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: `smoke-${agent.id}`,
        method: "message/send",
        params: {
          message: {
            kind: "message",
            messageId: `smoke-${Date.now()}`,
            role: "user",
            parts: [{ kind: "text", text: questions[agent.id] }],
          },
        },
      }),
      signal: AbortSignal.timeout(config.requestTimeoutMs + 10000),
    });

    const payload = await response.json();
    if (payload.error) throw new Error(payload.error.message);
    const text = payload.result?.artifacts?.[0]?.parts?.[0]?.text || "";
    console.log(
      `PASS ${agent.id} ${Date.now() - started}ms state=${payload.result?.status?.state} chars=${text.length}`,
    );
    console.log(`  ${text.replace(/\s+/g, " ").slice(0, 220)}`);
  } catch (error) {
    failures += 1;
    console.log(`FAIL ${agent.id} ${Date.now() - started}ms ${error.message}`);
  }
}

process.exitCode = failures ? 1 : 0;
