#!/usr/bin/env node
import { runInit } from "./install/init.js";
import { runDoctor } from "./install/doctor.js";
import { rotateKey } from "./install/keys.js";

const VERSION = "0.1.0";

type Parsed = { command?: string; options: Record<string, string | boolean> };

function printHelp(): void {
  console.log(`laravel-debug-mcp ${VERSION}

Usage:
  laravel-debug-mcp init [--profile <name>] [--config <path>] [--yes] [--dry-run]
  laravel-debug-mcp doctor --profile <name>
  laravel-debug-mcp rotate-key --profile <name>

Commands:
  init        Interactive or config-driven installer for local keys, remote bootstrap, and Codex MCP config.
  doctor      Validate local prerequisites and run remote smoke tests.
  rotate-key  Generate a new profile key, install it remotely, verify it, and remove the old key.
`);
}

function parse(argv: string[]): Parsed {
  const [command, ...rest] = argv;
  const options: Record<string, string | boolean> = {};
  for (let i = 0; i < rest.length; i += 1) {
    const arg = rest[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2).replace(/-([a-z])/g, (_m, c) => c.toUpperCase());
    if (["yes", "dryRun", "help", "version"].includes(key)) {
      options[key] = true;
    } else {
      const value = rest[i + 1];
      if (!value || value.startsWith("--")) throw new Error(`Missing value for ${arg}`);
      options[key] = value;
      i += 1;
    }
  }
  return { command, options };
}

async function main(): Promise<void> {
  const parsed = parse(process.argv.slice(2));
  if (!parsed.command || parsed.command === "--help" || parsed.command === "-h" || parsed.options.help || parsed.command === "help") {
    printHelp();
    return;
  }
  if (parsed.options.version || parsed.command === "--version" || parsed.command === "-v") {
    console.log(VERSION);
    return;
  }

  switch (parsed.command) {
    case "init":
      await runInit(parsed.options as any);
      break;
    case "doctor": {
      const profile = parsed.options.profile;
      if (typeof profile !== "string") throw new Error("doctor requires --profile <name>");
      await runDoctor({ profile });
      break;
    }
    case "rotate-key": {
      const profile = parsed.options.profile;
      if (typeof profile !== "string") throw new Error("rotate-key requires --profile <name>");
      await rotateKey({ profile });
      break;
    }
    default:
      throw new Error(`Unknown command: ${parsed.command}`);
  }
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : String(err));
  process.exit(1);
});
