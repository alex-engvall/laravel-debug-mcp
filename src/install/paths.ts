import os from "node:os";
import path from "node:path";

export function expandHome(p: string): string {
  if (p === "~") return os.homedir();
  if (p.startsWith("~/")) return path.join(os.homedir(), p.slice(2));
  return p;
}

export function configRoot(): string {
  return process.env.LARAVEL_DEBUG_MCP_CONFIG_HOME || path.join(os.homedir(), ".config", "laravel-debug-mcp");
}

export function profilePath(profile: string): string {
  return path.join(configRoot(), "profiles", `${profile}.json`);
}

export function defaultKeyPath(profile: string): string {
  return path.join(os.homedir(), ".ssh", "laravel-debug-mcp", `${profile}_ed25519`);
}
