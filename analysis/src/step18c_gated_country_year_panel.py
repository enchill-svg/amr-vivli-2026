"""
Step 18c - Gated Section 7 deliverable: country-year life-expectancy panel.

Reads the ungated Step 14 country-year external join (life expectancy +
burden per country per year) and attaches the same per-country quality_gate
already computed for the country risk ranking (Step 18b's
gate_country_risk_ranking), joined on iso3_country. No new gating logic is
invented here - this inherits the existing, already-reviewed country-level
gate rather than deriving a second one.

Rows with no real life_expectancy are dropped (no interpolation/fabrication).

Check: no null life_expectancy or quality_gate post-filter; every
iso3_country is covered by the source gate map; row count equals the
pre-filter non-null-life_expectancy row count (no silent drops beyond that).
"""
from __future__ import annotations

import datetime as dt
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
BOUNDS = ROOT / "bounds"
DELIVERABLES = ROOT / "deliverables"

TODAY = dt.date.today().isoformat()
VERSION = "v1"

PANEL_COLUMNS = [
    "pathogen_type",
    "iso3_country",
    "parsed_year",
    "life_expectancy",
    "burden_midpoint_weighted",
    "quality_gate",
    "gate_reason",
    "version",
    "date_added",
]


def build_country_year_panel(pathogen_type: str) -> pd.DataFrame:
    external = pd.read_csv(BOUNDS / f"external_join_{pathogen_type}_country_year_v1.csv")
    gate_map = pd.read_csv(DELIVERABLES / f"country_risk_ranking_{pathogen_type}_gated_v1.csv")[
        ["iso3_country", "quality_gate", "gate_reason"]
    ]

    panel = external[external["life_expectancy"].notna()].copy()
    panel = panel.merge(gate_map, on="iso3_country", how="left")
    panel["quality_gate"] = panel["quality_gate"].fillna("withhold")
    panel["gate_reason"] = panel["gate_reason"].fillna("missing_country_gate")
    panel["version"] = VERSION
    panel["date_added"] = TODAY
    return panel[PANEL_COLUMNS].sort_values(["iso3_country", "parsed_year"])


def main() -> None:
    failed = False
    required = [
        BOUNDS / "external_join_bacterial_country_year_v1.csv",
        BOUNDS / "external_join_fungal_country_year_v1.csv",
        DELIVERABLES / "country_risk_ranking_bacterial_gated_v1.csv",
        DELIVERABLES / "country_risk_ranking_fungal_gated_v1.csv",
    ]
    missing = [p for p in required if not p.exists()]
    if missing:
        for p in missing:
            print(f"FAIL: missing prerequisite {p.relative_to(ROOT)}")
        sys.exit(1)

    panels = {}
    for pathogen_type in ("bacterial", "fungal"):
        external = pd.read_csv(BOUNDS / f"external_join_{pathogen_type}_country_year_v1.csv")
        expected_rows = int(external["life_expectancy"].notna().sum())

        panel = build_country_year_panel(pathogen_type)
        panels[pathogen_type] = panel

        out_path = DELIVERABLES / f"country_year_panel_{pathogen_type}_gated_v1.csv"
        panel.to_csv(out_path, index=False)
        print(f"Wrote {len(panel)} {pathogen_type} country-year row(s) to "
              f"deliverables/{out_path.name}")

        if len(panel) != expected_rows:
            print(
                f"FAIL: {pathogen_type} panel has {len(panel)} row(s), "
                f"expected {expected_rows} (rows with real life_expectancy)."
            )
            failed = True
        else:
            print(f"PASS: {pathogen_type} panel row count matches non-null life_expectancy rows "
                  f"({expected_rows}); no silent drops.")

        if panel["life_expectancy"].isna().any():
            print(f"FAIL: {pathogen_type} panel contains null life_expectancy after filter.")
            failed = True
        else:
            print(f"PASS: {pathogen_type} panel has no null life_expectancy.")

        if panel["quality_gate"].isna().any():
            print(f"FAIL: {pathogen_type} panel contains null quality_gate.")
            failed = True
        else:
            print(f"PASS: {pathogen_type} panel has no null quality_gate.")

        gate_countries = set(
            pd.read_csv(DELIVERABLES / f"country_risk_ranking_{pathogen_type}_gated_v1.csv")["iso3_country"]
        )
        uncovered = set(panel["iso3_country"]) - gate_countries
        if uncovered:
            print(
                f"FAIL: {pathogen_type} panel has iso3_country value(s) not covered by the "
                f"country risk gate map: {uncovered}"
            )
            failed = True
        else:
            print(f"PASS: all {pathogen_type} panel countries are covered by the country risk gate map.")

    if failed:
        print("\nStep 18c Check: FAIL")
        sys.exit(1)
    print("\nStep 18c Check: PASS")


if __name__ == "__main__":
    main()
