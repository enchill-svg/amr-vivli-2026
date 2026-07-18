"""Step 20 — Evidence Gate sampling validation (PLEA + SOAR)."""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from evidence_gate_core.paths import PLEA_CLEAN, SAMPLING_VALIDATION, SAMPLING_VALIDATION_SUMMARY
from evidence_gate_core.validate_sampling import check_validation_summary, resample_validate
from step08_beta_lactamase_bounds import BETA_LACTAMASE_NORMALIZATION, SOAR_COHORTS, parse_year

BOUNDS = ROOT / "bounds"


def load_soar_hib_complete() -> pd.DataFrame:
    frames = []
    for cohort_name, spec in SOAR_COHORTS.items():
        if spec["reader"] == "csv":
            raw = pd.read_csv(spec["path"], low_memory=False)
        else:
            raw = pd.read_excel(spec["path"])
        org_col = spec["organism_col"]
        sub = raw[raw[org_col].astype(str).str.contains("Haemophilus influenzae", case=False, na=False)].copy()
        if sub.empty:
            continue
        beta = sub[spec["beta_lactamase_col"]].map(
            lambda v: BETA_LACTAMASE_NORMALIZATION.get(v) if pd.notna(v) else None
        )
        sub = sub[beta.notna()].copy()
        sub["beta_lactamase_positive"] = beta[beta.notna()] == "POS"
        # ampicillin MIC column names differ: 201818/207965 spell it out
        # ("AMPICILLIN"/"Ampicillin"), 201910 uses the short code "AMP"
        # (verified directly against each cohort's raw column headers).
        amp_col = None
        for c in sub.columns:
            if str(c).upper().replace(" ", "") in ("AMPICILLIN", "AMP"):
                amp_col = c
                break
        if amp_col is None:
            continue
        sub["ampicillin_mic"] = pd.to_numeric(
            sub[amp_col].astype(str).str.replace(r"[<>=/]", "", regex=True),
            errors="coerce",
        )
        sub["cohort"] = cohort_name
        frames.append(sub[["beta_lactamase_positive", "ampicillin_mic", "cohort"]])
    if not frames:
        raise RuntimeError("No SOAR H. influenzae complete-result rows found")
    return pd.concat(frames, ignore_index=True)


def main():
    failed = False
    if not PLEA_CLEAN.exists():
        print("FAIL: run step19a first")
        sys.exit(1)

    plea = pd.read_csv(PLEA_CLEAN)
    soar = load_soar_hib_complete()

    d1, s1 = resample_validate(
        plea, "carbapenemase_positive", "meropenem_mic", "PLEA_I"
    )
    d2, s2 = resample_validate(
        soar, "beta_lactamase_positive", "ampicillin_mic", "SOAR_Hin"
    )
    detail = pd.concat([d1, d2], ignore_index=True)
    summary = pd.concat([s1, s2], ignore_index=True)

    BOUNDS.mkdir(parents=True, exist_ok=True)
    detail.to_csv(SAMPLING_VALIDATION, index=False)
    summary.to_csv(SAMPLING_VALIDATION_SUMMARY, index=False)
    print(f"Wrote {len(detail)} validation detail row(s) to {SAMPLING_VALIDATION.relative_to(ROOT)}")
    print(f"Wrote {len(summary)} summary row(s) to {SAMPLING_VALIDATION_SUMMARY.relative_to(ROOT)}")

    print("\nValidation summary:")
    print(summary.to_string(index=False))

    errors, warnings = check_validation_summary(summary)
    for w in warnings:
        print(f"WARN: {w}")
    for e in errors:
        print(f"FAIL: {e}")
        failed = True

    if not failed:
        if warnings:
            print(
                "PASS (with documented caveat): representative design near-zero bias "
                "and nominal coverage; resistant-only inflated in the correct direction "
                "for every dataset — see WARN line(s) above for dataset(s) below the "
                "+10pp target under a documented mechanism exception."
            )
        else:
            print("PASS: representative design near-zero bias and nominal coverage; resistant-only inflated")

    if failed:
        print("\nStep 20 Check: FAIL")
        sys.exit(1)
    print("\nStep 20 Check: PASS")


if __name__ == "__main__":
    main()
