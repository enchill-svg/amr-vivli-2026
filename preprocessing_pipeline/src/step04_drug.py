"""
Step 4 - Antibiotic and antifungal code crosswalk.

Issue (Justice's Section 5): SOAR 201910 uses 17 abbreviated drug codes where
201818 and 207965 use full names. Fifteen resolve cleanly against the shared
drug panel. CDN most likely maps to cefdinir but should be confirmed against
the original data dictionary rather than assumed. DIN has no clear counterpart
and is currently unresolved.

Action: build and version a drug-code crosswalk table. Mark CDN as provisional
and DIN as unresolved pending the original data dictionary. Exclude DIN from
any cross-cohort drug-level comparison until resolved.

Check: every code in 201910 maps to a name or is explicitly flagged
unresolved; no analysis step silently treats an unresolved code as a real
measurement.
"""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parents[0] / "AMR_Datasets"
CROSSWALK_PATH = ROOT / "crosswalks" / "drug_code_crosswalk_v1.csv"

# Non-drug (metadata) columns per cohort, established by direct inspection of
# each raw file - everything else in each file's column list is a drug column
# that must have a crosswalk row.
METADATA_COLUMNS = {
    "SOAR_201818": {
        "IHMANUMBER", "AGE", "DEID_CAT_AGE", "REGION", "COUNTRY", "ORGANISMNAME",
        "BETALACTAMASE", "GENDER", "YEARCOLLECTED", "BODYLOCATION", "INVESTIGATORNAME",
    },
    "SOAR_201910": {
        "Isolate Number", "Organism", "BodyLocation", "Country", "Centre", "Gender",
        "Age", "Collection Date", "Betalactamase",
    },
    "SOAR_207965": {
        "Region", "Country", "Investigator", "InvestigatorName", "IHMA #",
        "OriginalOrganismName", "FinalOrganismName", "OrganismFamilyName", "GramType",
        "Age", "Gender", "YearCollected", "BodyLocation", "FacilityName", "Evaluable",
        "Beta Lactamase",
    },
    "SENTRY": {
        "uid", "Study", "Species", "Country", "State", "Gender", "Age Group",
        "Speciality", "Source", "Year",
    },
}

COHORTS = {
    "SOAR_201818": {
        "path": DATA_ROOT / "SOAR 201818" / "gsk_201818_published.csv",
        "reader": "csv",
    },
    "SOAR_201910": {
        "path": DATA_ROOT / "SOAR 201910" / "GSK_SOAR_201910 raw data.xlsx",
        "reader": "excel",
    },
    "SOAR_207965": {
        "path": DATA_ROOT / "SOAR 207965" / "SOAR 207965 Complete data set 04Sep25.xlsx",
        "reader": "excel",
    },
    "SENTRY": {
        "path": DATA_ROOT / "ATLAS_Antifungals" / "vivli_sentry_2010_2024.xlsx",
        "reader": "excel",
    },
}


def load_columns(spec):
    if spec["reader"] == "csv":
        df = pd.read_csv(spec["path"], low_memory=False, nrows=2)
    else:
        df = pd.read_excel(spec["path"], nrows=2)
    return list(df.columns)


def main():
    failed = False
    crosswalk = pd.read_csv(CROSSWALK_PATH, keep_default_na=False)

    for cohort_id, spec in COHORTS.items():
        raw_columns = set(load_columns(spec))
        drug_columns = raw_columns - METADATA_COLUMNS[cohort_id]
        crosswalk_identifiers = set(crosswalk.loc[crosswalk["cohort_id"] == cohort_id, "raw_identifier"])

        missing_from_crosswalk = drug_columns - crosswalk_identifiers
        extra_in_crosswalk = crosswalk_identifiers - drug_columns

        print(f"{cohort_id}: {len(raw_columns)} total columns, {len(drug_columns)} drug columns, {len(crosswalk_identifiers)} crosswalk rows")

        if missing_from_crosswalk:
            print(f"FAIL: {cohort_id} has drug column(s) with no crosswalk row: {sorted(missing_from_crosswalk)}")
            failed = True
        if extra_in_crosswalk:
            print(f"FAIL: {cohort_id} crosswalk has row(s) not matching any real drug column: {sorted(extra_in_crosswalk)}")
            failed = True
        if not missing_from_crosswalk and not extra_in_crosswalk:
            print(f"PASS: {cohort_id} - every drug column has exactly one crosswalk row, no extras.")

    # Check (a): all 17 SOAR_201910 codes appear with a valid resolution_status.
    soar_201910 = crosswalk[crosswalk["cohort_id"] == "SOAR_201910"]
    valid_statuses = {"resolved", "provisional", "unresolved"}
    bad_status = soar_201910[~soar_201910["resolution_status"].isin(valid_statuses)]
    if len(soar_201910) != 17 or len(bad_status):
        print(f"FAIL: SOAR_201910 crosswalk rows = {len(soar_201910)} (expected 17); {len(bad_status)} with an invalid resolution_status.")
        failed = True
    else:
        print(f"PASS: all 17 SOAR_201910 codes carry a valid resolution_status ({soar_201910['resolution_status'].value_counts().to_dict()}).")

    # Check (b): DIN carries exclude_from_cross_cohort_comparison = TRUE and is absent
    # from both the shared-drug and cohort-exclusive canonical_drug sets.
    din_row = crosswalk[(crosswalk["cohort_id"] == "SOAR_201910") & (crosswalk["raw_identifier"] == "DIN")]
    if din_row.empty:
        print("FAIL: DIN row not found in crosswalk.")
        failed = True
    else:
        din = din_row.iloc[0]
        resolved_canonical_drugs = set(crosswalk.loc[crosswalk["resolution_status"] == "resolved", "canonical_drug"]) | \
            set(crosswalk.loc[crosswalk["resolution_status"] == "provisional", "canonical_drug"])
        if din["exclude_from_cross_cohort_comparison"] != True and str(din["exclude_from_cross_cohort_comparison"]).upper() != "TRUE":
            print("FAIL: DIN does not carry exclude_from_cross_cohort_comparison = TRUE.")
            failed = True
        elif din["canonical_drug"] in resolved_canonical_drugs:
            print(f"FAIL: DIN's canonical_drug ({din['canonical_drug']}) collides with a resolved/provisional canonical drug.")
            failed = True
        elif din["canonical_drug"] != "UNRESOLVED":
            print(f"FAIL: DIN's canonical_drug is {din['canonical_drug']!r}, expected the literal UNRESOLVED sentinel.")
            failed = True
        else:
            print("PASS: DIN carries exclude_from_cross_cohort_comparison = TRUE, canonical_drug = UNRESOLVED, and does not collide with any resolved/provisional drug.")

    # Check (c): SOAR_207965's 21 raw columns map to exactly 20 distinct canonical_drug
    # values once the dosing-variant tag is applied, and the two Amoxicillin Clavulanate
    # columns produce two separate rows (never averaged/collapsed).
    soar_207965 = crosswalk[crosswalk["cohort_id"] == "SOAR_207965"]
    n_distinct_canonical = soar_207965["canonical_drug"].nunique()
    amox_clav_rows = soar_207965[soar_207965["canonical_drug"] == "amoxicillin/clavulanate"]
    if len(soar_207965) != 21 or n_distinct_canonical != 20:
        print(f"FAIL: SOAR_207965 has {len(soar_207965)} raw columns (expected 21) mapping to {n_distinct_canonical} distinct canonical drugs (expected 20).")
        failed = True
    elif len(amox_clav_rows) != 2 or set(amox_clav_rows["dosing_or_breakpoint_variant"]) != {"standard", "fixed_2ug"}:
        print(f"FAIL: amoxicillin/clavulanate does not have exactly 2 rows tagged standard/fixed_2ug in SOAR_207965: {amox_clav_rows[['raw_identifier', 'dosing_or_breakpoint_variant']].to_dict('records')}")
        failed = True
    else:
        print(f"PASS: SOAR_207965's 21 raw columns map to exactly 20 distinct canonical drugs; amoxicillin/clavulanate preserved as 2 separate dosing-variant rows.")

    if failed:
        print("\nStep 4 Check: FAIL")
        sys.exit(1)

    print("\nStep 4 Check: PASS")


if __name__ == "__main__":
    main()
