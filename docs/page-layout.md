# Desktop page layout

Use `PageContainer`, `PageHeader`, and `PageBody` from `src/components/ui/page-container.tsx` for desktop pages. Keep the header as a sibling of the body so it remains visible while content scrolls. Header content is page-specific; spacing, borders, height constraints, and overflow belong to the shared primitives.

`PageBody` scrolls by default. Set `scroll={false}` for canvases, timelines, or an existing scroll component. An Agent page can omit the header and use a transparent container.

The shell places app content at z-10, edge blur at z-20, and side panels at z-30. Dialogs and menus retain their overlay layers. `PanelEdgeBlur` renders outside panel stacking contexts and follows measured panel bounds. The left sidebar uses a 24px blur strip, beginning below `[data-page-header]`; do not hard-code header heights or panel widths.

Span, Connected Apps, Spaces library/canvas, Agent, and Pulse (including creation and boards through PulseShell) use these primitives.
