# Verification status

## Locally exercised

- Parser/compiler and actual XLSX import tests, including the exact 9-question / 6-history / 12-card fixture
- Unsupported-feature, group, skipped-controller, duplicate-label, Unicode and expansion-limit cases
- Independent review: 250 deterministic generated forms match a separate predicate-based history enumerator and card traversal; malformed OOXML, phonetic annotations, encoded-string escape rejection and ZIP forged-length/name/trailing-byte regressions are covered
- Local PDF generation, exact font metrics, unsupported-glyph and print-overflow rejection
- pyxform 4.5.0 converts the actual sample XLSX without warnings
- Official @getodk/xforms-engine 1.0.3 matches all six complete event traces from independently traversed exported card JSON, covering every card
- Negative controls detect a wrong question label, wrong choice code, omitted note and premature terminal edge

## Hosted release gates, not yet executed in this source snapshot

The workflow must pass for the exact published commit. Local engine success is not a Web Forms UI pass.

1. Product browser: Japanese/English, desktop/mobile, keyboard entry, all six walkthrough histories, restart, invalid file, changed input, reset, actual JSON/HTML/PDF downloads
2. Actual UI-downloaded English/Japanese PDF text and every card destination checked with PyMuPDF; all pages rendered with Poppler
3. Actual official ODK Web Forms Vue component: all six histories, real radio/text controls, relevance snapshots, notes, selected codes and serialized local submission
4. Human visual inspection of desktop/mobile screenshots and every rendered PDF page for readability, clipping, page references and monochrome contrast

No browser sandbox weakening is allowed. A prepared test harness or generated screenshot is not evidence of a completed gate. See oracle/README.md for pins, source APIs and the independent comparison boundary.
