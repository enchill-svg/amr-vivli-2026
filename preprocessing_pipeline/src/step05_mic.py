"""
Step 5 - MIC notation normalization.

Issue (Justice's Section 5): three different MIC notations are in live use
across the three SOAR files: "<=0.06" (201818), "</= 0.06" (201910, with an
internal space), and "<0.008" (207965).

Action: parse every MIC value into a single canonical comparator (<=, >, =)
plus a numeric value on the standard log2 dilution scale, regardless of
source notation.

Check: every parsed MIC round-trips to a valid log2 dilution step; no parsed
value falls outside the plausible range for its drug-organism pair.

Design (Appendix 4 A.5): normalize whitespace -> extract the comparator token
longest-first (</= before <= before < before >) -> normalize to a canonical
symbol (<=, >, =) -> parse the remainder as a number, routing anything that
fails to a parse-failure exceptions log -> validate the number against the
generic log2 dilution series (Appendix 4 A.2), treating documented
dual-rounding pairs (e.g. 0.03/0.032, 0.06/0.063) as equal within tolerance.

Open risk carried forward unresolved (Appendix 4 A.6): no per-drug,
per-cohort tested-dilution-range dictionary exists, so this Check can only
validate against the generic log2 series, not each drug's specific tested
range. That half of Justice's Check is not satisfiable with the inputs
available to this pipeline.

Reconnaissance for this step also directly resolved an open gap noted in
Appendix 4 A.3: SENTRY's ten antifungal MIC columns (the "(CLSI)" columns)
are confirmed to be plain float64 with zero comparator-notation strings
anywhere in 26,922 rows - they are pre-resolved readings, never censored.
This step's parser therefore applies only to the three SOAR bacterial files,
as the appendix's design already anticipated.
"""
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parents[0] / "AMR_Datasets"
FAILURES_PATH = ROOT / "exceptions" / "mic_parse_failures_log_v1.csv"
SENTRY_PATH = DATA_ROOT / "ATLAS_Antifungals" / "vivli_sentry_2010_2024.xlsx"

# Longest-token-first, per Appendix 4 A.5 Step 2 (</= must never be
# mis-split into < plus stray characters).
COMPARATOR_TOKENS = [
    ("</=", "<="),
    ("<=", "<="),
    (">=", ">"),   # not observed in any SOAR file; supported defensively only.
    ("<", "<="),
    (">", ">"),
]

# Generic two-fold dilution series, Appendix 4 A.2 (log2 step n -> exact value).
LOG2_STEPS = {n: 2.0 ** n for n in range(-10, 9)}
TOLERANCE = 0.05  # relative tolerance, covers the documented dual-rounding pairs.

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


class ParseFailure(Exception):
    pass


def nearest_log2_step(value):
    """Return (step_n, within_tolerance) for the closest log2 step to value."""
    best_n, best_rel_diff = None, None
    for n, exact in LOG2_STEPS.items():
        rel_diff = abs(value - exact) / exact
        if best_rel_diff is None or rel_diff < best_rel_diff:
            best_n, best_rel_diff = n, rel_diff
    return best_n, best_rel_diff <= TOLERANCE


def parse_mic(raw_value):
    """Parse one raw MIC cell into (comparator, numeric_value, log2_step).

    Raises ParseFailure with a human-readable reason if the cell cannot be
    parsed into a comparator + number, or the number isn't within tolerance
    of any generic log2 dilution step.
    """
    text = str(raw_value).strip()
    text = re.sub(r"\s+", "", text)  # collapse "</= 0.06" -> "</=0.06"

    comparator = "="
    remainder = text
    for token, canonical in COMPARATOR_TOKENS:
        if text.startswith(token):
            comparator = canonical
            remainder = text[len(token):]
            break

    try:
        numeric_value = float(remainder)
    except ValueError:
        raise ParseFailure(f"could not parse numeric remainder {remainder!r} from raw value {raw_value!r}")

    log2_step, within_tolerance = nearest_log2_step(numeric_value)
    if not within_tolerance:
        raise ParseFailure(
            f"numeric value {numeric_value} (from raw {raw_value!r}) is not within "
            f"{TOLERANCE:.0%} of any generic log2 dilution step"
        )

    return comparator, numeric_value, log2_step


def load_drug_columns(name, spec):
    if spec["reader"] == "csv":
        df = pd.read_csv(spec["path"], low_memory=False)
    else:
        df = pd.read_excel(spec["path"])
    drug_columns = [c for c in df.columns if c not in spec["metadata_columns"]]
    return df, drug_columns


def main():
    failed = False
    failure_rows = []
    total_cells = 0
    total_null = 0
    total_parsed = 0

    for name, spec in SOAR_COHORTS.items():
        df, drug_columns = load_drug_columns(name, spec)
        cohort_cells = 0
        cohort_null = 0
        cohort_parsed = 0
        cohort_failed = 0

        for col in drug_columns:
            series = df[col]
            for idx, raw_value in series.items():
                cohort_cells += 1
                if pd.isna(raw_value):
                    cohort_null += 1
                    continue
                try:
                    parse_mic(raw_value)
                    cohort_parsed += 1
                except ParseFailure as exc:
                    cohort_failed += 1
                    failure_rows.append({
                        "cohort": name,
                        "row_index": idx,
                        "drug_column": col,
                        "raw_value": raw_value,
                        "reason": str(exc),
                        "version": "v1",
                        "date_added": "2026-07-06",
                    })

        print(f"{name}: {cohort_cells} MIC cells across {len(drug_columns)} drug columns -> "
              f"{cohort_null} null, {cohort_parsed} parsed, {cohort_failed} parse failures")

        total_cells += cohort_cells
        total_null += cohort_null
        total_parsed += cohort_parsed

    FAILURES_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(failure_rows, columns=[
        "cohort", "row_index", "drug_column", "raw_value", "reason", "version", "date_added",
    ]).to_csv(FAILURES_PATH, index=False)
    print(f"\nWrote {len(failure_rows)} row(s) to {FAILURES_PATH.relative_to(ROOT.parents[0])}")

    # Check (a) + (b): every non-null cell either parses to a valid log2 step,
    # or is logged in the exceptions table - nothing silently dropped or kept invalid.
    if total_null + total_parsed + len(failure_rows) != total_cells:
        print("FAIL: null + parsed + failed does not reconcile against total MIC cells.")
        failed = True
    elif failure_rows:
        print(f"FAIL: {len(failure_rows)} MIC cell(s) failed to parse to a valid log2 dilution step (see exceptions log).")
        failed = True
    else:
        print(f"PASS: all {total_parsed} non-null MIC cells across the 3 SOAR files round-trip to a valid "
              f"log2 dilution step within {TOLERANCE:.0%} tolerance; 0 parse failures.")

    print("NOTE: Check (c) - validating against each drug's own tested dilution range (not just the "
          "generic log2 series) is not satisfiable without a per-drug panel dictionary, which this "
          "pipeline does not have (Appendix 4 A.6, a stated open risk, not an oversight).")

    # Reconnaissance finding: SENTRY's antifungal MIC columns carry no comparator notation at all.
    df_sentry = pd.read_excel(SENTRY_PATH)
    mic_cols = [c for c in df_sentry.columns if c.endswith("(CLSI)")]
    non_float_cols = [c for c in mic_cols if df_sentry[c].dtype != "float64"]
    if non_float_cols:
        print(f"NOTE: SENTRY MIC column(s) {non_float_cols} are not plain float64 - re-check for comparator notation before assuming pre-resolved readings.")
    else:
        print(f"PASS: confirmed SENTRY's {len(mic_cols)} antifungal MIC columns are plain float64 with no "
              f"comparator-notation strings - resolves Appendix 4 A.3's open gap. This step's parser applies "
              f"only to the 3 SOAR bacterial files, as the appendix's design anticipated.")

    if failed:
        print("\nStep 5 Check: FAIL")
        sys.exit(1)

    print("\nStep 5 Check: PASS")


if __name__ == "__main__":
    main()
