"""Horvitz-Thompson budget allocator for representative genotyping."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

import numpy as np
import pandas as pd

from .estimands import VALIDATION_RANDOM_SEED


@dataclass
class AllocatorResult:
    mic_band: float
    n_pilot: int
    n_allocate_core: int
    n_allocate_discovery: int
    ht_weight: float
    estimated_prevalence: float
    ci95_lower: float
    ci95_upper: float
    discovery_go_no_go: str

    def to_dict(self) -> dict:
        return {
            "mic_band": self.mic_band,
            "n_pilot": self.n_pilot,
            "n_allocate_core": self.n_allocate_core,
            "n_allocate_discovery": self.n_allocate_discovery,
            "ht_weight": self.ht_weight,
            "estimated_prevalence": self.estimated_prevalence,
            "ci95_lower": self.ci95_lower,
            "ci95_upper": self.ci95_upper,
            "discovery_go_no_go": self.discovery_go_no_go,
        }


def _mic_bins(mic_values: pd.Series, n_bins: int = 8) -> pd.Series:
    vals = mic_values.dropna()
    if vals.empty:
        return pd.Series(dtype=float)
    if vals.nunique() <= n_bins:
        return mic_values
    try:
        return pd.qcut(mic_values, q=n_bins, duplicates="drop")
    except ValueError:
        return pd.cut(mic_values, bins=n_bins)


def allocate_budget(
    pilot_df: pd.DataFrame,
    mic_col: str,
    outcome_col: str,
    budget: int,
    *,
    discovery_enabled: bool = True,
    target_prevalence: Optional[float] = None,
    random_seed: int = VALIDATION_RANDOM_SEED,
) -> tuple[list[AllocatorResult], dict]:
    """Allocate tests across MIC bands using pilot data (outcome_col used only for evaluation)."""
    rng = np.random.default_rng(random_seed)
    df = pilot_df.dropna(subset=[mic_col]).copy()
    if df.empty:
        raise ValueError("Pilot dataframe has no MIC values")

    df["_band"] = _mic_bins(df[mic_col])
    band_counts = df.groupby("_band", observed=True).size()
    total_pilot = int(band_counts.sum())
    obs_prev = float(df[outcome_col].mean()) if outcome_col in df.columns else np.nan
    prev = target_prevalence if target_prevalence is not None else obs_prev

    # Proportional core allocation (Neyman-like: proportional to pilot stratum size)
    core_alloc = {}
    remaining = budget
    bands = list(band_counts.index)
    for i, band in enumerate(bands):
        if i == len(bands) - 1:
            core_alloc[band] = remaining
        else:
            n = max(1, int(round(budget * band_counts[band] / total_pilot)))
            n = min(n, remaining - (len(bands) - i - 1))
            core_alloc[band] = n
            remaining -= n

    # Discovery arm: top MIC quartile if rare target
    discovery_go = "NO"
    discovery_alloc = {b: 0 for b in bands}
    if discovery_enabled and prev is not None and prev < 0.15:
        band_midpoints = {b: df.loc[df["_band"] == b, mic_col].median() for b in bands}
        threshold = np.percentile(list(band_midpoints.values()), 75)
        high_bands = [b for b, m in band_midpoints.items() if m >= threshold]
        if high_bands:
            discovery_go = "GO"
            extra = max(1, budget // 10)
            per = max(1, extra // len(high_bands))
            for b in high_bands:
                discovery_alloc[b] = per

    results: list[AllocatorResult] = []
    weighted_pos = 0.0
    weight_sum = 0.0
    for band in bands:
        n_pilot = int(band_counts[band])
        n_core = int(core_alloc.get(band, 0))
        n_disc = int(discovery_alloc.get(band, 0))
        pi = n_core / total_pilot if total_pilot else 0
        ht_w = 1.0 / pi if pi > 0 else 0.0
        band_prev = float(df.loc[df["_band"] == band, outcome_col].mean()) if outcome_col in df.columns else 0.0
        # ht_w (1/pi) is the per-band inverse-probability weight for the planned
        # core allocation; pairing it with pi in the pooled sum cancels it out
        # exactly (ht_w * pi == 1), silently collapsing "weighted" back to an
        # unweighted mean. Pool by each band's pilot population share instead.
        weighted_pos += n_pilot * band_prev
        weight_sum += n_pilot
        results.append(
            AllocatorResult(
                mic_band=float(df.loc[df["_band"] == band, mic_col].median()),
                n_pilot=n_pilot,
                n_allocate_core=n_core,
                n_allocate_discovery=n_disc,
                ht_weight=round(ht_w, 6),
                estimated_prevalence=band_prev,
                ci95_lower=max(0.0, band_prev - 1.96 * np.sqrt(band_prev * (1 - band_prev) / max(n_core, 1))),
                ci95_upper=min(1.0, band_prev + 1.96 * np.sqrt(band_prev * (1 - band_prev) / max(n_core, 1))),
                discovery_go_no_go=discovery_go,
            )
        )

    # weighted_pos / weight_sum pools by pilot population share (n_pilot), so
    # this is algebraically identical to the plain unweighted pilot mean
    # (Sum(n_band * mean_band) / Sum(n_band) == overall mean for any partition
    # into bands) - est_prev is always exactly obs_prev when target_prevalence
    # is unset. It is kept as a separate field because a caller-supplied
    # target_prevalence changes prev (used for the discovery-arm threshold)
    # but currently has no effect on this pooled point estimate.
    est_prev = weighted_pos / weight_sum if weight_sum else obs_prev
    # Pooled design-based interval for the planned core round as a whole,
    # using total budget as the effective n - the per-band ci95_lower/upper
    # above are each band's own design-based projection at that band's n_core;
    # this is the single-number analog a caller who only wants one headline
    # interval (not 8 band-level ones) would otherwise have to compute itself.
    ci_se = np.sqrt(est_prev * (1 - est_prev) / max(budget, 1)) if pd.notna(est_prev) else np.nan
    meta = {
        "budget": budget,
        "observed_prevalence": obs_prev,
        "estimated_prevalence_pooled": est_prev,
        "estimated_prevalence_pooled_ci95_lower": max(0.0, est_prev - 1.96 * ci_se) if pd.notna(ci_se) else np.nan,
        "estimated_prevalence_pooled_ci95_upper": min(1.0, est_prev + 1.96 * ci_se) if pd.notna(ci_se) else np.nan,
        "discovery_go_no_go": discovery_go,
        "random_seed": random_seed,
    }
    return results, meta


def run_allocator_cli():
    import argparse
    from .paths import ALLOCATOR_RECOMMENDATIONS, PLEA_CLEAN

    # Defaults (PLEA_CLEAN + carbapenemase_positive) match this tool's own
    # integration-check dataset (LAYER_A build plan WS3 "Check (integration)":
    # representative design vs WS4 validation on PLEA) - a validation-demo
    # invocation, not the true label-scarce production use case (a lab running
    # this on a pilot where outcome_col is what it's trying to decide whether
    # to fund testing for). Override --pilot/--outcome-col for real use.
    parser = argparse.ArgumentParser(description="AMR Evidence Gate budget allocator")
    parser.add_argument("--budget", type=int, default=200)
    parser.add_argument("--pilot", type=str, default=str(PLEA_CLEAN))
    parser.add_argument("--mic-col", type=str, default="meropenem_mic")
    parser.add_argument("--outcome-col", type=str, default="carbapenemase_positive")
    parser.add_argument("--no-discovery", action="store_true")
    args = parser.parse_args()

    pilot = pd.read_csv(args.pilot)
    results, meta = allocate_budget(
        pilot,
        mic_col=args.mic_col,
        outcome_col=args.outcome_col,
        budget=args.budget,
        discovery_enabled=not args.no_discovery,
    )
    rows = [r.to_dict() for r in results]
    for k, v in meta.items():
        for row in rows:
            row[k] = v
    out = pd.DataFrame(rows)
    ALLOCATOR_RECOMMENDATIONS.parent.mkdir(parents=True, exist_ok=True)
    out.to_csv(ALLOCATOR_RECOMMENDATIONS, index=False)
    print(f"Wrote {len(out)} band allocation row(s) to {ALLOCATOR_RECOMMENDATIONS}")
    print(
        f"Estimated prevalence (pooled): {meta['estimated_prevalence_pooled']:.4f} "
        f"[{meta['estimated_prevalence_pooled_ci95_lower']:.4f}, "
        f"{meta['estimated_prevalence_pooled_ci95_upper']:.4f}] "
        f"(design-based, budget={meta['budget']})"
    )


if __name__ == "__main__":
    run_allocator_cli()
