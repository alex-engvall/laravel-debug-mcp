import readline from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import type { InstallConfig } from "./config-schema.js";

async function ask(rl: readline.Interface, label: string, fallback?: string): Promise<string> {
  const suffix = fallback ? ` (${fallback})` : "";
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer || fallback || "";
}

async function confirm(rl: readline.Interface, label: string, fallback = true): Promise<boolean> {
  const hint = fallback ? "Y/n" : "y/N";
  const answer = (await rl.question(`${label} [${hint}]: `)).trim().toLowerCase();
  if (!answer) return fallback;
  return ["y", "yes", "j", "ja", "true", "1"].includes(answer);
}

export async function promptForConfig(partial: Partial<InstallConfig>): Promise<Partial<InstallConfig>> {
  const rl = readline.createInterface({ input, output });
  try {
    const profile = partial.profile || (await ask(rl, "Profile name", "production"));
    const host = partial.host || (await ask(rl, "Server host"));
    const setupUser = partial.setupUser || (await ask(rl, "SSH admin user for setup", "root"));
    const appDir = partial.appDir || (await ask(rl, "Laravel app path"));
    const createDedicated = await confirm(rl, "Create/use dedicated diag user?", true);
    const diagUser = partial.diagUser || (createDedicated ? await ask(rl, "Diag user", "codexdiag") : setupUser);
    const generateKey = await confirm(rl, "Generate/use a dedicated SSH key?", true);
    const codexConfigure = await confirm(rl, "Configure Codex automatically?", true);
    const enableMutations = await confirm(rl, "Enable break-glass mutations?", false);
    return {
      ...partial,
      profile,
      host,
      setupUser,
      appDir,
      diagUser,
      keyPath: generateKey ? partial.keyPath : await ask(rl, "Private SSH key path"),
      enableMutations,
      codex: { configure: codexConfigure, serverName: partial.codex?.serverName },
    };
  } finally {
    rl.close();
  }
}
