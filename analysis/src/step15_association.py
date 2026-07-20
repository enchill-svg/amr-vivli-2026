"""
Step 15 - Section 6 Stage 5: Association analysis.

Model (pooled country-year OLS, complete cases only):
  life_expectancy ~ burden_midpoint_weighted + mean_evolutionary_fitness_slope
                    + health_expenditure_pct_gdp + hospital_beds_per_1000 + gbd_sdi
                    [+ hib3_coverage_pct + pcvc_coverage_pct for bacteria only]
                    + parsed_year

mean_evolutionary_fitness_slope matches Stage 2/3 trajectory definition (not YoY
distance delta). Bacterial model includes ESAC-Net J01 antibiotic DDD where
country-years match; fungal model omits consumption (antibiotics only).
"""
import datetime as dt
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm

from _section6_external import CONSUMPTION_DATA_AVAILABLE, SDI_INCLUDED

ROOT = Path(__file__).resolve().parents[1]
BOUNDS_DIR = ROOT / "bounds"
TODAY = dt.date.today().isoformat()

LIMITATION_TEXT_BASE = (
  "Suggestive association only — life expectancy is a broad outcome influenced by "
  "many factors beyond AMR; no causal attribution is claimed (brief Section 8). "
  "No published AMR precedent regresses life expectancy on surveillance burden; "
  "SDI and hospital beds included as health-system / development confounders per "
  "brief Stage 5."
)


def limitation_text(*, consumption_included: bool) -> str:
  if consumption_included:
    return (
      LIMITATION_TEXT_BASE
      + " Bacterial model adds ESAC-Net J01 antibiotic DDD (Europe, partial "
      "country-year coverage; complete-case rows only)."
    )
  return (
    LIMITATION_TEXT_BASE
    + " Consumption covariate omitted (no local numeric ESAC-Net series)."
  )


def fit_ols(df: pd.DataFrame, pathogen_type: str) -> tuple[pd.DataFrame, pd.DataFrame]:
  consumption_included = (
    pathogen_type == "bacterial"
    and CONSUMPTION_DATA_AVAILABLE
    and df["antimicrobial_consumption_ddd"].notna().any()
  )
  predictors = [
    "burden_midpoint_weighted",
    "mean_evolutionary_fitness_slope",
    "health_expenditure_pct_gdp",
    "hospital_beds_per_1000",
    "gbd_sdi",
    "parsed_year",
  ]
  if pathogen_type == "bacterial":
    predictors += ["hib3_coverage_pct", "pcvc_coverage_pct"]
  if consumption_included:
    predictors.append("antimicrobial_consumption_ddd")

  model_df = df.dropna(subset=["life_expectancy", "burden_midpoint_weighted"] + predictors).copy()
  n_countries = (
    int(model_df["iso3_country"].nunique()) if "iso3_country" in model_df.columns else np.nan
  )
  y = model_df["life_expectancy"]
  x = sm.add_constant(model_df[predictors])
  if len(model_df) < len(predictors) + 2:
    coef = pd.DataFrame(
      [{"term": "model", "coefficient": np.nan, "robust_se": np.nan,
        "pathogen_type": pathogen_type, "note": "insufficient_complete_cases"}]
    )
    meta = pd.DataFrame(
      [{"pathogen_type": pathogen_type, "n_obs": len(model_df), "n_countries": n_countries,
        "r_squared": np.nan,
        "adj_r_squared": np.nan, "consumption_included": consumption_included,
        "sdi_included": SDI_INCLUDED,
        "trajectory_covariate": "mean_evolutionary_fitness_slope",
        "sample_warning": "insufficient_complete_cases",
        "limitation": limitation_text(consumption_included=consumption_included),
        "version": "v1", "date_added": TODAY}]
    )
    return coef, meta

  result = sm.OLS(y, x).fit(cov_type="cluster", cov_kwds={"groups": model_df["iso3_country"]})
  coef = pd.DataFrame(
    {
      "term": result.params.index,
      "coefficient": result.params.values,
      "robust_se": result.bse.values,
      "p_value": result.pvalues.values,
      "pathogen_type": pathogen_type,
      "version": "v1",
      "date_added": TODAY,
    }
  )
  # Same small-sample flag fit_ols_variant() already applies to its
  # sensitivity specs - this primary model needs it too. n=16 against 10
  # parameters (this bacterial spec, verified live) leaves 6 residual
  # degrees of freedom and R^2 > 0.99, a textbook overfitting signature;
  # downstream consumers (dashboard, deliverables) must see this flag, not
  # just the sensitivity manifest.
  sample_warning = ""
  if result.nobs < 30 or (isinstance(n_countries, int) and n_countries < 10):
    sample_warning = "small_sample_not_for_causal_claims"
  meta = pd.DataFrame(
    [{
      "pathogen_type": pathogen_type,
      "n_obs": int(result.nobs),
      "n_countries": n_countries,
      "r_squared": float(result.rsquared),
      "adj_r_squared": float(result.rsquared_adj),
      "consumption_included": consumption_included,
      "sdi_included": SDI_INCLUDED,
      "trajectory_covariate": "mean_evolutionary_fitness_slope",
      "sample_warning": sample_warning,
      "limitation": limitation_text(consumption_included=consumption_included),
      "version": "v1",
      "date_added": TODAY,
    }]
  )
  return coef, meta


def fit_ols_variant(
  df: pd.DataFrame,
  pathogen_type: str,
  *,
  model_id: str,
  include_consumption: bool | None = None,
  include_vaccination: bool = True,
  include_sdi: bool = True,
) -> dict:
  """Run a labelled sensitivity specification; returns summary row for manifest."""
  use_consumption = (
    pathogen_type == "bacterial"
    and CONSUMPTION_DATA_AVAILABLE
    and df["antimicrobial_consumption_ddd"].notna().any()
    if include_consumption is None
    else include_consumption
  )
  predictors = [
    "burden_midpoint_weighted",
    "mean_evolutionary_fitness_slope",
    "health_expenditure_pct_gdp",
    "hospital_beds_per_1000",
    "parsed_year",
  ]
  if include_sdi:
    predictors.insert(4, "gbd_sdi")
  if pathogen_type == "bacterial" and include_vaccination:
    predictors += ["hib3_coverage_pct", "pcvc_coverage_pct"]
  if use_consumption:
    predictors.append("antimicrobial_consumption_ddd")

  model_df = df.dropna(subset=["life_expectancy", "burden_midpoint_weighted"] + predictors).copy()
  n_obs = len(model_df)
  n_countries = (
    int(model_df["iso3_country"].nunique()) if "iso3_country" in model_df.columns else np.nan
  )
  if n_obs < len(predictors) + 2:
    return {
      "model_id": model_id,
      "pathogen_type": pathogen_type,
      "n_obs": n_obs,
      "n_countries": n_countries,
      "r_squared": np.nan,
      "adj_r_squared": np.nan,
      "consumption_included": use_consumption,
      "vaccination_included": pathogen_type == "bacterial" and include_vaccination,
      "sdi_included": include_sdi,
      "predictors": ";".join(predictors),
      "sample_warning": "insufficient_complete_cases",
      "version": "v1",
      "date_added": TODAY,
    }

  y = model_df["life_expectancy"]
  x = sm.add_constant(model_df[predictors])
  result = sm.OLS(y, x).fit(cov_type="cluster", cov_kwds={"groups": model_df["iso3_country"]})
  warning = ""
  if n_obs < 30 or (isinstance(n_countries, int) and n_countries < 10):
    warning = "small_sample_not_for_causal_claims"
  return {
    "model_id": model_id,
    "pathogen_type": pathogen_type,
    "n_obs": int(result.nobs),
    "n_countries": n_countries,
    "r_squared": float(result.rsquared),
    "adj_r_squared": float(result.rsquared_adj),
    "consumption_included": use_consumption,
    "vaccination_included": pathogen_type == "bacterial" and include_vaccination,
    "sdi_included": include_sdi,
    "predictors": ";".join(predictors),
    "sample_warning": warning,
    "version": "v1",
    "date_added": TODAY,
  }


def build_sensitivity_manifest(bact: pd.DataFrame, fung: pd.DataFrame) -> pd.DataFrame:
  rows = [
    fit_ols_variant(bact, "bacterial", model_id="primary_with_consumption"),
    fit_ols_variant(bact, "bacterial", model_id="no_consumption", include_consumption=False),
    fit_ols_variant(bact, "bacterial", model_id="no_vaccination", include_vaccination=False),
    fit_ols_variant(fung, "fungal", model_id="primary_no_consumption"),
    fit_ols_variant(fung, "fungal", model_id="no_sdi", include_sdi=False),
  ]
  return pd.DataFrame(rows)


def main():
  failed = False
  bact = pd.read_csv(BOUNDS_DIR / "external_join_bacterial_country_year_v1.csv")
  fung = pd.read_csv(BOUNDS_DIR / "external_join_fungal_country_year_v1.csv")

  bact_coef, bact_meta = fit_ols(bact, "bacterial")
  fung_coef, fung_meta = fit_ols(fung, "fungal")

  pd.concat([bact_coef, fung_coef], ignore_index=True).to_csv(
    BOUNDS_DIR / "association_ols_coefficients_v1.csv", index=False
  )
  pd.concat([bact_meta, fung_meta], ignore_index=True).to_csv(
    BOUNDS_DIR / "association_model_metadata_v1.csv", index=False
  )
  sensitivity = build_sensitivity_manifest(bact, fung)
  sensitivity.to_csv(BOUNDS_DIR / "association_sensitivity_manifest_v1.csv", index=False)
  print(f"Wrote OLS outputs to bounds/association_ols_coefficients_v1.csv and "
        f"association_model_metadata_v1.csv")
  print(f"Wrote sensitivity manifest ({len(sensitivity)} model(s)) to "
        f"bounds/association_sensitivity_manifest_v1.csv")
  print(f"Bacterial complete-case n={int(bact_meta['n_obs'].iloc[0])}; "
        f"fungal complete-case n={int(fung_meta['n_obs'].iloc[0])}")

  fung_terms = set(fung_coef["term"].astype(str))
  if any(t in fung_terms for t in ("hib3_coverage_pct", "pcvc_coverage_pct")):
    print("FAIL: fungal model must not include vaccination coefficients.")
    failed = True
  else:
    print("PASS: fungal OLS excludes vaccination terms.")

  for label, meta, coef in [
    ("bacterial", bact_meta, bact_coef),
    ("fungal", fung_meta, fung_coef),
  ]:
    if "insufficient" in str(coef.get("note", pd.Series(dtype=str)).iloc[0] if len(coef) == 1 else ""):
      continue
    if meta["n_obs"].iloc[0] <= 0:
      print(f"FAIL: {label} model has zero complete-case observations.")
      failed = True

  all_meta = pd.concat([bact_meta, fung_meta], ignore_index=True)
  bact_consumption = bool(bact_meta["consumption_included"].iloc[0])
  fung_consumption = bool(fung_meta["consumption_included"].iloc[0])
  if CONSUMPTION_DATA_AVAILABLE:
    if not bact_consumption:
      print("FAIL: bacterial metadata should record consumption as included.")
      failed = True
    elif fung_consumption:
      print("FAIL: fungal metadata must not claim consumption was included.")
      failed = True
    elif "antimicrobial_consumption_ddd" not in set(bact_coef["term"].astype(str)):
      print("FAIL: bacterial OLS should include antimicrobial_consumption_ddd term.")
      failed = True
    elif not all_meta["sdi_included"].all():
      print("FAIL: metadata must record SDI as included.")
      failed = True
    else:
      print("PASS: metadata records bacterial ESAC consumption included and fungal omitted.")
  elif all_meta["consumption_included"].any():
    print("FAIL: metadata incorrectly claims consumption was included.")
    failed = True
  elif not all_meta["sdi_included"].all():
    print("FAIL: metadata must record SDI as included.")
    failed = True
  else:
    print("PASS: metadata records SDI included and consumption omitted (documented gap).")

  if failed:
    print("\nStep 15 Check: FAIL")
    sys.exit(1)
  print("\nStep 15 Check: PASS")


if __name__ == "__main__":
  main()
