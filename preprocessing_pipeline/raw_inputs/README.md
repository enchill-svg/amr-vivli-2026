# Pipeline raw inputs

All source files the preprocessing pipeline reads on every run.
Place raw Vivli cohort files and EUCAST breakpoint tables here (not in `docs/`).

## Required files (6)

| Path under `raw_inputs/` | Used for |
|---|---|
| `SOAR 201818/gsk_201818_published.csv` | SOAR 201818 cohort |
| `SOAR 201910/GSK_SOAR_201910 raw data.xlsx` | SOAR 201910 cohort |
| `SOAR 207965/SOAR 207965 Complete data set 04Sep25.xlsx` | SOAR 207965 cohort |
| `ATLAS_Antifungals/vivli_sentry_2010_2024.xlsx` | SENTRY antifungal cohort |
| `EUCAST Clinical Breakpoint/v_8.1_Breakpoint_Tables.xlsx` | EUCAST breakpoints (SOAR 201818/201910) |
| `EUCAST Clinical Breakpoint/v_10.0_Breakpoint_Tables.xlsx` | EUCAST breakpoints (SOAR 207965) |

All paths are defined in `src/_data_paths.py`.
