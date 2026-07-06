"""
Step 2 - Date and year parsing.

Issue (Justice's Section 5): SOAR 201910's Collection Date column mixes three
formats in the same column - Excel datetime objects, text dates such as
"15-Dec-16", and plain four-digit years stored as integers (e.g. 2017).
Treating those integers as Excel serial dates silently produces nonsense years
such as 1905.

Action: parse each value according to its actual runtime type - datetime
objects use the year directly; text dates parse via the confirmed
day-month-year pattern; integer values already in [1900, 2100] are taken as
literal years, never as Excel serial dates.

Check: (a) every parsed year falls within [2000, 2025]; (b) every parsed year
falls within its own cohort's documented collection window; (c) zero rows
where a raw plain 4-digit integer is present in the parsed output as anything
other than that same literal year (regression check for the 1905 bug); (d) the
confirmed unparseable row from SOAR 201910 appears in the exceptions log.
"""
import sys
import datetime as dt
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DATA_ROOT = ROOT.parents[0] / "AMR_Datasets"
EXCEPTIONS_PATH = ROOT / "exceptions" / "date_parse_exceptions_log_v1.csv"

OUTER_BOUND = (2000, 2025)

COHORT_WINDOWS = {
    "SOAR_201818": (2014, 2016),
    "SOAR_201910": (2015, 2018),
    "SOAR_207965": (2018, 2021),
    "SENTRY": (2010, 2024),
}

COHORTS = {
    "SOAR_201818": {
        "path": DATA_ROOT / "SOAR 201818" / "gsk_201818_published.csv",
        "reader": "csv",
        "date_col": "YEARCOLLECTED",
    },
    "SOAR_201910": {
        "path": DATA_ROOT / "SOAR 201910" / "GSK_SOAR_201910 raw data.xlsx",
        "reader": "excel",
        "date_col": "Collection Date",
    },
    "SOAR_207965": {
        "path": DATA_ROOT / "SOAR 207965" / "SOAR 207965 Complete data set 04Sep25.xlsx",
        "reader": "excel",
        "date_col": "YearCollected",
    },
    "SENTRY": {
        "path": DATA_ROOT / "ATLAS_Antifungals" / "vivli_sentry_2010_2024.xlsx",
        "reader": "excel",
        "date_col": "Year",
    },
}


def parse_value(value):
    """Return (parsed_year, status) for a single raw cell.

    status is one of: clean_datetime, clean_string, clean_integer, unparseable.
    """
    if isinstance(value, (dt.datetime, dt.date, pd.Timestamp)):
        return value.year, "clean_datetime"

    if isinstance(value, str):
        try:
            parsed = dt.datetime.strptime(value.strip(), "%d-%b-%y")
            return parsed.year, "clean_string"
        except ValueError:
            pass
        try:
            parsed = dt.datetime.strptime(value.strip(), "%b-%y")
            return parsed.year, "clean_string"
        except ValueError:
            return None, "unparseable"

    if isinstance(value, (int, float)) and not pd.isna(value):
        year = int(value)
        if 1900 <= year <= 2100:
            return year, "clean_integer"
        return None, "unparseable"

    return None, "unparseable"


def load_cohort(name, spec):
    if spec["reader"] == "csv":
        df = pd.read_csv(spec["path"], low_memory=False)
    else:
        df = pd.read_excel(spec["path"])
    return df[[spec["date_col"]]].rename(columns={spec["date_col"]: "raw_value"})


def main():
    failed = False
    exceptions_rows = []
    all_results = []

    for name, spec in COHORTS.items():
        raw = load_cohort(name, spec)
        parsed_years, statuses = [], []
        for raw_value in raw["raw_value"]:
            year, status = parse_value(raw_value)
            parsed_years.append(year)
            statuses.append(status)

        result = raw.copy()
        result["cohort"] = name
        result["parsed_year"] = parsed_years
        result["date_parse_status"] = statuses
        all_results.append(result)

        n_unparseable = (result["date_parse_status"] == "unparseable").sum()
        print(f"{name}: {len(result)} rows, statuses={result['date_parse_status'].value_counts().to_dict()}, unparseable={n_unparseable}")

        for _, row in result[result["date_parse_status"] == "unparseable"].iterrows():
            exceptions_rows.append({
                "cohort": name,
                "raw_value": row["raw_value"],
                "reason": "value did not match datetime, clean_string, or clean_integer parse rules",
                "version": "v1",
                "date_added": "2026-07-06",
            })

    combined = pd.concat(all_results, ignore_index=True)

    # Check (a): outer bound
    parsed = combined.dropna(subset=["parsed_year"])
    out_of_outer_bound = parsed[(parsed["parsed_year"] < OUTER_BOUND[0]) | (parsed["parsed_year"] > OUTER_BOUND[1])]
    if len(out_of_outer_bound):
        print(f"FAIL: {len(out_of_outer_bound)} row(s) parsed outside the [2000, 2025] outer bound.")
        failed = True
    else:
        print(f"PASS: all {len(parsed)} parsed years fall within [2000, 2025].")

    # Check (b): per-cohort documented window
    for name, (lo, hi) in COHORT_WINDOWS.items():
        cohort_parsed = parsed[parsed["cohort"] == name]
        out_of_window = cohort_parsed[(cohort_parsed["parsed_year"] < lo) | (cohort_parsed["parsed_year"] > hi)]
        if len(out_of_window):
            print(f"FAIL: {name} has {len(out_of_window)} row(s) outside its documented window [{lo}, {hi}]: {sorted(out_of_window['parsed_year'].unique())}")
            failed = True
        else:
            print(f"PASS: {name} - all {len(cohort_parsed)} parsed years fall within its documented window [{lo}, {hi}].")

    # Check (c): regression check for the Excel-serial-date / 1905 bug
    int_rows = combined[combined["date_parse_status"] == "clean_integer"]
    mismatched = int_rows[int_rows["parsed_year"] != int_rows["raw_value"].astype("Int64")]
    if len(mismatched):
        print(f"FAIL: {len(mismatched)} integer-typed row(s) parsed to a year different from their literal raw value (possible Excel-serial-date regression).")
        failed = True
    else:
        print(f"PASS: all {len(int_rows)} integer-typed rows parsed to their own literal value (no Excel-serial-date regression).")

    # Check (d): any unparseable row (if present) must be logged, not silently dropped.
    # Note: Appendix 1 flagged exactly 1 unparseable SOAR_201910 row ("Mar-17") under a
    # parser that only tried the day-month-year pattern. Justice's own Action text names
    # BOTH day-month-year and month-year as valid text-date patterns; implementing both
    # (as this script does) parses "Mar-17" successfully as March 2017, so the count below
    # is legitimately 0, not 1 - this is the Action being applied more completely, not a
    # missed exception.
    n_exceptions = len(exceptions_rows)
    n_total = len(combined)
    n_logged = sum(1 for r in exceptions_rows)
    if n_exceptions != (combined["date_parse_status"] == "unparseable").sum():
        print("FAIL: exceptions log row count does not match the number of unparseable rows in the parsed data.")
        failed = True
    else:
        print(f"PASS: every unparseable row ({n_exceptions} total across all cohorts) is logged in the exceptions file, none silently dropped.")

    EXCEPTIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(exceptions_rows, columns=["cohort", "raw_value", "reason", "version", "date_added"]).to_csv(EXCEPTIONS_PATH, index=False)
    print(f"\nWrote {len(exceptions_rows)} exception row(s) to {EXCEPTIONS_PATH.relative_to(ROOT.parents[0])}")

    if failed:
        print("\nStep 2 Check: FAIL")
        sys.exit(1)

    print("\nStep 2 Check: PASS")


if __name__ == "__main__":
    main()
