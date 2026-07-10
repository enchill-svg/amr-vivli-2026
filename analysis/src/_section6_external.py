"""External dataset paths and loaders for Section 6 Stages 4-6.

Every path below was verified to exist on disk before this module was written.
Loaders apply the filters named in docs/SECTION_6_ANALYTIC_METHODOLOGY_PLAN.md Part 2
(e.g. WDI aggregate-row exclusion via the life-expectancy metadata Region flag).
"""
from __future__ import annotations

import zipfile
from functools import lru_cache
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
DOCS_DIR = ROOT / "docs"
NEW_DATASETS = DOCS_DIR / "new_datasets"
CROSSWALK_DIR = ROOT / "crosswalks"

LIFE_EXPECTANCY_PATH = NEW_DATASETS / (
    "WHO  World Bank life expectancy at birth, by country and year.xls"
)
HEALTH_EXPENDITURE_PATH = NEW_DATASETS / (
    "World Bank health system indicators_health expenditure.xlsx"
)
HOSPITAL_BEDS_PATH = NEW_DATASETS / (
    "World Bank health system indicators_hospital beds per capita.xls"
)
GBD_SDI_PATH = (
    DOCS_DIR
    / "Global Burden of Disease Study 2023 (GBD 2023) Socio-Demographic Index (SDI) 1950–2023"
    / "IHME_GBD_2023_SDI_1950_2023_Y2025M10D12.csv"
)
GBD_LRI_ZIP_PATH = (
    DOCS_DIR
    / "Global Burden of Disease Study 2021 (GBD 2021) Lower Respiratory Infections and Aetiologies Incidence and Mortality Estimates 1990-2021"
    / "IHME_GBD_2021_LRI_1990_2021.zip"
)
GBD_LRI_PATHOGEN_CSV = "IHME_GBD_2021_LRI_1990_2021_PATHOGEN_BURDEN_Y2024M04D12.CSV"

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

ESAC_EXPORT_GLOB = "esac_*_j01_subgroup_trend.xlsx"
ESAC_NET_COMBINED_PATH = NEW_DATASETS / "esac_net_ddd_country_year.csv"

# ESAC-Net country profile exports (ECDC AMC2 dashboard) — filename slug -> ISO3.
ESAC_COUNTRY_SLUG_TO_ISO3 = {
    "austria": "AUT",
    "belgium": "BEL",
    "bulgaria": "BGR",
    "croatia": "HRV",
    "cyprus": "CYP",
    "czechia": "CZE",
    "denmark": "DNK",
    "estonia": "EST",
    "finland": "FIN",
    "france": "FRA",
    "germany": "DEU",
    "greece": "GRC",
    "hungary": "HUN",
    "iceland": "ISL",
    "ireland": "IRL",
    "italy": "ITA",
    "latvia": "LVA",
    "lithuania": "LTU",
    "luxembourg": "LUX",
    "malta": "MLT",
    "netherlands": "NLD",
    "norway": "NOR",
    "poland": "POL",
    "portugal": "PRT",
    "romania": "ROU",
    "slovakia": "SVK",
    "slovenia": "SVN",
    "spain": "ESP",
    "sweden": "SWE",
    "united_kingdom": "GBR",
}

CONSUMPTION_DATA_AVAILABLE = any(NEW_DATASETS.glob(ESAC_EXPORT_GLOB))

SDI_INCLUDED = True
GBD_LRI_INCLUDED = True

HEALTH_INDICATOR_CODE = "SH.XPD.CHEX.GD.ZS"
HEALTH_INDICATOR_NAME = "Current health expenditure (% of GDP)"
HOSPITAL_BEDS_INDICATOR_CODE = "SH.MED.BEDS.ZS"
HOSPITAL_BEDS_INDICATOR_NAME = "Hospital beds (per 1,000 people)"

# GBD 2021 LRI pathogens that overlap this project's surveillance organism set
# (SECTION_6_ANALYTIC_METHODOLOGY_PLAN.md Part 2.4).
SURVEILLANCE_LRI_PATHOGENS = (
    "Acinetobacter baumannii",
    "Enterobacter spp",
    "Escherichia coli",
    "Fungus",
    "Haemophilus influenzae",
    "Klebsiella pneumoniae",
    "Pseudomonas aeruginosa",
    "Staphylococcus aureus",
    "Streptococcus pneumoniae",
)

GBD_LOCATION_ALIASES = {
    "united kingdom": "GBR",
    "united kingdom of great britain and northern ireland": "GBR",
    "russian federation": "RUS",
    "korea, republic of": "KOR",
    "republic of korea": "KOR",
    "türkiye": "TUR",
    "turkey": "TUR",
    "czechia": "CZE",
    "viet nam": "VNM",
    "united states of america": "USA",
    "united states": "USA",
    "bolivia (plurinational state of)": "BOL",
    "venezuela (bolivarian republic of)": "VEN",
    "tanzania": "TZA",
    "syrian arab republic": "SYR",
    "lao people's democratic republic": "LAO",
    "democratic republic of the congo": "COD",
    "republic of moldova": "MDA",
    "north macedonia": "MKD",
    "eswatini": "SWZ",
    "cote d'ivoire": "CIV",
    "côte d'ivoire": "CIV",
    "virgin islands, u.s.": "VIR",
    "hong kong special administrative region of china": "HKG",
    "taiwan (province of china)": "TWN",
}

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


@lru_cache(maxsize=1)
def _iso3_name_lookup() -> dict[str, str]:
    crosswalk = pd.read_csv(CROSSWALK_DIR / "country_iso3_crosswalk_v1.csv")
    lookup: dict[str, str] = {}
    for iso3, canonical, raw in zip(
        crosswalk["iso3"].astype(str),
        crosswalk["canonical_name"].astype(str),
        crosswalk["raw_string"].astype(str),
    ):
        lookup[canonical.lower().strip()] = iso3
        lookup[raw.lower().strip()] = iso3
    lookup.update(GBD_LOCATION_ALIASES)
    return lookup


def map_gbd_location_to_iso3(location_name: object) -> str | None:
    """Map a GBD location_name to ISO3 using the project country crosswalk."""
    if not isinstance(location_name, str):
        return None
    return _iso3_name_lookup().get(location_name.lower().strip())


def load_gbd_sdi_long() -> pd.DataFrame:
    """Return country-year GBD 2023 SDI (Both sexes, All Ages)."""
    path = _require(GBD_SDI_PATH)
    sdi = pd.read_csv(
        path,
        usecols=["location_name", "year_id", "age_group_name", "sex", "mean_value"],
    )
    sdi = sdi[(sdi["sex"] == "Both") & (sdi["age_group_name"] == "All Ages")].copy()
    sdi["iso3"] = sdi["location_name"].map(map_gbd_location_to_iso3)
    sdi = sdi.dropna(subset=["iso3"])
    sdi = sdi.rename(
        columns={"year_id": "parsed_year", "mean_value": "gbd_sdi"}
    ).astype({"parsed_year": int})
    return sdi[["iso3", "parsed_year", "gbd_sdi"]].drop_duplicates(["iso3", "parsed_year"])


def load_gbd_lri_pathogen_burden_long() -> pd.DataFrame:
    """Return country-year summed LRI incidence counts for surveillance-relevant pathogens.

    GBD 2021 LRI pathogen burden is available only for 1990, 2019, 2020, and 2021.
    Uses incidence Number (All Ages, Both sexes) as an external population-based comparator.
    """
    path = _require(GBD_LRI_ZIP_PATH)
    chunks: list[pd.DataFrame] = []
    with zipfile.ZipFile(path) as archive:
        with archive.open(GBD_LRI_PATHOGEN_CSV) as handle:
            for chunk in pd.read_csv(
                handle,
                chunksize=250_000,
                usecols=[
                    "measure_name",
                    "location_name",
                    "sex_name",
                    "age_group_name",
                    "year_id",
                    "pathogen",
                    "metric",
                    "val",
                ],
            ):
                sub = chunk[
                    (chunk["measure_name"] == "Incidence")
                    & (chunk["sex_name"] == "Both")
                    & (chunk["age_group_name"] == "All Ages")
                    & (chunk["metric"] == "Number")
                    & (chunk["pathogen"].isin(SURVEILLANCE_LRI_PATHOGENS))
                ].copy()
                if len(sub):
                    chunks.append(sub)
    if not chunks:
        raise ValueError("No GBD LRI pathogen burden rows matched surveillance filters.")
    lri = pd.concat(chunks, ignore_index=True)
    lri["iso3"] = lri["location_name"].map(map_gbd_location_to_iso3)
    lri = lri.dropna(subset=["iso3"])
    lri["val"] = pd.to_numeric(lri["val"], errors="coerce")
    out = (
        lri.groupby(["iso3", "year_id"], dropna=False)["val"]
        .sum()
        .reset_index()
        .rename(
            columns={
                "year_id": "parsed_year",
                "val": "gbd_lri_surveillance_pathogen_incidence",
            }
        )
        .astype({"parsed_year": int})
    )
    return out


def load_hospital_beds_long() -> pd.DataFrame:
    """Return long-format hospital beds per 1,000 people (canonical WDI file B)."""
    path = _require(HOSPITAL_BEDS_PATH)
    meta = pd.read_excel(path, sheet_name="Metadata - Countries")
    valid_iso3 = set(meta.loc[meta["Region"].notna(), "Country Code"].astype(str))

    wide = pd.read_excel(path, sheet_name="Data", header=3)
    wide = wide.rename(columns={"Country Code": "iso3", "Country Name": "country_name"})
    wide = wide[
        (wide["iso3"].isin(valid_iso3))
        & (wide["Indicator Code"] == HOSPITAL_BEDS_INDICATOR_CODE)
    ].copy()
    if wide.empty:
        raise ValueError(
            f"No rows for hospital beds indicator {HOSPITAL_BEDS_INDICATOR_CODE} in {path}"
        )

    year_cols = _year_columns(wide.columns)
    long = wide.melt(
        id_vars=["iso3", "country_name", "Indicator Code", "Indicator Name"],
        value_vars=year_cols,
        var_name="parsed_year",
        value_name="hospital_beds_per_1000",
    )
    long["parsed_year"] = long["parsed_year"].map(_year_from_column)
    long["hospital_beds_per_1000"] = pd.to_numeric(
        long["hospital_beds_per_1000"], errors="coerce"
    )
    return long.dropna(subset=["parsed_year"]).astype({"parsed_year": int})


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


def _esac_country_slug_from_path(path: Path) -> str:
    stem = path.stem
    if not stem.startswith("esac_") or not stem.endswith("_j01_subgroup_trend"):
        raise ValueError(f"Unexpected ESAC export filename: {path.name}")
    return stem[len("esac_") : -len("_j01_subgroup_trend")]


def build_esac_consumption_long(*, refresh: bool = False) -> pd.DataFrame:
    """Sum J01* subgroup DDD per country-year from local ESAC-Net trend exports."""
    if not refresh and ESAC_NET_COMBINED_PATH.exists():
        out = pd.read_csv(ESAC_NET_COMBINED_PATH)
        out["parsed_year"] = pd.to_numeric(out["parsed_year"], errors="coerce").astype(int)
        out["antimicrobial_consumption_ddd"] = pd.to_numeric(
            out["antimicrobial_consumption_ddd"], errors="coerce"
        )
        return out

    exports = sorted(NEW_DATASETS.glob(ESAC_EXPORT_GLOB))
    if not exports:
        raise FileNotFoundError(
            f"No ESAC trend exports found under {NEW_DATASETS} ({ESAC_EXPORT_GLOB})"
        )

    rows: list[pd.DataFrame] = []
    for path in exports:
        slug = _esac_country_slug_from_path(path)
        iso3 = ESAC_COUNTRY_SLUG_TO_ISO3.get(slug)
        if not iso3:
            raise KeyError(f"No ISO3 mapping for ESAC export slug: {slug}")
        df = pd.read_excel(path)
        j01 = df[df["ATCCode"].astype(str).str.startswith("J01", na=False)].copy()
        if j01.empty:
            continue
        yearly = (
            j01.groupby("Year", dropna=False)["DDD per 1000 inhabitants per day"]
            .sum()
            .reset_index()
        )
        yearly["iso3"] = iso3
        yearly["esac_country_slug"] = slug
        yearly["source_file"] = path.name
        rows.append(yearly)

    if not rows:
        raise ValueError("ESAC exports contained no J01 subgroup rows.")

    out = pd.concat(rows, ignore_index=True)
    out = out.rename(
        columns={
            "Year": "parsed_year",
            "DDD per 1000 inhabitants per day": "antimicrobial_consumption_ddd",
        }
    )
    out["parsed_year"] = pd.to_numeric(out["parsed_year"], errors="coerce").astype(int)
    out["antimicrobial_consumption_ddd"] = pd.to_numeric(
        out["antimicrobial_consumption_ddd"], errors="coerce"
    )
    out = (
        out.groupby(["iso3", "parsed_year"], dropna=False)["antimicrobial_consumption_ddd"]
        .sum()
        .reset_index()
        .sort_values(["iso3", "parsed_year"])
    )
    return out


def load_esac_consumption_long() -> pd.DataFrame:
    """Return country-year systemic antibiotic DDD (J01 sum) from ESAC-Net exports."""
    if not CONSUMPTION_DATA_AVAILABLE:
        return pd.DataFrame(columns=["iso3", "parsed_year", "antimicrobial_consumption_ddd"])
    return build_esac_consumption_long()


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
