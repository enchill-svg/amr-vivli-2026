"""Locked estimand constants — must match docs/EVIDENCE_GATE_ESTIMANDS.md."""

VALIDATION_RANDOM_SEED = 20260709
RESAMPLE_COUNT = 2000
BUDGET_GRID = (50, 100, 150, 200, 250, 300)

BIAS_TOLERANCE_PP = 0.5
COVERAGE_LOW = 0.93
COVERAGE_HIGH = 0.97
RESISTANT_ONLY_MIN_BIAS_PP = 10.0

# EG-07 (EVIDENCE_GATE_ESTIMANDS.md SS1) is a direction check: resistant-only
# ascertainment must inflate the estimate, not hit +10pp exactly. A dataset
# whose resistant-only bias is positive and clearly outside the ±0.5pp noise
# floor (BIAS_TOLERANCE_PP) but short of the +10pp target is only waved
# through — as a disclosed warning, never silently — if it has a specific,
# data-verified mechanism on file here. Anything else short of +10pp is a
# hard failure. See EVIDENCE_GATE_ESTIMANDS.md SS4 for the full derivation.
RESISTANT_ONLY_DOCUMENTED_EXCEPTIONS = {
    "SOAR_Hin": (
        "BLNAR (beta-lactamase-negative, ampicillin-resistant H. influenzae) — "
        "verified against raw SOAR isolate data: beta-lactamase-negative "
        "isolates range ampicillin MIC 0.03-128 mg/L, the same ceiling as "
        "beta-lactamase-positive isolates, so MIC-based resistant-only "
        "selection cannot cleanly enrich for the beta-lactamase genotype the "
        "way meropenem MIC enriches for PLEA_I's carbapenemase genotype."
    ),
}

ATLAS_KP_SPECIES = "Klebsiella pneumoniae"

OXA48_FAMILY_MARKERS = (
    "OXA-48",
    "OXA48",
    "OXA-181",
    "OXA-232",
    "OXA-244",
    "OXA-163",
)

CARBAPENEMASE_GES_ALLELES = ("GES-2", "GES-5", "GES-20", "GES-24", "GES-25")

TIER2_ASSUMPTION_LABEL = "testing monotonicity (Manski & Molinari 2021)"

# Sub-Saharan Africa ISO3 (representative set for descriptive SSA stratum)
SSA_ISO3 = frozenset({
    "AGO", "BEN", "BWA", "BFA", "BDI", "CMR", "CPV", "CAF", "TCD", "COM", "COG", "CIV", "COD",
    "DJI", "GNQ", "ERI", "SWZ", "ETH", "GAB", "GMB", "GHA", "GIN", "GNB", "KEN", "LSO",
    "LBR", "MDG", "MWI", "MLI", "MRT", "MUS", "MOZ", "NAM", "NER", "NGA", "RWA", "STP",
    "SEN", "SYC", "SLE", "SOM", "ZAF", "SSD", "SDN", "TZA", "TGO", "UGA", "ZMB", "ZWE",
})

# Verification tolerances (raw ATLAS)
ATLAS_KP_P_TOLERANCE = 50
ATLAS_KP_TIER1_LOWER_TOLERANCE = 0.003
