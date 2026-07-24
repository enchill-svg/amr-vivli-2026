"""Copy (never move) all required raw pipeline inputs into nested raw_inputs paths.

Destination layout must match analysis/src/_data_paths.py (cohort subfolders + EUCAST dir).
"""
import shutil
from pathlib import Path

PIPELINE_ROOT = Path(__file__).resolve().parents[1]
DOCS = PIPELINE_ROOT / "docs"
REPO = PIPELINE_ROOT.parents[0]
RAW = PIPELINE_ROOT / "raw_inputs"

# (search paths in docs/ then repo root, nested destination under raw_inputs/)
COPY_SPECS = [
    (
        [
            DOCS / "AMR_Datasets" / "SOAR 201818" / "gsk_201818_published.csv",
            REPO / "AMR_Datasets" / "SOAR 201818" / "gsk_201818_published.csv",
        ],
        RAW / "SOAR 201818" / "gsk_201818_published.csv",
    ),
    (
        [
            DOCS / "AMR_Datasets" / "SOAR 201910" / "GSK_SOAR_201910 raw data.xlsx",
            REPO / "AMR_Datasets" / "SOAR 201910" / "GSK_SOAR_201910 raw data.xlsx",
        ],
        RAW / "SOAR 201910" / "GSK_SOAR_201910 raw data.xlsx",
    ),
    (
        [
            DOCS / "AMR_Datasets" / "SOAR 207965" / "SOAR 207965 Complete data set 04Sep25.xlsx",
            REPO / "AMR_Datasets" / "SOAR 207965" / "SOAR 207965 Complete data set 04Sep25.xlsx",
        ],
        RAW / "SOAR 207965" / "SOAR 207965 Complete data set 04Sep25.xlsx",
    ),
    (
        [
            DOCS / "AMR_Datasets" / "ATLAS_Antifungals" / "vivli_sentry_2010_2024.xlsx",
            REPO / "AMR_Datasets" / "ATLAS_Antifungals" / "vivli_sentry_2010_2024.xlsx",
        ],
        RAW / "ATLAS_Antifungals" / "vivli_sentry_2010_2024.xlsx",
    ),
    (
        [
            DOCS / "new_datasets" / "EUCAST Clinical Breakpoint" / "v_8.1_Breakpoint_Tables.xlsx",
            REPO / "new_datasets" / "EUCAST Clinical Breakpoint" / "v_8.1_Breakpoint_Tables.xlsx",
        ],
        RAW / "EUCAST Clinical Breakpoint" / "v_8.1_Breakpoint_Tables.xlsx",
    ),
    (
        [
            DOCS / "new_datasets" / "EUCAST Clinical Breakpoint" / "v_10.0_Breakpoint_Tables.xlsx",
            REPO / "new_datasets" / "EUCAST Clinical Breakpoint" / "v_10.0_Breakpoint_Tables.xlsx",
        ],
        RAW / "EUCAST Clinical Breakpoint" / "v_10.0_Breakpoint_Tables.xlsx",
    ),
]


def resolve_source(candidates):
    for path in candidates:
        if path.exists():
            return path
    return None


def main():
    RAW.mkdir(parents=True, exist_ok=True)
    copied = 0
    missing = []
    for sources, dst in COPY_SPECS:
        src = resolve_source(sources)
        if src is None:
            missing.append(str(dst.relative_to(RAW)))
            continue
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dst)
        print(f"Copied {src} -> {dst.relative_to(RAW)}")
        copied += 1

    if missing:
        print(f"\nMISSING ({len(missing)}):")
        for name in missing:
            print(f"  - {name}")
        raise SystemExit(1)

    print(f"\nDone: {copied} file(s) under {RAW} (nested layout for _data_paths.py)")


if __name__ == "__main__":
    main()
