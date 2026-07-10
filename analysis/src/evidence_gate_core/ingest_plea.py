"""Clean PLEA Study I for Evidence Gate validation."""
from __future__ import annotations

import datetime as dt
from pathlib import Path

import pandas as pd

from .paths import PLEA_CLEAN, PLEA_RAW, CLEANED


def _plea_carbapenemase_positive(phenotypic: str) -> bool:
    if pd.isna(phenotypic):
        return False
    upper = str(phenotypic).upper()
    return "MBL" in upper or "CARBAPENEMASE" in upper


def clean_plea(raw_path: Path = PLEA_RAW, out_path: Path = PLEA_CLEAN) -> pd.DataFrame:
    if not raw_path.exists():
        raise FileNotFoundError(f"PLEA raw file not found: {raw_path}")

    df = pd.read_excel(raw_path, header=1)
    df = df.rename(columns=lambda c: str(c).strip())
    df["carbapenemase_positive"] = df["Phenotypic Combination"].map(_plea_carbapenemase_positive)
    df["meropenem_mic"] = pd.to_numeric(df["Meropenem"], errors="coerce")
    df["imipenem_mic"] = pd.to_numeric(df["Imipenem"], errors="coerce")
    df["complete_result"] = True

    out_path.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(out_path, index=False)

    log_path = out_path.parent / "cleaning_log_plea_v1.csv"
    pd.DataFrame(
        [
            {
                "cohort": "PLEA_I",
                "raw_rows": len(df),
                "carbapenemase_positive_rows": int(df["carbapenemase_positive"].sum()),
                "observed_prevalence": float(df["carbapenemase_positive"].mean()),
                "version": "v1",
                "date_added": dt.date.today().isoformat(),
            }
        ]
    ).to_csv(log_path, index=False)
    return df
