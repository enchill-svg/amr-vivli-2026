"""Central paths for pipeline raw inputs under preprocessing_pipeline/raw_inputs/."""
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
RAW_INPUTS = PIPELINE_ROOT / "raw_inputs"

COHORT_PATHS = {
    "SOAR_201818": RAW_INPUTS / "SOAR 201818" / "gsk_201818_published.csv",
    "SOAR_201910": RAW_INPUTS / "SOAR 201910" / "GSK_SOAR_201910 raw data.xlsx",
    "SOAR_207965": RAW_INPUTS / "SOAR 207965" / "SOAR 207965 Complete data set 04Sep25.xlsx",
    "SENTRY": RAW_INPUTS / "ATLAS_Antifungals" / "vivli_sentry_2010_2024.xlsx",
}

SOAR_201818_PATH = COHORT_PATHS["SOAR_201818"]
SOAR_201910_PATH = COHORT_PATHS["SOAR_201910"]
SOAR_207965_PATH = COHORT_PATHS["SOAR_207965"]
SENTRY_PATH = COHORT_PATHS["SENTRY"]

EUCAST_DIR = RAW_INPUTS / "EUCAST Clinical Breakpoint"
EUCAST_VERSION_PATHS = {
    "8.1": EUCAST_DIR / "v_8.1_Breakpoint_Tables.xlsx",
    "10.0": EUCAST_DIR / "v_10.0_Breakpoint_Tables.xlsx",
}

REQUIRED_RAW_INPUT_PATHS = [
    COHORT_PATHS["SOAR_201818"],
    COHORT_PATHS["SOAR_201910"],
    COHORT_PATHS["SOAR_207965"],
    COHORT_PATHS["SENTRY"],
    EUCAST_VERSION_PATHS["8.1"],
    EUCAST_VERSION_PATHS["10.0"],
]


def validate_raw_inputs():
    """Fail fast before Step 1 if any required raw input file is missing."""
    missing = [p for p in REQUIRED_RAW_INPUT_PATHS if not p.exists()]
    if missing:
        lines = "\n".join(f"  - {p.relative_to(PIPELINE_ROOT)}" for p in missing)
        raise FileNotFoundError(
            f"Missing {len(missing)} required raw input file(s) under {RAW_INPUTS.name}/:\n{lines}"
        )
