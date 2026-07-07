"""
Step 6 supplemental - Evaluability impact on resistance-rate denominators.

Issue (Justice's Section 5, Step 6 Check): excluding Evaluable=N isolates from
resistance-rate denominators should move rates only in the expected direction.
The primary Step 6 script documents the exclusion log; this supplement quantifies
the denominator impact using the assembled master table.

Action: for SOAR_207965, compare per-drug resistance rates under two denominators:
  (a) all raw isolates in the cohort (3,134), counting untested isolates in the
      denominator (lowers apparent resistance prevalence), versus
  (b) analysis-ready isolates only (Evaluable=Y with at least one measurement,
      matching Step 6's intended denominator).

Check: every Evaluable=N isolate is confirmed to contribute zero master-table rows
(zero measurements), so the numerator (R count) is identical under both schemes;
only the denominator differs. The comparison table is persisted for audit.
"""
import datetime as dt
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
from _data_paths import SOAR_207965_PATH

MASTER_PATH = ROOT / "master" / "master_table_v1.csv"
REGISTRY_PATH = ROOT / "master" / "isolate_registry_v1.csv"
COMPARISON_PATH = ROOT / "exceptions" / "evaluability_rate_comparison_v1.csv"
COHORT = "SOAR_207965"
RAW_PATH = SOAR_207965_PATH


def main():
    failed = False
    today = dt.date.today().isoformat()

    raw_df = pd.read_excel(RAW_PATH)
    n_raw = len(raw_df)
    n_eval_n = (raw_df["Evaluable"] == "N").sum()

    master_df = pd.read_csv(MASTER_PATH, low_memory=False)
    registry_df = pd.read_csv(REGISTRY_PATH, low_memory=False, dtype={"isolate_id": str})

    cohort_master = master_df[master_df["source_cohort"] == COHORT]
    cohort_registry = registry_df[registry_df["source_cohort"] == COHORT]

    # Confirm Evaluable=N isolates have zero master rows.
    eval_n_ids = set(
        cohort_registry.loc[cohort_registry["evaluable_flag"] == "N", "isolate_id"]
    )
    master_ids_with_rows = set(cohort_master["isolate_id"].astype(str))
    eval_n_in_master = eval_n_ids & master_ids_with_rows
    if eval_n_in_master:
        print(f"FAIL: {len(eval_n_in_master)} Evaluable=N isolate(s) appear in master table.")
        failed = True
    else:
        print(f"PASS: all {len(eval_n_ids)} Evaluable=N isolate(s) have zero master-table rows.")

    n_analysis_ready = cohort_registry["in_master_table"].sum()
    print(f"{COHORT}: {n_raw} raw isolates, {n_eval_n} Evaluable=N, "
          f"{n_analysis_ready} analysis-ready (in master/registry with measurements).")

    comparison_rows = []
    for drug, group in cohort_master.groupby("canonical_drug"):
        r_rows = group[group["resistance_category"] == "R"]
        r_count = len(r_rows)
        tested_isolates = group["isolate_id"].nunique()
        r_isolates = r_rows["isolate_id"].nunique()
        rate_tested_isolates = 100 * r_isolates / tested_isolates if tested_isolates else 0
        rate_all_raw = 100 * r_isolates / n_raw
        rate_analysis_ready = 100 * r_isolates / n_analysis_ready if n_analysis_ready else 0
        comparison_rows.append({
            "cohort": COHORT,
            "canonical_drug": drug,
            "r_isolate_count": r_isolates,
            "r_row_count": r_count,
            "tested_isolate_count": tested_isolates,
            "rate_pct_tested_isolates": round(rate_tested_isolates, 4),
            "rate_pct_all_raw_isolates": round(rate_all_raw, 4),
            "rate_pct_analysis_ready_isolates": round(rate_analysis_ready, 4),
            "denominator_shift_pp": round(rate_tested_isolates - rate_all_raw, 4),
            "version": "v1",
            "date_added": today,
        })

    COMPARISON_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(comparison_rows).sort_values("canonical_drug").to_csv(COMPARISON_PATH, index=False)
    print(f"Wrote {len(comparison_rows)} drug-level rate-comparison row(s) to "
          f"{COMPARISON_PATH.relative_to(ROOT.parents[0])}")

    # Check: excluding Evaluable=N lowers apparent rates at isolate level.
    # Numerator (R isolates) unchanged; larger all-raw denominator lowers rate.
    bad_direction = [r for r in comparison_rows if r["denominator_shift_pp"] < -0.0001]
    if bad_direction:
        print(f"FAIL: {len(bad_direction)} drug(s) show rate increase when using all-raw denominator.")
        failed = True
    else:
        print(f"PASS: for all {len(comparison_rows)} drugs, using all raw isolates as denominator "
              f"lowers or preserves apparent resistance rate vs tested-only (Evaluable=N isolates "
              f"contribute zero R counts and zero measurements).")

    if failed:
        print("\nStep 6 rate-comparison Check: FAIL")
        sys.exit(1)

    print("\nStep 6 rate-comparison Check: PASS")


if __name__ == "__main__":
    main()
