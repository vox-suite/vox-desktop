# Project diagram motion plan

## Purpose

Make a saved diagram easier to follow without changing its layout, hiding source evidence, or implying that an architectural drawing is a live service monitor. The new Canvas library remains still; motion belongs inside an opened diagram.

## First release

1. Add an accessible **Animate flow / Pause animation** toggle to the opened canvas. Keep saved diagrams still initially; remember the choice for the session. Do not animate exports unless the user explicitly chooses an animated HTML export.
2. Show small, low-contrast traveling marks over the existing connection paths, following each edge's actual source-to-target direction. Preserve arrowheads, labels and the base stroke. Inferred relationships retain their dashed styling. Draw the moving marks on separate noninteractive overlays so they cannot change hit targets or evidence inspection.
3. On node hover or keyboard focus, emphasize its immediate incoming/outgoing connections and soften unrelated elements. Keep node positions and text stationary. Clicking still opens source evidence; motion never takes over that action.
4. During generation, retain the existing short reveal for newly rendered nodes and connections. Use an actual generation/selection state for any node emphasis; do not pulse every node continuously or present fake health/activity signals.

## Rendering approach

The diagram is a sanitized SVG in a Shadow DOM, rendered as a single React Flow scene. Keep that architecture and the original typed diagram IR. Connect motion to the renderer's `data-node-id`, `data-edge-from` and `data-edge-to` markers; do not attempt to animate React Flow edges, because these diagrams do not use them.

Before implementing overlays, inspect the paths emitted for architecture, workflow, sequence, dataflow and lifecycle diagrams. Give each representation an explicit path mapping; skip paths without a trustworthy direction. Avoid animating text, masking paths, boundary boxes or legend samples. Clone only the connection geometry after SVG sanitization, mark overlays `aria-hidden`, and set `pointer-events: none`.

Use the existing theme tokens and native browser animation support. No new animation dependency is needed. Start with a small cap on animated connections, prioritize the selected neighborhood on dense diagrams, and measure the cap against real native frames before choosing a final number.

## Accessibility and performance

- `prefers-reduced-motion: reduce` disables traveling marks and reveals; the diagram and focus highlights remain fully usable.
- Give the toggle a stable accessible name and `aria-pressed`, keep it keyboard reachable, and expose no animated status announcements.
- Pause on a hidden document, when the canvas is closed, while panning/zooming, and when the app is inactive. Cancel animations/listeners when the SVG is replaced or the component unmounts.
- Avoid continuous React state updates, geometry/layout reads per frame, and changing node transforms. Use browser-managed animation of the overlay only.
- Keep source evidence, pan/zoom, export, history and selection working in both themes. Motion must not change saved project revisions.

## Delivery order and acceptance

1. Prototype directionally correct overlays on one architecture diagram. Capture the static and moving states in native Tauri; verify that labels stay readable and source clicks hit the same elements.
2. Add hover/focus neighborhood emphasis and playback controls. Test pause/resume, reduced motion, theme changes, canvas navigation and regeneration.
3. Extend verified mapping to the other four representations, with explicit static fallback for unsupported shapes.
4. Measure small and dense graphs in native playback. Require no layout shift, no background animation after closing, no lost evidence targets, and no sustained frame degradation relative to the static view.

This is a plan. The current change implements the diagram library, deletion and title confirmation; continuous edge/node animation is not shipped yet. The existing diagram-construction reveal is unchanged.
