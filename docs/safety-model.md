# Safety model

PaneFleet is privileged operator software. Its design assumes that observation is common, mutation is narrow, and ambiguous terminal state must fail toward human review.

## Assets to protect

- terminal input and exact worker ownership;
- live tmux sessions and workload processes;
- queued prompts, delivery state, and audit history;
- workspace files and generated artifacts;
- service commands and credentials available to the host user;
- network access rules; and
- the availability of the control plane itself.

## Trust assumptions

PaneFleet assumes:

- one trusted operator controls the browser, host account, and workload tmux server;
- the dashboard is reached through loopback, HTTPS, or a private/tunneled transport with tightly restricted ingress;
- the host operating system and explicitly configured command-line tools are trusted;
- `services.json` and `host-config.json` are reviewed machine-local configuration; and
- terminal output, project instructions, logs, filenames, and agent-authored status reports are untrusted data.

PaneFleet authenticates one shared operator on non-loopback listeners by default. An explicit trusted-network deployment may delegate that first boundary to independently verified exact-source ingress. PaneFleet does not identify several people or assign roles.

## Authentication layers

PaneFleet applies separate transport, listener, and request controls:

1. **Transport and network** — loopback, an SSH/private tunnel, or HTTPS plus restricted ingress limits who can reach the service.
2. **Non-loopback operator challenge** — by default, any non-loopback bind requires HTTP Basic username `host-control` and an operator token of at least 24 characters before serving the app. A deliberate `trusted-network` override may delegate this layer to externally enforced exact-source ingress. Loopback remains frictionless.
3. **Same-page control session** — loading the app issues an HttpOnly, SameSite=Strict cookie. Every operational `/api` route requires that current cookie. `/healthz` is the only intentionally minimal public endpoint.
4. **Mutation checks** — POST requests additionally require JSON and same-origin request checks.

When the authenticated non-loopback mode needs a Basic credential and no token is injected through `ORCHESTRATOR_ACCESS_TOKEN`, PaneFleet creates and reuses a random owner-only `data/access-token`. The server reads that credential through one nonblocking, no-follow file descriptor and requires a regular file owned by the current user with mode `0400` or `0600` and valid contents before listening. Trusted-network mode does not create or use a Basic token. The local `scripts/show-access-token.sh` helper opens the file once, verifies that its descriptor still matches the inspected path, and validates and reads that descriptor before revealing the token.

HTTP Basic provides no transport encryption. It must be used only through HTTPS or a private/tunneled transport. HTTPS deployments should set `ORCHESTRATOR_SECURE_COOKIE=1` so the control-session cookie is marked `Secure`.

## Read and mutation boundary

Read-only discovery can report tmux sessions, panes, listeners, processes, Git state, and registered services. Mutation is limited to named API operations with server-side validation.

There is no endpoint that accepts an arbitrary shell command or filesystem path. Service actions are loaded from `services.json` at startup. The registry rejects malformed actions, requires every action to be explicitly safe or confirmed, and requires confirmation for tmux-backed and public-IP actions.

All operational API reads and writes require the current control cookie. Mutating requests also require JSON and origin checks when the browser supplies an Origin header. Response headers apply a self-only content security policy and deny framing, cross-origin resource use, referrers, and unnecessary browser permissions.

## Exact terminal identity

A visible pane coordinate alone is not durable because a tmux window or pane can be replaced. Sensitive actions therefore bind to:

1. tmux session name and creation time;
2. window and pane coordinate;
3. intrinsic tmux pane ID; and
4. pane PID.

PaneFleet re-queries tmux and compares that identity immediately before sensitive input. A mismatch fails closed. Input is serialized per pane so simultaneous browser windows cannot merge prompts or keys.

## Normal prompt delivery

Normal agent input behaves like terminal typing:

1. revalidate the target and Codex process;
2. arm per-pane exit preservation and revalidate the same intrinsic pane identity;
3. type literal text in bounded chunks;
4. revalidate between chunks and before submission;
5. confirm stable rendering with paired markers when the workflow requires it;
6. send one Enter; and
7. observe stable evidence that Codex accepted the submission.

PaneFleet does not use normal dispatch to send `Ctrl-C`, respawn a pane, kill a session, signal a process, or switch a tmux client. Those recovery actions remain separate and visibly confirmed.

If text rendering or acceptance cannot be proven, PaneFleet records an uncertain state and does not retry Enter. This can leave text visible but unsubmitted; the operator must inspect the exact terminal.

## Prompt queue invariants

- Queue creation binds a prompt to the exact current pane identity and performs no terminal input.
- Idea creation and rejection perform no terminal input. Only explicit approval creates an implementation ticket; refinement tickets are linked, labeled planning-only, and cannot silently approve their parent idea.
- Idea generation shares only selected redacted completion summaries, labels them as untrusted data, and previews the exact prompt. Owner mode uses the ordinary FIFO; scout mode is memory/disk/concurrency gated and read-only; draft mode sends no request. Imported ideas remain `proposed`, and active or recently rejected title duplicates are suppressed.
- Agent-proposed ideas are accepted only from a trustworthy exact-pane queued response with complete structured markers. This includes the bounded no-footer return path, which proves terminal flow rather than task completion; every extracted idea still enters review and never dispatches automatically.
- Recurring schedules use parsed five-field UTC cron only; they do not invoke a shell, `crontab`, service action, or arbitrary command.
- A due schedule adds at most one ordinary queue item, coalesces while its prior item is open, and never replays a downtime backlog.
- A schedule retains the original exact pane identity. Missing or replaced panes are skipped rather than retargeted.
- Pausing, resuming, or deleting a schedule performs no terminal input; deletion leaves already queued items unchanged.
- Green requires a live Codex process plus the explicit idle, healthy, prompt-ready state; low CPU alone is not enough.
- A dead pane is retained for inspection, reported as stopped, and is never green or eligible for terminal input.
- A live shell left behind after Codex exits is not treated as promptable. **Restart Codex** is an explicit operator action bound to that agent session; the server rechecks the pane is live, shell-owned, and has no active Codex descendant before sending `codex resume --last` plus one Enter. Terminal output alone can never trigger the restart.
- A visible nonzero `background terminal` count overrides the drawn composer and keeps queue readiness blue.
- The same exact identity must be green in at least two observations separated by the configured stability interval.
- Dispatch persists an owner-only claim before typing into the pane.
- Each terminal has one FIFO line and only its head item can dispatch.
- Active Codex runtime signals take precedence over stale ready-looking text: background work, interruptible work, and deferred-message banners keep automatic dispatch blocked.
- Accepted delivery is not task completion. The sent head blocks its line until the same exact pane shows stable readiness plus either a `Worked for` final-response boundary or a safely bounded return to a later composer. A footerless return is recorded as terminal flow, never as proof the project task is Done.
- Slash-prefixed queue items are submitted literally without PaneFleet markers. They are recorded only as command submissions, and successor prompts still require the exact terminal to pass the normal stable-ready gate.
- An operator may explicitly leave a queue line only while its item is still queued. The revision-checked action is serialized with dispatch, sends no terminal input, and fails closed once dispatch has durably claimed the item.
- **Wait again — no resend** is available only for an unsent `needs_review` item stopped at literal confirmation. It requires the current revision and original exact pane, keeps the queue line blocked, survives restart, and observes only whether that marker later has two stable acceptance samples after the operator submits manually. It never types or presses Enter. **Dismiss after review** and **Stop waiting** cancel the unsent item without input or retry; sent items, other review causes, stale identities, and replacement panes fail closed, while a linked refinement idea returns to `proposed`.
- **Requeue once** is available only for a delivered `completion_target_replaced` review and one live same-session Codex replacement. A revision check serializes the decision, the old delivery is archived without a completion claim, and exactly one new item inherits its prompt and optional Idea link. The recovery action sends no input, and repeating it against the archived item fails closed.
- A **Newer activity detected** review can be explicitly returned to monitoring. The action acknowledges only activity through that warning, sends and resends nothing, pauses again on later manual input, and rejects completion evidence containing a newer prompt before the original turn's first final footer.
- Intermediate green-looking tool output cannot create a completion snapshot or release the next prompt. A verified final snapshot searches the complete item-specific response boundary and is redacted before owner-only persistence; snapshots above 32 KiB retain a visibly marked tail.
- A restart during dispatch, identity change, incomplete rendering, uncertain Enter, or uncertain acceptance moves the prompt to human review.
- Long marked queue prompts may prove their leading and trailing witnesses in separate stable captures, but only across bounded literal chunks with exact-pane revalidation between them. Enter remains a single final action after both witnesses are proven.
- An uncertain attempt is never retried automatically and blocks later prompts for that terminal until reviewed or dismissed.
- Queue delivery cannot interrupt or stop a session, start a service, or select another terminal.

Prompt queue and notification state is written atomically with owner-only permissions. Operational state remains local and must not be committed.

All connected SSE clients share one server-owned snapshot broadcast timer. Each client starts from a complete sequenced snapshot. Later cycles fan out the same top-level patch, and the browser applies it only when its current sequence exactly matches the patch base; a gap reconnects for a new complete snapshot. The server sends a complete snapshot instead when a patch would be larger. Concurrent cache misses share one in-flight collection, an initial connection may reuse only the bounded `SNAPSHOT_EVENT_CACHE_MS` result, and the timer stops when the last client disconnects. Prompt delivery remains owned by its independent monitor rather than the browser stream. The longer `SNAPSHOT_OBSERVATION_CACHE_MS` cache contains only passive telemetry, process summaries, and SSH-peer display data; it is never consulted for queue readiness, pane identity, terminal input, service control, or network mutation. Every such action performs its own current-state validation.

Host resource reporting is read-only. Memory pressure uses Linux `MemAvailable` rather than treating reclaimable filesystem cache as unavailable, swap comes from `/proc/meminfo`, and root-disk capacity comes from `statfs`. Disk warnings never run cleanup commands or remove files.

## Filesystem boundary

Workspaces originate from the primary project root, reviewed additional roots in ignored host configuration, and live pane context. Explicit workspace entries and display aliases must stay inside an allowed root. Before reading, PaneFleet resolves real paths and verifies containment, including symlinks. Reads are capped and sensitive-looking values are redacted.

Project Desk:

- reports bounded Git and instruction data;
- never runs a discovered package script;
- discovers PDFs and HTML pages in built-in or explicitly configured output directories, durable root-level HTML consoles, and root-level PDF or Markdown outputs modified during the focused exact tmux session;
- represents files with opaque identifiers rather than browser-supplied paths; and
- revalidates the exact pane, canonical root, selected file, size, extension, content, and any applicable session-time boundary at download time.

## Lifecycle isolation

The normal control plane is supervised by a user systemd unit, outside the default workload tmux server. Restarting the dashboard therefore does not require a tmux server or workload session operation.

The restart helper:

- records the complete workload pane inventory;
- restarts only the user systemd unit;
- waits for stable local health;
- verifies that the listening process is the systemd MainPID; and
- fails if the workload inventory changed.

When the browser detects that its static interface and the running backend are from different builds, the warning bar offers a confirmation-gated **Restart dashboard** action. The action is fixed in `services.json`; browser input cannot supply a command. It schedules the restart helper in a separate transient user-systemd unit so the helper survives the dashboard process being replaced, then the browser waits for a matching healthy runtime before reloading.

The optional ephemeral review agent uses a separate named tmux socket and a read-only sandbox. Its lifecycle cannot target the default workload tmux server.

## Passive Codex usage history

PaneFleet reads only structured numeric/config fields from rollout files already proven to belong to exact live Codex processes. It never types `/status` or `/usage` to collect stats. Current context remains attributed to the exact live rollout. Usage history replays token-count events from the beginning of every mapped rollout, computes monotonic cumulative deltas, records a durable complete-line byte offset, and resumes incrementally without double-counting. The first real token event is counted; malformed, truncated, missing, regressed, or ambiguously attributed data fails closed. Events are grouped by their own UTC timestamps and tmux session name, so a session row may combine several restarted rollouts. A token delta is attached to a queued ticket only when exactly one same-session ticket owns that event timestamp; manual work and overlapping or uncertain boundaries stay out of per-ticket totals. Cached input is a subset of processed input and is not presented as unique-token or account-limit consumption. These host-local counters are not Codex `/usage` account activity and cannot include work performed outside mapped rollouts on this host. Rate-limit percentages are pool-specific shared account snapshots, not per-agent consumption. Session and account observations older than 15 minutes are labeled stale and last reported. Passive events may omit model-specific pools that Codex `/status` can show. The owner-only `data/codex-usage-history.json` ledger stores bounded, internally consistent counters, timestamps, source hashes, byte offsets, queue identifiers, tmux session names, and compact account-limit observations; it stores no prompts, responses, captured terminal text, or rollout paths. History is capped at 90 UTC days and 1,000 ticket summaries.

## Optional network-rule boundary

The EC2 integration accepts only an explicit globally routable IPv4 address and authorizes its exact `/32`. It never authorizes `0.0.0.0/0` as a normal action.

Cleanup requires a fresh preview and token. It can remove only rules with the exact PaneFleet ownership format and preserves active SSH sources plus unmanaged, IPv6, source-group, prefix-list, broad, and unrelated port rules.

This integration depends on EC2 metadata, AWS CLI credentials, least-privilege IAM, and a network topology that matches its assumptions. Do not enable it merely because the UI exposes the option.

## Failure philosophy

PaneFleet prefers a visible unresolved state to a guessed action:

- no automatic prompt resend;
- no automatic Done;
- no automatic session stop;
- no service action inferred from terminal text;
- no cleanup without preview and confirmation; and
- no lifecycle recovery that destroys the workload tmux server.

These controls reduce risk; they do not make open-internet deployment safe. Follow [SECURITY.md](../SECURITY.md) and [Operations](operations.md).
