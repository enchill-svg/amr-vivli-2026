# Repository structure

Hybrid layout inspired by 2025 Vivli winners (Cande product + Leclerc reproducibility).

```text
amr-vivli-2026/
├── README.md              ← start here (pitch, dashboard, reproduce)
├── dashboard/             ← web app (public, tracked)
├── analysis/              ← Python one-pipeline (public, tracked)
│   ├── run_all.py
│   ├── src/
│   ├── deliverables/      ← generated Justice §7 outputs
│   ├── crosswalks/        ← methodology transparency
│   ├── bounds/            ← intermediate analytics (still tracked; move to gitignore later)
│   └── docs/              ← raw Vivli data (gitignored)
├── data/
│   ├── published/         ← copy for GitHub + dashboard (public, tracked)
│   └── raw/               ← future raw data home (gitignored)
├── docs/brief/            ← public project brief
└── internal/              ← team only (gitignored)
```

## What judges see on GitHub

1. **README** — project story and live dashboard link  
2. **dashboard/** — source code for the platform  
3. **analysis/run_all.py** — one command to reproduce  
4. **data/published/** — final tables and run manifest  

## What stays off GitHub

- Raw Vivli xlsx/csv (`analysis/docs/`, `analysis/raw_inputs/`, `data/raw/`)  
- Team submission drafts (`internal/`)  
- Secrets (`.env`)
