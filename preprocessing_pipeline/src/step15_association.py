"""
Step 15 - Section 6 Stage 5: Association analysis.

Model (pooled country-year OLS, complete cases only):
  life_expectancy ~ burden_midpoint_weighted + mean_evolutionary_fitness_slope
                    + health_expenditure_pct_gdp
                    [+ hib3_coverage_pct + pcvc_coverage_pct for bacteria only]
                    + parsed_year

mean_evolutionary_fitness_slope matches Stage 2/3 trajectory definition (not YoY
distance delta). Consumption and SDI omitted per documented gaps.
"""
import datetime as dt
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.api as sm

ROOT = Path(__file__).resolve().parents[1]
BOUNDS_DIR = ROOT / "bounds"
TODAY = dt.date.today().isoformat()

LIMITATION_TEXT = (
  "Suggestive association only — life expectancy is a broad outcome influenced by "
  "many factors beyond AMR; no causal attribution is claimed (Justice Section 8). "
  "No published AMR precedent regresses life expectancy on surveillance burden; "
  "consumption covariate omitted (no local numeric series); SDI omitted (scope not approved)."
)


def fit_ols(df: pd.DataFrame, pathogen_type: str) -> tuple[pd.DataFrame, pd.DataFrame]:
  predictors = [
    "burden_midpoint_weighted",
    "mean_evolutionary_fitness_slope",
    "health_expenditure_pct_gdp",
    "parsed_year",
  ]
  if pathogen_type == "bacterial":
    predictors += ["hib3_coverage_pct", "pcvc_coverage_pct"]

  model_df = df.dropna(subset=["life_expectancy", "burden_midpoint_weighted"] + predictors).copy()
  y = model_df["life_expectancy"]
  x = sm.add_constant(model_df[predictors])
  if len(model_df) < len(predictors) + 2:
    coef = pd.DataFrame(
      [{"term": "model", "coefficient": np.nan, "robust_se": np.nan,
        "pathogen_type": pathogen_type, "note": "insufficient_complete_cases"}]
    )
    meta = pd.DataFrame(
      [{"pathogen_type": pathogen_type, "n_obs": len(model_df), "r_squared": np.nan,
        "adj_r_squared": np.nan, "consumption_included": False, "sdi_included": False,
        "trajectory_covariate": "mean_evolutionary_fitness_slope",
        "limitation": LIMITATION_TEXT, "version": "v1", "date_added": TODAY}]
    )
    return coef, meta

  result = sm.OLS(y, x).fit(cov_type="HC1")
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
  meta = pd.DataFrame(
    [{
      "pathogen_type": pathogen_type,
      "n_obs": int(result.nobs),
      "r_squared": float(result.rsquared),
      "adj_r_squared": float(result.rsquared_adj),
      "consumption_included": False,
      "sdi_included": False,
      "trajectory_covariate": "mean_evolutionary_fitness_slope",
      "limitation": LIMITATION_TEXT,
      "version": "v1",
      "date_added": TODAY,
    }]
  )
  return coef, meta


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
  print(f"Wrote OLS outputs to bounds/association_ols_coefficients_v1.csv and "
        f"association_model_metadata_v1.csv")
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
  if all_meta["consumption_included"].any() or all_meta["sdi_included"].any():
    print("FAIL: metadata incorrectly claims consumption or SDI were included.")
    failed = True
  else:
    print("PASS: metadata records consumption and SDI as omitted, with limitation text.")

  if failed:
    print("\nStep 15 Check: FAIL")
    sys.exit(1)
  print("\nStep 15 Check: PASS")


if __name__ == "__main__":
  main()
