"""External dataset paths and loaders for Section 6 Stages 4-6.

Every path below was verified to exist on disk before this module was written.
Loaders apply the filters named in docs/SECTION_6_ANALYTIC_METHODOLOGY_PLAN.md Part 2
(e.g. WDI aggregate-row exclusion via the life-expectancy metadata Region flag).
"""
from __future__ import annotations

from pathlib import Path

import pandas as pd

DOCS_DIR = Path(__file__).resolve().parents[1] / "docs"
NEW_DATASETS = DOCS_DIR / "new_datasets"

LIFE_EXPECTANCY_PATH = NEW_DATASETS / (
    "WHO  World Bank life expectancy at birth, by country and year.xls"
)
HEALTH_EXPENDITURE_PATH = NEW_DATASETS / (
    "World Bank health system indicators_health expenditure.xlsx"
)
HIB3_COVERAGE_PATH = (
    DOCS_DIR
    / "Haemophilus Influenzae Type B (Hib3) vaccination coverage"
    / "Haemophilus Influenzae Type B (Hib3) vaccination coverage 2026-25-06 14-21 UTC.xlsx"
)
PCV_COVERAGE_PATH = (
    DOCS_DIR
    / "Pneumococcal vaccination coverage"
    / "Pneumococcal vaccination coverage 2026-25-06 14-10 UTC.xlsx"
)
HIB_INTRO_PATH = (
    DOCS_DIR
    / "Introduction of Hib"
    / "Introduction of Hib (Haemophilus Influenzae Type B) vaccine 2026-25-06 19-17 UTC.xlsx"
)
PCV_INTRO_PATH = (
    DOCS_DIR
    / "PCV"
    / "Introduction of PCV (Pneumococcal conjugate vaccine) 2026-25-06 13-59 UTC.xlsx"
)
RD_PROJECTS_PATH = DOCS_DIR / "AMR_Datasets" / "Global AMR R&D" / "Projects.xlsx"

# Justice's Stage 4 join names consumption, but Part 2.10 confirms only ESAC-Net
# metadata exists locally — no numeric DDD series. This constant documents the gap.
CONSUMPTION_DATA_AVAILABLE = False

# Plan Part 3.4 / Part 5: GBD SDI and GBD 2021 LRI are flagged as optional scope
# additions requiring explicit user approval — not loaded here.
SDI_INCLUDED = False
GBD_LRI_INCLUDED = False

# One canonical World Bank health-system-capacity indicator (Part 2.2 duplication note:
# hospital beds appear in two files; this module uses neither — % GDP expenditure only).
HEALTH_INDICATOR_CODE = "SH.XPD.CHEX.GD.ZS"
HEALTH_INDICATOR_NAME = "Current health expenditure (% of GDP)"

# WHO/UNICEF coverage category preference order (Part 2.3): modeled/administrative
# hierarchy — WUENIC is WHO/UNICEF's official harmonized estimate when present.
VACCINE_COVERAGE_PRIORITY = ("WUENIC", "OFFICIAL", "ADMIN")


def _require(path: Path) -> Path:
    if not path.exists():
        raise FileNotFoundError(f"Required Section 6 external file not found: {path}")
    return path


def _year_columns(columns: pd.Index) -> list[str]:
    """Return WDI year column names (handles both '2023' and '2023 [YR2023]')."""
    years: list[str] = []
    for col in columns:
        text = str(col).strip()
        if text.isdigit():
            years.append(col)
        elif text[:4].isdigit() and "YR" in text:
            years.append(col)
    return years


def _year_from_column(col: object) -> int:
    text = str(col).strip()
    return int(text[:4])


def load_life_expectancy_long() -> pd.DataFrame:
    """Return long-format life expectancy for WDI countries with populated Region."""
    path = _require(LIFE_EXPECTANCY_PATH)
    meta = pd.read_excel(path, sheet_name="Metadata - Countries")
    valid_iso3 = set(meta.loc[meta["Region"].notna(), "Country Code"].astype(str))

    wide = pd.read_excel(path, sheet_name="Data", header=3)
    wide = wide.rename(columns={"Country Code": "iso3", "Country Name": "country_name"})
    wide = wide[wide["iso3"].isin(valid_iso3)].copy()

    year_cols = _year_columns(wide.columns)
    long = wide.melt(
        id_vars=["iso3", "country_name", "Indicator Code"],
        value_vars=year_cols,
        var_name="parsed_year",
        value_name="life_expectancy",
    )
    long["parsed_year"] = long["parsed_year"].map(_year_from_column)
    long["life_expectancy"] = pd.to_numeric(long["life_expectancy"], errors="coerce")
    return long.dropna(subset=["parsed_year"]).astype({"parsed_year": int})


def load_health_expenditure_long() -> pd.DataFrame:
    """Return long-format current health expenditure (% of GDP) by country-year."""
    path = _require(HEALTH_EXPENDITURE_PATH)
    data = pd.read_excel(path, sheet_name="Data")
    subset = data[data["Series Code"] == HEALTH_INDICATOR_CODE].copy()
    if subset.empty:
        raise ValueError(f"No rows for health indicator {HEALTH_INDICATOR_CODE} in {path}")

    year_cols = _year_columns(subset.columns)
    long = subset.melt(
        id_vars=["Country Code", "Country Name", "Series Code", "Series Name"],
        value_vars=year_cols,
        var_name="parsed_year",
        value_name="health_expenditure_pct_gdp",
    )
    long = long.rename(columns={"Country Code": "iso3", "Country Name": "country_name"})
    long["parsed_year"] = long["parsed_year"].map(_year_from_column)
    long["health_expenditure_pct_gdp"] = pd.to_numeric(
        long["health_expenditure_pct_gdp"], errors="coerce"
    )
    return long.dropna(subset=["parsed_year"]).astype({"parsed_year": int})


def _pick_vaccine_coverage(df: pd.DataFrame, antigen: str) -> pd.DataFrame:
    """Collapse duplicate country-year-antigen rows to one value by coverage priority."""
    sub = df[df["ANTIGEN"] == antigen].copy()
    sub["iso3"] = sub["CODE"].astype(str)
    sub["parsed_year"] = pd.to_numeric(sub["YEAR"], errors="coerce").astype("Int64")
    sub["COVERAGE"] = pd.to_numeric(sub["COVERAGE"], errors="coerce")
    sub = sub.dropna(subset=["parsed_year", "COVERAGE"])
    sub["parsed_year"] = sub["parsed_year"].astype(int)

    priority_rank = {cat: i for i, cat in enumerate(VACCINE_COVERAGE_PRIORITY)}
    sub["priority_rank"] = sub["COVERAGE_CATEGORY"].map(priority_rank).fillna(99)
    sub = sub.sort_values(["iso3", "parsed_year", "priority_rank"])
    picked = sub.drop_duplicates(["iso3", "parsed_year"], keep="first")
    return picked[["iso3", "parsed_year", "COVERAGE", "COVERAGE_CATEGORY"]].rename(
        columns={
            "COVERAGE": f"{antigen.lower()}_coverage_pct",
            "COVERAGE_CATEGORY": f"{antigen.lower()}_coverage_source",
        }
    )


def load_vaccination_long() -> pd.DataFrame:
    """Return HIB3 and PCVC coverage (bacteria-only covariates per Justice Stage 4)."""
    hib = pd.read_excel(_require(HIB3_COVERAGE_PATH), sheet_name="Sheet1")
    pcv = pd.read_excel(_require(PCV_COVERAGE_PATH), sheet_name="Sheet1")
    hib_long = _pick_vaccine_coverage(hib, "HIB3")
    pcvc_long = _pick_vaccine_coverage(pcv, "PCVC")
    return hib_long.merge(pcvc_long, on=["iso3", "parsed_year"], how="outer")


INTRO_ADOPTED_VALUES = ("Yes", "Yes (P)")


def load_vaccine_introduction_panel(vaccine: str) -> pd.DataFrame:
    """Return country-year vaccine introduction flags from WHO/UNICEF intro panels."""
    if vaccine == "hib":
        path = _require(HIB_INTRO_PATH)
    elif vaccine == "pcv":
        path = _require(PCV_INTRO_PATH)
    else:
        raise ValueError(f"Unknown vaccine intro panel: {vaccine}")
    df = pd.read_excel(path)
    df = df.rename(columns={"ISO_3_CODE": "iso3", "YEAR": "parsed_year"})
    df["iso3"] = df["iso3"].astype(str)
    df["parsed_year"] = pd.to_numeric(df["parsed_year"], errors="coerce").astype("Int64")
    df = df.dropna(subset=["parsed_year"]).astype({"parsed_year": int})
    df["introduced"] = df["INTRO"].isin(INTRO_ADOPTED_VALUES)
    return df[["iso3", "parsed_year", "INTRO", "introduced", "ANTIGEN"]]


def first_vaccine_introduction_year(vaccine: str) -> pd.DataFrame:
    """First calendar year a country records INTRO in {Yes, Yes (P)}."""
    panel = load_vaccine_introduction_panel(vaccine)
    adopted = panel[panel["introduced"]]
    first = (
        adopted.groupby("iso3", dropna=False)["parsed_year"]
        .min()
        .reset_index(name="introduction_year")
    )
    first["vaccine"] = vaccine.upper()
    return first


def parse_rd_infectious_agents(categories: object) -> list[str]:
    """Extract leaf infectious-agent labels from a Hub Categories cell."""
    if not isinstance(categories, str):
        return []
    agents: list[str] = []
    for line in categories.split("\n"):
        if "Infectious Agent" not in line:
            continue
        parts = [p.strip() for p in line.split("/")]
        if len(parts) >= 4:
            agents.append(parts[-1])
    return agents


FUNGAL_AGENT_KEYWORDS = (
    "aspergillus",
    "candida",
    "cryptococcus",
    "mucor",
    "pneumocystis",
    "histoplasma",
    "fusarium",
    "scedosporium",
)


def classify_agent_pathogen_type(agent: str) -> str:
    """Map a Hub infectious-agent label to bacterial vs fungal."""
    lower = agent.lower()
    if any(k in lower for k in FUNGAL_AGENT_KEYWORDS):
        return "fungal"
    return "bacterial"


def load_rd_projects_prorated() -> pd.DataFrame:
    """Load R&D Hub projects with Amount USD pro-rated across infectious-agent tags.

    Per the Hub's published methodology (plan Part 2.9): when a project carries
    multiple infectious-agent tags in one Categories cell, divide its single
    Amount USD by the tag count before summing — conservative, avoids double-count.
    """
    rd = pd.read_excel(_require(RD_PROJECTS_PATH), sheet_name="data")
    rd["agents"] = rd["Categories"].apply(parse_rd_infectious_agents)
    rd["n_agent_tags"] = rd["agents"].apply(len)
    rd["amount_usd"] = pd.to_numeric(rd["Amount USD"], errors="coerce").fillna(0.0)

    rows = []
    for _, row in rd.iterrows():
        agents = row["agents"]
        if not agents:
            continue
        share = row["amount_usd"] / len(agents)
        for agent in agents:
            rows.append(
                {
                    "project_id": row["Id"],
                    "agent": agent,
                    "pathogen_type": classify_agent_pathogen_type(agent),
                    "amount_usd_prorated": share,
                    "n_agent_tags": len(agents),
                    "start_year": row.get("Start Year"),
                    "end_year": row.get("End Year"),
                }
            )
    return pd.DataFrame(rows)
