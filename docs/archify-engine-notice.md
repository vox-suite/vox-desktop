# Archify runtime

Source: https://github.com/tt-a1i/archify

Version: 3.0.1, commit 58ab0b98d2d0def8e49dced705c7b566936723ec.

The embedded archive contains the five renderers, shared validators, schemas, syntax examples and assets. Upstream MIT LICENSE and JetBrains Mono OFL notice are retained inside the archive. Repository agents, skills and tests are excluded.

Archive SHA-256: `ea196d4cf903918d861b8f4ccd71e9256caed3c0fa73bee686df2949b4bf67b4`.

`src-tauri/resources/vox-render.mjs` is Vox's readable rendering adapter; the same file is included at the archive root. To rebuild, preserve the curated runtime directory structure and run `tar -czf archify-runtime.tar.gz -C runtime .` after copying this adapter to runtime/vox-render.mjs. Update this checksum when replacing the archive. The native cache key includes the archive hash.

Vox layout additions are retained in `src-tauri/resources/vox-renderer-layout.patch`; the adapter imports `vox-layout.mjs`, which must also be copied to the archive root. The patch includes explicit validation for the dataflow `column_gap` and `row_gap` schema extensions. `render-fit` fits generated sequence and automatically routed dataflow candidates before review; `render` preserves accepted coordinates; legacy sequence diagrams receive the same idempotent spacing fit when opened. Authored dataflow routes are left intact and still validated. All five renderers enforce arrow segments longer than their labels with 12px clearance at each end. In `render-fit`, label-placement diagnostics are applied before anything is returned: `fixLabels` takes the renderer's computed `labelAt` for label/node overlaps and nudges `labelDy` for label/label and label/route clashes, keeping a pass only when it leaves fewer problems. Architecture components are fitted through `size`, which their schema uses instead of `width`.

Renderer-suggested label placement repairs run locally within a shared 12-second budget, keeping only candidates with fewer diagnostics. Sequence diagrams use spacing repair instead of unsupported label-offset fields.
