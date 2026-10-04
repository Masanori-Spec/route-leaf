# RouteLeaf print contract

## Exports

`src/print.mjs` exports four functions:

- `validatePrintLayout(manifest)` is synchronous and returns `{ ok, errors, bookletPages, answerSheetPages, totalPages }`. `errors` is an array of human-readable strings.
- `renderBookletHtml(manifest)` returns a complete self-contained HTML document containing the booklet only.
- `renderAnswerSheetHtml(manifest)` returns a complete self-contained HTML document containing separate answer sheets, ten original questions per page.
- `await createPdf(manifest)` returns `Uint8Array` bytes beginning `%PDF-`. This is a real PDF created locally using pdf-lib, not a browser print dialog.

Every export first validates. Rejections throw `PrintLayoutError` with stable `code: "print_layout"` and an `errors` array. Export callers must display the errors and leave their download unavailable. No text is silently shortened or clipped.

The fixed worksheet fixture has **12 distinct cards on 6 A4 booklet pages, followed by 1 separate answer-sheet page**, so the combined PDF has 7 pages. There is no cover page. First-page instructions explicitly tell the interviewer to follow routes, not printed order, and restart with a clean answer sheet when changing a routing answer. Both language variants and the answer sheet carry the restart warning. Choice cards say an answer is required; text cards say they are optional. The one-page answer sheet has one row per original question, including informational notes clearly marked as requiring no answer. Repeated context-specific cards do not produce duplicate answer rows.

## Physical routing

Each card shows a large bold unique ID, the original question number and source name, selected-language label and hint, and an answer-specific destination. A destination contains both the target card ID and its actual booklet page, for example `C08 / booklet p. 4` or `C08 / 冊子 4ページ`. END explicitly means stop. Non-choice cards have a single continuation route. The answer-sheet footer states that its page is separate from booklet numbering.

Each page has two fixed card positions. `card.page` must equal `floor(card index / 2) + 1`; existing destinations must resolve; IDs must be unique. The validator rejects invalid physical routing before rendering. Branch semantics are separately owned by the compiler and independent route oracle.

## Conservative size bounds

The page is A4, 595.28 × 841.89 points. Cards are 523.28 × 312 points with 18-point content insets. The font is locally bundled and embeds into the PDF. Layout uses this exact font's advance widths, so it does not depend on installed OS fonts or an estimated number of characters per line.

- Title: one line at 18 pt, maximum width 460 pt
- Question label: at most 300 characters / three 20-pt lines, 15-pt font
- Hint: at most 200 characters / two 13-pt lines, 9.5-pt font
- Choice: at most 180 characters / three 15-pt lines, 11-pt font; 1–8 choices are parsed, with the combined height bound rejecting large choice sets before export
- Combined label/hint/instruction/choice height: at most 232 pt. This combined bound may reject sooner than the individual caps
- Source metadata and destination text must fit their dedicated widths without wrapping
- Answer sheets: at most 30 original questions, ten per page, with 610 points of measured row heights per page; overly long labels are rejected
- Unsupported glyphs, control characters, inconsistent page counts and missing destinations are errors, never replacement boxes

A title can be selected independently of label language, as XLSForm `form_title` is not assumed to have translated columns. English and Japanese field labels and printable instructions follow `manifest.language`.

## Fonts and offline operation

See `assets/FONT-PROVENANCE.md` and `assets/OFL.txt`. RouteLeaf Sans is a renamed local derivative of Noto Sans CJK JP, with supported Unicode coverage checked before printing. Both HTML and PDF use the same bundled asset. The browser performs no runtime font download. PDF generation is local and does not transmit the manifest.

## Verification

Run `node --test tests/print.test.mjs`. These tests compile the actual English/Japanese fixture, check HTML page/row counts and escaping, reject overflow and broken destinations, generate real PDF bytes, verify seven A4 pages, and invoke the PyMuPDF verifier.

Run the verifier on a generated artifact:

    python3 scripts/check-pdf.py generated/workshop-en.pdf generated/workshop-en.routes.json --render tmp/pdfs/en
    python3 scripts/check-pdf.py generated/workshop-ja.pdf generated/workshop-ja.routes.json --render tmp/pdfs/ja

PyMuPDF checks text extraction, original source/question labels, every card's physical position, all destination strings, page numbering, embedded Unicode font and valid subset outlines, one row per original question, and text bounding boxes. With `--render`, Poppler renders **every page** to PNG for visual inspection. Required Python modules: `pymupdf`, `fonttools`; required executable: `pdftoppm`.

The hosted browser flow must separately verify that clicking the actual PDF-download control downloads the PDF and that the downloaded bytes pass the same verifier. A programmatic generation test alone does not establish browser-download behavior.
