# Global Voice and Desktop Control Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let live desktop sessions and phone calls use the same phone voice pipeline to navigate and act on the connected Vox desktop, with visible and acknowledged results.

**Architecture:** Bridge owns the existing shared voice session and providers; desktop adds a transport adapter, not a new conversation pipeline. Core owns authenticated agent execution, persisted actions, device targeting, and command correlation. Desktop executes typed application commands through React state and reports actual page/action outcomes over the existing device socket.

**Tech Stack:** Rust, Axum, Tokio, PostgreSQL/sqlx, CPAL, Tauri 2, React 19, TypeScript, existing Bridge STT/TTS/provider registry, existing Core ConversationService and DeviceHub.

**Spec:** `vox-desktop/docs/superpowers/specs/2026-10-10-global-voice-desktop-control-design.md`

## Global Constraints

- One persistent Talk to Vox CTA starts a live, bidirectional session using exactly the phone-call voice pipeline.
- The session remains active until ended; remove the former 28-second recording limit.
- NeuDecide, local inference, and a separate desktop speech-to-text/LLM/text-to-speech pipeline are excluded from this feature.
- No automatic microphone activation.
- Never report a desktop action completed before acknowledgment.
- Remote phone control works while the signed-in desktop is connected; do not promise waking or launching an offline app.
- Preserve unrelated working changes. No push or deployment is implied by writing this spec.
- Keep existing remote-control consent and shell execution protections. Opening the terminal panel must not execute a shell command.

## Review Focus

1. A phone call with two online desktops must ask which desktop, rather than controlling the most recently used one (Task 3).
2. A manual selection change while a voice command is pending must reject stale selection-dependent actions (Tasks 3 and 5).
3. A delayed acknowledgment or lost connection after a data write must distinguish committed data from uncertain UI delivery, without duplicating the write (Tasks 3 and 8).
4. Week/custom date searches across midnight and daylight-saving transitions must use the requested timezone and an exclusive end boundary (Task 7).
5. Muting or interrupting an answer must stop relevant audio without claiming already committed work was cancelled (Tasks 4 and 9).

## Source map and execution boundaries

Paths below are relative to `/Users/rahul/Documents/vox`, which contains separate Git repositories. Run commands in their named repository and commit explicit files only. Existing desktop Gmail changes and Core Gmail/document changes are unrelated; preserve them. Worktree creation occurs only at execution time, after checking current branch/worktree attachments. Do not lose the existing working-tree changes or silently omit required dependency code.

Verified foundations:

- Bridge `src/channels/twilio/stream.rs` resolves the phone profile and calls `spawn_playback_session`; `src/voice/session/mod.rs` owns turns, interruption, playback, and completion.
- Bridge's current shared wire audio is 8 kHz mono G.711 mu-law. STT defaults to that format and ElevenLabs output is transcoded to it. Use this format for the initial desktop adapter so provider configuration remains identical.
- Desktop `src-tauri/src/client.rs` currently selects local voice or direct Core voice. Replace that desktop call route with Bridge for the new global session.
- Core `src/realtime.rs` already contains `DeviceHub`, request IDs, generation-aware unregister, and response correlation. `services/api/routes/device_socket.rs` authenticates device ownership/consent. Extend this channel; keep `UserEventHub` for data-change notifications.
- Desktop `src-tauri/src/device_link.rs` already registers devices, respects the remote-control toggle, and handles terminal/WiZ commands. Add app commands in a separate module.
- Core registers common tools in both `src/agents/conversation.rs` and `src/agents/tools/export.rs`; modifying only the export list would not expose tools to phone calls.
- Timeline has day/week/month modes but no arbitrary range. Its `TimelineQuery` lacks merchant/category filters. Pulse has a real `PulseService`, preview, save, and an idempotency key.

New public interfaces in the following tasks are proposed interfaces to implement, not existing APIs.

## Task 1: Authenticated desktop voice session bootstrap and conversation ingress

**Files:** Create Core `src/desktop_voice.rs`, `services/api/routes/desktop_voice.rs`, `migrations/20261010000000_desktop_voice_sessions.sql`, `tests/desktop_voice.rs`; modify `src/lib.rs`, `services/api/routes/mod.rs`, `services/api/router.rs`, `services/api/openapi.rs`. Create Bridge `src/core/desktop.rs`; modify `src/core/mod.rs`. Keep the current Core voice route for other clients.

**Interfaces:** `POST /v1/me/desktop-voice/sessions` accepts `{device_id?: UUID}` and returns `{session_id, ticket, bridge_socket_url, expires_at}`. A random ticket is valid for 60 seconds, stored hashed, redeemed once through service-authenticated `POST /internal/v1/desktop-voice/redeem`. Core records the authenticated user and verified owned device; client-provided user IDs are forbidden. Bridge obtains only a session identifier and authenticated ingress endpoints. `DesktopConversationClient` implements the existing Bridge `ConversationClient` trait and calls session-scoped internal respond/stream/complete endpoints, which resolve the recorded user and delegate to the existing Core `ConversationService`.

- [ ] Add database-backed tests for expired/replayed tickets, another user's device, and session access under incorrect service credentials. Test identity consistency: a bootstrap for user A cannot respond as user B.

```rust
#[sqlx::test(migrations = "./migrations")]
async fn ticket_is_single_use(pool: sqlx::PgPool) {
    // fixture creates an actual user/device and returns its authenticated Actor.
    let fixture = DesktopVoiceFixture::new(pool).await;
    let issued = fixture.issue().await.unwrap();
    assert!(fixture.redeem(&issued.ticket).await.is_ok());
    assert!(fixture.redeem(&issued.ticket).await.is_err());
}
```

- [ ] Run `cargo test --test desktop_voice` from Core against a disposable database; confirm the new test fails before implementation. Implement `DesktopVoiceFixture` in that test file using existing test user/device setup conventions; it owns issue/redeem helpers and the test service credential.
- [ ] Implement the migration and broker. Use server timestamps, a cryptographic random ticket, a stored SHA-256 digest, and transactional redemption (`UPDATE ... WHERE redeemed_at IS NULL AND expires_at > now() RETURNING ...`). Session state is `active|completed|failed`; completion and disconnect revoke ingress. Bound request text to 32 KiB and do not log tickets/credentials. Persist device binding server-side for subsequent agent turns.

```sql
CREATE TABLE desktop_voice_sessions (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES public.users(id),
  device_id uuid REFERENCES public.devices(id),
  ticket_hash text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  redeemed_at timestamptz,
  state text NOT NULL CHECK (state IN ('active','completed','failed')),
  created_at timestamptz NOT NULL DEFAULT now()
);
```

The schema names above were verified against `20261009000001_foundation.sql`. Authoritative identity is the recorded `user_id`; construct the same native `voice` channel identity and `RespondRequest` used by `routes/voice.rs`, then invoke `ConversationService::respond_stream`. Preserve agent selection, memory, host/tenant grants, turn IDs, revision, TTS provider, and initiation context. Do not route a desktop UUID through the phone-number host-identity mapping in `CoreClient`.
- [ ] Implement `DesktopConversationClient` using the existing SSE parser and service authentication, with a session-specific endpoint and the recorded user context resolved only in Core. This changes identity transport, not the agent/model policy. Register the bootstrap and internal endpoints with the appropriate existing authentication middleware and generated API contract.
- [ ] Run Core broker tests and Bridge contract tests. Commit the explicit Task 1 files separately in each repository.

## Task 2: Bridge desktop transport using the phone session

**Files:** Create Bridge `src/channels/desktop/{mod.rs,protocol.rs,stream.rs}`, `tests/desktop_voice_transport_test.rs`; modify `src/channels/mod.rs`, `src/app.rs`. Use `src/voice/session/mod.rs`, `src/voice/registry.rs`, and `src/voice/session/mod_types.rs` without duplicating their logic.

**Interfaces:** `GET /bridge/desktop/voice` upgrades the socket; the first JSON frame is `{type:"start", ticket}`. Reject all audio before redemption. Input binary frames are mono 8 kHz mu-law; input controls are `{type:"playback_finished",name}` and `{type:"stop"}`. Output starts with `{type:"connected",session_id,audio_format:"mulaw",sample_rate:8000}`; then binary audio interleaved with `{type:"mark",name,generation}` and `{type:"clear",generation}`. Bound audio frames to 8 KiB; start must arrive within five seconds. Never put the ticket in a URL.

- [ ] Write transport tests using fake STT/TTS and `ConversationClient`: audio before start is rejected, malformed/oversized frames close, clear drops old playback, marks preserve ordering, disconnect invokes completion once.

```rust
#[tokio::test]
async fn media_requires_authenticated_start() {
    let fixture = DesktopTransportFixture::start().await;
    let mut socket = fixture.connect().await;
    socket.send_binary(vec![0xff; 160]).await;
    assert_eq!(socket.close_reason().await, "start_required");
    assert_eq!(fixture.agent_requests(), 0);
}
```

Define `DesktopTransportFixture` in the test module with an ephemeral Axum server and mock redemption endpoint; no paid providers are called.
- [ ] Run `cargo test --test desktop_voice_transport_test`; observe the missing adapter/test failure.
- [ ] Parse typed controls, redeem through Task 1, resolve the exact phone profile, and replace only the transport-bound identity client in the provider set before calling the shared session constructor:

```rust
let profile = state.voice.resolver.resolve();
let mut providers = state.voice.providers.providers_for(&profile)?;
providers.agent = std::sync::Arc::new(desktop_client);
let handle = spawn_playback_session(providers.clone(), context.clone());
// Audio => handle.input.send(CallEvent::Audio(bytes)).await
// playback_finished => CallEvent::PlaybackFinished(name)
// outbound Media/Mark/Clear => the frames documented above
```

Use the same shared `shutdown_playback_session`; enforce bounded channels, close on sustained backpressure, and do not spawn an unlimited reader/writer queue. Construct session context from verified bootstrap data only.
- [ ] Run adapter, existing playback, turn, and Twilio tests: `cargo test --test desktop_voice_transport_test --test playback_test --test turn_test --test twilio_test`. Confirm both channels invoke the same constructor and profile resolver. Commit explicit files.

## Task 3: Device-addressed app commands and fresh context

**Files:** Create Core `src/desktop/{mod.rs,protocol.rs,service.rs}`, `tests/desktop_commands.rs`; modify `src/lib.rs`, `src/realtime.rs`, `services/api/routes/device_socket.rs`, `src/storage/devices.rs`. Create desktop `src-tauri/src/app_control.rs`; modify `device_link.rs` and `lib.rs`.

**Interfaces:** Add `DesktopContext`, `AppCommand`, and `AppResult` below. `DesktopControlService::context(user_id: Uuid, device_id: Option<Uuid>)` returns a fresh connected device snapshot or a structured `offline|ambiguous|disabled` error. `dispatch(user_id, device_id, command)` uses `DeviceLink::request("app_command", ...)` with ten-second timeout. Add `app_context` publication and command results to the existing device socket; use generation-scoped response resolution so an old socket cannot satisfy a new connection's pending request.

```ts
type DesktopContext = {
  revision: number; page: "agent" | "timeline" | "pulse" | "spaces" | "connections" | "updates";
  spaceId: string | null; pulseId: string | null; selectedItemId: string | null;
  timezone: string; timeline: TimelineFilter | null;
};
type AppCommand = {
  commandId: string; expiresAt: string; expectedRevision: number | null;
  action: "navigate" | "timeline_filter" | "select_item" | "terminal_panel" | "refresh_resource";
  arguments: Record<string, unknown>;
};
type AppResult = {
  commandId: string; ok: boolean; context: DesktopContext;
  error?: "expired" | "stale_context" | "unsupported" | "not_found" | "load_failed";
};
```

`TimelineFilter` is defined in Task 7. Native Rust mirrors these types with serde, denies unknown fields, and uses UUID/DateTime for IDs/expiry. Wire names are camelCase. Socket correlation `id` is separate from stable `commandId`.
- [ ] Write tests for owner mismatch, remote control disabled, two devices without a chosen target, old-generation response rejection, expired command, and late reply after timeout. A device context expires after 30 seconds without refresh; publish a heartbeat every ten seconds.

```rust
#[tokio::test]
async fn ambiguous_target_does_not_dispatch() {
    let fixture = DesktopCommandsFixture::two_owned_devices().await;
    assert_eq!(fixture.context(None).await.unwrap_err().code(), "ambiguous");
    assert_eq!(fixture.sent_commands(), 0);
}
```

Define the fixture in `tests/desktop_commands.rs`; use a mock device channel, not an OS session.
- [ ] Run `cargo test --test desktop_commands`; implement typed serialization and generation-aware routing. Extend device registration capabilities with `vox_app_control: true`, version 1. Keep execution consent, revoked/active checks, and existing terminal/WiZ capabilities unchanged.
- [ ] Add native `AppControlState`: bounded pending request map; emit `vox-app-command` to React; accept `complete_app_command` acknowledgments; publish context with `set_app_context`. Reject expired or unsupported commands before emitting. Do not block the socket reader while waiting for React, so heartbeat/context/cancel responses remain live. Clear pending requests on sign-out/disconnect.
- [ ] Deduplicate UI-only actions using a bounded completed-command cache with expiry; do not replay commands across app restart/reconnect. Task 8 handles durable mutation idempotency. Run Core tests and `cargo test --manifest-path src-tauri/Cargo.toml app_control` in desktop. Commit explicit files.

## Task 4: Native desktop live audio client

**Files:** Create desktop `src-tauri/src/bridge_voice/{mod.rs,protocol.rs,playback.rs}`; modify `client.rs`, `codec.rs`, `session.rs`, `types.rs`, `lib.rs`, `src/lib/tauri.ts`, `src/hooks/use-call-session.ts`. Existing `audio.rs` supplies microphone and speaker devices.

**Interfaces:** Preserve `start_call/end_call/call_status` public names; add `set_call_muted(bool)` and `CallStatus.muted`. Start uses authenticated Task 1 bootstrap then Bridge URL from config/response. Microphone is captured at native rate, resampled to 8 kHz mono, mu-law encoded, and streamed in 20 ms frames (160 bytes). Decode received mu-law to PCM and resample through existing playback. Mark acknowledgment is sent only after the associated samples actually finish playing.

- [ ] Add tests for signed mu-law extremes, frame boundaries, mute blocking transmission, end during connect, obsolete playback generations, and mark acknowledgment after the final playback sample. Add a fake-clock sustained session beyond 28 seconds.

```rust
#[test]
fn cleared_generation_is_never_played() {
    let mut queue = PlaybackQueue::default();
    queue.push(1, vec![0xff; 160]);
    queue.clear(2);
    assert!(queue.next_frame().is_none());
}
```

Implement `PlaybackQueue` in `bridge_voice/playback.rs` with `push(generation,u8 bytes)`, `clear(new_generation)`, and `next_frame`; it owns mark ordering and stale-frame rejection.
- [ ] Run `cargo test --manifest-path src-tauri/Cargo.toml bridge_voice`. Implement the transport using Task 2 controls; remove `LocalVoice::start` and Core direct voice selection from this global desktop route. Continue refreshing expired app auth before bootstrap. Never expose service credentials to desktop.
- [ ] Use capture and playback asynchronously with bounded queues. Mute does not stop the session; end closes socket/capture/playback. Interruption clears queued output but leaves committed tool operations intact. Emit native status/speaking/error events; keep call state correct after sign-out and server disconnect. A reconnect starts a fresh session and does not replay spoken requests.
- [ ] Run native tests and `npm run build`. Validate a real microphone/speaker session against local Bridge with configured providers; record that provider validation separately from unit tests. Commit explicit files.

## Task 5: Application state router and command acknowledgment

**Files:** Create desktop `src/features/desktop-control/{types.ts,store.ts,commands.ts}`, `src/hooks/use-desktop-control.ts`, `tests/desktop-control.test.ts`; modify `src/app.tsx`, `components/home-shell.tsx`, `components/spaces/spaces-view.tsx`, `components/pulse/pulse-view.tsx`, `platform/ports.ts`, `platform/tauri-platform.ts`. Extend the browser preview platform with a test adapter.

**Interfaces:** `DesktopControlStore` owns current route/resource/selection/filter and revision. `applyAppCommand(command, store): Promise<AppResult>` validates expiry, action-specific arguments, and expected revision. `useDesktopControl()` subscribes to native commands and publishes snapshots. Lift selected space/pulse/item state from page-local state into controlled props; page manual actions and voice actions use the same setters.

- [ ] Add TS tests for stale selection, unsupported route, not-found space, switching pages during a pending command, and duplicate delivery. Use Node's existing test style and run `node --experimental-strip-types --test tests/desktop-control.test.ts`.

```ts
test("selection command rejects changed context", async () => {
  const store = new DesktopControlStore();
  const revision = store.snapshot().revision;
  store.navigate("timeline");
  const result = await applyAppCommand({
    commandId: "fixture-1", expiresAt: "2099-01-01T00:00:00Z",
    expectedRevision: revision, action: "select_item", arguments: { itemId: "a" },
  }, store);
  assert.equal(result.error, "stale_context");
});
```

- [ ] Implement deterministic reducer operations and an acknowledgment promise that waits for destination mounting/data validation, rather than returning success immediately after `setState`. A select/open command verifies resource ownership via existing authenticated APIs and reports `not_found` or `load_failed` on actual failure.
- [ ] Bridge Tauri events and commands through an optional `desktopControl` platform port; browser previews report native voice unavailable but can exercise state commands through injected fixtures. Publish context on changes and heartbeat. Explicit navigation ignores unrelated previous selection revision; selection-dependent edits require it.
- [ ] Run TS tests, changed-file lint, and `npm run build`; confirm no duplicate global listeners on remount. Commit explicit files.

## Task 6: Global taskbar, terminal panel, and live session UI

**Files:** Create desktop `components/shell/{desktop-taskbar.tsx,terminal-panel.tsx}`, `tests/global-shell-preview.{html,tsx}`; modify `components/home-shell.tsx`, `components/shell/agent-pane.tsx`, `src/app.tsx`, `src/index.css`, `hooks/use-call-session.ts`. Add a `send_desktop_text` Tauri command using Task 1 ingress for typed turns; share the current active session or bootstrap a text-only conversation with the same agent context.

**Interfaces:** `DesktopTaskbar` receives call state, context, action status, mute/end/start callbacks, typed submit, and terminal visibility callback. `TerminalPanel` controls the existing native terminal session but opens without executing a command. It is a resizable panel above the bottom bar; remote `terminal_panel` uses the identical visibility setter.

- [ ] Implement the root layout directly; skip tests that merely mirror CSS. Keep sidebar/main inside one flexible row, taskbar outside it, and terminal panel between main and taskbar:

```tsx
<div className="flex h-full min-h-0 flex-col overflow-hidden">
  <main className="flex min-h-0 flex-1">{sidebarAndPage}</main>
  {terminalOpen && <TerminalPanel onClose={closeTerminal} />}
  <DesktopTaskbar {...taskbarProps} />
</div>
```

- [ ] Make Talk to Vox dominant; display page/resource context, listening/speaking states, microphone level, mute/end, and concise errors. A phone-origin action displays remote activity without falsely showing a local microphone session. Remove the competing primary voice CTA from AgentPane. Keep conversation expansion and existing page functionality.
- [ ] Add typed-input submit to the shared Core agent ingress. During an active voice response, apply the same turn/revision supersession rules as spoken turns. Return text and action state; do not create a second independent page-specific agent conversation by default.
- [ ] Run `npm run build` and changed-file lint. Inspect preview at 1280×800 and narrow 800×600 plus the native Tauri window. Verify taskbar full width, page scroll stays above it, terminal resize, keyboard focus, accessible labels, reduced motion, and clean console. Commit explicit files.

## Task 7: Shared navigation and Timeline spending tools

**Files:** Create Core `src/agents/tools/desktop.rs`, `src/desktop/date_range.rs`, `tests/desktop_timeline.rs`; modify `src/agents/{conversation.rs,tools/mod.rs,tools/export.rs}`, `domain/timeline.rs`, `application/timeline.rs`, `storage/timeline.rs`, API/OpenAPI schema files. Create desktop `features/timeline/filters.ts`, `components/spans/timeline-range-controls.tsx`; modify `timeline-view.tsx`, `features/timeline/api.ts`, generated `features/api.gen.ts` through existing generation command. Test desktop `tests/timeline-filters.test.ts`.

**Interfaces:** Tools `get_desktop_context`, `navigate_desktop`, `show_timeline_spending`, and `control_desktop_terminal_panel` are registered in BOTH actual conversation agent and export manifests. Desktop-started turns use the verified bound device; phone turns use explicit device choice or the sole eligible device. `show_timeline_spending` accepts `range: today|yesterday|this_week|last_week|custom`, IANA timezone, optional ISO date boundaries, merchant/category; resolves to:

```ts
type TimelineFilter = {
  startAt: string; endAt: string; timezone: string;
  eventTypeValue: "transaction"; spendingOnly: true;
  merchant: string | null; category: string | null;
};
```

For custom ranges users supply inclusive dates; backend converts the following day's local midnight to exclusive UTC `endAt`. Existing UI weeks start Sunday; retain that default and permit explicit Monday-based requests.
- [ ] Add timezone-aware tests (Asia/Kolkata midnight, Sunday week boundary, America/New_York DST day), invalid ranges, unknown timezone, paginated filtering, and pending card authorization excluded from confirmed spending.

```rust
#[test]
fn kolkata_day_uses_local_boundaries() {
    let range = resolve_dates("custom", "Asia/Kolkata", "2026-10-10", "2026-10-10").unwrap();
    assert_eq!(range.start.to_rfc3339(), "2026-10-09T18:30:00+00:00");
    assert_eq!(range.end.to_rfc3339(), "2026-10-10T18:30:00+00:00");
}
```

Implement `resolve_dates` in `desktop/date_range.rs`, taking explicit clock for relative ranges in the production overload. Use existing `chrono-tz`; reject invalid/ambiguous local boundaries instead of accepting guessed timestamps.
- [ ] Run Core `cargo test --test desktop_timeline`; implement filters in the repository query before pagination. Use typed query parameters; validate merchant/category lengths and canonical transaction schema paths from `timeline_event_types`, including transaction status/direction. Reuse TimelineService permission/evidence handling. Do not fetch one page then filter client-side or infer spending from authorization messages.
- [ ] Add custom-range mode and editable range/merchant/category controls to Timeline. Voice and manual controls produce the same filter/query; reset cursor on filter changes and reject stale load responses. Display actual applied range/timezone. Model-facing query tool reads the same filtered result set for spoken summaries; label paginated results accurately and never total only the first page as if it were complete.
- [ ] Add one actual-agent tool manifest test proving phone conversations can invoke each new tool. Run filter tests, Core repository tests with disposable DB, generated-contract checks, and desktop build. Commit explicit files.

## Task 8: Durable Spaces and Pulse actions exposed to the common agent

**Files:** Create Core `src/application/space_actions.rs`, `src/agents/tools/{desktop_spaces.rs,desktop_pulse.rs}`, `migrations/20261010000001_desktop_action_receipts.sql`, `tests/desktop_resource_actions.rs`; modify `src/application/mod.rs`, `agents/conversation.rs`, `agents/tools/{mod.rs,export.rs}`, `services/api/routes/spaces.rs`. Reuse `src/agents/space_runtime.rs`, `src/storage/spaces.rs`, `src/application/pulse/service.rs`. Modify desktop controlled Spaces/Pulse routing from Task 5.

**Interfaces:** `SpaceActionService` executes owner-bound `create|update_node|add_node|remove_node|connect|research|continue|stop|arrange` requests with an action idempotency key and expected node version. Tools `manage_desktop_space` and `manage_desktop_pulse` call services, then dispatch navigation/refresh using Task 3. Pulse actions `list|preview|create|update` use existing `PulseDefinition` and `PulseService` validation. Return separate `data_result` and `presentation_result`.

- [ ] Add integration tests for cross-owner node/space/pulse rejection, committed/dropped-space rejection, stale version, dependency invalidation, missing Pulse measurements, duplicate creates, and data-success/UI-timeout partial result.

```rust
#[sqlx::test(migrations = "./migrations")]
async fn lost_ui_ack_does_not_duplicate_created_space(pool: sqlx::PgPool) {
    let fixture = ResourceActionsFixture::offline_desktop(pool).await;
    let first = fixture.create_space("request-1", "Japan trip").await.unwrap();
    let retry = fixture.create_space("request-1", "Japan trip").await.unwrap();
    assert_eq!(first.data_result.resource_id, retry.data_result.resource_id);
    assert!(!first.presentation_result.ok);
    assert_eq!(fixture.space_count().await, 1);
}
```

Define the fixture with actual repositories and a disconnected mock DeviceHub.
- [ ] Run `cargo test --test desktop_resource_actions`. Extract mutation rules from Spaces routes into shared application functions; HTTP and agent tools call the same logic. Preserve node versions, workflow dependency invalidation, provenance, and stopped jobs. Avoid direct agent SQL bypassing those rules.
- [ ] Add durable receipts keyed by `(user_id, idempotency_key)` with request digest, status and JSON result. Claim/check receipt and perform direct DB writes in the same transaction; reused key with different input is conflict. Workflow start uses an idempotent durable task enqueue. Do not claim cancelled mutation if interrupted after commit. Reuse Pulse's existing save key and validation; use real measurements, not invented chart schemas/data.
- [ ] When a phone caller says “this space,” read fresh desktop context first; validate captured selection/version again on mutation. Resolve named spaces/pulses with a list/search tool and ask on ambiguous names. Voice-created resources navigate after persistence, with honest partial results if the UI is offline.
- [ ] Run focused service/agent tests, API contract checks, and desktop build. Commit explicit files.

## Task 9: Correlated action feedback, skeletons, and recovery

**Files:** Create Core `src/desktop/action_events.rs`; modify action services/tools from Tasks 7–8. Create desktop `features/desktop-control/action-state.ts`, `hooks/use-desktop-actions.ts`; modify `hooks/use-space.ts`, `components/spaces/{space-canvas.tsx,space-node-card.tsx}`, `components/pulse/pulse-view.tsx`, taskbar. Test `tests/desktop-action-state.test.ts` and Core `tests/desktop_action_events.rs`.

**Interfaces:** `desktop_action` events carry `{action_id,device_id,phase,resource_kind,resource_id,node_id,summary,result?,error?}` with phase `started|waiting|completed|failed|unknown`. Events target the device; persisted resource jobs retain durable status. A status endpoint reconciles outstanding action IDs after reconnect. Taskbar aggregates activity; additions render transient skeletons; existing nodes render overlays.

- [ ] Write reducer tests for completion-before-start, duplicate completion, reconnect after missed event, partial failures, interruption after data commit, and two concurrent actions on the same node.

```ts
test("completion received first cannot leave a skeleton", () => {
  let state = reduceAction({}, { action_id: "a", phase: "completed" });
  state = reduceAction(state, { action_id: "a", phase: "started" });
  assert.equal(state.a.phase, "completed");
});
```

Define `reduceAction` in `action-state.ts`; monotonic terminal-state precedence prevents older events reopening completed work.
- [ ] Run Node reducer tests. Emit events around real service execution and acknowledgment, not speculative model tokens. Deciding/listening belongs to call state; show a skeleton only after a validated action has a known destination. Never persist a placeholder as a completed graph node.
- [ ] Reconcile outstanding IDs on reconnect and refresh durable job state. Timeout becomes `unknown` until reconciled; no uncontrolled automatic mutation retries. Clear local-only placeholder state on navigation/sign-out and recreate it from actual outstanding statuses on return. Keep remote phone action status visible without changing local call state.
- [ ] Run action tests, build, and runtime visual check for two concurrent actions, failed research, retry, and interruption. Commit explicit files.

## Task 10: End-to-end checks and operational handoff

**Files:** Create desktop `docs/global-voice-desktop-control.md`, Bridge `docs/desktop-voice-transport.md`, test fixture scripts under each repository's existing test folder. Update environment examples for the existing `VOX_BRIDGE_URL` plus server-only Core/Bridge authentication configuration; never copy secrets into client config.

- [ ] Run `cargo test` and `cargo check` in Bridge; run targeted Core tests from Tasks 1/3/7/8/9 and `cargo check --all-targets` in Core; run `cargo test --manifest-path src-tauri/Cargo.toml` and `cargo check --manifest-path src-tauri/Cargo.toml` in desktop. Use disposable DB for migration tests; preserve live data.
- [ ] Run `npm run build`, changed-file ESLint/Prettier checks, and Node tests for desktop commands/date filters/action state. Run `git diff --check` independently in each touched repository. Broaden testing only for new failures or changes; report baseline failures separately.
- [ ] With fake voice providers, exercise the full native desktop audio transport + Core command flow: Timeline navigation, custom spending range, create/edit Space, create Pulse, open terminal panel, mute, interruption, end, reconnect, and a second desktop. Assert acknowledgments and real persisted test resources.
- [ ] With authorized live provider configuration, conduct a sustained native voice session and a real phone call controlling the connected desktop. Verify actual page/filter changes and persisted resources; keep logs credential-free. A simulated call is not evidence of phone control. If live call/deployment access is unavailable, document the unverified boundary and stop claiming production readiness there.
- [ ] Document routes, authentication boundaries, device consent/offline behavior, context freshness, command expiry/idempotency, troubleshooting, and rollout ordering (Core before Bridge before desktop). Existing phone sessions and unrelated mobile clients remain compatible.
- [ ] Review the final branch diff against the approved spec; verify no NeuDecide path or 28-second cutoff remains in the new route. Commit explicit task files, with no push or deployment absent authorization.

## Plan self-review

Spec coverage: shared pipeline (Tasks 1/2/4), root/taskbar/terminal (6), fresh context and targeting (3/5), navigation/Timeline (7), persisted Spaces/Pulse (8), correlated feedback (9), typed input (6), voice lifecycle (2/4), offline/partial/reconnect behavior (3/8/9), tests and real-call evidence boundaries (10). All five Review Focus cases have named tests in their owning tasks.

No separate audio/model policy is introduced. The only additional Bridge agent client is a scoped authentication adapter into the existing Core conversation service. No user identity is trusted from spoken/model arguments. App-control tools extend the existing acknowledged device channel and preserve existing remote-control consent.

## Execution handoff

Recommended method: Native execution in this session. Tasks depend on shared authentication/protocol/state interfaces across three repositories; keeping one implementer on those interfaces reduces integration drift. Review the plan and choose Native or Subagent-driven before code changes. If Native is chosen, use `superpowers:executing-plans`; if Subagent-driven is chosen, use `superpowers:subagent-driven-development`.
