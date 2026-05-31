import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { InstallConfig, ProfileConfig } from "./config-schema.js";
import { profilePath } from "./paths.js";
import { commandExists, run } from "./process.js";

function serverEntryPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "index.js");
}

export function serverNameFor(config: InstallConfig): string {
  return config.codex.serverName || `laravelDebug${config.profile.replace(/(^|[^A-Za-z0-9])([A-Za-z0-9])/g, (_m, _s, c) => c.toUpperCase())}`;
}

export async function saveProfile(config: InstallConfig, keyPath: string): Promise<ProfileConfig> {
  const profile: ProfileConfig = {
    ...config,
    keyPath,
    publicKeyPath: `${keyPath}.pub`,
    serverName: serverNameFor(config),
    createdAt: new Date().toISOString(),
  };
  const target = profilePath(config.profile);
  await fs.mkdir(path.dirname(target), { recursive: true, mode: 0o700 });
  await fs.writeFile(target, JSON.stringify(profile, null, 2) + "\n", { mode: 0o600 });
  return profile;
}

export async function loadProfile(profile: string): Promise<ProfileConfig> {
  const raw = await fs.readFile(profilePath(profile), "utf8");
  return JSON.parse(raw) as ProfileConfig;
}

export async function configureCodex(profile: ProfileConfig, dryRun = false): Promise<void> {
  if (!profile.codex.configure) return;
  const entry = serverEntryPath();
  const args = [
    "mcp",
    "add",
    profile.serverName,
    "--env",
    `LARAVEL_PROD_HOST=${profile.host}`,
    "--env",
    `LARAVEL_PROD_USER=${profile.diagUser}`,
    "--env",
    `LARAVEL_PROD_SSH_PORT=${profile.port}`,
    "--env",
    `LARAVEL_PROD_SSH_KEY=${profile.keyPath}`,
    "--env",
    `LARAVEL_PROD_REMOTE_COMMAND=${profile.remoteCommand}`,
    "--env",
    `LARAVEL_PROD_ENABLE_MUTATIONS=${profile.enableMutations ? "1" : "0"}`,
    "--env",
    `LARAVEL_PROD_MAX_OUTPUT_CHARS=${profile.maxOutputChars}`,
    "--env",
    `LARAVEL_PROD_TOOL_TIMEOUT_SEC=${profile.toolTimeoutSec}`,
    "--",
    "node",
    entry,
  ];
  if (dryRun) {
    console.log(["codex", ...args].join(" "));
    return;
  }
  if (!(await commandExists("codex"))) {
    console.warn("Codex CLI was not found; profile saved, but MCP config was not updated.");
    return;
  }
  const result = await run("codex", args, { timeoutMs: 60_000 });
  if (result.exitCode !== 0) throw new Error(`codex mcp add failed:\n${result.stderr || result.stdout}`);
  if (result.stdout.trim()) console.log(result.stdout.trim());
}
