# Appendix 2: Country ISO 3166-1 Alpha-3 Crosswalk

**Addresses:** Section 5, Step 1 ("Country-name harmonization") of Justice's
preprocessing pipeline.

**Scope boundary:** this appendix resolves country *name strings* as they appear
verbatim in the four raw cohort files to one canonical ISO 3166-1 alpha-3 code each.
It does not address year/date parsing (Step 2), organism harmonization (Step 3), drug
codes (Step 4 — see Appendix 3), MIC notation (Step 5), evaluability filtering (Step
6), breakpoint/ECV classification (Step 7 — see Appendix 4), genotype-field
identifiability bounds (Step 8 — see Appendix 5), age harmonization (Step 9), or
deduplication/master-schema assembly (Step 10). Where this appendix's findings feed
directly into one of those later steps (chiefly Step 10's cross-cohort overlap check),
a pointer is given but the methodology itself is not re-derived here.

**Input:** the union of all distinct raw country strings observed across SOAR 201818
(9), SOAR 201910 (18), SOAR 207965 (10), and Vivli/SENTRY (44) — 59 distinct strings
after deduplication, per this session's verification (see Appendix 1 for the
per-cohort source facts this appendix builds on).

---

## 0. Justice's Step 1 Check — Precise Restatement

Justice's original check reads: "every distinct country string resolves to exactly
one ISO3 code; no code maps back to more than one canonical name."

Read literally, the second clause is too strict for a real multi-cohort crosswalk and
must be restated precisely before it is used as a pass/fail test, because two raw
strings *correctly* collapsing onto the same ISO3 code is expected, successful
harmonization — not a defect. (Example: "Slovak Republic" and "Slovakia" are the same
country under two different names; both correctly resolve to `SVK`.) The two clauses
of the check should therefore be read as:

1. **No raw string is ambiguous.** Every one of the 59 raw strings maps to exactly
   one ISO3 code in this table — never two. This is the only "one string, one code"
   invariant that must hold without exception.
2. **Multiple raw strings MAY legitimately map to the same ISO3 code.** This is
   correct harmonization behavior, not a failure of the check. The actual failure
   modes to test for programmatically are:
   - (a) a single raw string appearing more than once in the table with two
     *different* ISO3 codes (an ambiguous mapping — must never occur; not observed in
     this crosswalk);
   - (b) two raw strings that denote genuinely *different* sovereign countries
     incorrectly collapsed onto the same code by mistake (a harmonization bug,
     distinct from a legitimate same-country collision; not observed in this
     crosswalk);
   - (c) any raw string carrying a mapping in which the compiler was not ≥95%
     confident, left unflagged for manual review (see §4 — all such cases in this
     crosswalk *are* flagged, none are silently left at high confidence).
3. Every raw string must carry a confidence level (`high` / `medium` / `flagged`) and
   a note; `flagged` rows require the specific reason to be stated, not just the
   label.

This restatement is the operative check for this appendix. §6 below runs it against
the full table.

---

## 1. Methodology and Source-Attribution Caveat

The 59-string list itself (which raw strings exist, verbatim) is taken as given,
verified ground truth for this session — it is the union of the per-cohort country
lists in Appendix 1. **Which cohort(s) each string was drawn from is not equally well
established for every row**, and this crosswalk is transparent about the difference:

- **Directly confirmed:** SOAR 201818's 9 countries, SOAR 201910's 18 countries, and
  SOAR 207965's 10 countries were each enumerated by name in this session's
  verification (Appendix 1). Any raw string appearing in one of those three named
  lists is tagged with that cohort directly, no inference involved.
- **Directly confirmed for SENTRY:** only SENTRY's top 5 countries by volume (USA
  7,257; Italy 2,298; Germany 2,041; Australia 1,441; Spain 1,253) were individually
  named with counts in this session's verification. The other 39 of SENTRY's 44
  countries were confirmed to exist as a *total count* (44, zero nulls) but were not
  individually named or counted this session (Appendix 1, Gap 4).
- **Elimination-derived (marked `SENTRY*` throughout §2):** the three SOAR cohorts'
  named lists total exactly 30 distinct raw strings (9 + 18 + 10, after removing
  cross-cohort duplicates — worked below). The full 59-string union given for this
  appendix therefore implies the remaining 59 − 30 = 29 raw strings must belong to
  SENTRY, since SOAR is otherwise fully enumerated and SENTRY is the only other
  source file. This is a valid deduction from the given counts, **not** an independent
  re-confirmation against the raw SENTRY country column — nobody re-opened the SENTRY
  file and checked each of these 29 names individually this session. Treat the
  `SENTRY*` tag as "attributed by elimination, not yet independently re-verified,"
  and re-verify against the raw file before this attribution is relied on for anything
  beyond the ISO3 mapping itself (e.g., before computing a SENTRY per-country row
  count for one of these 29 countries).

**Arithmetic shown (for auditability):**
- SOAR 201818 named list (9): Russia, Czech Republic, Romania, Bulgaria, Ukraine,
  Slovak Republic, Croatia, Greece, Serbia.
- SOAR 201910 named list (18) adds 17 new strings (Ukraine repeats): Argentina,
  Cambodia, Chile, Costa Rica, Ghana, Kenya, Kuwait, Lebanon, Morocco, Nigeria,
  Pakistan, Philippines, Saudi Arabia, Singapore, Tunisia, Turkey, Vietnam.
  Running total: 9 + 17 = 26.
- SOAR 207965 named list (10) adds 4 new strings (Kuwait, Pakistan, Tunisia, Turkey,
  Ukraine, Vietnam all repeat): India, Italy, Spain, United Arab Emirates.
  Running total: 26 + 4 = **30 distinct raw strings across all three SOAR cohorts.**
- 59 (full union, given) − 30 (SOAR union) = **29 raw strings attributable only to
  SENTRY**, tagged `SENTRY*` below.

This also means: of SENTRY's 44 countries, at least 5 (Italy, Spain, and the USA/
Germany/Australia trio, none of which appear in any SOAR list) are directly
confirmed by name; the other 39 SENTRY countries include the 29 `SENTRY*` rows below
plus an unknown number that overlap with SOAR countries not confirmed either way
(e.g., it is plausible but **not confirmed** that Ukraine or Turkey also appear in
SENTRY — absence from this appendix's "SENTRY" tag for a SOAR-attributed row does not
mean the country is confirmed absent from SENTRY, only that it was not independently
confirmed present).

---

## 2. Full Crosswalk Table (59 Raw Strings)

Confidence legend: **high** = standard, unambiguous ISO 3166-1 mapping; **flagged** =
mapping requires an explicit, stated assumption or carries a political/statistical
caveat a reviewer must see before relying on it. No row in this crosswalk was assessed
at **medium** confidence — every row is either a clean high-confidence mapping or
carries a specific, named reason for a flag (see §4 for the flagged rows' full
reasoning).

Source-cohort tags: `201818` / `201910` / `207965` = SOAR cohort, confirmed by direct
name-list enumeration (Appendix 1). `SENTRY` = confirmed directly (top-5 by volume).
`SENTRY*` = attributed by elimination only, not independently re-verified this session
(see §1). `+` joins cohorts where a string is confirmed present in more than one.

| # | Raw string | ISO3 | Canonical short name | Confidence | Source cohort(s) | Note |
|---|---|---|---|---|---|---|
| 1 | Argentina | ARG | Argentina | high | 201910 | 363 rows — largest single country in that cohort. |
| 2 | Australia | AUS | Australia | high | SENTRY | 1,441 rows, confirmed directly in SENTRY's top 5. |
| 3 | Belgium | BEL | Belgium | high | SENTRY* | Not named in any SOAR list; elimination-derived (§1). Row count not captured this session. |
| 4 | Brazil | BRA | Brazil | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 5 | Bulgaria | BGR | Bulgaria | high | 201818 | 237 rows. |
| 6 | Cambodia | KHM | Cambodia | high | 201910 | Listed among the 18 countries; row count not individually captured this session. |
| 7 | Canada | CAN | Canada | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 8 | Chile | CHL | Chile | high | 201910 | 150 rows. |
| 9 | China | CHN | China | high | SENTRY* | Elimination-derived (§1). Distinct code from Hong Kong (#19) and Taiwan (#51) — do not merge; see §4. Row count not captured this session. |
| 10 | Colombia | COL | Colombia | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 11 | Costa Rica | CRI | Costa Rica | high | 201910 | 54 rows. |
| 12 | Croatia | HRV | Croatia | high | 201818 | 192 rows. |
| 13 | Czech Republic | CZE | Czechia (ISO's current official short name; "Czech Republic" is the official long name and matches the raw string exactly) | high | 201818 | 397 rows. |
| 14 | Ecuador | ECU | Ecuador | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 15 | France | FRA | France | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 16 | Germany | DEU | Germany | high | SENTRY | 2,041 rows, confirmed directly in SENTRY's top 5. |
| 17 | Ghana | GHA | Ghana | high | 201910 | Only 2 rows — the thinnest country group in SOAR 201910 (tied for thinnest overall with Nigeria's 4, #33). Any Ghana- or West-Africa-specific claim built on this cohort alone rests on an extremely small base; must be labeled as such wherever used downstream. |
| 18 | Greece | GRC | Greece | high | 201818 | 151 rows. |
| 19 | Hong Kong | HKG | Hong Kong | flagged | SENTRY* | Not a UN member state / not sovereign — a Special Administrative Region of China. HKG is nonetheless the standard, stable ISO 3166-1 code used routinely in surveillance data; recorded here as a data-harmonization fact, not a political position. Row count not captured this session. |
| 20 | Hungary | HUN | Hungary | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 21 | India | IND | India | high | 207965 | Listed among the 10 countries; per-country count not individually captured this session (only the cohort-wide regional aggregate — Asia 32.61% — was verified). |
| 22 | Ireland | IRL | Ireland | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 23 | Israel | ISR | Israel | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 24 | Italy | ITA | Italy | high | 207965 + SENTRY | Listed among SOAR 207965's 10 countries (no per-country count captured there); directly confirmed in SENTRY's top 5 with 2,298 rows. |
| 25 | Japan | JPN | Japan | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 26 | Kenya | KEN | Kenya | high | 201910 | 44 rows. One of the 5 African countries in this cohort that Justice's original text omitted when it described the non-Latin-American countries as "Europe, Middle East, Asia" (see Appendix 1, Correction 1). |
| 27 | Korea | KOR | Korea, Republic of (South Korea) | flagged | SENTRY* | "Korea" alone is inherently ambiguous between the Republic of Korea (KOR) and the Democratic People's Republic of Korea (PRK). Resolved here as an explicit, stated assumption — in a GSK/Vivli AMR surveillance context this is virtually certainly South Korea — not a silently resolved ambiguity. Revisit if any source ever turns out to include DPRK data under this string. Row count not captured this session. |
| 28 | Kuwait | KWT | Kuwait | high | 201910 + 207965 | Listed in both cohorts' country lists; no per-country count captured for either. |
| 29 | Lebanon | LBN | Lebanon | high | 201910 | 21 rows. |
| 30 | Mexico | MEX | Mexico | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 31 | Morocco | MAR | Morocco | high | 201910 | 23 rows. One of the 5 African countries in this cohort that Justice's original text omitted (see Appendix 1, Correction 1). |
| 32 | New Zealand | NZL | New Zealand | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 33 | Nigeria | NGA | Nigeria | high | 201910 | Only 4 rows — thinnest country group in SOAR 201910 alongside Ghana's 2 (#17). Same small-base caveat applies. |
| 34 | Pakistan | PAK | Pakistan | high | 201910 + 207965 | Listed in both cohorts' country lists; no per-country count captured for either. |
| 35 | Panama | PAN | Panama | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 36 | Philippines | PHL | Philippines | high | 201910 | Listed; row count not captured this session. |
| 37 | Portugal | PRT | Portugal | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 38 | Romania | ROU | Romania | high | 201818 | 372 rows. ROU is the current ISO3 code (the older ROM code is deprecated); no ambiguity for this dataset. |
| 39 | Russia | RUS | Russian Federation | high | 201818 | 558 rows — largest single country in that cohort. |
| 40 | Saudi Arabia | SAU | Saudi Arabia | high | 201910 | Listed; row count not captured this session. |
| 41 | Scotland | GBR | United Kingdom (Scotland is a constituent country of the UK, not a sovereign ISO 3166-1 entity — see §3, Collision 2) | flagged | SENTRY* | Deliberately collides with the separate "UK" raw string (#55) on the same GBR code — see §3. Row count not captured this session. |
| 42 | Serbia | SRB | Serbia | high | 201818 | 117 rows. |
| 43 | Singapore | SGP | Singapore | high | 201910 | Listed; row count not captured this session. |
| 44 | Slovak Republic | SVK | Slovakia | high | 201818 | 193 rows. Deliberately collides with the separate "Slovakia" raw string (#45) on the same SVK code — see §3, Collision 1. |
| 45 | Slovakia | SVK | Slovakia | high | SENTRY* | Elimination-derived (§1). See §3, Collision 1. Row count not captured this session. |
| 46 | Slovenia | SVN | Slovenia | high | SENTRY* | Elimination-derived (§1). Do not confuse with Slovakia/Slovak Republic (#44/#45) — a different country with a similar name and a different code (SVN, not SVK). Row count not captured this session. |
| 47 | South Africa | ZAF | South Africa | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 48 | Spain | ESP | Spain | high | 207965 + SENTRY | Listed among SOAR 207965's 10 countries; directly confirmed in SENTRY's top 5 with 1,253 rows. |
| 49 | Sweden | SWE | Sweden | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 50 | Switzerland | CHE | Switzerland | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 51 | Taiwan | TWN | Taiwan (formal ISO 3166-1 long-form listing is "Taiwan, Province of China") | flagged | SENTRY* | Not a UN member state. TWN is nonetheless the standard, stable code used routinely in surveillance data; recorded as a data-harmonization fact, not a political position. Row count not captured this session. |
| 52 | Thailand | THA | Thailand | high | SENTRY* | Elimination-derived (§1). Row count not captured this session. |
| 53 | Tunisia | TUN | Tunisia | high | 201910 + 207965 | 153 rows in SOAR 201910; also listed in SOAR 207965 (no per-country count captured there). One of the 5 African countries in SOAR 201910 that Justice's original text omitted (see Appendix 1, Correction 1). |
| 54 | Turkey | TUR | Türkiye (UN/ISO short-name update, 2022; alpha-3 code unchanged at TUR) | high | 201910 + 207965 | Listed in both cohorts (no per-country count captured for either). Transcontinental (Europe/Asia); treated here as a single country — any region-classification question is out of scope for this crosswalk. |
| 55 | UK | GBR | United Kingdom | high | SENTRY* | Deliberately collides with the separate "Scotland" raw string (#41) on the same GBR code — see §3, Collision 2. Row count not captured this session. |
| 56 | Ukraine | UKR | Ukraine | high | 201818 + 201910 + 207965 | 196 rows in SOAR 201818 (2014-2016 window); also listed in SOAR 201910 (2015-2018 window) and SOAR 207965 (2018-2021 window). The **only** raw string in this crosswalk confirmed present in all three SOAR cohorts — see §5 forward note for Step 10. |
| 57 | United Arab Emirates | ARE | United Arab Emirates | high | 207965 | Listed; row count not captured this session. |
| 58 | USA | USA | United States of America | high | SENTRY | 7,257 rows — largest single country across all 4 files, confirmed directly in SENTRY's top 5. |
| 59 | Vietnam | VNM | Viet Nam (ISO's official short name is two words; "Vietnam" one word is the common raw-data spelling) | high | 201910 + 207965 | Listed in both cohorts (no per-country count captured for either). This is the cohort-overlap pair Justice's own Step 10 text names explicitly ("one year of cohort overlap, Vietnam, 2018") — see §5 forward note. |

---

## 3. Known Collisions Requiring Explicit Resolution

A "collision" here means two different raw strings resolving to the same ISO3 code.
Both instances below are **legitimate** collisions (same underlying country, two
different name renderings) — not harmonization bugs — but each still requires an
explicit team decision about how the pipeline should treat the duplication, which is
recorded below rather than left implicit.

### Collision 1 — ("Slovak Republic", "Slovakia") both to SVK

- **Raw strings:** "Slovak Republic" (SOAR 201818, 193 rows) and "Slovakia" (SENTRY,
  elimination-derived, count not captured).
- **Why it happens:** "Slovak Republic" is the country's official long-form name;
  "Slovakia" is its official short-form name. Both denote the same sovereign state.
  This is exactly the ambiguity Justice's Step 1 text anticipated ("Slovak Republic"
  vs "Slovakia" is the worked example in his own issue statement).
- **Resolution:** map both to `SVK`. No sub-code or distinguishing tag is needed —
  these are not two different entities, just two spellings of one.
- **Action item for implementers:** confirm any downstream country-count summary
  (e.g., "SOAR 201818 has 9 European countries") is computed on ISO3 codes, not raw
  strings, so that a future file using "Slovakia" instead of "Slovak Republic" does
  not silently get counted as a 10th, different country.

### Collision 2 — ("UK", "Scotland") both to GBR

- **Raw strings:** "UK" and "Scotland" (both SENTRY, elimination-derived, counts not
  captured).
- **Why it happens:** "UK" denotes the sovereign state (United Kingdom of Great
  Britain and Northern Ireland). "Scotland" denotes one of the UK's four constituent
  countries — it is **not** a sovereign entity and has no ISO 3166-1 alpha-3 code of
  its own (a Scotland-specific code would require the subdivision standard, ISO
  3166-2:GB-SCT, which is a different, finer-grained code space than this crosswalk
  covers).
- **Open decision, not resolved in this appendix** (this is a Step 10 master-schema
  design question, flagged here because it originates at the country-crosswalk
  layer): does the pipeline need to preserve Scotland-level granularity for records
  that arrive tagged "Scotland," or is collapsing straight to `GBR` sufficient?
  - Option (a) — collapse only: `Scotland` → `GBR`, indistinguishable from any other
    UK record. Simplest; matches Step 1's literal ISO3-only scope; loses information.
  - Option (b) — collapse to `GBR` for the ISO3 field, but also carry a passthrough
    field (e.g. `raw_country_original`) that preserves the verbatim raw string
    ("Scotland" vs "UK") into the Step 10 master table, at zero cost, so a
    Scotland-only query remains possible later without having thrown the information
    away irreversibly.
  - **Recommendation:** option (b), on the grounds that preserving the raw string
    costs nothing now and an irreversible loss is a real risk if this data is not
    revisited — but the actual master-schema field design is Step 10's job, not this
    appendix's; this is a pointer, not a resolution.
- **Action item for implementers:** the same "compute on ISO3, not raw string"
  discipline as Collision 1 applies here.

**No other collisions exist in this 59-row crosswalk** — every other ISO3 code in §2
appears exactly once. Sanity check: 59 raw strings, minus 2 many-to-one collapses
(2 strings → 1 code, twice), yields **57 distinct ISO3 codes** in this crosswalk.

---

## 4. Flagged Entries Requiring an Explicit Assumption (Non-Collision)

These three rows are flagged not because of a collision, but because the mapping
itself embeds an assumption or a non-sovereignty caveat a reviewer must see. Restated
together here for visibility (each also appears inline in §2):

| Raw string | Code | Flag reason |
|---|---|---|
| Korea (#27) | KOR | Raw string is ambiguous between Republic of Korea (KOR) and DPRK (PRK). Resolved as Republic of Korea by explicit, stated contextual assumption (GSK/Vivli AMR surveillance data), not silently. |
| Hong Kong (#19) | HKG | Not a sovereign UN member state — Special Administrative Region of China. Standard, stable surveillance-data code; noted as a harmonization fact, not a political statement. |
| Taiwan (#51) | TWN | Not a sovereign UN member state — ISO's own formal listing is "Taiwan, Province of China." Standard, stable surveillance-data code; noted as a harmonization fact, not a political statement. |

Scotland (#41) and UK (#55) are flagged/discussed in §3 (Collision 2) rather than
repeated here, since their issue is fundamentally the collision, not an independent
ambiguity in what the string refers to.

No row in this crosswalk fell below a 95% confidence threshold in a way that is *not*
already captured by one of the four flags above (Korea, Hong Kong, Taiwan, Scotland/
UK) — i.e., there is no fifth "quietly uncertain" row hiding in the `high` set.

---

## 5. Forward Note for Step 10 (Deduplication) — Not Resolved Here

Justice's Step 10 names one specific known overlap risk: "the one year of cohort
overlap (Vietnam, 2018)." This crosswalk's country attribution (§2, §1 arithmetic)
surfaces a broader pattern worth flagging forward, without attempting to resolve it
here (isolate-level deduplication is Step 10's job, not this appendix's):

- **Vietnam** (#59) is confirmed present in both SOAR 201910 and SOAR 207965's
  country lists — this is the exact pair Justice's Step 10 text names.
- **Ukraine** (#56) is confirmed present in **all three** SOAR cohorts (201818,
  201910, 207965), which is a country-list overlap Justice's own Step 10 text does not
  mention.

**Important caveat on what this does and does not establish:** country-name presence
across multiple cohorts is necessary but not sufficient evidence of an actual
duplicate-isolate risk. SOAR 201818 covers 2014-2016, SOAR 201910 covers 2015-2018,
and SOAR 207965 covers 2018-2021 (Appendix 1) — Ukraine's presence in all three
cohorts could reflect entirely disjoint collection years (e.g., 201818's Ukraine
isolates from 2014-2016 and 207965's from 2018-2021, with no true temporal overlap),
or it could reflect a second overlap year alongside Vietnam's 2018. **This appendix
does not have the per-country-per-year cross-tabulation needed to tell which** — that
cross-tabulation is not part of the verified facts available to this document and is
an explicit gap (see §7) that Step 10 must close before its own overlap check can be
considered complete. Flagging it here only so Step 10 does not treat "Vietnam, 2018"
as the sole case to check.

---

## 6. Status Summary / Sanity Checks

| Check (from §0) | Result |
|---|---|
| Every raw string maps to exactly one ISO3 code (no raw string ambiguous) | **Pass** — verified by inspection of all 59 rows in §2; no raw string appears twice with two different codes. |
| Multiple raw strings may legitimately map to the same code | **2 instances**, both legitimate: (Slovak Republic, Slovakia) → SVK; (UK, Scotland) → GBR. See §3. |
| No two genuinely different countries collapsed onto one code by mistake | **Pass** — the only two collisions (§3) are same-country renderings, not distinct-country errors. |
| Every row not ≥95% confident is flagged | **Pass** — 4 rows flagged (Korea, Hong Kong, Taiwan, Scotland; UK is discussed under the same collision), all with a stated reason (§4); no unflagged low-confidence row identified. |
| Distinct-ISO3-code count | 57 (59 raw strings − 2 many-to-one collapses). |
| Rows with cohort attribution not independently re-verified this session | 29 of 59 (`SENTRY*` — see §1). Flagged as a gap, not treated as equivalent in evidentiary strength to the 30 directly-confirmed rows. |

---

## 7. Versioning and Change Control

Per Justice's Step 1 action item ("build a single ISO 3166-1 alpha-3 crosswalk as its
own versioned artifact, not inline code"), this appendix is the *design specification*
and reviewed source of truth for a versioned crosswalk artifact (e.g.
`country_iso3_crosswalk_v1.csv`), not the machine-readable artifact itself. The
artifact should be generated from §2 of this document (never re-derived independently,
never hand-edited out of sync with this appendix) as a flat table with, at minimum:

| Field | Description |
|---|---|
| `raw_string` | Verbatim raw country string as it appears in the source file |
| `iso3` | ISO 3166-1 alpha-3 code |
| `canonical_name` | Canonical short name used in the master schema |
| `confidence` | `high` \| `medium` \| `flagged` |
| `source_cohort` | One or more of `SOAR_201818`, `SOAR_201910`, `SOAR_207965`, `SENTRY`; tag elimination-derived SENTRY attributions distinctly (e.g. `SENTRY_INFERRED`) rather than silently merging with directly-confirmed `SENTRY` rows |
| `note` | Free-text note, carried from §2/§3/§4 |
| `version`, `date_added` | Artifact version-control metadata |

Any future change (e.g., independently re-verifying one of the 29 `SENTRY*` rows
against the raw file, or resolving the Collision 2 sub-national-tag decision in Step
10) should be a new versioned revision of this artifact, not an in-place silent edit,
so any analysis built on an earlier version remains reproducible against the
crosswalk version it actually used.

---

## 8. Gaps Carried Forward From This Appendix

These are not filled in anywhere in this document — they are recorded so downstream
work knows exactly what remains open rather than assuming silence means resolved:

1. **29 of 59 raw strings' cohort attribution (`SENTRY*`) is elimination-derived, not
   independently re-verified** against the raw SENTRY country column this session
   (§1). Re-verify before relying on this for anything beyond the ISO3 mapping itself.
2. **Per-country row counts are missing** for: all 10 SOAR 207965 countries; 9 of
   SOAR 201910's 18 countries (Cambodia, Kuwait, Pakistan, Philippines, Saudi Arabia,
   Singapore, Turkey, Ukraine, Vietnam); all 39 of SENTRY's non-top-5 countries
   (carried forward from Appendix 1's gaps — this crosswalk resolves *names* to codes,
   it does not carry row-count weight information).
3. **No per-country-per-year cross-tabulation exists yet** for Ukraine or Vietnam
   across the three SOAR cohorts, so the true extent of temporal (not just
   country-name) overlap relevant to Step 10 is unknown beyond the single "Vietnam,
   2018" case Justice's own text already names (§5).
4. **The Collision 2 (UK/Scotland) sub-national-tag decision is unresolved** — this
   appendix recommends preserving a passthrough raw-string field (§3, option b) but
   does not decide the question; it belongs to Step 10's master-schema design.
5. **Confidence flags (Korea, Hong Kong, Taiwan) reflect a stated assumption or a
   non-sovereignty caveat, not a data-quality problem** — no amount of further data
   verification resolves them; they require a one-time team sign-off that the stated
   assumptions are acceptable for this project, recorded as a decision, not chased as
   an open research question.
