# Hosted evidence snapshot

Source: [run 37228150853](https://github.com/Masanori-Spec/route-leaf/actions/runs/37228150853), commit `dd7d19a0497249b4b33bba806c09ca3cf5f3f37f`, 2026-10-04. All three jobs passed. These are real CI artifacts from the synthetic workshop example, not design mockups. The linked Actions artifact also includes full traces; retained files are hashed in [manifest.json](manifest.json).

## Reports and actual downloads

- [Product browser report](product-report.json): 11 passed groups, no page errors or external requests
- [Official engine report](official-engine-report.json): six complete histories and negative controls
- [Official Web Forms report](official-web-forms-report.json): six real-control histories, every relevance snapshot, requiredness and local submission
- [pyxform/source provenance](source.json)
- Actual browser exports: [English JSON](workshop-en.routes.json), [Japanese JSON](workshop-ja.routes.json), [English PDF](workshop-en.pdf), [Japanese PDF](workshop-ja.pdf)

Both independent consumer reports reference the same UI-downloaded English JSON hash. The consumers traverse card edges independently and do not import RouteLeaf's parser/compiler/renderer or trust its history list.

## Product UI

All nine retained product images were visually inspected, including loaded Japanese glyphs and mobile error states. Screenshots may show a focused keyboard skip link; that is intentional accessibility behavior.

- [Japanese empty state](product/01-ja-empty.png)
- [English contextual cards](product/02-en-cards.png)
- [Completed interview](product/03-en-complete.png)
- [Japanese cards](product/04-ja-ready.png)
- [Malformed input](product/05-en-error.png)
- [Japanese mobile](product/06-ja-mobile.png)
- [English mobile](product/07-en-mobile.png)
- [Japanese mobile error](product/08-ja-mobile-error.png)
- [English mobile error](product/09-en-mobile-error.png)

## Official ODK Web Forms

The actual official component is driven in sandboxed Chrome. Its six final states were visually inspected and are retained below. Trace equality is established by the report, rather than inferred from pictures alone.

- [Print / no loan](official/web-forms-print-no.png)
- [Print / morning pickup](official/web-forms-print-morning.png)
- [Print / evening pickup](official/web-forms-print-evening.png)
- [Bookbinding / no loan](official/web-forms-book-no.png)
- [Bookbinding / morning pickup](official/web-forms-book-morning.png)
- [Bookbinding / evening pickup](official/web-forms-book-evening.png)

## All-page PDF inspection

All 14 Poppler rasters were inspected individually. No clipping, missing glyphs, overlap, or incorrect visible card/page destination was found. The first six pages are the booklet; the seventh is a separately numbered answer sheet.

- English: [1](pdf-en/workshop-en-1.png), [2](pdf-en/workshop-en-2.png), [3](pdf-en/workshop-en-3.png), [4](pdf-en/workshop-en-4.png), [5](pdf-en/workshop-en-5.png), [6](pdf-en/workshop-en-6.png), [7](pdf-en/workshop-en-7.png)
- Japanese: [1](pdf-ja/workshop-ja-1.png), [2](pdf-ja/workshop-ja-2.png), [3](pdf-ja/workshop-ja-3.png), [4](pdf-ja/workshop-ja-4.png), [5](pdf-ja/workshop-ja-5.png), [6](pdf-ja/workshop-ja-6.png), [7](pdf-ja/workshop-ja-7.png)

See [verification limits](../../VERIFICATION.md). This snapshot is evidence for its named commit, not certification of every input, browser, client, printer or future revision.
