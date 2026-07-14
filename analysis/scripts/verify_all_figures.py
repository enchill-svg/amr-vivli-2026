#!/usr/bin/env python3
"""Recompute Layer A headline numbers; exit non-zero on drift."""
from __future__ import annotations

import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from evidence_gate_core.estimands import (
    ATLAS_KP_P_TOLERANCE,
    ATLAS_KP_TIER1_LOWER_TOLERANCE,
    BIAS_TOLERANCE_PP,
    COVERAGE_HIGH,
    COVERAGE_LOW,
    RESISTANT_ONLY_MIN_BIAS_PP,
)

DELIVERABLES = ROOT / "deliverables"
BOUNDS = ROOT / "bounds"


def check(name: str, ok: bool, detail: str = "") -> bool:
    status = "PASS" if ok else "FAIL"
    print(f"  [{status}] {name}" + (f" — {detail}" if detail else ""))
    return ok


def main() -> int:
    all_ok = True
    print("Platform verification (integrity proof + gated deliverables)\n")

    # EG-01, EG-02 from Justice ledger (unchanged by Layer A)
    ledger_path = DELIVERABLES / "identifiability_ledger_v1.csv"
    if ledger_path.exists():
        ledger = pd.read_csv(ledger_path)
        all_ok &= check(
            "EG-01 beta-lactamase ledger",
            "bacterial_beta_lactamase_detection_only" in set(ledger["ledger_id"]),
        )
        fung = ledger[ledger["ledger_id"] == "fungal_unclassifiable_no_standard"]
        if len(fung):
            n = int(fung.iloc[0]["n_strata_or_rows"])
            all_ok &= check("EG-02 fungal unclassifiable ~48k", 47000 <= n <= 49000, f"n={n}")
        else:
            all_ok &= check("EG-02 fungal unclassifiable", False)
    else:
        all_ok &= check("EG-01/02 ledger exists", False, "run step18 first")

    # EG-03, EG-04 ATLAS bounds
    bounds_path = BOUNDS / "identifiability_bounds_v1.csv"
    if bounds_path.exists():
        bounds = pd.read_csv(bounds_path)
        g = bounds[bounds["bound_id"] == "ATLAS_Kp_global_carbapenemase"]
        if len(g):
            row = g.iloc[0]
            P, N = int(row["P"]), int(row["N"])
            t1l = float(row["tier1_lower"])
            all_ok &= check("EG-03 ATLAS Kp tier1 lower ~9.5%", abs(t1l - 0.095) <= ATLAS_KP_TIER1_LOWER_TOLERANCE, f"{t1l:.4f}")
            all_ok &= check("EG-04 ATLAS Kp P count", abs(P - 10150) <= ATLAS_KP_P_TOLERANCE, f"P={P}")
        else:
            all_ok &= check("EG-03/04 ATLAS global row", False)
    else:
        all_ok &= check("identifiability_bounds_v1.csv", False, "run step19")

    # EG-05, EG-06, EG-07 validation
    val_path = BOUNDS / "sampling_validation_summary_v1.csv"
    if val_path.exists():
        val = pd.read_csv(val_path)
        for ds, eg in [("PLEA_I", "EG-05 PLEA representative"), ("SOAR_Hin", "EG-06 SOAR representative")]:
            sub = val[(val["dataset"] == ds) & (val["design"] == "representative_ht")]
            if len(sub):
                bias = abs(float(sub["mean_bias_pp"].mean()))
                cov = float(sub["coverage_rate"].mean())
                all_ok &= check(eg, bias <= BIAS_TOLERANCE_PP and COVERAGE_LOW <= cov <= COVERAGE_HIGH, f"bias={bias:.2f}pp cov={cov:.3f}")
            else:
                all_ok &= check(eg, False)
        res = val[val["design"] == "resistant_only"]
        if len(res):
            max_bias = float(res["mean_bias_pp"].max())
            all_ok &= check("EG-07 resistant-only bias", max_bias >= RESISTANT_ONLY_MIN_BIAS_PP, f"max={max_bias:.1f}pp")
        else:
            all_ok &= check("EG-07 resistant-only", False)
    else:
        all_ok &= check("sampling_validation_summary", False, "run step20")

    # J-01–J-04 gated Justice deliverables
    gated_risk = DELIVERABLES / "country_risk_ranking_bacterial_gated_v1.csv"
    if gated_risk.exists():
        gr = pd.read_csv(gated_risk)
        all_ok &= check("J-01 gated bacterial risk exists", "quality_gate" in gr.columns)
        all_ok &= check(
            "J-02 gated risk has pass rows",
            (gr["quality_gate"] == "pass").any(),
            f"n_pass={(gr['quality_gate'] == 'pass').sum()}",
        )
    else:
        all_ok &= check("J-01 gated bacterial risk", False, "run step18b")

    gated_int = DELIVERABLES / "intervention_recommendations_ranked_gated_v1.csv"
    if gated_int.exists():
        gi = pd.read_csv(gated_int)
        hib = gi[(gi["sub_measure"] == "hib3_coverage") & (gi["pathogen_type"] == "bacterial")]
        hib_ok = hib["priority_rank"].isna().all()
        all_ok &= check("J-03 Hib excluded from gated rank", hib_ok, f"n_hib_rows={len(hib)}")
        ranked = gi[gi["priority_rank"].notna()]
        j04_ok = len(ranked) == 0
        all_ok &= check(
            "J-04 zero gated intervention ranks (integrity policy)",
            j04_ok,
            f"n_ranked={len(ranked)}",
        )
    else:
        all_ok &= check("J-03/04 gated interventions", False, "run step18b")

    comp = DELIVERABLES / "gating_comparison_v1.csv"
    all_ok &= check("J-05 gating comparison table", comp.exists())
    if comp.exists():
        comp_df = pd.read_csv(comp)
        int_row = comp_df[comp_df["deliverable"] == "intervention_recommendations"]
        if len(int_row):
            n_pass = int(int_row.iloc[0]["n_pass"])
            all_ok &= check(
                "J-06 zero intervention quality_gate=pass rows",
                n_pass == 0,
                f"n_pass={n_pass}",
            )

    # S6 Hub funding composition (modality + SSA geography)
    hub_path = DELIVERABLES / "hub_funding_composition_summary_v1.csv"
    if hub_path.exists():
        hub = pd.read_csv(hub_path)
        for dim in ("modality", "geography"):
            sub = hub[hub["composition_dimension"] == dim]
            share_sum = float(sub["share_of_hub_total"].sum()) if len(sub) else float("nan")
            all_ok &= check(
                f"S6 Hub {dim} shares sum ~1",
                abs(share_sum - 1.0) <= 1e-6,
                f"sum={share_sum}",
            )
        mod = set(hub.loc[hub["composition_dimension"] == "modality", "bucket"])
        geo = set(hub.loc[hub["composition_dimension"] == "geography", "bucket"])
        all_ok &= check(
            "S6 Hub modality buckets complete",
            mod == {"diagnostics", "therapeutics_drugs", "vaccines", "product_mixed", "other_or_unclassified"},
            f"buckets={sorted(mod)}",
        )
        all_ok &= check(
            "S6 Hub geography buckets complete",
            geo == {"ssa", "non_ssa", "geography_unknown"},
            f"buckets={sorted(geo)}",
        )
        from _section6_external import classify_hub_modality, classify_hub_geography
        from evidence_gate_core.estimands import SSA_ISO3

        all_ok &= check(
            "S6 solo Other Products -> other_or_unclassified",
            classify_hub_modality("Other Products") == "other_or_unclassified",
        )
        all_ok &= check(
            "S6 Therapeutics+Vaccines -> product_mixed",
            classify_hub_modality("Therapeutics, Vaccines") == "product_mixed",
        )
        all_ok &= check(
            "S6 Global Partnership -> geography_unknown",
            classify_hub_geography("Global Partnership", "Global Partnership", SSA_ISO3)
            == "geography_unknown",
        )
        all_ok &= check(
            "S6 Angola institution -> ssa",
            classify_hub_geography("Angola", "United States", SSA_ISO3) == "ssa",
        )
        all_ok &= check("S6 Hub composition rows present", len(hub) == 8, f"n={len(hub)}")
    else:
        all_ok &= check("S6 Hub composition summary", False, "run step16 first")

    print()
    if all_ok:
        print("verify_all_figures: ALL CHECKS PASSED")
        return 0
    print("verify_all_figures: FAILED")
    return 1


if __name__ == "__main__":
    raise SystemExit(main())
