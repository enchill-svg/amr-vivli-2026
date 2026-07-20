"""
Pipeline-level acceptance checks (Plan Part 9, items 2-4).

Not one of the brief's original 10 steps - this script verifies the three Part
9 acceptance-criteria items that check consistency ACROSS what steps 1-10
each already wrote to disk, rather than re-verifying any single step's own
already-passing Check. Part 9 items 1, 5, 6, and 7 are satisfied by each
step's own Check output (every step hard-stops on its own failure; Step 8/
Step 7's bounds always carry both an interval and a named assumption; every
deliverable already carries version/date_added columns) and are not
re-implemented here.

Item 2 (row-count reconciliation) - the plan's own text states the formula as
raw = analysis-ready + Step 3 organism exclusions + Step 10 confirmed
duplicates removed. Step 10's own Check (a) already found and documented
additional terms the plan's text does not anticipate: isolates with zero
non-null values across every drug column, and Evaluable=N isolates excluded
from the master table per Step 6. This script re-verifies that extended
5-bucket formula independently, reading each bucket from its own step's
already-written artifact (organism_exclusions_log_v1.csv,
evaluable_excluded_from_master_log_v1.csv, zero_measurement_isolates_log_v1.csv,
dedup_review_log_v1.csv, the master table itself) rather than recomputing
Step 10's logic.

Item 3 (no orphan codes) - every ISO3, canonical_organism, and canonical_drug
value in the master table must trace back to its crosswalk artifact.
canonical_organism is scoped to the 3 bacterial cohorts only:
organism_crosswalk_v1.csv is bacterial-only by design (confirmed here - zero
of its rows are tagged SENTRY in cohorts_observed), so SENTRY's fungal
Species names never go through it. SENTRY rows are excluded from that one
sub-check with this explicit, verified reason, not silently skipped.

Item 4 (no silent unresolved-as-resolved) - (a) every master row whose
raw_drug_identifier is Step 4's unresolved "DIN" code carries canonical_drug
== "UNRESOLVED", and that literal sentinel never collides with any
resolved/provisional canonical drug name; (b) every SENTRY (fungal)
isolate-drug row's classification_basis is one of Step 7's 3 valid tier
values, and every bacterial isolate-drug row's classification_basis is one of
eucast_breakpoints.BACTERIAL_VALID_BASES, both re-verified here at the
master-table level as defense in depth (Step 10's own Check (c) already
verifies this in-process; this re-checks it independently by reading the
same persisted master table this script already reads for items 2-3, rather
than trusting Step 10's in-process result).
"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from step07_classification import VALID_BASES
from eucast_breakpoints import BACTERIAL_VALID_BASES

ROOT = Path(__file__).resolve().parents[1]
from _data_paths import COHORT_PATHS
CROSSWALK_DIR = ROOT / "crosswalks"
EXCEPTIONS_DIR = ROOT / "exceptions"
MASTER_PATH = ROOT / "master" / "master_table_v1.csv"

RAW_FILE_SPECS = {
    "SOAR_201818": {"path": COHORT_PATHS["SOAR_201818"], "reader": "csv"},
    "SOAR_201910": {"path": COHORT_PATHS["SOAR_201910"], "reader": "excel"},
    "SOAR_207965": {"path": COHORT_PATHS["SOAR_207965"], "reader": "excel"},
    "SENTRY": {"path": COHORT_PATHS["SENTRY"], "reader": "excel"},
}


def raw_row_count(spec):
    if spec["reader"] == "csv":
        return len(pd.read_csv(spec["path"], low_memory=False))
    return len(pd.read_excel(spec["path"]))


def main():
    failed = False
    # low_memory=False is required here, not optional: master_table_v1.csv's
    # isolate_id column mixes purely-numeric-looking values (3 of 4 cohorts)
    # with genuinely alphanumeric ones (SOAR_201910's "LGC..." IDs). Under
    # pandas' default chunked parsing, the numeric-looking values can be
    # inferred as int64 in one chunk and str in another, so the same isolate
    # silently counts twice under nunique() - confirmed empirically while
    # building this check (SOAR_207965's analysis-ready count was off by
    # exactly this artifact before low_memory=False was added).
    master_df = pd.read_csv(MASTER_PATH, low_memory=False)

    country_cw = pd.read_csv(CROSSWALK_DIR / "country_iso3_crosswalk_v1.csv", keep_default_na=False)
    organism_cw = pd.read_csv(CROSSWALK_DIR / "organism_crosswalk_v1.csv", keep_default_na=False)
    drug_cw = pd.read_csv(CROSSWALK_DIR / "drug_code_crosswalk_v1.csv", keep_default_na=False)

    # --- Item 2: extended 5-bucket row-count reconciliation. ---
    organism_exclusions = pd.read_csv(EXCEPTIONS_DIR / "organism_exclusions_log_v1.csv")
    evaluable_excluded = pd.read_csv(EXCEPTIONS_DIR / "evaluable_excluded_from_master_log_v1.csv")
    zero_measurement = pd.read_csv(EXCEPTIONS_DIR / "zero_measurement_isolates_log_v1.csv")
    dedup_log = pd.read_csv(EXCEPTIONS_DIR / "dedup_review_log_v1.csv")
    confirmed_duplicates = (dedup_log["resolution"] == "candidate_duplicate_found_needs_manual_review").sum()

    print("Item 2 - row-count reconciliation (raw = analysis-ready + organism-excluded + "
          "Evaluable=N-excluded-from-master + zero-measurement + confirmed-duplicates-removed; "
          "the last three terms extend the plan's stated 3-bucket formula per Step 10's own documented findings):")
    for cohort_name, spec in RAW_FILE_SPECS.items():
        n_raw = raw_row_count(spec)
        n_analysis_ready = master_df.loc[master_df["source_cohort"] == cohort_name, "isolate_id"].nunique()
        n_organism_excluded = int((organism_exclusions["cohort"] == cohort_name).sum())
        n_evaluable_excluded = int((evaluable_excluded["cohort"] == cohort_name).sum())
        n_zero_measurement = int((zero_measurement["cohort"] == cohort_name).sum())
        n_duplicates_removed = 0  # candidate duplicates are logged for manual review, never auto-removed (the brief's Action) - never silently folded into "expected" as if already resolved.
        expected = (
            n_analysis_ready + n_organism_excluded + n_evaluable_excluded
            + n_zero_measurement + n_duplicates_removed
        )
        if n_raw != expected:
            print(f"  FAIL: {cohort_name} - raw {n_raw} != analysis-ready {n_analysis_ready} + organism-excluded "
                  f"{n_organism_excluded} + Evaluable=N {n_evaluable_excluded} + zero-measurement "
                  f"{n_zero_measurement} + duplicates-removed {n_duplicates_removed} (= {expected}).")
            failed = True
        else:
            print(f"  PASS: {cohort_name} - raw {n_raw} == analysis-ready {n_analysis_ready} + organism-excluded "
                  f"{n_organism_excluded} + Evaluable=N {n_evaluable_excluded} + zero-measurement "
                  f"{n_zero_measurement} + duplicates-removed {n_duplicates_removed}.")
    if confirmed_duplicates:
        print(f"  NOTE: {confirmed_duplicates} candidate duplicate(s) are logged for manual review and are not "
              f"subtracted from any cohort's analysis-ready count above (the brief's Action never auto-removes them).")

    # --- Item 3: no orphan codes. ---
    valid_iso3 = set(country_cw["iso3"]) - {""}
    master_iso3 = set(master_df["iso3_country"].dropna().unique())
    orphan_iso3 = master_iso3 - valid_iso3
    if orphan_iso3:
        print(f"\nFAIL: {len(orphan_iso3)} ISO3 code(s) in the master table have no country_iso3_crosswalk_v1.csv "
              f"row: {sorted(orphan_iso3)}")
        failed = True
    else:
        print(f"\nPASS: all {len(master_iso3)} distinct ISO3 codes in the master table trace back to "
              f"country_iso3_crosswalk_v1.csv.")

    sentry_in_organism_cw = organism_cw["cohorts_observed"].str.contains("SENTRY", na=False).sum()
    if sentry_in_organism_cw:
        print(f"FAIL: organism_crosswalk_v1.csv has {sentry_in_organism_cw} row(s) tagged SENTRY - it is no "
              f"longer bacterial-only, so SENTRY rows should not be excluded from the organism orphan-code check below.")
        failed = True

    valid_organisms = set(organism_cw["canonical_organism"]) - {"excluded"}
    bacterial_master = master_df[master_df["source_cohort"] != "SENTRY"]
    master_organisms = set(bacterial_master["canonical_organism"].dropna().unique())
    orphan_organisms = master_organisms - valid_organisms
    if orphan_organisms:
        print(f"FAIL: {len(orphan_organisms)} bacterial canonical_organism value(s) in the master table have no "
              f"organism_crosswalk_v1.csv row: {sorted(orphan_organisms)}")
        failed = True
    else:
        print(f"PASS: all {len(master_organisms)} distinct bacterial canonical_organism values trace back to "
              f"organism_crosswalk_v1.csv (SENTRY's fungal Species names are excluded from this sub-check because "
              f"organism_crosswalk_v1.csv is confirmed bacterial-only - 0 of its rows are tagged SENTRY).")

    valid_drugs = set(drug_cw["canonical_drug"])
    master_drugs = set(master_df["canonical_drug"].dropna().unique())
    orphan_drugs = master_drugs - valid_drugs
    if orphan_drugs:
        print(f"FAIL: {len(orphan_drugs)} canonical_drug value(s) in the master table have no "
              f"drug_code_crosswalk_v1.csv row: {sorted(orphan_drugs)}")
        failed = True
    else:
        print(f"PASS: all {len(master_drugs)} distinct canonical_drug values (across all 4 cohorts, including "
              f"SENTRY) trace back to drug_code_crosswalk_v1.csv.")

    # --- Item 4: no silent unresolved-as-resolved. ---
    din_rows = master_df[master_df["raw_drug_identifier"] == "DIN"]
    bad_din = din_rows[din_rows["canonical_drug"] != "UNRESOLVED"]
    if len(bad_din):
        print(f"\nFAIL: {len(bad_din)} DIN row(s) in the master table carry a canonical_drug other than the "
              f"UNRESOLVED sentinel.")
        failed = True
    else:
        print(f"\nPASS: all {len(din_rows)} DIN row(s) in the master table carry canonical_drug == 'UNRESOLVED', "
              f"never a real drug name.")

    resolved_or_provisional = set(
        drug_cw.loc[drug_cw["resolution_status"].isin(["resolved", "provisional"]), "canonical_drug"]
    )
    if "UNRESOLVED" in resolved_or_provisional:
        print("FAIL: the 'UNRESOLVED' sentinel collides with a resolved/provisional canonical_drug name.")
        failed = True
    else:
        print("PASS: the 'UNRESOLVED' sentinel never collides with any resolved/provisional canonical_drug name.")

    fungal_master = master_df[master_df["source_cohort"] == "SENTRY"]
    bad_basis = fungal_master[~fungal_master["classification_basis"].isin(VALID_BASES)]
    if len(bad_basis):
        print(f"FAIL: {len(bad_basis)} SENTRY (fungal) row(s) in the master table carry a classification_basis "
              f"outside Step 7's 3 valid tiers.")
        failed = True
    else:
        print(f"PASS: all {len(fungal_master)} SENTRY (fungal) row(s) in the master table carry exactly one of "
              f"Step 7's 3 valid classification_basis tiers ({sorted(VALID_BASES)}), distinguishable from any "
              f"other tier.")

    bacterial_master_basis = master_df[master_df["source_cohort"] != "SENTRY"]
    bad_bacterial_basis = bacterial_master_basis[~bacterial_master_basis["classification_basis"].isin(BACTERIAL_VALID_BASES)]
    if len(bad_bacterial_basis):
        print(f"FAIL: {len(bad_bacterial_basis)} bacterial row(s) in the master table carry a classification_basis "
              f"outside eucast_breakpoints.BACTERIAL_VALID_BASES.")
        failed = True
    else:
        print(f"PASS: all {len(bacterial_master_basis)} bacterial row(s) in the master table carry exactly one of "
              f"eucast_breakpoints's {len(BACTERIAL_VALID_BASES)} valid classification_basis values "
              f"({sorted(BACTERIAL_VALID_BASES)}).")

    mic_parsed_path = ROOT / "master" / "mic_parsed_values_v1.csv"
    if mic_parsed_path.exists():
        n_step5_parsed = len(pd.read_csv(mic_parsed_path))
        soar_master = master_df[master_df["source_cohort"].astype(str).str.startswith("SOAR")]
        n_step10_mic = int(soar_master["mic_value"].notna().sum())
        if n_step5_parsed != n_step10_mic:
            print(
                f"FAIL: Step 5 parsed MIC rows ({n_step5_parsed}) do not reconcile with "
                f"Step 10 SOAR mic_value rows ({n_step10_mic})."
            )
            failed = True
        else:
            print(
                f"PASS: Step 5 parsed MIC count reconciles with Step 10 master table "
                f"({n_step5_parsed} SOAR MIC cells)."
            )
    else:
        print("NOTE: mic_parsed_values_v1.csv missing — skipping Step 5 vs Step 10 MIC reconciliation.")

    if failed:
        print("\nPipeline acceptance Check: FAIL")
        sys.exit(1)

    print("\nPipeline acceptance Check: PASS")


if __name__ == "__main__":
    main()
