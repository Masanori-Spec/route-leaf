# Security boundaries

All product processing occurs locally in the browser. The standalone build contains its sample workbook, parser, PDF library and font. It does not use remote fonts, uploads, analytics, storage or account credentials. Test harnesses use loopback servers and block/record nonlocal requests.

Input limits: 8 MiB ZIP bytes, 24 MiB declared expanded bytes, 256 ZIP entries, at most 64 columns and 1,000 referenced rows per sheet, bounded strings/expressions, 30 questions, 512 reachable routing histories and 80 cards. ZIP extraction validates local/central headers, compressed-byte consumption and CRC. Inflation is streamed in 16 KiB chunks with actual-byte limits; forged size declarations abort during inflation. Encrypted ZIPs, unsafe names, duplicate paths, DTD/entity declarations, macros and external relationships are rejected.

No arbitrary expression execution occurs. Expressions have a small handwritten grammar. UI text is assigned through textContent; exported HTML escapes content. PDF text is embedded through a bounded renderer with checked glyph coverage. New imports, malformed inputs, reset and language changes invalidate previously prepared exports.

The PDF/HTML booklet may contain information from the supplied questionnaire. Sharing that file is the operator's decision. No respondent answers are stored by the preview. Printed answer sheets should be handled according to the interview's own privacy requirements.

Hosted browser checks must retain Chromium's sandbox. Local restricted-browser failures are not justification for --no-sandbox, permission expansion or OS security changes.
