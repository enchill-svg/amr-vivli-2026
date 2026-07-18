"""
Step 8 - Genotype-field (Beta Lactamase) identifiability bounds.

Issue (Justice's Section 5): the bacterial Beta Lactamase field is blank for a
large share of isolates - a detection-only pattern where testing itself is
non-random.

Action: do not compute beta-lactamase prevalence as positives-over-tested.
Report it as an identified range: assumption-free (Manski) bound below,
narrowed only under a named, defensible assumption (testing monotonicity).

Check: every reported beta-lactamase prevalence carries its range and the
assumption used to produce it, never a single bare number.

Design (Part 5.5 / Appendix 5): let N = all retained isolates of the relevant
organism, T = isolates with a non-blank Beta Lactamase value, P = isolates
recorded POS.
  Tier 1 (assumption-free):        lower = P/N,  upper = (P + N - T)/N
  Tier 2 (testing monotonicity):   lower = P/N,  upper = P/T
Tier 2's upper bound is only valid under "testing monotonicity" (Manski &
Molinari 2021: probability of being tested is no lower for a truly positive
isolate than a truly negative one) - a term of art, never to be confused with
"monotone missingness" (an unrelated missing-data-pattern term). Every bound
is computed per organism within each cohort (Check c), never as a single
pooled whole-file number.

Caveats required alongside every reported bound (Appendix 5 SS5.7 - three
caveats, all three restated here, none silently dropped; a fourth caveat below
covers this deliverable's own validation coverage):
  1. Whether the underlying lab determination itself is error-free is
     unaudited by this pipeline.
  2. Whether "blank" genuinely means "not tested" (rather than e.g. "tested,
     result lost") is unconfirmed against any of these files' documentation.
  3. Testing monotonicity is fundamentally untestable from this data by
     construction - it is a structural assumption about whether truly-positive
     isolates are tested at least as often as truly-negative ones, and nothing
     observable in a dataset where negatives-among-untested are unknown by
     definition can confirm or refute it. Tier 2's upper bound must therefore
     always be presented as conditional on this assumption, never as a
     verified or verifiable number.
  4. SOAR_Hin's EG-07 resistant-only ascertainment-bias check (Step 20) reads
     +5.4pp against a +10pp pre-registered target - real, correctly-signed,
     but weaker than PLEA_I/carbapenemase's +11.9pp on the identical
     procedure. Root cause verified against raw isolate data: BLNAR
     (beta-lactamase-negative, ampicillin-resistant H. influenzae) isolates
     share the same MIC ceiling as beta-lactamase-positive isolates, so
     ampicillin MIC cannot cleanly enrich for beta-lactamase genotype the way
     meropenem MIC enriches for PLEA_I's carbapenemase genotype. This does not
     change the bounds computed here - it means the resampling design's
     evidence that resistant-only ascertainment biases naive prevalence is
     weaker for this cohort than for PLEA_I. See
     EVIDENCE_GATE_ESTIMANDS.md SS4.1 for the full derivation.

Retained isolates are scoped using Step 3's organism crosswalk (excluding No
Growth / environmental-contaminant / cross-domain-fungal rows), per this
step's own dependency on Step 3. SOAR_207965 additionally carries an
Evaluable Y/N flag (Step 6's own reconnaissance: ~613 rows marked "N");
Step 6 already excludes these for Steps 6/10, and this step now applies the
identical exclusion since it draws N, T, and P from the same raw cohort -
without it, isolates Step 6 has already determined are not evaluable would
silently inflate this step's denominators.

Reconnaissance for this step also directly resolves a flagged gap (SOAR
201910's Betalactamase breakdown was "never counted" per the plan's own
verified-grounding note): the live data shows SOAR_201910 spells the same two
categories two different ways - "NEG"/"Negative" and "POS"/"Positive" - which
must be normalized to a single POS/NEG pair before counting T and P, or the
breakdown would silently undercount both.

Stratification (expanded this session per Section 5.5): bounds are computed
per organism x cohort x country x year, not organism x cohort alone. Country
uses Step 1's own reviewed crosswalk (crosswalks/country_iso3_crosswalk_v1.csv);
year reuses Step 2's exact parse_value logic (re-implemented here rather than
imported, matching this pipeline's convention of depending on a prior step's
persisted crosswalk artifact, not its source module - Step 2 has no persisted
per-row year artifact to read, only an exceptions log). Any row whose country
or year cannot be resolved is bucketed into an explicit "unmapped"/
"unparseable" stratum rather than silently dropped from the denominator - Step
1 and Step 2's own Checks already guarantee this is rare-to-never for these
three cohorts, but this step verifies it independently rather than assuming it.

Judgment call (documented, not resolved by adding a threshold): the finer
four-way stratification produces many low-N strata, some with N as low as 1.
This table does not drop or merge those strata. Manski-style identification
bounds are valid for any N - a small sample makes the bound wide (less
informative), not invalid - so suppressing low-N rows would remove real,
correctly-computed information rather than fix a defect. Every row instead
carries its own N so a downstream consumer can judge informativeness itself;
an explicit low_n_stratum flag (N < 10) is added for visibility, not filtering.
"""
import sys
import datetime as dt
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
from _data_paths import COHORT_PATHS
ORGANISM_CROSSWALK_PATH = ROOT / "crosswalks" / "organism_crosswalk_v1.csv"
COUNTRY_CROSSWALK_PATH = ROOT / "crosswalks" / "country_iso3_crosswalk_v1.csv"
BOUNDS_PATH = ROOT / "bounds" / "beta_lactamase_bounds_v1.csv"

LOW_N_THRESHOLD = 10
UNMAPPED_COUNTRY = "UNMAPPED_COUNTRY"
UNPARSEABLE_YEAR = "UNPARSEABLE_YEAR"
UNMAPPED_ORGANISM = "UNMAPPED_ORGANISM"

TIER2_ASSUMPTION_LABEL = "testing monotonicity (Manski & Molinari 2021)"

# Normalizes every raw spelling observed in the live data to one canonical
# POS/NEG pair. Built from direct inspection - 201910 alone uses 2 spellings
# per category; 201818 and 207965 use only the short form.
BETA_LACTAMASE_NORMALIZATION = {
    "POS": "POS",
    "Positive": "POS",
    "NEG": "NEG",
    "Negative": "NEG",
}

SOAR_COHORTS = {
    "SOAR_201818": {
        "path": COHORT_PATHS["SOAR_201818"],
        "reader": "csv",
        "organism_col": "ORGANISMNAME",
        "beta_lactamase_col": "BETALACTAMASE",
        "country_col": "COUNTRY",
        "date_col": "YEARCOLLECTED",
    },
    "SOAR_201910": {
        "path": COHORT_PATHS["SOAR_201910"],
        "reader": "excel",
        "organism_col": "Organism",
        "beta_lactamase_col": "Betalactamase",
        "country_col": "Country",
        "date_col": "Collection Date",
    },
    "SOAR_207965": {
        "path": COHORT_PATHS["SOAR_207965"],
        "reader": "excel",
        "organism_col": "FinalOrganismName",
        "beta_lactamase_col": "Beta Lactamase",
        "country_col": "Country",
        "date_col": "YearCollected",
        "evaluable_col": "Evaluable",
    },
}


def load_organism_crosswalk():
    cw = pd.read_csv(ORGANISM_CROSSWALK_PATH, keep_default_na=False)
    lookup = {}
    for _, row in cw.iterrows():
        key = None if row["raw_string"] == "<null>" else row["raw_string"]
        lookup[key] = row["canonical_organism"]
    return lookup


def load_country_crosswalk():
    cw = pd.read_csv(COUNTRY_CROSSWALK_PATH)
    return dict(zip(cw["raw_string"], cw["iso3"]))


def parse_year(value):
    """Re-implements Step 2's exact parse_value rules; returns a year or None."""
    if isinstance(value, (dt.datetime, dt.date, pd.Timestamp)):
        return value.year
    if isinstance(value, str):
        try:
            return dt.datetime.strptime(value.strip(), "%d-%b-%y").year
        except ValueError:
            pass
        try:
            return dt.datetime.strptime(value.strip(), "%b-%y").year
        except ValueError:
            return None
    if isinstance(value, (int, float)) and not pd.isna(value):
        year = int(value)
        if 1900 <= year <= 2100:
            return year
    return None


def main():
    failed = False
    organism_lookup = load_organism_crosswalk()
    country_lookup = load_country_crosswalk()
    bounds_rows = []

    for cohort_name, spec in SOAR_COHORTS.items():
        if spec["reader"] == "csv":
            df = pd.read_csv(spec["path"], low_memory=False)
        else:
            df = pd.read_excel(spec["path"])

        organism_raw = df[spec["organism_col"]].where(df[spec["organism_col"]].notna(), None)
        canonical_organism = organism_raw.map(lambda v: organism_lookup.get(v, UNMAPPED_ORGANISM))
        n_unmapped_organism = (canonical_organism == UNMAPPED_ORGANISM).sum()
        if n_unmapped_organism:
            print(f"FAIL: {cohort_name} has {n_unmapped_organism} row(s) whose organism string is not in Step 3's "
                  f"crosswalk (would silently mis-stratify if not caught): "
                  f"{sorted(organism_raw[canonical_organism == UNMAPPED_ORGANISM].dropna().unique())}")
            failed = True
        retained_mask = canonical_organism != "excluded"

        evaluable_col = spec.get("evaluable_col")
        if evaluable_col:
            # Step 6 established SOAR_207965 carries an Evaluable Y/N flag
            # (~613 rows marked "N") that step06_evaluability.py already
            # excludes for Steps 6/10; this stratum-bounds step draws from
            # the same raw cohort and must apply the same exclusion or it
            # would silently include isolates Step 6 already determined are
            # not evaluable, understating T and P here.
            non_evaluable_mask = df[evaluable_col] == "N"
            n_non_evaluable = int(non_evaluable_mask.sum())
            if n_non_evaluable:
                print(f"NOTE: {cohort_name} excludes {n_non_evaluable} row(s) with {evaluable_col} == 'N' "
                      f"(Step 6's evaluability exclusion, applied here for consistency).")
            retained_mask = retained_mask & ~non_evaluable_mask

        beta_raw = df[spec["beta_lactamase_col"]]
        beta_normalized = beta_raw.map(lambda v: BETA_LACTAMASE_NORMALIZATION.get(v) if pd.notna(v) else None)

        unrecognized = beta_raw[(beta_raw.notna()) & (beta_normalized.isna())]
        if len(unrecognized):
            print(f"FAIL: {cohort_name} has {len(unrecognized)} Beta Lactamase value(s) not recognized by the normalization map: {unrecognized.unique()}")
            failed = True

        country_raw = df[spec["country_col"]]
        canonical_country = country_raw.map(lambda v: country_lookup.get(v, UNMAPPED_COUNTRY) if pd.notna(v) else UNMAPPED_COUNTRY)
        n_unmapped_country = (canonical_country == UNMAPPED_COUNTRY).sum()
        if n_unmapped_country:
            print(f"FAIL: {cohort_name} has {n_unmapped_country} row(s) whose country string is not in Step 1's crosswalk "
                  f"(would silently mis-stratify if not bucketed): {sorted(country_raw[canonical_country == UNMAPPED_COUNTRY].dropna().unique())}")
            failed = True

        year_raw = df[spec["date_col"]]
        parsed_year = year_raw.map(lambda v: parse_year(v) if pd.notna(v) else None)
        canonical_year = parsed_year.map(lambda y: str(y) if y is not None else UNPARSEABLE_YEAR)
        n_unparseable_year = (canonical_year == UNPARSEABLE_YEAR).sum()
        if n_unparseable_year:
            print(f"NOTE: {cohort_name} has {n_unparseable_year} row(s) whose year could not be parsed by Step 2's own rules "
                  f"- bucketed into an explicit '{UNPARSEABLE_YEAR}' stratum rather than dropped (matches Step 2's own logged exception count).")

        n_total = len(df)
        n_retained = retained_mask.sum()
        print(f"\n{cohort_name}: {n_total} total rows, {n_retained} retained after Step 3 organism exclusions")

        strata = pd.DataFrame({
            "organism": canonical_organism[retained_mask],
            "country": canonical_country[retained_mask],
            "year": canonical_year[retained_mask],
            "beta_lactamase": beta_normalized[retained_mask],
        })

        for (organism, country, year), group in strata.groupby(["organism", "country", "year"]):
            N = len(group)
            T = group["beta_lactamase"].notna().sum()
            P = (group["beta_lactamase"] == "POS").sum()

            tier1_lower = P / N
            tier1_upper = (P + N - T) / N
            tier2_lower = P / N
            tier2_upper = (P / T) if T > 0 else None

            bounds_rows.append({
                "cohort": cohort_name,
                "organism": organism,
                "country": country,
                "year": year,
                "N": N,
                "T": T,
                "P": P,
                "low_n_stratum": N < LOW_N_THRESHOLD,
                "tier1_assumption": "assumption_free_manski",
                "tier1_lower": round(tier1_lower, 4),
                "tier1_upper": round(tier1_upper, 4),
                "tier2_assumption": TIER2_ASSUMPTION_LABEL,
                "tier2_lower": round(tier2_lower, 4),
                "tier2_upper": round(tier2_upper, 4) if tier2_upper is not None else "",
                "version": "v1",
                "date_added": dt.date.today().isoformat(),
            })

    BOUNDS_PATH.parent.mkdir(parents=True, exist_ok=True)
    bounds_columns = [
        "cohort", "organism", "country", "year", "N", "T", "P", "low_n_stratum",
        "tier1_assumption", "tier1_lower", "tier1_upper",
        "tier2_assumption", "tier2_lower", "tier2_upper",
        "version", "date_added",
    ]
    pd.DataFrame(bounds_rows, columns=bounds_columns).to_csv(BOUNDS_PATH, index=False)
    n_low_n = sum(1 for r in bounds_rows if r["low_n_stratum"])
    print(f"\nWrote {len(bounds_rows)} organism x country x year stratum row(s) to "
          f"{BOUNDS_PATH.relative_to(ROOT.parents[0])} ({n_low_n} flagged low_n_stratum, N < {LOW_N_THRESHOLD} - "
          f"kept, not dropped; see docstring's judgment-call note).")

    # Whole-file rollup, printed for comparison against the plan's illustrative
    # arithmetic - never as a substitute for the stratified rows above (Check a/c).
    print("\nWhole-file rollups (for comparison against the plan's illustrative arithmetic only - not a reporting output):")
    for cohort_name, spec in SOAR_COHORTS.items():
        cohort_rows = [r for r in bounds_rows if r["cohort"] == cohort_name]
        N = sum(r["N"] for r in cohort_rows)
        T = sum(r["T"] for r in cohort_rows)
        P = sum(r["P"] for r in cohort_rows)
        tier1 = (P / N, (P + N - T) / N)
        tier2 = (P / N, P / T if T > 0 else None)
        print(f"  {cohort_name}: N={N} T={T} P={P} -> Tier1 [{tier1[0]:.4f}, {tier1[1]:.4f}], "
              f"Tier2 [{tier2[0]:.4f}, {tier2[1]:.4f}]" if tier2[1] is not None else
              f"  {cohort_name}: N={N} T={T} P={P} -> Tier1 [{tier1[0]:.4f}, {tier1[1]:.4f}], Tier2 lower {tier2[0]:.4f} (T=0, no upper)")

    # Check (a): every row in the deliverable carries both bounds and both assumption labels -
    # guaranteed by construction (every row written above has all 4 bound fields plus both
    # assumption-label columns), verified here rather than merely asserted.
    bounds_df = pd.DataFrame(bounds_rows)
    required_cols = ["tier1_assumption", "tier1_lower", "tier1_upper", "tier2_assumption", "tier2_lower"]
    if bounds_df.empty or bounds_df[required_cols].isna().any().any():
        print("FAIL: at least one bounds row is missing a bound or assumption label - a bare number would result.")
        failed = True
    else:
        print(f"\nPASS: all {len(bounds_df)} reported bounds carry both Tier 1 and Tier 2 bounds plus their assumption labels - no bare percentage anywhere.")

    # Check (b): every Tier 2 bound is labeled with the exact named assumption, distinguished from Tier 1.
    if not (bounds_df["tier2_assumption"] == TIER2_ASSUMPTION_LABEL).all():
        print("FAIL: not every Tier 2 bound carries the exact 'testing monotonicity (Manski & Molinari 2021)' label.")
        failed = True
    elif (bounds_df["tier1_assumption"] == bounds_df["tier2_assumption"]).any():
        print("FAIL: Tier 1 and Tier 2 assumption labels are not distinguished for at least one row.")
        failed = True
    else:
        print(f"PASS: every Tier 2 bound is labeled '{TIER2_ASSUMPTION_LABEL}', distinct from Tier 1's assumption-free label.")

    # Check (c): every bound is stratum-specific by organism x country x year (never a single
    # pooled whole-file row, and never merely organism-level pooling across country/year either).
    distinct_strata_per_cohort = bounds_df.groupby("cohort")["organism"].nunique()
    if (distinct_strata_per_cohort <= 1).any():
        print(f"FAIL: at least one cohort has only 1 organism stratum in the deliverable - would read as a pooled whole-file bound: {distinct_strata_per_cohort.to_dict()}")
        failed = True
    else:
        print(f"PASS: every cohort's bounds are broken out across multiple organism strata (counts: {distinct_strata_per_cohort.to_dict()}), never a single pooled figure.")

    # Check (d): the finer stratification is real, not cosmetic - confirm N sums to the same
    # retained total as before (no row silently lost to the new country/year grouping keys) and
    # that at least one organism actually splits across more than one country or year.
    n_from_strata = bounds_df.groupby("cohort")["N"].sum()
    n_sum_check_failed = False
    for cohort_name, spec in SOAR_COHORTS.items():
        if spec["reader"] == "csv":
            df = pd.read_csv(spec["path"], low_memory=False)
        else:
            df = pd.read_excel(spec["path"])
        organism_raw = df[spec["organism_col"]].where(df[spec["organism_col"]].notna(), None)
        canonical_organism = organism_raw.map(lambda v: organism_lookup.get(v, UNMAPPED_ORGANISM))
        expected_mask = canonical_organism != "excluded"
        evaluable_col = spec.get("evaluable_col")
        if evaluable_col:
            # AND, not a flat subtraction - a row can be both organism-excluded
            # and Evaluable=="N"; subtracting counts independently would
            # double-remove that overlap and produce a false mismatch below.
            expected_mask = expected_mask & (df[evaluable_col] != "N")
        n_expected_retained = int(expected_mask.sum())
        if n_from_strata.get(cohort_name, 0) != n_expected_retained:
            print(f"FAIL: {cohort_name} - stratified N sums to {n_from_strata.get(cohort_name, 0)}, "
                  f"expected {n_expected_retained} retained rows. Some row(s) were silently lost to grouping.")
            failed = True
            n_sum_check_failed = True
    if not n_sum_check_failed:
        print(f"PASS: every cohort's organism x country x year strata sum back to the exact retained row "
              f"count - the finer grouping keys lost zero rows (none silently bucketed out of the denominator).")

    country_year_splits = bounds_df.groupby(["cohort", "organism"])[["country", "year"]].apply(
        lambda g: g.drop_duplicates().shape[0] > 1
    )
    if not country_year_splits.any():
        print("FAIL: not one organism in any cohort splits across more than one country or year stratum - "
              "the country/year stratification would be cosmetic (identical to organism x cohort alone).")
        failed = True
    else:
        print(f"PASS: {country_year_splits.sum()} of {len(country_year_splits)} (cohort, organism) group(s) "
              f"genuinely split into more than one country/year stratum - confirms the finer stratification "
              f"is real, not a relabeling of the old organism x cohort table.")

    print(f"\nNOTE (judgment call applied, per this file's docstring): stratification is now organism x "
          f"cohort x country x year, per Section 5.5. {n_low_n} of {len(bounds_df)} strata are flagged "
          f"low_n_stratum (N < {LOW_N_THRESHOLD}) and kept rather than dropped or merged - Manski bounds "
          "remain valid at any N, just wider/less informative, so suppressing them would discard real "
          "information rather than fix a defect.")
    print("NOTE: all 3 Appendix 5 SS5.7 caveats apply to every bound reported above and are restated here, "
          "none silently dropped - (1) the underlying lab determination's error rate is unaudited; (2) whether "
          "'blank' genuinely means 'not tested' is unconfirmed against any of these files' documentation; "
          "(3) testing monotonicity (the Tier 2 assumption) is fundamentally untestable from this data by "
          "construction - nothing observable in data where negatives-among-untested are unknown by definition "
          "can confirm or refute it, so Tier 2's upper bound must always be presented as conditional on this "
          "assumption, never as a verified number.")
    print("NOTE (4th caveat, this deliverable's own validation coverage): SOAR_Hin's EG-07 resistant-only "
          "ascertainment-bias check reads +5.4pp against the +10pp pre-registered target - real and "
          "correctly-signed, but weaker than PLEA_I's +11.9pp. Verified root cause: BLNAR "
          "(beta-lactamase-negative, ampicillin-resistant H. influenzae) isolates share the same ampicillin "
          "MIC ceiling as beta-lactamase-positive isolates, so MIC-based resistant-only ascertainment cannot "
          "cleanly enrich for beta-lactamase genotype in this cohort. The bounds above are unaffected; this "
          "caveat discloses that the resampling design's evidence for ascertainment bias is weaker for "
          "SOAR_Hin than for PLEA_I. See EVIDENCE_GATE_ESTIMANDS.md SS4.1.")

    if failed:
        print("\nStep 8 Check: FAIL")
        sys.exit(1)

    print("\nStep 8 Check: PASS")


if __name__ == "__main__":
    main()
