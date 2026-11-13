# PCM Agent Hub

A2A gateway for the J35 PCM Agent. It exposes the orchestrator and three
specialist agents as interoperable remote agents over JSON-RPC 2.0 and serves a
complete AgentCard for each one.

```
User → Chat Input → Orchestrator ──A2A──> docs-agent        (pcm_doc)
                        │              ├─> distributor-agent (pcm_destributer_doc)
                        │              └─> support-agent     (MCP ticket)
                        ├──MCP──> mongodb-atlas-http
                        └→ Critic → Router → Chat Output
```

## Layout

```
src/server.js          Express app, routing, bearer auth
src/a2a.js             JSON-RPC handling, task store, NDJSON logging
src/langflow.js        Langflow run adapter, response extraction, retries
src/registry.js        Agent definitions and AgentCards
test/gateway.test.js   End-to-end tests with a stub Langflow
scripts/export-cards.js  Writes agent-cards/*.json for the jury pack
langflow/a2a_client_tool.py  Custom Langflow component used by the orchestrator
docs/                  Architecture, guide, demo script, agent prompts
```

## Quickstart

```powershell
cd pcm-agent-hub
npm install
Copy-Item .env.example .env
# edit .env with the Langflow API key, flow IDs and a long bearer token
npm test
npm start
```

The server prints the configured state of each agent at startup.

## Staging auth note

API keys created in the UI are rejected by this staging deployment (`SESSION_INVALID`).
The gateway supports `LANGFLOW_RUN_MODE=public`, which calls
`/api/v1/run/public/{flowId}?user_id=...`. The exposed flows must be set to
`access_type: PUBLIC`. Anyone with a flow ID and the user ID can run them, so
keep the gateway bearer token private and revert public access after the demo.

## Smoke test

```powershell
npm run smoke
# or one agent
npm run smoke support-agent
```

## Public URL

The staging backend runs the flows, so it cannot call `localhost`. Expose the
gateway with a tunnel, or deploy it.

```powershell
cloudflared tunnel --url http://localhost:8787
```

Copy the generated `https://...trycloudflare.com` URL into `PUBLIC_BASE_URL`,
restart the gateway, then regenerate the cards:

```powershell
npm run cards
```

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/healthz` | Health and per-agent configuration status |
| GET | `/` | Hub directory with card and RPC URLs |
| GET | `/:agentId/.well-known/agent-card.json` | A2A AgentCard |
| POST | `/:agentId` | JSON-RPC 2.0, methods `message/send` and `tasks/get` |

Agent IDs: `orchestrator`, `docs-agent`, `equipment-agent`, `degraded-agent`, `support-agent` (Annuaire), `critic-agent`, `distributor-agent`, `logger-agent`.

## Smoke test

```powershell
$token = "the A2A_BEARER_TOKEN value"
$body = @{
  jsonrpc = "2.0"
  id = "demo-1"
  method = "message/send"
  params = @{
    message = @{
      kind = "message"
      messageId = "m-1"
      role = "user"
      parts = @(@{ kind = "text"; text = "La porte palière du 2e est bloquée ouverte, que faire ?" })
    }
  }
} | ConvertTo-Json -Depth 8

Invoke-RestMethod -Method Post -Uri "http://localhost:8787/docs-agent" `
  -Headers @{ Authorization = "Bearer $token" } `
  -ContentType "application/json" -Body $body
```

## Environment

| Variable | Required | Purpose |
|---|---|---|
| `PUBLIC_BASE_URL` | yes | Tunnel or deployed URL used inside AgentCards |
| `LANGFLOW_BASE_URL` | yes | Staging base URL |
| `LANGFLOW_API_KEY` | api_key mode | Key used for `/api/v1/run` |
| `LANGFLOW_RUN_MODE` | yes | `api_key` or `public` |
| `LANGFLOW_PUBLIC_USER_ID` | public mode | User ID used by the public run endpoint |
| `A2A_BEARER_TOKEN` | yes | Shared secret with the orchestrator tool |
| `LANGFLOW_FLOW_ORCHESTRATOR` | yes | Flow ID for the orchestrator |
| `LANGFLOW_FLOW_DOCS` | yes | Flow ID for the documentation agent |
| `LANGFLOW_FLOW_DISTRIBUTOR` | yes | Flow ID for the distributor agent |
| `LANGFLOW_FLOW_SUPPORT` | yes | Flow ID for the support agent |
| `LANGFLOW_FLOW_LOGGER` | yes | Flow ID for the interaction logger |
| `LANGFLOW_FLOW_EQUIPMENT` | yes | Flow ID for the equipment agent |
| `LANGFLOW_FLOW_DEGRADED` | yes | Flow ID for the degraded-mode agent |
| `LANGFLOW_FLOW_CRITIC` | yes | Flow ID for the critic agent |
| `MCP_SERVER_URL` | yes | Public `/mcp` URL of the MongoDB MCP server |
| `ATLAS_URI` | yes | MongoDB URI used by `scripts/atlas-query.py` |
| `AUTO_LOG_INTERACTIONS` | no | Log orchestrator answers automatically (default true) |

Optional: `PORT`, `A2A_REQUEST_TIMEOUT_MS`, `A2A_RETRY_COUNT`, `A2A_LOG_FILE`.

## Langflow wiring

1. Keep the existing `PCM Agent · Hub` flow as the orchestrator entry point, and
   create three flows in project J35: `A2A · Docs`, `A2A · Distributor`,
   `A2A · Support`. Each specialist flow is `Chat Input → Agent → Chat Output`.
2. Import `langflow/a2a_client_tool.py` as a custom component. Add one instance
   per remote agent in the orchestrator flow, set `hub_url`, `bearer_token` and
   `agent_id`, then connect each Tool output to the orchestrator Tools input.
3. Keep the current internal agent tools as a fallback only. The demo path must
   go through A2A so the logs show protocol traffic.

See `docs/GUIDE.md` for the full sequence.

## Current status

See `docs/STATUS.md`. The deterministic fan-out (`PCM Agent · Fanout`) runs the
four specialists in parallel, then critic, revisor and contact enrichment. Direct
test: 16.6 s, equipment and D2 present, exact maintenance contact. The free
OpenRouter daily limit (50 requests) is currently exhausted; add 10 credits to
unlock 1000 free requests per day.

## Troubleshooting

- `LANGFLOW_API_KEY is not configured`: the gateway starts but every A2A call
  returns `-32000`. Set the key in `.env`.
- `ACCESS_TOKEN_EXPIRED` from Langflow: the API key is missing, revoked, or the
  UI session expired. API keys are independent from the browser session.
- `ECONNREFUSED` in the orchestrator: the tunnel is down or `PUBLIC_BASE_URL`
  is stale. Restart cloudflared and update `.env`.
- Timeout: the flow took longer than `A2A_REQUEST_TIMEOUT_MS`. Increase it, or
  optimize the specialist flow.
