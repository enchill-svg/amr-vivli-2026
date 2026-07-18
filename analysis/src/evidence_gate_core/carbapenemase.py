"""Carbapenemase allele rules for ATLAS Klebsiella pneumoniae."""
from __future__ import annotations

import re

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
    # Match each marker only when not immediately followed by another digit,
    # so "OXA-48" matches variant-suffixed values ("OXA-48-TYPE") but not a
    # distinct, longer allele number that happens to share the prefix
    # ("OXA-484" is a different allele from OXA-48, not a variant of it).
    upper = str(oxa_value).upper().replace(" ", "").replace("-", "")
    for marker in OXA48_FAMILY_MARKERS:
        marker_nodash = marker.replace("-", "")
        if re.search(rf"{re.escape(marker_nodash)}(?!\d)", upper):
            return True
    return False


def is_carbapenemase_ges(ges_value) -> bool:
    if not _non_blank(ges_value):
        return False
    # CARBAPENEMASE_GES_ALLELES is a locked, discrete list of specific
    # confirmed-carbapenemase GES alleles (e.g. GES-1 is excluded on purpose:
    # it's an ESBL, not a carbapenemase). Match exact tokens (cells can carry
    # multiple alleles separated by ";" or ",") rather than substrings, so a
    # qualified/uncertain call like "GES-20-NV" isn't mistaken for GES-20.
    tokens = {token.strip() for token in re.split(r"[;,]", str(ges_value).upper())}
    return bool(tokens & set(CARBAPENEMASE_GES_ALLELES))


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


# Deliberately identical body to is_gene_column_recorded, not a copy-paste bug:
# EVIDENCE_GATE_ESTIMANDS.md SS2.1/2.3 define T ("detection-only Register export")
# and this "broader column-presence positive (reference only)" metric with the
# same rule (>=1 non-blank gene column) on purpose - confirmed against the raw
# ATLAS export that these 8 columns only ever hold NaN or a detected allele
# name (e.g. "NDM-1"), never an explicit negative token, so "recorded" and
# "positive under the loosest rule" are the same predicate on this dataset.
# Reference only - production bounds (step19) use the allele-restricted
# is_carbapenemase_positive_allele_restricted for P, not this column.
def is_carbapenemase_positive_broad(row: pd.Series) -> bool:
    return any(_non_blank(row.get(col)) for col in GENE_COLUMNS)


def add_atlas_kp_flags(df: pd.DataFrame) -> pd.DataFrame:
    out = df.copy()
    out["gene_recorded"] = out.apply(is_gene_column_recorded, axis=1)
    out["carbapenemase_positive"] = out.apply(is_carbapenemase_positive_allele_restricted, axis=1)
    out["carbapenemase_positive_broad"] = out.apply(is_carbapenemase_positive_broad, axis=1)
    return out
