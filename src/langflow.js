export class LangflowError extends Error {
  constructor(message, { status, retryable = false, cause } = {}) {
    super(message, { cause });
    this.name = "LangflowError";
    this.status = status;
    this.retryable = retryable;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function extractText(payload) {
  if (typeof payload === "string") return payload;
  if (!payload || typeof payload !== "object") return "";

  const direct =
    payload?.results?.message?.text ??
    payload?.outputs?.[0]?.outputs?.[0]?.results?.message?.text ??
    payload?.outputs?.[0]?.outputs?.[0]?.message?.text;
  if (typeof direct === "string" && direct.trim()) return direct;

  const seen = new Set();
  const queue = [payload];
  while (queue.length) {
    const node = queue.shift();
    if (!node || typeof node !== "object" || seen.has(node)) continue;
    seen.add(node);
    for (const [key, value] of Object.entries(node)) {
      if (key === "text" && typeof value === "string" && value.trim()) return value;
      if (value && typeof value === "object") queue.push(value);
    }
  }

  return "";
}

/**
 * Runs one Langflow flow and returns the chat text.
 * Retries network failures and 5xx responses once by default.
 */
export async function runFlow({
  baseUrl,
  apiKey,
  flowId,
  text,
  timeoutMs = 60000,
  retryCount = 1,
  mode = "api_key",
  userId = "",
}) {
  if (!flowId) {
    throw new LangflowError("Flow ID is not configured for this agent", { status: 500 });
  }
  if (mode === "api_key" && !apiKey) {
    throw new LangflowError("LANGFLOW_API_KEY is not configured", { status: 500 });
  }
  if (mode === "public" && !userId) {
    throw new LangflowError("LANGFLOW_PUBLIC_USER_ID is not configured", { status: 500 });
  }

  const url =
    mode === "public"
      ? `${baseUrl}/api/v1/run/public/${encodeURIComponent(flowId)}?user_id=${encodeURIComponent(userId)}`
      : `${baseUrl}/api/v1/run/${encodeURIComponent(flowId)}?stream=false`;
  const headers = { "Content-Type": "application/json" };
  if (mode === "api_key") headers["x-api-key"] = apiKey;
  const body = {
    input_value: text,
    input_type: "chat",
    output_type: "chat",
  };

  let lastError;
  for (let attempt = 0; attempt <= retryCount; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });

      if (!response.ok) {
        const detail = (await response.text()).slice(0, 500);
        const retryable = response.status >= 500 || response.status === 429;
        throw new LangflowError(`Langflow returned ${response.status}: ${detail}`, {
          status: response.status,
          retryable,
        });
      }

      const payload = await response.json();
      const answer = extractText(payload).trim();
      if (!answer) {
        throw new LangflowError("Langflow returned no text output", { status: 502 });
      }
      return { text: answer, raw: payload };
    } catch (error) {
      lastError = error;
      const isTimeout = error?.name === "TimeoutError" || error?.name === "AbortError";
      const retryable = isTimeout || error?.retryable || error?.name === "TypeError";
      if (attempt >= retryCount || !retryable) break;
      await sleep(500 * (attempt + 1));
    }
  }

  if (lastError instanceof LangflowError) throw lastError;
  throw new LangflowError(lastError?.message || "Langflow request failed", {
    status: 502,
    cause: lastError,
  });
}
