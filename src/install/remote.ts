import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { InstallConfig } from "./config-schema.js";
import { run } from "./process.js";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'"'"'`)}'`;
}

function remoteRunnerPath(): string {
  const here = path.dirname(fileURLToPath(import.meta.url));
  return path.resolve(here, "..", "..", "scripts", "remote", "laravel-diag");
}

function normalizeLineEndings(value: string): string {
  return value.replace(/\r\n?/g, "\n");
}

export async function bootstrapRemote(config: InstallConfig, publicKey: string, dryRun = false): Promise<void> {
  const runner = normalizeLineEndings(await fs.readFile(remoteRunnerPath(), "utf8"));
  const runnerB64 = Buffer.from(runner, "utf8").toString("base64");
  const script = `#!/usr/bin/env bash
set -euo pipefail
DIAG_USER=${shellQuote(config.diagUser)}
APP_DIR=${shellQuote(config.appDir)}
PUBLIC_KEY=${shellQuote(publicKey)}
HEALTH_URL=${shellQuote(config.healthUrl)}
ENABLE_MUTATIONS=${config.enableMutations ? "1" : "0"}
RUNNER_B64=${shellQuote(runnerB64)}

if ! id "$DIAG_USER" >/dev/null 2>&1; then
  if command -v adduser >/dev/null 2>&1; then
    adduser --disabled-password --gecos "" "$DIAG_USER"
  else
    useradd --create-home --shell /bin/bash "$DIAG_USER"
  fi
fi

printf '%s' "$RUNNER_B64" | base64 -d > /tmp/laravel-diag
install -m 0755 /tmp/laravel-diag /usr/local/bin/laravel-diag
rm -f /tmp/laravel-diag

install -d -m 0750 -o "$DIAG_USER" -g "$DIAG_USER" "/home/$DIAG_USER/.ssh"

cat > /etc/laravel-diag.env <<EOF_ENV
LARAVEL_DIAG_APP_DIR=$APP_DIR
LARAVEL_DIAG_LOG_DIR=$APP_DIR/storage/logs
LARAVEL_DIAG_ARTISAN=$APP_DIR/artisan
LARAVEL_DIAG_PHP_BIN=php
LARAVEL_DIAG_HEALTH_URL=$HEALTH_URL
LARAVEL_DIAG_TIMEOUT_SEC=25
LARAVEL_DIAG_MAX_OUTPUT_CHARS=200000
LARAVEL_DIAG_ENABLE_MUTATIONS=$ENABLE_MUTATIONS
EOF_ENV
chown root:"$DIAG_USER" /etc/laravel-diag.env
chmod 0640 /etc/laravel-diag.env

AUTHORIZED_KEYS="/home/$DIAG_USER/.ssh/authorized_keys"
touch "$AUTHORIZED_KEYS"
chown "$DIAG_USER:$DIAG_USER" "$AUTHORIZED_KEYS"
chmod 0600 "$AUTHORIZED_KEYS"
FORCED_KEY='command="/usr/local/bin/laravel-diag",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty '"$PUBLIC_KEY"
if grep -F "$PUBLIC_KEY" "$AUTHORIZED_KEYS" >/dev/null 2>&1; then
  tmp="$(mktemp)"
  grep -Fv "$PUBLIC_KEY" "$AUTHORIZED_KEYS" > "$tmp" || true
  cat "$tmp" > "$AUTHORIZED_KEYS"
  rm -f "$tmp"
fi
echo "$FORCED_KEY" >> "$AUTHORIZED_KEYS"
chown "$DIAG_USER:$DIAG_USER" "$AUTHORIZED_KEYS"
chmod 0600 "$AUTHORIZED_KEYS"

echo "laravel-debug-mcp remote bootstrap complete for $DIAG_USER"
`;

  const args = ["-o", "StrictHostKeyChecking=accept-new", "-p", String(config.port), `${config.setupUser}@${config.host}`, "bash", "-s"];
  if (dryRun) {
    console.log(script);
    return;
  }
  const result = await run("ssh", args, { input: script, timeoutMs: 120_000 });
  if (result.exitCode !== 0) throw new Error(`Remote bootstrap failed:\n${result.stderr || result.stdout}`);
  if (result.stdout.trim()) console.log(result.stdout.trim());
}


export async function removeRemoteAuthorizedKey(config: InstallConfig, publicKey: string): Promise<void> {
  const script = `#!/usr/bin/env bash
set -euo pipefail
DIAG_USER=${shellQuote(config.diagUser)}
PUBLIC_KEY=${shellQuote(publicKey)}
AUTHORIZED_KEYS="/home/$DIAG_USER/.ssh/authorized_keys"
if [[ -f "$AUTHORIZED_KEYS" ]]; then
  tmp="$(mktemp)"
  grep -Fv "$PUBLIC_KEY" "$AUTHORIZED_KEYS" > "$tmp" || true
  cat "$tmp" > "$AUTHORIZED_KEYS"
  rm -f "$tmp"
  chown "$DIAG_USER:$DIAG_USER" "$AUTHORIZED_KEYS"
  chmod 0600 "$AUTHORIZED_KEYS"
fi
`;
  const args = ["-o", "StrictHostKeyChecking=accept-new", "-p", String(config.port), `${config.setupUser}@${config.host}`, "bash", "-s"];
  const result = await run("ssh", args, { input: script, timeoutMs: 60_000 });
  if (result.exitCode !== 0) throw new Error(`Failed to remove old remote key:\n${result.stderr || result.stdout}`);
}
