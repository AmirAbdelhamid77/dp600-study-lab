# DP-600 Study Lab — Discovery & Verification Report

**Generated:** 19 November 2026
**Exam:** DP-600 — Implementing Analytics Solutions Using Microsoft Fabric
**Blueprint reference:** Microsoft Learn study guide, as of 19 October 2026
**Application:** `D:\BeUI\dp600-study-lab\`
**Source policy:** read-only. Nothing outside the application folder was modified.

---

## 1. Purpose and scope

The workspace already contained a large, heterogeneous DP-600 corpus: 27 topical
question packs, a consolidated additions bank, a revised R11 review bank, the
original discussion records, 78 case studies, 27 note packs and 623 reference
URLs. The material overlapped heavily, used inconsistent IDs and answer formats,
and mixed validated, community-sourced and keyless items.

This project consolidates that corpus into one searchable local study app. It
does **not** author new questions, answers or explanations. Where the sources were
missing, conflicting, visual-only or unlicensed, the item is preserved and
flagged rather than repaired by invention.

**Out of scope:** hosting, accounts, cloud sync, paid services, third-party
analytics, and any write to the source corpus.

---

## 2. Method

1. **Inventory.** Read the fabric pack metadata, question index, all 27 question
   packs, additions, R11, discussion records, cases, notes, sources and the
   Litware exhibit images.
2. **Normalise.** Convert every item to one schema: `stem`, `scenario`, options
   or controls, answer, explanation, references, source path + locator, case ID,
   difficulty, flags.
3. **Remap keys.** Compare answers by option **text**, not letter. Duplicates that
   shuffle choices therefore keep a correct key instead of producing a false
   conflict.
4. **Deduplicate.** Exact normalised stem + option signature first, then a
   conservative fuzzy pass requiring ≥96% stem similarity and ≥95% one-to-one
   option matching. Series siblings are protected by their “Solution:” line.
5. **Classify.** Use source domain/objective metadata where present; otherwise
   keyword rules aligned to the seven official DP-600 objectives. Difficulty is
   kept from the source (1–5) or estimated (1–3) and labelled “Est.”.
6. **Flag, don’t fix.** Missing keys, conflicting keys, missing exhibits,
   visual-dependent items, blocked sources and unresolved case context are all
   recorded as flags and surfaced in the UI.
7. **Generate.** Write only `data/bank.js` and
   `reports/extraction-report.json`, then build the static app around them.

Reproduce with:

```powershell
cd D:\BeUI\dp600-study-lab
node tools\extract.mjs
```

---

## 3. Sources inspected

35 files were read. Paths are relative to `D:\BeUI\`.

| Source | Kind | Rows |
| --- | --- | ---: |
| `amir-portfolio/content/fabric/packs.json` | pack metadata | 27 |
| `amir-portfolio/content/fabric/index.json` | question metadata | 1,264 |
| `amir-portfolio/content/fabric/cases.json` | case studies | 78 |
| `amir-portfolio/content/fabric/notes.json` | study notes | 27 |
| `amir-portfolio/content/fabric/sources.json` | reference URLs | 623 |
| `amir-portfolio/content/fabric/questions/activator.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/dataflow-gen2.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/delta.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/eventhouse.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/eventstream-windowing.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/howard-dp600.json` | question pack | 120 |
| `amir-portfolio/content/fabric/questions/incremental-copy.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/mirroring.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/notebooks-pyspark.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/patrick-dp600.json` | question pack | 30 |
| `amir-portfolio/content/fabric/questions/pipelines.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/scd.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/semantic-models-dax.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/video06.json` | question pack | 50 |
| `amir-portfolio/content/fabric/questions/video07.json` | question pack | 36 |
| `amir-portfolio/content/fabric/questions/video08.json` | question pack | 48 |
| `amir-portfolio/content/fabric/questions/video09.json` | question pack | 48 |
| `amir-portfolio/content/fabric/questions/video10.json` | question pack | 48 |
| `amir-portfolio/content/fabric/questions/video11.json` | question pack | 50 |
| `amir-portfolio/content/fabric/questions/video12.json` | question pack | 50 |
| `amir-portfolio/content/fabric/questions/video14.json` | question pack | 96 |
| `amir-portfolio/content/fabric/questions/video15.json` | question pack | 56 |
| `amir-portfolio/content/fabric/questions/video16.json` | question pack | 48 |
| `amir-portfolio/content/fabric/questions/video19.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/video20.json` | question pack | 40 |
| `amir-portfolio/content/fabric/questions/video21.json` | question pack | 32 |
| `amir-portfolio/content/fabric/questions/warehouse.json` | question pack | 32 |
| `amir-portfolio/content/fabric/additions/questions.json` | consolidated additions | 452 DP-600 (of 532) |
| `amir-portfolio/content/fabric/r11/questions.json` | revised 222 | 222 |
| `records/dp600-questions-2026-10-25.json` | source discussion bank | 222 |

Additional media checked: `amir-portfolio/public/fabric-additions/litware/images/`
(exhibit files referenced by the Litware case). All image references in the bank
resolve.

---

## 4. Volume accounting

| Stage | Count |
| --- | ---: |
| Pack questions | 1,264 |
| DP-600 additions | 452 |
| R11 rows carrying an answer | 141 |
| **Raw items entering dedupe** | **1,857** |
| Duplicates consolidated | 232 |
| **Unique questions delivered** | **1,625** |

The other 81 R11 rows carry no answer and are folded into their matching
additions item, so they add metadata (review status, aliases) rather than a new
question. The 222 discussion records are used for enrichment (comments, official
answers, page references); they are not counted as separate raw questions.

`1,625 + 232 = 1,857` — no items were dropped silently.

---

## 5. Deduplication and answer remapping

- **Exact pass:** normalised stem (case, punctuation, whitespace) + ordered
  option signature.
- **Fuzzy pass:** ≥96% stem similarity and ≥95% one-to-one option match.
- **Series guard:** items whose stem contains a distinct “Solution:” line are
  never fuzzy-merged; this keeps scenario siblings apart.
- **Key remap:** answers are compared as sets of option **texts**. If a duplicate
  shuffles choices, the key is remapped before comparison. This is why only five
  genuine disagreements remain out of 232 consolidations.
- **Provenance retention:** the surviving item records the duplicate count, all
  aliases and the canonical source path/locator. A duplicate is never simply
  deleted without a trace.

---

## 6. Answer confidence

| Status | Meaning | Count |
| --- | --- | ---: |
| **Verified** | R11 `APPROVED_CORRECTED` — scientifically reviewed and corrected | 10 |
| **Documented** | Answer key supplied with a documentation-backed pack, or R10 `APPROVED` | 1,361 |
| **Source only** | Community/source-supplied key, not independently validated | 239 |
| **Conflicting keys** | Sources disagree; all variants preserved, most common shown | 5 |
| **No answer key** | No key in any supplied source; study-only, never scored | 10 |

The UI repeats the status on every question card, in the library, in practice and
in the detail drawer. “Verified” is the strongest label the source material
supports; it is not an official Microsoft validation.

---

## 7. Blueprint coverage

Official DP-600 domains and weights (as of 2026-10-19):

| Domain | Weight | Questions |
| --- | --- | ---: |
| D1 · Maintain a data analytics solution | 25–30% | 563 |
| D2 · Prepare data | 45–50% | 891 |
| D3 · Implement and manage semantic models | 25–30% | 171 |

| Objective | Questions |
| --- | ---: |
| 1.1 · Implement security and governance | 314 |
| 1.2 · Maintain the analytics development lifecycle | 249 |
| 2.1 · Get data | 492 |
| 2.2 · Transform data | 205 |
| 2.3 · Query and analyze data | 194 |
| 3.1 · Design and build semantic models | 117 |
| 3.2 · Optimize enterprise-scale semantic models | 54 |

The bank is deliberately D2-heavy because the source corpus is. Exam generation
compensates with blueprint weighting (D1 27.5%, D2 47.5%, D3 25%) rather than
sampling the bank uniformly.

**Question types:** 1,234 single choice · 239 multiple choice · 144 hotspot /
controls · 8 ordered sequence.

**Difficulty:** source values 1–5 are preserved where supplied; all other items
carry an estimated 1–3 and are labelled “Est.” in the UI.

---

## 8. Integrity flags

| Flag | Count | Handling |
| --- | ---: | --- |
| `missing-exhibit` | 85 | Screenshots referenced by the source were not supplied; excluded from scored exams by default |
| `visual-dependent` | 85 | Same items; require the missing image to answer fairly |
| `blocked` | 19 | Entire exhibit set unavailable; subset of the 85; excluded by default |
| `review-pending` | 115 | R11 second-pass review not performed; still usable, labelled |
| `conflicting-answers` | 5 | All variants preserved; excluded from scored exams by default |
| `key-mismatch` | 4 | R11 answer differs from the official/record answer; both retained |
| `community-disagreement` | 4 | Source comments dispute the key; same four items as `key-mismatch` |
| `no-answer` | 10 | Study-only; never scored |
| `missing-case` | 1 | Case text absent from the supplied source; excluded by default |

Items can carry more than one flag; counts are per flag, not per question.

---

## 9. Unresolved answer conflicts

Five items remain genuinely disputed after text-based key remapping. The app
shows the most common variant and lists every alternative under “Conflicting
solutions”. All five are excluded from scored exams by default.

| Question | Shown key | Alternative | Alternative source |
| --- | --- | --- | --- |
| `new-json-t1q120` | C | D | `additions/questions.json` → `study-hub:extra:26` |
| `r11:T1Q173` | A | B | `additions/questions.json` → `study-hub:extra:10` |
| `new-json-t1q81` | A | B | `additions/questions.json` → `study-hub:dumps:5` |
| `r11:T1Q215` | D, E | C, D | `additions/questions.json` → `study-hub:extra:8` |
| `r11:T1Q141` | D | A | `additions/questions.json` → `study-hub:extra:14` |

No attempt was made to guess the “correct” answer. The disagreement is the
finding.

---

## 10. Missing answer keys

Ten items have no key in any supplied source. They are presented as study-only
with their explanation and references, and are never scored.

| Question | Source | Locator |
| --- | --- | --- |
| `fb-howard-q1-009` | `questions/howard-dp600.json` | `HOWARD-Q1-009` |
| `fb-howard-q1-020` | `questions/howard-dp600.json` | `HOWARD-Q1-020` |
| `fb-howard-q1-030` | `questions/howard-dp600.json` | `HOWARD-Q1-030` |
| `fb-howard-q2-013` | `questions/howard-dp600.json` | `HOWARD-Q2-013` |
| `fb-howard-q2-028` | `questions/howard-dp600.json` | `HOWARD-Q2-028` |
| `fb-howard-q2-037` | `questions/howard-dp600.json` | `HOWARD-Q2-037` |
| `fb-howard-q2-046` | `questions/howard-dp600.json` | `HOWARD-Q2-046` |
| `fb-howard-q3-011` | `questions/howard-dp600.json` | `HOWARD-Q3-011` |
| `fb-howard-q3-031` | `questions/howard-dp600.json` | `HOWARD-Q3-031` |
| `new-hub-dumps-47-r47` | `additions/questions.json` | `study-hub:dumps:47` |

---

## 11. Missing case context

**`new-litware-4`** refers to the Litware case study (“the data store in the
AnatyticsPOC workspace”). The supplied additions item has an empty
`contextHtml`, and the case text that accompanies the other Litware items does
not contain that workspace detail. The other three Litware items resolve to the
case text.

The item is retained with a **Missing case context** badge, its answer key is
preserved, and it is excluded from scored exams by default. It is not silently
merged with a different case.

Scenario coverage overall: **415 questions** carry scenario/case text; 368 of
372 case-linked items resolved to a case body.

---

## 12. Excluded from the graded bank

These sources were inspected but intentionally not graded. They remain untouched
in the workspace.

| Source | Reason |
| --- | --- |
| `drafts/stark-v2-dp600.json` | 1,213 questions; answer key not shipped (`gradingEnabled=false`), no licence |
| `drafts/chaturcr48-dp600.json` | 71 questions; answer key not shipped |
| `drafts/warren-dp600.json` | 122 questions; answer key not shipped; duplicate of the discussion bank |
| `drafts/dp600-r18.json` | 222 questions; `answersShipped=false` |
| Additions PL-300 subset | 80 questions; adjacent exam, not DP-600 |

No unlicensed or ungradable content was pulled into the app to inflate counts.

---

## 13. Original-file verification

- The extraction pipeline opens source files read-only (`readFileSync`) and its
  only write calls target:
  - `dp600-study-lab/data/bank.js`
  - `dp600-study-lab/reports/extraction-report.json`
- No source file was renamed, moved or deleted.
- Source modification times were unchanged after extraction:

| File | Last write |
| --- | --- |
| `records/dp600-questions-2026-10-25.json` | 25 Oct 2026, 18:28 |
| `amir-portfolio/content/fabric/additions/questions.json` | 3 Nov 2026, 20:29 |
| `amir-portfolio/content/fabric/r11/questions.json` | 3 Nov 2026, 20:29 |
| `amir-portfolio/content/fabric/cases.json` | 3 Nov 2026, 20:29 |
| `amir-portfolio/content/fabric/notes.json` | 3 Nov 2026, 20:29 |
| `amir-portfolio/content/fabric/sources.json` | 3 Nov 2026, 20:29 |

---

## 14. Bank integrity checks

| Check | Result |
| --- | --- |
| Duplicate question IDs | 0 |
| Answer letters missing from their option list | 0 |
| Option / control / order count mismatches | 0 |
| Empty stems | 0 |
| Source paths that do not resolve | 0 |
| Image references that do not resolve | 0 |
| `node --check assets/app.js` | Pass |

---

## 15. Application QA evidence

Manual browser QA was run against the local server
(`http://127.0.0.1:8123/`). Flows exercised:

| Area | Coverage | Result |
| --- | --- | --- |
| Dashboard | stats, domain/objective cards, quick actions, recent activity | PASS |
| Diagnostic | short mixed run, result summary | PASS |
| Practice | single, multi, controls, sequence, missing key, conflict, feedback, bookmark, flag, resume, exit confirm | PASS |
| Exam | config, blueprint weighting, timer, flag, palette, answered/unanswered, submit, results, per-domain review, auto-submit on reload | PASS |
| Library | full-text search, every filter, chips, detail drawer, answer reveal, source links | PASS |
| Topics & notes | blueprint tab, note-pack tab, chapter search, practice from pack | PASS |
| Review | needs-work, flagged, bookmarked, conflicts, missing keys, targeted practice | PASS |
| Progress | mastery, heatmap, history, export, import (valid + invalid), reset (cancel + confirm) | PASS |
| Settings | theme, font size, motion, shortcuts sheet, focus trap | PASS |
| Responsive | mobile nav, “more” sheet, narrow practice/exam layouts | PASS |
| Keyboard | `/`, `?`, `1–9`, `Enter`, arrows, `F`, `B`, `Esc` | PASS |
| Console | no errors observed in the tested flows | PASS |

`file://` is supported because the bank is a classic script
(`window.DP600_BANK`) rather than fetched JSON or an ES module.

---

## 16. Limitations and recommended next steps

1. **Answer quality is source-bound.** 239 items are “Source only”; 5 are
   disputed. Treat them as discussion prompts, not ground truth.
2. **85 visual items cannot be answered faithfully** without the original
   screenshots. They are excluded from exams by default; if the exhibits are
   recovered, add them to the Litware/media folder and re-run extraction.
3. **Readiness is not a Microsoft score.** The app estimates mastery from
   practice accuracy, coverage and recency. Microsoft does not publish a mapping
   from practice accuracy to the scaled exam score.
4. **R11 review is incomplete.** 115 items still carry `review-pending`; the R11
   second pass was not performed in the source material.
5. **One case is incomplete** (`new-litware-4`). Recover the AnatyticsPOC context
   before using that item for scored practice.
6. **No licence audit beyond the source metadata.** Howard is MIT, Patrick is
   CC BY 4.0, the rest are marked Hansa original or source-supplied. This app is
   for local personal study; do not redistribute the question text without
   checking the original terms.
