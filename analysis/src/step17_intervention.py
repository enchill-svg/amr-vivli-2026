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
  "not causal attribution (brief Section 8). Hib evidence base thinner than PCV "
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
  model_sample_warning: str = "",
) -> dict:
  has_coefficient = np.isfinite(coef)
  gain_1pp = coef if has_coefficient else np.nan
  gain_10pp = coef * 10.0 if has_coefficient else np.nan
  if not has_coefficient:
    # coef_lookup() found no matching Stage 5 term (e.g. the OLS fell back
    # to its insufficient-complete-cases branch) - this is a genuine data
    # gap, not a measured-but-small-magnitude result. Must not be labelled
    # "measured" / "within_illustrative_threshold": those labels let a
    # missing coefficient sail through gate_intervention_recommendations'
    # quality_gate (which defaults every row to "pass" and only withholds
    # rows whose data_status is explicitly gap-like) with quality_gate=pass
    # despite carrying no real estimate.
    magnitude_flag = "not_applicable_no_coefficient"
  elif abs(gain_10pp) > IMPLAUSIBLE_GAIN_THRESHOLD_YEARS:
    magnitude_flag = "implausible_magnitude_likely_confounding"
  else:
    magnitude_flag = "within_illustrative_threshold"
  caveat = ASSOCIATIONAL_CAVEAT + " " + extra_caveat + (
    "" if has_coefficient else " No Stage 5 coefficient available for this term."
  )
  if model_sample_warning:
    # The coefficient itself can look clean (small magnitude, high p-value)
    # while still coming from an overfit regression (Stage 5 primary spec:
    # n=16 against 10 parameters, R^2>0.99 - see fit_ols() in
    # step15_association.py). A future data update could make this
    # coefficient significant without the sample-size problem going away, so
    # this warning must travel with the estimate itself, not rely on the
    # current p-value staying non-significant.
    caveat += f" Stage 5 model reliability warning: {model_sample_warning}."
  return {
    "pathogen_type": "bacterial",
    "intervention_category": "vaccination",
    "sub_measure": sub_measure,
    "data_status": "measured" if has_coefficient else "data_gap",
    "estimation_method": (
      "stage5_ols_coefficient_x_scenario_coverage_increase" if has_coefficient
      else "not_estimable"
    ),
    "unit_definition": "per 1 percentage-point increase in coverage (primary); 10pp illustrative secondary",
    "estimated_le_gain_years": gain_1pp,
    "estimated_le_gain_years_10pp_scenario": gain_10pp,
    "scenario_magnitude_flag": magnitude_flag,
    "coefficient_per_1pp": coef,
    "coefficient_p_value": p_value,
    "scenario_coverage_increase_pp": 1.0,
    "scenario_coverage_increase_pp_secondary": 10.0,
    "evidence_caveat": caveat,
    "model_sample_warning": model_sample_warning,
    "version": "v1",
    "date_added": TODAY,
  }


def build_category_summary(
  coef_df: pd.DataFrame, rd_summary: pd.DataFrame, meta_df: pd.DataFrame
) -> pd.DataFrame:
  rows = []
  hib_coef, hib_p = coef_lookup(coef_df, "bacterial", "hib3_coverage_pct")
  pcv_coef, pcv_p = coef_lookup(coef_df, "bacterial", "pcvc_coverage_pct")
  bact_meta = meta_df[meta_df["pathogen_type"] == "bacterial"]
  bact_sample_warning = (
    str(bact_meta["sample_warning"].iloc[0])
    if len(bact_meta) and pd.notna(bact_meta["sample_warning"].iloc[0])
    else ""
  )
  rows.append(
    vaccination_scenario_row(
      "hib3_coverage",
      hib_coef,
      hib_p,
      "Hib represented in only 2 of 62 vaccine-AMR studies in Iwu-Jaja et al.",
      bact_sample_warning,
    )
  )
  rows.append(
    vaccination_scenario_row(
      "pcvc_coverage",
      pcv_coef,
      pcv_p,
      "PCV coefficient not statistically significant in Stage 5 model.",
      bact_sample_warning,
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
        "model_sample_warning": "",
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
      "evidence_caveat": "No licensed Candida or Aspergillus vaccine (brief Section 6 Stage 7).",
      "model_sample_warning": "",
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
          "no local R&D-to-burden-to-LE model exists. Hub excludes private/VC funding (brief Section 8)."
        ),
        "model_sample_warning": "",
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
  meta_df = pd.read_csv(BOUNDS_DIR / "association_model_metadata_v1.csv")
  desc = pd.read_csv(BOUNDS_DIR / "descriptive_bacterial_resistance_v1.csv")
  rd_summary = pd.read_csv(BOUNDS_DIR / "rd_alignment_summary_v1.csv")
  life_exp = load_life_expectancy_long()

  summary = build_category_summary(coef_df, rd_summary, meta_df)
  summary.sort_values(["pathogen_type", "intervention_category", "sub_measure"]).to_csv(
    BOUNDS_DIR / "intervention_impact_by_category_v1.csv", index=False
  )

  event_study = build_vaccination_event_study(project_iso3, life_exp, desc)
  event_study.sort_values(["vaccine", "iso3_country"]).to_csv(
    BOUNDS_DIR / "intervention_vaccination_event_study_v1.csv", index=False
  )
  n_resistance = event_study["resistance_rate_change_post_minus_pre"].notna().sum()
  n_event_study = len(event_study)
  print(f"Wrote intervention outputs ({n_resistance} event-study row(s) with computable resistance change).")
  if n_resistance == 0 and n_event_study:
    # Every row is still written (life_expectancy_change_post_minus_pre and
    # resistance_window_status are populated regardless), so the CSV looks
    # like a working 104-row event study at a glance. Say the quiet part
    # loudly here so a reader who only checks the console log - not the
    # resistance_window_status column distribution - doesn't mistake this
    # for a populated resistance-change dataset.
    print(
      f"NOTE: 0 of {n_event_study} vaccination event-study country-pairs have AMR "
      "surveillance data in BOTH pre and post windows - resistance_rate_change_post_minus_pre "
      "is null in every row of intervention_vaccination_event_study_v1.csv. Only "
      "life_expectancy_change_post_minus_pre is populate-able from this deliverable; it "
      "carries no resistance-trend evidence in the current data."
    )

  pcv_row = summary[summary["sub_measure"] == "pcvc_coverage"].iloc[0]
  if pcv_row["scenario_magnitude_flag"] != "implausible_magnitude_likely_confounding":
    print("FAIL: PCV 10pp scenario should be flagged implausible_magnitude_likely_confounding.")
    failed = True
  else:
    print("PASS: PCV 10pp illustrative scenario flagged as implausible magnitude.")

  hib_row = summary[summary["sub_measure"] == "hib3_coverage"].iloc[0]
  hib_p = float(hib_row["coefficient_p_value"]) if pd.notna(hib_row["coefficient_p_value"]) else float("nan")
  if hib_row["scenario_magnitude_flag"] == "implausible_magnitude_likely_confounding":
    print("FAIL: Hib 10pp should not be flagged implausible magnitude (coefficient is negligible).")
    failed = True
  elif not np.isfinite(hib_p) or hib_p > 0.10:
    print("PASS: Hib association non-significant — eligible for integrity-layer withhold.")
  else:
    print("PASS: Hib scenario recorded for ungated illustrative ranking only.")

  bact_meta_row = meta_df[meta_df["pathogen_type"] == "bacterial"].iloc[0]
  if bact_meta_row["sample_warning"] == "small_sample_not_for_causal_claims":
    vacc_rows = summary[summary["sub_measure"].isin(["hib3_coverage", "pcvc_coverage"])]
    if (vacc_rows["model_sample_warning"] != "small_sample_not_for_causal_claims").any():
      print("FAIL: Stage 5 bacterial model is flagged small-sample but a vaccination "
            "scenario row is missing model_sample_warning.")
      failed = True
    else:
      print("PASS: Stage 5 small-sample warning propagated onto both vaccination scenario rows.")

  computable = event_study["resistance_window_status"].eq("computable")
  change_present = event_study["resistance_rate_change_post_minus_pre"].notna()
  inconsistent = (computable & ~change_present) | (~computable & change_present)
  if inconsistent.any():
    print(f"FAIL: {int(inconsistent.sum())} event-study row(s) have resistance_window_status inconsistent "
          f"with whether resistance_rate_change_post_minus_pre is populated.")
    failed = True
  else:
    print(f"PASS: {int(computable.sum())} event-study row(s) have AMR data in both pre and post windows, "
          f"and only those rows carry a computed resistance_rate_change_post_minus_pre "
          f"(all other rows flagged, none claim resistance change without window overlap).")

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
