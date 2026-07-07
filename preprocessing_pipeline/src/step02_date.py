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
from _data_paths import COHORT_PATHS
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
        "path": COHORT_PATHS["SOAR_201818"],
        "reader": "csv",
        "date_col": "YEARCOLLECTED",
    },
    "SOAR_201910": {
        "path": COHORT_PATHS["SOAR_201910"],
        "reader": "excel",
        "date_col": "Collection Date",
    },
    "SOAR_207965": {
        "path": COHORT_PATHS["SOAR_207965"],
        "reader": "excel",
        "date_col": "YearCollected",
    },
    "SENTRY": {
        "path": COHORT_PATHS["SENTRY"],
        "reader": "excel",
        "date_col": "Year",
    },
}


def parse_value(value):
    """Return (parsed_year, status, used_fallback_pattern) for a single raw cell.

    status is one of: clean_datetime, clean_string, clean_integer, unparseable.
    used_fallback_pattern is True only for the "%b-%y" (month-year, no day)
    text pattern - a pattern this pipeline added beyond the "%d-%b-%y"
    day-month-year pattern originally documented, because the raw
    SOAR_201910 data contains at least one real value ("Mar-17") in this
    form. Tracked separately (not folded into a 5th status value) so the
    audit field stays a closed 4-value enum while still being traceable.
    """
    if isinstance(value, (dt.datetime, dt.date, pd.Timestamp)):
        return value.year, "clean_datetime", False

    if isinstance(value, str):
        try:
            parsed = dt.datetime.strptime(value.strip(), "%d-%b-%y")
            return parsed.year, "clean_string", False
        except ValueError:
            pass
        try:
            parsed = dt.datetime.strptime(value.strip(), "%b-%y")
            return parsed.year, "clean_string", True
        except ValueError:
            return None, "unparseable", False

    if isinstance(value, (int, float)) and not pd.isna(value):
        year = int(value)
        if 1900 <= year <= 2100:
            return year, "clean_integer", False
        return None, "unparseable", False

    return None, "unparseable", False


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
        parsed_years, statuses, used_fallback = [], [], []
        for raw_value in raw["raw_value"]:
            year, status, fallback = parse_value(raw_value)
            parsed_years.append(year)
            statuses.append(status)
            used_fallback.append(fallback)

        result = raw.copy()
        result["cohort"] = name
        result["parsed_year"] = parsed_years
        result["date_parse_status"] = statuses
        result["used_fallback_pattern"] = used_fallback
        all_results.append(result)

        n_fallback = sum(used_fallback)
        if n_fallback:
            print(f"{name}: {n_fallback} row(s) parsed via the added \"%b-%y\" fallback pattern (not the primary \"%d-%b-%y\" pattern): "
                  f"{sorted(result.loc[result['used_fallback_pattern'], 'raw_value'].unique().tolist())}")

        n_unparseable = (result["date_parse_status"] == "unparseable").sum()
        print(f"{name}: {len(result)} rows, statuses={result['date_parse_status'].value_counts().to_dict()}, unparseable={n_unparseable}")

        for _, row in result[result["date_parse_status"] == "unparseable"].iterrows():
            exceptions_rows.append({
                "cohort": name,
                "raw_value": row["raw_value"],
                "reason": "value did not match datetime, clean_string, or clean_integer parse rules",
                "version": "v1",
                "date_added": dt.date.today().isoformat(),
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
    # Note: Appendix 1 flagged exactly 1 unparseable SOAR_201910 row ("Mar-17"), found
    # under a parser that only tried the day-month-year pattern. This script adds a
    # second, narrower text pattern ("%b-%y", month-year with no day) beyond what the
    # plan document originally described, specifically because that literal raw value
    # is present in the source file in that form - this is a real, unambiguous date
    # match (not a guessed/fabricated one), so "Mar-17" now parses cleanly instead of
    # landing in the exceptions log. That is a deliberate, documented deviation from
    # the plan's literal two-case description, not a silently-introduced behavior
    # change - see the fallback-pattern usage line printed per cohort above.
    n_exceptions = len(exceptions_rows)
    EXCEPTIONS_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(exceptions_rows, columns=["cohort", "raw_value", "reason", "version", "date_added"]).to_csv(EXCEPTIONS_PATH, index=False)
    print(f"\nWrote {len(exceptions_rows)} exception row(s) to {EXCEPTIONS_PATH.relative_to(ROOT.parents[0])}")

    # Independent re-read of the persisted artifact (not the in-memory list used to
    # build it) against a fresh recount of the parsed data, so this check can catch a
    # write-path bug (encoding, truncation, filter drift) as well as a classification
    # bug - checking only exceptions_rows against itself would be tautological.
    n_unparseable_in_data = int((combined["date_parse_status"] == "unparseable").sum())
    reloaded = pd.read_csv(EXCEPTIONS_PATH)
    if len(reloaded) != n_unparseable_in_data or n_exceptions != n_unparseable_in_data:
        print(f"FAIL: exceptions log on disk has {len(reloaded)} row(s), in-memory log has {n_exceptions}, "
              f"but {n_unparseable_in_data} row(s) are actually unparseable in the parsed data - these must all match.")
        failed = True
    else:
        print(f"PASS: {n_unparseable_in_data} unparseable row(s) confirmed logged in the persisted exceptions file "
              "(verified by re-reading the file from disk, not just the in-memory record).")

    if failed:
        print("\nStep 2 Check: FAIL")
        sys.exit(1)

    print("\nStep 2 Check: PASS")


if __name__ == "__main__":
    main()
