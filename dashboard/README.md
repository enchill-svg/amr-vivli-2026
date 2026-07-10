# AMR Life Expectancy Intelligence Platform

Scientific decision-support UI built on the ViralTrack-Afrika command-center template. Core AMR views are wired to **published pipeline outputs**; some legacy template routes still use Supabase or demo data.

## Primary data source (competition path)

After `python analysis/run_all.py`, the pipeline publishes:

```text
public/data/published/dashboard_bundle_v1.json
public/data/published/dataset_status_v1.json
```

The app loads the bundle at runtime via `src/lib/published-data.ts` → `src/lib/amr-data.functions.ts`.

| Bundle section | Dashboard use |
|----------------|---------------|
| `countryRiskBacterial` / `countryRiskFungal` | Map, country explorer, risk KPIs (`risk_rank_core`) |
| `clusterTypology*` | Pathogen signals, evolution views |
| `fundingGap` | Funding gap explorer |
| `interventions` | Policy page (gated ranks; may be empty by integrity policy) |
| `gatingComparison`, `identifiabilityLedger` | Methodology / transparency |

**Fallback:** if the bundle fails to load, `amr-demo-data.ts` supplies a single demo country row (dev only).

## Routes using published pipeline data

| Route | Module |
|-------|--------|
| `/` | Executive overview — map, risk ranking, signals, funding |
| `/alerts` | Global AMR risk map |
| `/countries` | Country explorer |
| `/pathogens` | Resistance explorer |
| `/lineages` | Evolution explorer (signals from bundle; time series partly synthetic) |
| `/epidemiology` | Life expectancy explorer (LE not yet joined in bundle — placeholder `0`) |
| `/policy` | Intervention table from gated CSV |
| `/marketplace` | Funding gap explorer |
| `/forecasting` | Cluster typology insights |

## Legacy / optional routes (not pipeline-backed)

These remain from the ViralTrack template and use **Supabase** and/or static demo content:

`/genomics`, `/lab-network`, `/environment`, `/search`, `/alerts` (viral), admin pages, `/assistant`, etc.

Supabase is optional for the AMR competition demo path if the published bundle is present.

## Run locally

```bash
bun install   # or: npm install
bun run dev   # → http://localhost:5173
```

Ensure the bundle exists (run the analysis pipeline first, or copy from `data/published/`):

```bash
cd ../analysis && python run_all.py
```

Re-publish only:

```bash
python ../analysis/scripts/publish_dashboard_data.py
```

## Build and typecheck

```bash
bun run build
bun run typecheck
```

## Supabase (optional)

For legacy surveillance features (genomics, sentinel sites, auth). Create `.env`:

```bash
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_anon_key
SUPABASE_URL=your_supabase_url
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
LOVABLE_API_KEY=your_lovable_ai_gateway_key
```

Migration: `supabase/migrations/20260708234500_amr_life_intelligence_core.sql`

## Scientific design choices (dashboard-facing)

- **Gated deliverables only** in the public bundle (`quality_gate`: `pass`, `bounds_only`, `withhold`).
- **Primary country rank:** `risk_rank_core` (3-component composite). Consumption is supplementary.
- **Interventions:** no fabricated life-expectancy gains; withheld scenarios show caveats, not priority ranks.
- **Resistance / fungal:** pairs without breakpoints stay bounds-only; do not read as false S/R categories.
- **Life expectancy charts:** association views only until LE is joined into the publish bundle.

## Known gaps (honest demo scope)

- Life expectancy and predicted intervention gain are not fully wired in the bundle loader yet.
- `getResistanceSeries()` uses a short synthetic year series derived from country averages, not raw surveillance time series.
- Footer/ticker “live” labels mean **bundle refresh every 60s**, not a streaming database.
