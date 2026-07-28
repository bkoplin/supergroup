# supergroup v2 — docs milestone design

Status: approved design, implementation in progress. Amended 2026-07-14
(cell mechanics round), 2026-07-16 (examples round: citation, ASI hint,
recordLeaves resolution), 2026-07-28 (examples redesign round: API-index
structure, data consolidation, display helpers, viz set). Follows the
[v2 design spec](2026-07-13-supergroup-v2-design.md) (M1–M3 complete on
master). 2.0.0 was published as `latest` early, 2026-07-28 (see Order of
work).

## Deliverables

1. Live demo/documentation site served from `docs/` on master
   (`sigfried.github.io/supergroup`, Pages-from-branch, master `/docs`).
2. Rewritten README.
3. v1 artifacts moved to `legacy/`.
4. Packaging: `exports` map, dist build, 2.0.0 metadata.
5. M1 deferred-minors checklist cleared (gates publish).
5b. Library additions driven by the site's no-magic display rule:
   `supergroup/formatting` module + `SGNode.dimPath` (see "Library
   additions" below).
6. `npm publish` of 2.0.0 as `latest`.
7. Post-publish pointers: dmvd CLAUDE.md one-liner; note in
   `~/github-repos/personal/hub/projects/lifeflow/README.md`.

## Demo/doc site

### Architecture

Single static page, no build tooling (matches the zero-dep tradition).
GitHub Pages serves master `/docs` via the built-in "deploy from a branch"
setting — publishing is a side effect of `git push`. The old `gh-pages`
branch is retired after the new site is live.

```
docs/index.html              the page: prose + live code cells
docs/livecells.js            cell runtime (editor, Run, result rendering)
docs/site.css                styles
docs/vendor/supergroup/      built dist/, copied in by `npm run build:site`
docs/data/                   demo datasets (below)
planning/specs|plans/        planning docs (moved out of docs/ 2026-07-16
                             so the Pages flip doesn't publish them)
```

Key trick: Pages only serves files under `docs/`, so the site imports a
**committed vendored copy** of the built library (`docs/vendor/supergroup/`)
rather than `../dist` or a CDN. No chicken-and-egg with the npm publish; the
page works locally (any static server) and on Pages identically. An npm
script (`build:site`) runs the dist build and copies it in; CI-free, so
keeping it fresh is a documented manual step in the release checklist.

External libraries — d3, d3-sankey, CodeMirror, react,
dag-browser-widget, gridjs, json-formatter-js, and duckdb-wasm (via
jsdelivr) — load from CDN via an import map (list as of 2026-07-28).
**Verify early** that dag-browser-widget loads as browser ESM from
esm.sh; if it can't, its demo degrades to pretty-printed
`toDagBrowserNodes` output.

### Live cells

Each example is an editable cell (CodeMirror 6 from CDN) with Run and
Clear buttons. Mechanics revised 2026-07-14 after SG review of the first
draft (ee419e2):

**Run.** No cell runs on page load. Output boxes start with a muted
placeholder ("Run to evaluate"). Run gives visible feedback: a running
state on the button, `✓ 8ms` status on success, `✗` plus the error text
in the output on failure. Shift-Enter runs the focused cell. A "Run all"
control stays at the top of the page, and `?runall` still runs every
cell (used by the headless check).

**Cell semantics.** Cell code has no `return` and no top-level `const`:
the value of the last statement is the cell's output (Observable-style).
Execution wraps the code in a sloppy-mode direct `eval` inside an async
function (`return eval(code)`), which gives exact completion-value
semantics for multi-line final expressions. Bare assignments (`sg = …`)
therefore land on `window` — cells publish their variables for console
inspection; last run wins when two cells assign the same name. The cell
bar shows what a run published (`→ window: sg, n`). Clear empties the
output and deletes exactly the window vars that cell published. `let`/
`const` typed while editing stay private to the cell. `await` is
unavailable inside `eval` code (no cell uses it); if a cell's output is
a thenable, the runtime awaits it before rendering.

**Display: explicit, renderer dumb** (amended 2026-07-28). The
renderer keeps exactly three rules and type-sniffs nothing further: a
DOM node appends as-is, a string renders in a `<pre>`, anything else
pretty-prints as circular-safe JSON. All richer display is explicit,
ideally single-line, code in the cell, via **page display helpers** —
window globals provided by livecells.js that return DOM nodes (so they
flow through the DOM rule):

- `gridTable(records, opts?)` — sortable/paged Grid.js table.
- `jsonView(x, opts?)` — collapse/expand colored JSON
  (json-formatter-js).
- `treeView(x, opts?)` — collapsible tree of a supergroup / DAG /
  sequence / compare result; for compare results, nodes only in `b`
  render green (added), only in `a` red (removed) — the vs-hub diff
  idiom.
- `print(...args)` — appends each argument rendered by the renderer's
  three rules; lets a cell show several labeled values
  (`print('roots:', g.roots.length, ...)`) instead of packing one JSON
  object.
- `reactMount(Component, props, {height}?)` — creates the sized
  container, mounts via createRoot, returns the container; slims React
  embeds (DBW) to their interesting lines.

Console parity, rescoped: cell *code* must still run when pasted into
the page's devtools console (the helpers are window globals, so it
does); page *display* may be richer than what `console.log` would show.
The library's formatting functions (`toTable`, `prettyPrint`,
`summary`) remain the no-DOM, string-returning story for library users'
own consoles; cells use them where text output is the point, page
helpers where it isn't.

**Dataset preview cards.** Where each dataset is introduced, an empty
marker element (`<div class="dataset" data-name="…">`) is populated by
livecells.js with the name, `N rows × M cols`, a download link, and an
expandable preview of the first rows — rendered with the same Grid.js
tables as `gridTable` (amended 2026-07-28; fixes overflow, one table
look everywhere).

**Cell source dedent** (added 2026-07-28). The runner strips the common
leading indent from cell text, so `<pre class="cell">` contents are
indented to match their surrounding HTML in `docs/index.html` — the
page source stays readable. Code boxes get a max height with scroll and
are user-resizable.

Cell scope: every export of `supergroup`, `supergroup/dag`,
`/sequence`, `/compare`, `/adapters`, `/formatting`, plus `d3`, `sql`,
the page display helpers, and the datasets. Everything in scope is also
pre-assigned to `window`.

### Library additions (the library stays no-DOM, string-returning)

New subpath module `supergroup/formatting`: explicit formatting
functions. Every function returns a **string**, so what the site
displays is exactly what a reader gets in their own console (no DOM in
the library).

- `prettyPrint(x, opts)` — `x`: collection | node | node array.
  Indented tree, one line per node (default: label + record count +
  `cmp` annotation when present). No summary header. `opts = {maxDepth,
  maxChildren, fmt, rails}`: `fmt(n) => string` replaces the per-node
  line; `rails: true` uses `├─`-style box-drawing instead of plain
  indentation.
- `summary(x)` — the shape line, kept separate from `prettyPrint`:
  `110 roots · 2,816 nodes · 8,618 records`.
- `toTable(records, {maxRows, columns, format})` — text table for
  arrays of plain records; `format: 'text'` (default, aligned
  monospace) `| 'markdown'` (pipe table, pasteable into GitHub/Slack)
  (format option added 2026-07-28).
- **Truncation only on request**: `maxDepth`/`maxChildren`/`maxRows`
  have no defaults — output is complete unless an option is passed, and
  applied truncation is always explicit in the output (`… 105 more`),
  never silent.

Core addition: `SGNode.dimPath(sep = '/')` — pedigree mapped over
`.dim`, joined (v1 parity). The rest of v1's viewing conveniences were
inventoried against v2 and resolved without new API: `lookup` →
`node()`, `lookupMany` → `select()`, `flattenTree` → `flatten()` (DFS
pre-order, each node once), `leafNodes` → `leaves()`, `namePaths`/
`aggregates` → plain array ops over `nodes` (the migration page
documents these mappings).

`addRecordsAsChildrenToLeafNodes` (resolved in the examples round,
2026-07-16): the v1 use — d3 layouts sized per record, e.g. the v1 docs'
treemap of visit records sized by Charge — is real and stays in the new
docs. v2 replacement is an adapter option, not core mutation:
`toD3(x, {recordLeaves: (r, i) => string})`. When set, every childless
node in the emitted tree gets `children` = its records mapped to
`{id: `${node.id}/r${i}`, name: recordLeaves(r, i), key: null,
records: [r]}`. No option → output unchanged. The docs page demonstrates
it with the DAG section's live treemap cell (drug eras under ATC
classes, one rect per era — re-homed 2026-07-28 from the original
patients/Charge sketch when the data consolidated), and the migration
table maps the v1 method to this option.

These are src changes: implement + test, then rebuild the dist and
re-run `build:site` so the vendored copy carries them before the site
cells use them.

### Content outline (rewritten 2026-07-28 — examples redesign round)

SG review of the first full page: "no rhyme or reason to the specific
examples included or their order." The organizing principle is now
**API coverage inside a narrative**: an example exists because an API
entry needs one, every entry has exactly one home, and an API index
links each entry to its example.

**Voice**: unchanged — neutral, close to the old README's register.

1. **Positioning** (trimmed) — the seam between `d3.group` (grouping,
   no navigation) and `d3.hierarchy` (navigation, no records, no
   multi-parent).
2. **The data** — the single synthea/vocab family (below), Grid.js
   preview cards, the required Synthea citation, no redundant links.
3. **Quick start** — a few cells on the synthea CSV extracts: instantly
   runnable, no duckdb wait, minimal domain knowledge (e.g. conditions
   by gender/condition).
4. **API index** — hand-written table: every public export of
   `supergroup`, `/dag`, `/sequence`, `/compare`, `/adapters`,
   `/formatting`, plus `Supergroup` and `SGNode` methods; one-liner
   each; anchor link to the demonstrating cell. Completeness is the
   review criterion: no undemonstrated entry, no orphan example.
5. **SQL on the page** — duckdb-wasm intro (status line, `sql()`, local
   CSV registration, remote parquet views); its published results feed
   the later sections.
6. **Core** — supergroup(), node()/select()/flatten()/leaves(),
   agg/rollup/pct, namePath/dimPath, multi-valued dims (inline movies
   literal), Date keys, `treeView` display.
7. **DAG** — constructors on a 5-line inline cyclic literal (cycles/
   backedges pedagogy), then the live vocab classification: attach,
   union-safe rollups, subgraph, the slimmed DBW embed
   (`reactMount`), and the **treemap** (`toD3` `recordLeaves`: drug
   eras under ATC, one rect per era — the v1
   addRecordsAsChildrenToLeafNodes use).
8. **Sequence** — condition histories (`groupBySequence`
   forward/anchored-both), closing with the **zoomable icicle**
   (click-to-zoom; replaces the unreadable static one) and the
   **sankey** of condition/status transitions (d3-sankey; the
   LifeFlow-flavored showcase). The lifeflow/timelines placeholder
   prose stays.
9. **Compare** — women-vs-men cohorts over the drug classification;
   `treeView` diff coloring (green added / red removed), closing with
   **diverging bars** by countDelta.
10. **Adapters** — the pattern (plain objects out: `toD3`,
    `toDagBrowserNodes`), pointing back at the viz cells that use them.
11. **Migration** — the v1 → v2 table (incl. viewing-convenience and
    recordLeaves rows).

Cells that show several values use `print(...)`; structure display uses
`treeView`/`jsonView`/`gridTable` explicitly (see Display). Big cells
are fine — code boxes scroll and resize.

### Datasets (`docs/data/`) (rewritten 2026-07-28 — examples redesign round)

One data world: the synthea 1k-patient cohort + OMOP vocabulary
(SNOMED/RxNorm/ATC). Everything else is deleted — files, preview cards,
and data-section rows (`OlympicAthletes.csv`, `fake-patient_data.csv`,
`diffExample.csv`, `fips.csv`, `hurricane.csv`, `containment.json`;
`drug-classes.json` was already retired by the duckdb-demo work).
Pedagogical toys (the cyclic containment digraph, the multi-valued
movies example) live as short inline literals in their cells — not
datasets, no files, no cards.

| Dataset | Source | Used by |
|---|---|---|
| `synthea-conditions.csv`, `synthea-drugs.csv`, `synthea-persons.csv` | synthea1k (public S3 `s3://synthea-omop/synthea1k/`, ~1,130 patients), names joined from SG's local OMOP vocab (postgres `n3c.n3c`) | quick start; core; sequence (instant, no duckdb wait) |
| remote parquet (`sigfried.github.io/omop-demo-data`): vocab tables + synthea OMOP tables | published data repo (duckdb-demo Task 6) | SQL section; DAG classification; compare; anything needing joins/vocab |

The synthea/vocab extracts are rebuilt by a committed curation script
(`docs/data/curation/`) so they can scale up later for the lifeflow/
timelines demo. SG OK'd publishing SNOMED/ATC/RxNorm names in these
extracts (2026-07-14). The required citation sentence stays with the
synthea bullet (verbatim, 2026-07-16).

## README rewrite

Lean (~120 lines), keeping the current README's neutral register: positioning
paragraph, install + quick-start snippet, short feature tour (one small
snippet per module), link to the live demo site, the v1 → v2 migration
table, dev notes (test/typecheck/build/publish). The long walkthrough moves
to the site; the README stops trying to be the documentation.

## `legacy/` move

Move to `legacy/`: `supergroup.js`, `oldDemoStuff/`, `oldTests/`,
`old_doc.html`, `old_groc.index.html`, `bower.json`, root `assets/`,
`test/supergroup_vows.js`, `test/tree_test_data.csv`. Add a one-paragraph
`legacy/README.md` pointing at NOTES.md for the archaeology.
`examples/OlympicAthletes.csv` moves to `docs/data/` (then `examples/` is
empty and goes away). Nothing in `legacy/` ships to npm.

## Packaging

`package.json`:

- `version: "2.0.0"`, `type: "module"`
- `exports` map for `.`, `./dag`, `./sequence`, `./compare`, `./adapters`,
  each with `types` + `import` (or `default`) pointing into `dist/`; no
  `main`
- `files: ["dist"]`
- drop `lodash` (runtime deps: none); drop dead devDeps (vows, jasmine,
  xhr2)
- `engines.node: ">=18"`
- scripts: `build` (tsc -p tsconfig.build.json), `build:site`,
  `prepublishOnly` (build + test + typecheck); `test` becomes `vitest run`
  (retire the vows `test`/`debug` scripts)
- refreshed description/keywords for v2

Plus: `tsconfig.build.json` emitting ESM + `.d.ts` to `dist/`; add the
missing LICENSE file (MIT, matching package.json).

**Verification**: `npm pack`, install the tarball into a scratch project,
import every subpath, run a smoke snippet.

## Deferred minors (publish gate, from the M1 plan)

- id collision: numeric `1` vs string `'1'` under one dim — disambiguate or
  document.
- Document record dedup as reference-identity (`Set<R>`).
- Extract shared BFS/queue helper (O(n²) `queue.shift()` in build.ts,
  metrics.ts, subgraph.ts; duplicated min-depth BFS).
- Document `pct()` semantics on dag collections.
- `subgraph` clones keep `synthetic` flag and collection `root`.
- Re-export `SGNodeLike` from the core index.
- Document `fromParentChild` last-write-wins label conflicts.
- Add empty-input tests, type-level inference tests, and an end-to-end
  `toDagBrowserNodes(subgraph(...))` test.

## Order of work

1. Deferred minors (touch src; the site should demo final behavior).
2. Packaging + dist build (the site vendors dist, so it must exist first).
3. Site, then README, then `legacy/` move, then planning-doc cleanup.
4. Flip the Pages setting (Settings → Pages → master `/docs`) — SG does it,
   or via `gh api` with SG's OK. Verify the live site.
5. `npm publish` — DONE EARLY (2026-07-28): SG published 2.0.0 ahead of
   the docs work so dmvd could depend on it; README carries a docs-lag
   banner until the rewrite lands (remove it in the README task).
   Verified `latest: 2.0.0`. Tag `v2.0.0` + push: SG.
6. Post-publish: dmvd CLAUDE.md pointer to the v2 spec's GitHub URL; note in
   hub's `projects/lifeflow/README.md` about the supergroup update and the
   reminder to add lifeflow/timelines to the demo page when ready.

## Non-goals

- Full lifeflow/timelines demo rewrite (separate later project; the site
  carries a placeholder).
- Fixing/publishing the 1.x line.
- CI / GitHub Actions of any kind.
- Framework adapters, docs search, multi-page docs site.
- Page-wide React or any build step for the site (considered and
  rejected 2026-07-28; React stays island-only via `reactMount`, page
  packages load from the importmap: `gridjs`, `json-formatter-js`,
  `d3-sankey`).
