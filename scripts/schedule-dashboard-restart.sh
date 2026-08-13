#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
RESTART_SCRIPT="$SCRIPT_DIR/restart-dashboard.sh"
HELPER_UNIT="panefleet-dashboard-restart"

command -v systemd-run >/dev/null || { printf 'systemd-run is required\n' >&2; exit 2; }
command -v systemctl >/dev/null || { printf 'systemctl is required\n' >&2; exit 2; }
[[ -x "$RESTART_SCRIPT" ]] || { printf 'restart helper is not executable\n' >&2; exit 2; }

restart_helper_active() {
  systemctl --user is-active --quiet "${HELPER_UNIT}.timer" >/dev/null 2>&1 ||
    systemctl --user is-active --quiet "${HELPER_UNIT}.service" >/dev/null 2>&1
}

if restart_helper_active; then
  printf 'PaneFleet dashboard restart already scheduled\n'
  exit 0
fi

if ! restart_error="$(systemd-run \
  --user \
  --quiet \
  --collect \
  --unit="$HELPER_UNIT" \
  --on-active=1s \
  "$RESTART_SCRIPT" 2>&1)"; then
  if restart_helper_active; then
    printf 'PaneFleet dashboard restart already scheduled\n'
    exit 0
  fi
  printf '%s\n' "$restart_error" >&2
  exit 1
fi

printf 'PaneFleet dashboard restart scheduled\n'
