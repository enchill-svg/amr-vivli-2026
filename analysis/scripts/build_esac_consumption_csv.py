"""Combine ESAC-Net J01 subgroup trend exports into one country-year CSV.

Reads esac_<country>_j01_subgroup_trend.xlsx files from docs/new_datasets/,
sums DDD per 1,000 inhabitants per day across ATC J01* subgroups by year,
and writes esac_net_ddd_country_year.csv for Step 14 consumption join.
"""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "src"))

from _section6_external import (  # noqa: E402
    ESAC_EXPORT_GLOB,
    ESAC_NET_COMBINED_PATH,
    build_esac_consumption_long,
)


def main() -> int:
    df = build_esac_consumption_long(refresh=True)
    ESAC_NET_COMBINED_PATH.parent.mkdir(parents=True, exist_ok=True)
    df.to_csv(ESAC_NET_COMBINED_PATH, index=False)
    n_countries = df["iso3"].nunique()
    n_rows = len(df)
    year_min = int(df["parsed_year"].min())
    year_max = int(df["parsed_year"].max())
    print(
        f"Wrote {n_rows} country-year row(s) for {n_countries} ESAC country(ies) "
        f"({year_min}-{year_max}) to {ESAC_NET_COMBINED_PATH.relative_to(ROOT)}"
    )
    files = sorted(ESAC_NET_COMBINED_PATH.parent.glob(ESAC_EXPORT_GLOB))
    print(f"Source exports: {len(files)} file(s) matching {ESAC_EXPORT_GLOB}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
