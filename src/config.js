import "dotenv/config";

function numberFromEnv(name, fallback) {
  const raw = process.env[name];
  if (!raw) return fallback;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function loadConfig(env = process.env) {
  const port = numberFromEnv("PORT", 8787);
  const publicBaseUrl = (env.PUBLIC_BASE_URL || `http://localhost:${port}`).replace(/\/+$/, "");

  return {
    port,
    publicBaseUrl,
    langflowBaseUrl: (env.LANGFLOW_BASE_URL || "https://stg-agentic.abafusion.ai").replace(/\/+$/, ""),
    langflowApiKey: env.LANGFLOW_API_KEY || "",
    langflowRunMode: env.LANGFLOW_RUN_MODE || "api_key",
    langflowPublicUserId: env.LANGFLOW_PUBLIC_USER_ID || "",
    bearerToken: env.A2A_BEARER_TOKEN || "",
    mcpServerUrl: env.MCP_SERVER_URL || "",
    requestTimeoutMs: numberFromEnv("A2A_REQUEST_TIMEOUT_MS", 60000),
    retryCount: numberFromEnv("A2A_RETRY_COUNT", 1),
    logFile: env.A2A_LOG_FILE || "logs/a2a-requests.ndjson",
    loggerFlowId: env.LANGFLOW_FLOW_LOGGER || "",
    autoLog: env.AUTO_LOG_INTERACTIONS !== "false",
    env,
  };
}
