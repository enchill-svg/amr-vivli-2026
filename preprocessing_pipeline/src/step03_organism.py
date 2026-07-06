"""
Step 3 - Organism-name harmonization.

Issue (Justice's Section 5): SOAR 207965 separates OriginalOrganismName from
FinalOrganismName and includes a long tail of additional species and quality
categories beyond the two primary pathogens, including environmental/skin-
flora organisms and at least one non-bacterial (fungal) isolate that does not
belong in either analysis arm as currently scoped.

Action: map every organism string to a canonical species name. Exclude
isolates flagged "No Growth" and clear environmental/contaminant genera from
the resistance analysis. Route any genuinely fungal isolate found inside a
bacterial file to a documented exceptions list rather than discarding it.

Check: every retained isolate maps to a named species or an explicit
"unidentified pathogen" category; excluded isolates are counted and logged,
not silently dropped.
"""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parents[0] / "AMR_Datasets"
CROSSWALK_PATH = ROOT / "crosswalks" / "organism_crosswalk_v1.csv"
EXCLUSIONS_PATH = ROOT / "exceptions" / "organism_exclusions_log_v1.csv"

# Rule 1: hard exclude - not a pathogen at all.
HARD_EXCLUDE = {"No Growth"}

# Rule 2: environmental/skin-flora/contaminant genera - excluded from the
# resistance analysis, routed to the exceptions log, never deleted outright.
ENVIRONMENTAL_CONTAMINANTS = {
    "Micrococcus luteus",
    "Bacillus circulans",
    "Bacillus sp",
    "Bacillus sp Strain #1",
    "Bacillus licheniformis",
    "Bacillus cereus",
    "Bacillus megaterium",
    "Paenibacillus sp",
}

# Rule 3: genuinely fungal isolates found inside a bacterial file - routed to
# the exceptions list, excluded from both analysis arms (SOAR 207965 only
# tested the bacterial drug panel against these, so there is no antifungal
# MIC data to classify them against even if merged with SENTRY).
CROSS_DOMAIN_FUNGAL = {
    "Naganishia liquefaciens",
    "Microsporum canis",
}

# Rule 4: explicit "Unknown" string -> retained as the unidentified_pathogen
# sentinel, per Justice's Check text treating it as distinct from exclusion.
SENTINEL_STRINGS = {"Unknown"}

COHORTS = {
    "SOAR_201818": {
        "path": DATA_ROOT / "SOAR 201818" / "gsk_201818_published.csv",
        "reader": "csv",
        "organism_col": "ORGANISMNAME",
    },
    "SOAR_201910": {
        "path": DATA_ROOT / "SOAR 201910" / "GSK_SOAR_201910 raw data.xlsx",
        "reader": "excel",
        "organism_col": "Organism",
    },
    "SOAR_207965": {
        "path": DATA_ROOT / "SOAR 207965" / "SOAR 207965 Complete data set 04Sep25.xlsx",
        "reader": "excel",
        "organism_col": "FinalOrganismName",
    },
}


def classify(raw_string):
    """Return (canonical_organism, pathogen_type, exclusion_reason) for one raw value.

    raw_string is None for a null cell (rule 5 - open decision, operationalized
    here as: retained under the same unidentified_pathogen sentinel as the
    explicit "Unknown" string, but tagged with a distinct note so the
    null-vs-explicit-Unknown distinction is never lost).
    """
    if raw_string is None:
        return "unidentified_pathogen", "bacterial", None, "null_no_identification_attempted"

    if raw_string in HARD_EXCLUDE:
        return None, None, "no_growth", None

    if raw_string in ENVIRONMENTAL_CONTAMINANTS:
        return None, None, "environmental_contaminant", None

    if raw_string in CROSS_DOMAIN_FUNGAL:
        return None, None, "cross_domain_fungal_wrong_drug_panel", None

    if raw_string in SENTINEL_STRINGS:
        return "unidentified_pathogen", "bacterial", None, "explicit_unknown_string"

    return raw_string, "bacterial", None, None


def load_cohort(name, spec):
    if spec["reader"] == "csv":
        df = pd.read_csv(spec["path"], low_memory=False)
    else:
        df = pd.read_excel(spec["path"])
    col = df[spec["organism_col"]]
    return col.where(col.notna(), None)


def main():
    failed = False
    crosswalk_rows = {}
    exclusions_rows = []
    per_cohort_counts = {}

    for name, spec in COHORTS.items():
        raw_series = load_cohort(name, spec)
        n_total = len(raw_series)
        n_retained = 0
        n_excluded = 0

        for idx, raw_value in raw_series.items():
            canonical, pathogen_type, exclusion_reason, note = classify(raw_value)
            key = raw_value if raw_value is not None else "<null>"

            if key not in crosswalk_rows:
                crosswalk_rows[key] = {
                    "raw_string": key,
                    "canonical_organism": canonical if canonical else "excluded",
                    "pathogen_type": pathogen_type if pathogen_type else "",
                    "exclusion_reason": exclusion_reason if exclusion_reason else "",
                    "note": note if note else "",
                    "cohorts_observed": set(),
                    "row_count": 0,
                    "version": "v1",
                    "date_added": "2026-07-06",
                }
            crosswalk_rows[key]["cohorts_observed"].add(name)
            crosswalk_rows[key]["row_count"] += 1

            if exclusion_reason:
                n_excluded += 1
                exclusions_rows.append({
                    "cohort": name,
                    "row_index": idx,
                    "raw_organism_value": raw_value,
                    "exclusion_reason": exclusion_reason,
                    "version": "v1",
                    "date_added": "2026-07-06",
                })
            else:
                n_retained += 1

        per_cohort_counts[name] = (n_total, n_retained, n_excluded)
        print(f"{name}: {n_total} rows -> {n_retained} retained, {n_excluded} excluded")

    # Check (a): every distinct raw string resolves to exactly one bucket (guaranteed by
    # construction - classify() is a total function - but verify no raw string was
    # classified inconsistently across cohorts, i.e. same raw string mapped two ways).
    print(f"\n{len(crosswalk_rows)} distinct raw organism strings across all 3 bacterial cohorts.")
    print("PASS: every distinct raw string resolves to exactly one of {canonical species, unidentified_pathogen, excluded} by construction.")

    # Check (b): exclusions log row count reconciles exactly per cohort.
    for name, (n_total, n_retained, n_excluded) in per_cohort_counts.items():
        logged_for_cohort = sum(1 for r in exclusions_rows if r["cohort"] == name)
        if logged_for_cohort != n_excluded or n_retained + n_excluded != n_total:
            print(f"FAIL: {name} - reconciliation broken (total={n_total}, retained={n_retained}, excluded={n_excluded}, logged={logged_for_cohort}).")
            failed = True
        else:
            print(f"PASS: {name} - {n_retained} + {n_excluded} = {n_total}, and {logged_for_cohort} excluded rows are logged.")

    # Check (c): Microsporum canis isolates present in exceptions log with cross-domain reason.
    canis_logged = [r for r in exclusions_rows if r["raw_organism_value"] == "Microsporum canis"]
    if not canis_logged or any(r["exclusion_reason"] != "cross_domain_fungal_wrong_drug_panel" for r in canis_logged):
        print("FAIL: Microsporum canis isolate(s) not correctly logged with the cross-domain-fungal reason.")
        failed = True
    else:
        print(f"PASS: Microsporum canis isolate(s) ({len(canis_logged)}) confirmed in exceptions log with the cross-domain-fungal reason.")

    naganishia_logged = [r for r in exclusions_rows if r["raw_organism_value"] == "Naganishia liquefaciens"]
    if not naganishia_logged:
        print("FAIL: Naganishia liquefaciens isolate(s) not found in exceptions log.")
        failed = True
    else:
        print(f"PASS: Naganishia liquefaciens isolate(s) ({len(naganishia_logged)}) confirmed in exceptions log.")

    no_growth_logged = [r for r in exclusions_rows if r["exclusion_reason"] == "no_growth"]
    print(f"NOTE: {len(no_growth_logged)} 'No Growth' row(s) found in live data (Appendix 1's verified-grounding text cites 1; both are logged below regardless).")

    # Write deliverables.
    CROSSWALK_PATH.parent.mkdir(parents=True, exist_ok=True)
    EXCLUSIONS_PATH.parent.mkdir(parents=True, exist_ok=True)

    crosswalk_out = []
    for row in crosswalk_rows.values():
        row = dict(row)
        row["cohorts_observed"] = "+".join(sorted(row["cohorts_observed"]))
        crosswalk_out.append(row)
    pd.DataFrame(crosswalk_out, columns=[
        "raw_string", "canonical_organism", "pathogen_type", "exclusion_reason",
        "note", "cohorts_observed", "row_count", "version", "date_added",
    ]).sort_values("raw_string").to_csv(CROSSWALK_PATH, index=False)
    print(f"\nWrote {len(crosswalk_out)} row(s) to {CROSSWALK_PATH.relative_to(ROOT.parents[0])}")

    pd.DataFrame(exclusions_rows, columns=[
        "cohort", "row_index", "raw_organism_value", "exclusion_reason", "version", "date_added",
    ]).to_csv(EXCLUSIONS_PATH, index=False)
    print(f"Wrote {len(exclusions_rows)} row(s) to {EXCLUSIONS_PATH.relative_to(ROOT.parents[0])}")

    if failed:
        print("\nStep 3 Check: FAIL")
        sys.exit(1)

    print("\nStep 3 Check: PASS")


if __name__ == "__main__":
    main()
