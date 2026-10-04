# Third-party components

The application bundles these pinned runtime dependencies and their transitive dependencies. Their licenses are reproduced in `docs/licenses/` and the embedded font's original license is in `assets/OFL.txt`.

- JSZip 3.10.1 — MIT or GPL-3.0-or-later; used under the MIT option
- pako 1.0.11 — MIT and zlib; bounded ZIP and local font decompression
- sax 1.6.1 — ISC
- pdf-lib 1.17.1 — MIT
- @pdf-lib/fontkit 1.1.1 — MIT
- Noto Sans CJK JP — SIL Open Font License 1.1; a renamed, subsetted and converted derivative named RouteLeafSans is embedded locally, with source/version/hash and conversion details in `assets/FONT-PROVENANCE.md`

Build/test tools are separately pinned: esbuild 0.25.11, Playwright 1.56.0, PyMuPDF 1.26.5 and fonttools 4.60.1. The official ODK consumer harness has its own lockfile, provenance and dependencies in `oracle/`. These test tools are not included in the runtime app bundle.

This notice preserves third-party terms; it does not assign a new license to the project's original source code.
