#!/usr/bin/env bash
set -euo pipefail
export LC_ALL=C

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)"
ROOT="$(cd -- "$SCRIPT_DIR/.." && pwd)"
TOKEN_FILE="${ORCHESTRATOR_ACCESS_TOKEN_FILE:-$ROOT/data/access-token}"

if [[ ! -f "$TOKEN_FILE" || -L "$TOKEN_FILE" ]]; then
  printf 'access token file is missing or unsafe: %s\n' "$TOKEN_FILE" >&2
  printf 'It is created automatically after PaneFleet first starts on a non-loopback bind.\n' >&2
  exit 1
fi

path_mode="$(stat -c '%a' -- "$TOKEN_FILE")"
path_owner="$(stat -c '%u' -- "$TOKEN_FILE")"
if [[ ! "$path_mode" =~ ^[46]00$ || "$path_owner" != "$(id -u)" ]]; then
  printf 'access token file must be owned by the current user with mode 400 or 600\n' >&2
  exit 2
fi

if ! exec {token_fd}<"$TOKEN_FILE"; then
  printf 'access token file is missing or unsafe: %s\n' "$TOKEN_FILE" >&2
  exit 1
fi
fd_path="/proc/self/fd/$token_fd"
if ! path_identity="$(stat -c '%d:%i' -- "$TOKEN_FILE")" ||
   ! fd_identity="$(stat -Lc '%d:%i' -- "$fd_path")" ||
   [[ -L "$TOKEN_FILE" || "$path_identity" != "$fd_identity" ]]; then
  exec {token_fd}<&-
  printf 'access token file changed while it was being inspected: %s\n' "$TOKEN_FILE" >&2
  exit 1
fi

mode="$(stat -Lc '%a' -- "$fd_path")"
owner="$(stat -Lc '%u' -- "$fd_path")"
if [[ ! "$mode" =~ ^[46]00$ || "$owner" != "$(id -u)" ]]; then
  exec {token_fd}<&-
  printf 'access token file must be owned by the current user with mode 400 or 600\n' >&2
  exit 2
fi

token="$(cat <&"$token_fd")"
exec {token_fd}<&-
if [[ ! "$token" =~ ^[[:graph:]]{24,512}$ ]]; then
  printf 'access token file is invalid\n' >&2
  exit 3
fi

printf '%s\n' "$token"
