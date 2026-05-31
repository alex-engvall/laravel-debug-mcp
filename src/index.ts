import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

import { config } from "./config.js";
import { registerAllTools } from "./tools/register.js";

function log(...args: any[]) {
  // Never write to stdout; stdout is reserved for MCP JSON-RPC.
  console.error("[laravel-debug-mcp]", ...args);
}

async function main() {
  const server = new McpServer({
    name: "laravel-debug-mcp",
    version: "0.2.0",
  });

  registerAllTools(server, config.ssh, config.policy);

  const transport = new StdioServerTransport();
  await server.connect(transport);

  log("Server started (stdio). Tools registered:", Object.keys((server as any).tools ?? {}).length);
  log("Target:", `${config.ssh.user}@${config.ssh.host}`);
  if (config.policy.enableMutations) log("WARNING: mutations enabled.");
}

main().catch((err) => {
  console.error("[laravel-debug-mcp] Fatal:", err);
  process.exit(1);
});
