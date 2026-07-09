"""
Step 13 - Section 6 Stage 3: Clustering.

Issue (Justice's Section 6 idea, plan doc Part 3.3, raw text lines 93-94):
"Unsupervised clustering on combined static-rate and evolutionary-trajectory
feature vectors, run separately for bacteria and fungi."

No direct precedent exists for clustering country-level phenotypic resistance
rates (plan Part 3.3) — this step follows adjacent PCA/hierarchical-clustering
work (Yang et al. 2020; Shoji et al. 2022) with Ward linkage on standardized
features and silhouette-guided k selection (sklearn), documenting every
modeling choice in the output rather than assuming a literature template.

Feature vector per (iso3_country, canonical_organism, canonical_drug):
  1. static_burden_midpoint — volume-weighted mean of Tier-1 Manski bound
     midpoints from Stage 1 descriptive output, aggregated across body sites/
     specimen sources and years for that combination. Bacteria: resistance
     midpoint (higher = more burden). Fungi: 1 − susceptibility midpoint
     (higher = more burden / lower susceptibility).
  2. evolutionary_trajectory_slope — Evolutionary Fitness Score from Stage 2
     (OLS slope of yearly median Distance-to-Failure). Negative slope = eroding
     margin toward resistance; retained as-is, not sign-flipped.

Only combinations present in BOTH Stage 1 and Stage 2 outputs enter clustering
(the plan's "combined static-rate + evolutionary-trajectory" requirement).
Bacterial dosing variants are pooled by n_isolates-weighted averages before
clustering — Justice's clustering text names country-organism-drug, not dosing
variant.

Fungal static burden uses Stage 1's ECV-tier WT-rate file (not the CLSI-
susceptibility tier), because Stage 2's Distance-to-Failure anchor is ECV-based
and the two tiers cover different drug sets (confirmed directly: only 77 of 1,365
fungal fitness combinations overlap CLSI-tier descriptive keys, vs 1,288 when
ECV-tier static rates are used). Burden is 1 − WT midpoint (higher = more non-WT
burden), aligned with the ECV evolutionary anchor.

Algorithm: StandardScaler → scipy hierarchical clustering (Ward) → cut at k
maximizing mean silhouette coefficient over k ∈ {2, …, min(8, n−1)}. If n < 4
combinations qualify, clustering is skipped and documented in diagnostics.

Check: every assignment row maps back to a real Stage 1+2 combination; cluster
labels are contiguous integers starting at 0; silhouette diagnostics are emitted
for every k evaluated; low_n_flag propagates from Stage 1/2 source rows.
"""
import datetime as dt
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.cluster.hierarchy import fcluster, linkage
from scipy.spatial.distance import pdist
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import StandardScaler

ROOT = Path(__file__).resolve().parents[1]
BOUNDS_DIR = ROOT / "bounds"

TODAY = dt.date.today().isoformat()
MAX_K = 8
MIN_CLUSTER_N = 4


def weighted_midpoint(
  df: pd.DataFrame,
  weight_col: str = "n_tested",
  invert: bool = False,
) -> pd.DataFrame:
  """Aggregate descriptive strata to combination-level static burden."""
  df = df.copy()
  df["midpoint"] = (df["tier1_bound_lower"] + df["tier1_bound_upper"]) / 2.0
  if invert:
    df["midpoint"] = 1.0 - df["midpoint"]
  grouped = (
    df.groupby(["iso3_country", "canonical_organism", "canonical_drug"], dropna=False)
    .apply(
      lambda g: pd.Series(
        {
          "static_burden_midpoint": np.average(
            g["midpoint"], weights=g[weight_col].clip(lower=1)
          ),
          "n_tested_total": g[weight_col].sum(),
          "low_n_flag": bool((g[weight_col] < 30).any()),
        }
      ),
      include_groups=False,
    )
    .reset_index()
  )
  return grouped


def pool_bacterial_fitness(fitness: pd.DataFrame) -> pd.DataFrame:
  """Pool dosing variants to country-organism-drug trajectory slopes."""
  fitness = fitness.copy()
  fitness["dosing_variant"] = fitness["dosing_variant"].fillna("")
  return (
    fitness.groupby(["iso3_country", "canonical_organism", "canonical_drug"], dropna=False)
    .apply(
      lambda g: pd.Series(
        {
          "evolutionary_trajectory_slope": np.average(
            g["evolutionary_fitness_score_slope"],
            weights=g["total_n_isolates"].clip(lower=1),
          ),
          "trajectory_low_density_flag": bool(g["low_density_flag"].any()),
        }
      ),
      include_groups=False,
    )
    .reset_index()
  )


def build_feature_table(static: pd.DataFrame, trajectory: pd.DataFrame) -> pd.DataFrame:
  merged = static.merge(
    trajectory,
    on=["iso3_country", "canonical_organism", "canonical_drug"],
    how="inner",
  )
  merged["low_n_flag"] = merged["low_n_flag"] | merged["trajectory_low_density_flag"]
  return merged


def select_k_and_cluster(features: pd.DataFrame, feature_cols: list[str]) -> tuple[pd.DataFrame, pd.DataFrame]:
  n = len(features)
  if n < MIN_CLUSTER_N:
    diag = pd.DataFrame(
      [
        {
          "n_combinations": n,
          "selected_k": np.nan,
          "selected_silhouette": np.nan,
          "note": f"clustering_skipped_n_lt_{MIN_CLUSTER_N}",
        }
      ]
    )
    out = features.copy()
    out["cluster_id"] = np.nan
    out["cluster_label"] = "insufficient_n_for_clustering"
    return out, diag

  x = features[feature_cols].to_numpy(dtype=float)
  x_scaled = StandardScaler().fit_transform(x)
  dist = pdist(x_scaled, metric="euclidean")
  z = linkage(dist, method="ward")

  k_max = min(MAX_K, n - 1)
  diag_rows = []
  best_k, best_score = 2, -1.0
  for k in range(2, k_max + 1):
    labels = fcluster(z, k, criterion="maxclust") - 1
    score = silhouette_score(x_scaled, labels, metric="euclidean")
    diag_rows.append({"k": k, "mean_silhouette": score, "n_combinations": n})
    if score > best_score:
      best_k, best_score = k, score

  labels = fcluster(z, best_k, criterion="maxclust") - 1
  out = features.copy()
  out["cluster_id"] = labels.astype(int)
  out["cluster_label"] = out["cluster_id"].map(lambda i: f"cluster_{i}")
  diag = pd.DataFrame(diag_rows)
  diag["selected"] = diag["k"] == best_k
  diag["selected_k"] = best_k
  diag["selected_silhouette"] = best_score
  return out, diag


def run_pathogen(
  pathogen_type: str,
  descriptive_path: Path,
  fitness_path: Path,
  invert_static: bool,
) -> tuple[pd.DataFrame, pd.DataFrame]:
  desc = pd.read_csv(descriptive_path)
  fit = pd.read_csv(fitness_path)
  static = weighted_midpoint(
    desc,
    weight_col="n_classified" if invert_static else "n_tested",
    invert=invert_static,
  )
  if pathogen_type == "bacterial":
    trajectory = pool_bacterial_fitness(fit)
  else:
    trajectory = fit[
      ["iso3_country", "canonical_organism", "canonical_drug",
       "evolutionary_fitness_score_slope", "low_density_flag"]
    ].rename(
      columns={
        "evolutionary_fitness_score_slope": "evolutionary_trajectory_slope",
        "low_density_flag": "trajectory_low_density_flag",
      }
    )
  features = build_feature_table(static, trajectory)
  assigned, diag = select_k_and_cluster(
    features, ["static_burden_midpoint", "evolutionary_trajectory_slope"]
  )
  assigned["pathogen_type"] = pathogen_type
  assigned["version"] = "v1"
  assigned["date_added"] = TODAY
  diag["pathogen_type"] = pathogen_type
  diag["version"] = "v1"
  diag["date_added"] = TODAY
  return assigned, diag


def main():
  failed = False
  BOUNDS_DIR.mkdir(parents=True, exist_ok=True)

  bact_assign, bact_diag = run_pathogen(
    "bacterial",
    BOUNDS_DIR / "descriptive_bacterial_resistance_v1.csv",
    BOUNDS_DIR / "evolutionary_bacterial_fitness_score_v1.csv",
    invert_static=False,
  )
  fung_assign, fung_diag = run_pathogen(
    "fungal",
    BOUNDS_DIR / "descriptive_fungal_ecv_wt_rate_v1.csv",
    BOUNDS_DIR / "evolutionary_fungal_fitness_score_v1.csv",
    invert_static=True,
  )

  assign_cols = [
    "pathogen_type", "iso3_country", "canonical_organism", "canonical_drug",
    "static_burden_midpoint", "evolutionary_trajectory_slope", "n_tested_total",
    "low_n_flag", "cluster_id", "cluster_label", "version", "date_added",
  ]
  bact_assign[assign_cols].sort_values(
    ["cluster_id", "iso3_country", "canonical_organism", "canonical_drug"]
  ).to_csv(BOUNDS_DIR / "cluster_bacterial_assignments_v1.csv", index=False)
  fung_assign[assign_cols].sort_values(
    ["cluster_id", "iso3_country", "canonical_organism", "canonical_drug"]
  ).to_csv(BOUNDS_DIR / "cluster_fungal_assignments_v1.csv", index=False)
  print(f"Wrote {len(bact_assign)} bacterial cluster assignment(s) to "
        f"bounds/cluster_bacterial_assignments_v1.csv (selected k="
        f"{int(bact_diag['selected_k'].iloc[0]) if bact_diag['selected_k'].notna().any() else 'skipped'}).")
  print(f"Wrote {len(fung_assign)} fungal cluster assignment(s) to "
        f"bounds/cluster_fungal_assignments_v1.csv (selected k="
        f"{int(fung_diag['selected_k'].iloc[0]) if fung_diag['selected_k'].notna().any() else 'skipped'}).")

  diag = pd.concat([bact_diag, fung_diag], ignore_index=True)
  diag.to_csv(BOUNDS_DIR / "cluster_diagnostics_v1.csv", index=False)
  print(f"Wrote cluster diagnostics to bounds/cluster_diagnostics_v1.csv")

  for label, df in [("bacterial", bact_assign), ("fungal", fung_assign)]:
    if df["static_burden_midpoint"].isna().any() or df["evolutionary_trajectory_slope"].isna().any():
      print(f"FAIL: {label} cluster features contain null values.")
      failed = True
    clustered = df[df["cluster_id"].notna()]
    if len(clustered) and clustered["cluster_id"].min() < 0:
      print(f"FAIL: {label} cluster_id values are not non-negative integers.")
      failed = True
    if len(clustered) and clustered["cluster_id"].nunique() != clustered["cluster_id"].max() + 1:
      print(f"FAIL: {label} cluster_id labels are not contiguous from 0.")
      failed = True

  if not failed:
    print(f"PASS: bacterial n={len(bact_assign)}, fungal n={len(fung_assign)} — all feature rows complete, "
          f"cluster labels valid where clustering ran.")
  else:
    print("\nStep 13 Check: FAIL")
    sys.exit(1)

  print("\nStep 13 Check: PASS")


if __name__ == "__main__":
  main()
