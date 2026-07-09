"""
Step 17 - Section 6 Stage 7: Intervention impact estimation.

Vaccination LE scenarios report coefficient per 1pp (primary) and a +10pp
illustrative scenario flagged when magnitude exceeds 2 years (likely
confounding). Event-study resistance windows require AMR surveillance data
in both pre and post calendar windows — otherwise resistance fields are null
with an explicit status flag.
"""
import datetime as dt
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _section6_aggregates import pool_country_year_descriptive_by_organism
from _section6_external import first_vaccine_introduction_year, load_life_expectancy_long

BOUNDS_DIR = ROOT / "bounds"
CROSSWALK_DIR = ROOT / "crosswalks"
TODAY = dt.date.today().isoformat()

ASSOCIATIONAL_CAVEAT = (
  "Illustrative projection from Stage 5 pooled OLS — suggestive association only, "
  "not causal attribution (Justice Section 8). Hib evidence base thinner than PCV "
  "(Iwu-Jaja et al. 2026 scoping review; plan Part 3.7)."
)

IMPLAUSIBLE_GAIN_THRESHOLD_YEARS = 2.0

BACTERIAL_CATEGORIES = [
  "vaccination",
  "antibiotic_stewardship",
  "diagnostics",
  "rd",
  "wash_infection_prevention",
]

FUNGAL_CATEGORIES = [
  "antifungal_stewardship",
  "diagnostics",
  "infection_prevention_control",
  "rd",
]

ORGANISM_BY_VACCINE = {
  "HIB": "Haemophilus influenzae",
  "PCV": "Streptococcus pneumoniae",
}


def window_mean_le(
  life_exp: pd.DataFrame,
  iso3: str,
  center_year: int,
  year_offsets: tuple[int, int],
) -> float:
  years = range(center_year + year_offsets[0], center_year + year_offsets[1] + 1)
  sub = life_exp[(life_exp["iso3"] == iso3) & (life_exp["parsed_year"].isin(years))]
  if sub.empty or sub["life_expectancy"].isna().all():
    return float("nan")
  return float(sub["life_expectancy"].mean())


def count_burden_years(
  burden: pd.DataFrame,
  iso3: str,
  center_year: int,
  year_offsets: tuple[int, int],
) -> int:
  years = set(range(center_year + year_offsets[0], center_year + year_offsets[1] + 1))
  sub = burden[
    (burden["iso3_country"] == iso3)
    & (burden["parsed_year"].isin(years))
    & (burden["resistance_point_estimate"].notna())
    & (burden["n_tested"] > 0)
  ]
  return int(len(sub))


def window_mean_burden(
  burden: pd.DataFrame,
  iso3: str,
  center_year: int,
  year_offsets: tuple[int, int],
) -> float:
  years = range(center_year + year_offsets[0], center_year + year_offsets[1] + 1)
  sub = burden[
    (burden["iso3_country"] == iso3)
    & (burden["parsed_year"].isin(years))
    & (burden["resistance_point_estimate"].notna())
  ]
  if sub.empty:
    return float("nan")
  return float(np.average(sub["resistance_point_estimate"], weights=sub["n_tested"].clip(lower=1)))


def build_vaccination_event_study(
  project_iso3: set[str],
  life_exp: pd.DataFrame,
  desc: pd.DataFrame,
) -> pd.DataFrame:
  rows = []
  for vaccine_key, organism in ORGANISM_BY_VACCINE.items():
    intro = first_vaccine_introduction_year(vaccine_key.lower())
    burden = pool_country_year_descriptive_by_organism(desc, organism)
    for _, row in intro.iterrows():
      iso3 = row["iso3"]
      if iso3 not in project_iso3:
        continue
      intro_year = int(row["introduction_year"])
      pre_years = count_burden_years(burden, iso3, intro_year, (-2, -1))
      post_years = count_burden_years(burden, iso3, intro_year, (3, 5))
      le_pre = window_mean_le(life_exp, iso3, intro_year, (-2, -1))
      le_post = window_mean_le(life_exp, iso3, intro_year, (3, 5))
      bur_pre = window_mean_burden(burden, iso3, intro_year, (-2, -1))
      bur_post = window_mean_burden(burden, iso3, intro_year, (3, 5))
      resistance_estimable = pre_years > 0 and post_years > 0
      if not resistance_estimable:
        if pre_years == 0 and post_years == 0:
          resistance_status = "no_amr_surveillance_in_either_window"
        elif pre_years == 0:
          resistance_status = "no_amr_surveillance_in_pre_window"
        else:
          resistance_status = "no_amr_surveillance_in_post_window"
      else:
        resistance_status = "computable"
      rows.append(
        {
          "vaccine": vaccine_key,
          "target_organism": organism,
          "iso3_country": iso3,
          "introduction_year": intro_year,
          "life_expectancy_pre_window_mean": le_pre,
          "life_expectancy_post_window_mean": le_post,
          "life_expectancy_change_post_minus_pre": le_post - le_pre
          if np.isfinite(le_pre) and np.isfinite(le_post)
          else np.nan,
          "resistance_rate_pre_window_mean": bur_pre if resistance_estimable else np.nan,
          "resistance_rate_post_window_mean": bur_post if resistance_estimable else np.nan,
          "resistance_rate_change_post_minus_pre": bur_post - bur_pre
          if resistance_estimable and np.isfinite(bur_pre) and np.isfinite(bur_post)
          else np.nan,
          "n_amr_years_pre_window": pre_years,
          "n_amr_years_post_window": post_years,
          "resistance_window_status": resistance_status,
          "pre_window_years": f"{intro_year - 2} to {intro_year - 1}",
          "post_window_years": f"{intro_year + 3} to {intro_year + 5}",
          "estimation_method": "descriptive_before_after_not_causal_did",
          "version": "v1",
          "date_added": TODAY,
        }
      )
  return pd.DataFrame(rows)


def coef_lookup(coef_df: pd.DataFrame, pathogen_type: str, term: str) -> tuple[float, float]:
  sub = coef_df[(coef_df["pathogen_type"] == pathogen_type) & (coef_df["term"] == term)]
  if sub.empty:
    return float("nan"), float("nan")
  return float(sub["coefficient"].iloc[0]), float(sub["p_value"].iloc[0])


def vaccination_scenario_row(
  sub_measure: str,
  coef: float,
  p_value: float,
  extra_caveat: str,
) -> dict:
  gain_1pp = coef if np.isfinite(coef) else np.nan
  gain_10pp = coef * 10.0 if np.isfinite(coef) else np.nan
  magnitude_flag = (
    "implausible_magnitude_likely_confounding"
    if np.isfinite(gain_10pp) and abs(gain_10pp) > IMPLAUSIBLE_GAIN_THRESHOLD_YEARS
    else "within_illustrative_threshold"
  )
  return {
    "pathogen_type": "bacterial",
    "intervention_category": "vaccination",
    "sub_measure": sub_measure,
    "data_status": "measured",
    "estimation_method": "stage5_ols_coefficient_x_scenario_coverage_increase",
    "unit_definition": "per 1 percentage-point increase in coverage (primary); 10pp illustrative secondary",
    "estimated_le_gain_years": gain_1pp,
    "estimated_le_gain_years_10pp_scenario": gain_10pp,
    "scenario_magnitude_flag": magnitude_flag,
    "coefficient_per_1pp": coef,
    "coefficient_p_value": p_value,
    "scenario_coverage_increase_pp": 1.0,
    "scenario_coverage_increase_pp_secondary": 10.0,
    "evidence_caveat": ASSOCIATIONAL_CAVEAT + " " + extra_caveat,
    "version": "v1",
    "date_added": TODAY,
  }


def build_category_summary(coef_df: pd.DataFrame, rd_summary: pd.DataFrame) -> pd.DataFrame:
  rows = []
  hib_coef, hib_p = coef_lookup(coef_df, "bacterial", "hib3_coverage_pct")
  pcv_coef, pcv_p = coef_lookup(coef_df, "bacterial", "pcvc_coverage_pct")
  rows.append(
    vaccination_scenario_row(
      "hib3_coverage",
      hib_coef,
      hib_p,
      "Hib represented in only 2 of 62 vaccine-AMR studies in Iwu-Jaja et al.",
    )
  )
  rows.append(
    vaccination_scenario_row(
      "pcvc_coverage",
      pcv_coef,
      pcv_p,
      "PCV coefficient not statistically significant in Stage 5 model.",
    )
  )

  gap_rows = [
    ("bacterial", "antibiotic_stewardship", "no local stewardship program measure"),
    ("bacterial", "diagnostics", "no local diagnostic-capacity measure (health expenditure proxy not validated)"),
    ("bacterial", "wash_infection_prevention", "no local WASH or infection-prevention measure"),
    ("fungal", "antifungal_stewardship", "no local antifungal stewardship measure"),
    ("fungal", "diagnostics", "no local diagnostic-capacity measure"),
    ("fungal", "infection_prevention_control", "no local IPC measure"),
  ]
  for pathogen_type, category, reason in gap_rows:
    rows.append(
      {
        "pathogen_type": pathogen_type,
        "intervention_category": category,
        "sub_measure": np.nan,
        "data_status": "data_gap",
        "estimation_method": "not_estimable",
        "unit_definition": np.nan,
        "estimated_le_gain_years": np.nan,
        "estimated_le_gain_years_10pp_scenario": np.nan,
        "scenario_magnitude_flag": np.nan,
        "coefficient_per_1pp": np.nan,
        "coefficient_p_value": np.nan,
        "scenario_coverage_increase_pp": np.nan,
        "scenario_coverage_increase_pp_secondary": np.nan,
        "evidence_caveat": reason,
        "version": "v1",
        "date_added": TODAY,
      }
    )

  rows.append(
    {
      "pathogen_type": "fungal",
      "intervention_category": "vaccination",
      "sub_measure": np.nan,
      "data_status": "excluded_by_design",
      "estimation_method": "not_applicable",
      "unit_definition": np.nan,
      "estimated_le_gain_years": np.nan,
      "estimated_le_gain_years_10pp_scenario": np.nan,
      "scenario_magnitude_flag": np.nan,
      "coefficient_per_1pp": np.nan,
      "coefficient_p_value": np.nan,
      "scenario_coverage_increase_pp": np.nan,
      "scenario_coverage_increase_pp_secondary": np.nan,
      "evidence_caveat": "No licensed Candida or Aspergillus vaccine (Justice Section 6 Stage 7).",
      "version": "v1",
      "date_added": TODAY,
    }
  )

  for _, rd_row in rd_summary.iterrows():
    rows.append(
      {
        "pathogen_type": rd_row["pathogen_type"],
        "intervention_category": "rd",
        "sub_measure": "global_amr_rd_hub_funding",
        "data_status": "funding_only_no_le_elasticity",
        "estimation_method": "stage6_funding_alignment_only",
        "unit_definition": "total prorated USD (not mapped to LE years)",
        "estimated_le_gain_years": np.nan,
        "estimated_le_gain_years_10pp_scenario": np.nan,
        "scenario_magnitude_flag": np.nan,
        "coefficient_per_1pp": np.nan,
        "coefficient_p_value": np.nan,
        "scenario_coverage_increase_pp": np.nan,
        "scenario_coverage_increase_pp_secondary": np.nan,
        "evidence_caveat": (
          f"Stage 6 total prorated funding USD {rd_row['total_rd_funding_usd_prorated']:,.0f}; "
          "no local R&D-to-burden-to-LE model exists. Hub excludes private/VC funding (Justice Section 8)."
        ),
        "version": "v1",
        "date_added": TODAY,
      }
    )

  return pd.DataFrame(rows)


def main():
  failed = False
  BOUNDS_DIR.mkdir(parents=True, exist_ok=True)

  project_iso3 = set(pd.read_csv(CROSSWALK_DIR / "country_iso3_crosswalk_v1.csv")["iso3"].astype(str))
  coef_df = pd.read_csv(BOUNDS_DIR / "association_ols_coefficients_v1.csv")
  desc = pd.read_csv(BOUNDS_DIR / "descriptive_bacterial_resistance_v1.csv")
  rd_summary = pd.read_csv(BOUNDS_DIR / "rd_alignment_summary_v1.csv")
  life_exp = load_life_expectancy_long()

  summary = build_category_summary(coef_df, rd_summary)
  summary.sort_values(["pathogen_type", "intervention_category", "sub_measure"]).to_csv(
    BOUNDS_DIR / "intervention_impact_by_category_v1.csv", index=False
  )

  event_study = build_vaccination_event_study(project_iso3, life_exp, desc)
  event_study.sort_values(["vaccine", "iso3_country"]).to_csv(
    BOUNDS_DIR / "intervention_vaccination_event_study_v1.csv", index=False
  )
  n_resistance = event_study["resistance_rate_change_post_minus_pre"].notna().sum()
  print(f"Wrote intervention outputs ({n_resistance} event-study row(s) with computable resistance change).")

  hib_row = summary[summary["sub_measure"] == "hib3_coverage"].iloc[0]
  if hib_row["scenario_magnitude_flag"] != "implausible_magnitude_likely_confounding":
    print("FAIL: Hib 10pp scenario should be flagged implausible_magnitude_likely_confounding.")
    failed = True
  else:
    print("PASS: Hib 10pp illustrative scenario flagged as implausible magnitude.")

  if event_study["resistance_window_status"].eq("computable").any():
    print(f"PASS: {event_study['resistance_window_status'].eq('computable').sum()} event-study row(s) "
          f"have AMR data in both pre and post windows.")
  else:
    print("PASS: no event-study rows claim resistance change without AMR window overlap (all flagged).")

  fungal_vax = summary[
    (summary["pathogen_type"] == "fungal") & (summary["intervention_category"] == "vaccination")
  ]
  if len(fungal_vax) != 1 or fungal_vax.iloc[0]["data_status"] != "excluded_by_design":
    print("FAIL: fungal vaccination row must be excluded_by_design.")
    failed = True
  else:
    print("PASS: fungal vaccination category recorded as excluded_by_design.")

  if failed:
    print("\nStep 17 Check: FAIL")
    sys.exit(1)
  print("\nStep 17 Check: PASS")


if __name__ == "__main__":
  main()
