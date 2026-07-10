"""Manski partial-identification bounds (Appendix 5 / Step 8)."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Optional

from .estimands import TIER2_ASSUMPTION_LABEL


@dataclass(frozen=True)
class ManskiBounds:
    N: int
    T: int
    P: int
    tier1_lower: float
    tier1_upper: float
    tier2_lower: float
    tier2_upper: Optional[float]
    tier2_upper_valid: bool
    naive_subset_ratio: Optional[float]
    low_n_stratum: bool
    tier1_assumption: str = "assumption_free_manski"
    tier2_assumption: str = TIER2_ASSUMPTION_LABEL

    def to_row(
        self,
        bound_id: str,
        signal_type: str,
        cohort: str,
        organism: str,
        stratum_dims: str,
        version: str,
        date_added: str,
    ) -> dict:
        return {
            "bound_id": bound_id,
            "signal_type": signal_type,
            "cohort": cohort,
            "organism": organism,
            "stratum_dims": stratum_dims,
            "N": self.N,
            "T": self.T,
            "P": self.P,
            "tier1_assumption": self.tier1_assumption,
            "tier1_lower": round(self.tier1_lower, 6),
            "tier1_upper": round(self.tier1_upper, 6),
            "tier2_assumption": self.tier2_assumption,
            "tier2_lower": round(self.tier2_lower, 6),
            "tier2_upper": round(self.tier2_upper, 6) if self.tier2_upper_valid else "",
            "tier2_upper_valid": self.tier2_upper_valid,
            "naive_subset_ratio": round(self.naive_subset_ratio, 6)
            if self.naive_subset_ratio is not None
            else "",
            "naive_ratio_label": "subset_share_not_prevalence"
            if self.naive_subset_ratio is not None
            else "",
            "low_n_stratum": self.low_n_stratum,
            "version": version,
            "date_added": date_added,
        }


def compute_manski_bounds(
    N: int,
    T: int,
    P: int,
    *,
    low_n_threshold: int = 10,
) -> ManskiBounds:
    if not (0 <= P <= T <= N) and not (N == 0 and T == 0 and P == 0):
        raise ValueError(f"Require 0 <= P <= T <= N, got P={P}, T={T}, N={N}")
    if N == 0:
        return ManskiBounds(
            N=0, T=0, P=0,
            tier1_lower=0.0, tier1_upper=1.0,
            tier2_lower=0.0, tier2_upper=None, tier2_upper_valid=False,
            naive_subset_ratio=None, low_n_stratum=True,
        )
    tier1_lower = P / N
    tier1_upper = (P + N - T) / N
    tier2_lower = P / N
    tier2_upper_valid = T > 0
    tier2_upper = (P / T) if tier2_upper_valid else None
    naive = (P / T) if tier2_upper_valid else None
    return ManskiBounds(
        N=N, T=T, P=P,
        tier1_lower=tier1_lower,
        tier1_upper=tier1_upper,
        tier2_lower=tier2_lower,
        tier2_upper=tier2_upper,
        tier2_upper_valid=tier2_upper_valid,
        naive_subset_ratio=naive,
        low_n_stratum=N < low_n_threshold,
    )
