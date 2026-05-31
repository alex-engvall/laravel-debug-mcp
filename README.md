# laravel-debug-mcp

An **installable CLI + production-safe MCP server** that lets **Codex CLI** run common Laravel diagnostics through a hardened SSH remote runner without granting interactive shell access.

## Architecture

- Codex CLI ⇄ local MCP server over stdio
- local MCP server ⇄ SSH ⇄ `/usr/local/bin/laravel-diag`
- `laravel-diag` executes a strict allowlist of diagnostics and returns JSON
- SSH access can be restricted with an `authorized_keys` forced command

## Quick start

The recommended setup path is the interactive installer:

```bash
npx @alex-engvall/laravel-debug-mcp init
```

The wizard asks for the profile name, server host, SSH setup user, Laravel app path, diagnostic user, SSH key choice, Codex configuration preference, and mutation policy. It then:

1. creates or reuses a dedicated local Ed25519 key;
2. connects to the server over SSH;
3. creates the diagnostic user when needed;
4. installs `/usr/local/bin/laravel-diag`;
5. writes `/etc/laravel-diag.env` as `root:<diag-user>` with mode `0640`;
6. installs the public key in `~<diag-user>/.ssh/authorized_keys` with a forced command;
7. saves a local profile under `~/.config/laravel-debug-mcp/profiles/`;
8. runs `codex mcp add` when Codex CLI is available;
9. runs `doctor` smoke checks.

You can also install globally:

```bash
npm install -g @alex-engvall/laravel-debug-mcp
laravel-debug-mcp init
```

## Non-interactive / CI setup

Use `--config --yes` for repeatable setup from CI/CD or a checked-in non-secret config file:

```bash
laravel-debug-mcp init --config ./laravel-debug-mcp.prod.json --yes
```

Example config:

```json
{
  "profile": "easytoday-prod",
  "host": "app.easytoday.se",
  "port": 22,
  "setupUser": "root",
  "diagUser": "codexdiag",
  "appDir": "/home/easytoday/domains/app.easytoday.se/app",
  "healthUrl": "http://127.0.0.1/up",
  "enableMutations": false,
  "codex": {
    "configure": true,
    "serverName": "laravelProdEasyToday"
  }
}
```

Keep SSH private keys in your CI secret store. Do not commit secrets to this repository.

## CLI commands

```bash
laravel-debug-mcp init [--profile <name>] [--config <path>] [--yes] [--dry-run]
laravel-debug-mcp doctor --profile <name>
laravel-debug-mcp rotate-key --profile <name>
```

`rotate-key` generates a new per-profile key, installs it with the same forced-command bootstrap, updates the local profile and Codex MCP entry, runs `doctor`, and removes the previous public key from `authorized_keys` after verification.

## Doctor checks

After installation, run:

```bash
laravel-debug-mcp doctor --profile easytoday-prod
```

`doctor` validates local prerequisites and performs remote smoke checks:

- Node.js version;
- SSH binary availability;
- private key existence and permissions;
- remote `sys.info` action;
- Laravel `health` action;
- `artisan.version` action.

## Local profile format

Profiles are written to:

```text
~/.config/laravel-debug-mcp/profiles/<profile>.json
```

A profile contains the host, port, diagnostic user, key path, remote command, mutation policy, output caps, timeout, and Codex server name. The MCP server still reads runtime configuration through `LARAVEL_PROD_*` environment variables, which makes Codex and CI integration straightforward.

## Manual remote install

The full installer is preferred, but the legacy helper remains available:

```bash
sudo DIAG_USER=codexdiag scripts/remote/install-remote.sh
```

Then edit `/etc/laravel-diag.env` and configure SSH authorized keys manually. The full `init` flow does this automatically.

## MCP server environment variables

When running the MCP server directly, provide at least:

```env
LARAVEL_PROD_HOST=prod.example.com
LARAVEL_PROD_USER=codexdiag
LARAVEL_PROD_SSH_KEY=/home/alex/.ssh/laravel-debug-mcp/prod_ed25519
```

Optional variables:

```env
LARAVEL_PROD_SSH_PORT=22
LARAVEL_PROD_REMOTE_COMMAND=/usr/local/bin/laravel-diag
LARAVEL_PROD_TOOL_TIMEOUT_SEC=45
LARAVEL_PROD_MAX_OUTPUT_CHARS=200000
LARAVEL_PROD_ENABLE_MUTATIONS=0
```

## Available diagnostics

### App / Laravel

- `health`
- `artisan_version`
- `artisan_about`
- `artisan_migrate_status`
- `artisan_schedule_list`
- `artisan_queue_failed`
- `artisan_horizon_status`
- `file_list`
- `file_read`
- `env_read`

### Logs

- `logs_list`
- `logs_tail`
- `logs_grep`
- `logs_last_error`

### System

- `sys_info`
- `sys_disk`
- `sys_memory`
- `sys_top`
- `php_version`
- `php_extensions`

### Laravel cache artifacts

- `cache_status`

### Database read-only

- `database_connections`
- `database_schema`
- `database_query` (`SELECT`, `SHOW`, `EXPLAIN`, and `DESCRIBE` only)

### Break-glass mutations

Mutations are disabled by default and double-gated locally and remotely:

1. local MCP config: `LARAVEL_PROD_ENABLE_MUTATIONS=1`
2. remote runner config: `LARAVEL_DIAG_ENABLE_MUTATIONS=1`

Mutation tools:

- `artisan_optimize_clear`
- `artisan_config_cache`
- `artisan_queue_restart`
- `artisan_queue_retry`
- `artisan_pulse_restart`

## SSH hardening

The installer writes authorized keys in this form:

```text
command="/usr/local/bin/laravel-diag",no-port-forwarding,no-X11-forwarding,no-agent-forwarding,no-pty ssh-ed25519 AAAA...
```

This makes OpenSSH run only the diagnostic runner for that key, even if the client asks for a shell or another command.

## Development

```bash
npm install
npm run typecheck
npm run build
node dist/cli.js --help
```
