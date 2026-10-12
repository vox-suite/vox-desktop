# Archify runtime

Source: https://github.com/tt-a1i/archify

Version: 3.0.1, commit 58ab0b98d2d0def8e49dced705c7b566936723ec.

The embedded archive contains the five renderers, shared validators, schemas, syntax examples and assets. Upstream MIT LICENSE and JetBrains Mono OFL notice are retained inside the archive. Repository agents, skills and tests are excluded.

Archive SHA-256: `b35a1f24806fddb00f6060bccca6af5b645807458404c6b167c312446c1755f8`.

`src-tauri/resources/vox-render.mjs` is Vox's readable rendering adapter; the same file is included at the archive root. To rebuild, preserve the curated runtime directory structure and run `tar -czf archify-runtime.tar.gz -C runtime .` after copying this adapter to runtime/vox-render.mjs. Update this checksum when replacing the archive. The native cache key includes the archive hash.
