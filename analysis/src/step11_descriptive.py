"""
Step 11 - Section 6 Stage 1: Descriptive profiling.

Issue (the brief's Section 6 idea, plan doc Part 3.1, raw text line 84):
"Resistance rates by organism, drug class, country, year, and body site for
bacteria; susceptibility rates by species, drug class, country, year, and
specimen source for fungi."

Two gaps were confirmed by direct inspection before writing this step, not
assumed:

1. Body-site/specimen-source is not carried in master_table_v1.csv or
   isolate_registry_v1.csv at all, despite the plan document's summary text
   claiming otherwise. The raw cohort files do carry it - BODYLOCATION
   (SOAR_201818, csv) / BodyLocation (SOAR_201910, SOAR_207965, both excel)
   / Source (SENTRY, excel) - confirmed zero nulls in all four files. This
   step re-joins it by (source_cohort, isolate_id), reusing step10's
   normalize_isolate_id() so the join key matches exactly. The three SOAR
   files' BODYLOCATION/BodyLocation values are already harmonized "System:
   Site" strings (13 distinct values, union across all three - confirmed,
   no crosswalk needed). SENTRY's Source has 34 distinct specimen-type
   values (confirmed, dominated by "Blood culture" at 55.32% - matches
   appendix_1's independently verified figure).

2. No drug-class field or crosswalk exists anywhere in this pipeline, and
   the brief's text names "drug class" without specifying a taxonomy (no ATC,
   AWaRe, or other standard named anywhere in the brief). Per explicit
   user direction (asked directly, since this is a genuine gap this
   pipeline cannot resolve from its own data), this step authors
   crosswalks/drug_class_crosswalk_v1.csv from standard antimicrobial
   pharmacological/chemical classification - penicillin subclass,
   cephalosporin generation, macrolide, fluoroquinolone, tetracycline,
   folate-pathway-inhibitor for bacteria; echinocandin, triazole, polyene,
   pyrimidine-analogue for fungi. This is domain nomenclature, not a fact
   read from any project data file or from the brief's text, and is fully
   revisable - see DRUG_CLASS_TABLE below.

Action: apply appendix_5's Manski (1989) worst-case partial-identification
bounds, generalized from its own Case A (Step 8 beta-lactamase) and Case B
(Step 7 antifungal CLSI category) examples (appendix_5 Section 5.6) to every
organism-drug stratum:
  N = all isolates of the organism/species in a given (country, year,
      body-site/specimen-source) stratum, regardless of which drug they
      were tested against (isolate_registry_v1's in_master_table == True
      population).
  T = subset of N with an interpretable classification for that specific
      drug (EUCAST_v8.1_breakpoint/EUCAST_v10.0_breakpoint basis for
      bacteria; CLSI_breakpoint basis for fungi).
  P = subset of T classified Resistant (bacteria) or Susceptible (fungi,
      per the brief's "susceptibility rate" framing - only the positive
      event flips between the two pathogen types; N and T are defined
      identically).

Per appendix_5 Section 5.8's explicit checklist: Tier 1
[P/N, (P+N-T)/N] is reported unconditionally for every stratum; Tier 2
[P/N, P/T] is reported only alongside the explicit testing-monotonicity
assumption statement (and never called "monotone missingness" - a
different, unrelated term). Itraconazole/posaconazole/flucytosine have
zero CLSI_breakpoint rows in this data (confirmed directly, matching
step07_classification.py's BREAKPOINT_ABSENT_DRUGS) - per the checklist,
these get no CLSI-tier bound at all; they are covered only by the separate
ECV WT/NWT-rate output, which step07's own design note requires be kept
distinct from any S/I/R-based rate and never silently pooled with it (WT/
NWT is a population-membership call, not a clinical susceptible/resistant
determination). For the fungal susceptibility bound specifically, the
testing-monotonicity direction is restated rather than reused verbatim from
the bacterial case, because the positive event is flipped (see
FUNGAL_TIER2_CAVEAT below) - this is a distinct, unverified assumption, not
the same one relabeled.

Per-organism/species (country, year, site) strata are completed to a full
grid against every (organism, drug[, dosing_variant]) pair ever measured for
that organism/species anywhere in the data (not against every drug in the
crosswalk - that would propose nonsensical pairs no isolate of that organism
was ever tested against in any stratum). Cells with zero tested isolates are
reported as n_tested = 0 with the fully uninformative Tier 1 bound
[0%, 100%], per this pipeline's existing "annotate, don't suppress"
principle (see step07_classification.py's own treatment of the T=0 case) -
never silently omitted.

amoxicillin/clavulanate's two SOAR_207965 dosing variants (standard,
fixed_2ug) are kept as separate rows (dosing_variant is part of the
grouping key), per this pipeline's own existing documented policy
(appendix_3 Section 3.2: "any cross-cohort amoxicillin/clavulanate
comparison must state explicitly which ... dosing variant is used") - never
silently deduplicated or preferred over each other, even though 72 of the
2,521 isolates carrying both variants disagree on
classification_basis/resistance_category between them (confirmed by direct
inspection). All other canonical_drug values have exactly one master row
per isolate (confirmed directly), so no other drug needs this handling.

Check: every isolate in the analyzable population (isolate_registry_v1's
in_master_table == True) joins to exactly one body-site/specimen-source
value (0 unmatched); every stratum row satisfies P <= T <= N; the drug_class
crosswalk covers all 30 real canonical_drug values (UNRESOLVED excluded)
with no nulls; zero itraconazole/posaconazole/flucytosine rows appear in
the fungal CLSI-tier output.
"""
import datetime as dt
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
from step10_master import normalize_isolate_id
from _data_paths import COHORT_PATHS, SENTRY_PATH

MASTER_DIR = ROOT / "master"
BOUNDS_DIR = ROOT / "bounds"
CROSSWALK_DIR = ROOT / "crosswalks"

TODAY = dt.date.today().isoformat()

# CLSI M39's published minimum isolate count for a reportable antibiogram
# cell, already cited in this plan's own Stage 1 spec (Part 3.1). Used only
# to ANNOTATE low-N strata (low_n_flag) - never to suppress a row, matching
# this pipeline's "log everything, never fabricate or hide" design principle
# (README Section 10).
MIN_N_FOR_RELIABLE_RATE = 30

EUCAST_BASES = {"EUCAST_v8.1_breakpoint", "EUCAST_v10.0_breakpoint"}
CLSI_BASIS = "CLSI_breakpoint"
ECV_BASIS = "ECV_WT_NWT"

FUNGAL_DRUGS = {
    "Anidulafungin", "Caspofungin", "Micafungin", "Fluconazole", "Itraconazole",
    "Voriconazole", "Posaconazole", "Isavuconazole", "Amphotericin B", "Flucytosine",
}

# Structurally CLSI-breakpoint-absent fungal drugs (step07_classification.py's
# BREAKPOINT_ABSENT_DRUGS) - re-asserted here as an explicit Check, not relied
# on implicitly, per appendix_5 Section 5.8's checklist item forbidding any
# Manski/MIV bound for these three.
DEGENERATE_CLSI_DRUGS = {"Itraconazole", "Posaconazole", "Flucytosine"}

FUNGAL_TIER2_CAVEAT = (
    "Tier 2 for a SUSCEPTIBILITY bound assumes P(susceptible | not CLSI-classified) "
    "<= P(susceptible | CLSI-classified) - i.e. isolates lacking a CLSI category are "
    "assumed no more likely to be susceptible than the ones that got one. This is the "
    "mirror image of the bacterial resistance-bound assumption, not the same assumption "
    "relabeled, and it has its own, separate plausibility question: unlike the bacterial "
    "case (where non-testing often reflects a clinical decision), most of this data's "
    "CLSI-classification gaps are structural (a drug/species pair the CLSI standard does "
    "not cover), not a clinical choice - whether that structural gap is monotone in the "
    "assumed direction has not been evaluated here and should not be assumed true."
)

# --- Raw cohort site columns: not present in master_table_v1.csv or
# isolate_registry_v1.csv (confirmed by direct inspection) - read fresh from
# the same raw files step10_master.py sources, joined back by
# (source_cohort, isolate_id) using its exact normalize_isolate_id().
SITE_SPECS = {
    "SOAR_201818": {
        "path": COHORT_PATHS["SOAR_201818"], "reader": "csv",
        "isolate_id_col": "IHMANUMBER", "site_col": "BODYLOCATION",
    },
    "SOAR_201910": {
        "path": COHORT_PATHS["SOAR_201910"], "reader": "excel",
        "isolate_id_col": "Isolate Number", "site_col": "BodyLocation",
    },
    "SOAR_207965": {
        "path": COHORT_PATHS["SOAR_207965"], "reader": "excel",
        "isolate_id_col": "IHMA #", "site_col": "BodyLocation",
    },
    "SENTRY": {
        "path": SENTRY_PATH, "reader": "excel",
        "isolate_id_col": "uid", "site_col": "Source",
    },
}

# Standard antimicrobial pharmacological/chemical classification, authored
# this session - see this file's docstring, point 2. Every canonical_drug
# value from crosswalks/drug_code_crosswalk_v1.csv except UNRESOLVED must
# appear here exactly once (enforced by a Check in main()).
DRUG_CLASS_TABLE = {
    # --- Bacterial ---
    "penicillin": "Natural penicillin",
    "ampicillin": "Aminopenicillin",
    "amoxicillin": "Aminopenicillin",
    "amoxicillin/clavulanate": "Aminopenicillin + beta-lactamase inhibitor",
    "cefaclor": "Cephalosporin (2nd generation)",
    "cefuroxime": "Cephalosporin (2nd generation)",
    "cefdinir": "Cephalosporin (3rd generation)",
    "cefixime": "Cephalosporin (3rd generation)",
    "cefpodoxime": "Cephalosporin (3rd generation)",
    "cefotaxime": "Cephalosporin (3rd generation)",
    "ceftibuten": "Cephalosporin (3rd generation)",
    "ceftriaxone": "Cephalosporin (3rd generation)",
    "azithromycin": "Macrolide",
    "clarithromycin": "Macrolide",
    "erythromycin": "Macrolide",
    "levofloxacin": "Fluoroquinolone",
    "moxifloxacin": "Fluoroquinolone",
    "doxycycline": "Tetracycline",
    "tetracycline": "Tetracycline",
    "trimethoprim/sulfamethoxazole": "Folate pathway inhibitor",
    # --- Fungal ---
    "Anidulafungin": "Echinocandin",
    "Caspofungin": "Echinocandin",
    "Micafungin": "Echinocandin",
    "Fluconazole": "Triazole",
    "Itraconazole": "Triazole",
    "Voriconazole": "Triazole",
    "Posaconazole": "Triazole",
    "Isavuconazole": "Triazole",
    "Amphotericin B": "Polyene",
    "Flucytosine": "Pyrimidine analogue",
}


def normalize_site(raw_value):
    """Return a stripped site/specimen-source string, or None for null."""
    if pd.isna(raw_value):
        return None
    return str(raw_value).strip()


def build_site_lookup():
    """Return a long DataFrame of (source_cohort, isolate_id, site) from all
    four raw cohort files, using the same isolate_id normalization as
    step10_master.py so the join key matches the master table exactly.
    """
    rows = []
    for cohort_name, spec in SITE_SPECS.items():
        if spec["reader"] == "csv":
            df = pd.read_csv(spec["path"], low_memory=False)
        else:
            df = pd.read_excel(spec["path"])
        n_null = df[spec["site_col"]].isna().sum()
        if n_null:
            print(f"NOTE: {cohort_name} raw column {spec['site_col']!r} carries {n_null} null "
                  f"value(s) - previously confirmed 0 for all four cohorts; re-verify this file.")
        for raw_id, raw_site in zip(df[spec["isolate_id_col"]], df[spec["site_col"]]):
            rows.append({
                "source_cohort": cohort_name,
                "isolate_id": normalize_isolate_id(raw_id),
                "site": normalize_site(raw_site),
            })
    return pd.DataFrame(rows)


def add_bounds(df, p_col, n_col="n_isolates_in_stratum", t_col="n_tested"):
    """Attach Tier 1 (assumption-free) and Tier 2 (testing-monotonicity)
    Manski bounds, per appendix_5 Section 5.2/5.5, plus a low-N annotation.
    Never suppresses a row for low N or low coverage - annotates only.
    """
    n = df[n_col].astype(float)
    t = df[t_col].astype(float)
    p = df[p_col].astype(float)
    df["coverage_t_over_n"] = t / n
    df["tier1_bound_lower"] = p / n
    df["tier1_bound_upper"] = (p + (n - t)) / n
    df["tier1_width"] = (n - t) / n
    df["tier2_bound_upper_assumes_monotonicity"] = (p / t).where(t > 0)
    df["low_n_flag"] = n < MIN_N_FOR_RELIABLE_RATE
    return df


def build_full_grid(tested_rows, pair_keys, stratum_table, stratum_keys, agg_specs):
    """Complete a (pair, stratum) grid so zero-coverage cells are reported,
    not omitted (this pipeline's "annotate, don't suppress" principle).

    pair_keys identify a (organism[, drug, dosing_variant]) combination;
    candidate pairs are taken only from `tested_rows` itself (i.e. only
    combinations this data actually measured somewhere), never from a full
    cross of every organism against every drug in the crosswalk - that would
    propose pairs no isolate of that organism was ever tested against.
    stratum_keys always start with the same organism column as pair_keys[0],
    so the merge below is a per-organism cross join, not a global one.
    """
    organism_col = pair_keys[0]
    candidate_pairs = tested_rows[pair_keys].drop_duplicates()
    grid = candidate_pairs.merge(stratum_table[stratum_keys], on=organism_col, how="inner")

    agg = tested_rows.groupby(pair_keys + stratum_keys[1:], dropna=False).agg(**agg_specs).reset_index()
    grid = grid.merge(agg, on=pair_keys + stratum_keys[1:], how="left")
    for col in agg_specs:
        grid[col] = grid[col].fillna(0).astype(int)

    grid = grid.merge(stratum_table, on=stratum_keys, how="left")
    return grid


def rollup_by_class(per_drug_df, organism_col, stratum_cols, sum_cols, drug_class_col="drug_class"):
    """Sum n_tested/n_positive/etc. across every drug sharing a drug_class
    within the same organism/stratum. This pools distinct drugs' (and, for
    amoxicillin/clavulanate, distinct dosing variants') tested/positive
    counts together as repeated observations of one class-level test - a
    standard surveillance simplification, not an "isolate is class-resistant
    if resistant to >=1 drug in class" clinical rule. An isolate tested
    against multiple drugs in the same class contributes to this class row's
    T more than once; this is stated here, not hidden.
    """
    group_keys = [organism_col, drug_class_col] + stratum_cols
    agg_dict = {c: (c, "sum") for c in sum_cols}
    rolled = per_drug_df.groupby(group_keys, dropna=False).agg(**agg_dict).reset_index()
    n_lookup = per_drug_df[[organism_col] + stratum_cols + ["n_isolates_in_stratum"]].drop_duplicates()
    rolled = rolled.merge(n_lookup, on=[organism_col] + stratum_cols, how="left")
    return rolled


def main():
    failed = False

    master = pd.read_csv(MASTER_DIR / "master_table_v1.csv", dtype=str)
    registry = pd.read_csv(MASTER_DIR / "isolate_registry_v1.csv", dtype=str)
    population = registry[registry["in_master_table"] == "True"].copy()

    site_lookup = build_site_lookup()
    population = population.merge(site_lookup, on=["source_cohort", "isolate_id"], how="left")
    master = master.merge(site_lookup, on=["source_cohort", "isolate_id"], how="left")

    # --- Check (a): 100% join rate onto the raw site/specimen-source field. ---
    pop_unmatched = population["site"].isna().sum()
    master_unmatched = master["site"].isna().sum()
    if pop_unmatched or master_unmatched:
        print(f"FAIL: {pop_unmatched} isolate(s) in the population and {master_unmatched} master row(s) "
              f"did not join to a body-site/specimen-source value - the isolate_id normalization or "
              f"(source_cohort, isolate_id) key does not match between master_table_v1.csv and the raw files.")
        failed = True
    else:
        print(f"PASS: all {len(population)} population isolates and all {len(master)} master rows "
              f"joined to a body-site/specimen-source value.")

    # dosing_variant is null for 29 of 30 canonical drugs; a literal sentinel
    # avoids relying on pandas' NaN-key groupby/merge behavior being consistent
    # across versions.
    master["dosing_variant"] = master["dosing_variant"].fillna("n/a")

    n_table = (
        population
        .groupby(["pathogen_type", "canonical_organism", "iso3_country", "parsed_year", "site"], dropna=False)
        .size()
        .reset_index(name="n_isolates_in_stratum")
    )

    # =========================== Bacterial ===========================
    bact_master = master[
        (master["pathogen_type"].str.lower() == "bacterial") & (master["canonical_drug"] != "UNRESOLVED")
    ].copy()
    bact_tested = bact_master[bact_master["classification_basis"].isin(EUCAST_BASES)].copy()
    bact_tested["is_resistant"] = bact_tested["resistance_category"] == "R"
    bact_tested["is_intermediate"] = bact_tested["resistance_category"] == "I"
    bact_tested["is_susceptible"] = bact_tested["resistance_category"] == "S"

    bact_n_table = n_table[n_table["pathogen_type"] == "bacterial"].drop(columns="pathogen_type")
    bact_grid = build_full_grid(
        tested_rows=bact_tested,
        pair_keys=["canonical_organism", "canonical_drug", "dosing_variant"],
        stratum_table=bact_n_table,
        stratum_keys=["canonical_organism", "iso3_country", "parsed_year", "site"],
        agg_specs={
            "n_tested": ("isolate_id", "size"),
            "n_resistant": ("is_resistant", "sum"),
            "n_intermediate": ("is_intermediate", "sum"),
            "n_susceptible": ("is_susceptible", "sum"),
        },
    )
    bact_grid["drug_class"] = bact_grid["canonical_drug"].map(DRUG_CLASS_TABLE)
    bact_grid = add_bounds(bact_grid, p_col="n_resistant")
    bact_grid = bact_grid.rename(columns={"site": "body_site"})
    # "n/a" was only a groupby/merge-key sentinel (see the fillna above); restore
    # a true blank for the persisted artifact, matching master_table_v1.csv's own
    # convention where dosing_variant is genuinely empty for non-amoxicillin/
    # clavulanate rows, not a placeholder string.
    bact_grid["dosing_variant"] = bact_grid["dosing_variant"].replace("n/a", "")
    bact_grid["version"] = "v1"
    bact_grid["date_added"] = TODAY

    # --- Check (b): P <= T <= N for every bacterial stratum row. ---
    bad_bact = bact_grid[(bact_grid["n_resistant"] > bact_grid["n_tested"]) |
                         (bact_grid["n_tested"] > bact_grid["n_isolates_in_stratum"])]
    if len(bad_bact):
        print(f"FAIL: {len(bad_bact)} bacterial stratum row(s) violate P <= T <= N.")
        failed = True
    else:
        print(f"PASS: all {len(bact_grid)} bacterial (organism, drug, dosing_variant, country, year, "
              f"body_site) stratum rows satisfy P <= T <= N.")

    bact_cols = [
        "canonical_organism", "canonical_drug", "drug_class", "dosing_variant", "iso3_country", "parsed_year",
        "body_site", "n_isolates_in_stratum", "n_tested", "n_resistant", "n_intermediate", "n_susceptible",
        "coverage_t_over_n", "tier1_bound_lower", "tier1_bound_upper", "tier1_width",
        "tier2_bound_upper_assumes_monotonicity", "low_n_flag", "version", "date_added",
    ]
    BOUNDS_DIR.mkdir(parents=True, exist_ok=True)
    bact_grid[bact_cols].sort_values(["canonical_organism", "canonical_drug", "iso3_country", "parsed_year"]).to_csv(
        BOUNDS_DIR / "descriptive_bacterial_resistance_v1.csv", index=False)
    print(f"Wrote {len(bact_grid)} bacterial resistance-rate row(s) to "
          f"bounds/descriptive_bacterial_resistance_v1.csv")

    bact_class = rollup_by_class(
        bact_grid, organism_col="canonical_organism",
        stratum_cols=["iso3_country", "parsed_year", "body_site"],
        sum_cols=["n_tested", "n_resistant", "n_intermediate", "n_susceptible"],
    )
    bact_class = add_bounds(bact_class, p_col="n_resistant")
    bact_class["version"] = "v1"
    bact_class["date_added"] = TODAY
    bact_class_cols = [
        "canonical_organism", "drug_class", "iso3_country", "parsed_year", "body_site",
        "n_isolates_in_stratum", "n_tested", "n_resistant", "n_intermediate", "n_susceptible",
        "coverage_t_over_n", "tier1_bound_lower", "tier1_bound_upper", "tier1_width",
        "tier2_bound_upper_assumes_monotonicity", "low_n_flag", "version", "date_added",
    ]
    bact_class[bact_class_cols].sort_values(["canonical_organism", "drug_class", "iso3_country", "parsed_year"]).to_csv(
        BOUNDS_DIR / "descriptive_bacterial_resistance_by_class_v1.csv", index=False)
    print(f"Wrote {len(bact_class)} bacterial resistance-rate-by-drug-class row(s) to "
          f"bounds/descriptive_bacterial_resistance_by_class_v1.csv (pools drugs/dosing variants "
          f"within a class - see rollup_by_class() docstring).")

    # =========================== Fungal: CLSI tier ===========================
    fung_master = master[master["pathogen_type"].str.lower() == "fungal"].copy()
    fung_clsi = fung_master[fung_master["classification_basis"] == CLSI_BASIS].copy()
    fung_clsi["is_susceptible"] = fung_clsi["resistance_category"] == "Susceptible"
    fung_clsi["is_intermediate"] = fung_clsi["resistance_category"] == "Intermediate"
    fung_clsi["is_resistant"] = fung_clsi["resistance_category"] == "Resistant"

    fung_n_table = n_table[n_table["pathogen_type"] == "fungal"].drop(columns="pathogen_type")
    fung_grid = build_full_grid(
        tested_rows=fung_clsi,
        pair_keys=["canonical_organism", "canonical_drug"],
        stratum_table=fung_n_table,
        stratum_keys=["canonical_organism", "iso3_country", "parsed_year", "site"],
        agg_specs={
            "n_tested": ("isolate_id", "size"),
            "n_susceptible": ("is_susceptible", "sum"),
            "n_intermediate": ("is_intermediate", "sum"),
            "n_resistant": ("is_resistant", "sum"),
        },
    )
    fung_grid["drug_class"] = fung_grid["canonical_drug"].map(DRUG_CLASS_TABLE)
    fung_grid = add_bounds(fung_grid, p_col="n_susceptible")
    fung_grid = fung_grid.rename(columns={"site": "specimen_source"})
    fung_grid["version"] = "v1"
    fung_grid["date_added"] = TODAY

    # --- Check (c): zero itraconazole/posaconazole/flucytosine rows in the CLSI-tier output. ---
    degenerate_present = fung_grid[fung_grid["canonical_drug"].isin(DEGENERATE_CLSI_DRUGS)]
    if len(degenerate_present):
        print(f"FAIL: {len(degenerate_present)} row(s) for {sorted(DEGENERATE_CLSI_DRUGS)} appear in the "
              f"fungal CLSI-tier output - appendix_5 Section 5.8 forbids reporting a Manski/MIV bound for "
              f"these (T=0, degenerate [0%,100%]).")
        failed = True
    else:
        print(f"PASS: zero rows for {sorted(DEGENERATE_CLSI_DRUGS)} appear in the fungal CLSI-tier output.")

    # --- Check (d): P <= T <= N for every fungal CLSI-tier stratum row. ---
    bad_fung = fung_grid[(fung_grid["n_susceptible"] > fung_grid["n_tested"]) |
                         (fung_grid["n_tested"] > fung_grid["n_isolates_in_stratum"])]
    if len(bad_fung):
        print(f"FAIL: {len(bad_fung)} fungal CLSI-tier stratum row(s) violate P <= T <= N.")
        failed = True
    else:
        print(f"PASS: all {len(fung_grid)} fungal CLSI-tier (species, drug, country, year, specimen_source) "
              f"stratum rows satisfy P <= T <= N.")

    fung_cols = [
        "canonical_organism", "canonical_drug", "drug_class", "iso3_country", "parsed_year", "specimen_source",
        "n_isolates_in_stratum", "n_tested", "n_susceptible", "n_intermediate", "n_resistant",
        "coverage_t_over_n", "tier1_bound_lower", "tier1_bound_upper", "tier1_width",
        "tier2_bound_upper_assumes_monotonicity", "low_n_flag", "version", "date_added",
    ]
    fung_grid[fung_cols].sort_values(["canonical_organism", "canonical_drug", "iso3_country", "parsed_year"]).to_csv(
        BOUNDS_DIR / "descriptive_fungal_susceptibility_v1.csv", index=False)
    print(f"Wrote {len(fung_grid)} fungal susceptibility-rate row(s) (CLSI tier) to "
          f"bounds/descriptive_fungal_susceptibility_v1.csv. {FUNGAL_TIER2_CAVEAT}")

    fung_class = rollup_by_class(
        fung_grid, organism_col="canonical_organism",
        stratum_cols=["iso3_country", "parsed_year", "specimen_source"],
        sum_cols=["n_tested", "n_susceptible", "n_intermediate", "n_resistant"],
    )
    fung_class = add_bounds(fung_class, p_col="n_susceptible")
    fung_class["version"] = "v1"
    fung_class["date_added"] = TODAY
    fung_class_cols = [
        "canonical_organism", "drug_class", "iso3_country", "parsed_year", "specimen_source",
        "n_isolates_in_stratum", "n_tested", "n_susceptible", "n_intermediate", "n_resistant",
        "coverage_t_over_n", "tier1_bound_lower", "tier1_bound_upper", "tier1_width",
        "tier2_bound_upper_assumes_monotonicity", "low_n_flag", "version", "date_added",
    ]
    fung_class[fung_class_cols].sort_values(["canonical_organism", "drug_class", "iso3_country", "parsed_year"]).to_csv(
        BOUNDS_DIR / "descriptive_fungal_susceptibility_by_class_v1.csv", index=False)
    print(f"Wrote {len(fung_class)} fungal susceptibility-rate-by-drug-class row(s) to "
          f"bounds/descriptive_fungal_susceptibility_by_class_v1.csv")

    # =========================== Fungal: ECV tier (WT/NWT) ===========================
    # Kept entirely separate from the CLSI-tier susceptibility output above -
    # WT/NWT is a population-membership statement, not a clinical
    # susceptible/resistant call (step07_classification.py's own design note).
    fung_ecv = fung_master[fung_master["classification_basis"] == ECV_BASIS].copy()
    fung_ecv["is_wt"] = fung_ecv["resistance_category"] == "WT"

    ecv_grid = build_full_grid(
        tested_rows=fung_ecv,
        pair_keys=["canonical_organism", "canonical_drug"],
        stratum_table=fung_n_table,
        stratum_keys=["canonical_organism", "iso3_country", "parsed_year", "site"],
        agg_specs={"n_classified": ("isolate_id", "size"), "n_wt": ("is_wt", "sum")},
    )
    ecv_grid["n_nwt"] = ecv_grid["n_classified"] - ecv_grid["n_wt"]
    ecv_grid["drug_class"] = ecv_grid["canonical_drug"].map(DRUG_CLASS_TABLE)
    ecv_grid = add_bounds(ecv_grid, p_col="n_wt", t_col="n_classified")
    ecv_grid = ecv_grid.rename(columns={"site": "specimen_source"})
    ecv_grid["version"] = "v1"
    ecv_grid["date_added"] = TODAY

    bad_ecv = ecv_grid[(ecv_grid["n_wt"] > ecv_grid["n_classified"]) |
                       (ecv_grid["n_classified"] > ecv_grid["n_isolates_in_stratum"])]
    if len(bad_ecv):
        print(f"FAIL: {len(bad_ecv)} fungal ECV-tier stratum row(s) violate n_wt <= n_classified <= N.")
        failed = True
    else:
        print(f"PASS: all {len(ecv_grid)} fungal ECV-tier (species, drug, country, year, specimen_source) "
              f"stratum rows satisfy n_wt <= n_classified <= N.")

    ecv_cols = [
        "canonical_organism", "canonical_drug", "drug_class", "iso3_country", "parsed_year", "specimen_source",
        "n_isolates_in_stratum", "n_classified", "n_wt", "n_nwt",
        "coverage_t_over_n", "tier1_bound_lower", "tier1_bound_upper", "tier1_width",
        "tier2_bound_upper_assumes_monotonicity", "low_n_flag", "version", "date_added",
    ]
    ecv_grid[ecv_cols].sort_values(["canonical_organism", "canonical_drug", "iso3_country", "parsed_year"]).to_csv(
        BOUNDS_DIR / "descriptive_fungal_ecv_wt_rate_v1.csv", index=False)
    print(f"Wrote {len(ecv_grid)} fungal WT-rate row(s) (ECV tier, NOT a susceptibility rate) to "
          f"bounds/descriptive_fungal_ecv_wt_rate_v1.csv")

    # =========================== Drug-class crosswalk artifact ===========================
    all_real_drugs = sorted(
        set(master[master["canonical_drug"] != "UNRESOLVED"]["canonical_drug"].dropna().unique())
    )
    missing_from_table = [d for d in all_real_drugs if d not in DRUG_CLASS_TABLE]
    extra_in_table = [d for d in DRUG_CLASS_TABLE if d not in all_real_drugs]
    if missing_from_table or extra_in_table:
        print(f"FAIL: DRUG_CLASS_TABLE does not exactly cover master_table_v1.csv's real canonical_drug "
              f"values. Missing: {missing_from_table}. Unexpected extra: {extra_in_table}.")
        failed = True
    else:
        print(f"PASS: DRUG_CLASS_TABLE covers all {len(all_real_drugs)} real canonical_drug values "
              f"in master_table_v1.csv exactly, with no gaps and no stale entries.")

    class_cw = pd.DataFrame([
        {
            "canonical_drug": drug,
            "drug_class": drug_class,
            "pathogen_type": "fungal" if drug in FUNGAL_DRUGS else "bacterial",
            "classification_basis": "standard_pharmacological_class_authored_this_session",
            "version": "v1",
            "date_added": TODAY,
        }
        for drug, drug_class in sorted(DRUG_CLASS_TABLE.items())
    ])
    CROSSWALK_DIR.mkdir(parents=True, exist_ok=True)
    class_cw.to_csv(CROSSWALK_DIR / "drug_class_crosswalk_v1.csv", index=False)
    print(f"Wrote {len(class_cw)} canonical_drug -> drug_class mapping(s) to "
          f"crosswalks/drug_class_crosswalk_v1.csv")

    if failed:
        print("\nStep 11 Check: FAIL")
        sys.exit(1)

    print("\nStep 11 Check: PASS")


if __name__ == "__main__":
    main()
