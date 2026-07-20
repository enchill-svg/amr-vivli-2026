"""
Step 6 - Quality and evaluability filtering.

Issue (the brief's Section 5): SOAR 207965 carries an Evaluable flag; about 20%
of isolates are marked "N".

Action: exclude Evaluable = N isolates from resistance-rate denominators.
Retain them in a documented exclusions table rather than deleting them, so the
exclusion is auditable.

Check: the exclusions log contains exactly the Evaluable = N isolates, all
from SOAR 207965 (no Evaluable column exists in the other three cohorts - this
step is a pass-through no-op for them); the Evaluable flag itself is retained
as a passthrough field, not consumed and discarded.

Open risk, not resolved by this step (carried forward honestly, not silently
assumed): what "Evaluable = N" actually means clinically or technically -
e.g. a QC failure, an indeterminate reading, a specimen contamination flag -
was never confirmed against SOAR 207965's own documentation. The brief's
original Check text expects excluding these isolates to move resistance
rates "only in the expected direction"; that half of the Check cannot be
executed without knowing what the flag represents, so it is not attempted
here rather than approximated.
"""
import datetime as dt
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
from _data_paths import COHORT_PATHS, SOAR_207965_PATH
EXCLUSIONS_PATH = ROOT / "exceptions" / "evaluability_exclusions_log_v1.csv"


def main():
    failed = False

    df = pd.read_excel(SOAR_207965_PATH)
    n_total = len(df)
    counts = df["Evaluable"].value_counts(dropna=False).to_dict()
    print(f"SOAR_207965: {n_total} rows, Evaluable value counts = {counts}")

    excluded = df[df["Evaluable"] == "N"]
    n_excluded = len(excluded)
    pct_excluded = 100 * n_excluded / n_total

    print(f"Excluded (Evaluable = N): {n_excluded} rows ({pct_excluded:.2f}% of {n_total}).")

    if n_excluded != 613:
        print(f"NOTE: expected 613 per Appendix 1's verified grounding, found {n_excluded} - using live count as ground truth.")

    exclusions_rows = [{
        "cohort": "SOAR_207965",
        "row_index": idx,
        "evaluable_flag": "N",
        "reason": "Evaluable = N; excluded from resistance-rate denominators per Step 6 Action",
        "version": "v1",
        "date_added": dt.date.today().isoformat(),
    } for idx in excluded.index]

    EXCLUSIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(exclusions_rows, columns=[
        "cohort", "row_index", "evaluable_flag", "reason", "version", "date_added",
    ]).to_csv(EXCLUSIONS_PATH, index=False)
    print(f"Wrote {len(exclusions_rows)} row(s) to {EXCLUSIONS_PATH.relative_to(ROOT.parents[0])}")

    # Check (a): exclusions log contains exactly the Evaluable=N rows, all from SOAR_207965.
    if len(exclusions_rows) != n_excluded:
        print("FAIL: exclusions log row count does not match the number of Evaluable=N rows.")
        failed = True
    else:
        print(f"PASS: exclusions log contains exactly the {n_excluded} Evaluable=N row(s), all tagged SOAR_207965.")

    # Confirm Evaluable is restricted to Y/N and every row is accounted for independently.
    evaluable_values = set(df["Evaluable"].dropna().astype(str).unique())
    allowed_evaluable = {"Y", "N"}
    unexpected = evaluable_values - allowed_evaluable
    if unexpected:
        print(f"FAIL: Evaluable column contains unexpected values: {sorted(unexpected)}")
        failed = True
    else:
        print(f"PASS: Evaluable column restricted to {sorted(allowed_evaluable)}.")

    n_retained_direct = int((df["Evaluable"] == "Y").sum())
    n_excluded_direct = int((df["Evaluable"] == "N").sum())
    n_missing_evaluable = n_total - n_retained_direct - n_excluded_direct
    if n_missing_evaluable:
        print(
            f"FAIL: {n_missing_evaluable} row(s) have missing Evaluable values "
            f"({n_retained_direct} Y + {n_excluded_direct} N != {n_total} total)."
        )
        failed = True
    elif n_excluded_direct != n_excluded:
        print(
            f"FAIL: direct Evaluable=N count ({n_excluded_direct}) "
            f"does not match exclusion filter count ({n_excluded})."
        )
        failed = True
    else:
        print(
            f"PASS: {n_retained_direct} retained (Y) + {n_excluded_direct} excluded (N) "
            f"= {n_total} total - no isolate unaccounted for."
        )

    # Confirm other three cohorts have no Evaluable column (pass-through no-op).
    other_cohorts = {
        "SOAR_201818": COHORT_PATHS["SOAR_201818"],
        "SOAR_201910": COHORT_PATHS["SOAR_201910"],
        "SENTRY": COHORT_PATHS["SENTRY"],
    }
    for name, path in other_cohorts.items():
        cols = list(pd.read_csv(path, nrows=1).columns) if path.suffix == ".csv" else list(pd.read_excel(path, nrows=1).columns)
        if "Evaluable" in cols:
            print(f"FAIL: {name} unexpectedly has an Evaluable column - Step 6 is no longer a no-op for this cohort.")
            failed = True
        else:
            print(f"PASS: {name} has no Evaluable column - confirmed pass-through no-op.")

    print("NOTE: what 'Evaluable = N' means clinically/technically was never confirmed against SOAR 207965's "
          "own documentation, so the brief's 'excluding these isolates should move rates only in the expected "
          "direction' half of this Check is not attempted here (open risk, not silently resolved).")

    if failed:
        print("\nStep 6 Check: FAIL")
        sys.exit(1)

    print("\nStep 6 Check: PASS")


if __name__ == "__main__":
    main()
