"""
Step 12 - Section 6 Stage 2: Evolutionary layer (Distance-to-Failure and
Evolutionary Fitness Score).

Issue (Justice's Section 6 idea, plan doc Part 3.2): compute an "Evolutionary
Fitness Score" and "Evolutionary Distance-to-Failure" from MIC distribution
shifts, per (country, organism, drug) combination. Neither term is
established terminology in any CLSI/EUCAST/WHO GLASS source (confirmed by
web research recorded in the plan doc) - this step's operational definitions
below were confirmed with the user directly (three genuinely open design
questions the plan doc itself flags as needing explicit sign-off), not
assumed:

1. Anchor point (what "failure" means in MIC units) - HYBRID, per user
   direction: the EUCAST clinical resistance breakpoint (R >, "r_gt") for
   bacteria, the published ECV for fungi. Confirmed by direct inspection
   before asking: no ECOFF table exists locally for EITHER pathogen type
   (crosswalks/eucast_breakpoint_table_v1.csv and the raw EUCAST xlsx files
   carry only clinical S<=/R> columns, no ECOFF column anywhere), and no
   numeric fungal CLSI breakpoint value is stored locally at all - SENTRY
   supplies a pre-computed CLSI S/I/R category directly, never a parseable
   threshold - so ECV is not merely preferred for fungi, it is the only
   numerically groundable anchor available.
2. Density threshold - NO FIXED CUTOFF, per user direction: every (country,
   organism, drug[, dosing_variant]) combination with >=2 distinct qualifying
   years is computed; low-density years/trends are annotated (low_n_flag /
   low_density_flag), never excluded. This matches Stage 1's MIN_N_FOR_
   RELIABLE_RATE "annotate, don't suppress" precedent (reused directly from
   step11_descriptive.py, not redefined).
3. Score formula - per user direction: Distance-to-Failure = median
   log2(anchor) - log2(mic_value) across isolates in a (country, organism,
   drug[, dosing_variant], year) cell; Evolutionary Fitness Score = the
   year-over-year OLS slope of that yearly median distance, fit against real
   calendar years (not year-index), across every qualifying year for that
   combination.

Justice's text names six SOAR longitudinal countries (Ukraine, Turkey,
Tunisia, Pakistan, Kuwait, Vietnam) plus "SENTRY country-years with
sufficient density" as the intended population. Per decision 2 above, this
step does not gate the grid on that named list - every country/combination
meeting the >=2-year threshold is computed uniformly, SOAR or SENTRY alike;
the six named countries are expected, not enforced, to dominate the output
given their explicit longitudinal collection design.

Anchor resolution reuses the existing pipeline's own numeric-value sources,
never a re-derivation:
  Bacterial: eucast_breakpoints._ensure_loaded_for_version(version)
             ["resolved"][(organism, drug)]["r_gt"], where `version` is
             looked up per row via eucast_version_for_cohort(source_cohort)
             (EUCAST version is fixed per source_cohort, confirmed by
             crosswalks/eucast_cohort_version_map_v1.csv, not per calendar
             year) - so each isolate is normalized against the standard
             actually in force for its own cohort BEFORE aggregation, rather
             than one global anchor applied to every isolate regardless of
             which table it was actually read against. Confirmed directly:
             82,162 of 111,545 bacterial rows (73.7%) resolve a numeric
             anchor ("numeric" or "bracketed_ecoff" outcome - both carry a
             real r_gt); the remainder is a mix of no_drug_match,
             not_recommended (EUCAST Note 8, "-"), and
             footnote_governs_no_numeric (Note-only cells) - all genuine
             EUCAST realities, not a pipeline gap, and none are silently
             dropped: this step prints the exclusion breakdown.
  Fungal: step07_classification.lookup_ecv(species, drug) (follows
          SPECIES_ALIASES). Confirmed directly: 88,224 of 229,373 fungal rows
          (38.5%) resolve a numeric ECV. Anidulafungin, Caspofungin, and
          Micafungin (the three echinocandins) resolve ZERO ECVs - ECV_TABLE
          has no echinocandin entries at all, and (per point 1 above) no
          numeric CLSI breakpoint is stored locally either - so these three
          drugs structurally cannot get a Distance-to-Failure under this
          design, regardless of which anchor policy was chosen. This is
          reported as a Check, not silently absorbed (mirrors step11's
          DEGENERATE_CLSI_DRUGS / step07's BREAKPOINT_ABSENT_DRUGS handling).

A `mixed_breakpoint_versions_in_cell` flag is computed (bacterial only) per
Sallam 2025's breakpoint-drift caution (plan doc Part 3.2): a cell drawing
isolates from more than one EUCAST version could show a rate/distance shift
that is a table-revision artifact, not a real population shift. Confirmed
directly before writing this step: 0 of 2,049 (country, organism, drug,
year) cells in the current data draw from more than one EUCAST version, so
this flag currently always reads False - it is still computed live (never
hardcoded) as a structural safeguard against future data that does mix
versions within a cell. No fungal equivalent exists: ECV_TABLE is not
versioned by year in this pipeline, so there is nothing to mix.

amoxicillin/clavulanate's two dosing variants remain a separate grouping-key
dimension for bacteria, per this pipeline's existing documented policy
(reused from step11, never deduplicated). Fungal isolates carry no dosing
variant and no body-site/specimen-source dimension - Justice's Stage 2 text
names only country-organism-drug, unlike Stage 1's site-stratified spec, so
none is added here. Isolates appearing in more than one source_cohort via the
unresolved cross-cohort candidate-duplicate overlaps (Vietnam/Ukraine years,
logged but never auto-removed - see step10_master.py) are likewise not
deduplicated here, consistent with step11's own treatment of the same rows.

Unlike Stage 1's rate-based grid, this step does NOT complete a full
candidate-pair x stratum grid with explicit zero-isolate rows: a "zero
isolates" cell has no MIC distribution to take a median of, so there is no
equivalent to Stage 1's informative [0%, 100%] Tier-1 bound at n=0 - a
distance-to-failure statistic is simply not defined for an empty cell. Only
(country, organism, drug[, dosing_variant], year) cells with >=1 contributing
isolate are emitted.

Action: for every isolate with mic_value and a resolvable numeric anchor,
compute distance = log2(anchor) - log2(mic_value) (positive = margin
remaining before the isolate's own resistance/non-wild-type threshold;
zero or negative = at or past it). Aggregate to yearly medians per
(country, organism, drug[, dosing_variant]) combination, then fit the
year-over-year OLS slope (the Evolutionary Fitness Score) across every
combination with >=2 distinct qualifying years - negative slope = eroding
margin (evolving toward resistance), positive = growing margin.

Check: every emitted distance value is finite; every anchor value used is on
Appendix 4 A.2's cited MIC dilution series (reused from eucast_breakpoints.
is_valid_mic_value, not re-derived); every fitness-score row rests on >=2
distinct years; zero Anidulafungin/Caspofungin/Micafungin rows appear in the
fungal distance output (the structural ECV coverage gap above); exclusion
counts and mixed-version-cell counts are printed, never silently absorbed.
"""
import datetime as dt
import sys
from pathlib import Path

import numpy as np
import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(Path(__file__).resolve().parent))
import eucast_breakpoints as eb
import step07_classification as fc
from step11_descriptive import MIN_N_FOR_RELIABLE_RATE

MASTER_DIR = ROOT / "master"
BOUNDS_DIR = ROOT / "bounds"

TODAY = dt.date.today().isoformat()


def bacterial_anchor_table(bact):
    """Return a (source_cohort, canonical_organism, canonical_drug) ->
    (outcome, r_gt) lookup table, built once per unique triple actually
    present in the data (not a full cross of every organism x drug this
    pipeline knows about) - mirrors step11's build_full_grid philosophy of
    only ever proposing pairs the data itself contains.
    """
    triples = bact[["source_cohort", "canonical_organism", "canonical_drug"]].drop_duplicates()
    records = []
    for cohort, organism, drug in triples.itertuples(index=False):
        version = eb.eucast_version_for_cohort(cohort)
        resolved = eb._ensure_loaded_for_version(version)["resolved"]
        res = resolved.get((organism, drug))
        if res is None:
            records.append({"source_cohort": cohort, "canonical_organism": organism, "canonical_drug": drug,
                             "eucast_version": version, "outcome": "no_crosswalk_entry", "anchor": np.nan})
        elif res["outcome"] in ("numeric", "bracketed_ecoff"):
            records.append({"source_cohort": cohort, "canonical_organism": organism, "canonical_drug": drug,
                             "eucast_version": version, "outcome": res["outcome"], "anchor": res["r_gt"]})
        else:
            records.append({"source_cohort": cohort, "canonical_organism": organism, "canonical_drug": drug,
                             "eucast_version": version, "outcome": res["outcome"], "anchor": np.nan})
    return pd.DataFrame(records)


def fit_trend(years, values):
    """OLS slope/intercept of `values` (yearly median Distance-to-Failure)
    against real calendar `years` (not year-index) - irregular gaps between
    qualifying years affect precision, not the per-year unit of the slope.
    pearson_r is NaN when either series has zero variance (a flat trend, or
    - impossible here given the >=2-distinct-years filter - a single-year
    fit); this is a real degenerate-fit annotation, not an error.
    """
    years = np.asarray(years, dtype=float)
    values = np.asarray(values, dtype=float)
    slope, intercept = np.polyfit(years, values, 1)
    if np.std(years) == 0 or np.std(values) == 0:
        pearson_r = float("nan")
    else:
        pearson_r = float(np.corrcoef(years, values)[0, 1])
    return float(slope), float(intercept), pearson_r


def build_distance_cells(tested, group_keys):
    """Aggregate per-isolate distance values to yearly (group_keys, parsed_year)
    medians. `tested` must already carry a `distance` column and no null
    anchor/mic_value rows (callers filter before calling this)."""
    cells = (
        tested.groupby(group_keys + ["parsed_year"], dropna=False)
        .agg(n_isolates=("distance", "size"), median_distance_to_failure=("distance", "median"))
        .reset_index()
    )
    cells["low_n_flag"] = cells["n_isolates"] < MIN_N_FOR_RELIABLE_RATE
    return cells


def build_fitness_scores(cells, group_keys):
    """Fit the year-over-year OLS slope per group_keys combination, keeping
    only combinations with >=2 distinct qualifying years (per user decision
    2 - no fixed isolate-count cutoff, only the >=2-years structural minimum
    an OLS fit itself requires)."""
    rows = []
    for key, group in cells.groupby(group_keys, dropna=False):
        if group["parsed_year"].nunique() < 2:
            continue
        group = group.sort_values("parsed_year")
        slope, intercept, pearson_r = fit_trend(group["parsed_year"], group["median_distance_to_failure"])
        key = key if isinstance(key, tuple) else (key,)
        rows.append(dict(zip(group_keys, key), **{
            "n_years": int(group["parsed_year"].nunique()),
            "first_year": int(group["parsed_year"].min()),
            "last_year": int(group["parsed_year"].max()),
            "total_n_isolates": int(group["n_isolates"].sum()),
            "min_n_isolates_across_years": int(group["n_isolates"].min()),
            "evolutionary_fitness_score_slope": slope,
            "intercept": intercept,
            "pearson_r": pearson_r,
        }))
    df = pd.DataFrame(rows)
    df["low_density_flag"] = df["min_n_isolates_across_years"] < MIN_N_FOR_RELIABLE_RATE
    return df


def main():
    failed = False

    master = pd.read_csv(MASTER_DIR / "master_table_v1.csv", dtype=str)
    master["parsed_year"] = pd.to_numeric(master["parsed_year"], errors="coerce")
    master["mic_value"] = pd.to_numeric(master["mic_value"], errors="coerce")

    # =========================== Bacterial ===========================
    bact = master[
        (master["pathogen_type"].str.lower() == "bacterial") & (master["canonical_drug"] != "UNRESOLVED")
    ].copy()
    bact["dosing_variant"] = bact["dosing_variant"].fillna("")
    n_bact_total = len(bact)

    anchor_table = bacterial_anchor_table(bact)
    bact = bact.merge(anchor_table, on=["source_cohort", "canonical_organism", "canonical_drug"], how="left")

    print("Bacterial rows by anchor-resolution outcome:")
    print(bact["outcome"].value_counts().to_string())
    bact_tested = bact.dropna(subset=["anchor"]).copy()
    print(f"-> {len(bact_tested)} of {n_bact_total} bacterial rows ({100 * len(bact_tested) / n_bact_total:.1f}%) "
          f"resolve a numeric EUCAST anchor (r_gt) and are used below; the remainder is excluded, not fabricated.")

    # --- Check (a): every anchor value used is on the cited MIC dilution series. ---
    bad_anchors = bact_tested[~bact_tested["anchor"].apply(eb.is_valid_mic_value)]
    if len(bad_anchors):
        print(f"FAIL: {len(bad_anchors)} bacterial anchor value(s) fall outside the cited dilution series.")
        failed = True
    else:
        print(f"PASS: all {bact_tested['anchor'].nunique()} distinct bacterial anchor value(s) used are on "
              f"the cited dilution series.")

    bact_tested["distance"] = np.log2(bact_tested["anchor"].astype(float)) - np.log2(bact_tested["mic_value"].astype(float))

    bact_group_keys = ["iso3_country", "canonical_organism", "canonical_drug", "dosing_variant"]
    bact_cells = build_distance_cells(bact_tested, bact_group_keys)

    mixed = (
        bact_tested.groupby(bact_group_keys + ["parsed_year"], dropna=False)["eucast_version"]
        .nunique().reset_index(name="n_versions")
    )
    bact_cells = bact_cells.merge(mixed, on=bact_group_keys + ["parsed_year"], how="left")
    bact_cells["mixed_breakpoint_versions_in_cell"] = bact_cells["n_versions"] > 1
    n_mixed = bact_cells["mixed_breakpoint_versions_in_cell"].sum()
    print(f"Bacterial (country, organism, drug, dosing_variant, year) cells drawing from >1 EUCAST version: "
          f"{n_mixed} of {len(bact_cells)} (confirmed 0 of 2,049 across the full bacterial table before this "
          f"step's anchor filtering - flag retained as a live structural safeguard, not a hardcoded assumption).")
    bact_cells = bact_cells.drop(columns="n_versions")
    bact_cells["version"] = "v1"
    bact_cells["date_added"] = TODAY

    # --- Check (b): every emitted distance value is finite. ---
    non_finite = (~np.isfinite(bact_cells["median_distance_to_failure"])).sum()
    if non_finite:
        print(f"FAIL: {non_finite} bacterial distance-cell row(s) carry a non-finite median_distance_to_failure.")
        failed = True
    else:
        print(f"PASS: all {len(bact_cells)} bacterial distance-cell row(s) carry a finite median_distance_to_failure.")

    bact_cell_cols = [
        "iso3_country", "canonical_organism", "canonical_drug", "dosing_variant", "parsed_year",
        "n_isolates", "median_distance_to_failure", "mixed_breakpoint_versions_in_cell", "low_n_flag",
        "version", "date_added",
    ]
    BOUNDS_DIR.mkdir(parents=True, exist_ok=True)
    bact_cells[bact_cell_cols].sort_values(bact_group_keys + ["parsed_year"]).to_csv(
        BOUNDS_DIR / "evolutionary_bacterial_distance_v1.csv", index=False)
    print(f"Wrote {len(bact_cells)} bacterial (country, organism, drug, dosing_variant, year) distance-to-failure "
          f"row(s) to bounds/evolutionary_bacterial_distance_v1.csv")

    bact_fitness = build_fitness_scores(bact_cells, bact_group_keys)

    # --- Check (c): fitness-score table's combinations match the source cells'
    # own >=2-distinct-year qualification, computed independently from bact_cells
    # rather than re-reading bact_fitness's own (derived-by-construction) n_years
    # column against itself. ---
    cell_year_counts = bact_cells.groupby(bact_group_keys, dropna=False)["parsed_year"].nunique()
    expected_keys = set(cell_year_counts[cell_year_counts >= 2].index)
    actual_keys = set(
        bact_fitness[bact_group_keys].itertuples(index=False, name=None)
    ) if len(bact_fitness) else set()
    missing_keys = expected_keys - actual_keys
    extra_keys = actual_keys - expected_keys
    if missing_keys or extra_keys:
        print(f"FAIL: bacterial fitness-score table disagrees with source distance cells on which combinations "
              f"qualify for >=2 distinct years ({len(missing_keys)} qualifying combination(s) missing, "
              f"{len(extra_keys)} present that shouldn't be).")
        failed = True
    else:
        print(f"PASS: all {len(bact_fitness)} bacterial (country, organism, drug, dosing_variant) fitness-score "
              f"row(s) match the source cells' >=2-distinct-year qualification exactly "
              f"({len(expected_keys)} qualifying combination(s)).")

    bact_fitness["version"] = "v1"
    bact_fitness["date_added"] = TODAY
    bact_fitness_cols = bact_group_keys + [
        "n_years", "first_year", "last_year", "total_n_isolates", "min_n_isolates_across_years",
        "evolutionary_fitness_score_slope", "intercept", "pearson_r", "low_density_flag", "version", "date_added",
    ]
    bact_fitness[bact_fitness_cols].sort_values(bact_group_keys).to_csv(
        BOUNDS_DIR / "evolutionary_bacterial_fitness_score_v1.csv", index=False)
    print(f"Wrote {len(bact_fitness)} bacterial (country, organism, drug, dosing_variant) Evolutionary Fitness "
          f"Score row(s) to bounds/evolutionary_bacterial_fitness_score_v1.csv")

    # =========================== Fungal ===========================
    fung = master[
        (master["pathogen_type"].str.lower() == "fungal") & (master["canonical_drug"] != "UNRESOLVED")
    ].copy()
    n_fung_total = len(fung)

    fung["anchor"] = [
        fc.lookup_ecv(species, drug) for species, drug in zip(fung["canonical_organism"], fung["canonical_drug"])
    ]
    fung_tested = fung.dropna(subset=["anchor", "mic_value"]).copy()
    print(f"\n-> {len(fung_tested)} of {n_fung_total} fungal rows ({100 * len(fung_tested) / n_fung_total:.1f}%) "
          f"resolve a numeric ECV anchor and are used below; the remainder is excluded, not fabricated.")

    # --- Check (d): zero Anidulafungin/Caspofungin/Micafungin rows (no ECV published for any echinocandin). ---
    echinocandins = {"Anidulafungin", "Caspofungin", "Micafungin"}
    echino_present = fung_tested[fung_tested["canonical_drug"].isin(echinocandins)]
    if len(echino_present):
        print(f"FAIL: {len(echino_present)} row(s) for {sorted(echinocandins)} resolved an ECV anchor - "
              f"ECV_TABLE is documented to carry zero echinocandin entries.")
        failed = True
    else:
        print(f"PASS: zero rows for {sorted(echinocandins)} appear in the fungal distance output - no ECV "
              f"(and, per this pipeline's data, no numeric CLSI breakpoint either) exists locally for any "
              f"echinocandin, so these three drugs structurally cannot get a Distance-to-Failure here.")

    fung_tested["distance"] = np.log2(fung_tested["anchor"].astype(float)) - np.log2(fung_tested["mic_value"].astype(float))

    fung_group_keys = ["iso3_country", "canonical_organism", "canonical_drug"]
    fung_cells = build_distance_cells(fung_tested, fung_group_keys)
    fung_cells["version"] = "v1"
    fung_cells["date_added"] = TODAY

    # --- Check (e): every emitted fungal distance value is finite. ---
    non_finite_fung = (~np.isfinite(fung_cells["median_distance_to_failure"])).sum()
    if non_finite_fung:
        print(f"FAIL: {non_finite_fung} fungal distance-cell row(s) carry a non-finite median_distance_to_failure.")
        failed = True
    else:
        print(f"PASS: all {len(fung_cells)} fungal distance-cell row(s) carry a finite median_distance_to_failure.")

    fung_cell_cols = [
        "iso3_country", "canonical_organism", "canonical_drug", "parsed_year",
        "n_isolates", "median_distance_to_failure", "low_n_flag", "version", "date_added",
    ]
    fung_cells[fung_cell_cols].sort_values(fung_group_keys + ["parsed_year"]).to_csv(
        BOUNDS_DIR / "evolutionary_fungal_distance_v1.csv", index=False)
    print(f"Wrote {len(fung_cells)} fungal (country, organism, drug, year) distance-to-failure row(s) to "
          f"bounds/evolutionary_fungal_distance_v1.csv")

    fung_fitness = build_fitness_scores(fung_cells, fung_group_keys)

    # --- Check (f): fitness-score table's combinations match the source cells'
    # own >=2-distinct-year qualification, computed independently (see Check c). ---
    fung_cell_year_counts = fung_cells.groupby(fung_group_keys, dropna=False)["parsed_year"].nunique()
    fung_expected_keys = set(fung_cell_year_counts[fung_cell_year_counts >= 2].index)
    fung_actual_keys = set(
        fung_fitness[fung_group_keys].itertuples(index=False, name=None)
    ) if len(fung_fitness) else set()
    fung_missing_keys = fung_expected_keys - fung_actual_keys
    fung_extra_keys = fung_actual_keys - fung_expected_keys
    if fung_missing_keys or fung_extra_keys:
        print(f"FAIL: fungal fitness-score table disagrees with source distance cells on which combinations "
              f"qualify for >=2 distinct years ({len(fung_missing_keys)} qualifying combination(s) missing, "
              f"{len(fung_extra_keys)} present that shouldn't be).")
        failed = True
    else:
        print(f"PASS: all {len(fung_fitness)} fungal (country, organism, drug) fitness-score row(s) match the "
              f"source cells' >=2-distinct-year qualification exactly ({len(fung_expected_keys)} qualifying "
              f"combination(s)).")

    fung_fitness["version"] = "v1"
    fung_fitness["date_added"] = TODAY
    fung_fitness_cols = fung_group_keys + [
        "n_years", "first_year", "last_year", "total_n_isolates", "min_n_isolates_across_years",
        "evolutionary_fitness_score_slope", "intercept", "pearson_r", "low_density_flag", "version", "date_added",
    ]
    fung_fitness[fung_fitness_cols].sort_values(fung_group_keys).to_csv(
        BOUNDS_DIR / "evolutionary_fungal_fitness_score_v1.csv", index=False)
    print(f"Wrote {len(fung_fitness)} fungal (country, organism, drug) Evolutionary Fitness Score row(s) to "
          f"bounds/evolutionary_fungal_fitness_score_v1.csv")

    if failed:
        print("\nStep 12 Check: FAIL")
        sys.exit(1)

    print("\nStep 12 Check: PASS")


if __name__ == "__main__":
    main()
