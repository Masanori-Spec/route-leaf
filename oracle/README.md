# Official consumer verification

This directory is deliberately independent of the RouteLeaf source, relevance parser, route builder, and screen renderer. It reads only the produced `.xlsx` and `.routes.json` files. It never trusts the route file's precomputed `histories`.

## Verification chain

1. `compile.py` uses official **pyxform 4.5.0** to compile `generated/workshop.xlsx` into an XForm. It separately reads the workbook through openpyxl for source labels. It records input and compiled-XForm SHA-256 hashes. Java ODK Validate is not run by this stage.
2. `route-json.mjs` follows the exported card graph from `start`, using only each actual card's `next` and choice edges. It rejects missing targets, cycles, repeated source questions, unsupported types, duplicate IDs, invalid choices, and unused controller answers. Six independently defined controller histories cover every card. It imports no RouteLeaf module.
3. `engine.mjs` creates a fresh **@getodk/xforms-engine 1.0.3** instance for each of those histories. It observes the official engine's relevance, labels, choice values, input storage, notes and terminal submission status. It does not parse or evaluate the relevance expressions itself.
4. `browser-check.mjs` mounts the actual **@getodk/web-forms 1.0.3 OdkWebForm Vue component**, clicks its radio controls, fills its real text controls and clicks its **Send** button. It observes its DOM questions/options and serialized submission. Nothing is submitted to a remote server. Outbound requests other than this test's local server are blocked and recorded.
5. Every complete source-question / answer / terminal event sequence must equal the independently traversed exported route JSON. The browser also compares every intermediate visible-question snapshot to a separately instantiated official engine, checks stored answers in the actual component's submission, and captures screenshots and Playwright traces.

All nine source controls are in scope, including conditional notes and text fields. Six controller histories are covered, not six arbitrary rows: Print and Bookbinding, each with no loan, morning loan pickup, and evening loan pickup. Representative text answers are used because these text fields do not control routing. This does not claim exhaustive testing of arbitrary text contents, all XLSForm features, ODK Collect or every consumer/version.

## Pinned tools

- Node 24.16.0 or another compatible Node 24, npm 11 (the official packages declare `^24.16.0`)
- `@getodk/xforms-engine` **1.0.3**
- `@getodk/web-forms` **1.0.3**
- Vue **3.5.29**
- Playwright **1.56.0** and Vite **6.4.1**
- Python 3.12, pyxform **4.5.0**, openpyxl **3.1.5**
- Full npm resolution/integrities: `package-lock.json`; complete Python dependency closure: `requirements.txt`

The installed 1.0.3 package actually exports `webFormsPlugin` (lowercase). The README's `WebFormsPlugin` example is stale; this harness uses the verified published export. Its engine uses `createInstance(xml)` and the public `root` client API, not an assumed `initializeForm` API.

The published engine bundle retains Emscripten's CommonJS `__dirname` reference. The optional Node/jsdom check supplies that one host global. The official package's source and computations are unchanged. The real browser test uses the package unmodified and needs no Node compatibility shim.

## Run

From the repository root, first produce the delivery artifacts:

```sh
npm ci
npm run fixture
npm ci --prefix oracle --ignore-scripts
python -m pip install -r oracle/requirements.txt
python oracle/compile.py
node scripts/consumer-check.mjs unit
node scripts/consumer-check.mjs engine
```

For the browser stage, use the existing hosted **Ubuntu 22.04** CI runner with sandboxed system Chrome:

```sh
CHROME_BIN=/usr/bin/google-chrome node scripts/consumer-check.mjs browser
```

The script explicitly sets `chromiumSandbox: true`. Do not add `--no-sandbox`, change host security settings, or use the restricted local browser as a fallback. It starts and stops its own loopback Vite server on port 4175. Dependencies are separate from the application to make the external-consumer boundary auditable.

A browser result is a pass only when `oracle/generated/browser-report.json` has `status: "passed"` and six cases. Engine success alone is not a Web Forms UI pass. If the process fails before launch, the browser report is failed; never treat the existence of the harness or a screenshot as a completed comparison.

## CI job recipe

Use `runs-on: ubuntu-22.04`, Node 24.16.0, Python 3.12 and `permissions: contents: read`. Run the commands above after checkout; do not install a second browser or start a privileged browser. Upload `oracle/generated/` on `always()` so failures include the report, server log, HTML, screenshot and trace. Also retain `generated/workshop.xlsx` and `generated/workshop-en.routes.json` with that run for provenance. Do not cache evidence from another commit.

## Evidence files

- `generated/source.json`: compiler version, input/XForm hashes, warnings and independently read source labels
- `generated/workshop.xml`: exact compiled consumer input
- `generated/engine-report.json`: six complete official-engine traces, state snapshots and route digest
- `generated/browser-report.json`: actual Web Forms UI traces, snapshots, browser version and submission checks
- `generated/web-forms-*.png`, `generated/trace-*.zip`: actual official component evidence per history
- `generated/failure-*.html/png`, `generated/vite.log`: diagnostic artifacts when a browser check fails

Generated files are ignored and regenerated by CI. `verification-status.json` is a dated local checkpoint, not a substitute for the exact published commit's CI result.

## Primary sources checked

- [Official ODK package overview and repository migration](https://github.com/getodk/web-forms)
- [Official engine npm package](https://www.npmjs.com/package/@getodk/xforms-engine)
- [Official Web Forms npm package](https://www.npmjs.com/package/@getodk/web-forms)
- [Official engine client interface](https://github.com/getodk/central-frontend/tree/master/packages/xforms-engine/src/client)
- [Official pyxform project and conversion API](https://github.com/XLSForm/pyxform)
- [pyxform 4.5.0 release](https://github.com/XLSForm/pyxform/releases/tag/v4.5.0)

Exact API names and DOM selectors were additionally inspected in the 1.0.3 npm tarballs whose integrity hashes are preserved by the lockfile. These are deliberate reproducibility pins, not a claim that 1.0.3 is the newest available release.
