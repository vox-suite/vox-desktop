# Global desktop voice and app control

Talk to Vox starts a live session through `/bridge/desktop/voice`. Core authenticates the desktop user and issues a 60-second single-use ticket; Bridge redeems it using its service credential. Audio uses 8 kHz mu-law and the same provider resolver, playback session, streaming speech recognition, Core conversation agent, speech synthesis, barge-in, and playback marks as phone calls. There is no 28-second recording cutoff.

Desktop app commands use the existing consent-controlled device connection. Enable remote control in the desktop to allow either a phone conversation or a desktop conversation to navigate or change the app. `control_desktop_app` first reads context, including page, selected Space/node, node versions, selected Pulse, timezone, filters, and revision. Multiple desktops require an explicit device choice. Selected-resource operations carry explicit Space/Pulse IDs from context and require the current revision, and node edits require the persisted node version.

The full-width bottom taskbar exposes Talk to Vox and Terminal. An active session exposes mute and typed input. Terminal shares the existing PTY with phone terminal tools. Closing its panel keeps the shell available. App tools open the panel; arbitrary shell commands remain in the separately authorized terminal tool.

Space creation and graph changes use `/v1/me/desktop-actions`, transactions, ownership checks, read-only state checks, optimistic versions, and durable command receipts. Receipts reconcile unsuccessful acknowledgments and completed writes after the desktop goes offline; reconciliation reports whether UI acknowledgment was received. Workflow chat queues durable requests and jobs. Pulse creation validates real measurement definitions and uses existing idempotent saves. Spending filters are applied before server pagination and exclude failed/pending authorization attempts. Custom date endpoints are inclusive in the requested timezone, including daylight-saving transitions.

## Release requirements

Deploy Core with both `20261010000000_desktop_voice_sessions.sql` and `20261010000001_desktop_action_receipts.sql` applied and a running workflow worker. Deploy Bridge with the desktop WebSocket route. Its existing Core URL and service credential must match Core. Desktop uses its configured Bridge URL and Core API URL; both must point to these revisions. The old native local inference modules are retained but are no longer used by `start_call` and no longer automatically download models.

## Verified locally

- TypeScript production build.
- Command expiry, stale revision, duplicate dispatch, sign-out reset, and action-state tests.
- Timezone/custom-date/DST range tests.
- Native codec, bounded capture, and existing native library tests.
- Full Bridge tests, including phone playback/turn tests.
- Core library and device-generation acknowledgment tests.
- Full migrations and owned/single-use/expiring tickets, owned/versioned/idempotent Space writes and durable chat, and spending-before-pagination tests against an isolated PostgreSQL database.

These checks do not establish deployed route availability, native microphone/speaker quality, provider latency, live barge-in, or phone-to-desktop control. Those require an authenticated desktop connected to the matching deployed Core/Bridge and a live call. Typed input currently requires an active desktop session. Navigation acknowledgments establish route selection and validated resource identity; lazy page data may continue loading. Existing graphs older than workflow version 2 need migration before durable voice chat planning.
