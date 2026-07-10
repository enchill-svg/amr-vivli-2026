# Raw data (team only — not committed)

Place Vivli Register cohort files and external datasets here for local pipeline runs.

**Typical layout (operator setup):**

| Path | Contents |
|------|----------|
| `surveillance/` | SOAR ×3, SENTRY, EUCAST breakpoints |
| `external/` | Life expectancy, vaccination, Hub R&D, ESAC when available |
| `register/` | ATLAS, PLEA, other Register datasets |

**Legacy paths (still work until migrated):**

- `analysis/raw_inputs/` — preprocessing cohort copies
- `analysis/docs/AMR_Datasets/` — full Register mirror
- `analysis/docs/new_datasets/` — external join files

Raw Vivli files are **never pushed to GitHub** (data use agreements). Published analytical outputs live in [`../published/`](../published/).
