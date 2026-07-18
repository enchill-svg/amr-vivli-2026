"""Shared country-year and organism-level aggregation helpers for Section 6."""
from __future__ import annotations

import numpy as np
import pandas as pd

SITE_COLUMNS = ("body_site", "specimen_source")


def stratum_site_column(df: pd.DataFrame) -> str:
    for col in SITE_COLUMNS:
        if col in df.columns:
            return col
    raise ValueError(f"Expected one of {SITE_COLUMNS} in descriptive frame")


def dedupe_isolate_denominator(df: pd.DataFrame, site_col: str) -> pd.DataFrame:
    """One row per (organism, country, year, site) with n_isolates_in_stratum."""
    keys = ["canonical_organism", "iso3_country", "parsed_year", site_col]
    return (
        df[keys + ["n_isolates_in_stratum"]]
        .drop_duplicates(subset=keys)
        .rename(columns={site_col: "_site"})
    )


def pool_country_year_descriptive(
    desc: pd.DataFrame,
    p_col: str,
    weight_col: str = "n_tested",
    invert: bool = False,
) -> pd.DataFrame:
    """Pool Stage 1 descriptive strata to country-year with deduplicated N.

    P and T sum across organism-drug-site rows (isolate-drug test counts).
    N sums each organism-site stratum once — never once per drug row.
    Manski Tier-1 bounds use pooled P, T, and deduplicated N.
    """
    df = desc.copy()
    site_col = stratum_site_column(df)
    df["midpoint"] = (df["tier1_bound_lower"] + df["tier1_bound_upper"]) / 2.0
    if invert:
        df["midpoint"] = 1.0 - df["midpoint"]
        # Keep the pooled tier1_bound_lower/upper columns in the same
        # (inverted) direction as midpoint above - interval inversion swaps
        # and complements the endpoints (new_lower = 1 - old_upper), not just
        # the midpoint - otherwise midpoint and bounds describe opposite
        # quantities for fungal rows (resistance- vs susceptibility-oriented).
        df["tier1_bound_lower"], df["tier1_bound_upper"] = (
            1.0 - df["tier1_bound_upper"],
            1.0 - df["tier1_bound_lower"],
        )

    stratum_n = dedupe_isolate_denominator(df, site_col)
    n_by_cy = (
        stratum_n.groupby(["iso3_country", "parsed_year"], dropna=False)["n_isolates_in_stratum"]
        .sum()
        .reset_index(name="n_isolates_in_stratum")
    )

    def _agg(g: pd.DataFrame) -> pd.Series:
        n_tested = g[weight_col].sum()
        n_event = g[p_col].sum()
        # Do NOT clip(lower=1): Step 11's per-organism cross join deliberately
        # emits an explicit n_tested=0 row for every (organism, drug, site)
        # combination never tested in a stratum, carrying the maximally
        # uninformative Manski midpoint (0.5). Flooring its weight to 1 would
        # give that "no data" placeholder the same say as a stratum with one
        # real tested isolate, biasing burden_midpoint_weighted toward 0.5 in
        # proportion to how many untested combinations exist in the group.
        # Zero-weight rows must drop out of the average entirely; only guard
        # the case where every row in the group is untested (total weight 0).
        w = g[weight_col]
        has_tested = w.sum() > 0
        return pd.Series(
            {
                "n_tested": n_tested,
                "n_event": n_event,
                "burden_point_estimate": n_event / n_tested if n_tested else np.nan,
                "burden_midpoint_weighted": np.average(g["midpoint"], weights=w) if has_tested else np.nan,
                # Weighted average of stratum Manski bounds — do not divide pooled
                # drug-test counts by deduplicated isolate N (same isolate may be
                # tested for multiple drugs).
                "tier1_bound_lower_pooled": np.average(g["tier1_bound_lower"], weights=w) if has_tested else np.nan,
                "tier1_bound_upper_pooled": np.average(g["tier1_bound_upper"], weights=w) if has_tested else np.nan,
            }
        )

    agg = (
        df.groupby(["iso3_country", "parsed_year"], dropna=False)
        .apply(_agg, include_groups=False)
        .reset_index()
    )
    cy = agg.merge(n_by_cy, on=["iso3_country", "parsed_year"], how="left")
    return cy


def pool_country_year_descriptive_by_organism(
    desc: pd.DataFrame,
    organism: str,
    p_col: str = "n_resistant",
    weight_col: str = "n_tested",
) -> pd.DataFrame:
    """Country-year resistance point estimate for one organism (event-study helper)."""
    sub = desc[desc["canonical_organism"] == organism].copy()
    if sub.empty:
        return pd.DataFrame(columns=["iso3_country", "parsed_year", "resistance_point_estimate"])

    def _agg(g: pd.DataFrame) -> pd.Series:
        n_tested = g[weight_col].sum()
        n_event = g[p_col].sum()
        return pd.Series(
            {
                "resistance_point_estimate": n_event / n_tested if n_tested else np.nan,
                "n_tested": n_tested,
            }
        )

    return (
        sub.groupby(["iso3_country", "parsed_year"], dropna=False)
        .apply(_agg, include_groups=False)
        .reset_index()
    )


def pool_bacterial_fitness_slopes(fitness: pd.DataFrame) -> pd.DataFrame:
    """Pool dosing variants to country-organism-drug fitness slopes."""
    fitness = fitness.copy()
    fitness["dosing_variant"] = fitness["dosing_variant"].fillna("")
    return (
        fitness.groupby(["iso3_country", "canonical_organism", "canonical_drug"], dropna=False)
        .apply(
            lambda g: pd.Series(
                {
                    "evolutionary_fitness_score_slope": np.average(
                        g["evolutionary_fitness_score_slope"],
                        weights=g["total_n_isolates"].clip(lower=1),
                    ),
                }
            ),
            include_groups=False,
        )
        .reset_index()
    )


def pool_country_year_fitness_slope(
    dist: pd.DataFrame,
    fitness: pd.DataFrame,
    pathogen_type: str,
) -> pd.DataFrame:
    """Country-year mean Evolutionary Fitness Score slope (Stage 2), weighted by n_isolates."""
    if pathogen_type == "bacterial":
        fit = pool_bacterial_fitness_slopes(fitness)
        merge_keys = ["iso3_country", "canonical_organism", "canonical_drug"]
    else:
        fit = fitness[
            ["iso3_country", "canonical_organism", "canonical_drug", "evolutionary_fitness_score_slope"]
        ].copy()
        merge_keys = ["iso3_country", "canonical_organism", "canonical_drug"]

    merged = dist.merge(fit, on=merge_keys, how="left")
    return (
        merged.groupby(["iso3_country", "parsed_year"], dropna=False)
        .apply(
            lambda g: pd.Series(
                {
                    "mean_evolutionary_fitness_slope": np.average(
                        g["evolutionary_fitness_score_slope"],
                        weights=g["n_isolates"].clip(lower=1),
                    )
                    if g["evolutionary_fitness_score_slope"].notna().any()
                    else np.nan,
                    "n_fitness_cells": int(g["evolutionary_fitness_score_slope"].notna().sum()),
                }
            ),
            include_groups=False,
        )
        .reset_index()
    )


def pool_country_year_distance(dist: pd.DataFrame) -> pd.DataFrame:
    """Country-year volume-weighted mean median Distance-to-Failure (supplemental)."""
    return (
        dist.groupby(["iso3_country", "parsed_year"], dropna=False)
        .apply(
            lambda g: pd.Series(
                {
                    "mean_median_distance_to_failure": np.average(
                        g["median_distance_to_failure"], weights=g["n_isolates"].clip(lower=1)
                    ),
                    "n_distance_cells": len(g),
                }
            ),
            include_groups=False,
        )
        .reset_index()
    )


def organism_burden_global(
    desc: pd.DataFrame,
    weight_col: str = "n_tested",
    invert: bool = False,
) -> pd.DataFrame:
    """Organism-level burden for R&D alignment.

    Burden is the weight_col-weighted Tier-1 Manski bound midpoint
    (tier1_bound_lower/tier1_bound_upper) — never a raw resistant-count /
    tested-count point estimate, for the same reason pool_country_year_
    descriptive above avoids one: zero-coverage strata carry an
    uninformative [0%, 100%] bound rather than a fabricated rate.
    """
    df = desc.copy()
    df["midpoint"] = (df["tier1_bound_lower"] + df["tier1_bound_upper"]) / 2.0
    if invert:
        df["midpoint"] = 1.0 - df["midpoint"]

    def _agg(g: pd.DataFrame) -> pd.Series:
        weights = g[weight_col]
        total_w = weights.sum()
        if total_w > 0:
            # zero-coverage strata (n_tested == 0) carry the fully uninformative
            # [0%, 100%] Tier 1 bound (midpoint 0.5) by design (step11) — giving
            # them a fabricated weight of 1 would blend that non-observation
            # into the real ones, so they get their true weight of zero instead.
            burden = np.average(g["midpoint"], weights=weights)
        else:
            burden = g["midpoint"].mean()
        return pd.Series(
            {
                "burden_midpoint_weighted": burden,
                "n_tested_total": total_w,
                "n_country_years": g[["iso3_country", "parsed_year"]].drop_duplicates().shape[0],
            }
        )

    return (
        df.groupby("canonical_organism", dropna=False)
        .apply(_agg, include_groups=False)
        .reset_index()
    )


def allocate_agent_funding_to_organisms(
    organisms: list[str],
    agent_totals: pd.DataFrame,
    match_fn,
) -> pd.DataFrame:
    """Split each agent's funding equally across surveillance organisms it matches."""
    organism_list = list(organisms)
    funding_map = {org: 0.0 for org in organism_list}
    agents_map: dict[str, list[str]] = {org: [] for org in organism_list}

    for _, agent_row in agent_totals.iterrows():
        agent = agent_row["agent"]
        total = float(agent_row["amount_usd_prorated"])
        matched = [org for org in organism_list if match_fn(agent, org)]
        if not matched:
            continue
        share = total / len(matched)
        for org in matched:
            funding_map[org] += share
            agents_map[org].append(agent)

    return pd.DataFrame(
        {
            "canonical_organism": organism_list,
            "rd_funding_usd_matched": [funding_map[org] for org in organism_list],
            "n_rd_agent_labels_matched": [len(set(agents_map[org])) for org in organism_list],
            "matched_agents": ["; ".join(sorted(set(agents_map[org]))) if agents_map[org] else "" for org in organism_list],
        }
    )
