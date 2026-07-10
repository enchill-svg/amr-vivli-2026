# AMR, Life Expectancy, and Intervention Impact

**2026 Vivli AMR Surveillance Data Challenge**

Integrated bacterial and fungal surveillance linked to national life expectancy, R&D funding alignment, and ranked intervention scenarios — with an integrity layer for identifiability before any public claim.

## Team

AMR-Vivli 2026 team (5 members). See project brief in [`docs/brief/`](docs/brief/).

## Live dashboard

> **Local:** `cd dashboard && bun install && bun run dev` → http://localhost:5173  
> **Deployed:** *(add URL when live)*

The dashboard reads **published pipeline outputs** from `dashboard/public/data/published/dashboard_bundle_v1.json` (synced automatically at the end of `run_all.py`). Core AMR routes show gated Justice §7 deliverables; legacy ViralTrack routes may still use Supabase or demo fallbacks.

## Repository map

| Folder | Who sees it | Purpose |
|--------|-------------|---------|
| [`dashboard/`](dashboard/) | Everyone | Web app (TanStack Start) |
| [`analysis/`](analysis/) | Researchers | One-pipeline Python engine (`run_all.py`) |
| [`data/published/`](data/published/) | Everyone | Justice §7 CSVs + JSON bundle for GitHub and dashboard |
| [`data/raw/`](data/raw/) | Team only (gitignored) | Vivli Register files — not on GitHub |
| [`docs/brief/`](docs/brief/) | Everyone | Project brief and public methodology |
| `internal/` | Team only (gitignored) | Submission planning |

## Reproduce the science (one command)

```bash
cd analysis
python run_all.py
```

Requires raw cohort files locally (see [`data/raw/README.md`](data/raw/README.md) and [`analysis/raw_inputs/README.md`](analysis/raw_inputs/README.md)).

On success:

- Analytical outputs in `analysis/deliverables/`
- Run manifest in `analysis/runs/latest/pipeline_run_manifest_v1.json`
- **Auto-publish** to `data/published/` and `dashboard/public/data/published/` (stage `publish_dashboard_data`)

Manual re-publish only if needed:

```bash
python analysis/scripts/publish_dashboard_data.py
```

## Integrity and public-facing policy

- **Dashboard bundle uses gated deliverables** (`*_gated_v1.csv`) with `quality_gate` applied before any public ranking.
- **Country risk primary rank:** `risk_rank_core` (3-component composite: burden, trajectory, health capacity). ESAC consumption is supplementary where matched.
- **Interventions:** measured vaccination scenarios (Hib, PCV) are **withheld from public priority ranks** when evidence fails integrity gates (current policy: zero gated intervention ranks). Ungated internal CSVs remain in `analysis/deliverables/` for audit.

## Data access

Surveillance data from the **Vivli AMR Register** (SOAR, SENTRY, ATLAS, PLEA, etc.) under data use agreements.  
**Raw industry datasets are not included in this repository.** Request access at [amr.vivli.org](https://amr.vivli.org/).

## Justice Section 7 deliverables

| # | Output | Primary file in `data/published/` |
|---|--------|-----------------------------------|
| 1 | Harmonized dataset + crosswalks | `dataset_manifest_v1.csv` |
| 2 | Identifiability ledger | `identifiability_ledger_v1.csv` |
| 3 | Cluster typology | `cluster_typology_*_gated_v1.csv` |
| 4 | Country risk ranking | `country_risk_ranking_*_gated_v1.csv` |
| 5 | Funding-gap summary | `funding_gap_summary_v1.csv` |
| 6 | Ranked interventions | `intervention_recommendations_ranked_gated_v1.csv` |

**Dashboard JSON bundle:** `dashboard_bundle_v1.json` (aggregates gated CSVs for the web app).  
**Dataset wiring status:** `dataset_status_v1.json`.

See [`data/published/README.md`](data/published/README.md) and [`analysis/ONE_PIPELINE.md`](analysis/ONE_PIPELINE.md) for publish details.

## License

See [LICENSE](LICENSE).
