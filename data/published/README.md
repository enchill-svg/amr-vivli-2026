# Published analytical outputs

Justice Section 7 deliverables, integrity-gated variants, and the dashboard JSON bundle — safe to share on GitHub and wire into the web app.

## How this folder is updated

| Step | What happens |
|------|----------------|
| `python analysis/run_all.py` | Runs full pipeline (29 stages), then **auto-publishes** here |
| `python analysis/scripts/publish_dashboard_data.py` | Standalone re-publish (copies CSVs, rebuilds JSON, syncs dashboard) |

**Do not hand-copy CSVs** unless debugging publish — use the script so the bundle and `dataset_status_v1.json` stay in sync.

## What gets written

| Artifact | Source | Purpose |
|----------|--------|---------|
| `*.csv` | `analysis/deliverables/` (+ `association_sensitivity_manifest_v1.csv` from `analysis/bounds/`) | Justice §7 tables (ungated + gated) |
| `runs/latest/pipeline_run_manifest_v1.json` | `analysis/runs/latest/` | Latest run provenance |
| `dashboard_bundle_v1.json` | Built by publish script from **gated** CSVs | Single JSON load for dashboard |
| `dataset_status_v1.json` | Built by publish script | Which external datasets are wired on disk |

The publish script also copies `dashboard_bundle_v1.json` and `dataset_status_v1.json` to:

```text
dashboard/public/data/published/
```

## Dashboard bundle contents

`dashboard_bundle_v1.json` includes:

- `countryRiskBacterial` / `countryRiskFungal` — from `country_risk_ranking_*_gated_v1.csv` (`risk_rank_core`, `quality_gate`)
- `clusterTypologyBacterial` / `clusterTypologyFungal` — gated typology
- `interventions` — from `intervention_recommendations_ranked_gated_v1.csv`
- `fundingGap`, `identifiabilityLedger`, `gatingComparison`
- `q2DriverSummary`, `associationSensitivity`, `deliverablesIndex`
- `pipeline_run.run_id` — from latest manifest

## Gated vs ungated

| Audience | Use |
|----------|-----|
| **Public / dashboard** | `*_gated_v1.csv` and `dashboard_bundle_v1.json` |
| **Internal audit** | Ungated files remain in `analysis/deliverables/` only |

Intervention ranks in the gated/public layer may be empty when integrity gates withhold measured vaccination evidence (see `gating_comparison_v1.csv`).

## External datasets reflected in pipeline

Tracked in `dataset_status_v1.json`:

- ECDC ESAC-Net consumption (where country-year matched)
- World Bank hospital beds
- GBD 2023 SDI
- GBD LRI pathogen burden comparator
