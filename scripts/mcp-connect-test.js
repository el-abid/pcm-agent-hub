import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

const url = process.env.MCP_URL;
const transport = new StreamableHTTPClientTransport(new URL(url));
const client = new Client({ name: "pcm-mcp-connect", version: "1.0.0" });
await client.connect(transport);

for (const args of [{ connectionName: "preconfigured" }, { connectionId: "preconfigured" }]) {
  try {
    const result = await client.callTool({ name: "connect", arguments: args });
    console.log(JSON.stringify(args), "=>", JSON.stringify(result).slice(0, 700));
  } catch (error) {
    console.log(JSON.stringify(args), "ERR", error.message);
  }
}

const list = await client.callTool({ name: "list-connections", arguments: {} });
console.log("list:", JSON.stringify(list).slice(0, 900));
await client.close();
