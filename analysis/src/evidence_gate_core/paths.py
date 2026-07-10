"""Paths for Layer A Evidence Gate clean store and outputs."""
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[2]
DOCS = PIPELINE_ROOT / "docs"
CLEANED = PIPELINE_ROOT / "cleaned"
BOUNDS = PIPELINE_ROOT / "bounds"
DELIVERABLES = PIPELINE_ROOT / "deliverables"

ATLAS_RAW = DOCS / "AMR_Datasets" / "ATLAS_Antibiotics" / "atlas_vivli_2004_2024.csv"
PLEA_RAW = DOCS / "AMR_Datasets" / "PLEA (Study I)" / "PLEA Study I (n=3150)_updated.xlsx"

ATLAS_KP_CLEAN = CLEANED / "atlas" / "atlas_kp_v1.csv"
PLEA_CLEAN = CLEANED / "plea" / "plea_study_i_v1.csv"
CLEAN_MANIFEST = CLEANED / "manifest_cleaned_v1.csv"

IDENTIFIABILITY_BOUNDS = BOUNDS / "identifiability_bounds_v1.csv"
SAMPLING_VALIDATION = BOUNDS / "sampling_validation_v1.csv"
SAMPLING_VALIDATION_SUMMARY = BOUNDS / "sampling_validation_summary_v1.csv"
ALLOCATOR_RECOMMENDATIONS = BOUNDS / "allocator_recommendations_v1.csv"

GENE_COLUMNS = ["NDM", "KPC", "VIM", "IMP", "OXA", "GES", "SPM", "GIM"]
