# Screenshot fixtures

Start the local frontend with `pnpm run tauri dev` (or keep `pnpm run dev` running if the native process exits). Open `http://localhost:1420/screenshots.html?screen=home`.

The separate development entry reuses the desktop app components with Alex Morgan's fictional US account, USD transactions, Pacific time, and the Computer History Museum public landmark in Mountain View. Native calls, account APIs, and persisted user caches are replaced inside this entry. It does not sign into or modify a real account.

Screens: `day`, `month`, `detail`, `filter`, `apps`, `insights`, `plans`, `project`, `home`. The capture script opens the real Month tab and navigates to August 2026 for a natural six-week grid.

Run `node src/screenshots/capture.cjs` from vox-desktop. It uses the installed Playwright and Sharp libraries in the sibling vox-web project, sets an October 12, 2026 clock and America/Los_Angeles browser timezone, checks key content and canvas bounds, then exports the nine named WebP assets to `artifacts/screenshots/`. Full captures are 3840 × 2160; `cropped/` contains eight additional tour crops. Event-detail captures render the existing SpanPanel directly; crops retain the complete right-side sheet. Home stays uncropped. `manifest.json` and `contact-sheet.png` accompany the exports.

`presentation.ts` supplies screenshot-only overview controls requested in the brief: connector Timeline/Assistant switches, a shared Insights range control and comparison caption, amounts on filtered spending rows, and the Context tab label. These are presentation mocks, not shipped production controls. The existing real screen labels the project tab Canvas and keeps permissions in connector detail. The shared range fixture is visual; it does not recalculate the charts. Connector switches affect the local presentation only.

Captures use Chromium rendering of the desktop frontend, not macOS native window chrome. No release build or live provider validation is needed for these mock assets.

The event-detail preview uses the existing `SpanPanel` and `PanelBody` with a purchase converted to a Span. It does not open the newer TimelineView Dialog. The screenshot reflects the actual side panel fields (including source and notes), rather than adding the modal's structured evidence fields.

The Month preview renders the original `SpanMonthView` component, with three real event chips and overflow indicators per day, in the existing Timeline shell. It does not use the newer counts/bar summary or injected category dots.
