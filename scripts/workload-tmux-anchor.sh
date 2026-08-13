#!/usr/bin/env bash
set -euo pipefail

unset TMUX TMUX_PANE
command -v tmux >/dev/null || { printf 'tmux is required\n' >&2; exit 2; }
command -v sleep >/dev/null || { printf 'sleep is required\n' >&2; exit 2; }

# Keep the default workload server available even when it has no sessions. New
# panes are then forked by this server and inherit its dedicated systemd cgroup,
# never the PaneFleet dashboard service that requested their creation.
tmux start-server \; set-option -g exit-empty off
exec sleep infinity
