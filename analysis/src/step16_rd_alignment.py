"""
Step 16 - Section 6 Stage 6: R&D alignment check.

Burden: Stage 1 descriptive output at organism level (bacterial: EUCAST-tier
resistance; fungal: ECV-tier non-WT burden — same tiers as Stages 13–14).

Funding: Hub Amount USD pro-rated per project tag, then split equally across
surveillance organisms matched to each genus-level agent label (avoids assigning
the full Candida tag total to every Candida species row).

funding_share denominators use the pathogen-type agent-total from the Hub export,
not the sum of organism-level allocations (which partition agent totals).
"""
import datetime as dt
import sys
from pathlib import Path

import numpy as np
import pandas as pd
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from _section6_aggregates import allocate_agent_funding_to_organisms, organism_burden_global
from _section6_external import (
  build_hub_funding_composition,
  load_rd_projects_prorated,
  resolve_rd_projects_path,
)

BOUNDS_DIR = ROOT / "bounds"
DELIVERABLES_DIR = ROOT / "deliverables"
TODAY = dt.date.today().isoformat()

PRORATA_CAVEAT = (
  "Amount USD divided by infectious-agent tag count per Hub methodology when "
  "multiple agents appear in one Categories cell. Organism-level totals further "
  "split each matched agent label equally across surveillance organisms in this "
  "project. Whether the export's single Amount USD is already internally pro-rated "
  "could not be verified locally."
)

BACTERIAL_BURDEN_NOTE = (
  "Burden covers only organisms with EUCAST-tier resistance rates in Stage 1 "
  "(Haemophilus influenzae, Streptococcus pneumoniae). Escherichia coli and "
  "Klebsiella pneumoniae have no EUCAST breakpoint classification in this data."
)

# Spearman rho is mathematically defined below n=3 but conveys no real
# information there (3 points always trace an extreme, saturated rank
# correlation) - already blocked from computing at all. SPEARMAN_THIN_N is a
# looser, transparency-only threshold: rho below this n is real but backed by
# too few organisms to interpret confidently, mirroring the n_countries < 10
# small-sample convention step15_association.py already applies to the LE
# regressions.
SPEARMAN_MIN_N = 3
SPEARMAN_THIN_N = 10


def agent_matches_organism(agent: str, organism: str) -> bool:
  if not isinstance(agent, str) or not isinstance(organism, str):
    return False
  a = agent.lower().replace("_", " ")
  o = organism.lower()
  genus = organism.split()[0].lower() if organism.strip() else ""
  if genus and genus in a:
    return True
  if "streptococcus pneumoniae" in o and "streptococcus" in a:
    return True
  if "haemophilus influenzae" in o and "haemophilus" in a:
    return True
  if "escherichia coli" in o and ("escherichia" in a or "e. coli" in a):
    return True
  if "klebsiella pneumoniae" in o and "klebsiella" in a:
    return True
  return False


def align_funding_to_organisms(
  burden: pd.DataFrame,
  funding: pd.DataFrame,
  pathogen_type: str,
) -> pd.DataFrame:
  organisms = burden["canonical_organism"].tolist()
  agent_totals = (
    funding[funding["pathogen_type"] == pathogen_type]
    .groupby("agent", dropna=False)["amount_usd_prorated"]
    .sum()
    .reset_index()
  )
  allocated = allocate_agent_funding_to_organisms(organisms, agent_totals, agent_matches_organism)
  out = burden.merge(allocated, on="canonical_organism", how="left")
  out["pathogen_type"] = pathogen_type
  total_burden = out["burden_midpoint_weighted"].sum()
  hub_total_funding = float(agent_totals["amount_usd_prorated"].sum())
  out["burden_share"] = out["burden_midpoint_weighted"] / total_burden if total_burden else np.nan
  out["funding_share"] = out["rd_funding_usd_matched"] / hub_total_funding if hub_total_funding else np.nan
  out["funding_minus_burden_share"] = out["funding_share"] - out["burden_share"]
  return out


def main():
  failed = False
  funding_long = load_rd_projects_prorated()
  projects_path = resolve_rd_projects_path()

  # Year-bucketed R&D funding totals (bacterial vs fungal) for the dashboard's
  # funding-by-year view — same pro-rata amounts as the rest of this step,
  # grouped by Start Year instead of organism. Rows with no valid Start Year
  # are excluded (count printed, never silently dropped).
  DELIVERABLES_DIR.mkdir(parents=True, exist_ok=True)
  funding_long["start_year_numeric"] = pd.to_numeric(funding_long["start_year"], errors="coerce")
  funding_by_year_valid = funding_long[funding_long["start_year_numeric"].notna()].copy()
  n_excluded_year = len(funding_long) - len(funding_by_year_valid)
  funding_by_year_valid["start_year_numeric"] = funding_by_year_valid["start_year_numeric"].astype(int)
  funding_by_year = (
    funding_by_year_valid.groupby(["start_year_numeric", "pathogen_type"], as_index=False)["amount_usd_prorated"]
    .sum()
    .rename(columns={"start_year_numeric": "start_year", "amount_usd_prorated": "amount_usd_prorated_total"})
    .sort_values(["start_year", "pathogen_type"])
  )
  funding_by_year["version"] = "v1"
  funding_by_year["date_added"] = TODAY
  funding_by_year_path = DELIVERABLES_DIR / "funding_by_year_summary_v1.csv"
  funding_by_year.to_csv(funding_by_year_path, index=False)
  print(f"Excluded {n_excluded_year} project-agent row(s) with no valid Start Year from funding-by-year summary.")
  print(f"Wrote {len(funding_by_year)} funding-by-year row(s) to {funding_by_year_path.name}")

  by_year_total = float(funding_by_year["amount_usd_prorated_total"].sum())
  expected_total = float(funding_by_year_valid["amount_usd_prorated"].sum())
  if abs(by_year_total - expected_total) > 0.01:
    print(f"FAIL: funding-by-year total {by_year_total} does not match included-row total {expected_total}")
    failed = True
  else:
    print(
      f"PASS: funding-by-year totals conserve the included project-agent amounts "
      f"(diff {abs(by_year_total - expected_total):.6f})."
    )

  rd_raw = pd.read_excel(projects_path, sheet_name="data")
  rd_raw["amount_usd"] = pd.to_numeric(rd_raw["Amount USD"], errors="coerce").fillna(0.0)
  summed = funding_long.groupby("project_id")["amount_usd_prorated"].sum()
  original = rd_raw.set_index("Id")["amount_usd"]
  common = summed.index.intersection(original.index)
  max_diff = (summed.loc[common] - original.loc[common]).abs().max()
  if max_diff > 0.01:
    print(f"FAIL: pro-rated funding sums differ from original Amount USD by up to {max_diff}")
    failed = True
  else:
    print(f"PASS: pro-rated funding shares sum to original Amount USD per project (max diff {max_diff:.6f}).")

  # S6: Hub modality + SSA geography composition (project Amount USD, exclusive buckets).
  DELIVERABLES_DIR.mkdir(parents=True, exist_ok=True)
  hub_summary, hub_detail = build_hub_funding_composition(rd_raw)
  hub_summary_path = DELIVERABLES_DIR / "hub_funding_composition_summary_v1.csv"
  hub_detail_path = BOUNDS_DIR / "hub_funding_composition_by_project_v1.csv"
  hub_summary.to_csv(hub_summary_path, index=False)
  hub_detail.to_csv(hub_detail_path, index=False)
  for dim, grp in hub_summary.groupby("composition_dimension"):
    share_sum = float(grp["share_of_hub_total"].sum())
    if abs(share_sum - 1.0) > 1e-6:
      print(f"FAIL: Hub composition shares for {dim} sum to {share_sum}, expected 1.0")
      failed = True
    else:
      print(f"PASS: Hub composition shares for {dim} sum to 1.0.")
  expected_modality = {"diagnostics", "therapeutics_drugs", "vaccines", "product_mixed", "other_or_unclassified"}
  expected_geo = {"ssa", "non_ssa", "geography_unknown"}
  mod_buckets = set(hub_summary.loc[hub_summary["composition_dimension"] == "modality", "bucket"])
  geo_buckets = set(hub_summary.loc[hub_summary["composition_dimension"] == "geography", "bucket"])
  if mod_buckets != expected_modality:
    print(f"FAIL: modality buckets {sorted(mod_buckets)} != {sorted(expected_modality)}")
    failed = True
  else:
    print("PASS: modality emits all expected buckets.")
  if geo_buckets != expected_geo:
    print(f"FAIL: geography buckets {sorted(geo_buckets)} != {sorted(expected_geo)}")
    failed = True
  else:
    print("PASS: geography emits all expected buckets.")
  print(f"Wrote Hub composition summary ({len(hub_summary)} rows) to {hub_summary_path.name}")
  print(f"Wrote Hub composition project detail to {hub_detail_path.name}")
  print(f"Hub Projects.xlsx path: {projects_path}")

  bact_desc = pd.read_csv(BOUNDS_DIR / "descriptive_bacterial_resistance_v1.csv")
  fung_desc = pd.read_csv(BOUNDS_DIR / "descriptive_fungal_ecv_wt_rate_v1.csv")
  bact_burden = organism_burden_global(bact_desc, weight_col="n_tested", invert=False)
  fung_burden = organism_burden_global(fung_desc, weight_col="n_classified", invert=True)

  bact_align = align_funding_to_organisms(bact_burden, funding_long, "bacterial")
  fung_align = align_funding_to_organisms(fung_burden, funding_long, "fungal")

  for df in (bact_align, fung_align):
    df["prorata_caveat"] = PRORATA_CAVEAT
    df["version"] = "v1"
    df["date_added"] = TODAY
  bact_align["burden_coverage_note"] = BACTERIAL_BURDEN_NOTE
  fung_align["burden_coverage_note"] = (
    "Fungal burden uses ECV-tier WT/NWT rates (same tier as Stages 13–14)."
  )

  bact_align.sort_values("funding_minus_burden_share", ascending=False).to_csv(
    BOUNDS_DIR / "rd_alignment_bacterial_by_organism_v1.csv", index=False
  )
  fung_align.sort_values("funding_minus_burden_share", ascending=False).to_csv(
    BOUNDS_DIR / "rd_alignment_fungal_by_organism_v1.csv", index=False
  )

  summary_rows = []
  for pathogen_type, align in [("bacterial", bact_align), ("fungal", fung_align)]:
    sub_fund = funding_long[funding_long["pathogen_type"] == pathogen_type]
    total_funding = sub_fund["amount_usd_prorated"].sum()
    total_burden = align["burden_midpoint_weighted"].sum()
    mask = (align["burden_midpoint_weighted"] > 0) & (align["rd_funding_usd_matched"] > 0)
    spearman_n = int(mask.sum())
    if spearman_n >= SPEARMAN_MIN_N:
      rho, pval = spearmanr(
        align.loc[mask, "burden_midpoint_weighted"],
        align.loc[mask, "rd_funding_usd_matched"],
      )
      reliability_flag = "too_thin_for_interpretation" if spearman_n < SPEARMAN_THIN_N else ""
    else:
      rho, pval = np.nan, np.nan
      reliability_flag = "not_computed_below_min_n"
    summary_rows.append(
      {
        "pathogen_type": pathogen_type,
        "n_organisms": len(align),
        "n_organisms_with_matched_funding": int((align["rd_funding_usd_matched"] > 0).sum()),
        "total_burden_midpoint_weighted": total_burden,
        "total_rd_funding_usd_prorated": total_funding,
        "spearman_n": spearman_n,
        "spearman_rho_burden_vs_funding": rho,
        "spearman_p_value": pval,
        "spearman_reliability_flag": reliability_flag,
        "spearman_note": "novel_application_no_amr_precedent_found",
        "prorata_caveat": PRORATA_CAVEAT,
        "version": "v1",
        "date_added": TODAY,
      }
    )
  pd.DataFrame(summary_rows).to_csv(BOUNDS_DIR / "rd_alignment_summary_v1.csv", index=False)

  # --- Check: Candida species do not each carry the full undivided Candida agent total ---
  fung_candida = fung_align[fung_align["canonical_organism"].str.startswith("Candida")]
  candida_agent_total = float(
    funding_long[
      (funding_long["pathogen_type"] == "fungal") & (funding_long["agent"] == "Candida")
    ]["amount_usd_prorated"].sum()
  )
  if len(fung_candida) >= 2 and candida_agent_total > 0:
    if fung_candida["rd_funding_usd_matched"].max() >= candida_agent_total * 0.99:
      print("FAIL: fungal Candida rows still carry the full undivided Candida agent total.")
      failed = True
    else:
      print("PASS: fungal Candida funding is split below the full Candida agent total.")

  print(f"Wrote {len(bact_align)} bacterial and {len(fung_align)} fungal organism alignment row(s).")

  if failed:
    print("\nStep 16 Check: FAIL")
    sys.exit(1)
  print("\nStep 16 Check: PASS")


if __name__ == "__main__":
  main()
