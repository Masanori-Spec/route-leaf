# Local font provenance

RouteLeaf Sans is a deliberately renamed, locally packaged derivative of **Noto Sans CJK JP Regular**, distributed under the SIL Open Font License 1.1. The application never downloads a font at runtime.

- Upstream project: https://github.com/notofonts/noto-cjk
- Upstream license: https://github.com/notofonts/noto-cjk/blob/main/LICENSE
- Source on this build machine: Debian `fonts-noto-cjk`, `/usr/share/fonts/opentype/noto/NotoSansCJK-Regular.ttc`, collection face 0 (Japanese glyph forms)
- Source TTC SHA-256: `b76b0433203017ca80401b2ee0dd69350349871c4b19d504c34dbdd80541690a`
- Source font name-table copyright: © 2014–2021 Adobe (http://www.adobe.com/)
- Debian package copyright also credits Google Corporation, 2010–2012
- Full notices: `OFL.txt` and the unmodified package record `DEBIAN-COPYRIGHT.txt`

`build-font.py` preserves Latin, punctuation, kana, CJK Extension A / basic unified ideographs, and full-width forms. It removes layout features for deterministic character-advance layout, converts cubic outlines to quadratic outlines using fontTools (maximum approximation error 1 font unit out of 1000), and renames the family to RouteLeaf Sans. The resulting TrueType font is `routeleaf-sans.ttf`; the same bytes are losslessly DEFLATE-compressed and embedded into `font-data.mjs` for the browser bundle. No remote font endpoint is needed. PDF exports subset and embed those outlines again using pdf-lib/fontkit; Japanese text remains selectable and extractable. Card IDs use the standard Helvetica Bold PDF font.

Rebuild only during development on a machine with the documented font package and `fonttools` installed:

    python3 assets/build-font.py

The font remains OFL licensed. This does not change the application's source-code license, create a product license policy, or require an OFL license for generated documents. The original notices are retained alongside the derivative.

TrueType is inflated once on module load from its losslessly compressed representation because fontkit repeatedly decompresses WOFF glyph data; this reduces first-export latency substantially. The font is subset when written into each PDF.

Every TrueType glyph is padded to a four-byte boundary. This is essential for fontkit’s short-loca PDF subsets: unaligned glyph byte lengths can yield correct Unicode extraction but broken rasterized outlines. Verification decompiles every embedded glyph as well as rendering all pages.
