#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
WORKLOAD_UNIT="panefleet-workloads.service"
DASHBOARD_UNIT="${ORCH_SYSTEMD_UNIT:-agent-orchestrator.service}"
TEMPLATE="$ROOT/ops/panefleet-workloads.service.in"
CONFIG_HOME="${XDG_CONFIG_HOME:-$HOME/.config}"
USER_UNIT_DIR="$CONFIG_HOME/systemd/user"
WORKLOAD_UNIT_PATH="$USER_UNIT_DIR/$WORKLOAD_UNIT"
DASHBOARD_DROPIN_DIR="$USER_UNIT_DIR/$DASHBOARD_UNIT.d"
DASHBOARD_DROPIN_PATH="$DASHBOARD_DROPIN_DIR/workload-isolation.conf"
NODE_BIN="$(command -v node || true)"

[[ "$DASHBOARD_UNIT" =~ ^[A-Za-z0-9][A-Za-z0-9_.@-]{0,127}\.service$ ]] || { printf 'invalid ORCH_SYSTEMD_UNIT\n' >&2; exit 2; }
[[ "$ROOT" == /* && -d "$ROOT" && "$ROOT" != *$'\n'* ]] || { printf 'invalid project root\n' >&2; exit 2; }
[[ "$HOME" == /* && -d "$HOME" && "$HOME" != *$'\n'* ]] || { printf 'invalid HOME\n' >&2; exit 2; }
[[ "$CONFIG_HOME" == /* && "$CONFIG_HOME" != *$'\n'* ]] || { printf 'invalid XDG_CONFIG_HOME\n' >&2; exit 2; }
[[ "$NODE_BIN" == /* && -x "$NODE_BIN" ]] || { printf 'node is required\n' >&2; exit 2; }
[[ -f "$TEMPLATE" && ! -L "$TEMPLATE" ]] || { printf 'workload unit template is missing or unsafe\n' >&2; exit 2; }
command -v tmux >/dev/null || { printf 'tmux is required\n' >&2; exit 2; }
command -v systemctl >/dev/null || { printf 'systemctl is required\n' >&2; exit 2; }
command -v systemd-analyze >/dev/null || { printf 'systemd-analyze is required\n' >&2; exit 2; }

workload_inventory() {
  if ! tmux list-panes -a >/dev/null 2>&1; then
    printf 'server=absent\n'
    return 0
  fi
  tmux list-panes -a -F '#{session_name}|#{session_id}|#{session_created}|#{window_index}.#{pane_index}|#{pane_id}|#{pane_pid}|#{pane_start_command}' \
    | LC_ALL=C sort
}

process_cgroup() {
  local pid="$1"
  [[ "$pid" =~ ^[1-9][0-9]*$ && -r "/proc/$pid/cgroup" ]] || return 1
  awk -F: '$1 == "0" { print $3; exit }' "/proc/$pid/cgroup"
}

descendant_pids() {
  local root_pid="$1"
  ps -e -o pid=,ppid= | awk -v root="$root_pid" '
    { parent[$1] = $2 }
    END {
      for (pid in parent) {
        current = pid
        while (current in parent && current > 1) {
          if (current == root) { print pid; break }
          current = parent[current]
        }
      }
    }
  ' | LC_ALL=C sort -n
}

escape_sed() { printf '%s' "$1" | sed 's/[&|]/\\&/g'; }
root_sed="$(escape_sed "$ROOT")"
home_sed="$(escape_sed "$HOME")"
node_dir_sed="$(escape_sed "$(dirname "$NODE_BIN")")"
unit_tmp="$(mktemp)"
dropin_tmp="$(mktemp)"
trap 'rm -f -- "$unit_tmp" "$dropin_tmp"' EXIT
sed \
  -e "s|@ROOT@|$root_sed|g" \
  -e "s|@HOME@|$home_sed|g" \
  -e "s|@NODE_DIR@|$node_dir_sed|g" \
  "$TEMPLATE" > "$unit_tmp"
cat > "$dropin_tmp" <<EOF
[Unit]
Wants=$WORKLOAD_UNIT
After=$WORKLOAD_UNIT
EOF

mkdir -p -- "$USER_UNIT_DIR" "$DASHBOARD_DROPIN_DIR"
install -m 0600 "$unit_tmp" "$WORKLOAD_UNIT_PATH"
install -m 0600 "$dropin_tmp" "$DASHBOARD_DROPIN_PATH"
systemctl --user daemon-reload
systemd-analyze --user verify "$WORKLOAD_UNIT_PATH"
systemctl --user enable "$WORKLOAD_UNIT"
systemctl --user start "$WORKLOAD_UNIT"
systemctl --user is-active --quiet "$WORKLOAD_UNIT" || { printf 'workload isolation unit did not start\n' >&2; exit 3; }

target_cgroup="$(systemctl --user show "$WORKLOAD_UNIT" -p ControlGroup --value)"
dashboard_cgroup="$(systemctl --user show "$DASHBOARD_UNIT" -p ControlGroup --value)"
expected_prefix="/user.slice/user-$(id -u).slice/user@$(id -u).service/"
[[ "$target_cgroup" == "$expected_prefix"* && "$target_cgroup" != "$dashboard_cgroup" ]] || {
  printf 'unsafe workload cgroup target\n' >&2
  exit 3
}
target_procs="/sys/fs/cgroup$target_cgroup/cgroup.procs"
[[ -w "$target_procs" && ! -L "$target_procs" ]] || { printf 'workload cgroup is not writable\n' >&2; exit 3; }

before="$(workload_inventory)"
if [[ "$before" == 'server=absent' ]]; then
  printf 'workload isolation installed; dedicated tmux server will own future sessions\n'
  exit 0
fi

tmux_pid="$(tmux display-message -p '#{pid}')"
[[ "$tmux_pid" =~ ^[1-9][0-9]*$ && -r "/proc/$tmux_pid/stat" ]] || { printf 'could not resolve workload tmux server\n' >&2; exit 4; }
dashboard_pid="$(systemctl --user show "$DASHBOARD_UNIT" -p MainPID --value)"
[[ "$tmux_pid" != "$dashboard_pid" ]] || { printf 'dashboard cannot be the workload tmux server\n' >&2; exit 4; }

printf '%s\n' "$tmux_pid" > "$target_procs"
for _ in $(seq 1 10); do
  moved=0
  while IFS= read -r pid; do
    [[ "$pid" =~ ^[1-9][0-9]*$ && -r "/proc/$pid/cgroup" ]] || continue
    if [[ "$(process_cgroup "$pid" || true)" != "$target_cgroup" ]]; then
      printf '%s\n' "$pid" > "$target_procs" 2>/dev/null || true
      moved=1
    fi
  done < <(descendant_pids "$tmux_pid")
  [[ "$moved" == 0 ]] && break
  sleep 0.1
done

remaining=0
while IFS= read -r pid; do
  [[ "$pid" =~ ^[1-9][0-9]*$ && -r "/proc/$pid/cgroup" ]] || continue
  if [[ "$(process_cgroup "$pid" || true)" != "$target_cgroup" ]]; then
    printf 'tmux descendant %s did not enter the workload cgroup\n' "$pid" >&2
    remaining=1
  fi
done < <(descendant_pids "$tmux_pid")
[[ "$remaining" == 0 ]] || exit 5
[[ "$(process_cgroup "$dashboard_pid")" == "$dashboard_cgroup" ]] || { printf 'dashboard cgroup changed unexpectedly\n' >&2; exit 5; }

after="$(workload_inventory)"
if [[ "$before" != "$after" ]]; then
  printf 'workload inventory changed during cgroup isolation\n' >&2
  diff -u <(printf '%s\n' "$before") <(printf '%s\n' "$after") >&2 || true
  exit 6
fi

printf 'workload tmux isolated in %s; inventory unchanged\n' "$WORKLOAD_UNIT"
