"""Step 19 — Evidence Gate identifiability bounds (ATLAS Kp + unify ledger artifact)."""
import datetime as dt
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from evidence_gate_core.bounds import compute_manski_bounds
from evidence_gate_core.estimands import (
    ATLAS_KP_P_TOLERANCE,
    ATLAS_KP_SPECIES,
    ATLAS_KP_TIER1_LOWER_TOLERANCE,
    SSA_ISO3,
)
from evidence_gate_core.paths import ATLAS_KP_CLEAN, BOUNDS, IDENTIFIABILITY_BOUNDS
COUNTRY_CROSSWALK = ROOT / "crosswalks" / "country_iso3_crosswalk_v1.csv"
BETA_LACTAMASE_BOUNDS = BOUNDS / "beta_lactamase_bounds_v1.csv"
VERSION = "v1"
TODAY = dt.date.today().isoformat()


def _country_to_iso3(country: str, lookup: dict[str, str]) -> str:
    if pd.isna(country):
        return "UNMAPPED"
    return lookup.get(str(country).strip(), "UNMAPPED")


def atlas_kp_bounds(kp: pd.DataFrame, country_lookup: dict[str, str]) -> list[dict]:
    rows = []
    strata = [
        ("ATLAS_Kp_global", kp, "global|all"),
    ]
    kp_iso = kp.copy()
    kp_iso["iso3"] = kp_iso["Country"].map(lambda c: _country_to_iso3(c, country_lookup))
    ssa = kp_iso[kp_iso["iso3"].isin(SSA_ISO3)]
    if len(ssa):
        strata.append(("ATLAS_Kp_SSA", ssa, f"ssa|n_countries={ssa['iso3'].nunique()}"))

    for cohort_label, sub, dims in strata:
        N = len(sub)
        T = int(sub["gene_recorded"].sum())
        P = int(sub["carbapenemase_positive"].sum())
        b = compute_manski_bounds(N, T, P)
        rows.append(
            b.to_row(
                bound_id=f"{cohort_label}_carbapenemase",
                signal_type="detection_only_genotype",
                cohort=cohort_label,
                organism=ATLAS_KP_SPECIES,
                stratum_dims=dims,
                version=VERSION,
                date_added=TODAY,
            )
        )
    return rows


def soar_beta_lactamase_unified() -> list[dict]:
    if not BETA_LACTAMASE_BOUNDS.exists():
        return []
    bl = pd.read_csv(BETA_LACTAMASE_BOUNDS)
    rows = []
    for i, r in bl.iterrows():
        b = compute_manski_bounds(int(r["N"]), int(r["T"]), int(r["P"]))
        rows.append(
            b.to_row(
                bound_id=f"SOAR_beta_lactamase_{i}",
                signal_type="detection_only_genotype",
                cohort=str(r["cohort"]),
                organism=str(r["organism"]),
                stratum_dims=f"country={r['country']}|year={r['year']}",
                version=VERSION,
                date_added=TODAY,
            )
        )
    return rows


def main():
    failed = False
    if not ATLAS_KP_CLEAN.exists():
        print(f"FAIL: run step19a first — {ATLAS_KP_CLEAN} not found")
        sys.exit(1)

    kp = pd.read_csv(ATLAS_KP_CLEAN)
    cw = pd.read_csv(COUNTRY_CROSSWALK)
    country_lookup = dict(zip(cw["raw_string"], cw["iso3"]))

    rows = atlas_kp_bounds(kp, country_lookup) + soar_beta_lactamase_unified()
    out = pd.DataFrame(rows)
    IDENTIFIABILITY_BOUNDS.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(IDENTIFIABILITY_BOUNDS, index=False)
    print(f"Wrote {len(out)} bound row(s) to {IDENTIFIABILITY_BOUNDS.relative_to(ROOT)}")

    global_row = out[out["bound_id"] == "ATLAS_Kp_global_carbapenemase"].iloc[0]
    N, T, P = int(global_row["N"]), int(global_row["T"]), int(global_row["P"])
    tier1_lower = float(global_row["tier1_lower"])
    print(f"ATLAS Kp global: N={N} T={T} P={P} tier1=[{tier1_lower:.4f}, {float(global_row['tier1_upper']):.4f}]")

    # Reference: concept PDF P≈10150, tier1 lower≈9.5%
    if abs(P - 10150) > ATLAS_KP_P_TOLERANCE:
        print(f"NOTE: P={P} differs from concept PDF reference 10150 by >{ATLAS_KP_P_TOLERANCE} (raw export allele rule)")
    if abs(tier1_lower - 0.095) > ATLAS_KP_TIER1_LOWER_TOLERANCE:
        print(f"NOTE: tier1 lower {tier1_lower:.4f} outside ±{ATLAS_KP_TIER1_LOWER_TOLERANCE} of 9.5% reference")

    if global_row["tier2_upper_valid"] and float(global_row["naive_subset_ratio"] or 0) > 0.5:
        print(
            "NOTE: raw ATLAS export yields naive P/T >> 36.7% (detection-only positives only) — "
            "see docs/EVIDENCE_GATE_ESTIMANDS.md §2.5"
        )

    required = {"bound_id", "N", "T", "P", "tier1_lower", "tier1_upper", "tier2_upper_valid"}
    if not required.issubset(out.columns) or out.empty:
        print("FAIL: identifiability_bounds_v1.csv missing required columns or empty")
        failed = True
    else:
        print(f"PASS: {len(out)} unified bound rows with required schema")

    if failed:
        print("\nStep 19 Check: FAIL")
        sys.exit(1)
    print("\nStep 19 Check: PASS")


if __name__ == "__main__":
    main()
