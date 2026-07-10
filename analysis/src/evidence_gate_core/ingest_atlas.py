"""Clean ATLAS Klebsiella pneumoniae subset for Evidence Gate."""
from __future__ import annotations

import datetime as dt
from pathlib import Path

import pandas as pd

from .carbapenemase import add_atlas_kp_flags
from .estimands import ATLAS_KP_SPECIES
from .paths import ATLAS_KP_CLEAN, ATLAS_RAW, CLEANED, GENE_COLUMNS


def clean_atlas_kp(raw_path: Path = ATLAS_RAW, out_path: Path = ATLAS_KP_CLEAN) -> pd.DataFrame:
    if not raw_path.exists():
        raise FileNotFoundError(f"ATLAS raw file not found: {raw_path}")

    usecols = ["Isolate Id", "Species", "Country", "Year", "Meropenem", "Meropenem_I"] + GENE_COLUMNS
    df = pd.read_csv(raw_path, usecols=usecols, low_memory=False)
    kp = df[df["Species"] == ATLAS_KP_SPECIES].copy()
    kp = add_atlas_kp_flags(kp)
    kp["meropenem_mic"] = pd.to_numeric(kp["Meropenem"], errors="coerce")
    kp["meropenem_nonsusceptible"] = kp["Meropenem_I"].isin(["Resistant", "Intermediate"])

    out_path.parent.mkdir(parents=True, exist_ok=True)
    kp.to_csv(out_path, index=False)

    log_path = out_path.parent / "cleaning_log_atlas_kp_v1.csv"
    pd.DataFrame(
        [
            {
                "cohort": "ATLAS",
                "organism_filter": ATLAS_KP_SPECIES,
                "raw_rows": len(df),
                "cleaned_rows": len(kp),
                "gene_recorded_rows": int(kp["gene_recorded"].sum()),
                "carbapenemase_positive_rows": int(kp["carbapenemase_positive"].sum()),
                "version": "v1",
                "date_added": dt.date.today().isoformat(),
            }
        ]
    ).to_csv(log_path, index=False)
    return kp
