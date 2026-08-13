# Operations

This guide covers foreground evaluation, a persistent user-systemd installation, lifecycle checks, and the optional EC2 integration.

## Choose the network boundary first

The recommended topology is:

```text
browser -> SSH tunnel or private overlay -> 127.0.0.1:8787 on the host
```

Loopback access is intentionally frictionless: the page issues a control cookie, and every operational API requires it. By default, a non-loopback bind adds a browser HTTP Basic challenge with username `host-control` and a long operator token before the page can issue that cookie.

HTTP Basic does not encrypt credentials. Use a non-loopback listener only behind HTTPS or a private/tunneled transport, and continue restricting host and cloud firewalls to exact trusted sources. PaneFleet has one shared operator credential, not accounts or roles.

## Foreground evaluation

```bash
npm ci
cp services.example.json services.json
HOST=127.0.0.1 PORT=8787 npm start
```

Verify health from the host:

```bash
curl -fsS http://127.0.0.1:8787/healthz
```

Use an SSH tunnel from a remote workstation:

```bash
ssh -N -L 8787:127.0.0.1:8787 user@your-host
```

Foreground mode is suitable for evaluation. Closing its shell stops only PaneFleet, not the workload tmux server.

## Recurring prompt operations

Use the Queue composer rather than editing `data/prompt-queue.json` or installing a host `crontab` entry. Select the exact terminal, enter the prompt, and optionally enter a five-field UTC schedule. Common examples:

| UTC cron | Meaning |
| --- | --- |
| `*/15 * * * *` | every 15 minutes |
| `0 * * * *` | at the start of every hour |
| `0 */4 * * *` | every four hours |
| `0 9 * * *` | daily at 09:00 UTC |
| `0 9 * * 1-5` | weekdays at 09:00 UTC |

The Recurring prompts section shows the next run and last scheduling outcome. **Queue now** adds one ordinary FIFO occurrence without changing the cron or paused state; if that schedule already has open work, the request coalesces instead of creating a duplicate. Pause prevents future automatic intake; resume calculates a fresh next run. Delete removes only the schedule, not an item it already added to the queue. An unavailable exact pane is intentionally skipped. If a live same-session replacement exists, **Retarget current session** updates only the schedule's exact identity while preserving its paused state and counters; otherwise create a new schedule deliberately.

When a delivered queue item reports **Terminal replaced**, inspect the current same-session terminal first. If the work is still unresolved, **Requeue once** archives the old delivery without claiming it completed and creates one fresh queued copy on that exact replacement. This confirmed action sends no terminal input and cannot be repeated on the archived item. Do not use it when the old turn may already have completed unless the duplicate-work risk is acceptable.

## Authenticated non-loopback access

Set `HOST` to a non-loopback address only after an encrypted transport and narrow ingress are ready. On first startup, PaneFleet creates a random token at `data/access-token` unless `ORCHESTRATOR_ACCESS_TOKEN` supplies a value of at least 24 characters.

Reveal the generated token from a local shell:

```bash
bash scripts/show-access-token.sh
```

The helper requires the token file to be owned by the current user with mode `0600`. In the browser's Basic prompt use:

- username: `host-control`
- password: the generated or configured token

The Basic credential gates the page and static assets. The page then issues the separate control cookie required by every `/api` route. `/healthz` remains a minimal unauthenticated readiness endpoint.

### Explicit trusted-network mode

If the host firewall or cloud security group has been independently verified to permit the dashboard port only from the operator's exact IPv4 `/32`, the Basic prompt can be disabled with:

```text
ORCHESTRATOR_ACCESS_MODE=trusted-network
```

This is an explicit deployment override, not the public default. It does not disable the same-page HttpOnly control cookie, JSON and same-origin checks, CSP, tmux identity validation, or allowlisted service controls. Do not use it with `0.0.0.0/0`, IPv6-wide, ranged, shared, source-group, prefix-list, or otherwise unverified access.

When the browser-facing URL is HTTPS, set this in the PaneFleet service environment:

```text
ORCHESTRATOR_SECURE_COOKIE=1
```

This marks the control cookie `Secure`. Do not set it for a plain loopback HTTP URL, because the browser will correctly refuse to send a Secure cookie over HTTP.

After installing the user systemd unit, add the setting through a drop-in and restart PaneFleet after the HTTPS endpoint is ready:

```bash
systemctl --user edit agent-orchestrator.service
```

```ini
[Service]
Environment=ORCHESTRATOR_SECURE_COOKIE=1
```

Apply the drop-in with the inventory-preserving restart helper:

```bash
systemctl --user daemon-reload
bash scripts/restart-dashboard.sh
```

## Fresh systemd installation

The normal persistent control plane is a user systemd unit. A fresh installation defaults to loopback, installs the unit, enables it, starts it, and waits for health without touching tmux:

```bash
npm ci
cp services.example.json services.json
bash scripts/install-control-plane.sh
bash scripts/isolate-workload-tmux.sh
```

Skip the copy when a reviewed ignored `services.json` already exists. The second command installs the dedicated workload unit and either anchors a new default tmux server there or moves the existing server and its descendants without replacing any pane. Require its unchanged-inventory confirmation before continuing.

Choose a different bind address or port at install time only when needed:

```bash
ORCH_BIND_HOST=0.0.0.0 ORCH_PORT=8787 bash scripts/install-control-plane.sh
```

This non-loopback example activates the built-in Basic challenge and creates the owner-only token on first start. Establish HTTPS or a private/tunneled transport and narrow ingress before using it, then retrieve the token locally with `scripts/show-access-token.sh`.

The installer writes `ORCH_BIND_HOST` and `ORCH_PORT` into the unit. `ORCH_HEALTH_HOST` controls only the local readiness address and defaults to `127.0.0.1`.

Confirm the result:

```bash
bash scripts/control-plane-status.sh
```

To keep the user service manager running without an active login session, an administrator can enable lingering:

```bash
sudo loginctl enable-linger "$USER"
```

Review this command under the host's account policy; it changes user-service persistence.

## Migration from a legacy tmux-backed dashboard

Only installations that already run PaneFleet in legacy control sessions need migration. The same install-time bind and port variables apply:

```bash
bash scripts/install-control-plane.sh --migrate
bash scripts/isolate-workload-tmux.sh
```

Migration enables lingering and the user unit, validates the exact legacy control panes, interrupts only those control panes, waits for port ownership to clear, starts systemd, verifies stable health, and compares the complete workload tmux inventory. The isolation step then places that preserved workload server in its durable cgroup.

Do not use `--migrate` as a generic repair command. Inspect its prerequisites and current control-plane state first.

## Status and restart

```bash
bash scripts/control-plane-status.sh
bash scripts/restart-dashboard.sh
```

The restart helper:

1. takes a complete workload pane inventory;
2. restarts only `agent-orchestrator.service`;
3. waits for two healthy loopback samples;
4. confirms that the listener belongs to the systemd MainPID; and
5. fails if the workload inventory changed.

It does not destroy a tmux server or workload session.

Useful read-only diagnostics:

```bash
systemctl --user status agent-orchestrator.service
journalctl --user -u agent-orchestrator.service --since today
ss -ltnp | awk 'NR==1 || /:8787/'
curl -fsS http://127.0.0.1:8787/healthz
```

Operational API routes intentionally reject command-line requests that do not carry a same-page control cookie. Use the browser for snapshots and audit data. Do not paste operational output into public issues without sanitizing it.

## Runtime state

Durable state lives under `data/` and should remain owner-readable only. It may contain queued prompt text, compatibility mission text, pane summaries, audit records, notifications, managed access-rule state, and the generated non-loopback access token.

Before a protected backup, stop only the PaneFleet user unit, copy `data/` to a private destination, and start the unit again. Never include `data/`, logs, or terminal captures in a source archive.

## Optional EC2 access integration

The access-rule tools require all of the following:

- an EC2 instance with metadata access available to the PaneFleet process;
- AWS CLI in the service PATH;
- an explicit security group or an unambiguous instance security-group context;
- least-privilege permission to describe instances and security-group rules, authorize ingress, and revoke only approved rule IDs; and
- a network design based on exact trusted IPv4 `/32` sources.

Set `ORCHESTRATOR_SECURITY_GROUP_ID` when instance metadata does not identify one unambiguous target. Keep credentials outside `services.json` and the repository.

Adding an address and cleaning old managed addresses are separate confirmed operations. Always inspect the preview. Do not use this feature for shared, IPv6-first, proxy-based, or otherwise incompatible network topologies without extending and testing the safety model.

## Troubleshooting

### Workload tmux isolation

PaneFleet and the default workload tmux server must live in different user-systemd cgroups. `panefleet-workloads.service` owns the persistent default tmux server; `agent-orchestrator.service` observes and controls it but must never own its processes. This boundary lets the dashboard restart without terminating agents.

Run `bash scripts/control-plane-status.sh` and require `workload_cgroup=separate` whenever workload tmux is present. This means the tmux server belongs to the dedicated workload service, not merely a different transient cgroup. If it reports `shared`, `unmanaged`, or `unknown`, do not restart PaneFleet. Run `bash scripts/isolate-workload-tmux.sh` once, verify the full pane inventory is unchanged, and then re-run the status check. Never stop `panefleet-workloads.service` unless intentionally ending every workload session it owns.

### A non-loopback browser keeps requesting credentials

- Confirm the username is exactly `host-control`.
- Run `bash scripts/show-access-token.sh` locally and compare the current token without copying it into logs or chat.
- If `ORCHESTRATOR_ACCESS_TOKEN` is injected by a supervisor, confirm it is at least 24 characters and that the running unit received it.
- Clear a cached incorrect Basic credential by closing the browser session or using a private window.
- Confirm a proxy forwards the `Authorization` header.

### The page loads but API calls return `control_session_required`

- Reload the page so it can issue the current process's control cookie.
- A dashboard restart intentionally invalidates the previous cookie.
- If `ORCHESTRATOR_SECURE_COOKIE=1`, confirm the browser-facing URL is HTTPS. Secure cookies are not sent over plain HTTP.
- Confirm a proxy preserves `Set-Cookie` and browser cookies for the PaneFleet origin.

### The dashboard says the backend must restart

This means the browser assets and running server came from different PaneFleet builds. Use the confirmation-gated **Restart dashboard** button in the warning bar. PaneFleet schedules the allowlisted restart helper outside the process being replaced, waits for a healthy matching runtime, and reloads the page. Repeated clicks while that fixed helper is already active are treated as the same scheduled restart instead of a failed action. If the button cannot schedule the action, run `bash scripts/restart-dashboard.sh` locally. Do not kill a tmux server or workload session. After restart, confirm the warning clears and `bash scripts/control-plane-status.sh` reports the workload inventory unchanged.

### The page loads but shows no agents

- Confirm the workload tmux server belongs to the same host user.
- Run `tmux list-panes -a` as that user.
- Confirm the Codex process is running in the expected pane.
- Check the dashboard journal for a redacted collector error.

### Codex updated successfully but the terminal no longer accepts prompts

Codex's built-in updater exits the Codex process after installing the new version; the tmux pane remains alive at its shell, so pressing Enter alone does not restart anything. Open that exact terminal and choose **Restart Codex**, or use the same action in the selected-agent inspector. PaneFleet revalidates that the pane is a live shell with no active Codex process, then types `codex resume --last` plus one Enter. It does not destroy or replace the tmux session and does not restart automatically from terminal output.

### The service is active but health fails

- Check `systemctl --user status agent-orchestrator.service`.
- Confirm port 8787 is not owned by another process.
- Verify the installed unit has the intended bind address and Node path.
- Run `bash scripts/control-plane-status.sh` before any restart.

### A prompt is visible but not submitted

PaneFleet intentionally sends no Enter when full rendering cannot be proved. Open the exact terminal and inspect the draft. Choose **Wait again — no resend** to keep the ticket and its line blocked, then press Enter manually in that exact terminal if the complete prompt is visible. PaneFleet will only observe the existing dispatch marker and resume completion monitoring after stable acceptance; it will not type or submit anything. Choose **Dismiss after review** to cancel the unsent item and unblock the line, or **Stop waiting** later. These actions require the original exact pane and send no input.

### A queued prompt needs review

The dashboard lost certainty after claiming, rendering, or submitting that exact prompt, or it restarted while delivery was in progress. Inspect the assigned pane before taking any action. Use **Wait again — no resend** or **Dismiss after review** only for the unsent literal-confirmation case described above. Use **Release queue** only for an eligible delivered item whose completion evidence you reviewed; release does not claim the task is Done. Other review causes remain paused unless their specific recovery control is present. PaneFleet never resends an uncertain item automatically.
