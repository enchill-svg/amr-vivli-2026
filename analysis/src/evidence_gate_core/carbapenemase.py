"""Carbapenemase allele rules for ATLAS Klebsiella pneumoniae."""
from __future__ import annotations

import pandas as pd

from .estimands import CARBAPENEMASE_GES_ALLELES, OXA48_FAMILY_MARKERS
from .paths import GENE_COLUMNS


def _non_blank(value) -> bool:
    if pd.isna(value):
        return False
    text = str(value).strip()
    return text not in ("", "0", "-")


def is_oxa48_family(oxa_value) -> bool:
    if not _non_blank(oxa_value):
        return False
    upper = str(oxa_value).upper().replace(" ", "")
    for marker in OXA48_FAMILY_MARKERS:
        if marker.replace("-", "") in upper.replace("-", "") or marker in upper:
            return True
    return False


def is_carbapenemase_ges(ges_value) -> bool:
    if not _non_blank(ges_value):
        return False
    upper = str(ges_value).upper()
    return any(allele in upper for allele in CARBAPENEMASE_GES_ALLELES)


def is_carbapenemase_positive_allele_restricted(row: pd.Series) -> bool:
    for col in ("NDM", "KPC", "VIM", "IMP", "SPM", "GIM"):
        if _non_blank(row.get(col)):
            return True
    if is_oxa48_family(row.get("OXA")):
        return True
    if is_carbapenemase_ges(row.get("GES")):
        return True
    return False


def is_gene_column_recorded(row: pd.Series) -> bool:
    return any(_non_blank(row.get(col)) for col in GENE_COLUMNS)


def is_carbapenemase_positive_broad(row: pd.Series) -> bool:
    return any(_non_blank(row.get(col)) for col in GENE_COLUMNS)


def add_atlas_kp_flags(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["gene_recorded"] = out.apply(is_gene_column_recorded, axis=1)
    out["carbapenemase_positive"] = out.apply(is_carbapenemase_positive_allele_restricted, axis=1)
    out["carbapenemase_positive_broad"] = out.apply(is_carbapenemase_positive_broad, axis=1)
    return out
