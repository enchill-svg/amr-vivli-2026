# Submission checklist (internal — do not convert to PDF, do not send to judges)

Working notes for turning `VIVLI_SUBMISSION_REPORT_v1.md` into the actual PDF submission. This file stays out of the judge-facing document.

## PDF conversion
- Convert the markdown to PDF at ≈11 pt, standard margins.
- Target ≤5 pages including figures/tables. The References section is **not** counted in Vivli's 5-page limit.
- Proof the rendered PDF for these Unicode glyphs before sending — some converters substitute a font that drops or boxes them: `⁻¹⁹`, `ρ`, `∈`, `×`, `≈`, `≤`, `²`, en/em dashes.
- Do not attach appendices.

## Cover Page Form
- Submit the separate Vivli Cover Page Form via the AMR Register data-request chat.
- Past-winner submissions (Team Neha 2024, aj-clements/LSHTM 2023) both included a per-person "Role in the Data Challenge" column on their form (CRediT-style: conceptualisation, writing original draft, data curation, review and editing). If the 2026 form uses the same template, have each team member's role ready — not yet filled in anywhere in this repo (README's Team table only has Name/Affiliation/Contact).

## Figures
- Two figures now embedded in the report body (see "Tables / figures" section): bacterial country-risk ranking (top pass-gated countries) and Hub funding modality/geography composition. Both generated directly from `data/published/*.csv` via `docs/figures/generate_report_figures.py` — re-run that script if the pipeline republishes with different numbers before final PDF conversion.

## Repo sync (must happen before submitting, so the report's own claims are true)
- `docs/VIVLI_SUBMISSION_REPORT_v1.md` and its dependent `data/published/*` files must be committed and pushed to `origin/main` before submission — the report cites "Open outputs: https://github.com/enchill-svg/amr-vivli-2026" and a specific pipeline run/`data/published/` state as "Verified against."
