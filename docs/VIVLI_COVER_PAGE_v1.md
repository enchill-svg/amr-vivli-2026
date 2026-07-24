# Vivli AMR Surveillance Data Challenge 2026
## Final Submission Document — Cover Page

**Challenge:** 2026 Vivli AMR Surveillance Data Challenge  
**AMR Register Data Request ID:** 00013346  
**Submission title:** AMR, Life Expectancy, and Intervention Impact  

**Open outputs:**  
- Repository: https://github.com/enchill-svg/amr-vivli-2026  
- Live dashboard: https://tanstack-start-app.amrlifeintel.workers.dev  

---

### Lead Applicant

| Field | Entry |
|------|--------|
| Name | Justice Ohene Amofa |
| Affiliation | Noguchi Memorial Institute for Medical Research (NMIMR) |
| Email | justiceoheneamofa@gmail.com |
| Role | Lead Applicant / primary Vivli contact |

---

### Team

| Name | Affiliation | Email | Role |
|------|-------------|-------|------|
| Justice Ohene Amofa | Noguchi Memorial Institute for Medical Research (NMIMR) | justiceoheneamofa@gmail.com | Lead Applicant |
| Erica Akanko | West African Centre for Cell Biology of Infectious Pathogens (WACCBIP) | eakanko15@gmail.com | Team member |
| Yewku Enchill-Yawson | Noguchi Memorial Institute for Medical Research (NMIMR) | enchillyawson@gmail.com | Team member |
| William Boateng | Noguchi Memorial Institute for Medical Research (NMIMR) | boatengwilliam72@gmail.com | Team member |
| Humphrey P. K. Addy | Kwame Nkrumah University of Science and Technology (KNUST) | addy.p.humphrey@gmail.com | Team member |

**Team type:** Non-student team.  
**Cross-Domain eligibility:** Yes — uses Global AMR R&D Hub data **and** eligible AMR Register datasets.

---

### AMR Register datasets used in the Final Submission

| Dataset | Role in this work |
|---------|-------------------|
| **SOAR 201818** | Primary bacterial surveillance cohort. Contributes isolates and MIC panels to the harmonized master table used for typology, trajectory, country-risk ranking, and LE/Hub analytics. |
| **SOAR 201910** | Primary bacterial surveillance cohort. Same master-table role as SOAR 201818 (organism–drug–country burden and change over time). |
| **SOAR 207965** | Primary bacterial surveillance cohort. Same master-table role; also the source of evaluability / zero-measurement handling documented in preprocessing. |
| **Vivli/SENTRY Antifungals (2010–2024)** | Primary fungal surveillance cohort in the master table (fungal typology, fungal country-year panel, fungal LE association). *Note:* stored under folder label `ATLAS_Antifungals` but this file is **SENTRY**, not ATLAS Antibiotics. |
| **ATLAS Antibiotics (2004–2024)** | Integrity / evidence-gate only. *K. pneumoniae* subset used for carbapenemase detection-only Manski bounds and identifiability calibration. **Not** merged into the primary LE / country-risk master table. |
| **PLEA Study I** | Integrity / evidence-gate only. Sampling-validation reference and design-based follow-up allocator pilot (where additional MIC budget would resolve uncertainty). **Not** merged into the primary LE / country-risk master table. |

Eligible Register analysis used: **Yes**.

---

### External / supplementary datasets disclosed

| Dataset | Role in this work |
|---------|-------------------|
| **Global AMR R&D Hub** investment / funding exports | Maps public R&D spend vs surveillance burden (Q3 funding gap); supports Global AMR R&D Hub Cross-Domain award relevance. |
| **WHO / World Bank** life expectancy and health indicators | Primary outcome and health-system context for LE association models and country explorer views. |
| **World Bank** hospital beds per capita | Health-system capacity component of public country-risk ranking (`risk_rank_core`). |
| **ECDC ESAC-Net** antimicrobial consumption | Antibiotic-consumption join for matched European country–years (Q2 driver panel; partial coverage). |
| **WHO/UNICEF** Hib3 and PCV immunization coverage | Vaccination covariates in bacterial association models where years match. |
| **GBD 2023** Socio-demographic Index (SDI) | Dominant development covariate in fungal LE association; capacity/context for joins. |
| **GBD** LRI pathogen burden comparator | Joined for context; not used as a primary public claim series. |
| **EUCAST** Clinical Breakpoint Tables v8.1 / v10.0 | Bacterial MIC → S/I/R classification reference (versioned per SOAR cohort). |
| **CLSI** antifungal breakpoints / ECVs | Fungal MIC classification / wild-type vs non-wild-type reference where breakpoints are absent. |

No unused Register mirrors (e.g. SIDERO-WT, Bedaquiline/DREAM) are claimed in this Final Submission.

---

### Project summary

Open AMR Life Expectancy Intelligence platform: a reproducible 30-stage pipeline and interactive dashboard that turn four primary Vivli AMR Register cohorts (Data Request **00013346**; **34,787** isolates; 59 countries), with ATLAS Antibiotics and PLEA Study I used for integrity calibration, into gated country-risk rankings, organism–drug typology, Hub funding–burden maps, and intervention scenarios. External joins include WHO/World Bank life expectancy, health-system indicators, GBD SDI, vaccination, ESAC-Net consumption, and Global AMR R&D Hub funding. An integrity gate publishes only estimates the data can support (`pass` / `bounds_only` / `withhold`). Findings are associational, not causal.

---

### Software / platforms

- Analysis: Python (pandas, numpy, scipy, statsmodels, scikit-learn)  
- Dashboard: TypeScript / React (TanStack Start), Cloudflare Workers  
- Open access: GitHub repository and live workers.dev URL above  

---

### Upload checklist

- [ ] Cover Page Form completed on Vivli (use this document as the field guide)  
- [ ] Final Submission PDF ≤ 5 pages including figures (cover + references excluded)  
- [ ] Abstract, Objectives, Methods, Results, Impact, Tables/figures, References present  
- [ ] No appendices  
- [ ] Links only to open repositories (GitHub / live dashboard)  
- [ ] Lead Applicant = Justice Ohene Amofa  
- [ ] All Register and external datasets above disclosed  

**Upload via:** AMR Register → Data Request **00013346** → Chat (Cover Form + Final Submission PDF).
