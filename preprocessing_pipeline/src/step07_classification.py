"""
Step 7 - Resistance and susceptibility classification.

Issue (Justice's Section 5): bacterial isolates need EUCAST/CLSI breakpoints
applied per organism-drug pair. Fungal isolates have a structurally different
problem: Justice's text names four antifungals (itraconazole, posaconazole,
flucytosine, amphotericin B) as having no usable CLSI category in this
dataset. Direct inspection of the live data confirms this for three of the
four - itraconazole, posaconazole, and flucytosine are 100% null in their
"(CLSI)_I" columns - but not for amphotericin B, which carries 122 real
Susceptible/Resistant CLSI calls (67 Susceptible, 55 Resistant) alongside
26,800 nulls. BREAKPOINT_ABSENT_DRUGS below reflects the live data, not
Justice's text: it omits amphotericin B, which is classified via Tier 1
(CLSI) wherever a real call exists, falling through to Tier 2/3 only for its
null rows like any other drug.

Action: for bacteria, apply breakpoints per organism-drug pair, per cohort.
For fungi, classify using the CLSI category where one exists; for the three
breakpoint-absent drugs, fall back to species-specific ECVs where published,
and report an identified range rather than a point estimate where even ECVs
are unavailable.

Check: every classified isolate carries a record of which standard - CLSI
breakpoint, ECV, or unclassifiable - produced its category.

BACTERIAL HALF - NOT IMPLEMENTED, BY DESIGN, NOT OVERSIGHT. Applying
EUCAST/CLSI breakpoints requires an organism-drug -> S/I/R threshold table.
No such table exists anywhere in this plan's docs/ (unlike the fungal ECV
table, which Appendix 4 SB.3 supplies as real, cited, targeted-search data).
Fabricating breakpoint thresholds from memory would be exactly the kind of
invented reference data this pipeline has consistently refused to produce
elsewhere (DIN left unresolved in Step 4, no per-drug tested-range dictionary
assumed in Step 5). This step therefore performs no bacterial S/I/R
classification and instead logs every bacterial isolate-drug pair as
`unclassified_no_breakpoint_table` - an honest non-result, not a guess.

FUNGAL HALF - implemented per Appendix 4 SB.2's three-tier hierarchy using
SB.3's starter ECV table (Pfaller et al. 2012; companion posaconazole/
voriconazole papers; Espinel-Ingroff et al. for A. fumigatus):
  Tier 1 - CLSI clinical breakpoint category, where the "(CLSI)_I" column is
           non-null. Used directly.
  Tier 2 - ECV-based WT/NWT call, where no CLSI category exists but a
           published species-specific ECV is available: MIC <= ECV -> WT,
           MIC > ECV -> NWT. WT/NWT is NOT susceptible/resistant - it is a
           population-membership statement, not a clinical-outcome prediction.
  Tier 3 - unclassifiable. No CLSI category and no ECV. Report the measured
           MIC value itself (SENTRY's MIC columns are confirmed pre-resolved
           floats with no censoring notation - Step 5's reconnaissance) with
           an explicit unclassifiable tag - never a guessed category.
"""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parents[0] / "AMR_Datasets"
SENTRY_PATH = DATA_ROOT / "ATLAS_Antifungals" / "vivli_sentry_2010_2024.xlsx"
CLASSIFICATION_PATH = ROOT / "bounds" / "antifungal_ecv_classification_v1.csv"
BACTERIAL_GAP_LOG_PATH = ROOT / "exceptions" / "bacterial_breakpoint_unavailable_log_v1.csv"

# Appendix 4 SB.3 starter ECV table - species x drug -> ECV (unit as published;
# all values below are µg/mL or mg/L, numerically interchangeable per CLSI
# convention, per Appendix 4 SB.3's own note).
ECV_TABLE = {
    ("Candida albicans", "Amphotericin B"): 2,
    ("Candida albicans", "Flucytosine"): 0.5,
    ("Candida albicans", "Itraconazole"): 0.12,
    ("Candida albicans", "Posaconazole"): 0.06,
    ("Candida glabrata", "Posaconazole"): 1,
    ("Candida parapsilosis", "Posaconazole"): 0.5,
    ("Aspergillus fumigatus", "Itraconazole"): 1,
    ("Aspergillus fumigatus", "Posaconazole"): 0.5,
    ("Aspergillus fumigatus", "Voriconazole"): 1,
    ("Aspergillus fumigatus", "Isavuconazole"): 1,
}

# The four drugs Justice's issue text names as breakpoint-absent, plus the
# other six SENTRY antifungals covered by this file's CLSI columns.
FUNGAL_DRUGS = [
    "Anidulafungin", "Caspofungin", "Micafungin", "Isavuconazole",
    "Fluconazole", "Itraconazole", "Voriconazole", "Posaconazole",
    "Amphotericin B", "Flucytosine",
]

BASIS_CLSI = "CLSI_breakpoint"
BASIS_ECV = "ECV_WT_NWT"
BASIS_UNCLASSIFIABLE = "unclassifiable_no_standard"
VALID_BASES = {BASIS_CLSI, BASIS_ECV, BASIS_UNCLASSIFIABLE}

BREAKPOINT_ABSENT_DRUGS = {"Itraconazole", "Posaconazole", "Flucytosine"}

# SOAR bacterial cohorts - listed only so the gap can be logged explicitly per
# cohort, not to attempt any actual classification.
SOAR_COHORTS = {
    "SOAR_201818": {
        "path": DATA_ROOT / "SOAR 201818" / "gsk_201818_published.csv",
        "reader": "csv",
        "metadata_columns": {
            "IHMANUMBER", "AGE", "DEID_CAT_AGE", "REGION", "COUNTRY", "ORGANISMNAME",
            "BETALACTAMASE", "GENDER", "YEARCOLLECTED", "BODYLOCATION", "INVESTIGATORNAME",
        },
    },
    "SOAR_201910": {
        "path": DATA_ROOT / "SOAR 201910" / "GSK_SOAR_201910 raw data.xlsx",
        "reader": "excel",
        "metadata_columns": {
            "Isolate Number", "Organism", "BodyLocation", "Country", "Centre", "Gender",
            "Age", "Collection Date", "Betalactamase",
        },
    },
    "SOAR_207965": {
        "path": DATA_ROOT / "SOAR 207965" / "SOAR 207965 Complete data set 04Sep25.xlsx",
        "reader": "excel",
        "metadata_columns": {
            "Region", "Country", "Investigator", "InvestigatorName", "IHMA #",
            "OriginalOrganismName", "FinalOrganismName", "OrganismFamilyName", "GramType",
            "Age", "Gender", "YearCollected", "BodyLocation", "FacilityName", "Evaluable",
            "Beta Lactamase",
        },
    },
}


def classify_one(species, mic_value, clsi_category, drug):
    """Return (basis, category) for one isolate-drug pair, per Appendix 4 SB.2."""
    if pd.notna(clsi_category):
        return BASIS_CLSI, clsi_category

    ecv = ECV_TABLE.get((species, drug))
    if pd.notna(mic_value) and ecv is not None:
        call = "WT" if mic_value <= ecv else "NWT"
        return BASIS_ECV, call

    if pd.notna(mic_value):
        return BASIS_UNCLASSIFIABLE, f"MIC={mic_value}"

    return None, None  # no measurement at all - not part of the denominator.


def main():
    failed = False

    # --- Bacterial half: explicitly log the gap, classify nothing. ---
    gap_rows = []
    for cohort_name, spec in SOAR_COHORTS.items():
        if spec["reader"] == "csv":
            df = pd.read_csv(spec["path"], low_memory=False, nrows=2)
        else:
            df = pd.read_excel(spec["path"], nrows=2)
        drug_columns = [c for c in df.columns if c not in spec["metadata_columns"]]
        gap_rows.append({
            "cohort": cohort_name,
            "drug_columns_affected": len(drug_columns),
            "reason": "no EUCAST/CLSI organism-drug breakpoint table available in this plan's docs/ - "
                      "classification not attempted rather than fabricated",
            "basis": "unclassified_no_breakpoint_table",
            "version": "v1",
            "date_added": "2026-07-06",
        })
    BACTERIAL_GAP_LOG_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(gap_rows, columns=[
        "cohort", "drug_columns_affected", "reason", "basis", "version", "date_added",
    ]).to_csv(BACTERIAL_GAP_LOG_PATH, index=False)
    print(f"Bacterial half: no breakpoint table available - logged as an explicit gap for all "
          f"{sum(r['drug_columns_affected'] for r in gap_rows)} drug columns across "
          f"{len(gap_rows)} SOAR cohorts, to {BACTERIAL_GAP_LOG_PATH.relative_to(ROOT.parents[0])}. "
          f"No bacterial isolate-drug pair is reported as classified.")

    # --- Fungal half: full three-tier classification against live SENTRY data. ---
    df = pd.read_excel(SENTRY_PATH)
    per_row_records = []
    for drug in FUNGAL_DRUGS:
        mic_col = f"{drug} (CLSI)"
        clsi_col = f"{drug} (CLSI)_I"
        for species, mic_value, clsi_category in zip(df["Species"], df[mic_col], df[clsi_col]):
            basis, category = classify_one(species, mic_value, clsi_category, drug)
            if basis is not None:
                per_row_records.append({"species": species, "drug": drug, "basis": basis, "category": category})

    per_row_df = pd.DataFrame(per_row_records)
    print(f"\nFungal half: {len(per_row_df)} classified isolate-drug pairs across {len(FUNGAL_DRUGS)} drugs "
          f"and {df['Species'].nunique()} species.")

    # Check (b): every classified fungal pair carries exactly one of the 3 valid basis values.
    bad_basis = per_row_df[~per_row_df["basis"].isin(VALID_BASES)]
    if len(bad_basis):
        print(f"FAIL: {len(bad_basis)} fungal classification(s) carry an invalid basis value.")
        failed = True
    else:
        print(f"PASS: all {len(per_row_df)} classified fungal isolate-drug pairs carry exactly one of the "
              f"3 valid basis values ({sorted(VALID_BASES)}).")

    # Check (c): zero itraconazole/posaconazole/flucytosine rows carry CLSI_breakpoint basis.
    fabricated = per_row_df[(per_row_df["drug"].isin(BREAKPOINT_ABSENT_DRUGS)) & (per_row_df["basis"] == BASIS_CLSI)]
    if len(fabricated):
        print(f"FAIL: {len(fabricated)} row(s) for {BREAKPOINT_ABSENT_DRUGS} carry a CLSI_breakpoint basis, "
              f"but the CLSI category column is documented as 100% null for these drugs.")
        failed = True
    else:
        print(f"PASS: zero rows for {sorted(BREAKPOINT_ABSENT_DRUGS)} carry a CLSI_breakpoint basis - "
              f"confirms the pipeline did not fabricate a category where none exists in the source data.")

    # Aggregate to a per-(species, drug) summary for the persisted deliverable -
    # bounds/antifungal_ecv_classification.csv, as anticipated in this pipeline's
    # own repo layout (Part 4).
    summary_rows = []
    for (species, drug), group in per_row_df.groupby(["species", "drug"]):
        basis_counts = group["basis"].value_counts().to_dict()
        wt = (group["category"] == "WT").sum()
        nwt = (group["category"] == "NWT").sum()
        summary_rows.append({
            "species": species,
            "drug": drug,
            "n_classified": len(group),
            "n_clsi_breakpoint": basis_counts.get(BASIS_CLSI, 0),
            "n_ecv_wt": wt,
            "n_ecv_nwt": nwt,
            "n_unclassifiable": basis_counts.get(BASIS_UNCLASSIFIABLE, 0),
            "ecv_used": ECV_TABLE.get((species, drug), ""),
            "version": "v1",
            "date_added": "2026-07-06",
        })

    CLASSIFICATION_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(summary_rows, columns=[
        "species", "drug", "n_classified", "n_clsi_breakpoint", "n_ecv_wt", "n_ecv_nwt",
        "n_unclassifiable", "ecv_used", "version", "date_added",
    ]).sort_values(["drug", "species"]).to_csv(CLASSIFICATION_PATH, index=False)
    print(f"\nWrote {len(summary_rows)} species x drug summary row(s) to "
          f"{CLASSIFICATION_PATH.relative_to(ROOT.parents[0])}")

    print("\nNOTE (open risk, not resolved here): the ECV table above is a starter reference from a small "
          "number of targeted searches (Appendix 4 SB.5), not a systematic literature review - notably "
          "Candida tropicalis (2,139 SENTRY rows, a top-5 species) has zero ECV coverage in this table, "
          "so all its isolate-drug pairs for the 4 breakpoint-absent-adjacent drugs fall to Tier 3 "
          "(unclassifiable) rather than Tier 2, which is a real coverage gap, not a bug.")
    print("NOTE: whether a Tier-2 NWT call should ever be pooled into a headline resistance rate alongside "
          "Tier-1 S/I/R categories is an explicit open design decision this step does not resolve (Appendix "
          "4 SB.2) - the summary table above keeps WT/NWT counts in separate columns from any S/I/R count "
          "specifically so they are never silently combined downstream.")

    if failed:
        print("\nStep 7 Check: FAIL")
        sys.exit(1)

    print("\nStep 7 Check: PASS")


if __name__ == "__main__":
    main()
