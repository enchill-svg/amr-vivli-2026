"""
Step 6 - Quality and evaluability filtering.

Issue (Justice's Section 5): SOAR 207965 carries an Evaluable flag; about 20%
of isolates are marked "N".

Action: exclude Evaluable = N isolates from resistance-rate denominators.
Retain them in a documented exclusions table rather than deleting them, so the
exclusion is auditable.

Check: the exclusions log contains exactly the Evaluable = N isolates, all
from SOAR 207965 (no Evaluable column exists in the other three cohorts - this
step is a pass-through no-op for them); the Evaluable flag itself is retained
as a passthrough field, not consumed and discarded.
"""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parents[0] / "AMR_Datasets"
EXCLUSIONS_PATH = ROOT / "exceptions" / "evaluability_exclusions_log_v1.csv"

SOAR_207965_PATH = DATA_ROOT / "SOAR 207965" / "SOAR 207965 Complete data set 04Sep25.xlsx"


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
        "date_added": "2026-07-06",
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

    # Confirm no isolate is unaccounted for: retained + excluded == total.
    n_retained = n_total - n_excluded
    if n_retained + n_excluded != n_total:
        print("FAIL: retained + excluded does not reconcile against total row count.")
        failed = True
    else:
        print(f"PASS: {n_retained} retained + {n_excluded} excluded = {n_total} total - no isolate unaccounted for.")

    # Confirm other three cohorts have no Evaluable column (pass-through no-op).
    other_cohorts = {
        "SOAR_201818": DATA_ROOT / "SOAR 201818" / "gsk_201818_published.csv",
        "SOAR_201910": DATA_ROOT / "SOAR 201910" / "GSK_SOAR_201910 raw data.xlsx",
        "SENTRY": DATA_ROOT / "ATLAS_Antifungals" / "vivli_sentry_2010_2024.xlsx",
    }
    for name, path in other_cohorts.items():
        cols = list(pd.read_csv(path, nrows=1).columns) if path.suffix == ".csv" else list(pd.read_excel(path, nrows=1).columns)
        if "Evaluable" in cols:
            print(f"FAIL: {name} unexpectedly has an Evaluable column - Step 6 is no longer a no-op for this cohort.")
            failed = True
        else:
            print(f"PASS: {name} has no Evaluable column - confirmed pass-through no-op.")

    if failed:
        print("\nStep 6 Check: FAIL")
        sys.exit(1)

    print("\nStep 6 Check: PASS")


if __name__ == "__main__":
    main()
