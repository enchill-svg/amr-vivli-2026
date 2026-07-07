# Preprocessing Pipeline

## In plain terms

Hospitals and labs around the world test bacteria and fungi taken from sick patients to see which drugs still work against them — this is how doctors track antimicrobial resistance (AMR), the growing problem of infections becoming harder to treat with existing drugs. This project combines four such testing datasets (three covering bacteria, one covering fungi) into one clean, combined spreadsheet that researchers can use to study resistance trends.

The problem is that the four original datasets don't agree on how to spell things. One file calls a country "Slovak Republic," another calls it "Slovakia." One file writes a lab measurement as "<=0.06," another writes the same kind of measurement as "<0.008." One file gives a drug a two-letter code, another spells out its full name. Before these files can be compared or combined, all of that has to be translated into one consistent set of labels — that's what this pipeline does. It also decides, using published medical thresholds, whether each result counts as "resistant," "susceptible," or "not enough information to tell," and it keeps a written record of every row it excludes and why, so nothing disappears unexplained.

The output is one combined table where each row is "one patient sample tested against one drug," ready to be analyzed. This pipeline does not do that later analysis (e.g., trends over time, life-expectancy comparisons) — it only prepares the data.

**Status:** Implemented and passing all built-in checks.

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
│   └── pipeline_acceptance_check.py
├── master/                   ← primary outputs
├── crosswalks/               ← harmonization tables
├── bounds/                   ← interval / classification summaries
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
