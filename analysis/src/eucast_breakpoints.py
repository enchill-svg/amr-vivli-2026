"""
EUCAST v16.1 bacterial breakpoint reference - supports Step 7's bacterial half.

Issue: Step 7's bacterial classification was previously unimplemented because
no organism-drug -> S/I/R MIC threshold table existed anywhere in this plan's
docs/ (see step07_classification.py's original docstring). That gap is now
closed: `new_datasets/EUCAST Clinical Breakpoint/v_16.1_Breakpoint_Tables.xlsx`
is a real, published EUCAST Clinical Breakpoint Table (v16.1, valid from
2026-06-24) already sitting in this project's own new_datasets/ folder.

Action: parse that workbook into a versioned, auditable long-format reference
table (every organism sheet, every drug row, every raw cell value - nothing
hand-transcribed), then build two crosswalks on top of it: which of the 49
canonical organisms maps to which EUCAST organism sheet (many genuinely have
no match - EUCAST simply has no published breakpoint for that species), and
which raw EUCAST drug label resolves to which of the 21 canonical bacterial
drugs. Every non-match is logged with a real, citable reason - never silently
dropped and never guessed.

Check: main() reports, for every (canonical_organism, canonical_drug) pair
actually resolved, exactly one of a small set of documented outcomes (real
S<=/R> pair applied / EUCAST publishes no breakpoint for this pair / organism
has no EUCAST sheet / drug not offered for this organism's sheet) - no pair
is silently skipped.

EUCAST cell conventions applied here, cited to the workbook's own "Notes"
sheet (v16.1):
  - "-"        Note 8: agent unsuitable for this organism; testing/clinical
               use should be avoided. Not a missing value - a real EUCAST
               position. Logged as no_eucast_breakpoint_published /
               not_recommended_by_eucast, never silently auto-classified as
               Resistant (Note 8 literally says to report R without testing,
               but that is a clinical-reporting shortcut for un-tested
               isolates, not an interpretive rule for isolates this pipeline
               actually measured a real MIC for - conflating the two would
               inject a policy call into what is otherwise an
               empirically-observed classification).
  - "IE"       Note 9: insufficient evidence this organism-drug pairing is a
               good therapy target.
  - "IP"       Abbreviations: "In Preparation" - breakpoint not yet published.
  - "Note<N>"  the cell carries no standalone number at all; the whole
               breakpoint is governed by a footnote (often a screening-test
               rule, e.g. Note 10) this pipeline does not have the companion
               screening-agent data to resolve.
  - "(X)"      Notes 11-12: bracketed values are ECOFF-based (wild-type vs
               acquired-resistance-mechanism cutoffs), not clinical S/I/R
               breakpoints. Per Note 12, only an R call may be drawn from a
               bracketed pair (MIC > bracket R-value); S or I must never be
               reported from one.
  - numeric with S<=0.001 exactly
               Note 13: an explicitly arbitrary "off-scale" breakpoint. Any
               MIC that would otherwise resolve to "S" under this threshold
               must instead be reported "I" (susceptible, increased
               exposure) - never "S" (susceptible, standard dosing).
  - footnote-digit-concatenated numerics (e.g. "82" = value 8 + footnote
    reference "2") are split via the longest-valid-dilution-series-prefix
    rule, against the same generic two-fold dilution series already cited in
    Appendix 4 A.2 (0.001 through 256) - this is parsing, not fabrication:
    every candidate value is a real, previously-cited step on that series.

Footnote text itself (what Note 2, Note 4, etc. actually say for a given
organism sheet) is not resolved here - only whether a *standalone number* is
present. A drug-organism pair where the whole breakpoint is "Note<N>" with no
number is logged as no_eucast_breakpoint_published /
footnote_governs_no_numeric_threshold, which is honest: this pipeline has no
numeric threshold to apply, whatever the footnote's caveat actually says.
"""
import datetime as dt
import re
import sys
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parents[1]
from _data_paths import COHORT_PATHS, EUCAST_VERSION_PATHS
CROSSWALK_DIR = ROOT / "crosswalks"

# Justice Step 7: apply breakpoints per cohort before merging. Each SOAR file
# maps to the EUCAST version whose validity window best covers that cohort's
# documented collection years (Appendix 1). v6.0 (valid through 2016) is the
# ideal table for SOAR_201818 but is no longer hosted as xlsx on eucast.org;
# v8.1 (valid through 2018-12-31) is the nearest downloadable successor and
# is documented as such in eucast_cohort_version_map_v1.csv.
COHORT_EUCAST_VERSION = {
    "SOAR_201818": "8.1",
    "SOAR_201910": "8.1",
    "SOAR_207965": "10.0",
}

COHORT_VERSION_NOTES = {
    "SOAR_201818": "ideal EUCAST v6.0 (valid through 2016) xlsx unavailable from EUCAST archive; v8.1 used as nearest downloadable successor",
    "SOAR_201910": "collection window 2015-2018; EUCAST v8.1 valid through 2018-12-31",
    "SOAR_207965": "collection window 2018-2021; EUCAST v10.0 (valid 2020) used as midpoint table for this cohort",
}

COHORT_VERSION_MAP_PATH = CROSSWALK_DIR / "eucast_cohort_version_map_v1.csv"
BREAKPOINT_TABLE_PATH = CROSSWALK_DIR / "eucast_breakpoint_table_v1.csv"
ORGANISM_CROSSWALK_PATH = CROSSWALK_DIR / "eucast_organism_crosswalk_v1.csv"
DRUG_CROSSWALK_PATH = CROSSWALK_DIR / "eucast_drug_crosswalk_v1.csv"

NON_ORGANISM_SHEETS = {
    "Content", "Changes", "Notes", "Guidance", "Dosages", "Technical uncertainty",
    "Topical agents", "PK PD breakpoints", "PK PD cutoffs",
}

# Generic two-fold dilution series, Appendix 4 A.2, plus the arbitrary
# off-scale 0.001 sentinel Note 13 names explicitly. Extended to 1024 to
# cover any high-end breakpoint beyond A.2's own table ceiling of 256 -
# still the same doubling series, not an invented value.
VALID_MIC_STRINGS = [
    "0.001", "0.002", "0.004", "0.008", "0.015", "0.016", "0.03", "0.032",
    "0.06", "0.063", "0.125", "0.25", "0.5", "1", "2", "4", "8", "16", "32",
    "64", "128", "256", "512", "1024",
]
VALID_MIC_SET = set(VALID_MIC_STRINGS)
VALID_MIC_FLOATS = {float(v) for v in VALID_MIC_STRINGS}


def is_valid_mic_value(value):
    return any(abs(value - v) < 1e-9 for v in VALID_MIC_FLOATS)

OFF_SCALE_SENTINEL = 0.001  # Note 13.

NOTE_ONLY_RE = re.compile(r"^Note\s*\d+(,\s*\d+)*$", re.IGNORECASE)


# --- Step 1: parse the workbook into a raw long-format table. -------------

def is_class_header_row(row):
    # v8.1 workbooks repeat the column header mid-sheet as singular
    # "MIC breakpoint (mg/L)"; v10.0 uses plural "MIC breakpoints (mg/L)".
    # Match on the singular stem so both versions are caught - a
    # plural-only check silently lets all v8.1 header rows fall through as
    # if they were real drug rows (verified: 201 leaked rows across v8.1
    # organism sheets before this fix).
    return isinstance(row[1], str) and "MIC breakpoint" in row[1]


def is_subheader_row(row):
    return pd.isna(row[0]) and isinstance(row[1], str) and row[1].strip().startswith("S")


def parse_organism_sheet(xl, sheet):
    """Return a list of {drug_label_raw, s_leq_raw, r_gt_raw} dicts, one per
    real drug data row (title/method-notes/class-header/sub-header rows and
    the trailing disk-diffusion/notes columns are excluded)."""
    df = xl.parse(sheet, header=None)
    rows = []
    for _, row in df.iterrows():
        if pd.isna(row[0]) or pd.isna(row[1]):
            continue
        if is_class_header_row(row) or is_subheader_row(row):
            continue
        rows.append({
            "eucast_sheet": sheet,
            "drug_label_raw": str(row[0]).strip(),
            "s_leq_raw": row[1],
            "r_gt_raw": row[2],
        })
    return rows


def parse_all_sheets(xlsx_path):
    xl = pd.ExcelFile(xlsx_path)
    all_rows = []
    for sheet in xl.sheet_names:
        if sheet in NON_ORGANISM_SHEETS:
            continue
        all_rows.extend(parse_organism_sheet(xl, sheet))
    return all_rows


# --- Step 2: parse one breakpoint cell into a numeric value + sentinel. ---

def parse_breakpoint_cell(raw):
    """Return (numeric_value_or_None, sentinel_or_None, is_bracketed).

    sentinel is one of: "not_recommended" ("-", Note 8), "insufficient_evidence"
    ("IE", Note 9), "in_preparation" ("IP"), "footnote_governs_no_numeric"
    ("Note<N>" alone), or "unparseable" (a defensive fallback that should
    never actually fire against a real EUCAST cell - logged, not guessed,
    if it ever does).
    """
    if pd.isna(raw):
        return None, "missing", False

    s = str(raw).strip()
    if s == "-" or re.match(r"^-\d+(,\d+)*$", s):
        return None, "not_recommended", False  # e.g. "-1": a dash (Note 8) plus a footnote digit.
    if s.upper() == "IE":
        return None, "insufficient_evidence", False
    if s.upper() == "IP":
        return None, "in_preparation", False
    if NOTE_ONLY_RE.match(s):
        return None, "footnote_governs_no_numeric", False

    is_bracketed = s.startswith("(")
    core = s.strip("()")

    # A cell exactly matching a real dilution-series value (e.g. "0.25",
    # "16") is used as-is. Anything else is checked for a footnote-digit
    # concatenated onto a real value (e.g. "82" = value 8 + footnote "2")
    # BEFORE falling back to a bare float parse - float("41") would
    # otherwise silently accept "41" as a value on its own, when it is
    # actually "4" (a real step) plus a stray footnote digit "1".
    if core in VALID_MIC_SET:
        return float(core), None, is_bracketed

    for cut in range(len(core) - 1, 0, -1):
        prefix = core[:cut]
        if prefix in VALID_MIC_SET:
            return float(prefix), None, is_bracketed

    try:
        return float(core), None, is_bracketed
    except ValueError:
        pass

    return None, "unparseable", is_bracketed


# --- Step 3: organism crosswalk - 49 canonical organisms -> EUCAST sheet. --
# Every match is grounded in a specific sheet note (quoted in the reason);
# every non-match is a genuine coverage gap, not an oversight. Established by
# reading each candidate sheet's own scope note directly (title row + the
# organism-scope note row that most EUCAST sheets carry) - see this file's
# module docstring and the session's reconnaissance for the verification
# trail.

ORGANISM_CROSSWALK = {
    "Acinetobacter baumannii": ("Acinetobacter", "named in the Acinetobacter spp. sheet's own genus-scope note (A. baumannii group)"),
    "Acinetobacter lwoffii": ("Acinetobacter", "explicitly named in the Acinetobacter spp. sheet's own genus-scope note"),
    "Acinetobacter sp": ("Acinetobacter", "sheet's own note: 'In the EUCAST tables Acinetobacter are referred to as Acinetobacter spp.'"),
    "Achromobacter sp": (None, "only a species-specific A. xylosoxidans sheet exists; unspecified Achromobacter species cannot be safely assumed to be A. xylosoxidans"),
    "Corynebacterium sp": ("Corynebacterium", "sheet is explicitly titled 'Corynebacterium spp. other than C. diphtheriae and C. ulcerans' - a genus-level sheet by design"),
    "Enterococcus faecalis": ("Enterococcus", "direct species match"),
    "Enterococcus faecium": ("Enterococcus", "direct species match"),
    "Escherichia coli": ("Enterobacterales", "sheet's own note: 'Breakpoints in this table apply to all members of the Enterobacterales'"),
    "Haemophilus haemolyticus": (None, "H.influenzae sheet's own note limits extrapolation to H. parainfluenzae only ('Clinical data for other Haemophilus species are scarce')"),
    "Haemophilus hemolyticus": (None, "same as Haemophilus haemolyticus (alternate spelling) - not covered by the H.influenzae sheet's extrapolation note"),
    "Haemophilus influenzae": ("H.influenzae", "direct species match"),
    "Haemophilus parahaemolyticus": (None, "H.influenzae sheet's own note limits extrapolation to H. parainfluenzae only"),
    "Haemophilus parainfluenzae": ("H.influenzae", "sheet's own note: 'In the absence of specific breakpoints, the H. influenzae MIC breakpoints can be applied to H. parainfluenzae'"),
    "Klebsiella pneumoniae": ("Enterobacterales", "sheet's own note: applies to all members of the Enterobacterales"),
    "Kocuria rhizophila": (None, "no EUCAST sheet exists for this genus"),
    "Microbacterium sp": (None, "no EUCAST sheet exists for this genus"),
    "Moraxella catarrhalis": ("M.catarrhalis", "direct species match"),
    "Moraxella osloensis": (None, "the M.catarrhalis sheet is species-specific (titled 'Moraxella catarrhalis', no genus-scope extrapolation note, unlike Acinetobacter/Corynebacterium)"),
    "Moraxella sp": (None, "same - M.catarrhalis sheet does not extrapolate to other Moraxella species"),
    "Pantoea septica": ("Enterobacterales", "Pantoea is taxonomically within the order Enterobacterales, covered by the sheet's genus-wide note"),
    "Pasteurella multocida": ("P.multocida", "sheet's own note: 'EUCAST breakpoints are based mainly on data for Pasteurella multocida'"),
    "Pseudomonas aeruginosa": ("Pseudomonas", "sheet's own note names P. aeruginosa as the most frequent species covered"),
    "Pseudomonas monteilii": ("Pseudomonas", "sheet's own note covers 'less frequent Pseudomonas species' including the P. putida group, which P. monteilii is taxonomically part of (not individually named by EUCAST - documented extrapolation, not a fabricated value)"),
    "Pseudomonas stutzeri": ("Pseudomonas", "explicitly named in the sheet's own note ('P. stutzeri group')"),
    "Roseomonas sp": (None, "no EUCAST sheet exists for this genus"),
    "Rothia sp": (None, "no EUCAST sheet exists for this genus"),
    "S. mitis group": ("Viridans group streptococci", "explicitly named as a named subgroup in the sheet's own scope note"),
    "Staphylococcus aureus": ("Staphylococcus", "direct species match, sheet's own genus-scope note"),
    "Staphylococcus cohnii": ("Staphylococcus", "explicitly named as a coagulase-negative staphylococcus in the sheet's own scope note"),
    "Staphylococcus epidermidis": ("Staphylococcus", "explicitly named in the sheet's own scope note"),
    "Staphylococcus haemolyticus": ("Staphylococcus", "explicitly named in the sheet's own scope note"),
    "Staphylococcus hominis": ("Staphylococcus", "explicitly named in the sheet's own scope note"),
    "Staphylococcus lugdunensis": ("Staphylococcus", "explicitly named in the sheet's own scope note; also carries its own species-specific rows for some drugs"),
    "Staphylococcus pasteuri": ("Staphylococcus", "not individually named, but sheet's own note: 'Unless otherwise indicated, breakpoints apply to all members of the Staphylococcus genus'"),
    "Staphylococcus sp": ("Staphylococcus", "genus-wide rule per the sheet's own scope note"),
    "Staphylococcus warneri": ("Staphylococcus", "explicitly named in the sheet's own scope note"),
    "Stenotrophomonas maltophilia": ("S.maltophilia", "direct species match"),
    "Streptococcus anginosus": ("Viridans group streptococci", "named subgroup ('S. anginosus group') in the sheet's own scope note"),
    "Streptococcus gordonii": ("Viridans group streptococci", "named in the 'S. sanguinis group' in the sheet's own scope note"),
    "Streptococcus mitis": ("Viridans group streptococci", "named in the 'S. mitis group' in the sheet's own scope note"),
    "Streptococcus oralis": ("Viridans group streptococci", "named in the 'S. mitis group' in the sheet's own scope note"),
    "Streptococcus parasanguinis": ("Viridans group streptococci", "named in the 'S. sanguinis group' in the sheet's own scope note"),
    "Streptococcus pneumoniae": ("S.pneumoniae", "direct species match"),
    "Streptococcus pseudopneumoniae": ("Viridans group streptococci", "named in the 'S. mitis group' in the sheet's own scope note"),
    "Streptococcus pyogenes": ("Streptococcus A,B,C,G", "sheet's own scope note: 'Group A: S. pyogenes'"),
    "Streptococcus salivarius": ("Viridans group streptococci", "named in the 'S. salivarius group' in the sheet's own scope note"),
    "Streptococcus sanguinis": ("Viridans group streptococci", "named in the 'S. sanguinis group' in the sheet's own scope note"),
    "Streptococcus sp": (None, "genuinely ambiguous - S. pneumoniae, S. pyogenes and the viridans group each have materially different EUCAST breakpoints and no genus-wide sheet exists to resolve an unspecified Streptococcus"),
    "unidentified_pathogen": (None, "not a real organism"),
}


# --- Step 4: drug crosswalk - EUCAST base drug label -> canonical_drug. ---
# Matched against the base label after footnote/qualifier stripping (see
# normalize_drug_label). "UNRESOLVED" (Step 4's own DIN-unresolved sentinel)
# is never a target here by design - it must never receive a breakpoint.

DRUG_LABEL_SYNONYMS = {
    "amoxicillin": "amoxicillin",
    "amoxicillin-clavulanic acid": "amoxicillin/clavulanate",
    "amoxicillin/clavulanic acid": "amoxicillin/clavulanate",
    "ampicillin": "ampicillin",
    "azithromycin": "azithromycin",
    "cefaclor": "cefaclor",
    "cefdinir": "cefdinir",
    "cefixime": "cefixime",
    "cefotaxime": "cefotaxime",
    "cefpodoxime": "cefpodoxime",
    "ceftibuten": "ceftibuten",
    "ceftriaxone": "ceftriaxone",
    "cefuroxime": "cefuroxime",
    "clarithromycin": "clarithromycin",
    "doxycycline": "doxycycline",
    "erythromycin": "erythromycin",
    "levofloxacin": "levofloxacin",
    "moxifloxacin": "moxifloxacin",
    "benzylpenicillin": "penicillin",
    "tetracycline": "tetracycline",
    "trimethoprim-sulfamethoxazole": "trimethoprim/sulfamethoxazole",
    "trimethoprim/sulfamethoxazole": "trimethoprim/sulfamethoxazole",
}

# Every canonical bacterial drug this pipeline needs a breakpoint for
# (Step 4's 21-item vocabulary, minus the UNRESOLVED sentinel, which must
# never map to a breakpoint).
CANONICAL_BACTERIAL_DRUGS = [
    "amoxicillin", "amoxicillin/clavulanate", "ampicillin", "azithromycin",
    "cefaclor", "cefdinir", "cefixime", "cefotaxime", "cefpodoxime",
    "ceftibuten", "ceftriaxone", "cefuroxime", "clarithromycin",
    "doxycycline", "erythromycin", "levofloxacin", "moxifloxacin",
    "penicillin", "tetracycline", "trimethoprim/sulfamethoxazole",
]

# Indication-scope qualifiers, best-to-worst preference when more than one
# variant exists for the same (organism sheet, canonical_drug, route). Lower
# index wins. An unqualified indication (no parenthetical at all) always wins
# outright - it is not in this list because it is preferred over every entry
# below. "indications other than X" and "other indications" both mean "the
# general-purpose row, everything except the named narrow syndrome/route" so
# they rank alongside unqualified; narrower syndrome- or route-restricted
# variants (meningitis/endocarditis/UTI-only/screen-only) rank worse the more
# specific they are, per Note 19's UTI definitions and Note 7's endocarditis
# carve-out.
INDICATION_PRIORITY = [
    "indications other than",
    "other indications",
    "infections originating from the urinary tract",
    "endocarditis",
    "meningitis",
    "uncomplicated uti only",
    "screen only",
]

# Route preference: EUCAST's own reference method is broth microdilution
# (Note 17), which corresponds to the iv/systemic breakpoint row where a
# sheet splits iv vs oral; a row with no route marker at all (e.g. plain
# "Cefotaxime (indications other than meningitis)") is likewise the
# standard systemic reading and ranks the same as an explicit "iv" row.
# Oral-only rows are a fallback, ranked worse.
ROUTE_PRIORITY = {"": 0, "iv": 0, "oral": 1}


def normalize_drug_label(raw_label):
    """Split a raw EUCAST drug-row label into (base_name, route,
    indication_text, organism_note).

    Footnote reference digits directly appended to the drug name (e.g.
    "Azithromycin1", "Tetracycline1") are stripped. `indication_text` is the
    parenthetical qualifier (route/syndrome scope, e.g. "uncomplicated UTI
    only"); `organism_note` is the comma-separated species/group scope (e.g.
    "S. aureus", "Streptococcus groups A, C and G") used for species
    sub-selection in resolve_drug_row. Both are kept separate so route and
    indication-generality can be ranked independently of which named species
    a row is restricted to.
    """
    label = raw_label.replace("\n", " ").strip()
    indication = ""
    paren_match = re.search(r"\(([^)]*)\)", label)
    if paren_match:
        indication = paren_match.group(1).strip().lower()
        label = label[:paren_match.start()].strip()
    organism_note = ""
    if "," in label:
        base, _, rest = label.partition(",")
        label = base.strip()
        organism_note = rest.strip().lower()
    # Strip trailing footnote-reference digits from the bare drug name
    # (e.g. "Azithromycin1" -> "Azithromycin", "iv1" -> "iv").
    label = re.sub(r"(\d+(,\d+)*)$", "", label).strip()
    route = ""
    if label.lower().endswith(" iv"):
        label = label[:-3].strip()
        route = "iv"
    elif label.lower().endswith(" oral"):
        label = label[:-5].strip()
        route = "oral"
    return label.strip().lower(), route, indication, organism_note


def indication_rank(indication_text):
    if not indication_text:
        return -1  # unqualified always wins
    for i, token in enumerate(INDICATION_PRIORITY):
        if token in indication_text:
            return i
    return len(INDICATION_PRIORITY)  # unrecognized qualifier - lowest priority


def species_bucket_match(canonical_organism, organism_note):
    """Classify whether `organism_note` (a row's comma-separated species/
    group scope, e.g. "s. aureus", "other staphylococci") is the right
    bucket for `canonical_organism`.

    Returns True (named-species match), "generic" (falls into an explicit
    generic bucket like "other staphylococci"/"coagulase-negative
    staphylococci"), or False (a different named species - must not be
    used as a fallback for this organism).
    """
    species_word = canonical_organism.lower().replace(".", "").split()
    if len(species_word) >= 2 and species_word[-1] == "group":
        token = species_word[-2]
    else:
        token = species_word[-1] if species_word else ""
    if token in organism_note:
        return True
    if "groups a, c and g" in organism_note:
        # Streptococcus A,B,C,G sheet's group-based (not species-based) split;
        # among this pipeline's canonical organisms only S. pyogenes = Group A.
        return True if token == "pyogenes" else False
    if "coagulase-negative" in organism_note or "other staphylococci" in organism_note:
        return "generic"
    return False


def resolve_drug_row(sheet_rows, canonical_drug, canonical_organism):
    """Pick exactly one parsed row for (sheet, canonical_drug), or None if
    the drug is not offered at all for this organism's sheet.

    Staphylococcus and Streptococcus A,B,C,G carry species-specific rows for
    some drugs (e.g. "Benzylpenicillin, S. aureus" vs "..., S. lugdunensis"
    vs "..., other staphylococci"). Any row whose comma-separated
    organism_note names a *different* species than canonical_organism is
    excluded outright - never used as a generic fallback - so e.g.
    S. epidermidis can only resolve to the "other staphylococci"/
    "coagulase-negative" row, never to the S. aureus-specific row.
    """
    candidates = []
    for row in sheet_rows:
        base, route, indication, organism_note = normalize_drug_label(row["drug_label_raw"])
        if DRUG_LABEL_SYNONYMS.get(base) == canonical_drug:
            candidates.append((row, route, indication, organism_note))

    if not candidates:
        return None, None

    has_species_split = any(c[3] for c in candidates)
    if has_species_split:
        matches = [c for c in candidates if species_bucket_match(canonical_organism, c[3]) is True]
        if not matches:
            matches = [c for c in candidates if species_bucket_match(canonical_organism, c[3]) == "generic"]
        # Rows with no organism_note at all (not part of the species split)
        # remain eligible alongside whichever bucket matched.
        no_note = [c for c in candidates if not c[3]]
        candidates = (matches or []) + no_note if (matches or no_note) else candidates

    if len(candidates) == 1:
        return candidates[0][0], candidates[0][2]

    candidates.sort(key=lambda c: (ROUTE_PRIORITY.get(c[1], 1), indication_rank(c[2])))
    return candidates[0][0], candidates[0][2]


# Sheet names that changed between EUCAST workbook versions. EUCAST renamed
# the Enterobacterales-family tab from "Enterobacteriaceae" (v8.1) to
# "Enterobacterales" (v10.0) - a real taxonomic rename between versions, not
# a data error. ORGANISM_CROSSWALK stores one (current/v10.0) sheet name per
# organism; when that name is not an actual tab in a given workbook version,
# _build_resolved_for_version tries these aliases, in order, before treating
# the organism as unmatched. Verified directly against both workbooks:
# v8.1.sheet_names has "Enterobacteriaceae" (not "Enterobacterales"); v10.0
# has "Enterobacterales" (not "Enterobacteriaceae").
EUCAST_SHEET_ALIASES = {
    "Enterobacterales": ["Enterobacteriaceae"],
}

# Per-EUCAST-version caches: version -> {(organism, drug): resolution dict}
_VERSION_CACHE = {}

BASIS_NO_EUCAST_VALUE = "no_eucast_breakpoint_published"
BASIS_NO_ORGANISM_MATCH = "no_eucast_organism_match"
BASIS_NO_DRUG_MATCH = "no_eucast_drug_match"
BASIS_CENSORED_INDETERMINATE = "eucast_breakpoint_censored_reading_indeterminate"


def _basis_eucast(version):
    return f"EUCAST_v{version}_breakpoint"


def _basis_eucast_bracketed(version):
    return f"EUCAST_v{version}_ecoff_bracketed"


def bacterial_valid_bases():
    """Union of all valid classification_basis values across cohort EUCAST versions."""
    bases = {
        BASIS_NO_EUCAST_VALUE, BASIS_NO_ORGANISM_MATCH, BASIS_NO_DRUG_MATCH,
        BASIS_CENSORED_INDETERMINATE,
    }
    for version in set(COHORT_EUCAST_VERSION.values()):
        bases.add(_basis_eucast(version))
        bases.add(_basis_eucast_bracketed(version))
    return bases


# Backward-compatible module-level set used by step10 and pipeline_acceptance_check.
BACTERIAL_VALID_BASES = bacterial_valid_bases()


def _resolve_sheet_name_for_version(sheet, real_sheet_names):
    """Return the sheet name actually present in this workbook version.

    ORGANISM_CROSSWALK names one canonical sheet per organism. If that name
    isn't a real tab in this specific workbook (e.g. "Enterobacterales" in
    the v8.1 file, which calls it "Enterobacteriaceae"), fall back to a
    known alias - but only when the primary name is genuinely absent as a
    tab, never merely because a sheet exists with no matching drug row (that
    must stay a legitimate "no_drug_match", not be masked by a fallback).
    """
    if sheet in real_sheet_names:
        return sheet
    for alias in EUCAST_SHEET_ALIASES.get(sheet, []):
        if alias in real_sheet_names:
            return alias
    return sheet


def _build_resolved_for_version(version):
    xlsx_path = EUCAST_VERSION_PATHS[version]
    if not xlsx_path.exists():
        raise FileNotFoundError(f"EUCAST v{version} workbook not found at {xlsx_path}")

    real_sheet_names = set(pd.ExcelFile(xlsx_path).sheet_names)
    all_rows = parse_all_sheets(xlsx_path)
    rows_by_sheet = {}
    for row in all_rows:
        rows_by_sheet.setdefault(row["eucast_sheet"], []).append(row)

    resolved = {}
    resolution_log = []
    for organism, (sheet, org_reason) in ORGANISM_CROSSWALK.items():
        for drug in CANONICAL_BACTERIAL_DRUGS:
            if sheet is None:
                resolved[(organism, drug)] = {"outcome": "no_organism_match", "reason": org_reason}
                resolution_log.append({
                    "eucast_version": version,
                    "canonical_organism": organism, "canonical_drug": drug,
                    "eucast_sheet": "", "eucast_drug_label_used": "", "qualifier": "",
                    "s_leq": "", "r_gt": "", "outcome": "no_organism_match", "reason": org_reason,
                })
                continue

            resolved_sheet = _resolve_sheet_name_for_version(sheet, real_sheet_names)

            row, qualifier = resolve_drug_row(rows_by_sheet.get(resolved_sheet, []), drug, organism)
            if row is None:
                reason = f"'{drug}' is not offered as a row in the {resolved_sheet!r} sheet"
                resolved[(organism, drug)] = {"outcome": "no_drug_match", "reason": reason}
                resolution_log.append({
                    "eucast_version": version,
                    "canonical_organism": organism, "canonical_drug": drug,
                    "eucast_sheet": resolved_sheet, "eucast_drug_label_used": "", "qualifier": "",
                    "s_leq": "", "r_gt": "", "outcome": "no_drug_match", "reason": reason,
                })
                continue

            s_val, s_sentinel, s_bracket = parse_breakpoint_cell(row["s_leq_raw"])
            r_val, r_sentinel, r_bracket = parse_breakpoint_cell(row["r_gt_raw"])
            is_bracketed = s_bracket or r_bracket

            if s_sentinel is not None or r_sentinel is not None:
                sentinel = s_sentinel or r_sentinel
                outcome = f"no_numeric_value_{sentinel}"
                resolved[(organism, drug)] = {"outcome": outcome, "reason": sentinel}
            elif is_bracketed:
                resolved[(organism, drug)] = {
                    "outcome": "bracketed_ecoff", "s_leq": s_val, "r_gt": r_val,
                }
            else:
                resolved[(organism, drug)] = {
                    "outcome": "numeric", "s_leq": s_val, "r_gt": r_val,
                }

            resolution_log.append({
                "eucast_version": version,
                "canonical_organism": organism, "canonical_drug": drug,
                "eucast_sheet": resolved_sheet, "eucast_drug_label_used": row["drug_label_raw"],
                "qualifier": qualifier, "s_leq": row["s_leq_raw"], "r_gt": row["r_gt_raw"],
                "outcome": resolved[(organism, drug)]["outcome"], "reason": "",
            })

    return resolved, all_rows, resolution_log


def _ensure_loaded_for_version(version):
    if version not in _VERSION_CACHE:
        resolved, all_rows, resolution_log = _build_resolved_for_version(version)
        _VERSION_CACHE[version] = {
            "resolved": resolved,
            "all_rows": all_rows,
            "resolution_log": resolution_log,
        }
    return _VERSION_CACHE[version]


def eucast_version_for_cohort(source_cohort):
    return COHORT_EUCAST_VERSION[source_cohort]


def classify_bacterial(canonical_organism, canonical_drug, comparator, mic_value, source_cohort=None):
    """Return (basis, category) for one bacterial isolate-drug MIC reading.

    source_cohort selects the EUCAST table version per Justice's Step 7 Action
    (breakpoints applied per cohort before merging).
    """
    if source_cohort is None:
        raise ValueError("source_cohort is required for per-cohort EUCAST classification")
    version = eucast_version_for_cohort(source_cohort)
    cache = _ensure_loaded_for_version(version)
    resolved = cache["resolved"]
    basis_eucast = _basis_eucast(version)
    basis_bracketed = _basis_eucast_bracketed(version)

    if canonical_organism not in ORGANISM_CROSSWALK:
        return BASIS_NO_ORGANISM_MATCH, "canonical_organism_not_in_crosswalk"
    if canonical_drug not in CANONICAL_BACTERIAL_DRUGS:
        return BASIS_NO_DRUG_MATCH, "canonical_drug_not_in_bacterial_vocabulary"

    resolution = resolved[(canonical_organism, canonical_drug)]
    outcome = resolution["outcome"]
    if outcome == "no_organism_match":
        return BASIS_NO_ORGANISM_MATCH, resolution["reason"]
    if outcome == "no_drug_match":
        return BASIS_NO_DRUG_MATCH, resolution["reason"]
    if outcome.startswith("no_numeric_value_"):
        return BASIS_NO_EUCAST_VALUE, outcome.replace("no_numeric_value_", "")

    s_leq, r_gt = resolution["s_leq"], resolution["r_gt"]

    if outcome == "bracketed_ecoff":
        if comparator == "=" and mic_value > r_gt:
            return basis_bracketed, "R"
        if comparator == ">" and mic_value >= r_gt:
            return basis_bracketed, "R"
        return basis_bracketed, "no_S_I_call_bracketed_ecoff_only"

    if comparator == "=":
        if mic_value <= s_leq:
            category = "S"
        elif mic_value > r_gt:
            category = "R"
        else:
            category = "I"
    elif comparator == "<=":
        if mic_value <= s_leq:
            category = "S"
        else:
            return BASIS_CENSORED_INDETERMINATE, f"censored_reading_<=_{mic_value}_straddles_breakpoint"
    elif comparator == ">":
        if mic_value >= r_gt:
            category = "R"
        else:
            return BASIS_CENSORED_INDETERMINATE, f"censored_reading_>_{mic_value}_straddles_breakpoint"
    else:
        return BASIS_CENSORED_INDETERMINATE, f"unrecognized_comparator_{comparator}"

    if category == "S" and s_leq == OFF_SCALE_SENTINEL:
        category = "I"

    return basis_eucast, category


def main():
    failed = False
    CROSSWALK_DIR.mkdir(parents=True, exist_ok=True)
    today = dt.date.today().isoformat()
    versions = sorted(set(COHORT_EUCAST_VERSION.values()))

    all_raw_rows = []
    all_resolution_logs = []
    for version in versions:
        cache = _ensure_loaded_for_version(version)
        for row in cache["all_rows"]:
            all_raw_rows.append({**row, "eucast_version": version})
        all_resolution_logs.extend(cache["resolution_log"])

    raw_df = pd.DataFrame(all_raw_rows, columns=[
        "eucast_version", "eucast_sheet", "drug_label_raw", "s_leq_raw", "r_gt_raw",
    ])
    raw_df["version"] = "v1"
    raw_df["date_added"] = today
    raw_df.to_csv(BREAKPOINT_TABLE_PATH, index=False)
    print(f"Wrote {len(raw_df)} raw EUCAST breakpoint row(s) across "
          f"{raw_df['eucast_sheet'].nunique()} organism sheets and {len(versions)} version(s) to "
          f"{BREAKPOINT_TABLE_PATH.relative_to(ROOT.parents[0])}")

    cohort_map_rows = [
        {
            "source_cohort": cohort,
            "eucast_version": ver,
            "version_note": COHORT_VERSION_NOTES.get(cohort, ""),
            "version": "v1",
            "date_added": today,
        }
        for cohort, ver in COHORT_EUCAST_VERSION.items()
    ]
    cohort_map_df = pd.DataFrame(cohort_map_rows)
    cohort_map_df.to_csv(COHORT_VERSION_MAP_PATH, index=False)
    print(f"Wrote {len(cohort_map_df)} cohort -> EUCAST version row(s) to "
          f"{COHORT_VERSION_MAP_PATH.relative_to(ROOT.parents[0])}")

    org_rows = [
        {"canonical_organism": org, "eucast_sheet": sheet or "", "matched": sheet is not None,
         "reason": reason, "version": "v1", "date_added": today}
        for org, (sheet, reason) in ORGANISM_CROSSWALK.items()
    ]
    org_df = pd.DataFrame(org_rows)
    org_df.to_csv(ORGANISM_CROSSWALK_PATH, index=False)
    n_matched = org_df["matched"].sum()
    print(f"Wrote {len(org_df)} canonical-organism -> EUCAST-sheet row(s) "
          f"({n_matched} matched, {len(org_df) - n_matched} genuine coverage gap(s)) to "
          f"{ORGANISM_CROSSWALK_PATH.relative_to(ROOT.parents[0])}")

    drug_df = pd.DataFrame(all_resolution_logs)
    drug_df["version"] = "v1"
    drug_df["date_added"] = today
    drug_df.to_csv(DRUG_CROSSWALK_PATH, index=False)
    n_numeric = (drug_df["outcome"].isin(["numeric", "bracketed_ecoff"])).sum()
    print(f"Wrote {len(drug_df)} (version, organism, drug) resolution row(s) "
          f"({n_numeric} carry a real applicable S<=/R> value) to "
          f"{DRUG_CROSSWALK_PATH.relative_to(ROOT.parents[0])}")

    expected_pairs = len(ORGANISM_CROSSWALK) * len(CANONICAL_BACTERIAL_DRUGS)
    for version in versions:
        resolved = _VERSION_CACHE[version]["resolved"]
        if len(resolved) != expected_pairs:
            print(f"FAIL: EUCAST v{version} has {len(resolved)} resolved pairs != "
                  f"{expected_pairs} expected.")
            failed = True
        else:
            print(f"PASS: EUCAST v{version} - all {expected_pairs} (organism, drug) pairs "
                  f"carry exactly one recorded resolution outcome.")

        bad_values = []
        for (org, drug), res in resolved.items():
            for key in ("s_leq", "r_gt"):
                if key in res and not is_valid_mic_value(res[key]):
                    bad_values.append((version, org, drug, key, res[key]))
        if bad_values:
            print(f"FAIL: EUCAST v{version} - {len(bad_values)} parsed breakpoint value(s) "
                  f"fall outside the cited dilution series: {bad_values[:5]}")
            failed = True
        else:
            v_numeric = sum(1 for r in resolved.values() if r["outcome"] in ("numeric", "bracketed_ecoff"))
            print(f"PASS: EUCAST v{version} - every parsed numeric S<=/R> value "
                  f"({v_numeric * 2} value(s) across {v_numeric} pairs) is on the cited dilution series.")

    if failed:
        print("\nEUCAST breakpoint reference Check: FAIL")
        sys.exit(1)

    print("\nEUCAST breakpoint reference Check: PASS")


if __name__ == "__main__":
    main()
