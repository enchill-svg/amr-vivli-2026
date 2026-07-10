"""Validate surveillance exports for denominator reconstructability."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

DETECTION_ONLY_GENE_COLS = {"NDM", "KPC", "VIM", "IMP", "OXA", "GES", "SPM", "GIM"}
NEGATIVE_TOKENS = {"NEG", "NEGATIVE", "NOT DETECTED", "NOT_DETECTED", "0", "-"}


def validate_export(df: pd.DataFrame, *, name: str = "export") -> dict:
    gene_cols = [c for c in df.columns if c.upper() in DETECTION_ONLY_GENE_COLS]
    flags = []
    status = "PASS"

    if not gene_cols:
        flags.append("no_carbapenemase_gene_columns_detected")
        return {"file": name, "status": "PASS", "flags": flags, "reason": "no_detection_only_genotype_fields"}

    for col in gene_cols:
        non_blank = df[col].notna() & (df[col].astype(str).str.strip() != "")
        if not non_blank.any():
            continue
        values = df.loc[non_blank, col].astype(str).str.strip().str.upper()
        has_negative = values.isin(NEGATIVE_TOKENS) | values.str.contains("NOT DETECTED", na=False)
        if not has_negative.any():
            flags.append(f"detection_only_no_negatives:{col}")
            status = "FLAG"

    has_outcome = any(
        c in df.columns
        for c in ("carbapenemase_positive", "Phenotypic Combination", "BETALACTAMASE", "Betalactamase", "Beta Lactamase")
    )
    if status == "PASS" and has_outcome:
        reason = "complete_result_or_no_detection_only_fields"
    elif status == "FLAG":
        reason = "detection_only_genotype_without_negative_tracking"
    else:
        reason = "inconclusive"

    return {"file": name, "status": status, "flags": flags, "reason": reason}


def validate_file(path: Path) -> dict:
    path = Path(path)
    if path.suffix.lower() == ".csv":
        df = pd.read_csv(path, nrows=50000, low_memory=False)
    elif path.suffix.lower() in (".xlsx", ".xls"):
        df = pd.read_excel(path, nrows=50000)
    else:
        raise ValueError(f"Unsupported format: {path.suffix}")
    return validate_export(df, name=path.name)


def run_validator_cli():
    import argparse
    from .paths import ATLAS_KP_CLEAN, PLEA_CLEAN

    parser = argparse.ArgumentParser(description="Evidence Gate export validator")
    parser.add_argument("--file", type=str, action="append", default=[])
    args = parser.parse_args()
    paths = args.file or [str(PLEA_CLEAN), str(ATLAS_KP_CLEAN)]
    reports = []
    for p in paths:
        report = validate_file(Path(p))
        reports.append(report)
        print(json.dumps(report, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(run_validator_cli())
