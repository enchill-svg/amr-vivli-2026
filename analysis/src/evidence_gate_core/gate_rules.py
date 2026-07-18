"""Quality-gate rules for Justice policy deliverables (integrity layer)."""
from __future__ import annotations

from typing import Literal

import pandas as pd

QualityGate = Literal["pass", "bounds_only", "withhold"]

INTERPRETABLE_BASES = frozenset(
    {
        "EUCAST_v8.1_breakpoint",
        "EUCAST_v10.0_breakpoint",
        "CLSI_breakpoint",
        "ECV_WT_NWT",
    }
)

JUSTICE_BREAKPOINT_ABSENT_FUNGAL_DRUGS = frozenset(
    {
        "itraconazole",
        "posaconazole",
        "flucytosine",
        "amphotericin b",
    }
)

NON_INTERPRETABLE_SUBSTRINGS = (
    "unclassifiable",
    "no_eucast",
    "censored",
    "indeterminate",
)

CONFOUNDING_INTERVENTION_FLAGS = frozenset(
    {
        "implausible_magnitude_likely_confounding",
    }
)

NON_SIGNIFICANT_P_THRESHOLD = 0.10
EVIDENCE_THIN_HIB_SUBMEASURE = "hib3_coverage"

GATE_METHODOLOGY = (
    "Integrity layer quality_gate derived from identifiability ledger rules "
    "(AMR_2026_COMBINED_EXECUTION_PLAN §5): interpretable classification → pass; "
    "breakpoint-absent / majority unclassifiable → bounds_only or withhold; "
    "confounded intervention LE estimates → withhold rank."
)


def basis_is_interpretable(basis: str) -> bool:
    return str(basis) in INTERPRETABLE_BASES


def gate_organism_drug_row(
    pathogen_type: str,
    canonical_drug: str,
    basis_counts: dict[str, int],
) -> tuple[QualityGate, str]:
    """Assign quality_gate for one organism–drug combination from master basis counts."""
    drug = str(canonical_drug).strip().lower()
    if pathogen_type == "fungal" and drug in JUSTICE_BREAKPOINT_ABSENT_FUNGAL_DRUGS:
        return "bounds_only", "breakpoint_absent_drug_justice_section_4_4"

    total = int(sum(basis_counts.values()))
    if total == 0:
        return "withhold", "no_master_rows"

    unclassifiable = int(basis_counts.get("unclassifiable_no_standard", 0))
    if unclassifiable / total > 0.5:
        return "withhold", "majority_unclassifiable_no_standard"

    non_interp = sum(
        int(v)
        for k, v in basis_counts.items()
        if not basis_is_interpretable(k)
    )
    if non_interp / total > 0.5:
        return "bounds_only", "majority_non_interpretable_basis"

    interpretable = sum(
        int(v) for k, v in basis_counts.items() if basis_is_interpretable(k)
    )
    if interpretable / total >= 0.8:
        return "pass", "interpretable_classification_majority"

    return "bounds_only", "mixed_classification_basis"


def build_organism_drug_gate_table(master: pd.DataFrame) -> pd.DataFrame:
    """One row per pathogen_type × organism × drug with quality_gate."""
    usecols = ["pathogen_type", "canonical_organism", "canonical_drug", "classification_basis"]
    work = master[usecols].copy()
    rows: list[dict] = []
    group_cols = ["pathogen_type", "canonical_organism", "canonical_drug"]
    for keys, sub in work.groupby(group_cols, dropna=False):
        pathogen_type, organism, drug = keys
        counts = sub["classification_basis"].value_counts().to_dict()
        gate, reason = gate_organism_drug_row(str(pathogen_type), str(drug), counts)
        rows.append(
            {
                "pathogen_type": pathogen_type,
                "canonical_organism": organism,
                "canonical_drug": drug,
                "quality_gate": gate,
                "gate_reason": reason,
                "n_master_rows": int(len(sub)),
                "n_interpretable_rows": int(
                    sub["classification_basis"].apply(basis_is_interpretable).sum()
                ),
            }
        )
    return pd.DataFrame(rows)


def aggregate_country_gate(
    typology: pd.DataFrame,
    org_drug_gates: pd.DataFrame,
) -> pd.DataFrame:
    """Country-level gate from weighted organism–drug typology rows."""
    merged = typology.merge(
        org_drug_gates,
        on=["pathogen_type", "canonical_organism", "canonical_drug"],
        how="left",
    )
    merged["quality_gate"] = merged["quality_gate"].fillna("withhold")
    merged["n_tested_total"] = pd.to_numeric(merged["n_tested_total"], errors="coerce").fillna(1)

    rows: list[dict] = []
    for iso3, sub in merged.groupby("iso3_country", dropna=False):
        weights = sub["n_tested_total"].clip(lower=1)
        total_w = float(weights.sum())
        if total_w <= 0:
            rows.append(
                {
                    "iso3_country": iso3,
                    "quality_gate": "withhold",
                    "gate_reason": "no_weighted_typology_rows",
                }
            )
            continue

        def weighted_share(gate: str) -> float:
            return float(weights[sub["quality_gate"] == gate].sum() / total_w)

        withhold_share = weighted_share("withhold")
        bounds_share = weighted_share("bounds_only")
        if withhold_share > 0.4:
            gate, reason = "withhold", f"withhold_weight_share={withhold_share:.2f}"
        elif bounds_share > 0.5:
            gate, reason = "bounds_only", f"bounds_only_weight_share={bounds_share:.2f}"
        elif bounds_share > 0.0:
            gate, reason = "bounds_only", f"partial_bounds_only_share={bounds_share:.2f}"
        else:
            gate, reason = "pass", "interpretable_burden_majority"
        rows.append({"iso3_country": iso3, "quality_gate": gate, "gate_reason": reason})

    return pd.DataFrame(rows)


def gate_intervention_recommendations(df: pd.DataFrame) -> pd.DataFrame:
    """Apply integrity rules to intervention ranking."""
    out = df.copy()
    out["quality_gate"] = "pass"
    out["gate_reason"] = "measured_association"

    mask_gap = out["data_status"].isin(
        [
            "data_gap",
            "not_estimable",
            "not_applicable",
            "funding_only_no_le_elasticity",
            "excluded_by_design",
        ]
    )
    out.loc[mask_gap, "quality_gate"] = "withhold"
    out.loc[mask_gap, "gate_reason"] = out.loc[mask_gap, "data_status"].astype(str)

    confounded = out["scenario_magnitude_flag"].isin(CONFOUNDING_INTERVENTION_FLAGS)
    out.loc[confounded, "quality_gate"] = "withhold"
    out.loc[confounded, "gate_reason"] = "implausible_magnitude_likely_confounding"

    p_vals = pd.to_numeric(out.get("coefficient_p_value"), errors="coerce")
    measured_with_p = (out["data_status"] == "measured") & p_vals.notna()
    # Bonferroni family-wise correction: this threshold is a shared decision
    # rule applied simultaneously to every "measured" coefficient competing
    # for a priority_rank (currently hib3_coverage_pct and pcvc_coverage_pct,
    # both from the same Stage 5 OLS - see step17_intervention.py). The
    # family is these co-screened candidate-intervention p-values, not every
    # covariate the regression estimates (health_expenditure_pct_gdp etc. are
    # controls, never individually gated/ranked here). Computed from the live
    # row count so the correction self-adjusts if a future data update adds a
    # third measured intervention term.
    n_family = max(int(measured_with_p.sum()), 1)
    bonferroni_p_threshold = NON_SIGNIFICANT_P_THRESHOLD / n_family
    nonsig = measured_with_p & (p_vals > bonferroni_p_threshold)
    out.loc[nonsig, "quality_gate"] = "withhold"
    out.loc[nonsig, "gate_reason"] = (
        f"non_significant_association_bonferroni_p_gt_{bonferroni_p_threshold:.4f}_m{n_family}"
    )

    # A clean p-value / small magnitude can still come from an overfit
    # regression (Stage 5 primary spec: n=16 against 10 parameters,
    # R^2>0.99 — see step15_association.py's fit_ols()). A future data
    # update could make such a coefficient significant without the
    # sample-size problem going away, so this must gate on the warning
    # itself, not rely on non-significance catching it incidentally.
    sample_warned = (
        (out["data_status"] == "measured")
        & out["model_sample_warning"].astype(str).str.len().gt(0)
    )
    out.loc[sample_warned, "quality_gate"] = "withhold"
    out.loc[sample_warned, "gate_reason"] = (
        "model_sample_warning:" + out.loc[sample_warned, "model_sample_warning"].astype(str)
    )

    hib_thin = (out["sub_measure"] == EVIDENCE_THIN_HIB_SUBMEASURE) & (
        out["data_status"] == "measured"
    )
    out.loc[hib_thin, "quality_gate"] = "withhold"
    out.loc[hib_thin, "gate_reason"] = "evidence_thin_hib_literature"

    out["priority_rank_ungated"] = out.get("priority_rank", pd.Series(dtype=float))
    out["priority_rank"] = pd.NA
    rankable = out[
        (out["data_status"] == "measured")
        & out["estimated_le_gain_years"].notna()
        & (out["quality_gate"] == "pass")
    ].sort_values("estimated_le_gain_years", ascending=False)
    rank_map = {
        (r.pathogen_type, r.intervention_category, str(r.sub_measure)): i + 1
        for i, (_, r) in enumerate(rankable.iterrows())
    }
    for idx, row in out.iterrows():
        key = (row["pathogen_type"], row["intervention_category"], str(row["sub_measure"]))
        if key in rank_map:
            out.at[idx, "priority_rank"] = rank_map[key]

    out["methodology"] = (
        str(out["methodology"].iloc[0])
        if len(out) and "methodology" in out.columns
        else ""
    ) + " Gated: confounded or data-gap categories excluded from priority_rank."
    return out
