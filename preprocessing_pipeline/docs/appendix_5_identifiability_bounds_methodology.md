# Appendix 5: Identifiability Bounds Methodology

**Applies to:** Section 5, Step 8 (Genotype-field identifiability bounds) and, as a
structurally related but numerically distinct case, Step 7 (Resistance and
susceptibility classification) for the four antifungals with no usable CLSI
clinical-breakpoint category.

**Status:** Planning/methodology only. No pipeline code is specified or executed
here. Every number below is either taken directly from the verified source-file
facts supplied to this document, or is a citation from completed background
research. Gaps are marked **GAP** and must not be filled by guessing.

---

## 5.1 Why Step 7 and Step 8 are the same underlying problem

Justice's Step 8 issue statement calls the beta-lactamase blank pattern "a
detection-only pattern structurally identical to the one documented in ATLAS
(Missing Negative concept)." The same structure recurs inside Step 7: for three of
the four antifungals with no CLSI clinical-breakpoint category (itraconazole,
posaconazole, flucytosine), and for a fourth at 99.5% missing (amphotericin B), a
result was recorded for some fraction of isolates and not for the rest, and the
naive move — treat "not classified" as if it were informative about resistance
status, or worse, silently drop it — manufactures a number that looks precise but
is not identified by the data.

Both cases share one abstract structure:

- **N** = the total population of isolates at risk of the measurement (all isolates
  of the relevant organism/species).
- **T** = the subset for which the field was actually recorded/assigned ("tested").
- **P** = the subset of T recorded as positive/resistant.

The scientific question is never "what is P/T?" in isolation — it is "what can we
say about the true population prevalence, given that N − T isolates carry no
information on this field at all?" Sections 5.2–5.4 give the formal answer.

---

## 5.2 The assumption-free (Manski) worst-case bounds

**Source:** Manski, "Anatomy of the Selection Problem," *Journal of Human Resources*
24(3):343–360, 1989; Horowitz & Manski, *Journal of the American Statistical
Association*, 1998/2000.

Given N, T, P with 0 ≤ P ≤ T ≤ N, the true population prevalence π is
**not point-identified** — but it is bounded, with zero additional assumptions,
by:

```
Lower bound:   π_L = P / N
Upper bound:   π_U = (P + (N − T)) / N   =   1 − (T − P) / N
```

The logic: π_L is what you get if literally every untested isolate is truly
negative; π_U is what you get if literally every untested isolate is truly
positive. Both are logical extremes, so π must lie somewhere in [π_L, π_U] — this
requires no assumption about *why* isolates went untested.

**Diagnostic to report alongside every bound:** interval width = π_U − π_L =
(N − T)/N, i.e. exactly the untested fraction. This shrinks mechanically as testing
coverage improves and should always be quoted next to the bound — a bound on a
field that is 99% covered and one that is 50% covered can have the same P/T but
utterly different informativeness.

### Why P/T is not automatically a valid upper bound

The tempting shortcut — "just report positives over *tested*, P/T" — silently
assumes the untested isolates have the same underlying positivity rate as the
tested ones, or fewer. Formally: let X be the (unknown) number of true positives
among the N − T untested isolates, 0 ≤ X ≤ N − T. The true prevalence is
π = (P + X)/N. The ratio P/T equals π only in the special case X/(N−T) = P/T
(testing exactly at random with respect to true status). P/T is an *upper* bound on
π only if X/(N−T) ≤ P/T, i.e. the untested group's true positivity rate is no
higher than the tested group's. Nothing in the raw data guarantees this — a lab
could just as easily run the confirmatory beta-lactamase test *because* an isolate
already looked resistant on a screening panel, which would concentrate rather than
dilute positives among the tested group, making the untested group's true rate
*higher*, not lower, than P/T. In that scenario P/T is not a valid bound at all in
either direction. Reporting P/T without naming and defending the assumption behind
it is exactly the "positives-over-tested" error Step 8's Action explicitly
forbids.

---

## 5.3 The assumption that licenses the tighter bound: testing monotonicity

**Source:** Manski & Molinari, NBER Working Paper 27023 / *Journal of
Econometrics*, 2021 — developed for the structurally identical problem of bounding
the true COVID-19 infection rate under non-random testing.

The named, defensible assumption is:

> **Testing monotonicity:** P(true positive | untested) ≤ P(true positive | tested)

i.e., clinicians/labs are never *less* likely to have tested (assigned a
beta-lactamase result / assigned a CLSI category) a truly positive isolate than a
truly negative one. Under this assumption, and only under it, the upper bound
tightens to:

```
π_L = P / N                (unchanged)
π_U^(MS) = P / T           (valid ONLY under testing monotonicity)
```

This is the **single-instrument case** of Manski & Pepper's general **Monotone
Instrumental Variable (MIV)** framework (*Econometrica*, 2000; *Econometrics
Journal*, 2009), in which the "instrument" is the testing/selection decision itself
and the assumption is that it moves monotonically with the latent outcome.

### Terminology trap — do not confuse with "monotone missingness"

This is important enough that it must be flagged prominently to anyone
implementing this pipeline:

| Term | Field it comes from | What it actually means | Relevant here? |
|---|---|---|---|
| **Monotone missingness** | Mainstream biostatistics (multiple imputation, longitudinal dropout) | A missingness **pattern**: once a repeated-measures variable goes missing for a subject, it stays missing for all later time points. Says nothing about whether missingness correlates with the outcome's value. | **No** — this is not the assumption used here, and using this term in the plan/paper would mislabel the method to a reviewer who knows the biostatistics literature. |
| **Testing monotonicity** (Manski & Molinari, 2021) | Partial identification / econometrics | A **directional correlation** assumption between the true outcome and the probability of being tested: P(positive\|untested) ≤ P(positive\|tested). | **Yes — this is the correct term of art for Tier 2 in this pipeline.** |
| **Monotone Instrumental Variable (MIV)** (Manski & Pepper, 2000/2009) | Partial identification / econometrics | General framework of which testing monotonicity is the single-instrument special case. | Correct umbrella term if a more general framing is wanted; testing monotonicity is the specific instance actually used here. |

Use "testing monotonicity" or "Monotone Instrumental Variable," cited to Manski &
Molinari / Manski & Pepper. Never call this assumption "monotone missingness" —
that phrase describes an unrelated pattern-of-missingness concept and its use here
would be a citation error.

---

## 5.4 Precedent and adjacent literature

- **Directly analogous published application:** Adegboye, Fujii, Leung, Li, "HIV
  estimation using population-based surveys with non-response: A partial
  identification approach," *Statistics in Medicine* 2024;43(16):3005–3019, doi:
  10.1002/sim.10108. Same structural problem (HIV test refused/skipped for a
  nonrandom subset of DHS survey respondents), same worst-case-bounds-plus-MIV
  approach, applied to Zambia/Malawi/Kenya. This is the closest precedent found
  for applying this exact machinery to a real-world non-random-testing prevalence
  problem, and the template this appendix follows.

- **AMR-specific literature that documents the bias direction but does not use
  formal partial-identification bounds** (i.e., these papers confirm the *problem*
  is real and known in AMR surveillance, but neither applies the Manski/MIV
  machinery in Section 5.2–5.3):
  - Heginbothom et al., *Journal of Antimicrobial Chemotherapy* 2004;53(6):1010–7
    — ~300,000 Welsh isolates; selective testing "invariably" inflates
    resistance-rate estimates, worsening as the tested fraction drops.
  - Wu et al., *Microbiology Spectrum* 2023;11(2):e01646-22 — 750 US hospitals;
    cascade/selective antimicrobial-susceptibility-testing reporting documented to
    bias reported susceptibility.

- **Genuine literature gap (must be stated explicitly, not glossed over):** this
  session's research did not surface any published paper that applies formal
  Manski/MIV partial-identification bounds specifically to AMR surveillance
  detection-only fields (beta-lactamase, carbapenemase, or similar genotype/
  phenotype indicators). Heginbothom and Wu et al. establish that the bias exists
  and its direction; Adegboye et al. establishes the bounds methodology works on a
  structurally identical selective-testing problem in a different disease domain
  (HIV). **No source combining the two — i.e., no prior paper doing exactly what
  this appendix proposes for AMR data — was located.** This should be read as
  "this session's targeted searches did not find one," not "no such paper exists";
  see the literature-search caveat in Section 5.7.

---

## 5.5 Concrete recommendation for this pipeline: a two-tier bound

Every reported prevalence for a detection-only field (beta-lactamase, or an
antifungal category derived from a CLSI/ECV scheme with partial coverage) must be
reported as an interval, never a bare point estimate, in two tiers:

| Tier | Formula | Assumption required | When to report |
|---|---|---|---|
| **Tier 1 — headline** | [P/N, (P + N − T)/N] | None (assumption-free, worst case) | Always, for every reported rate, no exceptions. |
| **Tier 2 — conditional** | [P/N, P/T] | Testing monotonicity (Manski & Molinari), named explicitly | Only if the team is willing to state and defend the assumption in prose next to the number. Never presented as assumption-free. |

Every reported bound must be accompanied by the raw N, T, P (or at minimum T/N
coverage), and by a per-stratum computation before pooling: if T/N coverage
varies materially across organism, cohort, country, or year, bound within each
stratum first — pooling first can hide strata where the bound is nearly
uninformative (this mirrors Step 7's own instruction to run breakpoint
classification "separately per cohort before merging," for the identical reason:
avoid a stratum-mismatch problem from being masked by aggregation).

---

## 5.6 Mapping N, T, P onto the two pipeline cases

### Case A — Step 8: bacterial Beta Lactamase field

| Quantity | Definition for this field |
|---|---|
| N | All isolates of the relevant organism (e.g., all *S. pneumoniae*, or all *H. influenzae*, in the cohort) |
| T | Isolates with a non-blank Beta Lactamase value (POS or NEG recorded) |
| P | Isolates with Beta Lactamase = POS |

**Verified file-level counts (whole-file aggregate — not yet organism-stratified;
see gap note below):**

| Cohort | N (all isolates) | Blank (N−T) | T (tested) | P (POS) | Coverage T/N |
|---|---|---|---|---|---|
| SOAR 201818 | 2,413 | 1,345 | 1,068 (NEG 949 + POS 119) | 119 | 44.3% |
| SOAR 207965 | 3,134 | 1,606 | 1,528 (NEG 1,286 + POS 242) | 242 | 48.8% |

**Illustrative Tier 1 / Tier 2 bounds computed from the counts above** (mechanics
demonstration only — see gap note):

| Cohort | Tier 1: [P/N, (P+N−T)/N] | Interval width (N−T)/N | Tier 2 (testing monotonicity): [P/N, P/T] |
|---|---|---|---|
| SOAR 201818 | [4.93%, 60.67%] | 55.7 pp | [4.93%, 11.14%] |
| SOAR 207965 | [7.72%, 58.97%] | 51.2 pp | [7.72%, 15.84%] |

**GAP — do not treat the table above as the plan's headline figures.** These are
whole-file aggregates across both organisms in each cohort (SOAR 201818: *S.
pneumoniae* + *H. influenzae* pooled; SOAR 207965: predominantly the same two
species plus the ~55–59 other categories from Step 3). The verified facts supplied
to this document do not include an organism-stratified breakdown of Beta
Lactamase NaN/NEG/POS counts. Per Section 5.5's stratification rule, the pipeline
must recompute N, T, P separately per organism (and per country/year if coverage
varies materially) before these numbers are used as the plan's actual reported
bounds. The whole-file numbers above illustrate the arithmetic only.

### Case B — Step 7: antifungals with no CLSI clinical-breakpoint category

| Quantity | Definition for this field |
|---|---|
| N | All isolates of the relevant species with an MIC value measured for that drug |
| T | Isolates of that species for which SENTRY's CLSI-interpretation column (`<Drug> (CLSI)_I`) assigned a category (S/I/R) |
| P | Isolates categorized Resistant |

**Verified file-wide counts (all 26,922 rows, all species pooled — see gap note
below; no species-level breakdown of these counts was verified this session):**

| Drug | MIC measured (candidate N) | Category non-null (T) | Category null (N−T) | Coverage T/N |
|---|---|---|---|---|
| Itraconazole | 22,423 (26,922 − 4,499 null) | **0** | 26,922 | **0.0%** |
| Posaconazole | 26,910 (26,922 − 12 null) | **0** | 26,922 | **0.0%** |
| Flucytosine | 6,926 (26,922 − 19,996 null) | **0** | 26,922 | **0.0%** |
| Amphotericin B | **GAP** — MIC-null count for this drug not among verified facts | 122 (26,922 − 26,800 null) | 26,800 | **GAP** (depends on N) |

**A critical mathematical consequence, not an invented conclusion:** for
itraconazole, posaconazole, and flucytosine, T = 0 — SENTRY's CLSI-interpretation
column contains zero non-null values for these three drugs across all 26,922
rows, in any species. Since P ≤ T, this forces P = 0 as well. Plugging T=0, P=0
into Section 5.2's formulas:

```
π_L = 0/N = 0%
π_U = (0 + N − 0)/N = 100%
```

**The Tier 1 bound for these three drugs is [0%, 100%] — completely
uninformative — for every species, with no further calculation needed.** Tier 2
(P/T) is not merely weak here, it is **undefined** (0/0). This is qualitatively
different from Case A's situation (partial testing, T > 0, a genuinely
informative-if-wide bound is possible) — it is a *complete absence* of a CLSI
category for these three drugs, not partial coverage of one. This confirms, from
the numbers themselves rather than from the framework being asserted, why Step 7's
own fallback instruction is correct as written: for these three drugs, the plan
must classify via a **species-specific ECV** where one is published (see the
antifungal-ECV research findings referenced in Step 7 of the main plan), or else
report the **identified MIC range/distribution**, not a resistance rate at all —
Manski/MIV bounds add zero value here and should not be presented as if they were
a usable substitute for ECV-based classification.

**Amphotericin B is different again:** T = 122 (0.5% of 26,922 rows have any CLSI
category at all), so a Tier 1 bound is at least mathematically non-degenerate
(T > 0). But two numbers needed to compute it are **GAPs** in the verified facts
supplied to this document:
1. N (amphotericin B MIC-measured count) — not captured this session; must be
   pulled from the raw file.
2. P (count of the 122 categorized rows that are specifically "Resistant," as
   opposed to Susceptible/Intermediate) — not captured this session; must be
   pulled from the raw file.

Given T = 122 against N necessarily close to 26,922 minus whatever small null
count the raw MIC column carries, the coverage T/N will almost certainly still be
well under 1%, meaning even the eventual Tier 1 bound for amphotericin B should be
expected to be extremely wide (interval width ≈ (N−T)/N ≈ 99%+) — worth stating
as an expectation, not as a computed fact, until N and P are pulled.

**Species-level stratification gap:** the assignment's own mapping (N = isolates
*of that species* with an MIC measured) requires per-species N/T/P, but every
number in this section is a file-wide aggregate across all 200 species in the
SENTRY file. The pipeline must recompute per species (at minimum for the top 5:
*C. albicans*, *C. glabrata*, *C. parapsilosis*, *C. tropicalis*, *A. fumigatus*)
before any species-specific bound is reported, per Section 5.5's stratification
rule.

---

## 5.7 Caveats (must accompany every bound reported downstream)

1. **Test-accuracy assumption.** Every formula in this appendix assumes the
   underlying lab determination — the beta-lactamase test result, or the CLSI
   category assignment — is perfectly accurate once made, i.e., there is no
   allowance for false-positive/false-negative lab error. This has not been
   audited against any of the four source files' lab methodology documentation
   and should be before the bounds are treated as final.

2. **"Blank means unknown, not implicit-negative."** The formulas require that a
   blank/null field genuinely means "not tested / not recorded," not an implicit
   lab or dataset convention where blank silently encodes a presumed-negative
   result (e.g., a category left blank because it was judged obviously
   susceptible and not worth recording). **This has not been confirmed for any of
   the four files** — none of the verified facts supplied to this document
   include a data dictionary statement resolving this either way for Beta
   Lactamase or for the SENTRY CLSI-interpretation columns. This is a required
   audit step before Section 5.6's numbers are treated as usable, not merely a
   theoretical caveat.

3. **Testing monotonicity is a substantive, generally untestable assumption.** It
   cannot be verified from the data itself — by construction, the data contain no
   information about the true status of untested isolates. Tier 2 must always be
   labeled with the assumption's name and never presented as if it carried the
   same assumption-free status as Tier 1.

4. **Literature-search caveat.** The research summarized in Section 5.4 was
   produced from a small number of targeted searches in one session, not a
   systematic review. The absence of a prior paper combining Manski/MIV bounds
   with AMR surveillance data is evidence of a gap in what this session found, not
   proof that no such paper exists anywhere in the literature.

---

## 5.8 Summary checklist for implementers

- [ ] Never report P/T (or P/N) alone for a detection-only field; always report an
      interval.
- [ ] Tier 1 [P/N, (P+N−T)/N] is reported for every case, unconditionally.
- [ ] Tier 2 [P/N, P/T] is reported only alongside an explicit statement that
      "testing monotonicity (Manski & Molinari 2021)" is being assumed, and why
      the team judges it defensible for this specific field/cohort.
- [ ] Report raw N, T, P (or T/N coverage) next to every bound.
- [ ] Stratify by organism/species and by cohort/year before pooling; do not
      compute a single pooled bound across strata with materially different
      coverage.
- [ ] For itraconazole, posaconazole, and flucytosine specifically: do not
      compute or report a Manski/MIV bound at all — T = 0 makes it degenerate
      ([0%, 100%]). Use the ECV route or report the raw MIC distribution instead,
      per Step 7's own fallback instruction.
- [ ] For amphotericin B and for both beta-lactamase cohorts: compute the
      organism/species-stratified N, T, P from the raw files (not yet done —
      flagged as a pipeline-execution gap in Section 5.6) before finalizing any
      headline bound.
- [ ] Never call the testing-monotonicity assumption "monotone missingness" —
      that is an unrelated term from the biostatistics missing-data literature.
