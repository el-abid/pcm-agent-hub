import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.env.MCP_URL;
const transport = new StreamableHTTPClientTransport(new URL(url));
const client = new Client({ name: "pcm-mcp-insert", version: "1.0.0" });
await client.connect(transport);

const doc = {
  question: "Question de test MCP",
  answer: "Réponse de test MCP",
  source: "mcp-test-script",
  session_id: "mcp-insert-1",
  created_at: new Date().toISOString(),
};

try {
  const result = await client.callTool({
    name: "insert-many",
    arguments: {
      connectionId: "preconfigured",
      database: "pcm_agent",
      collection: "interactions",
      documents: [doc],
    },
  });
  console.log(JSON.stringify(result).slice(0, 1200));
} catch (error) {
  console.log("ERR", error.message);
}

await client.close();
