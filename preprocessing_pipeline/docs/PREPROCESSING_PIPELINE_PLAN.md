# The Preprocessing Pipeline — Master Plan

**Status: PLANNING DOCUMENT ONLY.** Nothing in this document has been built,
executed, or coded. This is a design specification for a pipeline that does not
yet exist — no pipeline code, no crosswalk artifact, no script is produced by
this document or anywhere in `preprocessing_pipeline/` as of this writing. Where
this plan describes a "deliverable artifact," that artifact is a target for a
future build phase, not something created here.

**Grounded in:** Justice's idea document (`new_datasets/Justice's idea.docx`),
Section 5, "Preprocessing Pipeline" — quoted verbatim throughout this plan. That
section's ten steps are the entire subject of this document.

**Explicitly out of scope:** Section 6, "Analytic Methodology" (descriptive
profiling, the evolutionary layer, clustering, external data joins, association
analysis, R&D alignment, intervention-impact estimation) and Section 3.2,
"External datasets (to be acquired)." Both are later phases of Justice's overall
project that depend on this pipeline's output but are not designed here. This
plan stops at the assembled master table (Step 10) and does not take a single
step into what gets done with it afterward.

---

## How to Read This Plan

This is the main document of a six-file set. It synthesizes and sequences the
build; five companion appendices carry the full verification and research
detail that would otherwise make this document unreadable:

| File | Covers | One-line description |
|---|---|---|
| `PREPROCESSING_PIPELINE_PLAN.md` (this file) | All 10 steps | Sequencing, design, dependencies, acceptance criteria |
| `appendix_1_verified_data_facts.md` | All 4 source files | Every number in this plan traces back here |
| `appendix_2_country_iso3_crosswalk.md` | Step 1 | Full 59-row country-to-ISO3 crosswalk |
| `appendix_3_drug_code_crosswalk.md` | Step 4 | Full drug-code/name crosswalk, CDN/DIN resolution |
| `appendix_4_mic_parsing_and_ecv_reference.md` | Steps 5, 7 | MIC parsing design + antifungal ECV reference |
| `appendix_5_identifiability_bounds_methodology.md` | Steps 7, 8 | Manski/partial-identification bounds methodology |

**Epistemic rule this whole set follows, and that any reader extending it
should also follow:** every number in this plan and its appendices is either
(a) counted directly from the four raw source files this session, (b) a
citation from a specific, named published source, or (c) explicitly marked as
a gap, hypothesis, or open decision. Nothing is estimated or invented to fill a
hole. Where verifying Justice's original document turned up a discrepancy, that
discrepancy is documented as a **correction**, not silently absorbed — three
such corrections exist and are listed in Part 2 below.

---

## Part 1: Executive Summary

Justice's project combines three bacterial surveillance cohorts (SOAR
201818, 201910, 207965) and one global fungal surveillance cohort (Vivli/SENTRY)
to study the relationship between antimicrobial resistance and life expectancy,
across both bacterial and fungal pathogens. Before any of that analysis can
happen, the four files have to become one file — and right now they cannot be
joined or compared as received, for reasons that are mechanical, not
conceptual: they use different country-name spellings, different date
encodings, different organism-naming schemes, different drug-code systems,
different MIC-censoring notation, and — most consequentially — two of the four
files have large, structurally non-random gaps in exactly the fields a naive
analysis would use to compute a resistance rate.

Justice's Section 5 lays out ten sequential steps to fix this, each with its
own Issue/Action/Check. This plan takes each of those ten steps and expands it
into something a developer could actually start building from: a concrete
design, a named deliverable artifact, an executable (not just descriptive)
check, explicit dependencies on other steps, and an honest list of what is
still unresolved. It also re-verifies every specific number Justice's original
document cites against the four raw files directly — this went well: six of
seven checked claim-clusters were fully confirmed as originally stated, and the
three discrepancies found are small, are documented precisely (Part 2), and
change no step's fundamental design.

**What this plan produces:** a build-ready design for all ten steps, a
proposed repository layout for the artifacts they produce, an explicit
execution-model recommendation (tech stack, orchestration, versioning, and
failure-handling — Part 5), a dependency graph showing what can be built in
parallel versus what has to wait, a consolidated master-table schema
reference (Part 8), and a single consolidated list of every open question
that needs a team decision or further research before or during
implementation.

**What remains genuinely unresolved — stated here, not hidden until Part 10:**
one drug code (`DIN` in SOAR 201910) has no confirmed identity and must be
excluded from cross-cohort comparison until the original GSK data dictionary
is located; the antifungal ECV (epidemiological cutoff value) reference table
in Appendix 4 covers only 5 of SENTRY's 200 species and is missing several
cells even for those 5 (notably *C. tropicalis*, itself a top-5-by-volume
species, has no ECV coverage at all); the per-drug tested-dilution-range
dictionary needed to fully validate Step 5's MIC parsing was not available this
session; and several fields (SOAR's continuous age column, SOAR 201910's
Betalactamase breakdown, most of SENTRY's per-country and per-species counts)
were never independently re-verified this session and should not be assumed
correct until they are. None of these gaps block starting the build — they
block specific downstream numbers from being called final.

---

## Part 2: Source File Inventory

All four figures below were counted directly from the raw files this session
(Appendix 1 is the full record; only headline numbers are repeated here).

| Cohort | Rows × Cols | Years | Countries | Organisms | Drug columns | MIC notation |
|---|---|---|---|---|---|---|
| SOAR 201818 | 2,413 × 24 | 2014–2016 | 9, all Europe | 2 (S. pneumoniae, H. influenzae) | 13, full names | `<=` |
| SOAR 201910 | 2,318 × 26 | 2015–2018 | 18 | 4 (+ H. influenzae, S. pneumoniae, E. coli, K. pneumoniae) | 17, abbreviated codes | `</=` |
| SOAR 207965 | 3,134 × 37 | 2018–2021 | 10 | 59 distinct values (predominantly H. influenzae + S. pneumoniae, 81.0%) | 21, full names | `<` |
| Vivli/SENTRY | 26,922 × 30 | 2010–2024 | 44 | 200 distinct species | 10 antifungals × 2 columns (MIC + CLSI category) | n/a (float MIC; comparator notation not verified this session — Appendix 4 §A.3) |

Bacterial isolate total: 2,413 + 2,318 + 3,134 = **7,865** — matches Justice's
Section 7 "~7,865 bacterial" figure exactly. Combined with SENTRY's 26,922,
the full four-file total is 34,787, matching his "~34,800." **Both figures are
raw, pre-exclusion isolate counts** — they will not equal the row count of the
final analysis-ready master table once Step 3 (organism exclusions), Step 6
(evaluability exclusions), and Step 10 (dedup) are applied. This plan
distinguishes "raw isolate count" from "analysis-ready isolate count"
throughout; the two should never be silently conflated in a report.

One data-provenance quirk worth carrying forward: SOAR 201910's Excel sheet is
internally named `"3550 valid MIC data (2)"`, a legacy label — the sheet
actually contains 2,318 rows, not 3,550. Flag this to the team as a naming
artifact if anyone encounters the raw file directly; do not "correct" the row
count to 3,550 anywhere.

### Three corrections to Justice's original document

Verifying Section 5's claims directly against the four raw files confirmed the
substance of Justice's document almost entirely — but found three specific,
worth-documenting discrepancies. Full detail and supporting numbers are in
Appendix 1; summarized here:

1. **SOAR 201910's regional composition.** Table 2 of Justice's document
   narrates the 15 non-Latin-American countries in this cohort as sitting in
   "the Middle East and Asia," naming Turkey, Vietnam, Pakistan, Saudi Arabia,
   Kuwait, Cambodia, and the Philippines — but never enumerates that 5 of the
   18 countries are actually African (Kenya 44 rows, Tunisia 153, Morocco 23,
   Nigeria 4, Ghana 2), even though the word "Africa" does appear once in the
   cohort's one-line summary table elsewhere in his document. Ghana and
   Nigeria, at 2 and 4 rows respectively, are the thinnest country groups in
   the entire cohort — any Ghana-specific or West-Africa-specific claim drawn
   from this cohort alone rests on an extremely small base and must be labeled
   as such wherever it is used downstream, including in this project's own
   reporting.
2. **SOAR 207965's drug-column count.** Justice's document states 20 distinct
   antibiotics; the raw file has 21 columns. The extra column,
   "Amoxicillin Clavulanate fixed at 2," is a dosing/breakpoint variant of
   Amoxicillin Clavulanate, not a 21st distinct drug — so "20 distinct
   antibiotics" is defensible in substance, but any Step 4/7 implementation
   iterating over raw columns must handle 21, with an explicit rule for the
   variant (Appendix 3 §3.2), not silently assume 20.
3. **SENTRY's clinical-service breakdown.** Justice's document attributes the
   ICU/hematology-oncology/surgery/internal-medicine breakdown to "the
   specimen-source column." Verification found this actually lives in a
   separate column, `Speciality` (clinical service/ward) — the specimen-type
   column is literally named `Source` (55.32% Blood culture, matching his
   "~55%" figure) and is a different field entirely. Both of Justice's cited
   figures are individually correct; they describe two different columns that
   must not be conflated in the master schema.

None of these three corrections change Section 5's design in a way that alters
a step's fundamental approach — they change specific numbers and add explicit
handling rules, both reflected in the step write-ups in Part 6.

---

## Part 3: Design Principles

These principles are not new inventions — each is either stated directly in
Justice's own Section 5 text or follows mechanically from the verified facts.
Restating them once, up front, means every step write-up in Part 6 can invoke
them by name instead of re-justifying the same choice ten times.

1. **Every crosswalk is a versioned artifact, never inline code.** Justice's
   own Action for both Step 1 (country) and Step 4 (drug code) states this
   explicitly. It applies equally to Step 3's organism crosswalk, which his
   text does not use the word "versioned" for but which has the identical
   structure (raw string → canonical value, with provisional/unresolved
   entries that need to survive a future correction without breaking
   reproducibility).
2. **Nothing downstream depends on an unverified upstream transform.**
   Justice's own framing for Section 5 as a whole: "sequenced so each one
   produces a checkable, reproducible output before the next step runs." Part
   6's dependency graph makes this literal.
3. **Exclusions are counted and logged, never silently dropped.** Stated
   directly in Step 3's Check and Step 6's Action; applied in this plan to
   every step that removes or sets aside a row (Steps 3, 6, and the dedup half
   of Step 10).
4. **Where identifiability is structurally limited, report a range and its
   assumption — never a bare point estimate.** Stated directly for Step 8
   (beta-lactamase) and Step 7 (breakpoint-absent antifungals); this plan
   treats it as one methodology (Appendix 5), applied to two fields, rather
   than two unrelated problems.
5. **Breakpoint/ECV classification runs per cohort before merging.** Stated
   directly in Step 7's Action, to avoid a breakpoint-version mismatch being
   silently averaged away across cohorts collected years apart.
6. **A provisional or unresolved mapping is labeled as such and carried
   forward — never silently promoted to fact.** This governs `CDN` (provisional
   — see Appendix 3 §2.2) and `DIN` (unresolved — Appendix 3 §2.3) in Step 4,
   and the confidence flags on `Korea`, `Hong Kong`, `Taiwan`, and the
   `Slovak Republic`/`Slovakia` and `UK`/`Scotland` collisions in Step 1
   (Appendix 2 §3–§4).
7. **Preserve raw values as passthrough fields even after deriving a
   canonical one.** Not stated as a single rule anywhere in Justice's text, but
   applied consistently across his individual step Actions (retain
   `OriginalOrganismName` alongside `FinalOrganismName`; keep continuous age
   alongside the derived age band) — this plan makes it explicit and general:
   any time a step derives a canonical/binned/normalized value, the raw
   input value is retained in the master schema, not discarded. The cost of
   keeping it is zero; the cost of losing it irreversibly is a real, recurring
   risk this plan does not want to reintroduce even once.
8. **A downstream reporting rule is not the same thing as a preprocessing
   transformation, even when the two get discussed in the same breath.** Steps
   6 and 8 both work this way: Step 6 does not delete non-evaluable isolates,
   it tags them so a later rate computation can exclude them from a
   denominator; Step 8 does not add a new column to every isolate, it defines
   how a downstream consumer must compute a bounded prevalence from the raw
   Beta Lactamase field the master table already carries. This plan treats
   "tag and pass through" and "transform now" as two distinct kinds of step,
   and is explicit in Part 6 about which is which.

---

## Part 4: Proposed Repository Layout (Future State — Not Created by This Plan)

Justice's own Action for Step 1 ("maintain the crosswalk as its own versioned
artifact, not an inline transformation buried in analysis code") implies a
directory structure, not just a rule. The layout below is a proposal for the
eventual build phase — **none of these folders are created as part of this
planning task**; only `docs/` (containing this plan and its five appendices)
exists today.

```
preprocessing_pipeline/
├── docs/                         (exists today)
│   ├── PREPROCESSING_PIPELINE_PLAN.md   (this file)
│   ├── appendix_1_verified_data_facts.md
│   ├── appendix_2_country_iso3_crosswalk.md
│   ├── appendix_3_drug_code_crosswalk.md
│   ├── appendix_4_mic_parsing_and_ecv_reference.md
│   ├── appendix_5_identifiability_bounds_methodology.md
│   └── _justice_idea_raw_dump.txt        (verbatim source extract)
│
├── crosswalks/                   (future — one versioned file per Step 1/3/4 artifact)
│   ├── country_iso3_crosswalk_v1.csv
│   ├── organism_crosswalk_v1.csv
│   └── drug_code_crosswalk_v1.csv
│
├── exceptions/                   (future — logged, never-silently-dropped exclusions)
│   ├── organism_exclusions_log.csv      (Step 3: No Growth, contaminants, cross-domain isolates)
│   ├── evaluability_exclusions_log.csv  (Step 6: SOAR 207965 Evaluable = N)
│   └── dedup_review_log.csv             (Step 10: Vietnam/2018 + Ukraine/2016 boundary check)
│
├── bounds/                        (future — identifiability-bound computations, Appendix 5)
│   ├── beta_lactamase_bounds.csv
│   └── antifungal_ecv_classification.csv
│
├── master/                        (future — Step 10 output)
│   └── master_table_v1.parquet (or .csv)  (long format, one row per isolate–drug pair)
│
└── src/                            (future — one script per step, e.g. step01_country.py; see Part 5)
```

---

## Part 5: System Architecture & Execution Model

Parts 1–4 describe what the four source files contain and why they need
fixing. Part 6 describes each transformation's own logic. Neither addresses
the operational layer underneath all ten steps: what language and tools build
this in, what actually runs the ten steps in order, how a "versioned artifact"
(Design Principle 1) becomes concrete instead of just a naming gesture, what
happens on a re-run, and what happens when a step's input is missing or stale.
None of this is specified anywhere in Justice's own Section 5 text, which
addresses data logic, not build mechanics — everything in this part is this
plan's own addition. It is written as a **recommendation the implementing team
can confirm or override**, not a directive; nothing in Parts 1–4, 6, or 7
depends on any specific choice made here, only on the transformation logic
those parts describe being implemented faithfully.

**Scale and non-functional requirements.** The full four-file dataset is
34,787 raw isolate rows (Part 2) across at most 37 columns. Every one of the
ten steps is therefore a batch, single-machine, in-memory operation — nothing
in this pipeline's data volume justifies distributed processing, streaming
infrastructure, or a database backend. A full ten-step run, including
row-by-row MIC parsing and breakpoint/ECV lookups, should take seconds to low
minutes on ordinary hardware. This plan explicitly recommends against
over-engineering the execution model for a scale this pipeline does not have;
the risk this pipeline actually faces is data-correctness risk (Part 10), not
performance risk.

**Recommended technology stack.** Python 3.x with pandas — already the
implicit assumption behind Step 2's design, which reasons directly in terms of
"the Python/pandas runtime type of each cell." This plan makes that assumption
an explicit, named recommendation rather than leaving it as an incidental
aside inside one step. Reasons: (a) pandas' native Excel/CSV readers are what
surface the mixed-type cells Step 2's parser is designed around; (b) the data
volume above needs no performance-oriented alternative (polars, Spark, a
database); (c) the crosswalk/lookup-table pattern used in Steps 1, 3, 4, and 7
is a native fit for `dict`-based mapping and `pd.merge`. A team free to choose
otherwise loses nothing described in this plan except this specific
convenience.

**Orchestration and execution model.** Given the scale above and Part 7's
dependency graph having only four tiers, this plan recommends against a
full workflow-orchestration framework (Airflow, Prefect, Dagster, etc.) —
that class of tool solves problems (distributed scheduling, retries across
long-running distributed tasks, monitoring dashboards for recurring jobs) this
pipeline does not have, and adopting one would add operational surface area
with no corresponding benefit. Recommended instead: one script per step
(e.g. `src/step01_country.py` … `src/step10_master_assembly.py`, matching
Part 4's proposed `src/` layout), plus a single top-level runner (a Makefile
or a short `run_pipeline.py`) that executes them in Part 7's Tier A → B → C →
D order and halts on the first failed step's Check rather than continuing
past it. This keeps each step independently runnable and testable in
isolation — a developer can re-run just Step 4 on its own — while the runner
still enforces dependency order for a full build.

**Versioning mechanics.** Design Principle 1 ("every crosswalk is a versioned
artifact") and the `_v1` filename suffixes already used throughout Part 4's
proposed layout need an explicit, concrete convention, or "versioned" remains
a naming gesture rather than an operational guarantee. Recommended convention:
(a) every crosswalk, exceptions-log, and bounds file's filename carries an
integer version suffix (`_v1`, `_v2`, …); (b) every such file's own rows carry
`version` and `date_added` columns — already proposed for the drug-code
crosswalk specifically in Step 4's Deliverable; this plan extends that same
pattern to every versioned artifact, not just that one; (c) a version bump is
triggered only by a content change with a downstream effect (`DIN`'s eventual
resolution, a corrected Ukraine/2016 dedup finding), never by a cosmetic edit;
(d) old versions are never deleted, only superseded, so any analysis already
built against `_v1` stays reproducible after `_v2` exists — this is what
Pipeline-Level Acceptance Criterion 7 (Part 9) actually depends on to be
checkable.

**Idempotency and re-run semantics.** Given the scale above, this plan
recommends a **full-rebuild model**: every step, when re-run, regenerates its
output from scratch from its declared upstream inputs, rather than attempting
an incremental or partial update. This avoids an entire class of
incremental-consistency bugs — stale partial state, a forgotten downstream
re-run after an upstream correction — that no performance benefit at this data
volume would justify taking on. Concretely: once `DIN` (Step 4) is eventually
resolved, the recommended response is to re-run Step 4 and every step
downstream of it (5, 7, 10, per Part 7's graph) in full, not to patch the
master table in place.

**Failure-handling policy (pipeline-execution level).** This is distinct from
the per-step data-quality exception logs Part 6 already specifies in detail
(the organism-exclusions log, the parse-failure log, the evaluability-
exclusions log, and so on) — those record what happens to a *row* that fails a
data check. This is about what happens to the *pipeline* when a declared
upstream *artifact* is missing or unexpected: the runner should hard-stop with
a specific, named error if a step's declared input (a crosswalk file, an
exceptions log) is absent or does not match the version that step expects —
never proceed silently on a missing or stale input. This is the operational
enforcement mechanism for Design Principle 2 ("nothing downstream depends on
an unverified upstream transform"): Principle 2 states the correctness
requirement; this section makes it something the orchestration layer enforces
automatically rather than a convention developers are trusted to follow by
hand.

**Data governance note.** All four source files are laboratory isolate
surveillance records — country, year, organism, drug, MIC, and, for the three
SOAR cohorts, patient age/sex metadata at the isolate level (Appendix 1) — not
records documented anywhere in this plan as carrying direct patient
identifiers. This plan has not independently re-verified that absence beyond
what Appendix 1's schema descriptions already show, and recommends the team
confirm it against each cohort's original data-use agreement before any
derived file — including this pipeline's own master table — is shared beyond
the immediate research team, particularly given this project's public
data-challenge context.

**Audience and ownership.** This plan, and the pipeline it describes, are
built for the Ghana AMR research team as the implementing group. No per-step
ownership assignment is made here — that is a team-internal staffing decision
outside this plan's scope — but Part 7's Tier-A grouping (Steps 1, 2, 3, 4, 6,
9) is structured so those six steps can be assigned to different people and
built simultaneously if the team wants to parallelize implementation effort.

---

## Part 6: The Ten Steps

Each step below follows the same structure: Justice's verbatim Issue/Action/Check,
a restatement of the Issue grounded in this session's verified facts, a concrete
design/approach, the deliverable artifact(s), an expanded and executable Check,
this step's dependencies on other steps, and its open risks.

---

### Step 1 — Country-name harmonization

> **Issue.** Country names differ across datasets in ways that will silently
> break any join to external life-expectancy or R&D data — e.g. "Slovak
> Republic" (SOAR 201818) vs. "Slovakia" (SENTRY); "UK" (SENTRY) vs. the full
> name used by World Bank/WHO sources. Further mismatches are likely once
> joined against WDI/WHO country lists.
>
> **Action.** Build a single country-name crosswalk mapping every raw country
> string in all four files — and, later, every external source — to
> ISO 3166-1 alpha-3 codes. Maintain the crosswalk as its own versioned
> artifact, not an inline transformation buried in analysis code.
>
> **Check.** Every distinct country string across all four files resolves to
> exactly one ISO3 code; no code maps back to more than one canonical name.

**Verified grounding.** 59 distinct raw country strings exist across all four
files (30 across the three SOAR cohorts combined, the remaining 29 attributable
to SENTRY — Appendix 2 §1). Two legitimate many-to-one collisions exist:
`Slovak Republic`/`Slovakia` → `SVK`, and `UK`/`Scotland` → `GBR`. Three
mappings carry an explicit, stated assumption rather than being unambiguous:
`Korea` (resolved to Republic of Korea, not DPRK), `Hong Kong`, and `Taiwan`
(both non-UN-member-state codes, used here as standard surveillance-data
identifiers, not political statements). The full 59-row table, its sourcing
methodology, and the precise restatement of this step's Check (a literal
reading of "no code maps back to more than one canonical name" would wrongly
flag the two legitimate collisions as failures) all live in Appendix 2.

**Design/Approach.** Adopt Appendix 2's crosswalk table as the source of truth
for this step's artifact. The key design decision Appendix 2 makes explicit is
that Justice's Check, read literally, is too strict: two raw strings correctly
collapsing onto the same ISO3 code is successful harmonization, not a defect.
The operative check is therefore: (a) no raw string is ambiguous (never maps to
two different codes), and (b) any string not resolved at high confidence
carries an explicit flag and reason. For the `UK`/`Scotland` collision
specifically, this plan recommends (Appendix 2 §3, Collision 2) collapsing to
`GBR` for the canonical ISO3 field while also carrying a passthrough
`raw_country_original` field into the Step 10 master table, per Design
Principle 7 — this is a recommendation, not a final decision; it is properly a
Step 10 master-schema question and is listed again in Part 10.

**Deliverable.** `crosswalks/country_iso3_crosswalk_v1.csv`, one row per raw
string, with fields `raw_string`, `iso3`, `canonical_name`, `confidence`
(`high`/`flagged`), `source_cohort`, `note` (Appendix 2 §7 gives the full field
spec).

**Check (expanded).** (a) All 59 raw strings resolve to exactly one ISO3 code
each — no raw string appears twice with two different codes. (b) Every row not
at `high` confidence carries a named reason (Korea/Hong Kong/Taiwan/Scotland —
4 rows). (c) The resulting distinct-ISO3-code count is 57 (59 raw strings minus
2 many-to-one collapses) — a specific, checkable arithmetic identity that
should be asserted directly against the built artifact, not just eyeballed.

**Dependencies.** None — this step needs only the raw country columns, which
already exist in all four files.

**Open risks.** 29 of the 59 raw strings (all SENTRY-attributed) were assigned
to SENTRY by set-arithmetic elimination this session, not by re-opening the raw
SENTRY country column directly (Appendix 2 §1) — re-verify before relying on
this attribution for anything beyond the ISO3 mapping itself. The `UK`/
`Scotland` passthrough-field decision is unresolved (Appendix 2 §3, §8 gap 4).

---

### Step 2 — Date and year parsing

> **Issue.** SOAR 201910's Collection Date column mixes three formats in the
> same column: Excel datetime objects, text dates such as "15-Dec-16", and
> plain four-digit years stored as integers (e.g. 2017). Treating those
> integers as Excel serial dates — a natural first guess — silently produces
> nonsense years such as 1905.
>
> **Action.** Parse each value according to its actual type: datetime objects
> use the year directly; text dates parse via day-month-year or month-year
> patterns; integer values already in the 1900–2100 range are taken as
> literal years, not Excel serial dates.
>
> **Check.** Parsed year range for every cohort falls inside that cohort's
> documented collection window (2014–2021 across the three SOAR files); no
> parsed year falls outside 2000–2025.

**Verified grounding.** The three-way type mix in SOAR 201910's Collection Date
column is directly confirmed: 963 rows hold a string in `DD-Mon-YY` format
(example: `"15-Dec-16"`), 936 rows hold a native datetime object, and 419 rows
hold a plain integer in `{2015, 2016, 2017, 2018}`. One row's value could not be
parsed into a year at all. Naively applying an Excel-serial-date conversion to
the 419 integer values was directly tested this session and confirmed to
produce nonsense dates clustered around 1905-07-07 through 1905-07-10 — this is
a real, reproduced failure mode, not a hypothetical one (Appendix 1 §2).

**Design/Approach.** A type-dispatch parser, branching on the Python/pandas
runtime type of each cell rather than applying one blanket string or numeric
parser to the whole column: datetime objects → take `.year` directly; strings →
parse against the confirmed `%d-%b-%y` pattern first; integers/floats in
`[1900, 2100]` → take as a literal year; integers/floats outside that range, or
values that fail every pattern above → route to a parse-failure exceptions log
rather than guessing. This directly targets the confirmed failure mode: an
integer value is never passed through an Excel-serial-date conversion.

**Deliverable.** A `parsed_year` field per row, paired with a `date_parse_status`
audit field (`clean_datetime` / `clean_string` / `clean_integer` / `unparseable`),
plus an entry in the exceptions log for every `unparseable` row.

**Check (expanded).** (a) Every parsed year falls within `[2000, 2025]` — a hard
outer bound. (b) Every parsed year additionally falls within its own cohort's
documented window (201818: 2014–2016; 201910: 2015–2018; 207965: 2018–2021;
SENTRY: 2010–2024 — note SENTRY's window is wider than the 2000–2025 outer
bound only in the sense that it's a subset, so this is consistent). (c) A
specific regression check: zero rows where a value that was a plain 4-digit
integer in the raw file is present in the parsed output as anything other than
that same literal year (i.e., a direct, automated re-check that the nonsense-
1905 failure mode does not recur). (d) The one confirmed `unparseable` row from
SOAR 201910 appears in the exceptions log with a specific reason recorded, not
silently absent from any row count.

**Dependencies.** None.

**Open risks.** This session confirmed the three-format mixing problem
specifically for SOAR 201910. Whether SOAR 201818's and SOAR 207965's date
columns are single-format/clean, or share the same mixing problem, was **not**
independently checked this session — only their year *ranges* were verified
(Appendix 1 §1, §3), not the underlying column's type homogeneity. Do not
assume a simpler single-format parser is sufficient for those two cohorts until
checked; the type-dispatch design above is defensive enough to handle either
case, but this should be confirmed empirically, not assumed, before the parser
is simplified for those cohorts.

---

### Step 3 — Organism-name harmonization

> **Issue.** SOAR 207965 separates OriginalOrganismName from
> FinalOrganismName and includes a long tail of roughly 55 additional species
> and quality categories beyond the two primary pathogens, including
> environmental and skin-flora organisms (e.g. Micrococcus luteus, Bacillus
> species) and at least one yeast isolate (Naganishia liquefaciens) that does
> not belong in either the bacterial or the fungal analysis arm as currently
> scoped. SOAR 201818 and 201910 carry sparser organism metadata by comparison.
>
> **Action.** Map every organism string to a canonical species name. Exclude
> isolates flagged "No Growth" and clear environmental/contaminant genera from
> the resistance analysis. Route any genuinely fungal isolate found inside a
> bacterial file to a documented exceptions list rather than discarding it.
>
> **Check.** Every retained isolate maps to a named species or an explicit
> "unidentified pathogen" category; excluded isolates are counted and logged,
> not silently dropped.

**Verified grounding.** SOAR 207965 carries 59 distinct `FinalOrganismName`
values (Justice's "roughly 55" is a close, defensible approximation, not a
correction-worthy error given it was already hedged). Confirmed present in the
long tail: *Micrococcus luteus* (11 rows), several *Bacillus*/*Paenibacillus*
genus entries, exactly one row of *Naganishia liquefaciens* (a yeast), "Unknown"
(220 rows), "No Growth" (1 row), and 20 null rows. One genuinely fungal isolate
Justice's text does **not** name is also present: *Microsporum canis*, a
dermatophyte fungus — his text mentions only *Naganishia liquefaciens* as "at
least one yeast isolate," which is accurate as far as it goes but incomplete;
there are at least two non-bacterial isolates in this file, not one.
`OriginalOrganismName` and `FinalOrganismName` differ in 620 of 3,134 rows
(19.8%), consistent with `FinalOrganismName` being a lab-adjudicated
reclassification of the original field (Appendix 1 §3). SOAR 201818 and 201910
carry only 2 and 4 organism values respectively, all clean canonical-looking
species names with no long tail — this step's real complexity is entirely
concentrated in SOAR 207965.

**Design/Approach.** Five explicit decision rules, since Justice's Action is
directive but not fully mechanical against the specific categories found:

1. `"No Growth"` (1 row) → hard exclude; not a pathogen at all.
2. Environmental/skin-flora/contaminant genera (*Micrococcus luteus*,
   *Bacillus*/*Paenibacillus* spp.) → exclude from the resistance analysis per
   Justice's Action, routed to the organism exceptions log per his Check — never
   deleted outright.
3. Genuinely fungal isolates found inside a bacterial file (*Naganishia
   liquefaciens*, *Microsporum canis*) → per Justice's Action, route to the
   exceptions list rather than discard. In practice this means excluding them
   from **both** analysis arms, not attempting to fold them into the SENTRY
   fungal arm: SOAR 207965 only tested the bacterial drug panel against these
   isolates, so there is no antifungal MIC data to classify them against even
   if they were merged with SENTRY. The exceptions log entry should say this
   explicitly (wrong drug panel tested, not just wrong file), so a future
   reader does not wonder why a fungal isolate wasn't merged into the fungal
   cohort.
4. `"Unknown"` (220 rows) → maps to Justice's own explicit **"unidentified
   pathogen"** category and is **retained**, not excluded. This is a
   distinction the pipeline must get right: an isolate of uncertain species is
   not the same thing as an isolate excluded from analysis, and Justice's Check
   text treats them as two different buckets ("maps to a named species **or**
   an explicit 'unidentified pathogen' category; excluded isolates are counted
   and logged" — "unidentified pathogen" is not listed as an exclusion
   category).
5. The 20 null `FinalOrganismName` rows → an open decision, not resolved by
   Justice's text: should a null (field never populated) be folded into the
   same "unidentified pathogen" bucket as the explicit string `"Unknown"`, or
   does the absence of any identification attempt warrant a stricter,
   separate handling? Listed as an open item in Part 10.

`FinalOrganismName` is used as the authoritative source for the canonical
mapping (not `OriginalOrganismName`, per its role as the lab-adjudicated
value), but `OriginalOrganismName` is retained as a passthrough audit field per
Design Principle 7.

**Deliverable.** `crosswalks/organism_crosswalk_v1.csv` (raw string → canonical
species name, or one of the two sentinel categories `unidentified_pathogen` /
`excluded`), plus `exceptions/organism_exclusions_log.csv` recording every
excluded isolate's cohort, row identifier, raw organism value, and exclusion
reason (No Growth / environmental-contaminant / cross-domain-fungal-in-
bacterial-file).

**Check (expanded).** (a) Every one of the distinct raw organism strings across
all three bacterial cohorts resolves to exactly one of: a canonical species
name, `unidentified_pathogen`, or a logged exclusion. (b) The exclusions log's
row count reconciles exactly against (raw cohort row count) − (retained,
analysis-ready row count) for every cohort — no isolate is silently unaccounted
for in neither the retained table nor the log. (c) `Microsporum canis` isolates
are confirmed present in the exceptions log with the cross-domain reason
recorded, not merely absorbed into the general "other species" long tail
without comment.

**Dependencies.** None to start, but its output (canonical organism, pathogen
type, and the exclusion list) is a hard prerequisite for Steps 7, 8, and 10 —
see Part 7.

**Open risks.** The null-vs-`"Unknown"` handling decision (rule 5 above) is
unresolved. Whether SOAR 201818's and 201910's small organism sets need any
crosswalk work beyond trivial normalization has not been separately stress-
tested, though the verified facts suggest they are low-risk.

---

### Step 4 — Antibiotic and antifungal code crosswalk

> **Issue.** SOAR 201910 uses 17 abbreviated drug codes where 201818 and
> 207965 use full names. Fifteen resolve cleanly against the shared drug panel
> (AMC, AMP, AMX, AXO, AZM, CEC, CLA, CXM, ERY, FIX, LEV, MXF, PEN, POD, SXT).
> CDN most likely maps to cefdinir, matching a drug name present in 207965's
> panel, but this should still be confirmed against the original SOAR data
> dictionary rather than assumed. DIN has no clear counterpart in any of the
> three full-name panels and is currently unresolved.
>
> **Action.** Build and version a drug-code crosswalk table. Mark CDN as
> provisional and DIN as unresolved pending the original data dictionary.
> Exclude DIN from any cross-cohort drug-level comparison until resolved.
>
> **Check.** Every code in 201910 maps to a name or is explicitly flagged
> unresolved; no analysis step silently treats an unresolved code as a real
> measurement.

**Verified grounding.** Appendix 3 builds the full crosswalk: SOAR 201818's 13
full drug names are the canonical baseline (no mapping needed). SOAR 201910's
17 codes split into 15 high-confidence resolutions, 1 provisional (`CDN` →
cefdinir), and 1 unresolved (`DIN`). SOAR 207965's 21 columns resolve to 20
distinct canonical drugs (one column, "Amoxicillin Clavulanate fixed at 2," is
a dosing variant of Amoxicillin Clavulanate, not a 21st drug — Correction 2,
Part 2). Across all three SOAR cohorts: **16 canonical drugs are shared by at
least two cohorts, 13 of which are shared by all three**; 4 more are tested in
SOAR 207965 only (cefotaxime, ceftibuten, doxycycline, tetracycline); 16 + 4 =
20 distinct canonical antibacterial drugs total, consistent with SOAR 207965
alone covering all 20 (Appendix 3 §4). `DIN` is excluded from this count
entirely, per Justice's own instruction — it is not yet known to be any of
the 20.

**Design/Approach.** Adopt Appendix 3's crosswalk directly. `CDN`'s
provisional status rests on strong internal cross-cohort evidence (SOAR
207965 has a column literally named "Cefdinir," and cefdinir is independently
confirmed via published SOAR-series literature as a real drug tested in this
study family) but no direct GSK data-dictionary confirmation — it must carry
the "provisional" tag through every downstream use, never silently promoted to
settled fact. `DIN` has a stated, explicitly-labeled **hypothesis** (doxycycline
or tetracycline, based on those two drugs being new to SOAR 207965's panel and
not resolvable any other way) but this is not evidence strong enough to map
it — DIN must be carried in the crosswalk artifact with
`canonical_drug = UNRESOLVED` and `exclude_from_cross_cohort_comparison = TRUE`,
never dropped from the source data and never guessed into one of the two
hypothesis drugs. Separately, the "Amoxicillin Clavulanate fixed at 2" dosing
variant needs its own field (`dosing_variant`) in the master schema so its
measurements are preserved as distinct isolate-drug rows rather than being
averaged or silently collapsed with the standard-dose column (Appendix 3 §3.2)
— any cross-cohort amoxicillin/clavulanate comparison must state explicitly
which SOAR 207965 variant is being compared, since 201818 and 201910 only ever
carry the standard-dose measurement.

**Deliverable.** `crosswalks/drug_code_crosswalk_v1.csv`, one row per raw
identifier per cohort, with fields `cohort_id`, `raw_identifier`,
`raw_identifier_kind`, `canonical_drug`, `resolution_status`
(`resolved`/`provisional`/`unresolved`), `basis`, `dosing_or_breakpoint_variant`,
`exclude_from_cross_cohort_comparison` (Appendix 3 §7 gives the full field
spec).

**Check (expanded).** (a) All 17 SOAR 201910 codes appear in the crosswalk with
a `resolution_status` of `resolved`, `provisional`, or `unresolved` — none
silently absent. (b) `DIN` carries `exclude_from_cross_cohort_comparison = TRUE`
and is verified absent from both the 16-shared-drug table and the 4-cohort-
exclusive-drug table (Appendix 3 §4.1–§4.2) — i.e., a direct check that no
downstream join accidentally treats DIN as if it were one of the 20 resolved
drugs. (c) SOAR 207965's 21 raw columns map to exactly 20 distinct
`canonical_drug` values once the dosing-variant tag is applied, and the two
Amoxicillin Clavulanate columns are confirmed to produce two separate rows
(not one averaged row) in any test extraction from the master schema.

**Dependencies.** None to build the crosswalk itself. Its output is a hard
prerequisite for Step 5 (per-drug MIC-range validation) and Step 7
(organism–drug breakpoint/ECV lookup) — see Part 7.

**Open risks.** `DIN` remains genuinely unresolved; obtaining the original GSK
SOAR data dictionary is the only path to closing it, and this plan does not
have that dictionary. `CDN`'s provisional tag should not be dropped absent the
same dictionary, even though the internal evidence is strong.

---

### Step 5 — MIC notation normalization

> **Issue.** Three different MIC notations are in live use across the three
> SOAR files: "<=0.06" (201818), "</= 0.06" (201910), and "<0.008" (207965).
> Left unparsed, these will not compare or aggregate correctly even after
> breakpoints are applied.
>
> **Action.** Parse every MIC value into a single comparator (=, <=, >) plus a
> numeric value on the standard log2 dilution scale, regardless of source
> notation.
>
> **Check.** Every parsed MIC round-trips to a valid log2 dilution step; no
> parsed value falls outside the plausible range for its drug–organism pair.

**Verified grounding.** All three left-censoring notations are directly
confirmed (`<=` in 201818; `</=` — with an internal space, e.g. `"</= 0.06"`
— in 201910; `<` in 207965, with examples reaching as low as `"<0.001"`). Bare
`>` upper-censoring is confirmed present in all three files. MIC readings are
not arbitrary decimals — broth microdilution testing (CLSI M7/M100 for
bacteria) exposes isolates to a fixed two-fold (log2) dilution series, so a
valid reading can only be a value that actually appears in that series, or a
censored notation relative to its floor/ceiling (Appendix 4 Part A).

**Design/Approach.** A six-step parsing specification (full detail in Appendix
4 §A.5): (1) normalize whitespace in the raw string (201910's internal space
between comparator and number must not be mis-split); (2) extract the
comparator token, matching longest-first so `</=` is never mis-split into `<`
plus stray characters; (3) normalize to one of three canonical symbols (`<=`,
`>`, `=`); (4) parse the remainder as a number, routing failures to a parse-
failure exceptions table rather than coercing to null-as-zero; (5) validate
the number against the generic log2 dilution table (Appendix 4 §A.2), treating
known dual-rounding pairs (e.g. `0.03`/`0.032`, `0.06`/`0.063`) as equal within
a small tolerance rather than requiring exact floating-point equality; (6)
persist the tuple `(comparator_canonical, numeric_value, log2_step,
source_notation_raw, source_cohort)` — retaining the raw notation alongside
the parse, per Design Principle 7, is what makes this step's own Check
independently re-verifiable later without re-deriving from the original file.
Each parsed tuple corresponds to a bound on the true, unknown MIC (`(<=, X)` →
true value in `(0, X]`; `(>, X)` → true value in `(X, ∞)`), which is the exact
mechanism that makes Step 7's Tier-3 fallback ("report an identified range")
operational rather than just descriptive (Appendix 4 §A.7).

**Deliverable.** A parsed `(comparator, value, log2_step)` triple per raw MIC
cell, retaining the original raw string, plus a parse-failure exceptions table
for any value that does not round-trip to a valid dilution step.

**Check (expanded).** (a) Every parsed value round-trips to a valid log2 step
within tolerance (Appendix 4 §A.2's dual-rounding pairs). (b) Every value that
fails (a) appears in the parse-failure exceptions log, not silently kept or
dropped. (c) The drug–organism-pair plausible-range half of Justice's Check —
confirming a value is not merely a valid dilution step in the abstract, but a
value actually tested for that specific drug's panel — is only partially
satisfiable today; see the open risk below.

**Dependencies.** The generic comparator/value extraction (steps 1–4 of the
design above) needs nothing but the raw MIC columns. Full satisfaction of
Justice's Check — validating against each drug's own plausible range, not just
the generic log2 series — depends on Step 4 (canonical drug identity, so the
correct per-drug range can even be looked up).

**Open risks.** No per-drug, per-cohort tested-dilution-range dictionary
(i.e., which specific concentrations were actually tested for, say, penicillin
in SOAR 201818) was available this session. Until such a dictionary is
obtained, this step's validation can only check a parsed value against the
*generic* log2 series, not each drug's specific tested range — a real, stated
limitation of the design as currently specified (Appendix 4 §A.6), not an
oversight to silently work around. Separately, whether the three left-
censoring notations are fully interchangeable across cohorts in a strict sense
(i.e., whether "at-or-below the panel floor" means the exact same floor value
per drug in every cohort) was not confirmed against each cohort's own data
dictionary and should be checked before treating cross-cohort MIC comparisons
as notation-differences-only (Appendix 4 §A.4). Finally, whether SENTRY's
antifungal MIC columns ever carry comparator/censoring notation at all — as
opposed to being pre-resolved floats — was not checked this session and is a
gap (Appendix 4 §A.3); this step's design as written targets the three SOAR
bacterial files specifically.

---

### Step 6 — Quality and evaluability filtering

> **Issue.** SOAR 207965 carries an Evaluable flag; 613 of 3,134 isolates
> (about 20%) are marked "N."
>
> **Action.** Exclude Evaluable = N isolates from resistance-rate
> denominators. Retain them in a documented exclusions table rather than
> deleting them, so the exclusion is auditable.
>
> **Check.** Resistance rates recomputed with and without the excluded
> isolates differ only in the expected direction and magnitude; the exclusion
> count is reported alongside every 207965-derived rate.

**Verified grounding.** SOAR 207965's `Evaluable` field: Y = 2,521, N = 613.
613/3,134 = 19.56%, matching Justice's "~20%" exactly. No `Evaluable` column
exists in SOAR 201818 or 201910 (Appendix 1 §1–§2) — this step is entirely
specific to SOAR 207965; it is a pass-through no-op for the other three files.

**Design/Approach.** Per Design Principle 8, this is a tag-and-pass-through
step, not a delete-now step: Justice's own Action says to exclude
Evaluable = N isolates from resistance-rate *denominators*, which is a
computation-time filter, not a preprocessing-time deletion. The `Evaluable`
flag itself should therefore be carried as a passthrough field into the Step
10 master table (the same pattern as Step 8's raw Beta Lactamase field),
with the exclusion applied wherever a resistance rate is actually computed
(Section 6, out of scope for this plan, but the master schema must supply the
flag for that later step to use).

**Deliverable.** `exceptions/evaluability_exclusions_log.csv`, recording every
`Evaluable = N` isolate's identifier and cohort; the `Evaluable` field itself
retained as a passthrough column, not consumed and discarded.

**Check (expanded).** (a) The exclusions log contains exactly 613 rows, all
from SOAR 207965. (b) Every resistance rate computed downstream from SOAR
207965 is reported twice — with and without the excluded 613 — or at minimum
states which basis it uses and the excluded count, per Justice's Check. (c)
The "differ only in the expected direction and magnitude" half of Justice's
Check is, as literally written, qualitative rather than a precise numeric
threshold — see the open risk below for why this cannot yet be made fully
executable.

**Dependencies.** None to build the exclusions log itself. Its output (the
passthrough flag) feeds Step 7's rate-denominator logic and Step 10's schema.

**Open risks.** **What "Evaluable = N" actually means clinically or
technically (contaminated culture? insufficient growth? mixed culture?) was
not confirmed this session** — Appendix 1 has the counts but not the field's
definition. Without that definition, Justice's own Check ("differ only in the
expected direction") cannot be precisely operationalized into a numeric
assertion, only the mechanical exclusion itself can be verified. This should
be resolved (ideally from a SOAR data dictionary, the same class of artifact
needed for the DIN/CDN gap in Step 4) before the "expected direction" half of
this Check is treated as satisfied by anything more than eyeballing.

---

### Step 7 — Resistance and susceptibility classification

> **Issue.** Bacterial isolates need EUCAST or CLSI breakpoints applied per
> organism–drug pair. Fungal isolates have a structurally different problem:
> four antifungals — itraconazole, posaconazole, flucytosine, amphotericin B
> — have no usable CLSI category in this dataset at all (Section 4.4).
>
> **Action.** For bacteria: apply breakpoints per organism–drug pair, run
> separately per cohort before merging, to avoid breakpoint-version errors.
> For fungi: classify using the CLSI category where one exists; for the four
> breakpoint-absent drugs, fall back to species-specific epidemiological
> cutoff values (ECVs) where published, and report an identified range rather
> than a point estimate where even ECVs are unavailable.
>
> **Check.** Every classified isolate carries a record of which standard —
> CLSI breakpoint, ECV, or unclassifiable — produced its category, so no
> fungal resistance rate is reported without disclosing its basis.

**Verified grounding — the scale of the fungal problem, exactly quantified.**
Out of SENTRY's 26,922 rows, the CLSI category (`_I`-suffixed) column is null
for **100.0%** of rows for itraconazole, posaconazole, and flucytosine, and
**99.5%** for amphotericin B. For the three 100%-null drugs, the underlying MIC
*value* is nonetheless still measured for most rows (itraconazole: 22,423 of
26,922; posaconazole: 26,910; flucytosine: 6,926) — the lab took the
measurement; no clinical breakpoint exists to turn it into a category. This is
exactly the structural gap ECVs are designed to address (Appendix 4 Part B.1).

**Design/Approach — bacteria.** Apply EUCAST/CLSI breakpoints per
organism–drug pair, computed separately within each SOAR cohort before any
merge, per Justice's own Action (this avoids a scenario where a breakpoint
table revised between 2016 and 2021 gets silently applied inconsistently
across cohorts collected years apart). This half of Step 7 depends on Step 3
(organism identity), Step 4 (drug identity), and Step 5 (normalized MIC value)
all being complete.

**Design/Approach — fungi: a three-tier classification hierarchy** (Appendix 4
§B.2), which this plan treats as the operational meaning of Justice's Action:

1. **Tier 1 — CLSI clinical breakpoint.** Used directly wherever the `_I`
   column is non-null.
2. **Tier 2 — ECV-based wild-type/non-wild-type (WT/NWT) call.** Used where no
   CLSI category exists but a published, species-specific ECV is available:
   MIC ≤ ECV → WT, MIC > ECV → NWT. **WT/NWT is not the same distinction as
   susceptible/resistant** — it is a statement about whether an isolate falls
   within the normal MIC distribution of organisms lacking acquired resistance
   mechanisms, not a clinical-outcome prediction. Whether, or how, a NWT call
   should be pooled into a headline "resistance rate" alongside Tier-1 S/I/R
   categories is an open design decision this plan does not resolve — it must
   be decided and stated explicitly before any pooled rate mixes tiers (Part 10).
3. **Tier 3 — unclassifiable.** No CLSI category and no published ECV. Report
   the parsed, identified MIC range from Step 5 (e.g., "MIC `<=0.06`") with an
   explicit "unclassifiable — no CLSI breakpoint or ECV" tag. Never collapse
   this to a guessed category or a point estimate.

A starter ECV reference table exists (Appendix 4 §B.3), built from a small
number of targeted searches this session, covering: *C. albicans*
(amphotericin B, flucytosine, itraconazole, posaconazole), *C. glabrata* and
*C. parapsilosis* (posaconazole only), *A. fumigatus* (itraconazole,
posaconazole, voriconazole, isavuconazole), and Mucorales genus-level
(amphotericin B, posaconazole, itraconazole — species not matched to SENTRY's
top 5). **This table is explicitly a starter, not a systematic literature
review** (Appendix 4 §B.5) — see open risks below.

**A note on Justice's citation to "ATLAS (Missing Negative concept)."**
Justice's Step 8 issue text (quoted in full under Step 8 below) draws an
analogy between the beta-lactamase gap and a pattern he describes as
documented elsewhere. This plan treats that phrase purely as Justice's own
citation within his document, and grounds the actual classification and
bounds methodology used for both Step 7's ECV-absent tier and Step 8 entirely
in the standard, published partial-identification literature (Manski 1989;
Manski & Molinari 2021; Manski & Pepper 2000/2009 — full citations in Appendix
5). No other internal project document was consulted, opened, or reconciled
against in producing this plan, consistent with this plan's scope being
limited strictly to Justice's own document.

**Deliverable.** For bacteria: a per-isolate-drug resistance category (S/I/R)
plus a `classification_basis` field naming the breakpoint standard/version
used, computed per cohort. For fungi: a per-isolate-drug category that is
either the Tier-1 CLSI category, a Tier-2 WT/NWT call, or a Tier-3
"unclassifiable" tag carrying the identified MIC range — in all three cases
paired with a `classification_basis` field naming which tier produced it.

**Check (expanded).** (a) Every classified bacterial isolate-drug pair carries
a named breakpoint standard and version. (b) Every classified fungal
isolate-drug pair carries one of exactly three basis values (`CLSI_breakpoint`
/ `ECV_WT_NWT` / `unclassifiable_no_standard`) — never blank, never a category
with no recorded basis. (c) For itraconazole, posaconazole, and flucytosine
specifically: given the CLSI category column is 100% null for all three, a
direct check that **zero** isolate-drug rows for these three drugs carry a
`CLSI_breakpoint` basis (i.e., confirming the pipeline did not fabricate a
category where none exists in the source data).

**Dependencies.** Steps 3, 4, 5 (bacteria + fungi), and 6 (bacteria, for
correctly scoped denominators) — the most dependency-heavy step in the
pipeline; see Part 7.

**Open risks.** The ECV table's most consequential gap: **_Candida tropicalis_
has zero ECV coverage** across all four drugs researched, despite being one of
SENTRY's actual top-5-by-volume species (2,139 rows) — this is a meaningful
hole, not a marginal one. *C. glabrata* and *C. parapsilosis* are missing
amphotericin B/flucytosine/itraconazole values (only posaconazole was
captured for each). *A. fumigatus* has no captured amphotericin B ECV. The
table covers ECVs relevant only to the top 5 of SENTRY's 200 species — the
other 195 have no ECV research performed at all, not merely an incomplete
entry. The *C. albicans* flucytosine ECV specifically was measured at a
24-hour read in its source paper, while most other ECVs in the table are
48-hour reads — which incubation timepoint SENTRY's own values represent was
not confirmed, and this should be checked before that specific ECV is applied
(Appendix 4 §B.3, §B.5). Several citations in Appendix 4 §B.4 are missing full
bibliographic detail and must be resolved by pulling the actual papers before
formal citation anywhere outside this internal plan. **Before this reference
table is used to classify a single real isolate, someone should pull the
current CLSI M27/M38/M59 supplement tables or the EUCAST ECOFF list directly**
— this appendix is a scaffold for that work, not a substitute for it.

---

### Step 8 — Genotype-field identifiability bounds

> **Issue.** The bacterial Beta Lactamase field is blank for a large share of
> isolates — 1,345 of 2,413 in 201818, 1,606 of 3,134 in 207965 — a
> detection-only pattern structurally identical to the one documented in
> ATLAS (Missing Negative concept).
>
> **Action.** Do not compute a beta-lactamase prevalence as positives over
> tested isolates. Report it as an identified range, bounded below by
> positives-over-all-isolates and above by the positives-over-tested ratio,
> narrowed where a monotone-selection assumption is defensible.
>
> **Check.** Every reported beta-lactamase prevalence carries its range and
> the assumption used to produce it, not a single number.

**Verified grounding.** SOAR 201818: Beta Lactamase is NaN for 1,345 of 2,413
isolates (949 NEG, 119 POS among the remainder) — 55.7% blank. SOAR 207965:
NaN for 1,606 of 3,134 (1,286 NEG, 242 POS) — 51.2% blank, matching Justice's
figure exactly. SOAR 201910 also has a `Betalactamase` column in its schema,
but its null/NEG/POS breakdown was not counted this session — a gap, not a
zero (Appendix 1 §2, Gap 2).

**Design/Approach.** This step and Step 7's ECV-absent fungal tier are the
same underlying statistical problem — a field populated only for a
non-random subset of isolates — and this plan applies one methodology
(Appendix 5) to both rather than treating them as unrelated. Let N = all
isolates of the relevant organism, T = isolates with a non-blank Beta
Lactamase value, P = isolates recorded POS. The **assumption-free (Manski)
bound** is: lower = P/N, upper = (P + N − T)/N — the logical extremes of
"every untested isolate is truly negative" and "every untested isolate is
truly positive," requiring no assumption about *why* isolates went untested.
Reporting the naive P/T ("positives over tested") as if it were automatically
a valid upper bound is exactly the error Justice's Action forbids: it silently
assumes untested isolates are no more likely to be positive than tested ones,
and nothing in the raw data guarantees this — a lab could just as easily run
the confirmatory test *because* an isolate already looked resistant on a
screening panel, which would make the true untested-group rate *higher* than
P/T, not lower. The **named, defensible assumption** that licenses the
tighter bound P/T as a valid upper limit is **testing monotonicity** (Manski &
Molinari 2021: the probability of being tested is no lower for a truly
positive isolate than a truly negative one) — this is the term of art to use;
it must never be called "monotone missingness," an unrelated biostatistics
term describing a missing-data *pattern*, not a *correlation with the true
value* (Appendix 5 §5.3 gives the full terminology distinction, since
confusing the two would be a citation error to a reviewer who knows the
biostatistics literature).

**Illustrative arithmetic** (whole-file aggregates, **not** yet
organism-stratified — see open risks): SOAR 201818 → Tier 1 [4.93%, 60.67%],
Tier 2 (under testing monotonicity) [4.93%, 11.14%]. SOAR 207965 → Tier 1
[7.72%, 58.97%], Tier 2 [7.72%, 15.84%]. These demonstrate the mechanics only;
Section 5.5's own stratification rule (compute within each organism/cohort/
country/year stratum before pooling) has not yet been applied to produce a
number this plan treats as final.

**Deliverable.** No new per-isolate column beyond the raw `Beta Lactamase`
value itself, which is carried into the master table as a passthrough field
(Design Principle 8 — Step 8 is a reporting rule computed *from* that field at
analysis time, not a row-level transformation performed during preprocessing).
The deliverable proper is the bounds computation logic itself
(`bounds/beta_lactamase_bounds.csv` — Tier 1 and Tier 2 bounds, computed per
organism/cohort/country/year stratum, each row carrying its own N, T, P, and
interval width alongside the bound).

**Check (expanded).** (a) No report anywhere states a bare beta-lactamase
percentage without an accompanying interval and a named assumption. (b) Every
reported Tier 2 bound is labeled with "testing monotonicity (Manski & Molinari
2021)" by name, distinguished explicitly from Tier 1's assumption-free status.
(c) Every reported bound is stratum-specific (by organism at minimum) with its
own N/T/P shown, not a single pooled whole-file number presented as the
headline figure.

**Dependencies.** Step 3 (organism harmonization — needed to scope N to the
correct organism-specific denominator, excluding contaminant/environmental
isolates before computing the bound). Structurally depends on the master
table (Step 10) having preserved the raw Beta Lactamase passthrough field,
though it is computed as a downstream reporting step rather than as part of
Step 10's own row-level assembly.

**Open risks.** All bounds computed so far are whole-file aggregates across
multiple organisms pooled together — a genuinely different (and less
informative) statement than the organism-stratified bound Section 5.5's own
rule requires; this recomputation has not been done. SOAR 201910's
Betalactamase breakdown was never counted this session. Two caveats apply to
every bound regardless of stratification: (1) every formula here assumes the
underlying lab determination is perfectly accurate once made — no allowance
for false-positive/false-negative lab error, unaudited against any source
file's lab methodology; (2) the formulas require that "blank" genuinely means
"not tested," not an implicit dataset convention where blank silently encodes
a presumed-negative result — **this has not been confirmed for any of the four
files** and is a required audit step, not a theoretical aside, before any of
these bounds are treated as final (Appendix 5 §5.7).

---

### Step 9 — Age and demographic harmonization

> **Issue.** The three SOAR cohorts record continuous age; SENTRY records
> four age bands (0–17, 18–30, 31–60, 61+).
>
> **Action.** Bin SOAR ages into the same four bands for any analysis
> comparing age structure across bacterial and fungal cohorts. Keep
> continuous age available for bacteria-only analyses.
>
> **Check.** Every isolate with a non-missing age value receives exactly one
> age-band label.

**Verified grounding.** SENTRY's age bands are directly confirmed: 61+
(12,381 rows), 31–60 (8,001), 0–17 (1,656), 18–30 (1,636), and 3,248 rows
(12.1%) with no age band recorded at all (Appendix 1 §4). **This session did
not independently verify the SOAR cohorts' continuous age field** — its
column name, missingness rate, value range, or even its confirmed existence
were not checked directly against the raw files, unlike every other fact in
this plan. Justice's Issue statement that continuous age exists in all three
SOAR cohorts is taken as given from his document, not independently
re-confirmed the way this session re-confirmed his other claims.

**Design/Approach.** Apply SENTRY's own four band edges to SOAR's continuous
age: `[0,17]`, `[18,30]`, `[31,60]`, `[61, ∞)`. A specific implementation
detail needs to be nailed down once the SOAR age field is actually inspected:
whether ages are recorded as whole years (making boundary handling trivial) or
can carry fractional/decimal values (which would require an explicit rule for
values like 17.5). Rows with missing age remain unbanded — Justice's own Check
implicitly tolerates this by only asserting a label for "isolate[s] with a
non-missing age value," matching SENTRY's own 12.1% no-band-recorded rate as a
precedent for missingness being expected, not an error to fix.

**Deliverable.** An `age_band` field added to each SOAR cohort (derived);
continuous age retained unchanged as a passthrough field per Design Principle
7, available for bacteria-only analyses per Justice's own Action.

**Check (expanded).** (a) Every row with a non-null age value (continuous, for
SOAR; pre-existing band, for SENTRY) carries exactly one of the four canonical
band labels — never zero, never more than one. (b) Boundary values (exactly
17, 18, 30, 31, 60, 61) are tested explicitly against the binning edges to
confirm no off-by-one gap or overlap between adjacent bands.

**Dependencies.** None upstream. Feeds into Step 10's master schema as a
supplementary (non-required) field.

**Open risks. This step's entire premise — that SOAR carries a usable
continuous age field — has not been independently verified this session**, in
contrast to every other step in this plan. This should be the first thing
confirmed before any implementation work begins on this step specifically.

---

### Step 10 — Deduplication and master schema assembly

> **Issue.** The three SOAR cohorts use different isolate ID schemes (e.g.
> "LGC277703-05404" in 201910 vs. a plain IHMA number in 207965), so accidental
> duplication across the one year of cohort overlap (Vietnam, 2018) is
> unlikely but unverified.
>
> **Action.** Confirm no isolate ID or identical demographic/MIC fingerprint
> appears in more than one cohort for the 2018 Vietnam overlap. Then assemble
> the long-format master table — one row per isolate–drug pair, carrying ISO3
> country code, parsed year, canonical organism, canonical drug, normalized
> MIC, resistance category and its basis, pathogen type (bacterial/fungal),
> and source cohort.
>
> **Check.** The master table round-trips back to each source cohort's
> isolate count once filtered by source; no isolate–drug row has a null value
> in any of the seven key fields above.

**Verified grounding.** Justice's own Section 4.2 table documents six
countries with genuine cross-cohort temporal continuity: Ukraine (2014–2021,
continuous across all three SOAR cohorts), and Turkey, Tunisia, Pakistan,
Kuwait, Vietnam (each continuous across two cohorts). Of these, Vietnam is the
only one where two cohorts' collection windows share a literal boundary year
(SOAR 201910: 2016–2018; SOAR 207965: 2018–2021 — both include 2018) — which
is exactly why Justice's own text names it as the dedup risk to check.

**An additional boundary-year risk this plan identifies, not named in
Justice's Step 10 text.** The same table shows Ukraine's SOAR 201818 window as
2014–2016 and its SOAR 201910 window as 2016–2017 — these also share a literal
boundary year, 2016, structurally identical to the Vietnam/2018 situation.
(Ukraine's 201910/207965 boundary, by contrast, does not share a year — 2017
vs. 2018 — so no additional risk exists there.) This is a direct, mechanical
reading of Justice's own Section 4.2 date ranges, not a new data claim — it
has not been checked against actual per-isolate records, only inferred from
the stated year ranges, so it should be read as "a boundary worth checking,"
not "a confirmed duplicate." **Step 10's dedup scope should explicitly include
Ukraine/2016 alongside Vietnam/2018.**

**Design/Approach.** Two sub-parts, best thought of as sequential:

**(A) Dedup verification**, scoped to the Vietnam/2018 and Ukraine/2016
boundary-year isolates specifically (not the full dataset — Justice's own
Issue frames this as a targeted check on the known overlap points, not a
blanket all-pairs comparison). Two matching methods, per Justice's own Action:
(1) exact isolate-ID match, where comparable; (2) a fingerprint match (e.g., a
hash of country + year + organism + age + a subset of MIC values) for cases
where the ID schemes differ too much to compare directly — which is exactly
the concern Justice's Issue raises, since 201910's ID format
("LGC277703-05404") and 207965's ("plain IHMA number") are not directly
comparable strings. Note that SOAR 201818's isolate ID scheme is not named
anywhere in Justice's text and was not independently checked this session
either — a gap, listed below.

**(B) Master table assembly**, one row per isolate–drug pair (long format),
after (A) is resolved. The eight fields Justice's Action lists, with the step
that produces each:

| # | Field | Produced by |
|---|---|---|
| 1 | ISO3 country code | Step 1 |
| 2 | Parsed year | Step 2 |
| 3 | Canonical organism | Step 3 |
| 4 | Canonical drug | Step 4 |
| 5 | Normalized MIC (comparator + value) | Step 5 |
| 6 | Resistance category and its basis | Step 7 |
| 7 | Pathogen type (bacterial/fungal) | Step 3 (alongside canonical organism) |
| 8 | Source cohort | Present in the raw data directly; no upstream step needed |

**A clarification worth making explicit:** Justice's Check refers to "the
seven key fields," but the Action's own list, read item by item, has eight
entries. The arithmetic reconciles once "resistance category and its basis"
(item 6) is read as one conceptual field — but it should almost certainly be
implemented as **two separate physical columns** (e.g. `resistance_category`
and `classification_basis`), since Step 7's own Check requires that basis be
recorded per isolate and a single combined text field would make that
awkward to query or assert against. This plan's recommendation: treat the
null-check as applying to 7 conceptual fields realized as roughly 8 physical
columns, and state this explicitly in whatever document eventually specifies
the literal master table schema, so nobody miscounts columns when
implementing the Check.

**Recommended passthrough fields** (not among the 7 required-non-null fields,
but needed by other steps or for audit, per Design Principle 7): raw Beta
Lactamase value (Step 8's bounds computation reads this downstream), the
`Evaluable` flag (Step 6's rate-computation logic reads this downstream),
`age_band` plus continuous age (Step 9), raw country/organism/drug strings
(audit trail), `dosing_variant` (Step 4, for the Amoxicillin Clavulanate
case), and isolate ID (needed for part (A)'s own dedup check and for any
future reproducibility work).

**Deliverable.** `master/master_table_v1` — the long-format table itself —
plus `exceptions/dedup_review_log.csv` recording every candidate duplicate
found (or confirming none were found) for both the Vietnam/2018 and
Ukraine/2016 boundary checks.

**Check (expanded).** (a) **Row-count round-trip needs a precise operational
definition, since the master table is isolate-*drug*-level (long format), not
isolate-level.** The literal "round-trips back to each source cohort's
isolate count" check should be read as: the count of *distinct isolate IDs*
in the master table, filtered to `source_cohort = X`, equals (X's raw isolate
count) minus (Step 3 organism exclusions for X) minus (any confirmed
duplicates removed for X) — not a raw row count, which will be a multiple of
the isolate count (roughly, the number of drugs tested per isolate, itself
variable since not every isolate has every drug tested). This plan recommends
this isolate-level interpretation explicitly, since applying the Check
literally at the row level would not mean what Justice's text intends. (b)
Zero nulls in the 7 conceptual / ~8 physical key fields — with the explicit
caveat that Step 7's Tier-3 "unclassifiable" outcome is a valid, non-null
*value* for the resistance-category field (the string "unclassifiable — no
CLSI/ECV," not a missing value), so a Tier-3 classification must not be
miscounted as a Check failure. (c) Both the Vietnam/2018 and Ukraine/2016
dedup checks are recorded as passed (zero true duplicates) or every candidate
duplicate found is logged with its resolution.

**Dependencies.** Steps 1, 2, 3, 4, 5, 6, 7, and 9 all feed this step directly;
it is the terminal step of the pipeline (Part 7).

**Open risks.** SOAR 201818's isolate ID scheme is not documented anywhere in
the verified facts available to this plan — needed before part (A)'s ID-match
method can be applied uniformly across all three cohorts, rather than just
201910-vs-207965. The Ukraine/2016 boundary risk identified above is inferred
from stated year ranges, not from a per-isolate cross-tabulation — it should
be checked directly, not assumed confirmed or assumed absent.

---

## Part 7: Build-Order and Dependency Graph

Justice's own framing for Section 5 — "sequenced so each one produces a
checkable, reproducible output before the next step runs" — describes a
dependency order, not a strict step-1-then-2-then-3 sequence. Several steps
are structurally independent of each other and can be built in parallel; only
a subset have a genuine hard dependency.

| Tier | Steps | Why |
|---|---|---|
| **A — fully independent** | 1 (country), 2 (date), 3 (organism), 4 (drug code), 6 (evaluability), 9 (age) | Each needs only its own raw column(s) already present in the source files. None reads another step's output. All six can be built and checked in parallel. |
| **B — single upstream dependency** | 5 (MIC parsing, generic comparator/value extraction only) | Independent of everything for the core parse; full satisfaction of its Check (drug-specific plausible range) additionally depends on Step 4. |
| **B — single upstream dependency** | 8 (beta-lactamase bounds) | Depends on Step 3, to scope the bound's denominator to the correct organism and exclude contaminant/environmental isolates first. |
| **C — multi-step dependency** | 7 (resistance/susceptibility classification) | Depends on Steps 3 + 4 + 5 (bacteria and fungi) + 6 (bacteria, for correctly scoped denominators). The single most dependency-heavy step. |
| **D — terminal** | 10 (dedup + master assembly) | Depends on Steps 1, 2, 3, 4, 5, 6, 7, and 9. Step 8 is not a strict input to Step 10's row-level assembly (it is a downstream reporting rule computed from a passthrough field Step 10 must preserve), but is placed here because it is the last step in Justice's own numbering and completes the pipeline's deliverables. |

```
Tier A (parallel, no dependencies):
  Step 1 (country)    Step 2 (date)    Step 3 (organism)
  Step 4 (drug code)  Step 6 (evaluable)  Step 9 (age)
        │                   │                  │
        │         ┌─────────┴─────────┐        │
        ▼         ▼                   ▼        │
Tier B: Step 5 (MIC, full check needs Step 4)   │
        Step 8 (bounds, needs Step 3)           │
        │         │                             │
        └────┬────┴──────────┬──────────────────┘
             ▼                (needs 3+4+5+6)
Tier C:  Step 7 (classification)
             │
             ▼ (needs 1+2+3+4+5+6+7+9)
Tier D:  Step 10 (dedup + master assembly)
             │
             ▼
    [ master table — this plan's endpoint ]
    [ Section 6 analytic methodology — out of scope, next phase ]
```

**Practical implication for planning implementation work:** the six Tier-A
steps can be assigned and built simultaneously with no coordination overhead
between them — they are the natural place to parallelize effort. Step 7 is the
critical path: nothing in Tier C or D can start until all four of its
dependencies clear, so any schedule risk in Steps 3, 4, 5, or 6 propagates
directly into Step 7 and then into Step 10.

---

## Part 8: Master Table Schema Reference

Step 10 (Part 6) specifies the master table's 7 conceptual required fields
and its recommended passthrough fields, but does so across several separate
places: its own field table, its "recommended passthrough fields" paragraph,
and individual mentions inside Steps 1, 4, 6, 8, and 9's own Deliverable
sections. This part consolidates all of them into one column-by-column
reference — the single artifact an implementer should be able to code the
literal `master_table_v1` schema against, without cross-referencing every
step individually. Column numbering here is independent of, and should not be
confused with, Step 10's own "7 conceptual / ~8 physical fields" numbering
(Part 6, Step 10) — this table is the physical realization of that
discussion, at the full 19-column grain.

| # | Column | Type | Nullable | Required? | Produced by | Example | Notes |
|---|---|---|---|---|---|---|---|
| 1 | `isolate_id` | string | No | Supporting | Step 10 | `"LGC277703-05404"` | Format varies by cohort; SOAR 201818's own ID scheme is undocumented (Part 10, gap 22) |
| 2 | `source_cohort` | string (enum) | No | **Yes** — conceptual field 8 | Raw (no step needed) | `"SOAR_207965"` | |
| 3 | `iso3_country` | string (3-letter) | No | **Yes** — conceptual field 1 | Step 1 | `"UKR"` | From `country_iso3_crosswalk_v1`; `UK`/`Scotland` collapse to `GBR` (Part 10, gap 14) |
| 4 | `raw_country_original` | string | No | No — passthrough | Step 1 | `"Slovak Republic"` | Pre-crosswalk string (Design Principle 7); carries the `UK`/`Scotland` distinction the ISO3 field collapses |
| 5 | `parsed_year` | integer | No | **Yes** — conceptual field 2 | Step 2 | `2017` | Must fall in `[2000,2025]` and within the cohort's own documented window |
| 6 | `date_parse_status` | string (enum) | No | No — audit field | Step 2 | `"clean_string"` | One of `clean_datetime`/`clean_string`/`clean_integer`/`unparseable` |
| 7 | `canonical_organism` | string | No (may be the sentinel value) | **Yes** — conceptual field 3 | Step 3 | `"Streptococcus pneumoniae"` | Sentinel `unidentified_pathogen` is a valid, non-null value here |
| 8 | `original_organism_name` | string | Yes | No — passthrough | Step 3 | `"S. pneu"` | SOAR 207965 only; null for cohorts with no separate raw/final organism fields |
| 9 | `pathogen_type` | string (enum: `bacterial`/`fungal`) | No | **Yes** — conceptual field 7 | Step 3 | `"bacterial"` | Determined alongside `canonical_organism` |
| 10 | `canonical_drug` | string | No (may be `"UNRESOLVED"`) | **Yes** — conceptual field 4 | Step 4 | `"amoxicillin/clavulanate"` | `UNRESOLVED` rows (`DIN`) always carry `exclude_from_cross_cohort_comparison = TRUE` |
| 11 | `raw_drug_identifier` | string | No | No — passthrough | Step 4 | `"CDN"` | |
| 12 | `dosing_variant` | string (enum: `standard`/`fixed_2ug`) | Yes | No — passthrough | Step 4 | `"fixed_2ug"` | Populated only for the SOAR 207965 "fixed at 2" Amoxicillin Clavulanate column |
| 13 | `mic_comparator` | string (enum: `<=`,`>`,`=`) | No | **Yes** — part of conceptual field 5 | Step 5 | `"<="` | |
| 14 | `mic_value` | float | No | **Yes** — part of conceptual field 5 | Step 5 | `0.06` | Validated against the generic log2 dilution table (Appendix 4 §A.2) |
| 15 | `mic_source_notation_raw` | string | No | No — passthrough | Step 5 | `"<=0.06"` | Original notation before parsing (Design Principle 7) |
| 16 | `evaluable_flag` | string (enum: `Y`/`N`) | Yes | No — passthrough | Step 6 | `"N"` | Populated only for SOAR 207965; null for every other cohort |
| 17 | `resistance_category` | string | No (never a true null — see note) | **Yes** — part of conceptual field 6 | Step 7 | `"R"` / `"WT"` / `"unclassifiable — no CLSI/ECV"` | Tier-3 unclassifiable is an explicit string value, not a missing value (Part 6, Step 10, Check (b)) |
| 18 | `classification_basis` | string (enum: `CLSI_breakpoint`/`ECV_WT_NWT`/`unclassifiable_no_standard`) | No | **Yes** — part of conceptual field 6 | Step 7 | `"CLSI_breakpoint"` | Never blank — Pipeline-Level Acceptance Criterion 4 (Part 9) depends on this |
| 19 | `beta_lactamase_raw` | string (enum: `POS`/`NEG`) | Yes | No — passthrough, read by Step 8's bounds computation | Step 8 (passthrough only) | `"POS"` | Bacterial cohorts only; always null for SENTRY; blank-means-untested is an unconfirmed assumption (Part 10, gap 10) |
| 20 | `age_band` | string (enum: `0-17`/`18-30`/`31-60`/`61+`) | Yes | No — passthrough | Step 9 | `"31-60"` | |
| 21 | `age_continuous` | float | Yes | No — passthrough | Step 9 | `45` | Null for SENTRY by design (bacteria-only field per Justice's Action); SOAR's own presence of this field was never independently verified (Part 10, gap 21) |

**Which columns must never be null.** Pipeline-Level Acceptance Criterion 5's
"zero nulls in required fields" (Part 6, Step 10, Check (b)) maps to rows 2,
3, 5, 7, 9, 10, 13, 14, 17, 18 in this table — the 7 conceptual fields
realized as these physical columns. Every other row (4, 6, 8, 11, 12, 15, 16,
19, 20, 21) may be legitimately null depending on cohort or case; a null in
one of those is not a Check failure.

**This schema is itself a candidate versioned artifact**, per Part 5's
versioning-mechanics recommendation — e.g. `master/master_table_schema_v1.md`,
or a data-dictionary sheet shipped alongside the master table file itself, so
the schema and the data it describes are versioned together and cannot
silently drift apart.

---

## Part 9: Pipeline-Level Acceptance Criteria

The pipeline as a whole is done when all of the following hold — this is the
union of every step's own Check, plus cross-step consistency checks that no
single step's Check would catch on its own:

1. Every one of the ten steps' own expanded Checks (Part 6) passes.
2. **Cross-step row-count reconciliation:** for each of the four source
   files, (raw isolate count) = (analysis-ready isolate count in the master
   table) + (Step 3 organism exclusions) + (confirmed duplicates removed in
   Step 10) — every isolate is accounted for in exactly one of these three
   buckets, never zero, never counted twice.
3. **No orphan codes:** every ISO3 code, canonical organism, and canonical
   drug appearing in the master table traces back to a row in its respective
   crosswalk artifact — the master table never contains a canonical value that
   the crosswalk doesn't know about.
4. **No silent unresolved-as-resolved treatment:** `DIN` never appears in any
   cross-cohort drug comparison; every fungal isolate-drug row classified via
   Tier 2 (ECV) or Tier 3 (unclassifiable) is distinguishable from a Tier 1
   (CLSI) row via its `classification_basis` field.
5. **No bare point estimates for structurally unidentified fields:** every
   reported beta-lactamase prevalence and every reported resistance rate for
   itraconazole/posaconazole/flucytosine/amphotericin B carries an interval
   and a named assumption, never a single percentage alone.
6. **A per-step check log exists**, recording, for every step: pass/fail
   status, exclusion count (where applicable), and a timestamp/version —
   this is the artifact that makes "sequenced so each one produces a
   checkable output" (Justice's own framing) something the team can actually
   inspect after the fact, not just a design intention.
7. **Every crosswalk and exceptions-log artifact is versioned**, per Design
   Principle 1 — a future correction to any of them (DIN's eventual
   resolution, a corrected Ukraine/2016 dedup finding) produces a new version,
   never a silent in-place edit that would break reproducibility of any
   analysis already built on an earlier version.

---

## Part 10: Consolidated Risk & Gap Register

Every open item named inside a Part 6 step write-up, gathered here in one
place so none of them can hide inside a single step's section. Each is tagged
with the step(s) it affects.

| # | Gap / open item | Affects | Severity |
|---|---|---|---|
| 1 | `DIN` drug code entirely unresolved; doxycycline/tetracycline is an explicit hypothesis, not a fact | Step 4, 7 | Blocking for any DIN-specific analysis; non-blocking for everything else (DIN is simply excluded) |
| 2 | `CDN` provisional (cefdinir), not data-dictionary-confirmed | Step 4, 7 | Low — strong internal evidence, but tag must persist |
| 3 | No per-drug tested-dilution-range dictionary — Step 5's drug-specific plausible-range Check only partially satisfiable | Step 5 | Medium — generic log2 validation still works; drug-specific validation does not yet |
| 4 | *C. tropicalis* has zero ECV coverage despite being a top-5 SENTRY species | Step 7 | High for any *C. tropicalis*-specific fungal resistance claim |
| 5 | *C. glabrata*/*C. parapsilosis* missing AMB/FC/ITR ECVs; *A. fumigatus* missing AMB ECV | Step 7 | Medium |
| 6 | Only 5 of SENTRY's 200 species have any ECV research at all | Step 7 | High for anything beyond the top-5-by-volume species |
| 7 | *C. albicans* flucytosine ECV is a 24h read; SENTRY's own read timepoint not confirmed | Step 7 | Medium — affects one specific ECV cell |
| 8 | Several Appendix 4 citations missing full bibliographic detail | Step 7 | Low — internal-use only until resolved |
| 9 | Beta-lactamase bounds computed so far are whole-file, not organism-stratified | Step 8 | High — Section 5.5's own rule says pooled bounds can hide stratum-level problems |
| 10 | Whether "blank" means "not tested" vs. an implicit presumed-negative convention — not confirmed for any file | Step 7, 8 | High — this is a precondition for every bound in Step 8 and every Tier-3 classification in Step 7 |
| 11 | Lab-determination accuracy assumed perfect (no false-pos/neg allowance) in all Step 8 bounds | Step 8 | Medium |
| 12 | SOAR 201910's Betalactamase field breakdown never counted | Step 8 | Medium |
| 13 | 29 of 59 country strings' cohort attribution (SENTRY) derived by elimination, not re-verified directly | Step 1 | Low — affects attribution confidence, not the ISO3 mapping itself |
| 14 | `UK`/`Scotland` passthrough-field decision unresolved | Step 1, 10 | Low — recommendation exists, decision not finalized |
| 15 | Whether SOAR 201818/207965 date columns share 201910's type-mixing problem — not checked | Step 2 | Medium — affects how defensive the parser needs to be for those cohorts |
| 16 | Null vs. explicit `"Unknown"` FinalOrganismName handling — undecided | Step 3 | Low — affects a small category of rows |
| 17 | Whether "Amoxicillin Clavulanate fixed at 2" MIC values are numerically comparable to the standard-dose column — not established | Step 4, 5 | Medium |
| 18 | Whether the three left-censoring notations share the exact same per-drug panel floor across cohorts — not confirmed against a data dictionary | Step 5 | Medium |
| 19 | Whether SENTRY's antifungal MIC columns ever carry censoring notation — not checked | Step 5 | Low — assumed pre-resolved floats; unconfirmed |
| 20 | Meaning of SOAR 207965's `Evaluable = N` (why an isolate is non-evaluable) not confirmed | Step 6 | Medium — needed to make Step 6's own Check numerically precise |
| 21 | Whether SOAR's continuous age field exists as Justice's text states — never independently checked this session, unlike every other fact in this plan | Step 9 | High — this step's entire premise is unverified |
| 22 | SOAR 201818's isolate ID scheme not documented anywhere available to this plan | Step 10 | Medium — needed for a uniform dedup method across all three cohorts |
| 23 | Ukraine/2016 boundary-year dedup risk — inferred from date ranges, not checked against per-isolate records | Step 10 | Medium — newly identified in this plan, not in Justice's original text |
| 24 | Most of SENTRY's 39 non-top-5 countries' and 195 non-top-5 species' individual counts never captured | Steps 1, 7 | Low for the pipeline itself; relevant to any claim about the long tail |
| 25 | SOAR 207965 per-country and per-year row counts (beyond the regional aggregate and year range) never captured | General | Low |
| 26 | Whether/how a Tier-2 WT/NWT antifungal call should ever be pooled into a headline "resistance rate" alongside Tier-1 CLSI S/I/R categories — an open design decision flagged inline in Step 7, not resolved by this plan | Step 7 | Medium — affects how any fungal resistance rate is computed and reported downstream |
| 27 | Whether SOAR 201818's and 201910's small, clean-looking organism sets need any crosswalk work beyond trivial normalization — not separately stress-tested this session (a low-confidence assumption, not a confirmed non-issue) | Step 3 | Low |

---

## Part 11: Explicit Non-Goals (Restated)

For clarity at the point this document ends, restating what this plan
deliberately does not do:

- **No pipeline code.** Every "deliverable artifact" named in Part 6 is a
  target for a future build phase; none has been written, and this planning
  task does not include writing any.
- **No Section 6 analytic methodology.** Descriptive profiling, the
  evolutionary-fitness layer, clustering, external data joins, association
  regression, R&D alignment, and intervention-impact estimation are not
  designed here — they consume this pipeline's output but are a separate,
  later planning effort.
- **No Section 3.2 external data acquisition.** Life expectancy, consumption,
  vaccination, health-system, and R&D Hub data sources are named in Justice's
  document but their acquisition is not part of this plan.
- **No folders created.** Part 4's repository layout is a proposal for the
  build phase; only `docs/` exists today.
- **No cross-reference to any other internal project.** This plan is
  produced strictly from Justice's own document and this session's direct
  verification against the four raw files plus cited public literature; no
  other internal project's materials were consulted.

---

## Part 12: Appendix Index

| Appendix | Addresses | Contents |
|---|---|---|
| **1 — Verified Data Facts** | All 4 source files | Every number in this plan, traced to a direct count against the raw files; the 3 corrections to Justice's document; explicit gaps carried forward |
| **2 — Country ISO3 Crosswalk** | Step 1 | Full 59-row raw-string-to-ISO3 table; the Slovak Republic/Slovakia and UK/Scotland collisions; Korea/Hong Kong/Taiwan confidence flags; versioning spec |
| **3 — Drug/Antibiotic Code Crosswalk** | Step 4 | Full crosswalk for all 51 raw drug identifiers across the 3 SOAR cohorts; CDN provisional resolution; DIN unresolved status; the "fixed at 2" dosing-variant handling; versioning spec |
| **4 — MIC Parsing Conventions & Antifungal ECV Reference** | Steps 5, 7 | The log2 dilution-series table; the 6-step MIC parsing design; the 3-tier fungal classification hierarchy; the starter ECV reference table with all coverage gaps enumerated |
| **5 — Identifiability Bounds Methodology** | Steps 7, 8 | The Manski worst-case bounds; the testing-monotonicity assumption and its terminology trap; precedent literature; worked Tier 1/Tier 2 arithmetic for both pipeline cases; the implementer checklist |

---

*End of plan. This document and its five appendices are the complete output of
this planning task. Every open item is consolidated in Part 10; execution-layer
recommendations (stack, orchestration, versioning, idempotency, failure
handling) are in Part 5; the full master-table column reference is in Part 8.*
