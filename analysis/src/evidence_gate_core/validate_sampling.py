"""Resampling validation: resistant-only vs representative HT design."""
from __future__ import annotations

import datetime as dt
from typing import Callable

import numpy as np
import pandas as pd

from .bounds import compute_manski_bounds
from .estimands import (
    BIAS_TOLERANCE_PP,
    BUDGET_GRID,
    COVERAGE_HIGH,
    COVERAGE_LOW,
    RESAMPLE_COUNT,
    RESISTANT_ONLY_MIN_BIAS_PP,
    VALIDATION_RANDOM_SEED,
)


def _wilson_ci(successes: int, n: int, z: float = 1.96) -> tuple[float, float]:
    if n == 0:
        return 0.0, 1.0
    p = successes / n
    denom = 1 + z**2 / n
    centre = p + z**2 / (2 * n)
    margin = z * np.sqrt((p * (1 - p) + z**2 / (4 * n)) / n)
    lower = (centre - margin) / denom
    upper = (centre + margin) / denom
    return max(0.0, lower), min(1.0, upper)


def resample_validate(
    df: pd.DataFrame,
    outcome_col: str,
    mic_col: str,
    dataset_name: str,
    *,
    susceptible_max_mic: float | None = None,
    random_seed: int = VALIDATION_RANDOM_SEED,
) -> tuple[pd.DataFrame, pd.DataFrame]:
    """Run resistant-only vs representative designs across budget grid."""
    rng = np.random.default_rng(random_seed)
    work = df.dropna(subset=[outcome_col]).copy()
    work[outcome_col] = work[outcome_col].astype(bool)
    true_prev = float(work[outcome_col].mean())
    n_pop = len(work)

    if susceptible_max_mic is None and mic_col in work.columns:
        sus = work.loc[~work[outcome_col], mic_col].dropna()
        susceptible_max_mic = float(sus.quantile(0.25)) if len(sus) else float(work[mic_col].min())

    detail_rows = []
    for budget in BUDGET_GRID:
        for design in ("resistant_only", "representative_ht"):
            biases = []
            covered = 0
            for _ in range(RESAMPLE_COUNT):
                if design == "resistant_only":
                    if mic_col in work.columns and susceptible_max_mic is not None:
                        eligible = work[work[mic_col] > susceptible_max_mic]
                        if len(eligible) < budget:
                            eligible = work[work[outcome_col]]
                        if len(eligible) == 0:
                            eligible = work
                    else:
                        eligible = work[work[outcome_col]]
                        if len(eligible) < budget:
                            eligible = work
                    sample = eligible.sample(n=min(budget, len(eligible)), replace=False, random_state=rng.integers(1e9))
                    est = float(sample[outcome_col].mean())
                    lo, hi = _wilson_ci(int(sample[outcome_col].sum()), len(sample))
                else:
                    sample = work.sample(n=min(budget, n_pop), replace=False, random_state=rng.integers(1e9))
                    # HT weights: inverse of inclusion prob
                    pi = len(sample) / n_pop
                    weights = np.ones(len(sample)) / pi
                    est = float(np.average(sample[outcome_col].astype(float), weights=weights) / (1 / pi))
                    # Design-based: weighted mean simplifies to sample mean for SRS
                    est = float(sample[outcome_col].mean())
                    lo, hi = _wilson_ci(int(sample[outcome_col].sum()), len(sample))

                bias_pp = (est - true_prev) * 100
                biases.append(bias_pp)
                if lo <= true_prev <= hi:
                    covered += 1

            detail_rows.append(
                {
                    "dataset": dataset_name,
                    "design": design,
                    "budget": budget,
                    "observed_prevalence": true_prev,
                    "mean_bias_pp": float(np.mean(biases)),
                    "median_bias_pp": float(np.median(biases)),
                    "coverage_rate": covered / RESAMPLE_COUNT,
                    "n_pop": n_pop,
                    "version": "v1",
                    "date_added": dt.date.today().isoformat(),
                }
            )

    detail = pd.DataFrame(detail_rows)
    summary = (
        detail.groupby(["dataset", "design"], as_index=False)
        .agg(
            observed_prevalence=("observed_prevalence", "first"),
            mean_bias_pp=("mean_bias_pp", "mean"),
            coverage_rate=("coverage_rate", "mean"),
            n_pop=("n_pop", "first"),
        )
    )
    summary["version"] = "v1"
    summary["date_added"] = dt.date.today().isoformat()
    return detail, summary


def check_validation_summary(summary: pd.DataFrame) -> list[str]:
    errors = []
    rep = summary[summary["design"] == "representative_ht"]
    res = summary[summary["design"] == "resistant_only"]
    if rep.empty:
        errors.append("No representative_ht rows in validation summary")
    else:
        if (rep["mean_bias_pp"].abs() > BIAS_TOLERANCE_PP).any():
            errors.append(f"Representative design mean bias exceeds ±{BIAS_TOLERANCE_PP} pp")
        cov = rep["coverage_rate"].mean()
        if not (COVERAGE_LOW <= cov <= COVERAGE_HIGH):
            errors.append(f"Representative coverage {cov:.3f} outside [{COVERAGE_LOW}, {COVERAGE_HIGH}]")
    if not res.empty and (res["mean_bias_pp"] < RESISTANT_ONLY_MIN_BIAS_PP).all():
        errors.append(f"Resistant-only bias did not exceed +{RESISTANT_ONLY_MIN_BIAS_PP} pp on any dataset")
    return errors
