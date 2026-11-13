import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

export class McpLogError extends Error {
  constructor(message, { cause } = {}) {
    super(message, { cause });
    this.name = "McpLogError";
  }
}

function extractText(result) {
  const parts = result?.content || [];
  return parts
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

export async function logInteraction({ mcpServerUrl, record, timeoutMs = 30000 }) {
  if (!mcpServerUrl) throw new McpLogError("MCP_SERVER_URL is not configured");

  const transport = new StreamableHTTPClientTransport(new URL(mcpServerUrl));
  const client = new Client({ name: "pcm-agent-gateway", version: "1.0.0" });

  try {
    await client.connect(transport);
    const result = await client.callTool(
      {
        name: "insert-many",
        arguments: {
          connectionId: "preconfigured",
          database: "pcm_agent",
          collection: "interactions",
          documents: [record],
        },
      },
      undefined,
      { timeout: timeoutMs },
    );

    const text = extractText(result);
    if (result?.isError) {
      throw new McpLogError(text || "MCP insert failed");
    }
    return { text, raw: result };
  } catch (error) {
    if (error instanceof McpLogError) throw error;
    throw new McpLogError(error?.message || "MCP logging failed", { cause: error });
  } finally {
    try {
      await client.close();
    } catch {
      // best effort
    }
  }
}
