# AMR, Life Expectancy, and Intervention Impact

**2026 Vivli AMR Surveillance Data Challenge**

Antimicrobial resistance is not only a lab result. It is a pattern that spreads across countries, health systems, and years. Some organism and drug combinations are already dangerous. Others are still moving. We built this project to ask where those patterns line up with shorter lives, misaligned research funding, and interventions that might actually help.

The repository contains a reproducible analysis pipeline, a public web dashboard, and the derived tables that connect both.

## Overview

We harmonized four Vivli surveillance cohorts (three SOAR bacterial programs and the SENTRY antifungal cohort) into one analytical master of roughly 34,800 isolates. We then linked country year summaries to external data on life expectancy, antibiotic consumption, vaccination, health system capacity, and public AMR research funding.

From that joined dataset we produce:

- Country risk rankings that combine resistance burden, trajectory, and health capacity
- Organism and drug signals, including pairs with steep evolutionary movement
- A funding gap view that compares surveillance burden to R&D investment
- Intervention scenarios with explicit quality gates before anything is promoted publicly

This is association work, not a causal trial. We state that plainly in the methods and in what we choose to publish.

## Five questions we set out to answer

1. Which resistance profiles, bacterial or fungal, tend to appear alongside the lowest national life expectancy?
2. Do those patterns track more closely with antibiotic use, weak health capacity, low vaccination coverage, or hospital exposure patterns, and does that differ between bacteria and fungi?
3. Where does AMR research funding go compared with where surveillance shows the heaviest burden?
4. Which organism and drug pairs are not yet top burden today but show the steepest trajectory, so early action might matter most?
5. Which intervention types could plausibly recover the most life years in the highest burden or highest trajectory settings, where the evidence allows an estimate?

The dashboard is how judges and the public explore those answers. The Python pipeline is how we reproduce them from raw inputs.

## What is in this repository

| Part | What it is |
|------|------------|
| [`dashboard/`](dashboard/) | Web app: maps, country risk, resistance signals, funding gap, intervention table |
| [`analysis/`](analysis/) | One command pipeline from raw harmonization through final deliverables |
| [`data/published/`](data/published/) | Tables and JSON safe to share on GitHub and load in the dashboard |
| [`analysis/crosswalks/`](analysis/crosswalks/) | Country, drug, organism, and breakpoint harmonization tables |

Raw Vivli register files are not in this repository. They stay on secure storage under the team data use agreement. See [Data access](#data-access) below.

## Try the dashboard

From the repository root:

```bash
cd dashboard
npm install
npm run dev
```

Open the local URL printed in the terminal (often `http://localhost:5173` or `http://localhost:8080`).

The app reads `dashboard/public/data/published/dashboard_bundle_v1.json`, which is copied automatically when the analysis pipeline finishes.

| Route | What you see |
|-------|----------------|
| `/` | Overview, world map, country risk strip |
| `/alerts` | Full screen risk map |
| `/countries` | Country explorer |
| `/pathogens` | Organism and drug signals |
| `/marketplace` | Funding gap by pathogen |
| `/policy` | Gated intervention table |
| `/methodology` | Methods and provenance |

If the bundle fails to load, the app falls back to a single demo country. That should not happen in a normal clone of this repo after a successful publish.

## Reproduce the analysis

You need Python 3 with `pandas`, `numpy`, `scipy`, `statsmodels`, and `scikit-learn`, plus the six raw input files described in [`analysis/raw_inputs/README.md`](analysis/raw_inputs/README.md).

```bash
cd analysis
python run_all.py
```

One successful run:

1. Harmonizes SOAR and SENTRY into a single analytical master
2. Runs the integrity layer on detection only genotypes and breakpoint gaps
3. Computes burden, trajectory, clustering, external joins, life expectancy association, funding alignment, and intervention scenarios
4. Writes the six competition deliverables
5. Applies public quality gating
6. Verifies headline checks
7. Publishes CSVs and `dashboard_bundle_v1.json` to `data/published/` and syncs them into the dashboard

The run manifest lives at `analysis/runs/latest/pipeline_run_manifest_v1.json`. Published copies for judges are under `data/published/runs/latest/`.

To refresh the dashboard bundle without a full rerun:

```bash
python analysis/scripts/publish_dashboard_data.py
```

Methodological detail for developers lives in [`analysis/README.md`](analysis/README.md). Publish file lists are in [`data/published/README.md`](data/published/README.md).

## How we keep the science honest

Hospital surveillance is powerful and incomplete. Some rows only tell us that a resistance gene was detected, not how common it is in the population. Many fungal drug and species pairs lack a standard clinical breakpoint, so we report ranges instead of false susceptible or resistant labels.

Before anything reaches the public dashboard or the gated CSV layer, we run an integrity pass:

| Check | What it means in practice |
|-------|---------------------------|
| Identifiability ledger | Every known detection only or breakpoint absent field is listed with its limits |
| Quality gate on deliverables | Rows can be `pass`, `bounds_only`, or `withhold` |
| Gated public tables | The dashboard and `data/published/*_gated_v1.csv` use the gated layer only |
| Intervention policy | Measured vaccination scenarios that fail our gates are shown with caveats, not promoted as top policy picks |

Country risk ranking on the public site uses `risk_rank_core`, a three part score (burden, trajectory, health capacity) so countries with and without consumption data stay comparable. ESAC consumption is included where we have a country year match.

We would rather show an empty ranked intervention list than rank a confounded estimate.

## Published outputs

| # | Deliverable | File in `data/published/` |
|---|-------------|---------------------------|
| 1 | Harmonized dataset manifest and crosswalks | `dataset_manifest_v1.csv` plus `analysis/crosswalks/` |
| 2 | Identifiability ledger | `identifiability_ledger_v1.csv` |
| 3 | Cluster typology | `cluster_typology_*_gated_v1.csv` |
| 4 | Country risk ranking | `country_risk_ranking_*_gated_v1.csv` |
| 5 | Funding gap summary | `funding_gap_summary_v1.csv` |
| 6 | Intervention recommendations | `intervention_recommendations_ranked_gated_v1.csv` |

Supporting files: `dashboard_bundle_v1.json`, `dataset_status_v1.json`, `gating_comparison_v1.csv`, `association_sensitivity_manifest_v1.csv`, `q2_driver_evidence_summary_v1.csv`.

## What we know is still thin

Life expectancy is joined in the pipeline and wired into the dashboard: the country explorer and life expectancy views show real per country, per year figures from the gated country-year panel, and predicted intervention gain is only shown once at least 3 measured interventions support it, otherwise it reads as not enough data rather than a fabricated number. Time trend charts aggregate by year across whichever countries reported that year; they are not isolate level longitudinal cohorts. Only a small set of countries support long bacterial MIC trajectories across cohorts. Fungal burden and funding alignment is weak in the data we have. Hospital acquired exposure is not modeled directly.

We treat those limits as part of the finding, not as footnotes to hide.

## Data access

Surveillance data come from the [Vivli AMR Register](https://amr.vivli.org/) under cohort specific agreements. SOAR, SENTRY, ATLAS, and PLEA each have their own terms. External indicators include WHO and World Bank life expectancy and health capacity, ECDC ESAC Net consumption where matched, and Global AMR R&D Hub funding summaries.

You can reproduce our tables from `data/published/` and our code without the raw register files. To rebuild from isolates, apply for access through Vivli and place files locally as described in `analysis/raw_inputs/README.md`.

## Team

Five member team, 2026 Vivli AMR Surveillance Data Challenge.

## License

See [LICENSE](LICENSE).
