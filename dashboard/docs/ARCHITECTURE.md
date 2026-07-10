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

## Analytical database

- Supabase/PostgreSQL in production
- The earlier platform backend can also load the same analytical model into PostgreSQL, DuckDB or SQLite.

## Live views

- `v_live_country_trends`: country-level risk, burden, trajectory, life expectancy and intervention fields.
- `v_live_pathogen_signals`: organism–drug signal table for resistance and evolutionary risk.

## AI assistant

The assistant route is designed for tool-calling against the analytical views. It separates observed evidence from model estimates and should always surface uncertainty.
