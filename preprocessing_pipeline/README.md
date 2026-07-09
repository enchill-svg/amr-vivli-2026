# Preprocessing Pipeline

## In plain terms

Hospitals and labs around the world test bacteria and fungi taken from sick patients to see which drugs still work against them — this is how doctors track antimicrobial resistance (AMR), the growing problem of infections becoming harder to treat with existing drugs. This project combines four such testing datasets (three covering bacteria, one covering fungi) into one clean, combined spreadsheet that researchers can use to study resistance trends.

The problem is that the four original datasets don't agree on how to spell things. One file calls a country "Slovak Republic," another calls it "Slovakia." One file writes a lab measurement as "<=0.06," another writes the same kind of measurement as "<0.008." One file gives a drug a two-letter code, another spells out its full name. Before these files can be compared or combined, all of that has to be translated into one consistent set of labels — that's what this pipeline does. It also decides, using published medical thresholds, whether each result counts as "resistant," "susceptible," or "not enough information to tell," and it keeps a written record of every row it excludes and why, so nothing disappears unexplained.

The output is one combined table where each row is "one patient sample tested against one drug," ready to be analyzed. This pipeline does not do that later analysis (e.g., trends over time, life-expectancy comparisons) — it only prepares the data.

**Status:** Implemented and passing all built-in checks. Section 6 Stages 1–7 ("Analytic Methodology") and Section 7 deliverable packaging are implemented as manually-run analytic steps on top of this pipeline's output — see [§15](#15-section-6-stage-1--descriptive-profiling-step11_descriptivepy) through [§22](#22-section-7--expected-outputs-step18_section7_deliverablespy).

---

## Glossary (for non-technical readers)

| Term | Meaning |
|------|---------|
| **Isolate** | A single bacteria or fungus sample recovered from a patient specimen. |
| **Cohort** | One of the four source datasets (SOAR 201818, SOAR 201910, SOAR 207965, SENTRY). |
| **MIC** (Minimum Inhibitory Concentration) | The lowest concentration of a drug that stops a microbe from growing in the lab, measured in a testing kit. Lower numbers generally mean the drug is more effective. |
| **Breakpoint** | A published medical threshold: if a microbe's MIC is below the breakpoint it's called "susceptible" (drug works), above it "resistant" (drug likely won't work), and there's an "intermediate" zone in between. |
| **EUCAST** | European Committee on Antimicrobial Susceptibility Testing — the organization that publishes the official breakpoint tables this pipeline uses for bacteria. |
| **ECV** (Epidemiological Cutoff Value) | A published reference value used for fungi when no formal clinical breakpoint exists yet — classifies a result as "wild-type" (typical, drug-susceptible population) or "non-wild-type" (atypical) rather than a clinical susceptible/resistant call. |
| **ISO3** | The standard 3-letter country code (e.g. `USA`, `GBR`) used to make country names comparable across datasets. |
| **Resistance category** | The final S(usceptible) / I(ntermediate) / R(esistant) — or fungal WT/NWT — call assigned to a sample-drug pair. |
| **Evaluable** | A quality flag one dataset (SOAR 207965) uses to mark whether a sample's result is considered valid; samples marked "not evaluable" are excluded from the results. |
| **Crosswalk** | A lookup table that translates one dataset's labels (e.g. raw country spellings) into the pipeline's standard labels. |

---

## How to Run (full pipeline at once)

### Prerequisites

1. **Python 3** with `pandas` and `openpyxl` installed.
2. All **six raw input files** in place under `raw_inputs/` (see [`raw_inputs/README.md`](raw_inputs/README.md)).

### One command

From the **repository root** (`amr-vivli-2026/`):

```bash
python preprocessing_pipeline/run_pipeline.py
```

Or from inside the pipeline folder:

```bash
cd preprocessing_pipeline
python run_pipeline.py
```

That single command runs every step in order (Tier A → B → C → D → acceptance check). You do not need to invoke individual step scripts manually.

### What happens

1. **Preflight** — Verifies all six `raw_inputs/` files exist; exits immediately if any are missing.
2. **Steps 1–10** — Each step runs as a subprocess, prints its own PASS/FAIL checks, and writes artifacts to `crosswalks/`, `master/`, `exceptions/`, and `bounds/`.
3. **Post-build check** — `pipeline_acceptance_check.py` re-verifies the master table against crosswalks and reconciliation rules.
4. **Run log** — Appends one row per step to `logs/pipeline_check_log_v1.csv`.

### Success

A complete successful run ends with:

```text
Pipeline run: ALL STEPS PASSED
```

Exit code `0`. Primary outputs are `master/master_table_v1.csv` and `master/isolate_registry_v1.csv`.

### Failure

If any step fails, the pipeline **stops immediately** — later steps are not run. The failing step name and exit code are printed. Fix the issue and re-run the same command from the top (the runner does not resume mid-pipeline).

### Runtime

A full run on the current datasets takes roughly **4–5 minutes** (mostly Excel I/O and master-table assembly).

---

## 1. Purpose

Four Vivli datasets cannot be joined or compared as received:

| Problem | Example |
|---------|---------|
| Different country spellings | `"Slovak Republic"` vs `"Slovakia"` |
| Different date encodings | Excel datetimes, `"15-Dec-16"`, plain integers |
| Different organism naming | `FinalOrganismName` vs `ORGANISMNAME` |
| Different drug identifiers | `CDN` vs `CEFDINIR` vs full column names |
| Different MIC notation | `<=0.06`, `</= 0.06`, `<0.008` |
| Structural missingness | Beta-lactamase blank = untested, not negative; SENTRY CLSI categories often null |
| Quality flags | SOAR 207965 `Evaluable=N` (~20% of isolates) |

This pipeline resolves those differences, classifies resistance where standards exist, logs every exclusion, and writes a single long-format table for downstream analysis. Later-stage analytics (e.g. trend/regression analysis on top of this table) are **not** part of this pipeline.

---

## 2. Source Data (Inputs)

All raw files live under [`raw_inputs/`](raw_inputs/). Paths are centralized in [`src/_data_paths.py`](src/_data_paths.py).

| File | Cohort | Rows (approx.) | Years |
|------|--------|----------------|-------|
| `SOAR 201818/gsk_201818_published.csv` | SOAR_201818 (bacterial) | 2,413 | 2014–2016 |
| `SOAR 201910/GSK_SOAR_201910 raw data.xlsx` | SOAR_201910 (bacterial) | 2,318 | 2015–2018 |
| `SOAR 207965/SOAR 207965 Complete data set 04Sep25.xlsx` | SOAR_207965 (bacterial) | 3,134 | 2018–2021 |
| `ATLAS_Antifungals/vivli_sentry_2010_2024.xlsx` | SENTRY (fungal) | 26,922 | 2010–2024 |
| `EUCAST Clinical Breakpoint/v_8.1_Breakpoint_Tables.xlsx` | Reference | — | SOAR 201818 / 201910 |
| `EUCAST Clinical Breakpoint/v_10.0_Breakpoint_Tables.xlsx` | Reference | — | SOAR 207965 |

**Total raw isolates:** 34,787 across the four surveillance files.

The runner validates all six required files exist before Step 1 (`validate_raw_inputs()`).

---

## 3. Primary Outputs

### 3.1 `master/master_table_v1.csv` — main deliverable

Long format: **one row per isolate–drug pair**.

| Metric | Value (latest run) |
|--------|-------------------:|
| Total rows | 343,236 |
| Distinct isolates | 34,174 |
| Columns | 22 |

**By cohort:**

| Cohort | Isolates in master | Isolate–drug rows |
|--------|-------------------:|------------------:|
| SOAR_201818 | 2,413 | 29,235 |
| SOAR_201910 | 2,318 | 37,264 |
| SOAR_207965 | 2,521 | 47,364 |
| SENTRY | 26,922 | 229,373 |

Each row carries harmonized geography (`iso3_country`), year, organism, drug, parsed MIC, resistance call, classification basis, demographics, and source cohort.

### 3.2 `master/isolate_registry_v1.csv` — isolate-level companion

One row per **raw input isolate** (34,787), including excluded isolates.

| Field | Meaning |
|-------|---------|
| `in_master_table` | Whether the isolate appears in the master table |
| `has_drug_measurement` | Whether any drug column was non-null |
| `exclusion_reason` | Why an isolate was excluded (organism rule, Evaluable=N, etc.) |

**Excluded from master (613 isolates):**

- 584 — Evaluable=N (SOAR 207965, retained after organism filter)
- 29 — Step 3 organism exclusions (contaminants, no growth, cross-domain fungal)

### 3.3 `master/mic_parsed_values_v1.csv`

113,863 parsed SOAR MIC cells: canonical comparator, numeric value, and log2 dilution step per non-null bacterial MIC cell.

---

## 4. Supporting Artifacts

### 4.1 Crosswalks (`crosswalks/`)

Versioned lookup tables produced and consumed by the pipeline.

| File | Step | Purpose |
|------|------|---------|
| `country_iso3_crosswalk_v1.csv` | 1 | Raw country string → ISO3 |
| `organism_crosswalk_v1.csv` | 3 | Bacterial organism harmonization |
| `drug_code_crosswalk_v1.csv` | 4 | Raw drug column/code → canonical drug |
| `soar_drug_dilution_panel_v1.csv` | 5 | Empirical tested-dilution panels (cohort × drug × organism) |
| `eucast_breakpoint_table_v1.csv` | 7 | Parsed EUCAST breakpoint reference |
| `eucast_organism_crosswalk_v1.csv` | 7 | Canonical organism → EUCAST sheet |
| `eucast_drug_crosswalk_v1.csv` | 7 | EUCAST organism–drug resolution |
| `eucast_cohort_version_map_v1.csv` | 7 | Cohort → EUCAST version (v8.1 / v10.0) |

### 4.2 Bounds (`bounds/`)

| File | Step | Purpose |
|------|------|---------|
| `beta_lactamase_bounds_v1.csv` | 8 | Beta-lactamase prevalence intervals by stratum |
| `antifungal_ecv_classification_v1.csv` | 7 | SENTRY fungal classification summary |

### 4.3 Exception logs (`exceptions/`)

Every exclusion is logged — nothing is silently dropped.

| File | Typical contents |
|------|------------------|
| `organism_exclusions_log_v1.csv` | 29 Step-3 exclusions |
| `evaluability_exclusions_log_v1.csv` | 613 raw Evaluable=N rows |
| `evaluable_excluded_from_master_log_v1.csv` | 584 Evaluable=N excluded at master assembly |
| `evaluability_rate_comparison_v1.csv` | Per-drug denominator impact (207965) |
| `dedup_review_log_v1.csv` | Cross-cohort boundary dedup outcomes |
| `age_sentinel_exclusions_log_v1.csv` | Negative-age sentinel rows |
| `date_parse_exceptions_log_v1.csv` | Unparseable dates (0 on clean run) |
| `mic_parse_failures_log_v1.csv` | MIC parse failures (0 on clean run) |
| `zero_measurement_isolates_log_v1.csv` | Retained isolates with no drug measurements |
| `step10_*` logs | Swallowed parse failures, unknown drug crosswalk hits |

### 4.4 Run log (`logs/`)

`pipeline_check_log_v1.csv` — per-step PASS/FAIL, artifact write summaries, and timestamps for every pipeline run.

---

## 5. Repository Layout

```
preprocessing_pipeline/
├── README.md                 ← this file
├── run_pipeline.py           ← top-level runner
├── raw_inputs/               ← source files (not modified by pipeline)
│   └── README.md             ← input file manifest
├── src/                      ← step scripts
│   ├── _data_paths.py        ← all raw input paths
│   ├── step01_country.py … step10_master.py
│   ├── eucast_breakpoints.py
│   ├── step06_evaluability_rates.py
│   ├── pipeline_acceptance_check.py
│   ├── step11_descriptive.py ← Section 6 Stage 1 (see §15); not part of run_pipeline.py
│   ├── step12_evolutionary.py ← Section 6 Stage 2 (see §16); not part of run_pipeline.py
│   ├── step13_clustering.py ← Section 6 Stage 3 (see §17); not part of run_pipeline.py
│   ├── step14_external_join.py ← Section 6 Stage 4 (see §18); not part of run_pipeline.py
│   ├── step15_association.py ← Section 6 Stage 5 (see §19); not part of run_pipeline.py
│   ├── step16_rd_alignment.py ← Section 6 Stage 6 (see §20); not part of run_pipeline.py
│   ├── step17_intervention.py ← Section 6 Stage 7 (see §21); not part of run_pipeline.py
│   ├── step18_section7_deliverables.py ← Section 7 packaging (see §22); not part of run_pipeline.py
│   ├── _section6_external.py ← external-data loaders for Stages 4–7
│   └── _section6_aggregates.py ← shared pooling helpers for Stages 4–7
├── deliverables/             ← Section 7 expected outputs (step18)
├── master/                   ← primary outputs
├── crosswalks/               ← harmonization tables
├── bounds/                   ← Section 6 analytic intermediates
├── exceptions/               ← exclusion and audit logs
└── logs/                     ← pipeline run history
```

---

## 6. The Ten Steps (What Each Does)

Each step follows the same **Issue → Action → Check** pattern: state the data problem, describe what the step does about it, then verify the fix worked. Every step hard-fails (`sys.exit(1)`) if its Check does not pass.

### Step 1 — Country harmonization (`step01_country.py`)

- **Does:** Maps every raw country string in all four cohorts to ISO3 via `country_iso3_crosswalk_v1.csv`.
- **Handles:** 59 distinct raw strings → 57 ISO3 codes (2 reviewed collisions: UK/Scotland → GBR, Slovak Republic/Slovakia → SVK).
- **Output:** Crosswalk CSV (validated in-step; consumed by Step 10).

### Step 2 — Date and year parsing (`step02_date.py`)

- **Does:** Parses collection dates per actual runtime type (datetime, string, integer). Integers in [1900, 2100] are literal years, never Excel serial dates.
- **Enforces:** All years in [2000, 2025] and within each cohort's documented window.
- **Output:** `date_parse_exceptions_log_v1.csv` for unparseable values.

### Step 3 — Organism harmonization (`step03_organism.py`)

- **Does:** Maps bacterial organism strings to canonical species. Excludes no-growth, environmental contaminants, and cross-domain fungal isolates found in bacterial files.
- **Scope:** Three SOAR bacterial cohorts only (SENTRY fungal species pass through unchanged in Step 10).
- **Outputs:** `organism_crosswalk_v1.csv`, `organism_exclusions_log_v1.csv` (29 exclusions, all SOAR_207965).

### Step 4 — Drug code crosswalk (`step04_drug.py`)

- **Does:** Maps every drug column in every cohort to a canonical drug name.
- **Special cases:**
  - **CDN** → `cefdinir` (`resolution_status=provisional`)
  - **DIN** → `UNRESOLVED` (`exclude_from_cross_cohort_comparison=TRUE`)
  - SOAR 207965 keeps two `amoxicillin/clavulanate` dosing variants (`standard`, `fixed_2ug`).
- **Output:** `drug_code_crosswalk_v1.csv`.

### Step 5 — MIC notation normalization (`step05_mic.py`)

- **Does:** Parses SOAR bacterial MIC strings into canonical comparator (`<=`, `>`, `=`) plus numeric value on the log2 dilution scale.
- **Scope:** SOAR files only. SENTRY MIC columns are pre-resolved floats (no comparator notation).
- **Outputs:** `mic_parsed_values_v1.csv`, `soar_drug_dilution_panel_v1.csv`, parse-failure and dilution-violation logs.

### Step 6 — Evaluability filtering (`step06_evaluability.py`)

- **Does:** Documents all SOAR 207965 `Evaluable=N` isolates (613 rows, ~19.6%).
- **Effect at master assembly:** Evaluable=N isolates are excluded from the master table and resistance-rate denominators, but retained in registry and exclusion logs.
- **Pass-through:** Other three cohorts have no Evaluable column.
- **Supplement:** `step06_evaluability_rates.py` (runs after master) quantifies denominator impact per drug.

### Step 7 — Resistance classification (`eucast_breakpoints.py` + `step07_classification.py`)

**Bacterial half** (`eucast_breakpoints.py`):

- Parses EUCAST breakpoint tables (v8.1 for 201818/201910, v10.0 for 207965).
- Classifies each isolate–drug pair as S/I/R or a documented non-result reason.
- Applied per row in Step 10 via `classify_bacterial()`.

**Fungal half** (`step07_classification.py`):

- Three-tier hierarchy for SENTRY: CLSI category → ECV (WT/NWT) → unclassifiable.
- ECV coverage is partial (~9 species with published values vs 200 SENTRY species).

### Step 8 — Beta-lactamase bounds (`step08_beta_lactamase_bounds.py`)

- **Does:** Computes Manski (assumption-free) and monotonicity-narrowed prevalence intervals for beta-lactamase positivity, stratified by organism × country × year.
- **Never reports** a bare point estimate without bounds and assumption label.
- **Output:** `beta_lactamase_bounds_v1.csv`.

### Step 9 — Age harmonization (`step09_age.py`)

- **Does:** Bins SOAR continuous ages into four bands (`0-17`, `18-30`, `31-60`, `61+`) matching SENTRY's `Age Group` bands.
- **Keeps:** `age_continuous` for bacteria-only analyses; logs negative-age sentinels.
- **Output:** `age_sentinel_exclusions_log_v1.csv`.

### Step 10 — Deduplication and master assembly (`step10_master.py`)

**Part A — Dedup checks:**

- Fingerprint matching at cohort overlap boundaries (Vietnam/2018, Ukraine/2016) using ISO3, year, organism, age, and MIC tuples for 13 shared drugs.
- Candidate duplicates are logged for manual review, never auto-removed.

**Part B — Master assembly:**

- Builds long-format `master_table_v1.csv` and `isolate_registry_v1.csv`.
- Re-applies Steps 1–9 transforms inline (country, date, organism, drug, MIC, classification, age, evaluability).
- Enforces Evaluable=N exclusion, organism exclusion, and zero-measurement handling with explicit reconciliation.

**Post-build:** `pipeline_acceptance_check.py` independently re-verifies cross-step consistency.

---

## 7. Execution Order

Steps run in dependency tiers via `run_pipeline.py`:

```
Preflight: validate raw_inputs/

Tier A (independent)
  step01_country
  step02_date
  step03_organism
  step04_drug
  step06_evaluability
  step09_age

Tier B (single upstream)
  step05_mic              ← needs Step 4 crosswalk context
  step08_beta_lactamase_bounds  ← needs Step 3 organism crosswalk

Tier C (Step 7)
  eucast_breakpoints      ← bacterial classification reference
  step07_classification   ← fungal classification

Tier D (terminal)
  step10_master           ← assembles master table
  step06_evaluability_rates  ← denominator impact (needs master)

Post-build
  pipeline_acceptance_check
```

If any step fails, the pipeline stops immediately. Downstream steps do not run on unverified upstream output.

---

## 8. Master Table Schema

| Column | Produced by | Description |
|--------|-------------|-------------|
| `isolate_id` | Step 10 | Cohort-specific ID (always stored as string) |
| `source_cohort` | Raw | `SOAR_201818`, `SOAR_201910`, `SOAR_207965`, `SENTRY` |
| `iso3_country` | Step 1 | Three-letter ISO code |
| `raw_country_original` | Step 1 | Pre-crosswalk country string |
| `parsed_year` | Step 2 | Collection year (integer) |
| `date_parse_status` | Step 2 | How the year was parsed |
| `canonical_organism` | Step 3 | Harmonized species (or `unidentified_pathogen`) |
| `original_organism_name` | Step 3 | SOAR 207965 original name (nullable) |
| `pathogen_type` | Step 3 | `bacterial` or `fungal` |
| `canonical_drug` | Step 4 | Harmonized drug (or `UNRESOLVED` for DIN) |
| `raw_drug_identifier` | Step 4 | Original column name or code |
| `dosing_variant` | Step 4 | `standard` / `fixed_2ug` (207965 amox/clav only) |
| `mic_comparator` | Step 5 | `<=`, `>`, or `=` |
| `mic_value` | Step 5 | Numeric MIC on log2 scale |
| `mic_source_notation_raw` | Step 5 | Original MIC string before parsing |
| `evaluable_flag` | Step 6 | `Y` / `N` (207965 only; null elsewhere) |
| `resistance_category` | Step 7 | S/I/R, WT/NWT, CLSI label, or documented non-call reason |
| `classification_basis` | Step 7 | How the category was determined (never null) |
| `beta_lactamase_raw` | Step 8 | `POS` / `NEG` (bacterial only) |
| `age_band` | Step 9 | `0-17` / `18-30` / `31-60` / `61+` |
| `age_continuous` | Step 9 | Continuous age (bacterial only) |

**Reading tip:** Always use `low_memory=False` (or `dtype={"isolate_id": str}`) when loading CSVs with pandas — mixed numeric/alphanumeric isolate IDs can silently inflate `nunique()` counts otherwise.

---

## 9. Row-Count Reconciliation

For each source cohort, every raw isolate is accounted for:

```
raw_rows = analysis_ready_in_master
         + organism_excluded        (Step 3)
         + evaluable_excluded       (Step 6 / Step 10; Evaluable=N)
         + zero_measurement         (no drug data; long format cannot represent)
         + duplicates_removed       (always 0; candidates logged only)
```

**SOAR_207965 example:** 3,134 = 2,521 + 29 + 584 + 0

The isolate registry round-trips to raw row counts (34,787 = sum of all four source files).

---

## 10. Design Principles

1. **Versioned artifacts** — Every crosswalk, log, and output carries `version` and `date_added`. Corrections produce new versions, not silent in-place edits.
2. **Fail fast** — Each step's Check hard-stops the pipeline on failure.
3. **Nothing downstream on unverified upstream** — Tier order enforces dependency integrity.
4. **Log exclusions, never silently drop** — Every removed or flagged isolate has a row in an exceptions log.
5. **Never fabricate** — Missing breakpoints, unresolved drug codes, and unclassifiable fungal pairs get explicit non-result categories, not guessed values.
6. **Passthrough fields preserved** — Raw country, raw MIC notation, original organism name, and evaluable flag are retained alongside harmonized values.

---

## 11. What This Pipeline Does Not Do

| Out of scope | Notes |
|--------------|-------|
| Downstream analytics | Life expectancy regressions, clustering, and other analysis run on top of this table |
| Joining external reference datasets | e.g. ESAC-Net, vaccination coverage, health-system indices, R&D Hub |
| Wide-format pivot tables | Master is long format by design |
| Auto-removal of duplicate isolates | Logged for manual review only |
| Bacterial CLSI breakpoints | EUCAST only for bacterial classification |
| Complete fungal ECV coverage | ~9 species with ECV values vs 200 SENTRY species |
| Modifying raw inputs | `raw_inputs/` is read-only from the pipeline's perspective |

---

## 12. Downstream Usage Notes

When building analysis on the master table:

1. **Filter Evaluable=N** — Use `isolate_registry_v1.csv` or filter `evaluable_flag != "N"` (master already excludes these isolates).
2. **Exclude DIN / UNRESOLVED** — Filter `canonical_drug != "UNRESOLVED"` for cross-cohort drug comparisons. The crosswalk marks DIN for exclusion; downstream must enforce this (the flag is not yet a master-table column).
3. **Use `classification_basis` with `resistance_category`** — Only rows with bacterial `EUCAST_v*_breakpoint` basis (or fungal `CLSI_breakpoint`) carry interpretable S/I/R calls. Many rows carry footnote or coverage-gap strings in `resistance_category`.
4. **Isolate-level vs row-level aggregation** — SOAR 207965 can produce two master rows per isolate for `amoxicillin/clavulanate` (dosing variants). Use `isolate_id` for isolate-level rates.
5. **Treat CDN as provisional** — Cefdinir mapping is strong internal evidence but not data-dictionary-confirmed.
6. **SENTRY species** — 200 raw fungal species labels; no organism crosswalk. ECV/classification coverage is sparse outside top species.

---

## 13. Requirements

- **Python 3** with `pandas` and `openpyxl` (for `.xlsx` reading).
- All six raw input files present under `raw_inputs/` (see [`raw_inputs/README.md`](raw_inputs/README.md)).
- Run from repository root or any directory; `run_pipeline.py` resolves paths relative to `preprocessing_pipeline/`.

---

## 14. Further Reading

Every step script under [`src/`](src/) opens with a docstring describing what problem it solves, what it does about it, and how it checks its own work (Issue / Action / Check). Read the script itself for the full rationale behind any given step.

See also [`docs/appendix_5_identifiability_bounds_methodology.md`](docs/appendix_5_identifiability_bounds_methodology.md) (the Manski-bounds methodology used by both Step 8 and Step 11) and [`docs/SECTION_6_ANALYTIC_METHODOLOGY_PLAN.md`](docs/SECTION_6_ANALYTIC_METHODOLOGY_PLAN.md) (the analytic-layer plan that Steps 11–12 implement).

---

## 15. Section 6 Stage 1 — Descriptive Profiling (`step11_descriptive.py`)

Sections 1–14 above document the **Section 5 preprocessing pipeline** (Steps 1–10, run automatically by `run_pipeline.py`). This section documents a separate, later addition: the first stage of **Section 6, "Analytic Methodology"** — a distinct analytic layer that consumes the finished master table rather than building it. Per `docs/SECTION_6_ANALYTIC_METHODOLOGY_PLAN.md`, Section 6 stages "run once the Section 5 preprocessing pipeline has produced the master isolate-drug table." Accordingly, `step11_descriptive.py` is **not** wired into `run_pipeline.py`'s Tier A–D sequence — it is run manually, after a successful full pipeline run:

```bash
cd preprocessing_pipeline
python src/step11_descriptive.py
```

It follows the same Issue → Action → Check pattern, path conventions, and versioned-artifact discipline as Steps 1–10 (§6, §10).

### 15.1 What it does

Computes resistance rates (bacteria) and susceptibility rates (fungi), per Justice's Section 6 Stage 1 spec: "resistance rates by organism, drug class, country, year, and body site for bacteria; susceptibility rates by species, drug class, country, year, and specimen source for fungi." Because the master table under-determines every rate (only some isolates are ever tested against any given drug), every rate is reported as a Manski (1989) worst-case partial-identification bound, following the same Case A/B methodology as Step 8 (`docs/appendix_5_identifiability_bounds_methodology.md`) — never as a bare point estimate.

### 15.2 Two gaps this step had to close

Neither of these is derivable from any existing pipeline output — both required new work:

1. **Body site / specimen source** — absent from `master_table_v1.csv` and `isolate_registry_v1.csv`. Re-joined directly from the four raw cohort files (`BODYLOCATION` in SOAR_201818, `BodyLocation` in SOAR_201910/SOAR_207965, `Source` in SENTRY), keyed on `(source_cohort, isolate_id)` using the same `normalize_isolate_id()` function `step10_master.py` uses to build the master table. The join rate is checked and must be 100% (Check a).
2. **Drug class** — no drug-class field or taxonomy exists anywhere in the pipeline, and Justice's text does not name a standard to use. This was surfaced to the user rather than assumed; per the user's explicit decision, a new pharmacological/chemical-class taxonomy was authored for this project. **It is not derived from any project data file or from Justice's text** — it is a standard antimicrobial classification (e.g. Aminopenicillin, Cephalosporin 2nd/3rd generation, Fluoroquinolone, Macrolide for bacteria; Echinocandin, Triazole, Polyene, Pyrimidine analogue for fungi) covering all 30 real `canonical_drug` values. It is written out as `crosswalks/drug_class_crosswalk_v1.csv` so it is inspectable and versioned like every other crosswalk in this pipeline, not buried in code.

### 15.3 N / T / P bounds methodology

For each stratum (organism × drug [× dosing_variant] × country × year × body-site/specimen-source):

- **N** = all isolates of that organism/species in that country-year-site combination, regardless of whether the specific drug was tested.
- **T** = subset of N with an interpretable classification for that specific drug (`classification_basis` is a real breakpoint/ECV basis, not a non-result reason).
- **P** = subset of T with the "positive event" — Resistant for bacteria, Susceptible for fungi (Justice's fungal framing is a susceptibility rate, the flipped direction from the bacterial resistance rate).

| Bound | Formula | Reported |
|-------|---------|----------|
| Tier 1 (assumption-free) | `[P/N, (P+N-T)/N]` | Always |
| Tier 2 (testing-monotonicity) | `[P/N, P/T]` | Only alongside an explicit assumption-label column (`tier2_bound_upper_assumes_monotonicity`); the fungal file states the assumption in the susceptible-event direction, not reused verbatim from the bacterial case |

`low_n_flag` marks strata with `n_tested < 30` (CLSI M39's published per-cell minimum, already cited in the plan's Part 3.1) — an annotation only, never used to drop or suppress a row.

**Grid completion ("annotate, don't suppress"):** strata with zero tested isolates for a drug are reported explicitly with `T=0` and the fully uninformative Tier 1 bound `[0%, 100%]`, rather than omitted — matching appendix_5's own treatment of this case as a stated finding, not a gap to hide. The grid is restricted to (organism/species, drug) pairs that are ever measured for that organism somewhere in the data, not a full cross of every drug against every organism.

**Degenerate case excluded by design:** per appendix_5 §5.8, itraconazole, posaconazole, and flucytosine have zero rows under `CLSI_breakpoint` basis (T=0 structurally, for every stratum) — a Manski bound for these three would be the meaningless `[0%,100%]` for every row, so Stage 1 does not compute one for them under the CLSI tier at all. Confirmed empirically and enforced by a Check that zero rows for these three drugs appear in `descriptive_fungal_susceptibility_v1.csv`.

**WT/NWT kept separate from S/I/R:** per `step07_classification.py`'s own design note, an ECV-based wild-type/non-wild-type call is a population-membership statement, not a clinical susceptible/resistant call, and must never be pooled with CLSI-based S/I/R calls. Stage 1 enforces this by writing the two fungal tiers to entirely separate files — `descriptive_fungal_susceptibility_v1.csv` (CLSI tier) and `descriptive_fungal_ecv_wt_rate_v1.csv` (ECV tier, explicitly labeled "NOT a susceptibility rate").

### 15.4 Outputs

| File | Rows (latest run) | Grain |
|------|-------------------:|-------|
| `crosswalks/drug_class_crosswalk_v1.csv` | 30 | One row per `canonical_drug` |
| `bounds/descriptive_bacterial_resistance_v1.csv` | 9,901 | organism × drug × dosing_variant × country × year × body_site |
| `bounds/descriptive_bacterial_resistance_by_class_v1.csv` | 5,141 | organism × drug_class × country × year × body_site |
| `bounds/descriptive_fungal_susceptibility_v1.csv` | 21,365 | species × drug × country × year × specimen_source (CLSI tier) |
| `bounds/descriptive_fungal_susceptibility_by_class_v1.csv` | 9,190 | species × drug_class × country × year × specimen_source (CLSI tier) |
| `bounds/descriptive_fungal_ecv_wt_rate_v1.csv` | 24,290 | species × drug × country × year × specimen_source (ECV tier — NOT a susceptibility rate) |

Every row carries `n_isolates_in_stratum` (N), `n_tested` (T), the outcome counts that sum to T, `coverage_t_over_n`, `tier1_bound_lower/upper`, `tier1_width`, `tier2_bound_upper_assumes_monotonicity`, `low_n_flag`, `version`, and `date_added` — the same versioning convention as every Section 5 artifact (Design Principle 1, §10).

### 15.5 Verification performed

All of the step's own Checks pass: the body-site/specimen-source join rate (100%), P≤T≤N invariants on every row, the three-drug degenerate-case exclusion, and exact `DRUG_CLASS_TABLE` coverage of all 30 real `canonical_drug` values.

Beyond the step's own Checks, two independent from-scratch recomputations — not reusing any of `step11_descriptive.py`'s own logic, only its shared `normalize_isolate_id()` join key — were run directly against the master table and matched the script's output exactly:

- Bacterial: *H. influenzae* / ampicillin / TUR / 2020 / Respiratory:Sputum — N=215, T=215, P=29.
- Fungal: *C. albicans* / Caspofungin / USA / 2010 / Blood culture — N=211, T=211, P=211.

### 15.6 Downstream usage notes specific to this step

1. **The drug-class crosswalk is authored, not sourced.** It is a standard pharmacological classification written for this project, not extracted from any Vivli file or from Justice's text. Treat it with the same scrutiny as any other analyst-authored taxonomy, and revise its `version` if the classification scheme changes.
2. **Never merge the CLSI and ECV fungal files.** `descriptive_fungal_susceptibility_v1.csv` and `descriptive_fungal_ecv_wt_rate_v1.csv` answer different questions (clinical outcome vs. population membership) and use different denominators.
3. **A `[0%, 100%]` Tier 1 bound with `n_tested=0` is a real, reportable finding** — no isolates were ever tested against that drug in that stratum — not an error or a missing row.
4. **`dosing_variant` follows the master table's own convention:** empty string for all drugs except amoxicillin/clavulanate, never a sentinel value. Read with `dtype=str` (or an explicit `keep_default_na=False`) to avoid pandas silently parsing a blank cell as NaN and misgrouping rows in a `groupby`/`merge`.

---

## 16. Section 6 Stage 2 — Evolutionary Layer (`step12_evolutionary.py`)

Like Stage 1, this is part of the separate **Section 6 analytic layer** (§15's opening paragraph), not the automatic Section 5 pipeline. It is run manually, after Stage 1 (it does not depend on Stage 1's output, but follows the same numbering convention):

```bash
cd preprocessing_pipeline
python src/step12_evolutionary.py
```

It follows the same Issue → Action → Check pattern, path conventions, and versioned-artifact discipline as Steps 1–10 and Step 11 (§6, §10, §15).

### 16.1 What it does

Computes an **Evolutionary Distance-to-Failure** and **Evolutionary Fitness Score** per Justice's Section 6 Stage 2 spec, tracking how far a country-organism-drug combination's typical MIC sits from a resistance/non-wild-type threshold, and whether that margin is growing or shrinking year over year. Neither term is established terminology in any CLSI/EUCAST/WHO GLASS source (confirmed by research recorded in `docs/SECTION_6_ANALYTIC_METHODOLOGY_PLAN.md`) — this step's operational definitions were resolved via three explicit decisions put to the user, since the plan document itself flags them as requiring sign-off rather than an assumption:

1. **Anchor point (what "failure" means):** hybrid — the EUCAST clinical resistance breakpoint (`R >`) for bacteria, the published ECV for fungi. No ECOFF table exists locally for either pathogen type (confirmed by direct inspection of `crosswalks/eucast_breakpoint_table_v1.csv` and the raw EUCAST workbooks), and no numeric fungal CLSI breakpoint value is stored locally at all — SENTRY supplies a pre-computed CLSI category directly, never a parseable threshold — so ECV is the only numerically groundable fungal anchor, not merely the preferred one.
2. **Density threshold:** no fixed cutoff. Every (country, organism, drug[, dosing_variant]) combination with ≥2 distinct qualifying years is computed; low-density years/trends are annotated (`low_n_flag` / `low_density_flag`), never excluded — reusing Stage 1's `MIN_N_FOR_RELIABLE_RATE` constant and "annotate, don't suppress" precedent directly.
3. **Score formula:** Distance-to-Failure = median `log2(anchor) − log2(mic_value)` across isolates in a (country, organism, drug[, dosing_variant], year) cell; Evolutionary Fitness Score = the year-over-year OLS slope of that yearly median, fit against real calendar years.

Justice's text names six SOAR longitudinal countries (Ukraine, Turkey, Tunisia, Pakistan, Kuwait, Vietnam) plus "SENTRY country-years with sufficient density." Per decision 2, this step does not gate the grid on that named list — every combination meeting the ≥2-year threshold is computed uniformly, SOAR or SENTRY alike.

### 16.2 Anchor resolution (reused, not re-derived)

- **Bacterial:** `eucast_breakpoints._ensure_loaded_for_version(version)["resolved"][(organism, drug)]["r_gt"]`, where `version` is looked up **per isolate** via `eucast_version_for_cohort(source_cohort)` — EUCAST version is fixed per `source_cohort`, not per calendar year (`crosswalks/eucast_cohort_version_map_v1.csv`), so each isolate is normalized against the standard actually in force for its own cohort before aggregation. Confirmed directly: 82,162 of 111,545 bacterial rows (73.7%) resolve a numeric anchor; the remainder is `no_drug_match`, EUCAST Note 8 (`not_recommended`), or footnote-only cells — genuine EUCAST realities, not a pipeline gap, and printed as an exclusion breakdown rather than silently dropped.
- **Fungal:** `step07_classification.lookup_ecv(species, drug)`. Confirmed directly: 88,224 of 229,373 fungal rows (38.5%) resolve a numeric ECV. **Anidulafungin, Caspofungin, and Micafungin (the three echinocandins) structurally cannot get a Distance-to-Failure** — `ECV_TABLE` has zero echinocandin entries, and no numeric CLSI breakpoint is stored locally either (only the pre-computed S/I/R category is). Enforced by a Check that zero rows for these three drugs appear in the fungal output, mirroring Step 11's/Step 7's degenerate-drug handling.

A `mixed_breakpoint_versions_in_cell` flag (bacterial only) guards against Sallam 2025's "breakpoint drift" confound — a cell drawing isolates from more than one EUCAST version could show a shift that is a table-revision artifact, not a real population change. Confirmed empirically before writing this step: 0 of 2,049 (country, organism, drug, year) cells mix versions in the current data, so the flag currently always reads `False` — it is computed live per run, not hardcoded, as a safeguard against future data that does mix versions within a cell. No fungal equivalent exists (ECV_TABLE is not year-versioned in this pipeline).

**Unlike Stage 1, this step does not complete a full candidate-pair × stratum grid.** A zero-isolate cell has no MIC distribution to take a median of — there is no equivalent to Stage 1's informative `[0%, 100%]` bound at `n=0`. Only (country, organism, drug[, dosing_variant], year) cells with ≥1 contributing isolate are emitted.

### 16.3 Outputs

| File | Rows (latest run) | Grain |
|------|-------------------:|-------|
| `bounds/evolutionary_bacterial_distance_v1.csv` | 2,082 | organism × drug × dosing_variant × country × year |
| `bounds/evolutionary_bacterial_fitness_score_v1.csv` | 630 | organism × drug × dosing_variant × country (≥2 qualifying years each) |
| `bounds/evolutionary_fungal_distance_v1.csv` | 9,574 | species × drug × country × year |
| `bounds/evolutionary_fungal_fitness_score_v1.csv` | 1,365 | species × drug × country (≥2 qualifying years each) |

Distance-cell files carry `n_isolates`, `median_distance_to_failure`, `low_n_flag`, `version`, `date_added` (plus `mixed_breakpoint_versions_in_cell` for bacteria only). Fitness-score files carry `n_years`, `first_year`, `last_year`, `total_n_isolates`, `min_n_isolates_across_years`, `evolutionary_fitness_score_slope`, `intercept`, `pearson_r`, `low_density_flag`, `version`, `date_added`.

**Sign convention:** `distance = log2(anchor) − log2(mic_value)`. Positive = margin remaining before the resistance/non-wild-type threshold; zero or negative = at or past it. A negative `evolutionary_fitness_score_slope` means that margin is eroding year over year (evolving toward resistance); positive means it is growing.

### 16.4 Verification performed

All of the step's own Checks pass: anchor values fall on the cited MIC dilution series, every emitted distance value is finite, every fitness-score row rests on ≥2 distinct years, and zero echinocandin rows appear in the fungal output.

Beyond the step's own Checks, two independent from-scratch recomputations — reading `master_table_v1.csv` directly and calling only the shared `eucast_breakpoints`/`step07_classification` lookup functions, never `step12_evolutionary.py`'s own aggregation code — matched the script's output exactly, including a degenerate flat-trend case:

- Bacterial: TUR / *Haemophilus influenzae* / amoxicillin — 6 years (2016–2021), slope = −0.014286, intercept = 30.585714, matching to 6 decimal places.
- Fungal: USA / *Candida albicans* / Posaconazole — 15 years (2010–2024) of a constant yearly median distance (1.0), correctly producing slope = 0.0 and `pearson_r = NaN` (zero variance is a real degenerate fit, not a bug).

### 16.5 Downstream usage notes specific to this step

1. **A missing Distance-to-Failure for Anidulafungin/Caspofungin/Micafungin is a structural data gap, not an omission** — no numeric anchor (ECV or CLSI) exists locally for any echinocandin. Do not interpret their absence from the output as "no resistance trend."
2. **`mixed_breakpoint_versions_in_cell` currently always reads `False`.** That reflects the current data (0 of 2,049 cells), not a guarantee — re-check this flag after any raw-data refresh that could change cohort/year overlap.
3. **A `pearson_r` of `NaN` means a degenerate fit** (zero variance in years or in yearly medians), not a failed computation — check `evolutionary_fitness_score_slope` and `n_years` directly in that case.
4. **This stage does not stratify by body site/specimen source** — Justice's Stage 2 spec names only country-organism-drug, unlike Stage 1. Isolates carrying more than one dosing variant or appearing via unresolved cross-cohort overlaps are handled identically to Stage 1 (dosing variant kept as a grouping key; overlaps never deduplicated).

---

## 17. Section 6 Stage 3 — Clustering (`step13_clustering.py`)

```bash
cd preprocessing_pipeline
python src/step13_clustering.py
```

Unsupervised clustering on combined static-burden + evolutionary-trajectory feature vectors, run separately for bacteria and fungi (Justice Section 6, Stage 3). Features per (country, organism, drug): volume-weighted Tier-1 bound midpoint (bacterial resistance; fungal `1 − WT` midpoint from the ECV tier to align with ECV-anchored Stage 2 distances) and the Stage 2 Evolutionary Fitness Score slope. Ward hierarchical clustering on standardized features; k selected by maximum mean silhouette over k ∈ {2, …, 8}.

| File | Rows (latest run) | Grain |
|------|-------------------:|-------|
| `bounds/cluster_bacterial_assignments_v1.csv` | 620 | country × organism × drug |
| `bounds/cluster_fungal_assignments_v1.csv` | 1,288 | country × organism × drug |
| `bounds/cluster_diagnostics_v1.csv` | — | silhouette by k (both pathogen types) |

Selected k (latest run): bacterial k=5, fungal k=4.

---

## 18. Section 6 Stage 4 — External Data Join (`step14_external_join.py`)

```bash
cd preprocessing_pipeline
python src/step14_external_join.py
```

Merges country-year AMR burden and evolutionary trajectory (from Stages 1–2) with external covariates via the project ISO3 crosswalk:

| Source | Variable | Notes |
|--------|----------|-------|
| World Bank WDI | `life_expectancy` | 217 Region-filtered countries |
| World Bank WDI | `health_expenditure_pct_gdp` | `SH.XPD.CHEX.GD.ZS` only |
| WHO/UNICEF | `hib3_coverage_pct`, `pcvc_coverage_pct` | Bacteria only; WUENIC > OFFICIAL > ADMIN |
| ESAC-Net | `antimicrobial_consumption_ddd` | **Null throughout** — only metadata exists locally |

GBD SDI and GBD 2021 LRI are **not** joined (scope flags in plan — not user-approved). Fungal burden uses ECV-tier WT/NWT rates to pair with ECV-based distance. `n_isolates_in_stratum` is deduplicated (summed once per organism-site stratum, not per drug row). Trajectory covariate is `mean_evolutionary_fitness_slope` (Stage 2 fitness slope — same definition as Stage 3 clustering).

| File | Rows (latest run) |
|------|-------------------:|
| `bounds/external_join_bacterial_country_year_v1.csv` | 99 |
| `bounds/external_join_fungal_country_year_v1.csv` | 413 |

---

## 19. Section 6 Stage 5 — Association Analysis (`step15_association.py`)

```bash
cd preprocessing_pipeline
python src/step15_association.py
```

Pooled country-year OLS of life expectancy on burden, `mean_evolutionary_fitness_slope`, health expenditure, and (bacteria only) Hib3 + PCVC coverage, with year as a control. Consumption omitted (no numeric series). HC1 robust standard errors. **Read as suggestive association only** — Justice Section 8; no causal attribution.

| File | Contents |
|------|----------|
| `bounds/association_ols_coefficients_v1.csv` | Term-level coefficients, robust SEs, p-values |
| `bounds/association_model_metadata_v1.csv` | n, R², limitation text |

Latest complete-case n (post-audit fix): bacterial 67, fungal 291.

---

## 20. Section 6 Stage 6 — R&D Alignment Check (`step16_rd_alignment.py`)

```bash
cd preprocessing_pipeline
python src/step16_rd_alignment.py
```

Compares Global AMR R&D Hub funding (pro-rated `Amount USD` per infectious-agent tag, then split equally across matched surveillance organisms) against Stage 1 descriptive burden by organism. Fungal burden uses ECV-tier rates (same as Stages 13–14). Bacterial burden covers only organisms with EUCAST-tier rates (H. influenzae, S. pneumoniae). Spearman rank correlation reported with caveat that no AMR precedent was found for this exact comparison.

| File | Contents |
|------|----------|
| `bounds/rd_alignment_bacterial_by_organism_v1.csv` | Organism-level burden vs matched funding |
| `bounds/rd_alignment_fungal_by_organism_v1.csv` | Organism-level burden vs matched funding |
| `bounds/rd_alignment_summary_v1.csv` | Pathogen-type totals + Spearman rho |

---

## 21. Section 6 Stage 7 — Intervention Impact (`step17_intervention.py`)

```bash
cd preprocessing_pipeline
python src/step17_intervention.py
```

Illustrative intervention scenarios from Stage 5 OLS coefficients (vaccination LE gain per 1pp coverage; +10pp flagged when magnitude exceeds 2 years). Vaccination event study uses pre/post windows around vaccine introduction; resistance change is only computed when AMR surveillance data exist in both windows (otherwise `resistance_window_status` documents the gap). Stewardship, diagnostics, WASH/IPC gaps documented; fungal vaccination excluded by design.

| File | Contents |
|------|----------|
| `bounds/intervention_impact_by_category_v1.csv` | Per-category LE scenarios and data-gap flags |
| `bounds/intervention_vaccination_event_study_v1.csv` | Hib/PCV before-after LE and resistance windows |

---

## 22. Section 7 — Expected Outputs (`step18_section7_deliverables.py`)

```bash
cd preprocessing_pipeline
python src/step18_section7_deliverables.py
```

Packages Justice's six Section 7 deliverables (`docs/_justice_idea_raw_dump.txt` lines 106–111) from Section 5 artifacts and Section 6 Stages 1–7 outputs. No new modeling — only documented aggregation, compilation, and ranking rules recorded in each file's `methodology` column.

| Justice # | Deliverable | Output file(s) |
|-----------|-------------|----------------|
| 1 | Harmonized dual-pathogen dataset + crosswalks | `deliverables/dataset_manifest_v1.csv` |
| 2 | Identifiability ledger | `deliverables/identifiability_ledger_v1.csv` |
| 3 | Cluster typology (high burden / high trajectory) | `deliverables/cluster_typology_bacterial_v1.csv`, `cluster_typology_fungal_v1.csv` |
| 4 | Country risk ranking | `deliverables/country_risk_ranking_bacterial_v1.csv`, `country_risk_ranking_fungal_v1.csv` |
| 5 | Funding-gap summary | `deliverables/funding_gap_summary_v1.csv` |
| 6 | Ranked intervention recommendations | `deliverables/intervention_recommendations_ranked_v1.csv` |

Index mapping all six outputs: `deliverables/section7_deliverables_index_v1.csv`.

**Methodology notes (no hallucinated data):**
- Country risk ranking uses burden, evolutionary trajectory, and health expenditure only — **consumption omitted** (no numeric ESAC-Net series locally) and **vaccination omitted** (not named in Justice Output 4, line 109).
- Cluster typology labels combinations in the top quartile of static burden and/or negative fitness-slope risk.
- Intervention ranking covers only measured vaccination scenarios; stewardship/diagnostics/WASH/IPC gaps carry null rank.

**Full Section 6 + 7 manual run order** (after a successful `run_pipeline.py`):

```bash
cd preprocessing_pipeline
python src/step11_descriptive.py
python src/step12_evolutionary.py
python src/step13_clustering.py
python src/step14_external_join.py
python src/step15_association.py
python src/step16_rd_alignment.py
python src/step17_intervention.py
python src/step18_section7_deliverables.py
```

See also [`deliverables/README.md`](deliverables/README.md).
