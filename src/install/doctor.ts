import fs from "node:fs/promises";
import { constants } from "node:fs";
import { callRemoteDiag, type SshConfig } from "../lib/ssh.js";
import { loadProfile } from "./local.js";
import { commandExists } from "./process.js";

async function check(label: string, fn: () => Promise<void>): Promise<boolean> {
  try {
    await fn();
    console.log(`✔ ${label}`);
    return true;
  } catch (err) {
    console.error(`✖ ${label}: ${err instanceof Error ? err.message : String(err)}`);
    return false;
  }
}

export async function runDoctor(options: { profile: string }): Promise<void> {
  const profile = await loadProfile(options.profile);
  let ok = true;
  ok = (await check("node version", async () => {
    const major = Number(process.versions.node.split(".")[0]);
    if (major < 18) throw new Error(`Node ${process.versions.node} is too old; >=18 required`);
  })) && ok;
  ok = (await check("ssh binary", async () => {
    if (!(await commandExists("ssh"))) throw new Error("ssh not found in PATH");
  })) && ok;
  ok = (await check("private key", async () => {
    await fs.access(profile.keyPath!, constants.R_OK);
    const mode = (await fs.stat(profile.keyPath!)).mode & 0o777;
    if ((mode & 0o077) !== 0) throw new Error(`expected 0600-style permissions, got ${mode.toString(8)}`);
  })) && ok;

  const ssh: SshConfig = {
    host: profile.host,
    user: profile.diagUser,
    keyPath: profile.keyPath,
    port: profile.port,
    remoteCommand: profile.remoteCommand,
    timeoutSec: profile.toolTimeoutSec,
    maxOutputChars: profile.maxOutputChars,
  };

  ok = (await check("remote sys.info", async () => {
    const res = await callRemoteDiag(ssh, { action: "sys.info", params: {} });
    if (!res.ok) throw new Error(res.output);
  })) && ok;
  ok = (await check("Laravel health", async () => {
    const res = await callRemoteDiag(ssh, { action: "health", params: {} });
    if (!res.ok) throw new Error(res.output);
  })) && ok;
  ok = (await check("artisan version", async () => {
    const res = await callRemoteDiag(ssh, { action: "artisan.version", params: {} });
    if (!res.ok) throw new Error(res.output);
  })) && ok;

  if (!ok) process.exitCode = 1;
}
