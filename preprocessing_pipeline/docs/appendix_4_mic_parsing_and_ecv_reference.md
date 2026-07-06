# Appendix 4: MIC Parsing Conventions & Antifungal ECV Reference

**Status:** Design + starter reference document. Part A (MIC parsing) rests on
standard, well-established CLSI/EUCAST laboratory methodology plus the notation
facts independently verified this session against the three SOAR files (Appendix 1).
Part B (antifungal ECVs) rests on a small number of targeted WebSearches performed
this session — real, citable numbers, but explicitly **not** a systematic literature
or CLSI-supplement review. Every gap is flagged in place and again in a dedicated
closing section. Nothing below fills a gap with an invented or estimated number.

**Scope:** This appendix addresses Justice's Section 5, **Step 5** (MIC notation
normalization) and **Step 7** (resistance/susceptibility classification, specifically
the fungal-breakpoint-absence problem). It does not cover Step 8 (beta-lactamase
genotype-field identifiability bounds), which uses an analogous partial-identification
logic — "report a range, never a point estimate under non-random missingness" — but is
documented in its own appendix. It also does not cover Step 4 (drug-code crosswalk)
or Step 6 (Evaluable-flag filtering) beyond the points where they mechanically
intersect with MIC parsing and fungal classification below.

---

## Part A — MIC Parsing (Step 5)

### A.1 Why MICs live on a log2 (two-fold dilution) scale, not a linear scale

Minimum inhibitory concentration (MIC) testing — broth microdilution per CLSI M7
(bacteria) / M100 (breakpoint tables) and CLSI M27 / M38 (yeasts / filamentous fungi)
— exposes an isolate to a fixed series of antimicrobial concentrations, each one
double (or half) the next. This is standard, well-established laboratory methodology,
not something specific to any one cohort in this project. Two direct consequences for
parsing:

1. **MIC values are not arbitrary decimals.** A valid MIC reading can only be a value
   that actually appeared in the tested dilution series (or a censored notation
   relative to that series' floor/ceiling) — e.g. `0.19` or `1.5` are not valid raw
   MIC readings under this convention, and a parser that accepts them uncritically is
   silently masking a data-entry or transcription error.
2. **Censoring is structural, not incidental.** Every dilution series has a lowest and
   a highest concentration actually tested. If no growth is inhibited even at the
   lowest concentration, the result is reported as "at or below" that value. If growth
   is not inhibited even at the highest concentration, the result is reported as
   "above" that value. Both are real, information-bearing results — not missing data —
   and must be parsed into an explicit comparator, never silently coerced to a bare
   number.

### A.2 The two-fold dilution step table

The generic two-fold (log2) dilution series, indexed relative to 1 (µg/mL or mg/L —
CLSI MIC units are interchangeable in this way; unit itself must still be tracked
per-column, see A.6):

| Log2 step (n, relative to 1) | Exact value (2^n) | Commonly reported rounding(s) |
|---:|---:|---|
| -10 | 0.0009766 | 0.001 |
| -9 | 0.0019531 | 0.002 |
| -8 | 0.0039063 | 0.004 |
| -7 | 0.0078125 | 0.008 |
| -6 | 0.015625 | 0.015 / 0.016 |
| -5 | 0.03125 | 0.03 / 0.032 |
| -4 | 0.0625 | 0.06 / 0.063 |
| -3 | 0.125 | 0.125 |
| -2 | 0.25 | 0.25 |
| -1 | 0.5 | 0.5 |
| 0 | 1 | 1 |
| 1 | 2 | 2 |
| 2 | 4 | 4 |
| 3 | 8 | 8 |
| 4 | 16 | 16 |
| 5 | 32 | 32 |
| 6 | 64 | 64 |
| 7 | 128 | 128 |
| 8 | 256 | 256 |

The dual "commonly reported rounding" entries at steps -6 to -4 exist because
different labs/export systems round the same exact power of 2 to a different number
of significant figures (e.g. 2^-5 = 0.03125 is truncated to `0.03` by some systems and
rounded to `0.032` by others). **Both spellings represent the identical dilution
step** — the parser must treat them as equal, not as two different values (see A.6).
This directly explains why SOAR 201818 reports `"<=0.06"` (2 sig figs, truncated) while
SOAR 207965 reports values like `"<0.008"` at a different, lower floor (each drug/panel
has its own tested range within this generic series — see A.7 on per-drug floors).

Note also that the verified SOAR 207965 examples include `"<0.001"`, which sits at
step -10 of the table above — i.e. the generic series extends below the -7 to -4
range most visible in the other two SOAR files; the parser must not assume a fixed
floor across cohorts.

### A.3 Notation inventory — what is actually in the three SOAR files (verified, Appendix 1)

| Cohort | Left-censoring notation observed | Example(s) | Upper-censoring notation observed |
|---|---|---|---|
| SOAR 201818 | `<=` | `"<=0.06"` | bare `>` (e.g. `">128"`) |
| SOAR 201910 | `</=` | `"</= 0.06"` | bare `>` |
| SOAR 207965 | `<` | `"<0.008"`, `"<0.002"`, `"<0.001"` | bare `>` |

Bare `>` upper-censoring (e.g. `">128"`) is confirmed present in **all three** SOAR
files.

**SENTRY (fungal) file — flagged as a distinct, unverified case.** Appendix 1
describes each antifungal's `"<Drug> (CLSI)"` column as holding "the numeric MIC value
(float, mg/L)" with no comparator-string notation documented. This appendix's parsing
design (A.5-A.7) targets the three SOAR bacterial files, whose MIC fields are
confirmed to be raw strings carrying comparator prefixes. Whether SENTRY's MIC columns
ever contain true left/right-censored readings — and if so, how they are encoded (a
separate flag column, a sentinel numeric value, or simply never censored because the
export step already resolved it) — was **not checked this session and is a gap**. Do
not assume SENTRY's float MIC columns are comparator-free until this is verified
directly against the source file.

### A.4 Semantic equivalence of the three left-censoring notations — and the caveat that comes with it

Per Justice's Step 5 issue statement and standard MIC-reporting convention: `<=`,
`</=`, and `<` as used in these three files all denote the same real-world event — no
growth/inhibition was observed even at the lowest concentration included in that
drug's tested dilution range. The character used to express it (`<=` vs `</=` vs `<`)
is a data-entry/export-format difference between the three cohorts' systems, not a
difference in underlying laboratory methodology.

**Caveat that must travel with this equivalence claim:** this session's verification
confirmed *that* each cohort uses one of these three notations, but did not confirm,
for every drug in every cohort, that the numeric value immediately following the
symbol is literally "the lowest concentration in that drug's own tested panel" (as
opposed to, e.g., one dilution step below it, which would make `<X` strictly
"below X" rather than "at-or-below X" in a subtly different sense). In practice CLSI
convention treats the reported floor value as the "at-or-below" reading regardless of
symbol, and this document adopts that standard reading — but before the three
notations are treated as fully interchangeable in a cross-cohort statistical
comparison, the team should confirm each cohort's actual panel floor per drug against
its data dictionary (the same dictionary gap already flagged for CDN/DIN in Step 4).

### A.5 Concrete parsing design

The design below is a specification, not implementation code (this is a planning
document; no pipeline code is written here).

**Step 1 — Normalize the raw string.** Trim leading/trailing whitespace (SOAR 201910's
`"</= 0.06"` has an internal space between comparator and number that must not be
mistaken for two tokens); standardize any non-ASCII minus/comparator characters to
ASCII equivalents.

**Step 2 — Extract the comparator token**, matching longest-token-first so `</=` is
never mis-split into `<` + stray characters:

| Priority | Raw token matched | Raw comparator class |
|---|---|---|
| 1 | `</=` | left-censoring |
| 2 | `<=` | left-censoring |
| 3 | `>=` | right-censoring (not observed in any of the 3 SOAR files this session, but supported defensively — see note below) |
| 4 | `<` | left-censoring |
| 5 | `>` | right-censoring |
| 6 | (none — bare number) | exact reading |

Note on `>=`: this symbol was not observed in any of the three verified SOAR files.
It is included in the supported comparator set only for forward compatibility (e.g. if
a future cohort, or a WDI/WHO-style external reference used elsewhere in the plan,
uses it) — it is a defensive no-op today, not evidence that `>=` occurs in this data.

**Step 3 — Normalize to a canonical comparator symbol.**

| Raw comparator class | Canonical symbol assigned |
|---|---|
| `</=`, `<=`, `<` (all left-censoring variants) | `<=` |
| `>=`, `>` | `>` (kept distinct from `>=` unless/until evidence of true `>=` semantics in a source file requires otherwise) |
| none (bare number) | `=` (exact reading, not censored) |

**Step 4 — Parse the remaining substring as a numeric value.** Any string that fails
numeric parsing after comparator extraction is routed to a parse-failure exceptions
table (never silently dropped or coerced to null-as-zero).

**Step 5 — Validate the numeric value against the dilution series** (A.2), accepting
the documented dual-rounding pairs (0.03/0.032, 0.06/0.063, 0.015/0.016) as equal
within a small relative tolerance (e.g. a few percent) rather than requiring exact
floating-point equality. A value that is not within tolerance of any log2 step is
flagged for manual review, not silently kept or dropped.

**Step 6 — Persist the parsed tuple** `(comparator_canonical, numeric_value,
log2_step, source_notation_raw, source_cohort)` — retaining the raw source notation
alongside the canonical parse is deliberate: it is what lets Step 5's own Check
("every parsed MIC round-trips...") be re-verified later without re-deriving from the
original file.

### A.6 Units and per-drug/per-cohort tested ranges — an open dependency, not resolved here

The generic dilution series in A.2 is unit-agnostic (µg/mL and mg/L are the same
number, different unit label, in CLSI MIC reporting). This appendix does not have —
and Appendix 1's verification pass did not capture — a per-drug table of which
specific dilution steps were actually tested in each cohort's panel (e.g., whether
SOAR 201818's Penicillin panel spans 0.06-8 or some other range). Justice's Step 5
Check requires that "nothing falls outside the plausible range for its drug-organism
pair" — implementing that fully requires each cohort's original panel/data
dictionary (the same class of artifact needed to resolve CDN/DIN in Step 4). Until
that dictionary is obtained, the validation in A.5/Step 5 above can only check against
the *generic* log2 series, not each drug's specific tested range — this is a real
limitation of the design as currently specified, not an oversight to silently work
around.

### A.7 What an "identified range" means for a censored MIC value, and why it matters for Step 7

Every parsed `(comparator, value)` tuple corresponds to a bound on the true, unknown
MIC, not the value itself:

| Parsed tuple | True MIC is known to lie in |
|---|---|
| `(<=, X)` | `(0, X]` |
| `(=, X)` | `{X}` (exact reading) |
| `(>, X)` | `(X, infinity)` — bounded above only by the next untested (higher) dilution step, which is unknown without the panel definition (A.6) |

This framing matters beyond Step 5 itself: Step 7's Action for fungal isolates with
no CLSI category and no ECV requires reporting "an identified MIC range rather than
inventing a point estimate." The bound produced directly above is precisely that
range — Part A's parser output is the mechanism that makes Step 7's fallback tier
operational, not just a description of intent. See B.2.

---

## Part B — Antifungal ECV Reference (Step 7)

### B.1 Why this reference exists — the SENTRY CLSI-category coverage problem, quantified

Per Appendix 1's verified counts, the CLSI clinical-breakpoint categorical column
(the `"_I"` suffix column) is null for the following share of all 26,922 SENTRY rows:

| Drug | `_I` null count | `_I` non-null count (derived: 26,922 − null) | `_I` null % |
|---|---:|---:|---|
| Itraconazole | 26,922 | 0 | 100.0% |
| Posaconazole | 26,922 | 0 | 100.0% |
| Flucytosine | 26,922 | 0 | 100.0% |
| Amphotericin B | 26,800 | 122 | 99.5% |
| Isavuconazole | 25,566 | 1,356 | ~95.0% |
| Voriconazole | 8,844 | 18,078 | 32.9% |
| Fluconazole | 7,139 | 19,783 | 26.5% |
| Caspofungin | 6,515 | 20,407 | 24.2% |
| Micafungin | 6,344 | 20,578 | 23.6% |
| Anidulafungin | 6,343 | 20,579 | 23.6% |

For itraconazole, posaconazole, and flucytosine, a CLSI clinical-breakpoint category
**never** appears in this file — not "rarely," zero occurrences out of 26,922 rows.
For amphotericin B it is present in only 122 rows (0.5%); those 122 should still be
used directly where present rather than assumed universally missing, but they cannot
carry a fleet-wide classification.

Critically, the underlying MIC *value* (not the category) is still measured for most
rows of the three zero-coverage drugs (Appendix 1, derived here as measured =
26,922 − null):

| Drug | MIC value null count | MIC value measured (derived) |
|---|---:|---:|
| Itraconazole | 4,499 | 22,423 |
| Posaconazole | 12 | 26,910 |
| Flucytosine | 19,996 | 6,926 |

I.e., the lab measured a number; there is simply no CLSI clinical-breakpoint category
to turn that number into susceptible/intermediate/resistant. This is exactly the gap
an ECV is designed to fill — which is why Step 7 names ECVs as the second tier of its
classification hierarchy, and why this reference table exists.

### B.2 Classification hierarchy for fungal isolates (operationalizing Step 7's Action)

1. **Tier 1 — CLSI clinical breakpoint category**, where the `"_I"` column is
   non-null for that species-drug pair. Use it directly.
2. **Tier 2 — Epidemiological cutoff value (ECV)**, where no CLSI category exists but
   a published, species-specific ECV is available (B.3 below). Classify as
   **wild-type (WT)** if MIC <= ECV, **non-wild-type (NWT)** if MIC > ECV.
   **This is not the same distinction as susceptible/resistant.** WT/NWT describes
   whether an isolate falls within the normal MIC distribution of organisms lacking
   acquired/mutational resistance mechanisms; it is a population-membership statement,
   not a clinical-outcome prediction. **How (or whether) a NWT call should feed into
   any resistance-rate reporting alongside Tier-1 S/I/R categories is an open design
   decision that Step 7 does not resolve and this appendix does not resolve either** —
   it must be decided and stated explicitly before any pooled "resistance rate" mixes
   Tier-1 and Tier-2-derived classifications.
3. **Tier 3 — Unclassifiable.** No CLSI category and no published ECV for that
   species-drug pair. Report the parsed, identified MIC range from A.7 (e.g. "MIC
   `<=0.06`" or the exact reading) with an explicit "unclassifiable — no CLSI
   breakpoint or ECV available" tag. Never collapse this to a point estimate or a
   guessed category.

Every classified isolate must carry a record of which tier produced its category, per
Step 7's own Check.

### B.3 Starter ECV reference table

All values below are as found via targeted WebSearch this session (see B.4 for full
citations). Units are as reported in the source literature (µg/mL for the Candida/
Mucorales papers, mg/L for the *Aspergillus fumigatus* paper — numerically
equivalent conventions, but the unit label itself should be preserved when this table
is operationalized).

| Species / genus | Drug | ECV | Unit | Source (see B.4) |
|---|---|---:|---|---|
| *Candida albicans* | Amphotericin B (AMB) | 2 | µg/mL | Pfaller et al. 2012 (JCM 50(4)) |
| *Candida albicans* | Flucytosine (FC) | 0.5 | µg/mL (24h read — see note below) | Pfaller et al. 2012 (JCM 50(4)) |
| *Candida albicans* | Itraconazole (ITR) | 0.12 | µg/mL | Pfaller et al. 2012 (JCM 50(4)) |
| *Candida albicans* | Posaconazole (POS) | 0.06 | µg/mL | Companion posaconazole/voriconazole paper(s) |
| *Candida glabrata* | Posaconazole (POS) | 1 | µg/mL | Companion posaconazole/voriconazole paper(s) |
| *Candida parapsilosis* | Posaconazole (POS) | 0.5 | µg/mL | Companion posaconazole/voriconazole paper(s) |
| *Aspergillus fumigatus* | Itraconazole (ITR) | 1 | mg/L | Espinel-Ingroff et al., *A. fumigatus* |
| *Aspergillus fumigatus* | Posaconazole (POS) | 0.5 | mg/L | Espinel-Ingroff et al., *A. fumigatus* |
| *Aspergillus fumigatus* | Voriconazole (VOR) | 1 | mg/L | Espinel-Ingroff et al., *A. fumigatus* |
| *Aspergillus fumigatus* | Isavuconazole (ISAV) | 1 | mg/L | Espinel-Ingroff et al., *A. fumigatus* |
| Mucorales (*Lichtheimia corymbifera*, *Mucor circinelloides*) | Amphotericin B (AMB) | 1 | µg/mL | Espinel-Ingroff et al., Mucorales |
| Mucorales (*Rhizopus arrhizus*, *R. microsporus*) | Amphotericin B (AMB) | 2 | µg/mL | Espinel-Ingroff et al., Mucorales |
| Mucorales (species-dependent) | Posaconazole (POS) | 1-4 (range, species-dependent) | µg/mL | Espinel-Ingroff et al., Mucorales |
| Mucorales (*Rhizopus arrhizus*) | Itraconazole (ITR) | 2 | µg/mL | Espinel-Ingroff et al., Mucorales |

**Note on the *C. albicans* flucytosine value (0.5 µg/mL, 24h):** the cited paper's
ECV for flucytosine against *C. albicans* is specifically a **24-hour** incubation
read, per CLSI M27 methodology, rather than the 48-hour read timepoint used for most
other ECVs in this table. Before applying this ECV to SENTRY's Flucytosine MIC
column, the team must confirm which incubation timepoint SENTRY's own values
represent — if SENTRY captures only 48-hour reads, this specific ECV may not be
directly applicable without further confirmation from the underlying methodology.
This is flagged as an open question, not resolved here.

**Mucorales row is genus/order-level, not species-matched to SENTRY's top-5 list.**
None of the four Mucorales species named in the source literature (*Lichtheimia
corymbifera*, *Mucor circinelloides*, *Rhizopus arrhizus*, *R. microsporus*) is one of
SENTRY's top-5-by-volume species (Appendix 1). This row is included because it is a
real, citable ECV set that may be useful for whichever Mucorales species occur in
SENTRY's long tail of 195 uncounted species — but it does not directly help classify
any of the five species Appendix 1 actually quantified.

### B.4 Full citations (as captured this session — see B.5 for what is still missing from each)

1. Pfaller MA, et al. "Wild-Type MIC Distributions and Epidemiological Cutoff Values
   for Amphotericin B, Flucytosine, and Itraconazole and *Candida* spp." *J Clin
   Microbiol* 2012;50(4). doi:10.1128/jcm.00248-12. PMC3372147.
2. Companion posaconazole/voriconazole ECV papers (Pfaller et al.), *J Clin
   Microbiol*, one dated 2011 and one dated 2013 per this session's search results —
   **the exact correspondence between publication year and PMC ID below was not
   resolved this session**: PMC3043502; PMC3719635.
3. Espinel-Ingroff A, et al. Mucorales ECV study. *J Clin Microbiol*. PMC4325796.
   (Full year/volume/title not captured this session beyond journal and PMC ID.)
4. Espinel-Ingroff A, et al. *Aspergillus fumigatus* ECV study (CLSI M38-A2
   methodology). PMC3346643 / *Antimicrob Agents Chemother* doi:10.1128/aac.05959-11;
   companion reference PMC3043512. (Full year/volume/title, and whether these two PMC
   IDs represent one paper or two, not resolved this session.)

### B.5 Gaps in this reference table — read before treating any cell above as final

This is a **starter reference built from a small number of targeted WebSearches in one
session — it is not a systematic literature review or a CLSI-supplement extraction,**
and must not be treated as a final lookup table. Specific, enumerated gaps:

1. **_Candida tropicalis_ has no ECV captured for any of the 4 drugs** (AMB, FC, ITR,
   POS) in this session's research — a real gap, not a zero, and notably this is one
   of SENTRY's actual top-5-by-volume species (2,139 rows per Appendix 1), so this is
   a meaningful, not marginal, hole.
2. **_Candida glabrata_ and _Candida parapsilosis_ are missing AMB/FC/ITR values** —
   only the posaconazole (POS) value was captured for each this session, even though
   the source paper series is described as covering AMB/FC/ITR for *Candida* spp.
   generally; the species-specific figures for these two species were referenced in
   the literature but not captured in this session's searches.
3. **_Aspergillus fumigatus_ has no captured amphotericin B ECV.** Voriconazole,
   posaconazole, itraconazole, and isavuconazole are covered; amphotericin B is not.
   This session's searches suggest the published literature focus on AMB-vs-
   *Aspergillus* ECVs is thinner than for the azoles, but that is an inference from
   search results, not a confirmed absence-of-publication claim.
4. **Coverage scope vs. SENTRY's actual species list.** SENTRY contains 200 distinct
   species (Appendix 1, exact count). This table covers ECVs relevant to only the
   top 5 species by volume (plus a non-matching Mucorales entry, B.3) — the remaining
   195 species have **no ECV research performed at all this session**, not merely an
   incomplete table for them.
5. **ECVs are periodically revised** by CLSI as new wild-type MIC distribution data
   accumulates; the figures above reflect the specific papers cited, at whatever
   revision those papers represent, not necessarily the current CLSI position.
6. **Citation completeness gap (B.4):** several citations above are missing full
   year/volume/page detail, and one citation's PMC-ID-to-paper correspondence is
   ambiguous (B.4 item 2) or possibly split across two papers under one label (B.4
   item 4). These must be resolved by pulling the actual papers before formal citation
   in any final document.

**Required next step before this table is used to classify a single real isolate:**
someone must pull the current CLSI M27 (yeasts), M38 (filamentous fungi), and M59
(epidemiological cutoff values) supplement tables directly — or the EUCAST published
ECOFF list at eucast.org — rather than relying on this session's WebSearch-derived
starter table. This appendix is a scaffold for that work, not a substitute for it.

---

## Integration with Section 5's own Checks

- **Step 5's Check** ("every parsed MIC round-trips to a valid log2 dilution step;
  nothing falls outside the plausible range for its drug-organism pair") is satisfied
  by A.5's validation step for the generic dilution series, but only partially for the
  drug-organism-specific range — that half depends on the per-drug panel dictionary
  gap noted in A.6, which is not resolved here.
- **Step 7's Check** ("every classified isolate carries a record of which standard —
  CLSI breakpoint / ECV / unclassifiable — produced its category") is satisfied by
  design in B.2's three-tier hierarchy, provided the tier label is actually persisted
  per isolate-drug pair in implementation (a requirement to carry into the master
  schema design, Step 10) and provided the WT/NWT-vs-S/I/R reporting question flagged
  in B.2 is explicitly decided rather than left implicit.
