# Raycast Design System & Vox Desktop Specification

> Midnight command center, coral neon. Unified design guidelines for Vox Web and Vox Desktop applications.

**Theme:** Dark (`#040506` canvas base)

---

## 1. Design Philosophy & Aesthetic Roots

Vox shares the design DNA of Raycast: high-density, keyboard-first, ultra-responsive native desktop and web experiences. Visual cues favor dark obsidian panels, recessed wells, hairline borders (`#232427` / `#2a2b2e`), and subtle coral neon brand accents (`#ff6363`) that distinguish live agent states from background telemetry.

---

## 2. Color Palette & Semantic Tokens

### Backgrounds & Surfaces

| Token          | Hex       | Role                 | Usage                                      |
| -------------- | --------- | -------------------- | ------------------------------------------ |
| **Void Black** | `#040506` | Canvas Base          | Window background, primary layout backdrop |
| **Ink**        | `#07080a` | Elevated Surface     | Sidebars, cards, modals, table headers     |
| **Obsidian**   | `#111214` | Recessed Wells       | Form inputs, inactive buttons, table rows  |
| **Graphite**   | `#1b1c1e` | Active / Hover Wells | Active sidebar pills, button hover states  |
| **Slate**      | `#2f3031` | Border Accent        | Secondary buttons, stroke dividers         |

### Text & Accents

| Token             | Hex       | Role                  | Usage                                            |
| ----------------- | --------- | ---------------------- | ------------------------------------------------ |
| **Pure White**    | `#ffffff` | Primary High-Emphasis | Headings, active text, key titles                |
| **Mist**          | `#e6e6e6` | Primary Action Fill   | Primary action buttons (`btn-primary-mist`)      |
| **Iron**          | `#454647` | Action Text           | Contrast text on light fills                     |
| **Ash**           | `#9c9c9d` | Secondary Text        | Subtitles, metadata, inactive icons              |
| **Smoke**         | `#6a6b6c` | Tertiary / Labels     | Field labels, timestamps, shortcuts              |
| **Coral Pulse**   | `#ff6363` | Brand Neon Accent     | Voice active state, agent highlights, errors      |
| **Electric Sky**  | `#63a1ff` | Interactive Mode      | Focus rings, checkbox accents, secondary actions |
| **Success Green** | `#59d499` | Completion State      | Completed span/task states, live socket dot     |

### Radii & Elevation

- **Cards & Modals**: `16px` / `20px` (`--radius-cards`, `--radius-largecards`)
- **Buttons & Inputs**: `8px` (`--radius-buttons`, `--radius-inputs`)
- **Badges & Pills**: `6px` / `9999px` (`--radius-badges`, `--radius-pills`)
- **Borders & Shadows**:
  - Featured cards and elevated panels use the Raycast **keyboard key** stack:
    `rgba(255,255,255,0.05) inset top + rgba(255,255,255,0.25) outer ring + rgba(0,0,0,0.2) inset bottom`
  - Primary mist buttons use a subtle lift: `--shadow-btn-lift`
  - Avoid chromatic CTAs — primary actions are Mist fill / Iron text
  - Coral Pulse (`#ff6363`) is reserved for brand mark, AI badges, and live voice states

---

## 3. Application Architecture

Vox Desktop is a Tauri app: a React/TypeScript frontend (`src/`) driven by a Rust backend (`src-tauri/src/`). The Rust side owns auth, the voice session, and all network I/O; the frontend never talks to any backend directly — every data or account operation goes through a `#[tauri::command]` invoked via `src/lib/tauri.ts`.

- **Auth** (`auth.rs`): Google sign-in via Supabase Auth (PKCE), used only to obtain a Supabase session and mint a Vox Core-scoped token (`vox_token`). Supabase is never queried directly for app data — no PostgREST (`/rest/v1/...`) calls exist anywhere in the app.
- **Data access** (`sync_client.rs`): all Spans and Collections CRUD goes through Vox Core's own HTTP API (`/v1/spans`, `/v1/collections`, and their sub-resources), authenticated with the bearer `vox_token`. There is no local disk cache of this data — every read is a live request to Vox Core, and the frontend re-polls / re-fetches on demand (see `use-spans.ts`, `use-collections.ts`).
- **Voice session** (`session.rs`, `client.rs`, `audio.rs`, `codec.rs`): a duplex realtime audio link to the Vox bridge, driven by CPAL mic input and a WebSocket/WebRTC session loop.
- **Device link** (`device_link.rs`): an opt-in WebSocket bridge to Vox Core that lets the cloud agent run terminal commands and shell sessions on this Mac during a call, and locally classify incoming SMS messages. See §6.
- **Local LLM** (`local_llm.rs`): a locally-downloaded Gemma GGUF model (via `llama_cpp_2`) used to classify SMS text on-device — see §6.

### Window Lifecycle & Sizing

- **Unauthenticated (Sign In) State**:
  - Window Dimension: `800 x 600 px`, animated and centered on screen.
  - Window Chrome: Frameless with a top drag region (`data-tauri-drag-region`).
  - Hero Section: "Continue with Google" primary action.
  - After Google sign-in, a user without a linked phone number sees a Phone Entry screen before reaching the main app.
- **Authenticated (Signed In) State**:
  - Window Dimension: animated to `1290 x 800 px` via the `set_window_size` Tauri command.
  - Window Chrome: full-width/height workspace layout.
  - On sign out, the window animates back down to `800 x 600 px` and re-centers (`center_window`).

---

## 4. Layout & Navigation

### Persistent Left Sidebar (`AppSidebar`, `w-72`)

- **Top**: macOS-style traffic-light window controls (close/minimize/fullscreen) and the Vox wordmark + app version.
- **Nav list**: Agent, Timeline, Collections, Artifacts, Analytics. (Artifacts and Analytics currently render a placeholder pane — they are reserved nav slots, not built-out features.)
- **Bottom**: user avatar/initial, opens a profile popover with display name, account email, app version, and "Sign Out".

### Background

The main window renders a persistent 3D map (MapLibre, via `useMissionMap`) as ambient background chrome behind the active view, with live local-agent activity logs (`ActivityLogs`) overlaid top-right.

---

## 5. Main Stage Views

### View 1: Agent (Voice Cockpit) — default view

- Center-stage animating orb, the primary voice-call control.
- Clicking the orb (or pressing Return when idle) starts a realtime duplex voice session with the Vox agent (`start_call`/`end_call`/`call_status` in `session.rs`); Escape ends an active call.
- **Dynamic Audio Reactive Speed**, driven by the mic level reported from the native session:
  - _Idle / Quiet_: slow, tranquil animation.
  - _Connecting_: ramps up with a connecting tone.
  - _User Speaking_: CPAL mic input crossing an RMS threshold (`mic_level > 0.012`) drives `is_speaking = true` and an amplified coral neon aura.
  - _User Quiet / Listening_: eases back to a gentle steady speed.

### View 2: Timeline (`TimelineView`)

The calendar-style view over a collection's (or the user's overall) Spans:

- Day / 3-day / Week range tabs, with prev/next/today navigation.
- A calendar grid (`SpanCalendar`) of scheduled Spans for the visible range, and a "To-do" side panel of unscheduled, not-yet-done Spans.
- Clicking empty calendar space or "New" opens `SpanDialog` to create a Span; clicking an existing Span opens the same dialog to edit or complete it.
- Spans carry a flexible `data` payload (e.g. an `amount` for spend tracking) — the header shows total spend for the visible range when present.
- When viewing the unscoped Timeline (no collection selected), a `LocalLlmCard` is shown offering to download the local Gemma model (see §6).

### View 3: Collections (`CollectionsView`)

A grid of Collections (trip / event / course / area / custom), each showing its date range and Span count. Selecting one opens that Collection's own `TimelineView` scoped to it; "New Collection" opens a create dialog (name, kind, date range, description); each card has an inline archive action.

---

## 6. Local SMS Classification & Device Link

Two related but independent opt-in capabilities, both gated behind explicit user consent and both requiring the same live WebSocket bridge to Vox Core (`device_link.rs`):

- **Remote control** (`RemoteControl`, toggled via `set_remote_control`): lets the cloud agent open an interactive shell (`open_shell`) or run a one-off command (`run_command`) on this Mac during a call, via `TerminalManager`. Every command run is appended to a local log and mirrored into the in-app Activity Logs; commands only ever run while this consent is on, and the socket is not opened at all while both this and local-LLM readiness are off.
- **Local SMS classification** (`classify_sms`): incoming SMS is classified on-device by a locally downloaded Gemma model (`local_llm.rs`, `gemma-2b-it-q4_k_m.gguf` via `llama_cpp_2`) rather than sent to the cloud — the frame only carries the classification result (relevant/category/title) back to Core. The model is downloaded once (`download_local_llm`) and cached in memory after first use to avoid reloading it per message.

The device socket (`connect_and_serve`) speaks a small typed JSON frame protocol: each inbound frame has a `type` (`open_shell` | `run_command` | `classify_sms`) which the desktop parses into a typed `FrameType` before dispatch, so an unrecognized frame type is logged distinctly from a rejected/failed known command rather than silently swallowed.

---

## 7. Keyboard Navigation & Shortcuts

| Key        | Context                | Action                            |
| ---------- | ----------------------- | --------------------------------- |
| `↵ Return` | Agent view (Idle)      | Start voice session / unmute mic  |
| `Esc`      | Active Voice Session   | End call / mute voice channel     |
| `Esc`      | Collections (drilled in) | Back to Collections grid        |
| `Esc`      | Any non-Agent view     | Collapse back to Agent view       |

---

## 8. Cross-Platform Consistency (Web & Desktop)

- Design tokens and typography (`Inter` for UI, `Geist Mono` for IDs, timestamps, and status tags) are shared between `vox-web` and `vox-desktop`.
- Window controls and frame behavior conform to native macOS design guidelines while maintaining the Raycast dark palette.

## 9. Component Library (shadcn/ui primitives)

Desktop UI is composed from `src/components/ui/` primitives following shadcn/ui APIs, styled with Raycast tokens:

| Primitive                           | Variants / Notes                                                                            |
| ------------------------------------ | --------------------------------------------------------------------------------------------- |
| `Button`                            | `Default` (Mist/Iron), `Secondary`, `Ghost`, `Outline`, `Destructive` (Ember/Coral), `Icon`   |
| `Badge`                             | `Default`, `Secondary`, `Outline`, `Success`, `Info`, `Accent` (coral), `Destructive`         |
| `Card`                              | Ink surface + optional `elevated` keyboard-key shadow                                         |
| `Dialog`                            | Overlay + key-elevated panel (Span dialog, new-Collection dialog)                            |
| `Input` / `Textarea` / `Select`     | Recessed wells (`rgba(255,255,255,0.05)`)                                                    |
| `Tabs` / `TabsList` / `TabsTrigger` | Day/3-day/Week range switcher on Timeline                                                    |
| `Label` / `Separator`               | Form labels, dividers                                                                        |

Primary actions never use chromatic fills — Mist on Void is the only filled CTA.
