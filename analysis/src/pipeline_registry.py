"""Single source of truth for the AMR Life Expectancy one-pipeline stage order."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Literal

StageKind = Literal["script", "module"]


@dataclass(frozen=True)
class PipelineStage:
    stage_id: str
    label: str
    phase_id: str
    kind: StageKind
    target: str
    module_args: tuple[str, ...] = ()


@dataclass(frozen=True)
class PipelinePhase:
    phase_id: str
    label: str
    dashboard_stage: str | None = None


PHASES: tuple[PipelinePhase, ...] = (
    PipelinePhase("preprocessing", "Section 5 — Harmonize SOAR + SENTRY (Steps 1–10)", "03"),
    PipelinePhase("integrity", "Integrity layer — ledger, bounds, validation proof", "04"),
    PipelinePhase("analytics", "Section 6 — Burden, trajectory, LE, interventions (Stages 1–7)", "05"),
    PipelinePhase("deliverables", "Section 7 — Justice expected outputs + gating", "08"),
    PipelinePhase("verification", "Post-run verification", "08"),
)

PREPROCESSING_STAGES: tuple[PipelineStage, ...] = (
    PipelineStage("step01_country", "Country harmonization", "preprocessing", "script", "step01_country.py"),
    PipelineStage("step02_date", "Date harmonization", "preprocessing", "script", "step02_date.py"),
    PipelineStage("step03_organism", "Organism harmonization", "preprocessing", "script", "step03_organism.py"),
    PipelineStage("step04_drug", "Drug harmonization", "preprocessing", "script", "step04_drug.py"),
    PipelineStage("step06_evaluability", "Evaluability flags", "preprocessing", "script", "step06_evaluability.py"),
    PipelineStage("step09_age", "Age harmonization", "preprocessing", "script", "step09_age.py"),
    PipelineStage("step05_mic", "MIC parsing", "preprocessing", "script", "step05_mic.py"),
    PipelineStage("step08_beta_lactamase_bounds", "Beta-lactamase bounds", "preprocessing", "script", "step08_beta_lactamase_bounds.py"),
    PipelineStage("eucast_breakpoints", "EUCAST breakpoint tables", "preprocessing", "script", "eucast_breakpoints.py"),
    PipelineStage("step07_classification", "Resistance classification", "preprocessing", "script", "step07_classification.py"),
    PipelineStage("step10_master", "Master table assembly", "preprocessing", "script", "step10_master.py"),
    PipelineStage("step06_evaluability_rates", "Evaluability rates", "preprocessing", "script", "step06_evaluability_rates.py"),
    PipelineStage("pipeline_acceptance_check", "Master table acceptance check", "preprocessing", "script", "pipeline_acceptance_check.py"),
)

POST_PREPROCESSING_STAGES: tuple[PipelineStage, ...] = (
    PipelineStage("step19a_clean_evidence_gate", "Clean ATLAS + PLEA cohorts", "integrity", "script", "step19a_clean_evidence_gate_cohorts.py"),
    PipelineStage("step19_evidence_gate_bounds", "ATLAS bounds + identifiability table", "integrity", "script", "step19_evidence_gate_bounds.py"),
    PipelineStage("step20_sampling_validation", "PLEA/SOAR sampling validation", "integrity", "script", "step20_sampling_validation.py"),
    PipelineStage("evidence_gate_allocator", "Budget allocator", "integrity", "module", "evidence_gate_core.allocator", ("--budget", "200")),
    PipelineStage("evidence_gate_export_validator", "Export validator", "integrity", "module", "evidence_gate_core.export_validator"),
    PipelineStage("step11_descriptive", "Stage 1 — descriptive profiling", "analytics", "script", "step11_descriptive.py"),
    PipelineStage("step12_evolutionary", "Stage 2 — evolutionary layer", "analytics", "script", "step12_evolutionary.py"),
    PipelineStage("step13_clustering", "Stage 3 — clustering", "analytics", "script", "step13_clustering.py"),
    PipelineStage("step14_external_join", "Stage 4 — external data join", "analytics", "script", "step14_external_join.py"),
    PipelineStage("step15_association", "Stage 5 — life expectancy association", "analytics", "script", "step15_association.py"),
    PipelineStage("step16_rd_alignment", "Stage 6 — R&D alignment", "analytics", "script", "step16_rd_alignment.py"),
    PipelineStage("step17_intervention", "Stage 7 — intervention impact", "analytics", "script", "step17_intervention.py"),
    PipelineStage("step18_section7_deliverables", "Section 7 deliverables (ungated)", "deliverables", "script", "step18_section7_deliverables.py"),
    PipelineStage("step18b_gated_deliverables", "Section 7 deliverables (gated)", "deliverables", "script", "step18b_gated_deliverables.py"),
    PipelineStage("step18c_gated_country_year_panel", "Section 7 deliverable — gated country-year LE panel", "deliverables", "script", "step18c_gated_country_year_panel.py"),
    PipelineStage("verify_all_figures", "Figure and output verification", "verification", "script", "scripts/verify_all_figures.py"),
    PipelineStage("publish_dashboard_data", "Publish to data/published/", "verification", "script", "scripts/publish_dashboard_data.py"),
)

FULL_PIPELINE_STAGES: tuple[PipelineStage, ...] = PREPROCESSING_STAGES + POST_PREPROCESSING_STAGES

JUSTICE_DELIVERABLE_FILES: tuple[tuple[int, str], ...] = (
    (1, "deliverables/dataset_manifest_v1.csv"),
    (2, "deliverables/identifiability_ledger_v1.csv"),
    (3, "deliverables/cluster_typology_bacterial_v1.csv"),
    (3, "deliverables/cluster_typology_fungal_v1.csv"),
    (4, "deliverables/country_risk_ranking_bacterial_v1.csv"),
    (4, "deliverables/country_risk_ranking_fungal_v1.csv"),
    (5, "deliverables/funding_gap_summary_v1.csv"),
    (6, "deliverables/intervention_recommendations_ranked_v1.csv"),
)

GATED_DELIVERABLE_FILES: tuple[str, ...] = (
    "deliverables/cluster_typology_bacterial_gated_v1.csv",
    "deliverables/cluster_typology_fungal_gated_v1.csv",
    "deliverables/country_risk_ranking_bacterial_gated_v1.csv",
    "deliverables/country_risk_ranking_fungal_gated_v1.csv",
    "deliverables/intervention_recommendations_ranked_gated_v1.csv",
    "deliverables/gating_comparison_v1.csv",
    "deliverables/organism_drug_quality_gate_v1.csv",
    "deliverables/country_year_panel_bacterial_gated_v1.csv",
    "deliverables/country_year_panel_fungal_gated_v1.csv",
)

PHASE_BY_ID = {phase.phase_id: phase for phase in PHASES}
