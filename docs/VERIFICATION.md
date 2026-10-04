# Verification

## Verified implementation

[Hosted run 37228150853](https://github.com/Masanori-Spec/route-leaf/actions/runs/37228150853) passed all three jobs for commit `dd7d19a0497249b4b33bba806c09ca3cf5f3f37f` on 2026-10-04. The later evidence-documentation commit preserves this implementation. The complete workflow runs again on every push; inspect the exact current commit's result before relying on a later change.

- Node 22 and 24: 66 product tests per matrix job, including parsing/executing the actual standalone delivery HTML and importing its embedded sample
- Sandboxed system Chrome 154.0.8037.57 on Ubuntu 22.04: 11 product UI case groups, Japanese/English desktop and 390-pixel mobile, all six forward walkthroughs, keyboard skip link, restart, changed questionnaire language, invalid file, reset and interrupted sample/reset
- Nine actual product screenshots include Japanese/English mobile error, reset and reimport states. Both languages load the bundled font rather than relying on host Japanese fonts
- Real browser downloads: English/Japanese route JSON and PDF, booklet HTML, and English answer-sheet HTML. Zero product page errors and zero external network requests
- PyMuPDF inspected both actual browser-downloaded PDFs: 12 cards, every explicit destination and all Unicode text, six booklet pages plus one answer-sheet page per language. Poppler rendered all 14 pages
- pyxform 4.5.0 converted the original sample XLSX with no warnings
- 11 independent-consumer unit checks include configured-input failure, real captured official DOM and fresh Vite dependency optimization
- Official `@getodk/xforms-engine` 1.0.3: all six complete question/answer/note/terminal traces match independent traversal of the **actual product UI-downloaded JSON**; every card is covered
- Actual official `@getodk/web-forms` 1.0.3 Vue component: all six histories driven through real radio/text controls, requiredness, relevance snapshots, notes, choice codes and serialized local submission match that same artifact

Both independent reports identify `test-results/browser/workshop-en.routes.json` and its SHA-256 `8a6e45a16b33af79cbb75851df79847706787a4629e823c4a11b910a0667145e`. The original XLSX SHA-256 is `43a02d96bda37fb0988fb3dbdc673c59cee24b59b4f9198b98aec0022b311362`. Explicit missing or malformed consumer input fails instead of using a fixture fallback. Check fresh successful job results and input hashes, not the mere existence of a report.

The [retained evidence snapshot](evidence/hosted/README.md) includes reports, actual PDF/JSON exports, all screenshots and every PDF raster with a manifest of byte hashes. Full Playwright traces remain in the linked run artifact. No browser sandbox settings were weakened.

## Visual review

All 14 final PDF rasters are byte-identical to the independently reviewed EN/JA pages: no clipping, missing glyphs, overlaps, or incorrect visible card/page destinations were found. Booklet page numbering and the separate answer sheet are distinct. Product desktop/mobile/error screenshots were inspected for readable Japanese, control layout, clipping and overflow. All six final official-component screenshots were also inspected: visible selected controls, optional answers, conditional pickup/notes and Send controls were clear.

## Additional local review

- 250 deterministic generated forms match a separate predicate-based history enumerator and actual card traversal
- Six additional official-engine traces cover nested conditional groups, skipped controllers, duplicate labels, unreachable notes and non-routing selects
- Malformed OOXML, namespace/relationship handling, phonetic annotations, encoded-string rejection and ZIP forged-length/name/trailing-byte regressions
- Exact font metrics, unsupported glyphs and print-overflow rejection
- Negative controls detect wrong labels, wrong choice codes, omitted notes and premature terminal edges

Hosted checks exposed and corrected a standalone HTML raw-script parsing issue, absent Japanese system fonts and consumer test-environment/readiness assumptions. Built-delivery, bundled-font and actual-DOM regressions now cover those failures.

## Evidence limits

This is a bounded forward-interview prototype. These results do not establish universal XLSForm compatibility, ODK Collect compatibility, exhaustive coverage of every accepted form, backward answer editing, physical print quality, accessibility certification, human error reduction or market demand. The sample is synthetic. Java ODK Validate was not run. No new project license has been selected; third-party license notices are retained.
