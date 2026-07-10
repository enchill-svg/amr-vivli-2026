"""One-off inventory of ESAC trend exports in new_datasets/."""
from pathlib import Path

import pandas as pd

base = Path(__file__).resolve().parents[1] / "docs" / "new_datasets"
files = sorted(base.glob("Trend*.XLSX")) + sorted(base.glob("esac_*_j01_subgroup_trend.xlsx"))
rows = []
for p in files:
    df = pd.read_excel(p)
    years = sorted(df["Year"].unique())
    j01 = df[df["ATCCode"].astype(str).str.startswith("J01", na=False)]
    j01_2024 = (
        float(j01.loc[j01["Year"] == 2024, "DDD per 1000 inhabitants per day"].sum())
        if 2024 in years
        else None
    )
    j01_2023 = (
        float(j01.loc[j01["Year"] == 2023, "DDD per 1000 inhabitants per day"].sum())
        if 2023 in years
        else None
    )
    sig = (len(years), round(j01_2024 or -1, 4), round(j01_2023 or -1, 4))
    rows.append(
        {
            "file": p.name,
            "n_years": len(years),
            "year_min": years[0] if years else None,
            "year_max": years[-1] if years else None,
            "j01_2024": j01_2024,
            "j01_2023": j01_2023,
            "sig": sig,
        }
    )

summary = pd.DataFrame(rows)
print(f"TOTAL FILES: {len(summary)}")
print(f"UNIQUE SIGNATURES (likely unique countries): {summary['sig'].nunique()}")
print()
for sig, grp in summary.groupby("sig"):
    print(f"--- signature {sig} ---")
    for _, r in grp.iterrows():
        j24 = f"{r['j01_2024']:.3f}" if r["j01_2024"] is not None else "NA"
        print(
            f"  {r['file']}: years {r['year_min']}-{r['year_max']} "
            f"({r['n_years']} yrs), J01 2024={j24}"
        )
print()
partial = summary[summary["n_years"] < 20]
print(f"PARTIAL YEAR EXPORTS (<20 years): {len(partial)}")
for _, r in partial.iterrows():
    print(f"  {r['file']}: {r['n_years']} years")
