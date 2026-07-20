# Published analytical outputs

Competition deliverables, integrity gated tables, and the dashboard JSON bundle. Safe to share on GitHub and load in the web app.

## How this folder is updated

| Step | What happens |
|------|----------------|
| `python analysis/run_all.py` | Runs the full pipeline (30 stages), then auto publishes here |
| `python analysis/scripts/publish_dashboard_data.py` | Standalone re publish (copies CSVs, rebuilds JSON, syncs dashboard) |

Do not hand copy CSVs unless you are debugging publish. Use the script so the bundle and `dataset_status_v1.json` stay in sync.

## What gets written

| Artifact | Source | Purpose |
|----------|--------|---------|
| `*_gated_v1.csv` and supporting CSVs | `analysis/deliverables/` (+ `association_sensitivity_manifest_v1.csv` from `analysis/bounds/`) | Public competition tables |
| `runs/latest/pipeline_run_manifest_v1.json` | `analysis/runs/latest/` | Latest run provenance |
| `dashboard_bundle_v1.json` | Built by publish script from gated CSVs | Single JSON load for dashboard |
| `dataset_status_v1.json` | Built by publish script | Which external datasets were wired on the machine that ran the pipeline |

The publish script also copies `dashboard_bundle_v1.json` and `dataset_status_v1.json` to:

```text
dashboard/public/data/published/
```

## Dashboard bundle contents

`dashboard_bundle_v1.json` includes:

- `countryRiskBacterial` / `countryRiskFungal` from `country_risk_ranking_*_gated_v1.csv` (`risk_rank_core`, `quality_gate`)
- `countryYearBacterial` / `countryYearFungal` from `country_year_panel_*_gated_v1.csv` (per-country, per-year life expectancy and resistance panel)
- `clusterTypologyBacterial` / `clusterTypologyFungal` gated typology
- `interventions` from `intervention_recommendations_ranked_gated_v1.csv`
- `fundingGap`, `fundingByYear`, `hubFundingComposition`, `identifiabilityLedger`, `gatingComparison`
- `q2DriverSummary`, `associationSensitivity`, `deliverablesIndex`
- `pipeline_run.run_id` from the latest manifest

## Gated vs ungated

| Audience | Use |
|----------|-----|
| Public / dashboard | `*_gated_v1.csv` and `dashboard_bundle_v1.json` |
| Internal audit | Ungated files stay in `analysis/deliverables/` only (not on GitHub) |

Intervention ranks in the gated public layer may be empty when integrity gates withhold measured vaccination evidence. See `gating_comparison_v1.csv`.

## Hub funding composition (S6)

`hub_funding_composition_summary_v1.csv` summarizes Global AMR R&D Hub project dollars by modality (diagnostics / therapeutics_drugs / vaccines / product_mixed / other_or_unclassified) and by geography (ssa / non_ssa / geography_unknown). Shares use exclusive project-level `Amount USD` partitions from `Research Area` and Institution/Funder country → ISO3 (SSA via the same `SSA_ISO3` set as the pipeline; unmapped non-country labels stay `geography_unknown`). The Hub export excludes private/VC funding; see the project brief's Section 8. Pitch numbers for diagnostics % vs drugs and SSA share come from this file alongside `funding_gap_summary_v1.csv`. Denominator is all Hub project dollars, not the agent-tag subset used for organism RD alignment.

Teammate 2 optional follow-ups **S7** (blood-culture sampling share) and **DP4** (Supabase bundle mirror) are **wontfix** for the 2026 submission; the demo path is this static published layer.

## External datasets reflected in pipeline

Tracked in `dataset_status_v1.json`:

- ECDC ESAC Net consumption (where country year matched)
- World Bank hospital beds
- GBD 2023 SDI
- GBD LRI pathogen burden comparator

Hub Projects.xlsx also drives Step 16 organism alignment and `hub_funding_composition_summary_v1.csv` (not listed in `dataset_status_v1.json`).

## Working from GitHub only

If you clone this repo, you already have the gated CSVs and dashboard bundle needed to run the web app and review published results. You do not need a local pipeline run for that.

To rerun the pipeline from scratch you also need raw Vivli inputs and external join files on disk. See `analysis/raw_inputs/README.md` and `data/raw/README.md`.
