# AMR, Life Expectancy, and Intervention Impact — Unified Project Brief

**Document version:** 1.1 — 2026-07-09  
**Canonical source:** `docs/new_datasets/AMR_Life_Expectancy_Project_Brief.pdf` (Justice, 14 pp.)  
**Also:** `docs/_justice_idea_raw_dump.txt` (text extraction of the same brief)

---

## How to read this document

| Layer | Role |
|-------|------|
| **§1 — Justice’s project** | The main idea: objective, guiding questions, data, analytics, outputs |
| **§2 — Integrity layer** | Added prerequisite: identifiability gating so §1 answers are defensible |
| **§3 — Platform & delivery** | Dashboard, ingest, open release — how the project is demonstrated and shipped |

One project. One pipeline. Justice’s objective is the north star; the integrity layer is not a second pitch.

---

## §1 — Justice’s project (main idea)

### Title

**AMR, Life Expectancy, and Intervention Impact**  
*An integrated bacterial and fungal surveillance project combining SOAR bacterial cohorts, the Vivli/SENTRY antifungal cohort, and external health and R&D investment data.*

### Objective (PDF §2)

> To determine which AMR subtypes — organism–drug–region combinations, characterized by both their **current resistance level** and their **trajectory of change** — across bacterial and fungal pathogens are associated with the **lowest life expectancy outcomes**, and to estimate the **relative impact of candidate interventions** on closing that gap.

### Five guiding questions (PDF §2)

These are the questions the platform must answer:

1. Which resistance profiles — bacterial or fungal — **co-occur with the lowest national life expectancy** figures?
2. Is the relationship more consistent with **antimicrobial overconsumption**, **weak health system capacity**, **low vaccination coverage**, or **hospital-acquired exposure patterns** — and does the answer differ between bacteria and fungi?
3. Where does **AMR R&D investment** concentrate relative to where surveillance shows the **heaviest burden**, separately for bacterial and fungal pathogens — and does the mismatch matter?
4. Which pathogen–drug combinations are **not yet high-resistance today** but show the **steepest evolutionary trajectory**, such that early intervention carries outsized leverage?
5. Which **intervention category**, if scaled in the highest-burden or highest-trajectory countries, would plausibly yield the **largest life-expectancy gain**?

### Data scope (PDF §3)

**Surveillance (four cohorts — the harmonized core):**

| Cohort | Role |
|--------|------|
| SOAR 201818, 201910, 207965 | Bacterial arm (~7,865 isolates) |
| Vivli/SENTRY 2010–2024 | Fungal arm (~26,922 isolates) |

**External (joined by ISO3 country-year):**

| Source | Role in Justice’s design |
|--------|--------------------------|
| WHO / World Bank life expectancy | **Primary outcome variable** |
| ECDC ESAC-Net consumption | Consumption–resistance (bacteria, Europe) |
| WHO/UNICEF vaccination (Hib, PCV) | Vaccination effect (bacteria only) |
| World Bank health indicators | Health-system confounder |
| Global AMR R&D Hub | Funding vs burden alignment |

### Analytic methodology (PDF §6)

Executed in order after preprocessing (PDF §5, Steps 1–10):

1. **Descriptive profiling** — resistance/susceptibility by organism, drug class, country, year, body site / specimen source  
2. **Evolutionary layer** — Evolutionary Fitness Score and Distance-to-Failure from MIC shifts (6 longitudinal bacterial countries + dense SENTRY country-years)  
3. **Clustering** — static burden + trajectory features; bacteria and fungi run separately  
4. **External data join** — LE, consumption, vaccination, health indicators  
5. **Association analysis** — regress **life expectancy** on burden, trajectory, consumption, vaccination/health capacity (bacteria and fungi separately)  
6. **R&D alignment** — Hub funding vs surveillance burden by pathogen type  
7. **Intervention impact** — plausible LE gains per category:
   - **Bacteria:** vaccination, antibiotic stewardship, diagnostics, R&D, WASH/infection prevention  
   - **Fungi:** antifungal stewardship, diagnostics, IPC, R&D (no vaccination — no licensed analog)

### Expected outputs (PDF §7)

| # | Deliverable |
|---|-------------|
| 1 | Harmonized dual-pathogen dataset (~34,800 isolates) + versioned crosswalks |
| 2 | Identifiability ledger (detection-only + breakpoint-absent gaps) |
| 3 | Cluster typology (high-risk + high-trajectory combinations) |
| 4 | Country risk ranking (burden + trajectory + **consumption** + health-system capacity) |
| 5 | Funding-gap summary (Hub vs burden) |
| 6 | Ranked intervention recommendations with **estimated life-expectancy impact** |

### Hard constraints from profiling (PDF §4, §8)

- **6 countries** support genuine cross-cohort bacterial trends: Ukraine, Turkey, Tunisia, Pakistan, Kuwait, Vietnam  
- **7 countries** support combined bacteria–fungi comparison: Italy, Spain, Turkey, Chile, Czech Republic, Argentina, Greece  
- **48k+ fungal rows** lack a classifiable standard for key drugs (breakpoint-absent → ranges, not point estimates)  
- Life expectancy regression = **suggestive association**, not causal attribution (PDF §8)  
- ESAC-Net consumption thinner for fungi; Hub excludes private funding  

### Guiding questions → repo mapping

| Question | Pipeline steps | Artifact(s) | Gap |
|----------|----------------|-------------|-----|
| Q1 — LE co-occurrence | 14, 15 | `bounds/external_join_*`, association outputs | Needs **gated** burden inputs |
| Q2 — drivers (consumption, health, vaccination, hospital) | 15 | Step 15 OLS | Consumption **not wired**; hospital exposure **not in data** |
| Q3 — R&D vs burden | 16 | `funding_gap_summary_v1.csv` | Built |
| Q4 — trajectory leverage | 12, 13 | `cluster_typology_*_v1.csv` | Built |
| Q5 — intervention LE gain | 17, 18 | `intervention_recommendations_ranked_v1.csv` | Many `data_gap`; Hib rank needs fix |

---

## §2 — Integrity layer (added prerequisite)

Justice’s brief already requires fixing identifiability **at the data layer before analysis** (PDF §1 ¶12; §5 Step 8; §4.4). The team extended that into an operational **integrity layer** (sometimes called *missing negative* in methods only):

- **Detection-only genotype fields** (SOAR beta-lactamase; ATLAS carbapenemase at Register scale) → Manski bounds, not point prevalence  
- **Breakpoint-absent fungal pairs** (SENTRY) → ECV, MIC distribution, or `unclassifiable` — disclosed in ledger  
- **Export validator + sampling validation** (PLEA, SOAR) → prove bias/coverage before trusting policy outputs  
- **Budget allocator** (optional) → cheapest path to shrink uncertainty  

**This layer does not change Justice’s objective.** It ensures Questions 1, 3, 4, and 5 are answered with identifiable burden and trajectory — not inflated surveillance exports.

```text
JUSTICE PROJECT (§1)                         INTEGRITY LAYER (§2)
────────────────────                         ────────────────────
Harmonize SOAR + SENTRY          ◄──────────  Ledger + bounds (Step 8, fungal gaps)
Burden + evolutionary trajectory ◄──────────  Gate: withhold unidentifiable strata
Join LE, vaccination, Hub        ◄──────────  Validator on upload / batch export
Association + interventions    ◄──────────  PLEA/ATLAS calibration (proof, not policy grid)
```

**ATLAS and PLEA** are not substitutes for SOAR/SENTRY in §1. They support §2: scale demonstration (ATLAS) and validation (PLEA). SOAR Step 8 bounds merge into the unified bounds table.

---

## §3 — Platform, pipeline, and remaining work

### End-to-end flow (one pipeline)

```text
SOAR + SENTRY
    → Steps 1–10 (harmonize, classify, master table)
    → Integrity layer (ledger, bounds, validator)
    → Steps 11–17 (burden, trajectory, cluster, LE join, association, Hub, interventions)
    → Gated deliverables
    → Dashboard + ingest (same validator path)
```

### Deliverable status

| Justice output (§7) | Status |
|---------------------|--------|
| Harmonized dataset + crosswalks | **Built** — `master/`, `crosswalks/` |
| Identifiability ledger | **Built** — `identifiability_ledger_v1.csv` |
| Cluster typology | **Built** — `cluster_typology_*_v1.csv` |
| Country risk ranking | **Built — needs gating**; consumption dimension omitted (ESAC-Net gap) |
| Funding-gap summary | **Built** — `funding_gap_summary_v1.csv` |
| LE-ranked interventions | **Built — needs honest ranking** — `intervention_recommendations_ranked_v1.csv` |

Plus: dashboard (`docs/amr-life-expectancy-intelligence/`), allocator, `run_evidence_gate.py`, verification script.

### Pitch discipline (LE is central; claims are careful)

**Say:**

- Primary outcome is **national life expectancy** joined to harmonized, **gated** surveillance burden and trajectory.  
- We answer Justice’s **five guiding questions** with explicit limitations (PDF §8).  
- Intervention menu shows **LE scenarios where estimable** and **`data_gap` where not**.

**Do not say:**

- “Hib adds 0.54 years per pp” as headline (`implausible_magnitude_likely_confounding` in own CSV).  
- “We proved AMR causes lower life expectancy.”

### Remaining work

1. Gate burden inputs before LE regression and public risk maps  
2. ~~Fix intervention ranking (no #1 rank on confounded Hib coefficient)~~ — **done** (`step18b_gated_deliverables.py`)  
3. Wire dashboard to gated CSVs (not demo data); LE on country cards  
4. ~~Single orchestrator~~ — **done** (`run_all.py`)  
5. Submission title: *AMR, Life Expectancy, and Intervention Impact* — subtitle: open platform with integrity gating  

### One sentence

> We built Justice’s integrated bacterial–fungal surveillance platform that links **resistance burden and MIC trajectory to national life expectancy**, compares burden to **R&D investment**, and ranks **intervention categories by plausible LE impact where data allow** — with an **integrity layer** that bounds detection-only and unclassifiable fields before any of those claims are published.

---

## Related documents

| Document | Path |
|----------|------|
| **Justice project brief (PDF)** | `docs/new_datasets/AMR_Life_Expectancy_Project_Brief.pdf` |
| Justice text extraction | `docs/_justice_idea_raw_dump.txt` |
| Combined execution plan | `docs/AMR_2026_COMBINED_EXECUTION_PLAN.md` |
| Deliverables | `deliverables/` |
| Dashboard | `docs/amr-life-expectancy-intelligence/` |
