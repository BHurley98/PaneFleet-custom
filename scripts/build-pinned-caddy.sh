#!/usr/bin/env bash
set -euo pipefail

if [[ $# -ne 1 || "$1" != /* ]]; then
  echo 'usage: build-pinned-caddy.sh /absolute/output/caddy' >&2
  exit 2
fi

panefleet_caddy_output=$1
if [[ -e "$panefleet_caddy_output" || -L "$panefleet_caddy_output" ]]; then
  echo 'refusing to overwrite existing output' >&2
  exit 2
fi
if [[ ! -d "$(dirname "$panefleet_caddy_output")" ]]; then
  echo 'output parent must already exist' >&2
  exit 2
fi

panefleet_go_version='1.26.5'
panefleet_go_archive="go${panefleet_go_version}.linux-amd64.tar.gz"
panefleet_go_sha256='5c2c3b16caefa1d968a94c1daca04a7ca301a496d9b086e17ad77bb81393f053'
panefleet_caddy_version='v2.11.4'
panefleet_xcaddy_version='v0.4.5'
panefleet_route53_version='v1.6.2'
panefleet_build_root=$(mktemp -d)

panefleet_cleanup() {
  # Go marks module-cache content read-only. Restore owner write permission so
  # the build-owned temporary tree can always be removed by the EXIT trap.
  chmod -R u+w "$panefleet_build_root" 2>/dev/null || true
  find "$panefleet_build_root" -xdev -mindepth 1 -depth -delete
  rmdir "$panefleet_build_root"
}
trap panefleet_cleanup EXIT

curl --proto '=https' --tlsv1.2 --fail --silent --show-error --location \
  "https://go.dev/dl/${panefleet_go_archive}" \
  --output "$panefleet_build_root/$panefleet_go_archive"
printf '%s  %s\n' "$panefleet_go_sha256" "$panefleet_build_root/$panefleet_go_archive" | sha256sum --check --strict
tar -C "$panefleet_build_root" -xzf "$panefleet_build_root/$panefleet_go_archive"

panefleet_go_bin="$panefleet_build_root/go/bin/go"
panefleet_go_path="$panefleet_build_root/gopath"
panefleet_go_cache="$panefleet_build_root/go-cache"
panefleet_go_mod_cache="$panefleet_build_root/go-mod-cache"
env GOTOOLCHAIN=local GOPATH="$panefleet_go_path" GOCACHE="$panefleet_go_cache" GOMODCACHE="$panefleet_go_mod_cache" \
  "$panefleet_go_bin" install "github.com/caddyserver/xcaddy/cmd/xcaddy@${panefleet_xcaddy_version}"
env PATH="$panefleet_build_root/go/bin:$panefleet_go_path/bin:/usr/bin:/bin" \
  GOTOOLCHAIN=local GOPATH="$panefleet_go_path" GOCACHE="$panefleet_go_cache" GOMODCACHE="$panefleet_go_mod_cache" CGO_ENABLED=0 \
  "$panefleet_go_path/bin/xcaddy" build "$panefleet_caddy_version" \
  --with "github.com/caddy-dns/route53@${panefleet_route53_version}" \
  --output "$panefleet_caddy_output"

"$panefleet_caddy_output" version
"$panefleet_caddy_output" list-modules | rg -x 'dns\.providers\.route53'
sha256sum "$panefleet_caddy_output"
