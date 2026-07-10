"""Rename ESAC dashboard exports using ECDC country dropdown order (France/Germany skipped)."""
from pathlib import Path

# ECDC AMC dashboard order (screenshots); France & Germany exported separately.
COUNTRIES = [
    "austria",
    "belgium",
    "bulgaria",
    "cyprus",
    "czechia",
    "croatia",
    "denmark",
    "estonia",
    "finland",
    # france — esac_france_j01_subgroup_trend.xlsx
    # germany — esac_germany_j01_subgroup_trend.xlsx
    "greece",
    "hungary",
    "ireland",
    "italy",
    "lithuania",
    "luxembourg",
    "latvia",
    "malta",
    "netherlands",
    "norway",
    "poland",
    "portugal",
    "romania",
    "spain",
    "sweden",
    "slovenia",
    "slovakia",
    "united_kingdom",
    "iceland",
]

TREND_FILES = ["Trend of the  ATC group J01, A.XLSX"] + [
    f"Trend of the  ATC group J01, A ({i}).XLSX" for i in range(1, 28)
]

base = Path(__file__).resolve().parents[1] / "docs" / "new_datasets"

if len(TREND_FILES) != len(COUNTRIES):
    raise SystemExit(f"Expected {len(COUNTRIES)} trend files, got {len(TREND_FILES)}")

for src_name, country in zip(TREND_FILES, COUNTRIES):
    src = base / src_name
    dst = base / f"esac_{country}_j01_subgroup_trend.xlsx"
    if not src.exists():
        raise SystemExit(f"Missing: {src}")
    if dst.exists():
        raise SystemExit(f"Target already exists: {dst}")
    src.rename(dst)
    print(f"{src_name} -> {dst.name}")
