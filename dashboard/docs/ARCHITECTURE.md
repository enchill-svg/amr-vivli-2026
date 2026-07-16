# Architecture

```text
Uploaded datasets
   ↓
Raw file landing zone
   ↓
Schema detection + profiling
   ↓
Versioned crosswalks
   ↓
Validation logs
   ↓
Long-format master isolate–drug table
   ↓
Country-year external joins
   ↓
Statistical and ML model outputs
   ↓
Policy recommendation engine
   ↓
Live dashboard views + reports + AI assistant
```

## Frontend

- TanStack Router
- React
- TypeScript
- TailwindCSS
- shadcn/ui
- React Query
- Recharts
- Leaflet

## Analytical data

- The Python pipeline in `analysis/` publishes `dashboard_bundle_v1.json` to `data/published/` and syncs it into `dashboard/public/data/published/`.
- The frontend fetches that static bundle directly (`dashboard/src/lib/published-data.ts`, `BUNDLE_URL = "/data/published/dashboard_bundle_v1.json"`) — there is no live database query in the AMR data path. Supabase/PostgreSQL is used elsewhere in the app for authentication and admin tooling only.
- Bundle keys include `countryRiskBacterial`/`countryRiskFungal` (country-level risk, burden, trajectory, life expectancy fields), `interventions`, `fundingGap`, and other Stage 7 deliverables — see `DashboardBundle` in `published-data.ts` for the full shape.

## AI assistant

The assistant route is designed for tool-calling against the published analytical data. It separates observed evidence from model estimates and should always surface uncertainty.
