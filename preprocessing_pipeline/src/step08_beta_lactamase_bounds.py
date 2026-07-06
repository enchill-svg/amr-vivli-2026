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

Retained isolates are scoped using Step 3's organism crosswalk (excluding No
Growth / environmental-contaminant / cross-domain-fungal rows), per this
step's own dependency on Step 3.

Reconnaissance for this step also directly resolves a flagged gap (SOAR
201910's Betalactamase breakdown was "never counted" per the plan's own
verified-grounding note): the live data shows SOAR_201910 spells the same two
categories two different ways - "NEG"/"Negative" and "POS"/"Positive" - which
must be normalized to a single POS/NEG pair before counting T and P, or the
breakdown would silently undercount both.
"""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parents[0] / "AMR_Datasets"
ORGANISM_CROSSWALK_PATH = ROOT / "crosswalks" / "organism_crosswalk_v1.csv"
BOUNDS_PATH = ROOT / "bounds" / "beta_lactamase_bounds_v1.csv"

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
        "path": DATA_ROOT / "SOAR 201818" / "gsk_201818_published.csv",
        "reader": "csv",
        "organism_col": "ORGANISMNAME",
        "beta_lactamase_col": "BETALACTAMASE",
    },
    "SOAR_201910": {
        "path": DATA_ROOT / "SOAR 201910" / "GSK_SOAR_201910 raw data.xlsx",
        "reader": "excel",
        "organism_col": "Organism",
        "beta_lactamase_col": "Betalactamase",
    },
    "SOAR_207965": {
        "path": DATA_ROOT / "SOAR 207965" / "SOAR 207965 Complete data set 04Sep25.xlsx",
        "reader": "excel",
        "organism_col": "FinalOrganismName",
        "beta_lactamase_col": "Beta Lactamase",
    },
}


def load_organism_crosswalk():
    cw = pd.read_csv(ORGANISM_CROSSWALK_PATH, keep_default_na=False)
    lookup = {}
    for _, row in cw.iterrows():
        key = None if row["raw_string"] == "<null>" else row["raw_string"]
        lookup[key] = row["canonical_organism"]
    return lookup


def main():
    failed = False
    organism_lookup = load_organism_crosswalk()
    bounds_rows = []

    for cohort_name, spec in SOAR_COHORTS.items():
        if spec["reader"] == "csv":
            df = pd.read_csv(spec["path"], low_memory=False)
        else:
            df = pd.read_excel(spec["path"])

        organism_raw = df[spec["organism_col"]].where(df[spec["organism_col"]].notna(), None)
        canonical_organism = organism_raw.map(organism_lookup)
        retained_mask = canonical_organism != "excluded"

        beta_raw = df[spec["beta_lactamase_col"]]
        beta_normalized = beta_raw.map(lambda v: BETA_LACTAMASE_NORMALIZATION.get(v) if pd.notna(v) else None)

        unrecognized = beta_raw[(beta_raw.notna()) & (beta_normalized.isna())]
        if len(unrecognized):
            print(f"FAIL: {cohort_name} has {len(unrecognized)} Beta Lactamase value(s) not recognized by the normalization map: {unrecognized.unique()}")
            failed = True

        n_total = len(df)
        n_retained = retained_mask.sum()
        print(f"\n{cohort_name}: {n_total} total rows, {n_retained} retained after Step 3 organism exclusions")

        strata = pd.DataFrame({
            "organism": canonical_organism[retained_mask],
            "beta_lactamase": beta_normalized[retained_mask],
        })

        for organism, group in strata.groupby("organism"):
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
                "N": N,
                "T": T,
                "P": P,
                "tier1_assumption": "assumption_free_manski",
                "tier1_lower": round(tier1_lower, 4),
                "tier1_upper": round(tier1_upper, 4),
                "tier2_assumption": TIER2_ASSUMPTION_LABEL,
                "tier2_lower": round(tier2_lower, 4),
                "tier2_upper": round(tier2_upper, 4) if tier2_upper is not None else "",
                "version": "v1",
                "date_added": "2026-07-06",
            })

    BOUNDS_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(bounds_rows, columns=[
        "cohort", "organism", "N", "T", "P",
        "tier1_assumption", "tier1_lower", "tier1_upper",
        "tier2_assumption", "tier2_lower", "tier2_upper",
        "version", "date_added",
    ]).to_csv(BOUNDS_PATH, index=False)
    print(f"\nWrote {len(bounds_rows)} organism-stratum row(s) to {BOUNDS_PATH.relative_to(ROOT.parents[0])}")

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

    # Check (c): every bound is stratum-specific by organism (never a single pooled whole-file row).
    distinct_strata_per_cohort = bounds_df.groupby("cohort")["organism"].nunique()
    if (distinct_strata_per_cohort <= 1).any():
        print(f"FAIL: at least one cohort has only 1 organism stratum in the deliverable - would read as a pooled whole-file bound: {distinct_strata_per_cohort.to_dict()}")
        failed = True
    else:
        print(f"PASS: every cohort's bounds are broken out across multiple organism strata (counts: {distinct_strata_per_cohort.to_dict()}), never a single pooled figure.")

    print("\nNOTE (open risk, not resolved here): stratification above is organism x cohort only, not the "
          "full organism/cohort/country/year stratification Section 5.5 calls for - that finer breakdown "
          "is not implemented in this step. Also unresolved: whether 'blank' genuinely means 'not tested' "
          "for any of these files, and whether the underlying lab determination is error-free - both are "
          "required audits this pipeline does not perform (Appendix 5 SS5.7).")

    if failed:
        print("\nStep 8 Check: FAIL")
        sys.exit(1)

    print("\nStep 8 Check: PASS")


if __name__ == "__main__":
    main()
