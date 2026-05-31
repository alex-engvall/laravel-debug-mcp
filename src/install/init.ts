import fs from "node:fs/promises";
import type { InstallConfig } from "./config-schema.js";
import { installConfigSchema } from "./config-schema.js";
import { promptForConfig } from "./prompts.js";
import { ensureKey } from "./keys.js";
import { bootstrapRemote } from "./remote.js";
import { configureCodex, saveProfile } from "./local.js";
import { runDoctor } from "./doctor.js";

export type InitOptions = {
  profile?: string;
  config?: string;
  yes?: boolean;
  dryRun?: boolean;
};

async function readConfig(path?: string): Promise<Partial<InstallConfig>> {
  if (!path) return {};
  return JSON.parse(await fs.readFile(path, "utf8")) as Partial<InstallConfig>;
}

export async function runInit(options: InitOptions): Promise<void> {
  const fileConfig = await readConfig(options.config);
  let partial: Partial<InstallConfig> = { ...fileConfig, profile: options.profile || fileConfig.profile };
  if (!options.yes) partial = await promptForConfig(partial);

  const config = installConfigSchema.parse(partial);
  const key = await ensureKey(config);
  await bootstrapRemote(config, key.publicKey, Boolean(options.dryRun));
  const profile = await saveProfile(config, key.keyPath);
  await configureCodex(profile, Boolean(options.dryRun));

  if (!options.dryRun) {
    await runDoctor({ profile: profile.profile });
  }
}
