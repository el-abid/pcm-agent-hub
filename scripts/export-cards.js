import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { loadConfig } from "../src/config.js";
import { buildRegistry, buildAgentCard } from "../src/registry.js";

const config = loadConfig();
const registry = buildRegistry(config);
const outputDir = join(process.cwd(), "agent-cards");

await mkdir(outputDir, { recursive: true });

const index = [];
for (const agent of registry) {
  const card = buildAgentCard(agent, config);
  const file = join(outputDir, `${agent.id}.json`);
  await writeFile(file, `${JSON.stringify(card, null, 2)}\n`, "utf8");
  index.push({
    id: agent.id,
    name: card.name,
    card: `agent-cards/${agent.id}.json`,
    url: card.url,
    configured: Boolean(agent.flowId),
  });
  console.log(`wrote ${file}`);
}

await writeFile(join(outputDir, "index.json"), `${JSON.stringify(index, null, 2)}\n`, "utf8");
console.log(`wrote ${join(outputDir, "index.json")}`);
