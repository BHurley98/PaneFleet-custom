# Features

PaneFleet is organized around one primary workflow: keep live terminals easy to reach, then put queue and host operations nearby without letting them obscure the terminal.

## Terminal workspace

- Discovers tmux panes and distinguishes Codex workers from registered services.
- Sorts workers by recent dashboard interaction and supports browser-local pinning.
- Opens several live terminal previews without attaching or switching tmux clients.
- Jumps directly to any named open terminal from an ultrawide workspace or fullscreen phone terminal, including restoring docked views without stepping through every window.
- Restores open and docked live terminal views after browser refresh only when the saved session creation time and pane identity still match the current agent; freeform widescreen geometry and intentional capture pauses return with them.
- Supports free drag/resize windows plus one-, two-, and four-pane layouts on desktop.
- Lets desktop operators independently show or hide the Sessions and Details panels, remembers both choices locally, and still offers a persistent Focus canvas mode with `Alt+0`.
- Keeps off-screen monitoring useful with a browser title that prioritizes offline/polling state, decisions, queue depth, or active work, plus a decision-count app badge where supported.
- Keeps phone sessions in a bounded vertical list for fast scanning, then shows exactly one fullscreen terminal at a time with quick tools and the reply composer collapsed until requested.
- Scales live terminal text from 80% to 140% with one browser-local preference shared across every open terminal.
- Switches all terminal output between wrapped reading and horizontally scrollable exact-line views without changing pane capture or terminal input.
- Copies the currently captured terminal output in one tap, with a safe fallback when the modern Clipboard API is unavailable.
- Finds text inside long terminal captures in place, highlights matches, and cycles forward or backward without changing pane state.
- Pauses and resumes each browser-side live capture independently, with a persistent paused badge and no effect on the running agent.
- Separates browser-side reading controls from terminal-input commands, using a compact widescreen row and labeled mobile touch grids instead of a long horizontal tool strip.
- Opens the active terminal's in-app search with `Ctrl/Command+F`, and turns the displayed text percentage into a one-tap reset to 100%.
- Opens a complete keyboard shortcut guide from the top bar or the `?` key, with keyboard focus contained until it is dismissed.
- Switches the full workspace between light and night modes from the top bar, stores the preference only in that browser, and applies it before the stylesheet loads so refreshes do not flash the wrong theme.
- Preserves unsent drafts and recent sent-input history in the browser.
- Previews large or multiline pastes before inserting them into the terminal composer.
- Provides explicit Model, Status, Usage, Fast, and picker-navigation controls, plus a separately labeled Recovery group with confirmed Ctrl-C and Stop session actions in every live terminal.
- When Codex exits back to a live shell, including after its built-in updater succeeds, replaces the unavailable reply composer with an exact-terminal **Restart Codex** action. The same action remains available in the selected-agent inspector and runs the existing `codex resume --last` recovery path only after the operator clicks it.
- Reads numeric/config telemetry from the exact session file already held open by each live Codex process. Context capacity and the current cumulative counter belong to that exact rollout; rate-limit windows are account-wide snapshots shared across projects within each reported pool. Host-local processed totals include cached input repeated across turns and are explicitly separated from context, account-limit consumption, and Codex `/usage` account activity. The selected-agent inspector, phone strip, and Usage workspace label those scopes separately, show cached versus uncached input, and mark session or account observations older than 15 minutes as stale last-reported values. Only model-specific pools emitted in passive structured events can appear; Codex `/status` may show additional pools. The Usage workspace replays every available token-count event from rollout files already proven to belong to a PaneFleet agent, counts the first real event instead of discarding it as a baseline, records a durable byte offset for incremental deduplication, groups events by their UTC timestamps and tmux session, shows 30 days, and retains at most 90 days. Token deltas are also assigned to a queued ticket only when exactly one ticket for that session owns the event timestamp; manual and ambiguous activity remains unassigned. This path sends no slash command and stores numeric counters, queue identifiers, and timestamps rather than prompt or response text.

Closing or minimizing a browser terminal window does not stop its tmux session. Interrupt and stop remain visibly separate, confirmed recovery actions in the terminal Tools panel and selected-agent inspector.

## Project Desk

When a live terminal is focused, Project Desk resolves its canonical workspace and presents bounded project context:

- Git branch, commit, and changed-file summary;
- recognized check scripts from the nearest package metadata;
- capped excerpts from local project instruction files;
- links registered for services in the same workspace;
- generated PDFs and HTML pages from standard output folders, durable root-level HTML consoles, plus root-level PDF and Markdown outputs modified during the exact tmux session;
- browser-local project notes; and
- a browser-local prompt scratchpad with reusable snippets.

Project Desk does not execute discovered check scripts. File downloads use opaque identifiers and exact live-pane identity rather than accepting a filesystem path from the browser. HTML files inside a reviewed output folder also offer a one-click **Preview**. PaneFleet builds a self-contained copy from same-folder CSS and JavaScript, then serves it in a new tab under a restrictive CSP sandbox: the page can run its own inline interaction code but cannot reach the network, PaneFleet APIs or cookies, forms, frames, workers, host files, or its opener. Previewing starts no service and changes no listener, DNS, proxy, or ingress rule.

The scratchpad separates drafting from sending. Review shows the literal text and exact terminal identity, and only the final confirmation sends text plus Enter.

## Green-light prompt queue

Choose one exact live terminal and add the next plain prompt without interrupting its current work. Each terminal owns an independent FIFO line:

- **Blue** — the agent is working, so every queued prompt waits;
- **Green** — the visible Codex composer is ready; and
- **Needs review** — delivery became uncertain and the line is paused.

PaneFleet's server continues observing queued lines even when no dashboard tab is open. It requires two stable green observations before it durably claims and submits the first prompt for that terminal. A visible Codex `background terminal` indicator, interruptible work timer, or **Messages to be submitted after next tool call** banner keeps the line blue even when a stale composer or goal footer is also drawn. After acceptance, the item stays **Waiting for final response** until the same exact pane provides either a stable `Worked for` footer or a stable return boundary made from the exact dispatch marker, a non-empty response, a later composer, and the Codex status bar. The first is labeled **Verified final response**; the second is labeled **Returned to ready · no footer**. Both can release the next prompt, but the latter explicitly does not claim that the project task is Done. Stable green without either boundary becomes **Needs review**. The operator can inspect the exact terminal and choose **Release queue**, which never resends the prompt. Pane replacement, completion timeout, incomplete rendering, an uncertain Enter, uncertain acceptance, or a dashboard restart during dispatch also pauses the line. PaneFleet never retries an uncertain attempt.

One pre-Enter failure has two dedicated recovery paths. If the prompt may be visible but PaneFleet did not send Enter because full literal rendering could not be confirmed, **Wait again — no resend** keeps that exact ticket and line blocked while the operator submits the visible prompt manually. PaneFleet types nothing, never presses Enter, and resumes ordinary completion monitoring only after the same exact pane shows the dispatch marker inside two stable acceptance samples; the waiting state survives a restart and can be canceled with **Stop waiting**. **Dismiss after review** instead cancels the unsent item and lets the line continue. Both revision-checked actions require the original exact pane and an empty `sentAt`, reject stale revisions or replacement panes, and send no input. Dismissing a linked refinement ticket returns its idea to **Proposed** for another decision.

Long marked queue prompts are typed in bounded chunks. PaneFleet proves the leading witness while the first chunk is still in view, revalidates the exact pane between chunks, then proves the trailing witness before one Enter. This preserves paired-marker evidence when terminal wrapping or viewport movement prevents both ends from being visible in one capture; either checkpoint still fails closed without an automatic retry.

The Idea Queue includes **Generate ideas** after at least one verified completed queue result exists. The operator chooses a project, individual verified summaries, a focus, a bounded idea count, and one execution mode: serialize behind the current project owner, create or reuse a separately visible resource-gated read-only scout in that workspace, or copy the sanitized prompt into Compose without dispatching. Raw terminal captures are not shared. Generated blocks are deduplicated against active and recently rejected titles and enter the decision gate as **Proposed** only.

A delivered item whose exact terminal was replaced offers **Requeue once** only when a live same-session Codex replacement is available. The revision-checked transition atomically archives the unresolved original without claiming task completion and creates one fresh queued copy bound to the replacement's complete identity. The recovery action itself types nothing and presses no key; ordinary stable-green dispatch handles the new item later. PaneFleet warns that unseen completion of the old turn could make the fresh copy duplicate work, and the archived item cannot be requeued a second time.

A queued prompt whose normalized text starts with `/` is treated as a Codex slash command. PaneFleet types that command literally with Enter and adds no queue or dispatch markers before or after it. Immediate commands are recorded as **Delivered · Slash command submitted**, never **Finished**. Because `/goal` starts continuing work, its queue item stays active while the exact terminal is working; when that terminal returns stably ready, the item requires operator review rather than claiming task completion without a unique finish marker. Later items remain blocked until that review releases the line.

While an accepted ticket is open, its badge reports the exact agent phase rather than a generic pending label: blue while the agent is working and green while PaneFleet verifies a returned composer. A dispatch marker that has scrolled outside the bounded capture cannot prove a finish; after the exact pane returns stably ready, PaneFleet moves that ticket to **Capture boundary expired** review instead of leaving it pending until the 24-hour timeout.

A newer manual send or interrupt on the same exact pane supersedes an older ticket that still lacks finish evidence. PaneFleet moves that ticket to **Newer activity detected** review immediately, without attributing the new turn to it or sending terminal input. If the older ticket's own stable footer is still available, that exact evidence is captured first.

For **Newer activity detected** only, the operator can inspect the exact terminal and choose **Keep monitoring**. That action acknowledges the interaction that produced the warning, returns the original ticket to passive completion monitoring, sends no terminal input, and never resends the prompt. A later manual send or interrupt raises a new warning. A prompt boundary before the first final footer is rejected as evidence for the original ticket, preventing a later manual turn from being attributed to it.

The Queue tab is a full center workspace rather than a modal drawer. Its live terminal board makes readiness visible before composing: every exact pane has a selectable card with its readiness reason, active count, waiting backlog, and line head. Selected cards and the composer summary share the same exact-session draft state. Current queue lanes, verified completion statistics, completed deliveries, and older history stay visible on the same page. A never-sent item offers **Leave queue** while its durable status is still queued. The revision-checked action is serialized with dispatch, sends no tmux input, and is rejected once dispatch has claimed the item. A revision-checked **Clear history** action removes finished captured, legacy unconfirmed, and canceled records; active work, queued prompts, and recurring schedules are preserved, and the action never touches tmux.

The composer includes a browser-local **Ticket Refiner** for rough requests. It preserves the original, guides the operator through outcome, context, scope, non-goals, verification, and safety risks, and keeps the refined preview editable. Already detailed prompts remain unchanged unless the operator edits the guide. **Use refined draft** and **Keep original** change only the browser draft; queueing or sending remains a separate action. Refinement is bound to the complete identities of the selected panes, persists with the browser draft, and fails closed before dispatch if a target is replaced or changed. No refinement text is sent to an agent or backend service.

The **Idea queue** is a separate decision gate inside that workspace. Adding or rejecting an idea performs no terminal input. Approval is revision checked, revalidates the selected exact pane, and atomically creates the implementation ticket plus the idea's approved state. Resolved-Idea history is bounded, but an approved Idea remains retained while its linked implementation ticket is still open. Refinement creates a linked planning-only prompt; after a trustworthy exact-pane completion, its bounded result is attached to the idea and the idea returns to approval review. If the operator instead releases an unverified refinement after inspecting the exact pane, the idea returns to review unchanged and PaneFleet does not attach or claim a refinement result. One trustworthy captured or safely returned queue response can contribute up to twelve agent proposals through repeated explicit `[PANEFLEET IDEA]`, `TITLE:`, `DETAILS:`, and closing marker blocks. Proposal extraction happens before the display snapshot is truncated, and complete markers retained by older finished tickets are reconciled on startup.

The live terminal board can select up to twelve exact agents for one reviewed prompt. **Queue** creates all selected FIFO items in one durable update, or creates none when any target is stale. **Send now** delivers concurrently through each pane's normal literal-text-plus-Enter path and reports success or failure per terminal. Successful immediate sends cannot be rolled back, partial delivery is never retried automatically, and recurring schedules remain deliberately single-terminal.

On phones, the terminal board defaults to one recipient: choosing another agent from the native picker or tapping another card replaces the prior selection immediately. Fan-out remains available through the explicit **Select multiple** mode. Desktop cards keep their additive multi-select behavior.

For newly delivered prompts, PaneFleet waits for the same durable pane identity to return stably ready with a visible `Worked for` final boundary, then stores a redacted snapshot of the complete bounded final response with the completed ticket. Boundary discovery searches the entire item-specific response rather than only the rows nearest the footer, so long answers keep their opening and closing lines. Saved snapshots preserve useful terminal formatting, including bullets and separators, up to a 32 KiB local-data limit; only responses beyond that limit retain a visibly marked tail. A visible reconnect attempt or response-stream disconnect blocks readiness, and an interrupted turn cannot use the footerless safe-return fallback even if a stale composer sample briefly looked ready. A replaced pane cannot supply that snapshot, earlier history is not guessed retroactively, and capture never sends input or changes delivery success.

The composer also accepts an optional five-field UTC cron expression. Recurrence is implemented by PaneFleet's in-process scheduler, not the host shell or `crontab`. When due, it creates one normal prompt-queue item bound to the schedule's original exact pane identity. If that schedule already has an open item, the occurrence is coalesced. A missing or replaced pane causes a skipped occurrence, and a restart advances a missed schedule once without catch-up bursts. The Queue page lists active and paused schedules with next run, run count, last outcome, and explicit pause, resume, and delete controls. Paused schedules live in a separate group that can be collapsed, and that display preference persists across dashboard reloads. Those controls never send terminal input, and deleting a schedule leaves already queued items unchanged.

The Queue badge counts pending prompts. Queueing and scheduling never interrupt a session, press keys while blue, start a new worker, or choose a terminal on the operator's behalf.

Dashboard snapshots use one shared server-sent-event broadcast cycle for all connected browsers. A browser receives one complete snapshot when it connects, then sequenced top-level patches containing only domains that changed. All clients on a cycle receive the same patch, patches larger than the complete snapshot fall back to the complete form, and a missing sequence reconnects cleanly instead of merging uncertain state. Concurrent initial connections share in-flight work. A short event cache avoids immediately collecting the host again for a new connection, while a 15-second observation cache shares only display telemetry, top-process, and SSH-peer reads. SSE collection no longer duplicates prompt-queue processing; the independent server monitor continues queue work with or without a browser. These caches and patches change observation cost, not mutation safety: queue and control actions still revalidate current revisions, exact identities, and allowlisted authority.

## Attention and notifications

The attention feed still combines agent exceptions, unhealthy services, security warnings, and compatibility mission decisions outside the prompt queue. Exact Codex starter suggestions are not treated as submitted prompts or unresolved placeholders. Mission cards show their last-update age beside the workspace so historical unresolved decisions are visibly distinct from new failures. Browser notifications are deduplicated and can open or snooze the corresponding item.

## Services and host tools

- Pulse shows only current exceptions, queue/agent counts, Linux available-memory use, root-disk capacity, and direct links to live apps.
- Apps groups registered and auto-discovered targets into attention, live, ready, and discovered lanes; raw commands, captured output, and recovery controls stay collapsed under Details.
- Terminals shows live non-Codex tmux workloads alongside agents as read-only sessions. Multi-window workloads are grouped once by tmux session, and only real Codex agents receive prompt or queue controls.
- Host explains available memory, swap use, root-disk capacity, load, uptime, control-plane supervision, listening-port exposure and ownership, recognizable resource consumers, and recent control outcomes. Root-disk use at 90% enters Attention and becomes critical at 95%; this warning is observation-only and never deletes data.
- Opens links for live registered service ports and discovered HTTP listeners.
- Starts, stops, or restarts only services with an explicit registry entry.
- Runs only registry actions that pass startup validation.
- Keeps read-only discovery separate from mutation rights.

The local registry may describe host-specific workflows, but those commands are not accepted from arbitrary browser input.

## Operator access

- Loopback use opens normally and receives a same-page control cookie.
- Every operational API requires that cookie, including read-only snapshots and audit data.
- A non-loopback listener requires the fixed HTTP Basic username `host-control` and a long operator token by default; explicit `trusted-network` deployments may delegate that first gate to verified exact-source ingress.
- The non-loopback credential is one shared operator credential, not a multi-user account system.
- The health endpoint remains a minimal unauthenticated readiness check.

HTTP Basic credentials are safe only inside HTTPS or a private/tunneled transport. Network restriction remains part of the deployment boundary.

## Optional EC2 access controls

On a suitably configured EC2 host, PaneFleet can inspect sanitized inbound rules, authorize one globally routable IPv4 `/32`, and preview cleanup of stale rules created by the dashboard.

Authorization and cleanup are separate operations. Cleanup preserves unmanaged rules, broad rules not owned by PaneFleet, IPv6, source groups, prefix lists, active SSH peers, and other port ranges. This integration is optional and should remain unused outside its documented trust and IAM boundary.

## Non-goals

PaneFleet is not:

- a browser shell or general remote command runner;
- a multi-user identity and permissions system;
- a distributed agent scheduler;
- a replacement for tmux, SSH, host firewalls, or a secrets manager; or
- an unattended system that decides work is complete on its own.
