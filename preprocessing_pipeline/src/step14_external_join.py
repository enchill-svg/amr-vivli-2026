"""
Step 14 - Section 6 Stage 4: External data join.

Issue (Justice's Section 6 idea, plan doc Part 3.4, raw text lines 95-96):
"Merge country-year resistance/susceptibility rates with life expectancy,
antibiotic/antifungal consumption, vaccination coverage (bacteria only), and
health-system indicators, using the ISO3 crosswalk from Step 1."

Burden side (from this project's own Stage 1/2 outputs, not external):
  - country-year pooled static rate + Manski Tier-1 bounds with deduplicated N
    (_section6_aggregates.pool_country_year_descriptive — N is summed once per
    organism-site stratum, never once per drug row)
  - bacterial: CLSI/EUCAST resistance tier; fungal: ECV WT/NWT tier (paired with
    ECV-based Stage 2 distance)
  - country-year mean Evolutionary Fitness Score slope (Stage 2) — same
    trajectory definition as Stage 3 clustering
  - country-year mean median Distance-to-Failure kept as supplemental context

Check: pooled rows satisfy n_event <= n_tested; Manski bounds in [0, 1] with lower <= upper;
n_isolates_in_stratum is deduplicated (not summed per drug row); consumption column entirely null;
fungal vaccination columns null.
"""
import datetime as dt
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _section6_aggregates import (
    pool_country_year_descriptive,
    pool_country_year_distance,
    pool_country_year_fitness_slope,
)
from _section6_external import (
    CONSUMPTION_DATA_AVAILABLE,
    GBD_LRI_INCLUDED,
    SDI_INCLUDED,
    load_health_expenditure_long,
    load_life_expectancy_long,
    load_vaccination_long,
)

BOUNDS_DIR = ROOT / "bounds"
CROSSWALK_DIR = ROOT / "crosswalks"
TODAY = dt.date.today().isoformat()


def build_panel(
  pathogen_type: str,
  descriptive_file: str,
  distance_file: str,
  fitness_file: str,
  p_col: str,
  invert: bool,
  project_iso3: set[str],
  life_exp: pd.DataFrame,
  health: pd.DataFrame,
  vaccination: pd.DataFrame | None,
  weight_col: str = "n_tested",
) -> pd.DataFrame:
  desc = pd.read_csv(BOUNDS_DIR / descriptive_file)
  dist = pd.read_csv(BOUNDS_DIR / distance_file)
  fitness = pd.read_csv(BOUNDS_DIR / fitness_file)
  desc["parsed_year"] = pd.to_numeric(desc["parsed_year"], errors="coerce")
  dist["parsed_year"] = pd.to_numeric(dist["parsed_year"], errors="coerce")

  burden = pool_country_year_descriptive(
    desc, p_col=p_col, weight_col=weight_col, invert=invert
  )
  fitness_cy = pool_country_year_fitness_slope(dist, fitness, pathogen_type)
  distance_cy = pool_country_year_distance(dist)
  panel = burden.merge(fitness_cy, on=["iso3_country", "parsed_year"], how="outer")
  panel = panel.merge(distance_cy, on=["iso3_country", "parsed_year"], how="outer")
  panel = panel[panel["iso3_country"].isin(project_iso3)].copy()

  panel = panel.merge(
    life_exp[["iso3", "parsed_year", "life_expectancy"]],
    left_on=["iso3_country", "parsed_year"],
    right_on=["iso3", "parsed_year"],
    how="left",
  ).drop(columns=["iso3"])
  panel = panel.merge(
    health[["iso3", "parsed_year", "health_expenditure_pct_gdp"]],
    left_on=["iso3_country", "parsed_year"],
    right_on=["iso3", "parsed_year"],
    how="left",
  ).drop(columns=["iso3"])

  if pathogen_type == "bacterial" and vaccination is not None:
    panel = panel.merge(
      vaccination,
      left_on=["iso3_country", "parsed_year"],
      right_on=["iso3", "parsed_year"],
      how="left",
    ).drop(columns=["iso3"])
  else:
    panel["hib3_coverage_pct"] = np.nan
    panel["hib3_coverage_source"] = np.nan
    panel["pcvc_coverage_pct"] = np.nan
    panel["pcvc_coverage_source"] = np.nan

  panel["antimicrobial_consumption_ddd"] = np.nan
  panel["consumption_data_gap"] = "no_numeric_esac_net_series_locally"
  panel["sdi_included"] = SDI_INCLUDED
  panel["gbd_lri_included"] = GBD_LRI_INCLUDED
  panel["consumption_data_available"] = CONSUMPTION_DATA_AVAILABLE
  panel["pathogen_type"] = pathogen_type
  panel["version"] = "v1"
  panel["date_added"] = TODAY
  return panel


def main():
  failed = False
  BOUNDS_DIR.mkdir(parents=True, exist_ok=True)

  project_iso3 = set(pd.read_csv(CROSSWALK_DIR / "country_iso3_crosswalk_v1.csv")["iso3"].astype(str))
  life_exp = load_life_expectancy_long()
  health = load_health_expenditure_long()
  vaccination = load_vaccination_long()

  bact = build_panel(
    "bacterial",
    "descriptive_bacterial_resistance_v1.csv",
    "evolutionary_bacterial_distance_v1.csv",
    "evolutionary_bacterial_fitness_score_v1.csv",
    p_col="n_resistant",
    invert=False,
    project_iso3=project_iso3,
    life_exp=life_exp,
    health=health,
    vaccination=vaccination,
  )
  fung = build_panel(
    "fungal",
    "descriptive_fungal_ecv_wt_rate_v1.csv",
    "evolutionary_fungal_distance_v1.csv",
    "evolutionary_fungal_fitness_score_v1.csv",
    p_col="n_nwt",
    invert=True,
    project_iso3=project_iso3,
    life_exp=life_exp,
    health=health,
    vaccination=None,
    weight_col="n_classified",
  )

  panel_cols = [
    "pathogen_type", "iso3_country", "parsed_year",
    "n_isolates_in_stratum", "n_tested", "n_event",
    "burden_point_estimate", "burden_midpoint_weighted",
    "tier1_bound_lower_pooled", "tier1_bound_upper_pooled",
    "mean_evolutionary_fitness_slope", "n_fitness_cells",
    "mean_median_distance_to_failure", "n_distance_cells",
    "life_expectancy", "health_expenditure_pct_gdp",
    "hib3_coverage_pct", "hib3_coverage_source", "pcvc_coverage_pct", "pcvc_coverage_source",
    "antimicrobial_consumption_ddd", "consumption_data_gap",
    "consumption_data_available", "sdi_included", "gbd_lri_included",
    "version", "date_added",
  ]

  bact[panel_cols].sort_values(["iso3_country", "parsed_year"]).to_csv(
    BOUNDS_DIR / "external_join_bacterial_country_year_v1.csv", index=False
  )
  fung[panel_cols].sort_values(["iso3_country", "parsed_year"]).to_csv(
    BOUNDS_DIR / "external_join_fungal_country_year_v1.csv", index=False
  )
  print(f"Wrote {len(bact)} bacterial country-year row(s) to "
        f"bounds/external_join_bacterial_country_year_v1.csv")
  print(f"Wrote {len(fung)} fungal country-year row(s) to "
        f"bounds/external_join_fungal_country_year_v1.csv")

  for label, panel in [("bacterial", bact), ("fungal", fung)]:
    bad = panel[
      (panel["n_event"] > panel["n_tested"])
      | (panel["tier1_bound_lower_pooled"] > panel["tier1_bound_upper_pooled"])
      | (panel["tier1_bound_lower_pooled"] < 0)
      | (panel["tier1_bound_upper_pooled"] > 1)
    ]
    if len(bad):
      print(f"FAIL: {len(bad)} {label} country-year row(s) violate pooled burden/bound checks.")
      failed = True
    else:
      print(f"PASS: all {len(panel)} {label} country-year rows satisfy n_event <= n_tested "
            f"and valid Manski bounds.")

  tur2018 = bact[(bact["iso3_country"] == "TUR") & (bact["parsed_year"] == 2018)]
  if len(tur2018) == 1:
    n_iso = int(tur2018["n_isolates_in_stratum"].iloc[0])
    if n_iso == 16:
      print("PASS: Turkey 2018 n_isolates_in_stratum = 16 (deduplicated, not drug-inflated).")
    else:
      print(f"FAIL: Turkey 2018 n_isolates_in_stratum = {n_iso}, expected 16.")
      failed = True

  bad_iso3 = set(bact["iso3_country"]) | set(fung["iso3_country"])
  if not bad_iso3.issubset(project_iso3):
    print(f"FAIL: panel contains ISO3 codes outside project crosswalk: {bad_iso3 - project_iso3}")
    failed = True
  else:
    print(f"PASS: all {len(bad_iso3)} ISO3 codes in join panels appear in country_iso3_crosswalk_v1.csv")

  if bact["antimicrobial_consumption_ddd"].notna().any() or fung["antimicrobial_consumption_ddd"].notna().any():
    print("FAIL: antimicrobial_consumption_ddd should be entirely null — no source data.")
    failed = True
  else:
    print("PASS: antimicrobial_consumption_ddd is null throughout (documented gap, not fabricated).")

  if fung["hib3_coverage_pct"].notna().any() or fung["pcvc_coverage_pct"].notna().any():
    print("FAIL: fungal panel must not carry vaccination values (bacteria-only per Justice).")
    failed = True
  else:
    print("PASS: fungal panel leaves vaccination columns null by design.")

  if failed:
    print("\nStep 14 Check: FAIL")
    sys.exit(1)
  print("\nStep 14 Check: PASS")


if __name__ == "__main__":
  main()
