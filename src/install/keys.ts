import fs from "node:fs/promises";
import path from "node:path";
import type { InstallConfig } from "./config-schema.js";
import { defaultKeyPath, expandHome } from "./paths.js";
import { run } from "./process.js";
import { bootstrapRemote, removeRemoteAuthorizedKey } from "./remote.js";
import { configureCodex, loadProfile, saveProfile } from "./local.js";
import { runDoctor } from "./doctor.js";

export async function ensureKey(config: InstallConfig): Promise<{ keyPath: string; publicKey: string; publicKeyPath: string }> {
  const keyPath = expandHome(config.keyPath || defaultKeyPath(config.profile));
  const publicKeyPath = config.publicKeyPath ? expandHome(config.publicKeyPath) : `${keyPath}.pub`;
  await fs.mkdir(path.dirname(keyPath), { recursive: true, mode: 0o700 });

  let hasPrivate = true;
  try {
    await fs.access(keyPath);
  } catch {
    hasPrivate = false;
  }

  if (!hasPrivate) {
    const comment = `laravel-debug-mcp:${config.profile}@${config.host}`;
    const result = await run("ssh-keygen", ["-t", "ed25519", "-a", "100", "-N", "", "-f", keyPath, "-C", comment]);
    if (result.exitCode !== 0) throw new Error(`ssh-keygen failed: ${result.stderr || result.stdout}`);
  }

  await fs.chmod(path.dirname(keyPath), 0o700);
  await fs.chmod(keyPath, 0o600);
  try {
    await fs.chmod(publicKeyPath, 0o644);
  } catch {
    const result = await run("ssh-keygen", ["-y", "-f", keyPath]);
    if (result.exitCode !== 0) throw new Error(`Unable to read public key: ${result.stderr || result.stdout}`);
    await fs.writeFile(publicKeyPath, result.stdout.trim() + "\n", { mode: 0o644 });
  }

  const publicKey = (await fs.readFile(publicKeyPath, "utf8")).trim();
  return { keyPath, publicKey, publicKeyPath };
}

function timestamp(): string {
  return new Date().toISOString().replace(/[-:]/g, "").replace(/\..+$/, "Z");
}

export async function rotateKey(options: { profile: string }): Promise<void> {
  const current = await loadProfile(options.profile);
  const oldKeyPath = current.keyPath!;
  const oldPublicKey = await fs.readFile(`${oldKeyPath}.pub`, "utf8").then((v) => v.trim());
  const nextKeyPath = `${oldKeyPath}.${timestamp()}`;
  const nextConfig = { ...current, keyPath: nextKeyPath, publicKeyPath: `${nextKeyPath}.pub` };
  const nextKey = await ensureKey(nextConfig);

  await bootstrapRemote(nextConfig, nextKey.publicKey);
  const nextProfile = await saveProfile(nextConfig, nextKey.keyPath);
  await configureCodex(nextProfile);
  await runDoctor({ profile: nextProfile.profile });
  await removeRemoteAuthorizedKey(nextConfig, oldPublicKey);
  console.log(`✔ rotated key for profile ${nextProfile.profile}`);
}
