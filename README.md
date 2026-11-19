# DP-600 Study Lab

A self-contained, local-only study application for **Microsoft DP-600: Implementing
Analytics Solutions Using Microsoft Fabric**. It is built entirely from DP-600
material that already existed in this workspace — no question, answer or
explanation was written for the app.

- **No build step.** Open `index.html` directly (`file://` works).
- **No network calls.** No CDNs, fonts, analytics, accounts or paid services.
- **No original files touched.** Extraction is read-only over the source material;
  it writes only inside this folder.

---

## Run it

Double-click `index.html`, or serve the folder if you prefer a local origin:

```powershell
cd D:\BeUI\dp600-study-lab
python -m http.server 8123
# then open http://127.0.0.1:8123/
```

### Live deployment

The app is published with GitHub Pages from the `main` branch:

**https://amirabdelhamid77.github.io/dp600-study-lab/**

To update it, commit and push; Pages rebuilds automatically. The Litware exhibit
images are bundled under `fabric-additions/` so the deployed copy is self-contained.

Progress, settings, bookmarks and exam history are stored in `localStorage` under
`dp600-study-lab:v1`. Use **Progress → Export** to keep a JSON backup.

---

## What is in the bank

| Measure | Value |
| --- | --- |
| Unique questions | **1,625** |
| Raw source rows inspected | 1,857 |
| Duplicates consolidated | 232 |
| Case studies with text | 80 |
| Note packs / chapters | 27 / 720 |
| Reference URLs | 623 |
| Source files inspected | 35 |

| Domain | Questions |
| --- | --- |
| D1 · Maintain a data analytics solution | 563 |
| D2 · Prepare data | 891 |
| D3 · Implement and manage semantic models | 171 |

| Answer confidence | Questions |
| --- | --- |
| Verified | 10 |
| Documented | 1,361 |
| Source only | 239 |
| Conflicting keys | 5 |
| No answer key | 10 |

Types: 1,234 single choice · 239 multiple choice · 144 hotspot/controls ·
8 ordered sequence.

The full machine-readable audit is in
[`reports/extraction-report.json`](reports/extraction-report.json); the narrative
audit is in [`reports/DISCOVERY_REPORT.md`](reports/DISCOVERY_REPORT.md).

---

## Features

### Dashboard
Blueprint-weighted coverage, readiness estimate, per-domain and per-objective
progress, quick-start practice and exam actions, recent activity and flagged-item
counts.

### Practice
Filter by domain, objective, pack, type, difficulty, answer status and flags;
choose 10/25/50/custom questions or drill one objective. Immediate feedback with
the key, explanation, case study, exhibits and source links. Bookmark, flag, skip,
and resume where you left off. Untimed.

### Exam
Timed, randomised simulation. Defaults: **50 questions / 100 minutes**,
blueprint-weighted (D1 27.5%, D2 47.5%, D3 25%). Question palette, flag-for-review,
answered/unanswered counters, auto-submit at time, and a full results review with
per-domain and per-objective breakdown. No-answer, disputed, visual-dependent and
blocked items are excluded by default (both are opt-in toggles).

### Topics & notes
Official seven-objective coverage with question counts and accuracy, plus the 27
source note packs (720 chapters) with search and one-click practice from a pack.

### Review
Tabs for needs-work, flagged, bookmarked, conflicting keys and missing keys.
Search, filter by domain, and start a targeted practice run from any list.

### Question library
Search the whole bank by stem, option, explanation, ID or source. Filter by
domain/objective/pack/type/status/flag/difficulty/attempt state. Open any question
in a detail drawer with a hidden-until-revealed key and full provenance.

### Progress
Mastery estimate per domain/objective, 12-week activity heatmap, attempt history,
exam results, and JSON export/import/reset. Readiness is a **study estimate**, not
an official Microsoft score.

### Sources & method
Every inspected file, answer-confidence legend, dedupe/remapping method, exclusions,
known limitations and per-pack counts.

---

## Keyboard shortcuts

| Key | Action |
| --- | --- |
| `/` | Focus library search |
| `?` | Shortcut sheet |
| `1`–`9` | Select option N in practice/exam |
| `Enter` | Check answer (practice) / next question |
| `←` `→` | Previous / next question |
| `F` | Flag current question |
| `B` | Bookmark current question |
| `Esc` | Close drawer/overlay/sidebar |

---

## Project layout

```
dp600-study-lab/
├─ index.html                 app shell + inline SVG icon sprite
├─ assets/
│  ├─ app.js                  all application logic (vanilla JS)
│  └─ styles.css              design system, light/dark, responsive
├─ data/
│  └─ bank.js                 generated window.DP600_BANK (questions, cases, notes, sources)
├─ reports/
│  ├─ extraction-report.json  generated audit (counts, sources, flags, exclusions)
│  └─ DISCOVERY_REPORT.md     narrative discovery + verification report
├─ tools/
│  └─ extract.mjs             read-only extraction / dedupe / classification pipeline
└─ README.md
```

`bank.js` is a classic script rather than JSON so the app works from `file://`,
where `fetch` and ES modules are blocked.

---

## Rebuilding the bank

```powershell
cd D:\BeUI\dp600-study-lab
node tools/extract.mjs
```

The pipeline:

1. Reads 27 `content/fabric/questions/*.json` packs, `additions/questions.json`,
   `r11/questions.json`, `records/dp600-questions-2026-10-25.json`, plus
   `packs.json`, `index.json`, `cases.json`, `notes.json` and `sources.json`.
2. Normalises stems/options and remaps answer letters by option **text**, so
   shuffled duplicates do not create false conflicts.
3. Deduplicates exact signatures first, then a conservative fuzzy pass
   (≥96% stem similarity and ≥95% one-to-one option match). Series siblings are
   never fuzzy-merged.
4. Attaches case-study text, classifies the seven official objectives, carries
   source difficulty (1–5) or estimates it (1–3, labelled “Est.”), and records
   flags (missing exhibit, visual-dependent, blocked, disputed, review pending…).
5. Writes only `data/bank.js` and `reports/extraction-report.json`.

---

## Verification summary

- `node --check assets/app.js` passes.
- Bank integrity: 0 duplicate IDs, 0 answer letters missing from options,
  0 option/control/order count mismatches, 0 empty stems; all 35 source paths and
  all image references resolve.
- Browser-tested flows: dashboard, practice (single/multi/sequence/controls,
  missing key, conflict), exam config/timer/flag/palette/submit/results/review,
  library search/filter/drawer/reveal, notes search and pack practice, review
  tabs, progress heatmap/export, settings/theme/font/shortcuts, mobile nav, `/`
  shortcut, exit confirm, import (valid/invalid), reset, and timer auto-submit.
- No console errors observed in the tested flows.
- Source files retain their pre-existing modification times (Oct 25 / Nov 3,
  2026); nothing outside this folder was written.

---

## Known limitations

- **Not an official exam.** Question wording, answers and explanations come from
  third-party/community material. Readiness and percentages are study estimates.
- **85 items** reference screenshots that were not supplied; they are flagged
  visual-dependent and excluded from scored exams by default.
- **239 items** have only an unvalidated community key (“Source only”).
- **5 items** have conflicting source keys; all variants are preserved and the
  most common is shown. They are excluded from scored exams by default.
- **10 items** have no key; they are study-only and never scored.
- **1 item** (`new-litware-4`) refers to a Litware case whose full text was not
  present in the supplied source; it is flagged “Missing case context” and
  excluded from exams by default.
- Topic tags and difficulty are study guidance, not official Microsoft metadata.

---

## Provenance

All source material remains in its original workspace location. This folder is a
derived, read-only study layer. See `reports/DISCOVERY_REPORT.md` for the full
source inventory, exclusions, unresolved conflicts and QA evidence.
