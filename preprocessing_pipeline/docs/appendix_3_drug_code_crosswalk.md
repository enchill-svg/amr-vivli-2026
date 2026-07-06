# Appendix 3: Antibiotic/Antifungal Code & Name Crosswalk

**Addresses:** Section 5, Step 4 ("Antibiotic/antifungal code crosswalk") of Justice's
preprocessing pipeline.

**Scope boundary:** this appendix resolves drug *identifiers* (codes and full names)
across all four raw cohort files to one canonical drug name each. It does not address
MIC-string parsing (Step 5), evaluability filtering (Step 6), breakpoint/ECV
classification (Step 7), or any downstream analytic methodology (Section 6) — those
are separate steps/appendices and are out of scope here. Where this appendix's
resolution status feeds directly into one of those later steps (chiefly Step 7's
fungal-classification problem), a pointer is given but the methodology itself is not
re-derived.

---

## 0. Canonical Naming Convention

To keep one name per drug across all cohorts, this appendix adopts the following
convention for `canonical_drug`:

- Lowercase, no underscores.
- Combination drugs written with a slash: `amoxicillin/clavulanate`,
  `trimethoprim/sulfamethoxazole`.
- No abbreviations in the canonical form — abbreviations (AMC, AZM, SXT, etc.) and
  underscore-joined names (`AMOXICILLIN_CLAVULANATE`, `TRIMETHOPRIM_SULFA`) are source
  artifacts, mapped to the canonical form, never used as the canonical form itself.
- One canonical name per distinct antibiotic/antifungal *molecule*. Dosing or
  breakpoint variants of the same molecule (see §3.2) are **not** given a separate
  canonical name — they are tagged as a variant of the same canonical drug.

This convention applies to the bacterial (SOAR) panel. The antifungal (SENTRY) panel
in §5 is a structurally disjoint drug class with no bacterial-panel overlap, so no
canonical-name collision is possible between the two panels; SENTRY drug names are
already unabbreviated and are carried through unchanged.

---

## 1. SOAR 201818 — Canonical Baseline (13 Full Drug Names, No Crosswalk Needed)

SOAR 201818's 13 drug columns are already full names and require no code resolution.
They are adopted as the canonical baseline that the other two SOAR cohorts' codes and
names are mapped onto.

| Raw column (SOAR 201818)     | Canonical name                    |
|-------------------------------|------------------------------------|
| AMOXICILLIN                   | amoxicillin                        |
| AMOXICILLIN_CLAVULANATE       | amoxicillin/clavulanate            |
| AMPICILLIN                    | ampicillin                         |
| AZITHROMYCIN                  | azithromycin                       |
| CEFACLOR                      | cefaclor                           |
| CEFTRIAXONE                   | ceftriaxone                        |
| CEFUROXIME                    | cefuroxime                         |
| CLARITHROMYCIN                | clarithromycin                     |
| ERYTHROMYCIN                  | erythromycin                       |
| LEVOFLOXACIN                  | levofloxacin                       |
| MOXIFLOXACIN                  | moxifloxacin                       |
| PENICILLIN                    | penicillin                         |
| TRIMETHOPRIM_SULFA             | trimethoprim/sulfamethoxazole      |

No action needed beyond lowercase/slash normalization; every one of these 13 strings
resolves to exactly one canonical drug with no ambiguity.

---

## 2. SOAR 201910 — 17 Abbreviated Codes Mapped to Canonical Names

SOAR 201910 uses 17 abbreviated codes in place of full drug names. 15 of the 17
resolve cleanly at high confidence; 1 (CDN) is provisional; 1 (DIN) is unresolved.

### 2.1 High-confidence codes (15)

These are standard CLSI/EUCAST-recognized abbreviations as used in this cohort's drug
panel; resolution confidence is high for all 15.

| Code | Canonical name                  |
|------|----------------------------------|
| AMC  | amoxicillin/clavulanate          |
| AMP  | ampicillin                       |
| AMX  | amoxicillin                      |
| AXO  | ceftriaxone                      |
| AZM  | azithromycin                     |
| CEC  | cefaclor                         |
| CLA  | clarithromycin                   |
| CXM  | cefuroxime                       |
| ERY  | erythromycin                     |
| FIX  | cefixime                         |
| LEV  | levofloxacin                     |
| MXF  | moxifloxacin                     |
| PEN  | penicillin                       |
| POD  | cefpodoxime                      |
| SXT  | trimethoprim/sulfamethoxazole    |

### 2.2 Provisional code: CDN

| Code | Canonical name (provisional) | Status                          |
|------|-------------------------------|----------------------------------|
| CDN  | cefdinir                      | Provisional — strongly supported, not dictionary-confirmed |

**Basis:** SOAR 207965 (a later cohort, 2018–2021, overlapping/succeeding SOAR
201910's 2015–2018 panel in GSK's evolving SOAR study series) has a full-name column
literally titled "Cefdinir" (see §3.1). Cefdinir is a real, commonly tested oral
cephalosporin discussed in published SOAR-series papers (confirmed via WebSearch this
session: SOAR papers on PubMed/Oxford Academic report cefdinir susceptibility by
country, e.g. the Pakistan SOAR paper). No direct GSK data-dictionary entry defining
"CDN" was located in this session's research. This internal cross-cohort evidence is
strong enough to use CDN=cefdinir in the crosswalk, but it must still carry a
"provisional" tag through the pipeline rather than being treated as dictionary-fact,
per Justice's own Step 4 instruction.

### 2.3 Unresolved code: DIN

> **DIN IS UNRESOLVED.** No public SOAR data dictionary defining "DIN" was located in
> this session's research. DIN must **not** be silently mapped to any drug, and must
> be **excluded from any cross-cohort comparison** until resolved against the
> original GSK data dictionary, per Justice's own Step 4 instruction ("mark ...  DIN
> unresolved, and exclude DIN from any cross-cohort comparison until resolved").

**Working hypothesis only (not a resolved fact):** SOAR 207965 introduces
"Doxycycline" and "Tetracycline" as new full-name drugs not present in SOAR 201818's
13-drug panel (see §3.1). SOAR 201910 introduces exactly two new codes beyond the 15
that resolve cleanly (CDN and DIN). If SOAR 201910's panel represents a transitional
stage of the same evolving GSK/SOAR panel that later became SOAR 207965's full-name
panel, DIN plausibly corresponds to one of `{doxycycline, tetracycline}`. This is a
hypothesis to test against the original GSK data dictionary if the team can obtain
it — it is explicitly **not** evidence strong enough to resolve DIN the way the
207965 "Cefdinir" column resolves CDN, because there is no single, unambiguous
207965 column bearing the string "DIN" the way there is a column literally named
"Cefdinir." Both `doxycycline` and `tetracycline` remain equally plausible candidates
under this hypothesis; nothing in the verified facts distinguishes between them.

**Pipeline handling:** DIN's 2,318/2,318 fully-populated MIC-style values (SOAR
201910, verified) must be retained in the source data and carried into the
crosswalk artifact with `canonical_drug = UNRESOLVED` and
`exclude_from_cross_cohort_comparison = TRUE` — never dropped, never guessed. This is
the same "flag, don't drop, don't guess" pattern Step 4's own check demands.

---

## 3. SOAR 207965 — 21 Full-Name Columns Mapped to Canonical Names

SOAR 207965 has 21 MIC/drug-result columns (verified; corrects Justice's stated
count of 20). All 21 are already full drug names, so name resolution itself is
straightforward — the only substantive issue is that one of the 21 columns is a
dosing/breakpoint variant of another, not a 21st distinct antibiotic (§3.2).

### 3.1 Standard mappings

| Raw column (SOAR 207965)              | Canonical name                  | Cross-cohort note                                          |
|-----------------------------------------|-----------------------------------|--------------------------------------------------------------|
| Amoxicillin                             | amoxicillin                       |                                                                |
| Amoxicillin Clavulanate                 | amoxicillin/clavulanate           | standard-dose variant — see §3.2                              |
| Amoxicillin Clavulanate fixed at 2       | amoxicillin/clavulanate           | dosing/breakpoint variant, **not** a distinct drug — see §3.2 |
| Ampicillin                               | ampicillin                        |                                                                |
| Azithromycin                             | azithromycin                      |                                                                |
| Cefaclor                                 | cefaclor                          |                                                                |
| Cefdinir                                 | cefdinir                          | anchor evidence for CDN=cefdinir in SOAR 201910 (§2.2)        |
| Cefixime                                 | cefixime                          | anchor for FIX in SOAR 201910                                 |
| Cefotaxime                               | cefotaxime                        | not tested in 201818 or 201910 — new to this cohort's panel   |
| Cefpodoxime                              | cefpodoxime                       | anchor for POD in SOAR 201910                                 |
| Ceftibuten                                | ceftibuten                        | not tested in 201818 or 201910 — new to this cohort's panel   |
| Ceftriaxone                              | ceftriaxone                       | anchor for AXO in SOAR 201910                                 |
| Cefuroxime                               | cefuroxime                        |                                                                |
| Clarithromycin                           | clarithromycin                    | anchor for CLA in SOAR 201910                                 |
| Doxycycline                              | doxycycline                       | not tested in 201818 or 201910 — candidate hypothesis target for unresolved DIN (§2.3); **not confirmed** |
| Erythromycin                             | erythromycin                      |                                                                |
| Levofloxacin                             | levofloxacin                      |                                                                |
| Moxifloxacin                             | moxifloxacin                      |                                                                |
| Penicillin                               | penicillin                        |                                                                |
| Tetracycline                             | tetracycline                      | not tested in 201818 or 201910 — candidate hypothesis target for unresolved DIN (§2.3); **not confirmed** |
| Trimethoprim Sulfa                       | trimethoprim/sulfamethoxazole      | anchor for SXT in SOAR 201910                                 |

### 3.2 Special handling: "Amoxicillin Clavulanate fixed at 2"

This column is a **dosing/breakpoint variant** of Amoxicillin Clavulanate (a
fixed-clavulanate-concentration testing convention, "fixed at 2"), not a
pharmacologically distinct antibiotic. Justice's own framing — "20 distinct
antibiotics" being defensible in substance even though the raw column count is 21 —
is the basis for this treatment.

**Pipeline instruction:**
- Map both `Amoxicillin Clavulanate` and `Amoxicillin Clavulanate fixed at 2` to the
  single canonical drug `amoxicillin/clavulanate`.
- Do **not** silently collapse the two raw columns into one MIC value — they are
  measured under different breakpoint/dosing conventions and their MIC values are not
  guaranteed to be numerically interchangeable.
- Carry a subsidiary field (e.g. `dosing_variant`) alongside `canonical_drug` in the
  Step 10 long-format master table: `dosing_variant = "standard"` for the plain
  Amoxicillin Clavulanate column, `dosing_variant = "fixed_2ug"` for the "fixed at 2"
  column. This preserves both measurements as two rows (one isolate-drug pair each)
  rather than discarding one or averaging them.
- Because SOAR 201818 (`AMOXICILLIN_CLAVULANATE`) and SOAR 201910 (`AMC`) only ever
  carry the standard-dose variant, any cross-cohort resistance-rate comparison for
  amoxicillin/clavulanate must state explicitly which SOAR 207965 dosing variant is
  being compared against the other two cohorts' single variant — comparing the
  "fixed at 2" variant against 201818/201910's standard variant without flagging the
  difference would silently conflate two different breakpoint conventions.

---

## 4. Master Cross-Cohort Drug Table

### 4.1 Drugs tested in more than one cohort

One row per canonical drug that appears in more than one of the three SOAR cohorts.
"Raw identifier" columns show the exact source-file column name/code, or "not
tested" if the cohort's panel does not include that drug.

| Canonical drug                     | SOAR 201818 (raw)         | SOAR 201910 (raw code)  | SOAR 207965 (raw column)                              | Cohorts testing it |
|-------------------------------------|-----------------------------|----------------------------|----------------------------------------------------------|----------------------|
| amoxicillin                         | AMOXICILLIN                 | AMX                         | Amoxicillin                                                | 3 / 3                |
| amoxicillin/clavulanate             | AMOXICILLIN_CLAVULANATE     | AMC                         | Amoxicillin Clavulanate (+ "fixed at 2" variant, §3.2)     | 3 / 3                |
| ampicillin                          | AMPICILLIN                  | AMP                         | Ampicillin                                                 | 3 / 3                |
| azithromycin                        | AZITHROMYCIN                | AZM                         | Azithromycin                                               | 3 / 3                |
| cefaclor                            | CEFACLOR                    | CEC                         | Cefaclor                                                   | 3 / 3                |
| cefdinir                            | not tested                  | CDN (provisional, §2.2)     | Cefdinir                                                   | 2 / 3                |
| cefixime                            | not tested                  | FIX                         | Cefixime                                                   | 2 / 3                |
| cefpodoxime                         | not tested                  | POD                         | Cefpodoxime                                                | 2 / 3                |
| ceftriaxone                         | CEFTRIAXONE                 | AXO                         | Ceftriaxone                                                | 3 / 3                |
| cefuroxime                          | CEFUROXIME                  | CXM                         | Cefuroxime                                                 | 3 / 3                |
| clarithromycin                      | CLARITHROMYCIN              | CLA                         | Clarithromycin                                             | 3 / 3                |
| erythromycin                        | ERYTHROMYCIN                | ERY                         | Erythromycin                                               | 3 / 3                |
| levofloxacin                        | LEVOFLOXACIN                | LEV                         | Levofloxacin                                               | 3 / 3                |
| moxifloxacin                        | MOXIFLOXACIN                | MXF                         | Moxifloxacin                                               | 3 / 3                |
| penicillin                          | PENICILLIN                  | PEN                         | Penicillin                                                 | 3 / 3                |
| trimethoprim/sulfamethoxazole       | TRIMETHOPRIM_SULFA           | SXT                         | Trimethoprim Sulfa                                         | 3 / 3                |

16 canonical drugs are shared across at least two of the three SOAR cohorts; 13 of
those 16 are tested in all three (the other 3 — cefdinir, cefixime, cefpodoxime — are
tested in SOAR 201910 and SOAR 207965 only, not SOAR 201818).

### 4.2 Drugs tested in only one cohort (listed for completeness)

These canonical drugs appear in exactly one cohort's panel and therefore have no
cross-cohort row in §4.1, but are included here so the crosswalk is exhaustive over
all identified drug columns.

| Canonical drug   | Cohort      | Raw identifier   | Note                                                        |
|-------------------|-------------|--------------------|--------------------------------------------------------------|
| cefotaxime         | SOAR 207965 | Cefotaxime          | not in 201818 or 201910 panel                                 |
| ceftibuten         | SOAR 207965 | Ceftibuten          | not in 201818 or 201910 panel                                 |
| doxycycline        | SOAR 207965 | Doxycycline         | not in 201818 or 201910 panel; candidate DIN hypothesis target (§2.3), unconfirmed |
| tetracycline       | SOAR 207965 | Tetracycline        | not in 201818 or 201910 panel; candidate DIN hypothesis target (§2.3), unconfirmed |

Together, §4.1 (16 shared drugs) + §4.2 (4 cohort-exclusive drugs) = **20 distinct
canonical antibacterial drugs** across the three SOAR cohorts — consistent with SOAR
207965 alone covering all 20 of them (its 21 raw columns collapse to 20 distinct
drugs once the "fixed at 2" dosing variant is accounted for, §3.2). This is an
arithmetic consequence of the verified facts above, not a new independently-verified
figure.

### 4.3 Unresolved code carried forward

| Code | Cohort      | Canonical drug | Status     |
|------|-------------|------------------|--------------|
| DIN  | SOAR 201910 | **UNRESOLVED**   | Excluded from all cross-cohort comparison until resolved (§2.3) |

DIN is deliberately excluded from both §4.1 and §4.2 — it is not yet known to be any
of the 20 canonical drugs listed there, and mapping it into either table would repeat
the exact silent-guess error Step 4's check forbids.

---

## 5. SENTRY Antifungal Panel (10 Drugs, Disjoint Drug Class)

The SENTRY/Vivli fungal file's 10 antifungals are a structurally disjoint drug class
from the SOAR bacterial panel (§1–§4) — there is no name or code overlap between the
two panels, so no crosswalk mapping is needed for the antifungals themselves. Each
antifungal is already recorded under one full, unambiguous name.

### 5.1 Drug list and column-pair convention

| Class          | Drugs                                                         |
|-----------------|------------------------------------------------------------------|
| Echinocandins    | Anidulafungin, Caspofungin, Micafungin                          |
| Azoles           | Isavuconazole, Fluconazole, Itraconazole, Voriconazole, Posaconazole |
| Other            | Amphotericin B, Flucytosine                                     |

Each of these 10 drugs is stored as a **pair** of columns in the source file:

- `"<Drug> (CLSI)"` — the numeric MIC value (float, mg/L).
- `"<Drug> (CLSI)_I"` — the CLSI categorical interpretation (Susceptible /
  Intermediate / Resistant).

### 5.2 Naming gotcha: "(CLSI)" vs "(CLSI)\_I"

**This is a column-naming trap that implementers must not miss:** the plain
`(CLSI)`-suffixed column is the raw MIC *value*, not a pre-computed category. Only
the `_I`-suffixed column (`(CLSI)_I`) holds the Susceptible/Intermediate/Resistant
interpretation. Code that reads `"Fluconazole (CLSI)"` expecting a category string
will instead get a numeric MIC and silently misbehave (e.g. treat every non-null
numeric value as "not missing category data"). Every pipeline step that consumes
antifungal classification must reference the `_I` column explicitly, never the plain
`(CLSI)` column.

### 5.3 Cross-reference to Step 7 (not re-derived here)

Four of these 10 drugs — itraconazole, posaconazole, flucytosine, amphotericin B —
have a `_I` (category) column that is 100%, 100%, 100%, and 99.5% null respectively
across all 26,922 SENTRY rows, even though the underlying MIC value is still
populated for most rows of the first three. This is a Step 7 classification problem
(no usable CLSI clinical-breakpoint category exists for these four drugs against the
tested species in this data; ECV-based classification or a reported MIC range is the
documented fallback), not a drug-identification problem — it is noted here only so
implementers building the crosswalk artifact do not mistake "100% null category
column" for "drug missing from the crosswalk." All 10 antifungal names resolve
cleanly; the resolution problem for these four is entirely downstream in
classification, addressed in the Step 7 appendix, not here.

---

## 6. Status Summary / Open Items

| Item                                                          | Status                                   | Action required                                                                 |
|------------------------------------------------------------------|---------------------------------------------|-------------------------------------------------------------------------------------|
| SOAR 201818's 13 full drug names                                 | Resolved (baseline, no mapping needed)      | None                                                                                 |
| SOAR 201910's 15 standard codes (AMC…SXT, excl. CDN/DIN)          | Resolved, high confidence                   | None                                                                                 |
| SOAR 201910's CDN code                                            | Provisional (strongly supported)            | Confirm against original GSK data dictionary if/when obtainable                     |
| SOAR 201910's DIN code                                            | **Unresolved**                              | Do not map; exclude from cross-cohort comparison; test doxycycline/tetracycline hypothesis against GSK data dictionary |
| SOAR 207965's 21 columns / 20 distinct drugs                      | Resolved                                    | None                                                                                 |
| SOAR 207965's "Amoxicillin Clavulanate fixed at 2" column         | Resolved as dosing variant, not new drug    | Tag with `dosing_variant` field per §3.2; flag in any cross-cohort amox/clav comparison |
| SENTRY's 10 antifungal names                                      | Resolved (already full names)               | None — implement `(CLSI)` vs `(CLSI)_I` naming discipline per §5.2                    |
| SENTRY's 4 drugs with unusable CLSI category column               | Out of scope here (Step 7 problem)          | See Step 7 appendix; not a drug-identification gap                                   |

---

## 7. Versioning and Change Control

Per Justice's Step 4 action item ("build/version a drug-code crosswalk"), this
appendix is the *design specification* for a versioned crosswalk artifact
(e.g. `drug_code_crosswalk_v1.csv`), not the artifact itself. The artifact should be
built as a long-format table, one row per raw identifier per cohort, with (at
minimum) the following fields:

| Field                                    | Description                                                                 |
|---------------------------------------------|---------------------------------------------------------------------------------|
| `cohort_id`                                | `SOAR_201818` \| `SOAR_201910` \| `SOAR_207965` \| `SENTRY`                     |
| `raw_identifier`                           | Verbatim raw column name or code as it appears in the source file               |
| `raw_identifier_kind`                      | `full_drug_name` \| `abbreviated_code`                                          |
| `canonical_drug`                           | Canonical drug name (§0), or `UNRESOLVED` if not yet mapped                      |
| `resolution_status`                        | `resolved` \| `provisional` \| `unresolved`                                     |
| `basis`                                    | One-line citation/reasoning for the mapping (e.g. "anchor: SOAR 207965 Cefdinir column") |
| `dosing_or_breakpoint_variant`             | Null, or a tag such as `fixed_2ug` (§3.2)                                        |
| `exclude_from_cross_cohort_comparison`     | Boolean; `TRUE` only for DIN at present                                         |
| `version`, `date_added`                    | Artifact version-control metadata                                               |

Every future change to this crosswalk (e.g. DIN's eventual resolution, or CDN's
promotion from "provisional" to "resolved" if a GSK data dictionary surfaces) should
be a new versioned row/revision of this artifact, not an in-place edit, so that any
analysis built on an earlier version remains reproducible against the crosswalk
version it actually used.
