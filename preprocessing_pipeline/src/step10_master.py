"""
Step 10 - Deduplication and master schema assembly.

Issue (Justice's Section 5): the three SOAR cohorts use different isolate ID
schemes (e.g. "LGC277703-05404" in 201910 vs a plain IHMA number in 207965),
so accidental duplication across the one year of cohort overlap (Vietnam,
2018) is unlikely but unverified.

Action: confirm no isolate ID or identical demographic/MIC fingerprint
appears in more than one cohort for the 2018 Vietnam overlap. Then assemble
the long-format master table - one row per isolate-drug pair, carrying ISO3
country code, parsed year, canonical organism, canonical drug, normalized
MIC, resistance category and its basis, pathogen type, and source cohort.

Check: the master table round-trips back to each source cohort's isolate
count once filtered by source; no isolate-drug row has a null value in any
of the seven key fields.

Reconnaissance for this step confirmed the three SOAR cohorts' isolate ID
formats are structurally incomparable (201818: plain sequential integers
1, 2, 3...; 201910: "LGC277703-05404"; 207965: plain IHMA integers like
2281816) - exact-ID matching across cohorts is therefore not meaningful for
either boundary check, exactly the concern the plan's own Design/Approach
text anticipated. Both boundary checks below use fingerprint matching only:
(country, year, canonical_organism, continuous age, parsed MIC tuples for the
13 canonical drugs common to all three SOAR cohorts).

This step additionally identifies, per the plan's own instruction, the
Ukraine/2016 boundary (SOAR_201818's 2014-2016 window vs SOAR_201910's
2016-2017 window) alongside the Vietnam/2018 boundary (SOAR_201910's
2016-2018 window vs SOAR_207965's 2018-2021 window) Justice's text names
directly.

Bacterial resistance classification: Step 7 could not classify any bacterial
isolate-drug pair (no EUCAST/CLSI organism-drug breakpoint table available in
this plan's docs/). Per the master schema's own requirement that
`classification_basis` never be null, bacterial rows here carry the explicit
value `unclassified_no_breakpoint_table` - a fourth, honest non-result value
alongside Step 7's three fungal tiers (CLSI_breakpoint / ECV_WT_NWT /
unclassifiable_no_standard), never a fabricated S/I/R category.
"""
import sys
from pathlib import Path

import pandas as pd

sys.path.insert(0, str(Path(__file__).resolve().parent))
from step02_date import parse_value
from step09_age import bin_age, SENTRY_BAND_NORMALIZATION
from step05_mic import parse_mic, ParseFailure
from step07_classification import classify_one, FUNGAL_DRUGS, BASIS_CLSI, BASIS_ECV, BASIS_UNCLASSIFIABLE
from step08_beta_lactamase_bounds import BETA_LACTAMASE_NORMALIZATION

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parents[0] / "AMR_Datasets"
CROSSWALK_DIR = ROOT / "crosswalks"
EXCEPTIONS_DIR = ROOT / "exceptions"
MASTER_DIR = ROOT / "master"

BASIS_NO_BREAKPOINT_TABLE = "unclassified_no_breakpoint_table"
NO_BREAKPOINT_CATEGORY = "unclassified - no breakpoint table available"

# 13 canonical drugs common to all 3 SOAR bacterial cohorts (Step 4 crosswalk),
# used as the MIC-fingerprint basis for both boundary-year dedup checks.
SHARED_FINGERPRINT_DRUGS = [
    "amoxicillin", "amoxicillin/clavulanate", "ampicillin", "azithromycin",
    "cefaclor", "ceftriaxone", "cefuroxime", "clarithromycin", "erythromycin",
    "levofloxacin", "moxifloxacin", "penicillin", "trimethoprim/sulfamethoxazole",
]

def normalize_isolate_id(raw_id):
    """Coerce an isolate ID to one consistently-formatted string.

    isolate_id mixes cohort-specific schemes in a single master-table column
    (plain integers for SOAR_201818/207965/SENTRY, alphanumeric strings like
    "LGC277703-05404" for SOAR_201910). Left as native pandas types, this
    produces int values for some cohorts and str values for others in the
    same in-memory column; on write-and-reread, pandas' chunked CSV type
    inference can then read the *same* underlying value as int in one chunk
    and str in another (confirmed: pd.read_csv on master_table_v1.csv without
    low_memory=False silently inflates SOAR_207965's nunique() isolate count
    by 1 this way). Casting to str at construction time - and stripping a
    spurious ".0" for the case where a source column has no nulls now but
    could pick up a null-driven int->float upcast later - guarantees anyone
    reading this column back, under any pandas settings, sees one consistent
    value per isolate.
    """
    if isinstance(raw_id, float) and raw_id.is_integer():
        return str(int(raw_id))
    return str(raw_id)


COHORT_SPECS = {
    "SOAR_201818": {
        "path": DATA_ROOT / "SOAR 201818" / "gsk_201818_published.csv",
        "reader": "csv",
        "isolate_id_col": "IHMANUMBER",
        "country_col": "COUNTRY",
        "year_col": "YEARCOLLECTED",
        "organism_col": "ORGANISMNAME",
        "original_organism_col": None,
        "beta_lactamase_col": "BETALACTAMASE",
        "age_col": "AGE",
        "evaluable_col": None,
        "metadata_columns": {
            "IHMANUMBER", "AGE", "DEID_CAT_AGE", "REGION", "COUNTRY", "ORGANISMNAME",
            "BETALACTAMASE", "GENDER", "YEARCOLLECTED", "BODYLOCATION", "INVESTIGATORNAME",
        },
    },
    "SOAR_201910": {
        "path": DATA_ROOT / "SOAR 201910" / "GSK_SOAR_201910 raw data.xlsx",
        "reader": "excel",
        "isolate_id_col": "Isolate Number",
        "country_col": "Country",
        "year_col": "Collection Date",
        "organism_col": "Organism",
        "original_organism_col": None,
        "beta_lactamase_col": "Betalactamase",
        "age_col": "Age",
        "evaluable_col": None,
        "metadata_columns": {
            "Isolate Number", "Organism", "BodyLocation", "Country", "Centre", "Gender",
            "Age", "Collection Date", "Betalactamase",
        },
    },
    "SOAR_207965": {
        "path": DATA_ROOT / "SOAR 207965" / "SOAR 207965 Complete data set 04Sep25.xlsx",
        "reader": "excel",
        "isolate_id_col": "IHMA #",
        "country_col": "Country",
        "year_col": "YearCollected",
        "organism_col": "FinalOrganismName",
        "original_organism_col": "OriginalOrganismName",
        "beta_lactamase_col": "Beta Lactamase",
        "age_col": "Age",
        "evaluable_col": "Evaluable",
        "metadata_columns": {
            "Region", "Country", "Investigator", "InvestigatorName", "IHMA #",
            "OriginalOrganismName", "FinalOrganismName", "OrganismFamilyName", "GramType",
            "Age", "Gender", "YearCollected", "BodyLocation", "FacilityName", "Evaluable",
            "Beta Lactamase",
        },
    },
}

SENTRY_PATH = DATA_ROOT / "ATLAS_Antifungals" / "vivli_sentry_2010_2024.xlsx"

BOUNDARY_CHECKS = [
    {"name": "Vietnam_2018", "country": "Vietnam", "year": 2018, "cohorts": ("SOAR_201910", "SOAR_207965")},
    {"name": "Ukraine_2016", "country": "Ukraine", "year": 2016, "cohorts": ("SOAR_201818", "SOAR_201910")},
]


def load_country_crosswalk():
    cw = pd.read_csv(CROSSWALK_DIR / "country_iso3_crosswalk_v1.csv")
    return dict(zip(cw["raw_string"], cw["iso3"]))


def load_organism_crosswalk():
    cw = pd.read_csv(CROSSWALK_DIR / "organism_crosswalk_v1.csv", keep_default_na=False)
    lookup = {}
    for _, row in cw.iterrows():
        key = None if row["raw_string"] == "<null>" else row["raw_string"]
        lookup[key] = (row["canonical_organism"], row["pathogen_type"] or None)
    return lookup


def load_drug_crosswalk():
    cw = pd.read_csv(CROSSWALK_DIR / "drug_code_crosswalk_v1.csv", keep_default_na=False)
    lookup = {}
    for _, row in cw.iterrows():
        lookup[(row["cohort_id"], row["raw_identifier"])] = (
            row["canonical_drug"], row["dosing_or_breakpoint_variant"] or None,
        )
    return lookup


def build_soar_isolates(cohort_name, spec, country_map, organism_map):
    """Return (isolate_records, raw_row_count) for one SOAR cohort.

    isolate_records is a list of dicts, one per RETAINED isolate (Step 3
    organism-excluded rows are dropped here, per Step 10's own row-count
    reconciliation formula), each carrying isolate-level metadata plus a
    `drug_values` dict of {raw_drug_column: raw_mic_cell}.
    """
    if spec["reader"] == "csv":
        df = pd.read_csv(spec["path"], low_memory=False)
    else:
        df = pd.read_excel(spec["path"])

    drug_columns = [c for c in df.columns if c not in spec["metadata_columns"]]
    n_raw = len(df)
    records = []
    n_organism_excluded = 0

    for _, row in df.iterrows():
        raw_organism = row[spec["organism_col"]]
        raw_organism = None if pd.isna(raw_organism) else raw_organism
        canonical_organism, pathogen_type = organism_map.get(raw_organism, (None, None))

        if canonical_organism == "excluded":
            n_organism_excluded += 1
            continue

        raw_country = row[spec["country_col"]]
        iso3 = country_map.get(raw_country)

        raw_year = row[spec["year_col"]]
        parsed_year, date_parse_status = parse_value(raw_year)

        raw_beta = row[spec["beta_lactamase_col"]]
        beta_lactamase_raw = BETA_LACTAMASE_NORMALIZATION.get(raw_beta) if pd.notna(raw_beta) else None

        # age_continuous is coerced to None for the negative-age sentinel, same
        # as age_band: -1 is a confirmed data-entry sentinel (Step 9's own
        # reconnaissance), not a real age, so a field literally named
        # "age_continuous" must not carry it - the raw sentinel value remains
        # fully recoverable via Step 9's age_sentinel_exclusions_log_v1.csv.
        raw_age = row[spec["age_col"]]
        age_continuous = raw_age if pd.notna(raw_age) and raw_age >= 0 else None
        age_band = bin_age(raw_age) if pd.notna(raw_age) else None

        evaluable_flag = None
        if spec["evaluable_col"] is not None:
            raw_eval = row[spec["evaluable_col"]]
            evaluable_flag = None if pd.isna(raw_eval) else raw_eval

        original_organism_name = None
        if spec["original_organism_col"] is not None:
            raw_orig = row[spec["original_organism_col"]]
            original_organism_name = None if pd.isna(raw_orig) else raw_orig

        records.append({
            "source_cohort": cohort_name,
            "isolate_id": normalize_isolate_id(row[spec["isolate_id_col"]]),
            "raw_country_original": raw_country,
            "iso3_country": iso3,
            "parsed_year": parsed_year,
            "date_parse_status": date_parse_status,
            "canonical_organism": canonical_organism,
            "original_organism_name": original_organism_name,
            "pathogen_type": pathogen_type,
            "evaluable_flag": evaluable_flag,
            "beta_lactamase_raw": beta_lactamase_raw,
            "age_band": age_band,
            "age_continuous": age_continuous,
            "drug_values": {col: row[col] for col in drug_columns},
        })

    return records, n_raw, n_organism_excluded


def build_sentry_isolates(country_map):
    df = pd.read_excel(SENTRY_PATH)
    records = []
    for _, row in df.iterrows():
        raw_country = row["Country"]
        iso3 = country_map.get(raw_country)

        raw_year = row["Year"]
        parsed_year, date_parse_status = parse_value(raw_year)

        raw_age_band = row["Age Group"]
        age_band = SENTRY_BAND_NORMALIZATION.get(raw_age_band) if pd.notna(raw_age_band) else None

        drug_values = {}
        for drug in FUNGAL_DRUGS:
            drug_values[drug] = (row[f"{drug} (CLSI)"], row[f"{drug} (CLSI)_I"])

        records.append({
            "source_cohort": "SENTRY",
            "isolate_id": normalize_isolate_id(row["uid"]),
            "raw_country_original": raw_country,
            "iso3_country": iso3,
            "parsed_year": parsed_year,
            "date_parse_status": date_parse_status,
            "canonical_organism": row["Species"],
            "original_organism_name": None,
            "pathogen_type": "fungal",
            "evaluable_flag": None,
            "beta_lactamase_raw": None,
            "age_band": age_band,
            "age_continuous": None,
            "species": row["Species"],
            "drug_values": drug_values,
        })
    return records, len(df)


def has_shared_drug_data(record, cohort_name, drug_crosswalk):
    """True if at least one of the 13 shared fingerprint drugs has a non-null
    raw value for this record.

    Isolates with zero shared-drug measurements (e.g. SOAR_207965's
    Evaluable=N isolates - see Step 10's zero-measurement handling below)
    would otherwise produce a degenerate, all-None MIC tuple. Two such
    isolates that merely share a country/year/organism would then collide as
    a "candidate duplicate" with zero real MIC evidence behind the match -
    excluded from the comparison pool entirely rather than risk a false
    match, and counted so the exclusion is auditable, not silent.
    """
    for raw_col, raw_value in record["drug_values"].items():
        canonical_drug, _ = drug_crosswalk.get((cohort_name, raw_col), (None, None))
        if canonical_drug in SHARED_FINGERPRINT_DRUGS and pd.notna(raw_value):
            return True
    return False


def build_fingerprints(records, cohort_name, drug_crosswalk):
    """Map raw drug column -> canonical drug for this cohort, then build one
    fingerprint tuple per record over SHARED_FINGERPRINT_DRUGS.

    SOAR_207965 is the only cohort where two raw columns share one canonical
    drug (amoxicillin/clavulanate's "standard" and "fixed_2ug" dosing
    variants, per Step 4's crosswalk). Keying only by canonical_drug would let
    the second-processed variant silently overwrite the first whenever both
    are non-null for the same isolate - a real reading discarded with no
    error. Keying by (canonical_drug, dosing_variant) instead keeps both
    readings distinct; a drug with only one tested variant (every other drug,
    every other cohort) still produces the same single-entry shape it always
    did, so cross-cohort fingerprint equality is unaffected.
    """
    fingerprints = []
    for record in records:
        drug_variant_values = {}
        for raw_col, raw_value in record["drug_values"].items():
            canonical_drug, dosing_variant = drug_crosswalk.get((cohort_name, raw_col), (None, None))
            if canonical_drug in SHARED_FINGERPRINT_DRUGS and pd.notna(raw_value):
                try:
                    comparator, numeric_value, _ = parse_mic(raw_value)
                    parsed = (comparator, numeric_value)
                except ParseFailure:
                    parsed = ("PARSE_FAILURE", None)
                variant_key = dosing_variant or "standard"
                drug_variant_values.setdefault(canonical_drug, {})[variant_key] = parsed

        mic_tuple = tuple(
            tuple(sorted(drug_variant_values[d].items())) if d in drug_variant_values else None
            for d in SHARED_FINGERPRINT_DRUGS
        )
        key = (record["iso3_country"], record["parsed_year"], record["canonical_organism"],
               record["age_continuous"], mic_tuple)
        fingerprints.append(key)
    return fingerprints


def run_dedup_checks(all_records_by_cohort, drug_crosswalk):
    dedup_rows = []
    for check in BOUNDARY_CHECKS:
        cohort_a, cohort_b = check["cohorts"]
        candidates_a = [r for r in all_records_by_cohort[cohort_a]
                        if r["raw_country_original"] == check["country"] and r["parsed_year"] == check["year"]]
        candidates_b = [r for r in all_records_by_cohort[cohort_b]
                        if r["raw_country_original"] == check["country"] and r["parsed_year"] == check["year"]]

        subset_a = [r for r in candidates_a if has_shared_drug_data(r, cohort_a, drug_crosswalk)]
        subset_b = [r for r in candidates_b if has_shared_drug_data(r, cohort_b, drug_crosswalk)]
        excluded_a = len(candidates_a) - len(subset_a)
        excluded_b = len(candidates_b) - len(subset_b)

        fp_a = build_fingerprints(subset_a, cohort_a, drug_crosswalk)
        fp_b = build_fingerprints(subset_b, cohort_b, drug_crosswalk)

        set_a, set_b = set(fp_a), set(fp_b)
        collisions = set_a & set_b

        print(f"\n{check['name']} boundary check: {cohort_a} has {len(subset_a)} isolate(s) with >=1 shared-drug "
              f"MIC reading ({excluded_a} excluded for having none), {cohort_b} has {len(subset_b)} isolate(s) "
              f"({excluded_b} excluded), in {check['country']}/{check['year']}.")
        if excluded_a or excluded_b:
            dedup_rows.append({
                "boundary_check": check["name"], "cohort_a": cohort_a, "cohort_b": cohort_b,
                "country": check["country"], "year": check["year"],
                "fingerprint": f"{cohort_a}:{excluded_a}_excluded,{cohort_b}:{excluded_b}_excluded",
                "resolution": "excluded_no_shared_mic_data",
                "version": "v1", "date_added": "2026-07-06",
            })

        if collisions:
            print(f"  {len(collisions)} candidate duplicate fingerprint(s) found - logging each for review.")
            for fp in collisions:
                dedup_rows.append({
                    "boundary_check": check["name"], "cohort_a": cohort_a, "cohort_b": cohort_b,
                    "country": check["country"], "year": check["year"],
                    "fingerprint": str(fp), "resolution": "candidate_duplicate_found_needs_manual_review",
                    "version": "v1", "date_added": "2026-07-06",
                })
        else:
            print(f"  PASS: zero candidate duplicate fingerprints between {cohort_a} and {cohort_b} - confirmed no overlap.")
            dedup_rows.append({
                "boundary_check": check["name"], "cohort_a": cohort_a, "cohort_b": cohort_b,
                "country": check["country"], "year": check["year"],
                "fingerprint": "", "resolution": "no_duplicates_found",
                "version": "v1", "date_added": "2026-07-06",
            })
    return dedup_rows


def main():
    failed = False
    MASTER_DIR.mkdir(parents=True, exist_ok=True)
    EXCEPTIONS_DIR.mkdir(parents=True, exist_ok=True)

    country_map = load_country_crosswalk()
    organism_map = load_organism_crosswalk()
    drug_crosswalk = load_drug_crosswalk()

    all_records_by_cohort = {}
    raw_counts = {}
    organism_excluded_counts = {}

    for cohort_name, spec in COHORT_SPECS.items():
        records, n_raw, n_excluded = build_soar_isolates(cohort_name, spec, country_map, organism_map)
        all_records_by_cohort[cohort_name] = records
        raw_counts[cohort_name] = n_raw
        organism_excluded_counts[cohort_name] = n_excluded
        print(f"{cohort_name}: {n_raw} raw rows, {n_excluded} Step-3 organism exclusions, {len(records)} retained isolates")

    sentry_records, n_sentry_raw = build_sentry_isolates(country_map)
    all_records_by_cohort["SENTRY"] = sentry_records
    raw_counts["SENTRY"] = n_sentry_raw
    organism_excluded_counts["SENTRY"] = 0
    print(f"SENTRY: {n_sentry_raw} raw rows, 0 Step-3 organism exclusions (Step 3 scope is bacterial-only), {len(sentry_records)} retained isolates")

    # --- Part (A): Vietnam/2018 and Ukraine/2016 boundary dedup checks ---
    dedup_rows = run_dedup_checks(all_records_by_cohort, drug_crosswalk)
    dedup_path = EXCEPTIONS_DIR / "dedup_review_log_v1.csv"
    pd.DataFrame(dedup_rows, columns=[
        "boundary_check", "cohort_a", "cohort_b", "country", "year", "fingerprint", "resolution",
        "version", "date_added",
    ]).to_csv(dedup_path, index=False)
    print(f"\nWrote {len(dedup_rows)} dedup review row(s) to {dedup_path.relative_to(ROOT.parents[0])}")

    confirmed_duplicates = sum(1 for r in dedup_rows if r["resolution"] == "candidate_duplicate_found_needs_manual_review")
    if confirmed_duplicates:
        print(f"NOTE: {confirmed_duplicates} candidate duplicate(s) found - these isolates are NOT removed "
              f"automatically; they are logged for manual review per Justice's Action, and are still counted "
              f"once each in the master table below.")

    # --- Part (B): long-format master table assembly ---
    # An isolate with zero non-null drug measurements produces zero rows in a
    # long-format table by construction - it cannot be "represented" any other
    # way without fabricating a measurement. Reconnaissance on SOAR_207965
    # found exactly this: all 613 Evaluable=N isolates carry zero non-null
    # values across all 21 drug columns (29 of those already excluded by Step
    # 3's organism rule, leaving 584 retained-but-untested isolates). These
    # are logged explicitly here.
    #
    # NOTE on the plan's Part 9 item 2 (row-count reconciliation): the plan's
    # own text states the formula as raw = analysis-ready + Step 3 organism
    # exclusions + Step 10 confirmed duplicates removed - a 3-bucket formula.
    # This zero-measurement finding is a genuine data characteristic the
    # plan's text did not anticipate, and Check (a) below extends the
    # formula to 4 buckets rather than silently miscounting or discarding the
    # discrepancy. pipeline_acceptance_check.py re-verifies this same
    # 4-bucket formula independently, reading each bucket from its own step's
    # written artifact rather than recomputing this script's logic.
    zero_measurement_rows = []
    zero_measurement_counts = {name: 0 for name in all_records_by_cohort}

    master_rows = []
    for cohort_name, records in all_records_by_cohort.items():
        for record in records:
            drug_values = record.pop("drug_values")
            species = record.pop("species", None)

            if cohort_name == "SENTRY":
                has_measurement = any(pd.notna(mic) or pd.notna(cat) for mic, cat in drug_values.values())
            else:
                has_measurement = any(pd.notna(v) for v in drug_values.values())
            if not has_measurement:
                zero_measurement_counts[cohort_name] += 1
                zero_measurement_rows.append({
                    "cohort": cohort_name,
                    "isolate_id": record["isolate_id"],
                    "reason": "isolate has zero non-null values across every drug column - cannot appear "
                              "in a long-format isolate-drug table without fabricating a measurement",
                    "version": "v1",
                    "date_added": "2026-07-06",
                })
                continue

            if cohort_name == "SENTRY":
                for drug, (mic_value, clsi_category) in drug_values.items():
                    if pd.isna(mic_value) and pd.isna(clsi_category):
                        continue
                    basis, category = classify_one(species, mic_value, clsi_category, drug)
                    if basis is None:
                        continue
                    master_rows.append({
                        **record,
                        "raw_drug_identifier": drug,
                        "canonical_drug": drug,
                        "dosing_variant": None,
                        "mic_comparator": "=" if pd.notna(mic_value) else None,
                        "mic_value": mic_value if pd.notna(mic_value) else None,
                        "mic_source_notation_raw": str(mic_value) if pd.notna(mic_value) else None,
                        "resistance_category": category,
                        "classification_basis": basis,
                    })
            else:
                for raw_col, raw_value in drug_values.items():
                    if pd.isna(raw_value):
                        continue
                    canonical_drug, dosing_variant = drug_crosswalk.get((cohort_name, raw_col), (None, None))
                    try:
                        comparator, numeric_value, _ = parse_mic(raw_value)
                    except ParseFailure:
                        continue
                    master_rows.append({
                        **record,
                        "raw_drug_identifier": raw_col,
                        "canonical_drug": canonical_drug,
                        "dosing_variant": dosing_variant,
                        "mic_comparator": comparator,
                        "mic_value": numeric_value,
                        "mic_source_notation_raw": raw_value,
                        "resistance_category": NO_BREAKPOINT_CATEGORY,
                        "classification_basis": BASIS_NO_BREAKPOINT_TABLE,
                    })

    master_columns = [
        "isolate_id", "source_cohort", "iso3_country", "raw_country_original", "parsed_year",
        "date_parse_status", "canonical_organism", "original_organism_name", "pathogen_type",
        "canonical_drug", "raw_drug_identifier", "dosing_variant", "mic_comparator", "mic_value",
        "mic_source_notation_raw", "evaluable_flag", "resistance_category", "classification_basis",
        "beta_lactamase_raw", "age_band", "age_continuous",
    ]
    master_df = pd.DataFrame(master_rows, columns=master_columns)
    master_path = MASTER_DIR / "master_table_v1.csv"
    master_df.to_csv(master_path, index=False)
    print(f"\nWrote {len(master_df)} isolate-drug row(s) to {master_path.relative_to(ROOT.parents[0])}")
    # NOTE for any future reader of this CSV: isolate_id mixes purely-numeric-
    # looking values (SOAR_201818/207965, SENTRY) with genuinely alphanumeric
    # ones (SOAR_201910's "LGC..." IDs) - normalize_isolate_id() above already
    # guarantees one consistent str value per isolate in this DataFrame, but
    # CSV itself carries no type information. Read this file back with
    # low_memory=False (or dtype={"isolate_id": str}); otherwise pandas'
    # default chunked parser can infer int64 for one chunk of numeric-looking
    # IDs and str for another, silently double-counting isolates under
    # nunique() - confirmed empirically while building pipeline_acceptance_check.py.

    zero_measurement_path = EXCEPTIONS_DIR / "zero_measurement_isolates_log_v1.csv"
    pd.DataFrame(zero_measurement_rows, columns=[
        "cohort", "isolate_id", "reason", "version", "date_added",
    ]).to_csv(zero_measurement_path, index=False)
    print(f"Wrote {len(zero_measurement_rows)} zero-measurement isolate row(s) to "
          f"{zero_measurement_path.relative_to(ROOT.parents[0])}")

    # Check (a): isolate-level row-count round-trip per source cohort. An
    # isolate with zero non-null drug measurements across every column cannot
    # appear in a long-format table (there is no drug to hang the row on), so
    # it is its own explicit, logged reconciling term - never silently folded
    # into "expected" without a citation, and never silently absent either.
    for cohort_name in COHORT_SPECS.keys() | {"SENTRY"}:
        distinct_isolates_in_master = master_df.loc[master_df["source_cohort"] == cohort_name, "isolate_id"].nunique()
        expected = raw_counts[cohort_name] - organism_excluded_counts[cohort_name] - zero_measurement_counts[cohort_name]
        if distinct_isolates_in_master != expected:
            print(f"FAIL: {cohort_name} - {distinct_isolates_in_master} distinct isolate(s) in master table, "
                  f"expected {expected} ({raw_counts[cohort_name]} raw - {organism_excluded_counts[cohort_name]} "
                  f"organism-excluded - {zero_measurement_counts[cohort_name]} zero-measurement).")
            failed = True
        else:
            print(f"PASS: {cohort_name} - {distinct_isolates_in_master} distinct isolates in master table "
                  f"== {raw_counts[cohort_name]} raw - {organism_excluded_counts[cohort_name]} Step-3 exclusions "
                  f"- {zero_measurement_counts[cohort_name]} zero-measurement isolates (logged separately).")

    # Check (b): zero nulls in the 7 conceptual / ~8 physical required fields.
    required_columns = [
        "source_cohort", "iso3_country", "parsed_year", "canonical_organism", "pathogen_type",
        "canonical_drug", "mic_comparator", "mic_value", "resistance_category", "classification_basis",
    ]
    null_counts = master_df[required_columns].isna().sum()
    if null_counts.any():
        print(f"FAIL: null value(s) found in required field(s): {null_counts[null_counts > 0].to_dict()}")
        failed = True
    else:
        print(f"PASS: zero nulls across all {len(required_columns)} required physical columns "
              f"({len(master_df)} rows checked).")

    # Check (c): both boundary dedup checks recorded a real outcome (found-and-
    # logged, or confirmed none). "excluded_no_shared_mic_data" rows are an
    # audit-trail addendum documenting isolates left out of the comparison
    # pool (see has_shared_drug_data) - not themselves an outcome, so they are
    # excluded from this count rather than counted as if they were one.
    outcome_resolutions = {"no_duplicates_found", "candidate_duplicate_found_needs_manual_review"}
    boundary_names_covered = {r["boundary_check"] for r in dedup_rows if r["resolution"] in outcome_resolutions}
    if boundary_names_covered != {c["name"] for c in BOUNDARY_CHECKS}:
        print(f"FAIL: not every boundary check has a recorded outcome in the dedup log: {boundary_names_covered}")
        failed = True
    else:
        print(f"PASS: both boundary checks ({sorted(boundary_names_covered)}) have a recorded outcome in the "
              f"dedup review log ({len(dedup_rows)} total row(s), including any shared-MIC-data exclusion audit rows).")

    if failed:
        print("\nStep 10 Check: FAIL")
        sys.exit(1)

    print("\nStep 10 Check: PASS")


if __name__ == "__main__":
    main()
