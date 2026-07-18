"""
Step 18b — Gated Section 7 deliverables (integrity layer).

Reads ungated Step 18 outputs and applies quality_gate rules so public-facing
rankings honor identifiability constraints before dashboard publish.
"""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DELIVERABLES = ROOT / "deliverables"
MASTER = ROOT / "master"
sys.path.insert(0, str(ROOT / "src"))

from evidence_gate_core.export_validator import validate_gated_deliverable  # noqa: E402
from evidence_gate_core.gate_rules import (  # noqa: E402
    GATE_METHODOLOGY,
    aggregate_country_gate,
    build_organism_drug_gate_table,
    gate_intervention_recommendations,
)

TODAY = dt.date.today().isoformat()
VERSION = "v1"


def gate_cluster_typology(pathogen_type: str, org_drug_gates: pd.DataFrame) -> pd.DataFrame:
    path = DELIVERABLES / f"cluster_typology_{pathogen_type}_v1.csv"
    df = pd.read_csv(path)
    merged = df.merge(
        org_drug_gates,
        on=["pathogen_type", "canonical_organism", "canonical_drug"],
        how="left",
    )
    merged["quality_gate"] = merged["quality_gate"].fillna("withhold")
    merged["gate_reason"] = merged["gate_reason"].fillna("missing_organism_drug_gate")
    merged["typology_rank_ungated"] = merged["typology_rank"]
    rankable = merged[merged["quality_gate"] == "pass"].sort_values(
        "composite_priority_score", ascending=False
    )
    merged["typology_rank"] = np.nan
    for i, idx in enumerate(rankable.index, start=1):
        merged.at[idx, "typology_rank"] = i
    merged["methodology"] = (
        str(merged["methodology"].iloc[0]) if len(merged) else ""
    ) + f" {GATE_METHODOLOGY}"
    merged["version"] = VERSION
    merged["date_added"] = TODAY
    return merged


def gate_country_risk_ranking(pathogen_type: str, country_gates: pd.DataFrame) -> pd.DataFrame:
    path = DELIVERABLES / f"country_risk_ranking_{pathogen_type}_v1.csv"
    df = pd.read_csv(path)
    merged = df.merge(country_gates, on="iso3_country", how="left")
    merged["quality_gate"] = merged["quality_gate"].fillna("withhold")
    merged["gate_reason"] = merged["gate_reason"].fillna("missing_country_gate")
    merged["risk_rank_ungated"] = merged["risk_rank"]
    rankable = merged[merged["quality_gate"] == "pass"].sort_values(
        ["composite_risk_score_core", "composite_risk_score", "iso3_country"],
        ascending=[False, False, True],
    )
    merged["risk_rank"] = np.nan
    for i, idx in enumerate(rankable.index, start=1):
        merged.at[idx, "risk_rank"] = i
    merged["methodology"] = str(merged["methodology"].iloc[0]) + f" {GATE_METHODOLOGY}"
    merged["version"] = VERSION
    merged["date_added"] = TODAY
    return merged


def build_gating_comparison(
    bact_typ: pd.DataFrame,
    fung_typ: pd.DataFrame,
    bact_risk: pd.DataFrame,
    fung_risk: pd.DataFrame,
    interventions: pd.DataFrame,
) -> pd.DataFrame:
    rows = []

    def _summary(deliverable: str, pathogen_type: str, df: pd.DataFrame, rank_col: str) -> None:
        rows.append(
            {
                "deliverable": deliverable,
                "pathogen_type": pathogen_type,
                "n_rows": len(df),
                "n_pass": int((df["quality_gate"] == "pass").sum()),
                "n_bounds_only": int((df["quality_gate"] == "bounds_only").sum()),
                "n_withhold": int((df["quality_gate"] == "withhold").sum()),
                "n_ranked_ungated": int(df.get(f"{rank_col}_ungated", df.get(rank_col, pd.Series())).notna().sum()),
                "n_ranked_gated": int(df[rank_col].notna().sum()) if rank_col in df.columns else 0,
                "version": VERSION,
                "date_added": TODAY,
            }
        )

    _summary("cluster_typology", "bacterial", bact_typ, "typology_rank")
    _summary("cluster_typology", "fungal", fung_typ, "typology_rank")
    _summary("country_risk_ranking", "bacterial", bact_risk, "risk_rank")
    _summary("country_risk_ranking", "fungal", fung_risk, "risk_rank")
    rows.append(
        {
            "deliverable": "intervention_recommendations",
            "pathogen_type": "both",
            "n_rows": len(interventions),
            "n_pass": int((interventions["quality_gate"] == "pass").sum()),
            "n_bounds_only": int((interventions["quality_gate"] == "bounds_only").sum()),
            "n_withhold": int((interventions["quality_gate"] == "withhold").sum()),
            "n_ranked_ungated": int(interventions["priority_rank_ungated"].notna().sum()),
            "n_ranked_gated": int(interventions["priority_rank"].notna().sum()),
            "version": VERSION,
            "date_added": TODAY,
        }
    )
    return pd.DataFrame(rows)


def main() -> None:
    failed = False
    required = [
        DELIVERABLES / "cluster_typology_bacterial_v1.csv",
        DELIVERABLES / "cluster_typology_fungal_v1.csv",
        DELIVERABLES / "country_risk_ranking_bacterial_v1.csv",
        DELIVERABLES / "country_risk_ranking_fungal_v1.csv",
        DELIVERABLES / "intervention_recommendations_ranked_v1.csv",
        MASTER / "master_table_v1.csv",
    ]
    missing = [p for p in required if not p.exists()]
    if missing:
        for p in missing:
            print(f"FAIL: missing prerequisite {p.relative_to(ROOT)}")
        sys.exit(1)

    master = pd.read_csv(
        MASTER / "master_table_v1.csv",
        usecols=["pathogen_type", "canonical_organism", "canonical_drug", "classification_basis"],
        low_memory=False,
    )
    org_drug_gates = build_organism_drug_gate_table(master)
    org_drug_gates.to_csv(DELIVERABLES / "organism_drug_quality_gate_v1.csv", index=False)

    bact_typ_ungated = pd.read_csv(DELIVERABLES / "cluster_typology_bacterial_v1.csv")
    fung_typ_ungated = pd.read_csv(DELIVERABLES / "cluster_typology_fungal_v1.csv")
    bact_country_gates = aggregate_country_gate(bact_typ_ungated, org_drug_gates)
    fung_country_gates = aggregate_country_gate(fung_typ_ungated, org_drug_gates)

    bact_typ = gate_cluster_typology("bacterial", org_drug_gates)
    fung_typ = gate_cluster_typology("fungal", org_drug_gates)
    bact_risk = gate_country_risk_ranking("bacterial", bact_country_gates)
    fung_risk = gate_country_risk_ranking("fungal", fung_country_gates)

    interventions_ungated = pd.read_csv(DELIVERABLES / "intervention_recommendations_ranked_v1.csv")
    interventions = gate_intervention_recommendations(interventions_ungated)
    interventions["version"] = VERSION
    interventions["date_added"] = TODAY

    bact_typ.to_csv(DELIVERABLES / "cluster_typology_bacterial_gated_v1.csv", index=False)
    fung_typ.to_csv(DELIVERABLES / "cluster_typology_fungal_gated_v1.csv", index=False)
    bact_risk.to_csv(DELIVERABLES / "country_risk_ranking_bacterial_gated_v1.csv", index=False)
    fung_risk.to_csv(DELIVERABLES / "country_risk_ranking_fungal_gated_v1.csv", index=False)
    interventions.to_csv(DELIVERABLES / "intervention_recommendations_ranked_gated_v1.csv", index=False)

    comparison = build_gating_comparison(bact_typ, fung_typ, bact_risk, fung_risk, interventions)
    comparison.to_csv(DELIVERABLES / "gating_comparison_v1.csv", index=False)

    print(f"Wrote gated deliverables to {DELIVERABLES}/")
    print(f"  organism_drug_quality_gate: {len(org_drug_gates)} rows")
    print(f"  gating_comparison: {len(comparison)} summary rows")

    gate_checks = [
        ("cluster_typology_bacterial_gated_v1.csv", bact_typ, "typology_rank"),
        ("cluster_typology_fungal_gated_v1.csv", fung_typ, "typology_rank"),
        ("country_risk_ranking_bacterial_gated_v1.csv", bact_risk, "risk_rank"),
        ("country_risk_ranking_fungal_gated_v1.csv", fung_risk, "risk_rank"),
        ("intervention_recommendations_ranked_gated_v1.csv", interventions, "priority_rank"),
    ]
    gate_failures = []
    for file_name, table, rank_col in gate_checks:
        report = validate_gated_deliverable(table, name=file_name, rank_col=rank_col)
        if report["status"] != "PASS":
            gate_failures.append(report)
    if gate_failures:
        for report in gate_failures:
            print(f"FAIL: {report['file']} gate integrity violation: {', '.join(report['flags'])}")
        failed = True
    else:
        print(f"PASS: all {len(gate_checks)} gated tables carry a fully-populated, "
              "valid-vocabulary quality_gate and no rank without a pass gate.")

    withhold_typ = int((bact_typ["quality_gate"] == "withhold").sum() + (fung_typ["quality_gate"] == "withhold").sum())
    bounds_typ = int((bact_typ["quality_gate"] == "bounds_only").sum() + (fung_typ["quality_gate"] == "bounds_only").sum())
    if bounds_typ == 0:
        print("FAIL: expected bounds_only typology rows (fungal breakpoint-absent drugs).")
        failed = True
    else:
        print(f"PASS: {bounds_typ} typology row(s) bounds_only; {withhold_typ} withheld.")

    hib = interventions[
        (interventions["sub_measure"] == "hib3_coverage") & (interventions["pathogen_type"] == "bacterial")
    ]
    if len(hib) and hib.iloc[0]["priority_rank"] is not pd.NA and pd.notna(hib.iloc[0]["priority_rank"]):
        print("FAIL: Hib intervention must not receive gated priority_rank (confounding flagged).")
        failed = True
    else:
        print("PASS: Hib intervention excluded from gated priority_rank.")

    ranked_gated = interventions[interventions["priority_rank"].notna()]
    if len(ranked_gated) > 0:
        print(
            f"FAIL: integrity policy expects zero gated intervention ranks; got {len(ranked_gated)}."
        )
        failed = True
    else:
        print("PASS: no gated intervention priority ranks (measured vaccination withheld).")

    pcv = interventions[
        (interventions["sub_measure"] == "pcvc_coverage") & (interventions["pathogen_type"] == "bacterial")
    ]
    if len(pcv) and pcv.iloc[0]["quality_gate"] != "withhold":
        print("FAIL: PCV must be withheld in gated interventions (confounded magnitude).")
        failed = True
    else:
        print("PASS: PCV withheld in gated intervention recommendations.")

    gap_ranked = interventions[
        (interventions["data_status"] == "data_gap") & interventions["priority_rank"].notna()
    ]
    if len(gap_ranked):
        print("FAIL: data_gap interventions must not have gated priority_rank.")
        failed = True
    else:
        print("PASS: data-gap interventions carry null gated priority_rank.")

    if failed:
        print("\nStep 18b Check: FAIL")
        sys.exit(1)
    print("\nStep 18b Check: PASS")


if __name__ == "__main__":
    main()
