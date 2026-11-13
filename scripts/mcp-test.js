import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.env.MCP_URL;
if (!url) {
  console.error("MCP_URL is required");
  process.exit(1);
}

const transport = new StreamableHTTPClientTransport(new URL(url));
const client = new Client({ name: "pcm-mcp-test", version: "1.0.0" });

await client.connect(transport);
const { tools } = await client.listTools();
console.log(`tools=${tools.length}`);
for (const tool of tools) {
  console.log(`- ${tool.name}: ${(tool.description || "").slice(0, 90)}`);
  const schema = tool.inputSchema;
  if (schema?.properties) console.log(`  args: ${Object.keys(schema.properties).join(", ")}`);
}

try {
  const connections = await client.callTool({ name: "list-connections", arguments: {} });
  console.log(`connections: ${JSON.stringify(connections).slice(0, 800)}`);
} catch (error) {
  console.log(`list-connections failed: ${error.message}`);
}
await client.close();
