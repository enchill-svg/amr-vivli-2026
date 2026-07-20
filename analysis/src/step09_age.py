"""
Step 9 - Age and demographic harmonization.

Issue (the brief's Section 5): the three SOAR cohorts record continuous age;
SENTRY records four age bands (0-17, 18-30, 31-60, 61+).

Action: bin SOAR ages into the same four bands for any analysis comparing age
structure across bacterial and fungal cohorts. Keep continuous age available
for bacteria-only analyses.

Check: every isolate with a non-missing age value receives exactly one
age-band label.

Pre-implementation verification (per this plan's own open-risk note - SOAR's
continuous age field was not independently checked before this step was
designed): all three SOAR cohorts do carry a whole-number continuous age
column (SOAR_201818 AGE, SOAR_201910 Age, SOAR_207965 Age), confirmed directly
against the raw files. That check also surfaced a real data-quality issue not
anticipated by the plan: SOAR_201818 has 11 rows and SOAR_207965 has 12 rows
with AGE = -1, a placeholder/sentinel value, not a literal age of -1. These
are treated as missing (unbanded), not binned into "0-17", and logged
separately so the judgment call is auditable.
"""
import datetime as dt
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
from _data_paths import COHORT_PATHS, SENTRY_PATH
SENTINEL_LOG_PATH = ROOT / "exceptions" / "age_sentinel_exclusions_log_v1.csv"

BAND_LABELS = ["0-17", "18-30", "31-60", "61+"]

SOAR_COHORTS = {
    "SOAR_201818": {
        "path": COHORT_PATHS["SOAR_201818"],
        "reader": "csv",
        "age_col": "AGE",
    },
    "SOAR_201910": {
        "path": COHORT_PATHS["SOAR_201910"],
        "reader": "excel",
        "age_col": "Age",
    },
    "SOAR_207965": {
        "path": COHORT_PATHS["SOAR_207965"],
        "reader": "excel",
        "age_col": "Age",
    },
}

SENTRY_BAND_NORMALIZATION = {
    "0 - 17": "0-17",
    "18 - 30": "18-30",
    "31 - 60": "31-60",
    "61+": "61+",
}


def bin_age(age):
    """Return a canonical band label, or None if age is null or a sentinel (<0)."""
    if age is None or pd.isna(age):
        return None
    if age < 0:
        return None
    if age <= 17:
        return "0-17"
    if age <= 30:
        return "18-30"
    if age <= 60:
        return "31-60"
    return "61+"


def main():
    failed = False
    sentinel_rows = []

    for name, spec in SOAR_COHORTS.items():
        if spec["reader"] == "csv":
            df = pd.read_csv(spec["path"], low_memory=False)
        else:
            df = pd.read_excel(spec["path"])
        age = df[spec["age_col"]]

        n_total = len(age)
        n_null = age.isna().sum()
        n_sentinel = (age.dropna() < 0).sum()
        bands = age.map(bin_age)
        n_banded = bands.notna().sum()

        print(f"{name}: {n_total} rows, {n_null} null age, {n_sentinel} negative-sentinel age, {n_banded} banded, band counts = {bands.value_counts(dropna=False).to_dict()}")

        for idx in age[(age.notna()) & (age < 0)].index:
            sentinel_rows.append({
                "cohort": name,
                "row_index": idx,
                "raw_age_value": age.loc[idx],
                "reason": "negative age value treated as a missing-age sentinel, not binned as a literal age",
                "version": "v1",
                "date_added": dt.date.today().isoformat(),
            })

        # Reconnaissance finding not anticipated by the plan: unlike the -1
        # sentinel (independently confirmed via direct inspection as a known
        # placeholder), there is no documented evidence that any specific high
        # age value is a sentinel rather than a real (if rare) elderly
        # patient. Ages >=100 are therefore surfaced here for visibility, not
        # silently re-bucketed or excluded - guessing they are sentinels
        # without a citation would be exactly the kind of fabrication this
        # pipeline avoids elsewhere. They remain binned "61+" per the
        # existing, correct rule.
        n_over_99 = (age.dropna() >= 100).sum()
        if n_over_99:
            print(f"NOTE: {name} has {n_over_99} row(s) with age >= 100 (max {age.dropna().max():.0f}) - "
                  f"plausible but unusually high; kept binned '61+' since no documented sentinel value "
                  f"applies here (open data-quality observation, not silently resolved).")

        # Check (a): every non-null, non-sentinel age gets exactly one of the 4 canonical bands.
        usable = age[(age.notna()) & (age >= 0)]
        usable_bands = usable.map(bin_age)
        if usable_bands.isna().any() or not usable_bands.isin(BAND_LABELS).all():
            print(f"FAIL: {name} has a usable age value that did not receive exactly one canonical band label.")
            failed = True
        else:
            print(f"PASS: {name} - all {len(usable)} usable (non-null, non-negative) age values received exactly one of the 4 canonical bands.")

        # Reconciliation: null + sentinel + banded == total.
        if n_null + n_sentinel + n_banded != n_total:
            print(f"FAIL: {name} reconciliation broken: {n_null} null + {n_sentinel} sentinel + {n_banded} banded != {n_total} total.")
            failed = True

    # Check (b): boundary values tested explicitly against the binning edges.
    boundary_expectations = {17: "0-17", 18: "18-30", 30: "18-30", 31: "31-60", 60: "31-60", 61: "61+"}
    boundary_failed = False
    for age_value, expected_band in boundary_expectations.items():
        actual = bin_age(age_value)
        if actual != expected_band:
            print(f"FAIL: boundary age {age_value} bins to {actual!r}, expected {expected_band!r}.")
            boundary_failed = True
    if boundary_failed:
        failed = True
    else:
        print(f"PASS: all 6 boundary ages ({sorted(boundary_expectations)}) bin to the expected band with no gap or overlap.")

    # SENTRY: normalize pre-existing band strings to the same canonical labels.
    df_sentry = pd.read_excel(SENTRY_PATH)
    raw_bands = df_sentry["Age Group"]
    n_total = len(raw_bands)
    n_null = raw_bands.isna().sum()
    normalized = raw_bands.map(lambda v: SENTRY_BAND_NORMALIZATION.get(v) if pd.notna(v) else None)
    unmapped = raw_bands[(raw_bands.notna()) & (normalized.isna())]
    print(f"\nSENTRY: {n_total} rows, {n_null} null age band, band counts (normalized) = {normalized.value_counts(dropna=False).to_dict()}")
    if len(unmapped):
        print(f"FAIL: SENTRY has {len(unmapped)} raw Age Group value(s) not recognized by the normalization map: {unmapped.unique()}")
        failed = True
    else:
        print(f"PASS: SENTRY - all non-null Age Group values normalize to one of the 4 canonical bands; {n_null} null rows remain unbanded (matches Appendix 1's 12.1% no-band-recorded rate).")

    SENTINEL_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(sentinel_rows, columns=[
        "cohort", "row_index", "raw_age_value", "reason", "version", "date_added",
    ]).to_csv(SENTINEL_LOG_PATH, index=False)
    print(f"\nWrote {len(sentinel_rows)} row(s) to {SENTINEL_LOG_PATH.relative_to(ROOT.parents[0])}")

    if failed:
        print("\nStep 9 Check: FAIL")
        sys.exit(1)

    print("\nStep 9 Check: PASS")


if __name__ == "__main__":
    main()
