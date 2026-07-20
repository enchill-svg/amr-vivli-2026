# Pipeline runs

Every `python run_all.py` execution writes one run record here.

| Path | Meaning |
|------|---------|
| `runs/<run_id>/pipeline_run_manifest_v1.json` | Full run summary: phases, stage pass/fail, brief deliverable presence |
| `runs/<run_id>/pipeline_run_stages_v1.csv` | Flat stage log for this run |
| `runs/latest/` | Copy of the most recent successful or failed run |

**Entry point:** `run_all.py` only. Do not run individual step scripts for production runs.

**Phases (in order):**

1. **preprocessing** — Section 5 harmonization (Steps 1–10)
2. **integrity** — ATLAS/PLEA proof, bounds, export validator
3. **analytics** — Section 6 Stages 1–7
4. **deliverables** — Section 7 outputs + gated variants
5. **verification** — post-run checks

When the dashboard is wired later, it reads `runs/latest/pipeline_run_manifest_v1.json` — not raw `bounds/` folders.
