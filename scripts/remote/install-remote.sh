#!/usr/bin/env bash
set -euo pipefail

# Helper to install the remote runner on a production server.
# For the full idempotent bootstrap (user, key, forced command, env), prefer:
#   laravel-debug-mcp init
# This script remains useful for manual installs and package smoke checks.

SRC_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
DIAG_USER="${DIAG_USER:-codexdiag}"

install -m 0755 "${SRC_DIR}/laravel-diag" /usr/local/bin/laravel-diag

if [[ ! -f /etc/laravel-diag.env ]]; then
  install -m 0640 "${SRC_DIR}/laravel-diag.env.example" /etc/laravel-diag.env
  if id "${DIAG_USER}" >/dev/null 2>&1; then
    chown "root:${DIAG_USER}" /etc/laravel-diag.env
  fi
  echo "Created /etc/laravel-diag.env (edit it to match your app path)."
else
  echo "/etc/laravel-diag.env already exists; not overwriting."
fi

echo "Installed /usr/local/bin/laravel-diag"
