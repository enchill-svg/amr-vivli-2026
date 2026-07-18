"""Validate surveillance exports for denominator reconstructability."""
from __future__ import annotations

import json
from pathlib import Path

import pandas as pd

DETECTION_ONLY_GENE_COLS = {"NDM", "KPC", "VIM", "IMP", "OXA", "GES", "SPM", "GIM"}
NEGATIVE_TOKENS = {"NEG", "NEGATIVE", "NOT DETECTED", "NOT_DETECTED", "0", "-"}
GATE_VALUES = {"pass", "bounds_only", "withhold"}


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


def validate_gated_deliverable(
    df: pd.DataFrame, *, name: str = "gated_export", rank_col: str | None = None
) -> dict:
    """Structural integrity check for a Section 7 gated deliverable table.

    validate_export() above checks raw/cleaned surveillance cohort exports
    (denominator reconstructability); this checks the pipeline's later,
    published-facing output — every gated table gate_rules.py produces must
    carry a fully-populated quality_gate column drawn only from the known
    pass/bounds_only/withhold vocabulary, and (when rank_col is given) must
    never carry a rank for a row whose quality_gate isn't "pass".
    """
    flags: list[str] = []
    status = "PASS"

    if "quality_gate" not in df.columns:
        return {
            "file": name,
            "status": "FAIL",
            "flags": ["missing_quality_gate_column"],
            "reason": "no_quality_gate_column",
        }

    n_null = int(df["quality_gate"].isna().sum())
    if n_null:
        flags.append(f"null_quality_gate:{n_null}_row(s)")
        status = "FAIL"

    unknown = set(df["quality_gate"].dropna().astype(str)) - GATE_VALUES
    if unknown:
        flags.append(f"unknown_quality_gate_value:{','.join(sorted(unknown))}")
        status = "FAIL"

    if rank_col and rank_col in df.columns:
        mis_ranked = df[(df["quality_gate"] != "pass") & df[rank_col].notna()]
        if len(mis_ranked):
            flags.append(f"rank_without_pass_gate:{len(mis_ranked)}_row(s)")
            status = "FAIL"

    reason = "quality_gate_populated_and_consistent" if status == "PASS" else "gate_integrity_violation"
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
    # validate_export()'s status vocabulary is {PASS, FLAG}, not {PASS, FAIL}:
    # FLAG is a disclosure state for a structural, undocumented-nowhere-as-fixable
    # property of a raw export (e.g. ATLAS's carbapenemase gene columns never
    # carry an explicit negative token - blank means untested, not negative,
    # per EVIDENCE_GATE_ESTIMANDS.md SS2.3, and step19's Manski-bounds framework
    # exists specifically to handle it). Only a genuine FAIL status halts the
    # pipeline; FLAG is printed above and left visible in the run log.
    return 0 if all(r["status"] != "FAIL" for r in reports) else 1


if __name__ == "__main__":
    raise SystemExit(run_validator_cli())
