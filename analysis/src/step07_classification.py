"""
Step 7 - Resistance and susceptibility classification.

Issue (the brief's Section 5): bacterial isolates need EUCAST/CLSI breakpoints
applied per organism-drug pair. Fungal isolates have a structurally different
problem: the brief's text names four antifungals (itraconazole, posaconazole,
flucytosine, amphotericin B) as having no usable CLSI category in this
dataset. Direct inspection of the live data confirms this for three of the
four - itraconazole, posaconazole, and flucytosine are 100% null in their
"(CLSI)_I" columns - but not for amphotericin B, which carries 122 real
Susceptible/Resistant CLSI calls (67 Susceptible, 55 Resistant) alongside
26,800 nulls. BREAKPOINT_ABSENT_DRUGS below reflects the live data, not
the brief's text: it omits amphotericin B, which is classified via Tier 1
(CLSI) wherever a real call exists, falling through to Tier 2/3 only for its
null rows like any other drug.

Action: for bacteria, apply breakpoints per organism-drug pair, per cohort.
For fungi, classify using the CLSI category where one exists; for the three
breakpoint-absent drugs, fall back to species-specific ECVs where published,
and report an identified range rather than a point estimate where even ECVs
are unavailable.

Check: every classified isolate carries a record of which standard - CLSI
breakpoint, ECV, or unclassifiable - produced its category.

BACTERIAL HALF - implemented in `eucast_breakpoints.py`, not in this file.
This step's original docstring claimed no organism-drug -> S/I/R threshold
table existed anywhere in this plan's docs/; that is no longer true.
`new_datasets/EUCAST Clinical Breakpoint/v_16.1_Breakpoint_Tables.xlsx` is a
real, published EUCAST Clinical Breakpoint Table already sitting in this
project's own new_datasets/ folder, and `eucast_breakpoints.py` parses it
into a versioned, auditable reference (`crosswalks/eucast_breakpoint_table_v1.csv`,
`eucast_organism_crosswalk_v1.csv`, `eucast_drug_crosswalk_v1.csv`) plus a
`classify_bacterial(canonical_organism, canonical_drug, comparator, mic_value)`
function. Step 10 (`step10_master.py`) calls that function per bacterial
isolate-drug row, in the same place it previously assigned every bacterial
row the placeholder `unclassified_no_breakpoint_table` basis.

FUNGAL HALF - implemented per Appendix 4 SB.2's three-tier hierarchy using
SB.3's starter ECV table (Pfaller et al. 2012 and 2014; companion posaconazole/
voriconazole papers; Espinel-Ingroff et al. for Aspergillus spp.), expanded
this session with real, cited ECVs for Candida glabrata, C. parapsilosis,
C. tropicalis, C. krusei, C. dubliniensis, C. lusitaniae, C. guilliermondii,
Aspergillus flavus, and A. niger (see ECV_TABLE's inline citations):
  Tier 1 - CLSI clinical breakpoint category, where the "(CLSI)_I" column is
           non-null. Used directly.
  Tier 2 - ECV-based WT/NWT call, where no CLSI category exists but a
           published species-specific ECV is available: MIC <= ECV -> WT,
           MIC > ECV -> NWT. WT/NWT is NOT susceptible/resistant - it is a
           population-membership statement, not a clinical-outcome prediction.
  Tier 3 - unclassifiable. No CLSI category and no ECV. Report the measured
           MIC value itself (SENTRY's MIC columns are confirmed pre-resolved
           floats with no censoring notation - Step 5's reconnaissance) with
           an explicit unclassifiable tag - never a guessed category.
"""
import datetime as dt
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
from _data_paths import SENTRY_PATH
CLASSIFICATION_PATH = ROOT / "bounds" / "antifungal_ecv_classification_v1.csv"

# Appendix 4 SB.3 starter ECV table, plus this session's expansion - species x
# drug -> ECV (unit as published; all values below are µg/mL or mg/L,
# numerically interchangeable per CLSI convention, per Appendix 4 SB.3's own
# note). Every value below traces to a real, verifiable published source - see
# the citation comments inline. No entry here is an estimate or interpolation;
# where a real published ECV could not be found and verified, the species/drug
# pair is deliberately left absent (falls to Tier 3, unclassifiable) rather
# than filled with a guessed number.
#
# Source A - Pfaller MA et al. 2012, "Wild-Type MIC Distributions and
# Epidemiological Cutoff Values for Amphotericin B, Flucytosine, and
# Itraconazole and Candida spp." J Clin Microbiol 50(4):2040-6.
# doi:10.1128/jcm.00248-12, PMC3372147. 24-hour CLSI broth microdilution reads
# (consistent with the pre-existing C. albicans entries in this table, which
# are already 24h reads per this paper).
# Source B - Pfaller MA et al. 2014, "Multilaboratory Study of Epidemiological
# Cutoff Values for Detection of Resistance in Eight Candida Species to
# Fluconazole, Posaconazole, and Voriconazole." Antimicrob Agents Chemother.
# doi:10.1128/aac.02615-13. 24-hour CLSI broth microdilution.
# Source C - Espinel-Ingroff A et al., "Use of Epidemiological Cutoff Values
# To Examine 9-Year Trends in Susceptibility of Aspergillus Species to the
# Triazoles." PMC3043512 (companion to the pre-existing A. fumigatus rows
# below). Covers A. flavus and A. niger in addition to A. fumigatus; applied
# here to both the bare species name and the "species complex" label SENTRY
# uses for the same organism identification.
ECV_TABLE = {
    ("Candida albicans", "Amphotericin B"): 2,
    ("Candida albicans", "Flucytosine"): 0.5,
    ("Candida albicans", "Itraconazole"): 0.12,
    ("Candida albicans", "Posaconazole"): 0.06,
    # Candida glabrata - Source A (AMB/FC/ITR), Source B (POS, matches the
    # pre-existing entry below exactly - independent confirmation).
    ("Candida glabrata", "Amphotericin B"): 2,
    ("Candida glabrata", "Flucytosine"): 0.5,
    ("Candida glabrata", "Itraconazole"): 2,
    ("Candida glabrata", "Posaconazole"): 1,
    # Candida parapsilosis - Source A (AMB/FC/ITR), Source B (POS). Source B's
    # POS value (0.25) corrects this table's prior entry (0.5), which could
    # not be traced to a matching cell in either source paper; 0.25 is
    # independently confirmed by both the 2011 24h posaconazole/voriconazole
    # paper (PMC3043502) and Source B's 2014 8-species table.
    ("Candida parapsilosis", "Amphotericin B"): 2,
    ("Candida parapsilosis", "Flucytosine"): 0.5,
    ("Candida parapsilosis", "Itraconazole"): 0.5,
    ("Candida parapsilosis", "Posaconazole"): 0.25,
    # Candida tropicalis - previously the single highest-priority gap (2,139
    # SENTRY rows for posaconazole alone). Source A (AMB/FC/ITR), Source B (POS).
    ("Candida tropicalis", "Amphotericin B"): 2,
    ("Candida tropicalis", "Flucytosine"): 0.5,
    ("Candida tropicalis", "Itraconazole"): 0.5,
    ("Candida tropicalis", "Posaconazole"): 0.12,
    # Candida krusei - Source A (AMB/FC/ITR), Source B (POS). The flucytosine
    # ECV (32, far above other Candida spp.) reflects this species' documented
    # intrinsic reduced flucytosine susceptibility - confirmed via two
    # independent searches, not a transcription error.
    ("Candida krusei", "Amphotericin B"): 2,
    ("Candida krusei", "Flucytosine"): 32,
    ("Candida krusei", "Itraconazole"): 1,
    ("Candida krusei", "Posaconazole"): 0.5,
    # Candida dubliniensis - Source A (FC/ITR only; the 24h AMB read was
    # reported as insufficient-data in the source paper, so AMB is
    # deliberately left absent here rather than substituting the 48h figure).
    # Source B (POS).
    ("Candida dubliniensis", "Flucytosine"): 0.5,
    ("Candida dubliniensis", "Itraconazole"): 0.25,
    ("Candida dubliniensis", "Posaconazole"): 0.25,
    # Candida lusitaniae - Source A (AMB/FC/ITR), Source B (POS).
    ("Candida lusitaniae", "Amphotericin B"): 2,
    ("Candida lusitaniae", "Flucytosine"): 0.5,
    ("Candida lusitaniae", "Itraconazole"): 0.5,
    ("Candida lusitaniae", "Posaconazole"): 0.06,
    # Candida guilliermondii - Source A (AMB/FC/ITR), Source B (POS).
    ("Candida guilliermondii", "Amphotericin B"): 2,
    ("Candida guilliermondii", "Flucytosine"): 1,
    ("Candida guilliermondii", "Itraconazole"): 1,
    ("Candida guilliermondii", "Posaconazole"): 0.5,
    ("Aspergillus fumigatus", "Itraconazole"): 1,
    ("Aspergillus fumigatus", "Posaconazole"): 0.5,
    ("Aspergillus fumigatus", "Voriconazole"): 1,
    ("Aspergillus fumigatus", "Isavuconazole"): 1,
    # Aspergillus flavus - Source C. Applied to both the bare species name and
    # SENTRY's "species complex" label for the same organism identification.
    ("Aspergillus flavus", "Itraconazole"): 1,
    ("Aspergillus flavus", "Posaconazole"): 0.5,
    ("Aspergillus flavus species complex", "Itraconazole"): 1,
    ("Aspergillus flavus species complex", "Posaconazole"): 0.5,
    # Aspergillus niger - Source C. Same bare-name / species-complex handling.
    ("Aspergillus niger", "Itraconazole"): 2,
    ("Aspergillus niger", "Posaconazole"): 1,
    ("Aspergillus niger species complex", "Itraconazole"): 2,
    ("Aspergillus niger species complex", "Posaconazole"): 1,
    # Aspergillus fumigatus amphotericin B - Pfaller MA et al. 2011,
    # "Wild-Type MIC Distributions and Epidemiological Cutoff Values for
    # Amphotericin B and Aspergillus spp." Antimicrob Agents Chemother.
    # doi:10.1128/AAC.01730-10. 48-hour CLSI broth microdilution.
    ("Aspergillus fumigatus", "Amphotericin B"): 2,
    ("Aspergillus fumigatus species complex", "Amphotericin B"): 2,
    # Candida glabrata triazoles - Source B (Pfaller 2014, 8-species study).
    ("Candida glabrata", "Voriconazole"): 0.5,
    ("Candida glabrata", "Fluconazole"): 0.5,
    # Cryptococcus neoformans - Pfaller MA et al. AAC.01115-12 (2012) and
    # AAC.06252-11 (2011). Applied to bare name and SENTRY variant labels.
    ("Cryptococcus neoformans", "Fluconazole"): 16,
    ("Cryptococcus neoformans", "Itraconazole"): 0.5,
    ("Cryptococcus neoformans", "Posaconazole"): 0.25,
    ("Cryptococcus neoformans", "Voriconazole"): 0.25,
    ("Cryptococcus neoformans", "Amphotericin B"): 1,
    ("Cryptococcus neoformans", "Flucytosine"): 16,
    ("Cryptococcus neoformans var. grubii", "Fluconazole"): 16,
    ("Cryptococcus neoformans var. grubii", "Itraconazole"): 0.5,
    ("Cryptococcus neoformans var. grubii", "Posaconazole"): 0.25,
    ("Cryptococcus neoformans var. grubii", "Voriconazole"): 0.25,
    ("Cryptococcus neoformans var. grubii", "Amphotericin B"): 1,
    ("Cryptococcus neoformans var. grubii", "Flucytosine"): 16,
    ("Cryptococcus neoformans var. neoformans", "Fluconazole"): 16,
    ("Cryptococcus neoformans var. neoformans", "Itraconazole"): 0.5,
    ("Cryptococcus neoformans var. neoformans", "Posaconazole"): 0.25,
    ("Cryptococcus neoformans var. neoformans", "Voriconazole"): 0.25,
    ("Cryptococcus neoformans var. neoformans", "Amphotericin B"): 1,
    ("Cryptococcus neoformans var. neoformans", "Flucytosine"): 16,
}

# SENTRY uses variant and species-complex labels; map to ECV_TABLE keys when
# the bare species name is absent but a published ECV exists for the parent.
SPECIES_ALIASES = {
    "Aspergillus fumigatus species complex": "Aspergillus fumigatus",
    "Cryptococcus gattii species complex": "Cryptococcus gattii",
}

# The four drugs the brief's issue text names as breakpoint-absent, plus the
# other six SENTRY antifungals covered by this file's CLSI columns.
FUNGAL_DRUGS = [
    "Anidulafungin", "Caspofungin", "Micafungin", "Isavuconazole",
    "Fluconazole", "Itraconazole", "Voriconazole", "Posaconazole",
    "Amphotericin B", "Flucytosine",
]

BASIS_CLSI = "CLSI_breakpoint"
BASIS_ECV = "ECV_WT_NWT"
BASIS_UNCLASSIFIABLE = "unclassifiable_no_standard"
VALID_BASES = {BASIS_CLSI, BASIS_ECV, BASIS_UNCLASSIFIABLE}

BREAKPOINT_ABSENT_DRUGS = {"Itraconazole", "Posaconazole", "Flucytosine"}


def lookup_ecv(species, drug):
    """Return published ECV for (species, drug), following SPECIES_ALIASES."""
    ecv = ECV_TABLE.get((species, drug))
    if ecv is not None:
        return ecv
    alias = SPECIES_ALIASES.get(species)
    if alias is not None:
        return ECV_TABLE.get((alias, drug))
    return None


def classify_one(species, mic_value, clsi_category, drug):
    """Return (basis, category) for one isolate-drug pair, per Appendix 4 SB.2."""
    if pd.notna(clsi_category):
        return BASIS_CLSI, clsi_category

    ecv = lookup_ecv(species, drug)
    if pd.notna(mic_value) and ecv is not None:
        call = "WT" if mic_value <= ecv else "NWT"
        return BASIS_ECV, call

    if pd.notna(mic_value):
        return BASIS_UNCLASSIFIABLE, f"MIC={mic_value}"

    return None, None  # no measurement at all - not part of the denominator.


def main():
    failed = False

    # --- Bacterial half: see eucast_breakpoints.py (run separately; its own
    # main() writes the EUCAST reference crosswalks and runs its own Checks).
    # step10_master.py calls eucast_breakpoints.classify_bacterial() per
    # bacterial isolate-drug row.

    # --- Fungal half: full three-tier classification against live SENTRY data. ---
    df = pd.read_excel(SENTRY_PATH)
    per_row_records = []
    for drug in FUNGAL_DRUGS:
        mic_col = f"{drug} (CLSI)"
        clsi_col = f"{drug} (CLSI)_I"
        for species, mic_value, clsi_category in zip(df["Species"], df[mic_col], df[clsi_col]):
            basis, category = classify_one(species, mic_value, clsi_category, drug)
            if basis is not None:
                per_row_records.append({"species": species, "drug": drug, "basis": basis, "category": category})

    per_row_df = pd.DataFrame(per_row_records)
    print(f"\nFungal half: {len(per_row_df)} classified isolate-drug pairs across {len(FUNGAL_DRUGS)} drugs "
          f"and {df['Species'].nunique()} species.")

    # Check (b): every classified fungal pair carries exactly one of the 3 valid basis values.
    bad_basis = per_row_df[~per_row_df["basis"].isin(VALID_BASES)]
    if len(bad_basis):
        print(f"FAIL: {len(bad_basis)} fungal classification(s) carry an invalid basis value.")
        failed = True
    else:
        print(f"PASS: all {len(per_row_df)} classified fungal isolate-drug pairs carry exactly one of the "
              f"3 valid basis values ({sorted(VALID_BASES)}).")

    # Check (c): zero itraconazole/posaconazole/flucytosine rows carry CLSI_breakpoint basis.
    fabricated = per_row_df[(per_row_df["drug"].isin(BREAKPOINT_ABSENT_DRUGS)) & (per_row_df["basis"] == BASIS_CLSI)]
    if len(fabricated):
        print(f"FAIL: {len(fabricated)} row(s) for {BREAKPOINT_ABSENT_DRUGS} carry a CLSI_breakpoint basis, "
              f"but the CLSI category column is documented as 100% null for these drugs.")
        failed = True
    else:
        print(f"PASS: zero rows for {sorted(BREAKPOINT_ABSENT_DRUGS)} carry a CLSI_breakpoint basis - "
              f"confirms the pipeline did not fabricate a category where none exists in the source data.")

    # Aggregate to a per-(species, drug) summary for the persisted deliverable -
    # bounds/antifungal_ecv_classification.csv, as anticipated in this pipeline's
    # own repo layout (Part 4).
    summary_rows = []
    for (species, drug), group in per_row_df.groupby(["species", "drug"]):
        basis_counts = group["basis"].value_counts().to_dict()
        wt = (group["category"] == "WT").sum()
        nwt = (group["category"] == "NWT").sum()
        summary_rows.append({
            "species": species,
            "drug": drug,
            "n_classified": len(group),
            "n_clsi_breakpoint": basis_counts.get(BASIS_CLSI, 0),
            "n_ecv_wt": wt,
            "n_ecv_nwt": nwt,
            "n_unclassifiable": basis_counts.get(BASIS_UNCLASSIFIABLE, 0),
            "ecv_used": lookup_ecv(species, drug) or "",
            "version": "v1",
            "date_added": dt.date.today().isoformat(),
        })

    CLASSIFICATION_PATH.parent.mkdir(parents=True, exist_ok=True)
    pd.DataFrame(summary_rows, columns=[
        "species", "drug", "n_classified", "n_clsi_breakpoint", "n_ecv_wt", "n_ecv_nwt",
        "n_unclassifiable", "ecv_used", "version", "date_added",
    ]).sort_values(["drug", "species"]).to_csv(CLASSIFICATION_PATH, index=False)
    print(f"\nWrote {len(summary_rows)} species x drug summary row(s) to "
          f"{CLASSIFICATION_PATH.relative_to(ROOT.parents[0])}")

    print("\nNOTE (open risk, not resolved here): the ECV table above, even after this session's expansion "
          "to 9 species, remains a targeted-search reference (Appendix 4 SB.5), not a systematic literature "
          "review or a direct CLSI M27/M38/M59 supplement extraction - species outside this table's coverage "
          "(SENTRY has 200 distinct species total) still fall to Tier 3 (unclassifiable) rather than Tier 2, "
          "which is a real, honestly-documented coverage gap, not a bug.")
    print("NOTE: whether a Tier-2 NWT call should ever be pooled into a headline resistance rate alongside "
          "Tier-1 S/I/R categories is an explicit open design decision this step does not resolve (Appendix "
          "4 SB.2) - the summary table above keeps WT/NWT counts in separate columns from any S/I/R count "
          "specifically so they are never silently combined downstream.")

    if failed:
        print("\nStep 7 Check: FAIL")
        sys.exit(1)

    print("\nStep 7 Check: PASS")


if __name__ == "__main__":
    main()
