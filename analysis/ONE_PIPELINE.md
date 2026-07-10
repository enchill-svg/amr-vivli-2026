# One Pipeline

**Entry point:** `python run_all.py` from `analysis/`

This is the only production run command. It executes every stage in order, halts on the first failure, and writes a run manifest so nothing lives only in background folders.

## What runs (29 stages, 5 phases)

| Phase | Stages | Output location |
|-------|--------|-----------------|
| **preprocessing** | Steps 1–10 + acceptance check (13 stages) | `master/`, `crosswalks/`, `exceptions/` |
| **integrity** | ATLAS/PLEA clean, bounds, sampling validation, allocator, export validator | `cleaned/`, `bounds/` |
| **analytics** | Section 6 Stages 1–7 (steps 11–17) | `bounds/`, `deliverables/` |
| **deliverables** | Justice §7 ungated + gated (steps 18, 18b) | `deliverables/` |
| **verification** | Figure checks + publish to `data/published/` | console + `data/published/` |

Final two verification stages:

1. `verify_all_figures.py` — integrity proof numbers + Justice gating checks (EG-*, J-*)
2. `publish_dashboard_data.py` — copy deliverables → `data/published/`, build `dashboard_bundle_v1.json`, sync to `dashboard/public/data/published/`

## After every run

| File | Purpose |
|------|---------|
| `runs/<run_id>/pipeline_run_manifest_v1.json` | Full run summary — phases, pass/fail, deliverable presence, documented data gaps |
| `runs/<run_id>/pipeline_run_stages_v1.csv` | Flat stage log |
| `runs/latest/` | Copy of the most recent run |
| `data/published/dashboard_bundle_v1.json` | Dashboard-facing JSON (gated deliverables) |
| `data/published/dataset_status_v1.json` | External dataset wiring status |

## Preprocessing only

For Section 5 harmonization without analytics:

```bash
python run_pipeline.py
```

Still writes a run manifest under `runs/<run_id>/`.

## Re-publish without full rerun

```bash
python scripts/publish_dashboard_data.py
```

Use after deliverables already exist (e.g. after a targeted step18/18b fix).

## Do not

- Run individual `src/step*.py` scripts for production — use `run_all.py`
- Treat `bounds/` as a separate product — it is intermediate output between stages
- Hand-copy CSVs to `data/published/` — use `publish_dashboard_data.py`
- Expect end users to see repo folders — they see the bundle through the deployed dashboard

## Latest successful run

Check `runs/latest/pipeline_run_manifest_v1.json` for status, duration, and which Justice §7 files were produced.
