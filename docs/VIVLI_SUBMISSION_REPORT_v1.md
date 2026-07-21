# AMR, Life Expectancy, and Intervention Impact
### Vivli AMR Surveillance Data Challenge 2026 — Final Submission Document

**Open outputs:** https://github.com/enchill-svg/amr-vivli-2026  
**AMR Register Data Request ID:** 00013346  
**Verified against:** pipeline run 20260720T144743 and data/published/ (2026-07-20). Every claim cites a published file in that repository.

---

## Abstract

We built an open **AMR Life Expectancy Intelligence** platform: a reproducible 30-stage pipeline and interactive dashboard that turn four Vivli AMR Register cohorts into gated country-risk rankings, organism–drug typology, Hub funding–burden maps, and intervention scenarios. Surveillance data (Data Request ID **00013346**) cover three SOAR bacterial surveys and Vivli/SENTRY antifungals — **34,787 isolates** and a **343,236-row** isolate–drug master table across 59 countries — joined to WHO/World Bank life expectancy, health-system indicators, GBD SDI, vaccination, ESAC-Net consumption (Europe), and Global AMR R&D Hub funding. An integrity gate publishes only estimates the data can support (pass / bounds-only / withhold). Headline deliverables include a full bacterial typology (640/640 public), 29/30 bacterial country-risk ranks, and a clear Hub underfunding signal for all four bacterial organisms. Fungal LE association is dominated by GBD SDI (non-causal); intervention LE gains remain gated until stronger panels exist. Judges can run the code and explore the same gated tables without raw Register files.

---

## Objectives

**Primary objective.** Determine which AMR subtypes (organism–drug–region combinations), characterized by current resistance burden and trajectory of change across bacterial and fungal pathogens, are associated with the lowest life-expectancy outcomes, and estimate the relative impact of candidate interventions on closing that gap.

**Guiding questions.**

1. **Q1** — Which resistance profiles co-occur with the lowest national life expectancy?
2. **Q2** — Does that relationship track antimicrobial overconsumption, weak health-system capacity, low vaccination coverage, or hospital-acquired exposure — and does the answer differ by pathogen type?
3. **Q3** — Where does AMR R&D investment concentrate relative to surveillance burden?
4. **Q4** — Which organism–drug combinations are not yet high-burden but show the steepest trajectory?
5. **Q5** — Which intervention category would plausibly yield the largest life-expectancy gain if scaled?

---

## Methods

**Surveillance data.** Obtained through the Vivli AMR Register under **Data Request ID 00013346**: SOAR 201818, 201910, and 207965 (bacterial) and Vivli/SENTRY 2010–2024 (fungal). Harmonized isolate registry: **34,787** records (**34,758** classified: 7,836 bacterial, 26,922 fungal; **29** SOAR 207965 unclassified at organism crosswalk). Master table: **343,236** isolate–drug rows; 59 countries; 61 organisms; 71 drug codes (dataset_manifest_v1.csv).

**External joins (ISO3 x year).** WHO/World Bank life expectancy (outcome); ECDC ESAC-Net consumption; WHO/UNICEF Hib3/PCV coverage; World Bank health expenditure and hospital beds; GBD 2023 SDI and LRI comparator; Global AMR R&D Hub funding.

**Pipeline and product.** Single orchestrator (analysis/run_all.py, 30 stages): preprocessing; integrity (identifiability ledger, Manski bounds, ATLAS/PLEA calibration); analytics (descriptive profiling; MIC trajectory / evolutionary fitness; k-means typology — bacteria k=4, silhouette 0.584; fungi k=2, silhouette 0.847; external join; LE association; Hub alignment; intervention scenarios); gated deliverables; verification. Seven evidence-gate checks (EG-01–EG-07) and re-validation (J-01–J-07) returned PASS (analysis/scripts/verify_all_figures.py). The dashboard (dashboard/) loads the same gated bundle (dashboard_bundle_v1.json) for country risk, policy, and methodology views.

**Integrity gate.** Each public row carries a quality_gate of pass, bounds_only, or withhold. Detection-only genotypes are Manski-bounded, never point prevalence. Breakpoint-absent fungal pairs are marked unclassifiable, not dropped (identifiability_ledger_v1.csv, 16 categories). A design-based follow-up allocator (evidence_gate_core/allocator.py) recommends where fixed MIC budget would resolve uncertainty (PLEA pilot example: pooled prevalence 61.8% [55.1%, 68.5%]; allocator_recommendations_v1.csv).

**Association model.** OLS with country-clustered standard errors of life expectancy on burden, trajectory, health expenditure, beds, SDI, and year (plus Hib3/PCV and ESAC-Net for bacteria). Explicitly non-causal (project brief Section 8).

---

## Results

**Q1 — Co-occurrence (typology and country risk).** Bacterial typology releases **640/640** public combinations: moderate 387, high_trajectory 92, high_burden 92, high_burden_high_trajectory 69 (cluster_typology_bacterial_gated_v1.csv). Top high_burden_high_trajectory examples include *S. pneumoniae*/cefaclor (Slovakia, Cambodia) and *H. influenzae*/trimethoprim-sulfamethoxazole (Morocco). Fungal typology releases **107/1,288** (8.3%) after gating. Bacterial country risk: **29/30** pass (Ghana withheld for sparse years); Singapore, Cambodia, Kenya, India, and UAE lead (country_risk_ranking_bacterial_gated_v1.csv; Figure 1). Fungal country risk remains bounds-only or withheld at country level (0/43 pass) — the platform surfaces that limit rather than inventing ranks.

**Q2 — Drivers.** Fungal model (n=269 country-years, 36 countries, R-squared=0.638): GBD SDI dominates (coefficient 40.7, cluster SE 4.57, p=5.7e-19); dropping SDI collapses R-squared to 0.175. Health expenditure and beds are not distinguishable from zero under clustered SEs (p=0.173, 0.165). Bacterial primary model (n=16, 5 countries) is flagged small-sample and is not used for coefficient claims. Consumption covers 21 bacterial Europe-only rows; no antifungal consumption or hospital-acquired-exposure series is available (q2_driver_evidence_summary_v1.csv).

**Q3 — Funding vs burden (Hub tool).** All four bacterial organisms show burden share well above matched Hub funding share (e.g. *K. pneumoniae* 32.3% vs 1.7%, -30.6 percentage points; *E. coli* 28.4% vs 3.2%) (funding_gap_summary_v1.csv). Portfolio composition (Hub $18.84B): 23.3% therapeutics, 8.4% diagnostics, 8.2% vaccines, 58.0% other/unclassified; **2.1% SSA** vs 97.0% non-SSA (hub_funding_composition_summary_v1.csv; Figure 2; Hub export excludes private/VC).

**Q4 — Early-action combinations.** Bacterial high_trajectory: 92/640; fungal gated high_trajectory: 30/107 — candidates for early intervention distinct from already dual-high combinations.

**Q5 — Intervention scenarios.** Of 11 candidate intervention rows, none currently meet the integrity bar for a public LE-gain ranking (intervention_recommendations_ranked_gated_v1.csv). The dashboard therefore presents an empty ranked list with explicit reasons (small sample, data gap, funding-only without LE elasticity, or fungal vaccination excluded by design) so users see where evidence must improve before policy ranking.

---

## Impact of the work

1. **Reusable product.** An open pipeline and dashboard (https://github.com/enchill-svg/amr-vivli-2026) that any team can clone to reproduce gated risk maps, Hub alignment tables, and methodology ledgers without raw Register files.  
2. **Hub-ready intelligence.** Bacterial funding–burden mismatches are large, consistent across organisms, and independent of fragile LE models — directly usable for Global AMR R&D Hub cross-domain discussion.  
3. **Actionable early-warning layer.** Full bacterial typology and 29-country risk ranking highlight high-burden / high-trajectory organism–drug–country combinations for stewardship and surveillance priority.  
4. **Credible policy boundary.** By gating unsupported intervention LE claims, the platform prevents false league tables and points the next data investments (antifungal consumption, hospital exposure, larger bacterial LE panels) where they add the most value.

---

## Tables / figures

**Table 1. Gating summary across published deliverables**  
Sources: gating_comparison_v1.csv, organism_drug_quality_gate_v1.csv.

| Deliverable | Rows | Pass | Bounds-only | Withhold |
|---|---:|---:|---:|---:|
| Cluster typology — bacterial | 640 | 640 (100%) | 0 | 0 |
| Cluster typology — fungal | 1,288 | 107 (8.3%) | 1,181 | 0 |
| Country risk ranking — bacterial | 30 | 29 (96.7%) | 0 | 1 |
| Country risk ranking — fungal | 43 | 0 (0%) | 40 | 3 |
| Intervention recommendations | 11 | 0 (0%) | 0 | 11 |
| All organism–drug strata | 1,822 | 87 (4.8%) | 713 (39.1%) | 1,022 (56.1%) |

**Figure 1. Bacterial country risk ranking — top pass-gated countries**  
Source: country_risk_ranking_bacterial_gated_v1.csv.

![Bacterial country risk ranking](figures/fig1_bacterial_country_risk.png)

**Figure 2. Global AMR R&D Hub funding composition**  
Source: hub_funding_composition_summary_v1.csv.

![Hub funding modality and geography composition](figures/fig2_hub_funding_composition.png)

---

## Limitations

Most organism–drug strata still cannot support a point estimate (fungal unclassifiable about 20.9% of master rows). The bacterial LE model is too small for inference. Consumption is Europe-only; hospital exposure is absent. Isolate totals: 34,758 classified + 29 unclassified = 34,787 (dataset_manifest_v1.csv).

---

## References

*(Not counted in Vivli's 5-page maximum.)*

1. Vivli. *AMR Surveillance Data Challenge — How to Participate.* https://amr.vivli.org/data-challenge/how-to-participate/  
2. Vivli AMR Register. https://amr.vivli.org/ (Data Request ID 00013346)  
3. Global AMR R&D Hub. Dynamic Dashboard / investment exports. https://dashboard.globalamrhub.org/  
4. WHO / World Bank. Life expectancy and health-system indicators (country-year series used in joins).  
5. ECDC. ESAC-Net antimicrobial consumption (J01) — Europe.  
6. WHO/UNICEF. Hib3 and PCV immunization coverage estimates.  
7. IHME. Global Burden of Disease 2023 — Socio-demographic Index (SDI).  
8. EUCAST. Clinical breakpoints (v8.1 / v10.0) used for bacterial MIC classification.  
9. CLSI. Antifungal breakpoints / ECVs as applied in fungal classification.  
10. Manski CF. Partial identification / bounds for incomplete data (methodological basis for detection-only genotype reporting).  
11. Akanko E, Enchill-Yawson Y, Boateng W, Ohene Amofa J, Addy HPK. *AMR, Life Expectancy, and Intervention Impact.* 2026 Vivli AMR Surveillance Data Challenge. GitHub: https://github.com/enchill-svg/amr-vivli-2026  

**Team (for Cover Page Form):** Erica Akanko (WACCBIP); Yewku Enchill-Yawson, William Boateng, Justice Ohene Amofa (NMIMR); Humphrey P. K. Addy (KNUST).
