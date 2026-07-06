# Appendix 1: Verified Data Facts

**Status:** Evidentiary record. Every figure below was produced this session by loading
each of the four raw source files directly (pandas) and counting from the actual data
— nothing here is assumed, carried forward from prior documentation, or estimated.
Where a fact from Justice's Section 5 could not be independently confirmed, or was
found to be incomplete/incorrect, that is stated explicitly in the Corrections section
rather than silently repeated.

**Scope:** This appendix documents the four raw cohort files only — SOAR 201818, SOAR
201910, SOAR 207965, and Vivli/SENTRY (fungal). It does not cover Section 3.2 external
data acquisition or Section 6 analytic methodology; those are out of scope for this
plan (see main plan document).

**How other documents should cite this appendix:** any number, column name, country
count, or organism count used elsewhere in the preprocessing-pipeline plan should trace
back to a specific entry in this document. If a number is needed that is not here, it
is a gap — flag it, do not backfill it from memory or inference.

---

## 1. SOAR 201818

**File path:** `AMR_Datasets/SOAR 201818/gsk_201818_published.csv`

**Shape:** 2,413 rows x 24 columns.

### Year range (per-year counts)

| Year | Rows |
|---|---|
| 2014 | 212 |
| 2015 | 2,040 |
| 2016 | 161 |

Range: 2014-2016. No gaps within this range; no out-of-range values observed.

### Countries (per-country counts) — all 9 flagged `REGION = "Europe"`

| Country | Rows |
|---|---|
| Russia | 558 |
| Czech Republic | 397 |
| Romania | 372 |
| Bulgaria | 237 |
| Ukraine | 196 |
| Slovak Republic | 193 |
| Croatia | 192 |
| Greece | 151 |
| Serbia | 117 |

### Organisms (counts)

| Organism | Rows |
|---|---|
| Streptococcus pneumoniae | 1,346 |
| Haemophilus influenzae | 1,067 |

No `OriginalOrganismName` / `FinalOrganismName` split exists in this file (unlike SOAR
207965) — there is a single organism field.

### Drug columns (13, full names — not abbreviated codes)

AMOXICILLIN, AMOXICILLIN_CLAVULANATE, AMPICILLIN, AZITHROMYCIN, CEFACLOR,
CEFTRIAXONE, CEFUROXIME, CLARITHROMYCIN, ERYTHROMYCIN, LEVOFLOXACIN, MOXIFLOXACIN,
PENICILLIN, TRIMETHOPRIM_SULFA.

### MIC notation

Lower/at-or-below censoring uses `"<="` (e.g. `"<=0.06"`). Upper censoring uses bare
`">"` (e.g. `">128"`).

### Other field-level facts

- `BETALACTAMASE` field: NaN = 1,345; NEG = 949; POS = 119 (out of 2,413 rows — NaN is
  55.7% of rows).
- No `Evaluable` Y/N flag exists in this file (unlike SOAR 207965).

---

## 2. SOAR 201910

**File path:** `AMR_Datasets/SOAR 201910/GSK_SOAR_201910 raw data.xlsx`

**Sheet name:** `"3550 valid MIC data (2)"` — this is a legacy label; the actual row
count is 2,318, not 3,550. This provenance mismatch (sheet name vs. real row count)
should be flagged to the team as a naming artifact, not corrected silently in any
downstream table.

**Shape:** 2,318 rows x 26 columns.

### Year range (per-year counts)

| Year | Rows |
|---|---|
| 2015 | 55 |
| 2016 | 1,382 |
| 2017 | 807 |
| 2018 | 73 |
| unparseable | 1 |

Range: 2015-2018. 1 row's Collection Date value could not be parsed into a year at
all (see Collection Date type-mixing note below).

### Countries (per-country counts — counts given only where verified this session; others listed by name only, count not separately captured)

| Country | Rows |
|---|---|
| Argentina | 363 |
| Chile | 150 |
| Costa Rica | 54 |
| Ghana | 2 |
| Kenya | 44 |
| Lebanon | 21 |
| Morocco | 23 |
| Nigeria | 4 |
| Tunisia | 153 |
| Cambodia | (not separately captured this session) |
| Kuwait | (not separately captured this session) |
| Pakistan | (not separately captured this session) |
| Philippines | (not separately captured this session) |
| Saudi Arabia | (not separately captured this session) |
| Singapore | (not separately captured this session) |
| Turkey | (not separately captured this session) |
| Ukraine | (not separately captured this session) |
| Vietnam | (not separately captured this session) |

18 countries total. **Ghana = 2 rows and Nigeria = 4 rows are by far the thinnest
country groups in this file** — flagged explicitly per the source-of-truth block: any
Ghana- or West-Africa-specific claim drawn from this cohort alone would rest on an
extremely small base and should be labeled as such wherever it appears downstream.

Regional composition (see Corrections section below for the full correction to
Justice's "Europe, Middle East, Asia" framing): only Ukraine is squarely Europe;
Turkey is transcontinental; 3 countries are Middle East (Kuwait, Saudi Arabia,
Lebanon); 5 are Asia (Vietnam, Pakistan, Singapore, Cambodia, Philippines); **5 are
African (Kenya 44, Tunisia 153, Morocco 23, Nigeria 4, Ghana 2)** — a region Justice's
original text never mentions for this cohort.

### Organisms (counts)

| Organism | Rows |
|---|---|
| Haemophilus influenzae | 1,071 |
| Streptococcus pneumoniae | 1,068 |
| Escherichia coli | 106 |
| Klebsiella pneumoniae | 73 |

### Drug columns (17, abbreviated codes)

AMC, AMP, AMX, AXO, AZM, CDN, CEC, CLA, CXM, DIN, ERY, FIX, LEV, MXF, PEN, POD, SXT.

Resolution status per Section 5, Step 4 and the drug-code research findings:

| Code | Status |
|---|---|
| AMC, AMP, AMX, AXO, AZM, CEC, CLA, CXM, ERY, FIX, LEV, MXF, PEN, POD, SXT | Resolve cleanly (15 codes) |
| CDN | Strongly supported as cefdinir (see Section 4B below) — not a bare data-dictionary confirmation, but strong internal cross-cohort evidence. Still to be labeled provisional pending direct data-dictionary confirmation. |
| DIN | Unresolved. No public SOAR data dictionary located. A hypothesis (doxycycline or tetracycline) exists but is not a fact — see Section 4B. Must be excluded from cross-cohort comparison until resolved, per Justice's own instruction. |

CDN and DIN each have 2,318/2,318 non-null values (fully populated — no missingness),
holding the same MIC-style strings as the other 15 codes.

### MIC notation

`"</="` (e.g. `"</= 0.06"`); bare `">"` upper-censoring also present.

### Collection Date — verified type-mixing within a single column

Three distinct real value types coexist in the same `Collection Date` column:

| Value type | Row count | Example |
|---|---|---|
| String date, format DD-Mon-YY | 963 | `"15-Dec-16"` |
| Python/Excel datetime objects | 936 | (native datetime) |
| Plain 4-digit-year integers | 419 | values only in {2015, 2016, 2017, 2018} |

Naively treating the 419 integer values as Excel serial-date numbers (origin
1899-12-30) produces nonsense dates clustered around 1905-07-07 through 1905-07-10 —
confirmed this session, not hypothetical. This is the concrete failure mode Step 2
must guard against by parsing per actual runtime type rather than one blanket parser.

### Other field-level facts

- A `Betalactamase` column exists in the schema for this file, but no null/NEG/POS
  breakdown for it was part of the verification claims checked this session — this is
  a gap, not a zero. Do not assume it mirrors SOAR 201818 or SOAR 207965 until counted.

---

## 3. SOAR 207965

**File path:** `AMR_Datasets/SOAR 207965/SOAR 207965 Complete data set 04Sep25.xlsx`

**Sheet name:** `"Sheet2"`.

**Shape:** 3,134 rows x 37 columns.

### Year range

2018-2021, no gaps. (Per-year counts were not individually captured this session as
part of the verified claims — the range and gap-free status are confirmed; the
per-year breakdown is a gap if needed downstream.)

### Countries (10) and regional split

Countries: India, Italy, Kuwait, Pakistan, Spain, Tunisia, Turkey, Ukraine, United Arab
Emirates, Vietnam. (Per-country row counts were not individually captured this session
— only the regional aggregate below was verified.)

| Region | Share |
|---|---|
| Europe | 53.67% |
| Asia | 32.61% |
| Middle East | 9.22% |
| Africa | 4.50% |

This closely matches Justice's stated approximate 54/33/9/4.5 split — confirmed, not a
correction.

### Organisms

`FinalOrganismName`: Haemophilus influenzae 1,536 + Streptococcus pneumoniae 1,001 =
2,537 rows = 81.0% of all rows ("predominantly," confirmed).

59 distinct non-null `FinalOrganismName` values total. Justice's text said "roughly
55" — close but not exact; there are 57-58 "other" categories once the top 2 dominant
species are excluded (see Corrections section: this is treated as a minor imprecision
in Justice's text, not a formal correction, since "roughly" was already hedged).

Confirmed present among the "other" categories:
- *Micrococcus luteus* — 11 rows (environmental/skin-flora genus).
- Several *Bacillus*/*Paenibacillus* genus entries (environmental/contaminant).
- Exactly one row of *Naganishia liquefaciens* (a yeast — non-bacterial isolate in a
  nominally bacterial file).
- *Microsporum canis* (a dermatophyte fungus — another non-bacterial isolate present
  in this file; not mentioned in Justice's original Step 3 text, which named only
  *Naganishia liquefaciens* as the fungal outlier).
- "Unknown" — 220 rows.
- "No Growth" — 1 row.
- 20 null rows.

`OriginalOrganismName` vs. `FinalOrganismName`: both columns exist and differ in
620/3,134 rows (19.8%). `OriginalOrganismName` has only 3 distinct values (H.
influenzae, S. pneumoniae, Unknown); `FinalOrganismName` has 59 — consistent with
`FinalOrganismName` being a lab-adjudicated reclassification of `OriginalOrganismName`.

### Drug/MIC result columns — 21 columns (see Corrections section for the count discrepancy vs. Justice's "20")

Amoxicillin, Amoxicillin Clavulanate, "Amoxicillin Clavulanate fixed at 2" (a
dosing/breakpoint variant of the same drug, not a distinct antibiotic), Ampicillin,
Azithromycin, Cefaclor, Cefdinir, Cefixime, Cefotaxime, Cefpodoxime, Ceftibuten,
Ceftriaxone, Cefuroxime, Clarithromycin, Doxycycline, Erythromycin, Levofloxacin,
Moxifloxacin, Penicillin, Tetracycline, Trimethoprim Sulfa.

All full names (no abbreviated codes in this file).

### MIC notation

`"<"` confirmed (e.g. `"<0.008"`, `"<0.002"`, `"<0.001"`), plus bare `">"`
upper-censoring.

### Evaluable flag (Step 6)

| Value | Rows |
|---|---|
| Y | 2,521 |
| N | 613 |

613/3,134 = 19.56% — matches Justice's "~20%" claim.

### Beta Lactamase field (Step 8)

| Value | Rows |
|---|---|
| NaN | 1,606 |
| NEG | 1,286 |
| POS | 242 |

1,606/3,134 = 51.24% missing — matches Justice's claim exactly.

### Reference note — prior cleaning pass (NOT authoritative, cross-check only)

`AMR_Datasets_clean/SOAR_207965` contains a prior general-purpose cleaning pass
(`clean.csv`, `dictionary.csv`, `cleaning_log.txt`) with row/column counts and
missingness figures identical to the raw file — this corroborates the raw-file facts
above. It does **not** resolve organism-name harmonization, MIC parsing into
comparator+value, or the Evaluable exclusion logic. Its cleaning log shows only
whitespace trimming and ASCII-censoring-character standardization — nothing else from
Section 5 was performed by that prior pass. It must not be treated as satisfying any
Section 5 step.

---

## 4. Vivli/SENTRY (fungal)

**File path:** `AMR_Datasets/ATLAS_Antifungals/vivli_sentry_2010_2024.xlsx`

**Sheet name:** `"Sheet1"`.

**Shape:** 26,922 rows x 30 columns.

### Year range

2010-2024. All 15 years present, no gaps. (Per-year counts were not individually
captured this session as part of the verified claims — range and gap-free status are
confirmed.)

### Countries

44 countries, zero nulls in the country field.

| Country | Rows |
|---|---|
| USA | 7,257 |
| Italy | 2,298 |
| Germany | 2,041 |
| Australia | 1,441 |
| Spain | 1,253 |

(Top 5 by volume; the remaining 39 countries' individual counts were not captured this
session.)

### Species

200 distinct species (exact figure, not "roughly" — differs from the SOAR 207965
"roughly 55/59" situation in that this count is exact).

| Species | Rows |
|---|---|
| Candida albicans | 9,784 |
| C. glabrata | 4,314 |
| C. parapsilosis | 3,424 |
| C. tropicalis | 2,139 |
| Aspergillus fumigatus | 2,085 |

(Top 5 by volume; the remaining 195 species' individual counts were not captured this
session — relevant to the ECV-gap discussion in Section 5 below, since only the top 5
species have any ECV research coverage at all so far.)

### Antifungal columns — 10 drugs, each as a PAIR of columns

For each of the 10 antifungals, the file carries:
- `"<Drug> (CLSI)"` — the numeric MIC value (float, mg/L).
- `"<Drug> (CLSI)_I"` — the CLSI categorical interpretation (Susceptible /
  Intermediate / Resistant).

**Naming gotcha (must be preserved verbatim in any downstream schema documentation):**
the plain `"(CLSI)"` column is the MIC value, **not** the category. Only the `"_I"`
suffix column is the category. Any code or documentation that assumes `"(CLSI)"` alone
holds the category will silently misclassify every row.

Drug classes:
- Echinocandins: Anidulafungin, Caspofungin, Micafungin.
- Azoles: Isavuconazole, Fluconazole, Itraconazole, Voriconazole, Posaconazole.
- Other: Amphotericin B, Flucytosine.

No genotype/resistance-mechanism column exists anywhere in this file (unlike the
bacterial SOAR files' Beta Lactamase field).

### CLSI-category (`"_I"` column) null counts — ALL exactly verified against the raw file (out of 26,922 rows)

| Drug | Null count | Null % |
|---|---|---|
| Itraconazole_I | 26,922 | 100.0% (0 non-null CLSI interpretations ever) |
| Posaconazole_I | 26,922 | 100.0% (0 non-null CLSI interpretations ever) |
| Flucytosine_I | 26,922 | 100.0% (0 non-null CLSI interpretations ever) |
| Amphotericin B_I | 26,800 | 99.5% |
| Isavuconazole_I | 25,566 | 94.9%/95.0% |
| Voriconazole_I | 8,844 | 32.9% |
| Fluconazole_I | 7,139 | 26.5% |
| Caspofungin_I | 6,515 | 24.2% |
| Micafungin_I | 6,344 | 23.6% |
| Anidulafungin_I | 6,343 | 23.6% |

For the 3 drugs at 100% null (itraconazole, posaconazole, flucytosine), the underlying
MIC value itself is still populated for most rows:

| Drug | MIC value null count (out of 26,922) |
|---|---|
| Itraconazole | 4,499 |
| Posaconazole | 12 |
| Flucytosine | 19,996 |

I.e. the MIC was measured but no CLSI clinical breakpoint category exists to classify
it — this matches real-world CLSI practice (no official CLSI clinical breakpoints
exist for these three drugs against Candida/Aspergillus; only ECVs or non-CLSI
guidance exist for some species, per Section 5 research below).

### Specimen "Source" column

55.32% Blood culture — matches Justice's "~55%" claim. See Corrections section below
for the Source-vs-Speciality column mix-up.

### Age Group — exactly 4 bands

| Age band | Rows |
|---|---|
| 61+ | 12,381 |
| 31 - 60 | 8,001 |
| 0 - 17 | 1,656 |
| 18 - 30 | 1,636 |
| (no age band recorded) | 3,248 (12.1%) |

No continuous age column exists anywhere in this file (unlike the SOAR bacterial
files, which carry continuous age — relevant to Step 9's binning direction: SOAR ages
get binned down to match SENTRY, never the reverse).

---

## Corrections to Justice's Original Document

Three corrections were identified this session by verifying Justice's Section 5 /
Section 4 claims directly against the four raw files. Each is presented as: what
Justice's document said, what verification found, and the supporting evidence.

### Correction 1 — SOAR 201910's non-Latin-American countries include Africa, not just "Europe, Middle East, Asia"

**What Justice's document said:** the 15 non-Latin-American countries in SOAR 201910
are described as spanning "Europe, Middle East, Asia."

**What verification found:** this is incomplete. Of the 15 non-Latin-American
countries, 5 are actually African — a region Justice's text never mentions for this
cohort: Kenya, Tunisia, Morocco, Nigeria, Ghana. The true regional breakdown is:
Europe (Ukraine only), Middle East (Kuwait, Saudi Arabia, Lebanon — 3 countries),
Asia (Vietnam, Pakistan, Singapore, Cambodia, Philippines — 5 countries), Africa
(Kenya, Tunisia, Morocco, Nigeria, Ghana — 5 countries), plus Turkey as
transcontinental.

**Supporting evidence/numbers:** Kenya = 44 rows, Tunisia = 153 rows, Morocco = 23
rows, Nigeria = 4 rows, Ghana = 2 rows — verified directly from the country-count
breakdown of the 2,318-row file. Ghana and Nigeria are the thinnest country groups in
the entire file, which is an additional finding worth flagging: any Ghana- or
West-Africa-specific claim built on this cohort alone rests on an extremely small
base (2 and 4 rows respectively).

**Downstream implication:** this plan's country-region crosswalk (Step 1) must encode
the correct 5-region split for SOAR 201910, not the "Europe, Middle East, Asia" framing
from Justice's original text.

### Correction 2 — SOAR 207965 has 21 MIC/drug-result columns, not 20

**What Justice's document said:** SOAR 207965 has 20 distinct antibiotics /
drug-result columns.

**What verification found:** there are 21 raw columns, not 20. The discrepancy
resolves in substance, not just as an error: one of the 21 columns is "Amoxicillin
Clavulanate fixed at 2," which is a dosing/breakpoint **variant** of Amoxicillin
Clavulanate — not a distinct antibiotic. So "20 distinct antibiotics" is defensible as
a statement about distinct drugs, but the raw column count that any Step 4/7
implementation will actually iterate over is 21, and that distinction must be made
explicit rather than silently collapsed.

**Supporting evidence/numbers:** full column list verified directly from the file:
Amoxicillin, Amoxicillin Clavulanate, Amoxicillin Clavulanate fixed at 2, Ampicillin,
Azithromycin, Cefaclor, Cefdinir, Cefixime, Cefotaxime, Cefpodoxime, Ceftibuten,
Ceftriaxone, Cefuroxime, Clarithromycin, Doxycycline, Erythromycin, Levofloxacin,
Moxifloxacin, Penicillin, Tetracycline, Trimethoprim Sulfa — count = 21.

**Downstream implication:** any Step 4/Step 7 crosswalk or breakpoint-application
logic that assumes exactly 20 columns for this file will either silently skip a
column or double-count a drug; the "fixed at 2" variant needs an explicit rule (treat
as a breakpoint variant of Amoxicillin Clavulanate, not a 21st independent drug) rather
than being left ambiguous.

### Correction 3 — SENTRY's ICU/heme-onc/surgery/ward breakdown lives in "Speciality," not "Source"

**What Justice's document said:** the ICU / hematology-oncology / surgery /
internal-medicine breakdown is attributed to "the specimen-source column."

**What verification found:** this conflates two separate columns. The specimen-type
column is literally named `Source` (blood culture, BAL, sputum, etc.) — it is **not**
where the clinical-service/ward breakdown lives. The ICU/heme-onc/surgery/ward
breakdown actually lives in a separate column called `Speciality` (clinical
service/ward). Both figures Justice cites are individually correct; they are just
describing two different columns, and the plan must not conflate them going forward.

**Supporting evidence/numbers:** `Source` verified as 55.32% Blood culture (matches
Justice's "~55%" figure for what he calls the specimen-source column). The
ICU/heme-onc/surgery/internal-medicine figures Justice attributes to that same column
are, on verification, values of the distinct `Speciality` column.

**Downstream implication:** Step 9 (or any demographic/clinical-context harmonization
step touching SENTRY) must reference `Source` and `Speciality` as two separate fields
in the master schema — collapsing them or documenting only one would lose a real
axis of the data.

---

## Explicit Gaps Carried Forward From This Verification Pass

These are not filled in anywhere in this appendix or elsewhere in the plan — they are
recorded here so downstream documents know exactly what remains unverified rather than
assuming silence means "resolved" or "zero":

1. **SOAR 201910 per-country counts** for Cambodia, Kuwait, Pakistan, Philippines,
   Saudi Arabia, Singapore, Turkey, Ukraine, Vietnam were not individually captured
   this session (only the 9 countries listed with counts above were captured).
2. **SOAR 201910 Betalactamase field** — column exists in the schema but no
   null/NEG/POS breakdown was verified this session.
3. **SOAR 207965 per-year and per-country row counts** — only the year range (no
   gaps) and the regional aggregate percentages were verified; individual per-year and
   per-country counts are a gap.
4. **SENTRY per-year counts and the remaining 39 (of 44) countries' individual
   counts** — only the top-5 country list was captured with counts.
5. **SENTRY remaining 195 (of 200) species' individual counts** — only the top-5
   species list was captured with counts. This matters directly for the ECV
   literature gap noted in Section 5 below: ECV coverage research this session only
   touched the top-5 species, so the other 195 have no ECV research at all yet, not
   just an incomplete lookup.
6. **DIN drug code** — unresolved; a hypothesis (doxycycline or tetracycline) exists
   but is explicitly not a fact (see main plan / Step 4).
7. **CDN drug code** — strongly supported as cefdinir via internal cross-cohort
   evidence, but no direct SOAR data-dictionary confirmation was located; should
   remain labeled provisional until such a dictionary is obtained.
