"""
Step 1 - Country-name harmonization.

Issue (Justice's Section 5): raw country strings vary across the four cohorts
(e.g. "Slovak Republic" vs "Slovakia") and are not on a common code.

Action: apply the reviewed crosswalk (crosswalks/country_iso3_crosswalk_v1.csv,
built from docs/appendix_2_country_iso3_crosswalk.md Section 2) to every raw
country string in all four cohorts, producing an ISO3 code per row.

Check: every distinct raw string resolves to exactly one ISO3 code; no raw
string is left unmapped; any string that maps to a code shared with another
string (a "collision") is one of the two known, reviewed collisions and no
other.
"""
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
from _data_paths import COHORT_PATHS
CROSSWALK_PATH = ROOT / "crosswalks" / "country_iso3_crosswalk_v1.csv"

COHORTS = {
    "SOAR_201818": {
        "path": COHORT_PATHS["SOAR_201818"],
        "reader": "csv",
        "country_col": "COUNTRY",
    },
    "SOAR_201910": {
        "path": COHORT_PATHS["SOAR_201910"],
        "reader": "excel",
        "country_col": "Country",
    },
    "SOAR_207965": {
        "path": COHORT_PATHS["SOAR_207965"],
        "reader": "excel",
        "country_col": "Country",
    },
    "SENTRY": {
        "path": COHORT_PATHS["SENTRY"],
        "reader": "excel",
        "country_col": "Country",
    },
}

KNOWN_COLLISIONS = {
    "SVK": {"Slovak Republic", "Slovakia"},
    "GBR": {"UK", "Scotland"},
}


def load_cohort(name, spec):
    if spec["reader"] == "csv":
        df = pd.read_csv(spec["path"], low_memory=False)
    else:
        df = pd.read_excel(spec["path"])
    return df[spec["country_col"]]


def main():
    crosswalk = pd.read_csv(CROSSWALK_PATH)
    if crosswalk["raw_string"].duplicated().any():
        dupes = crosswalk.loc[crosswalk["raw_string"].duplicated(keep=False), "raw_string"].unique()
        print(f"FAIL: raw_string appears more than once in crosswalk: {list(dupes)}")
        sys.exit(1)

    crosswalk_map = dict(zip(crosswalk["raw_string"], crosswalk["iso3"]))

    per_cohort_strings = {}
    for name, spec in COHORTS.items():
        series = load_cohort(name, spec)
        distinct = set(series.dropna().unique())
        per_cohort_strings[name] = distinct
        print(f"{name}: {len(distinct)} distinct raw country strings")

    all_raw_strings = set().union(*per_cohort_strings.values())
    crosswalk_strings = set(crosswalk["raw_string"])

    unmapped = all_raw_strings - crosswalk_strings
    unused = crosswalk_strings - all_raw_strings

    print(f"\nTotal distinct raw strings across all 4 cohorts: {len(all_raw_strings)}")
    print(f"Crosswalk rows: {len(crosswalk_strings)}")

    failed = False

    if unmapped:
        print(f"FAIL: {len(unmapped)} raw string(s) found in raw data but missing from crosswalk: {sorted(unmapped)}")
        failed = True
    else:
        print("PASS: every raw string observed in the 4 cohorts has a crosswalk row.")

    if unused:
        print(f"NOTE: {len(unused)} crosswalk row(s) not observed in this session's load (expected for SENTRY_INFERRED rows not independently re-verified): {sorted(unused)}")

    code_to_strings = {}
    for raw, iso3 in crosswalk_map.items():
        code_to_strings.setdefault(iso3, set()).add(raw)

    collisions = {code: strs for code, strs in code_to_strings.items() if len(strs) > 1}
    unexpected_collisions = {
        code: strs for code, strs in collisions.items()
        if code not in KNOWN_COLLISIONS or strs != KNOWN_COLLISIONS[code]
    }

    if unexpected_collisions:
        print(f"FAIL: unexpected collision(s) not matching the two reviewed cases: {unexpected_collisions}")
        failed = True
    else:
        print(f"PASS: only the {len(KNOWN_COLLISIONS)} reviewed collisions found ({collisions}).")

    # Both known collisions must actually be PRESENT, not merely "no unexpected ones
    # found" - a typo'd ISO3 on one of the two collision rows would silently vanish
    # from `collisions` above (each string would land in its own singleton bucket)
    # and the check above would still print PASS.
    missing_collisions = {code: strs for code, strs in KNOWN_COLLISIONS.items() if collisions.get(code) != strs}
    if missing_collisions:
        print(f"FAIL: expected collision(s) not found in the crosswalk (a row may have been mis-coded): {missing_collisions}")
        failed = True
    else:
        print(f"PASS: both reviewed collisions ({list(KNOWN_COLLISIONS)}) are present exactly as expected.")

    # Distinct ISO3 code count must be exactly 57 (59 raw strings minus the 2
    # many-to-one collisions), per Appendix 2 Check (c).
    n_distinct_iso3 = len(code_to_strings)
    if n_distinct_iso3 != 57:
        print(f"FAIL: expected exactly 57 distinct ISO3 codes (59 raw strings - 2 collisions), found {n_distinct_iso3}.")
        failed = True
    else:
        print(f"PASS: exactly 57 distinct ISO3 codes across {len(crosswalk_strings)} raw strings, matching Appendix 2 Check (c).")

    # Confidence/note discipline, per Appendix 2 Check (b): exactly the 4 named rows
    # (Hong Kong, Korea, Scotland, Taiwan) are non-"high" confidence, and every
    # non-"high" row carries a populated reason; every other row is "high" with no
    # reason required.
    EXPECTED_FLAGGED = {"Hong Kong", "Korea", "Scotland", "Taiwan"}
    flagged_rows = crosswalk[crosswalk["confidence"] != "high"]
    actual_flagged = set(flagged_rows["raw_string"])
    unnoted_flagged = flagged_rows[flagged_rows["note"].isna() | (flagged_rows["note"].astype(str).str.strip() == "")]
    if actual_flagged != EXPECTED_FLAGGED or len(unnoted_flagged):
        print(f"FAIL: expected exactly {EXPECTED_FLAGGED} to be flagged with a populated note; "
              f"found {actual_flagged} flagged, {len(unnoted_flagged)} missing a note.")
        failed = True
    else:
        print(f"PASS: exactly the 4 expected rows ({sorted(actual_flagged)}) are flagged, each with a populated note; "
              f"remaining {len(crosswalk) - len(flagged_rows)} rows are 'high' confidence.")

    if failed:
        print("\nStep 1 Check: FAIL")
        sys.exit(1)

    print("\nStep 1 Check: PASS")


if __name__ == "__main__":
    main()
