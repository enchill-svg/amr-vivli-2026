-- AMR Life Expectancy Intelligence Platform core analytical schema
-- AMR-specific tables and live dashboard views for the competition platform.

create extension if not exists "pgcrypto";

create table if not exists public.amr_upload_batches (
  id uuid primary key default gen_random_uuid(),
  filename text not null,
  source_type text not null default 'uploaded',
  uploaded_by uuid null,
  status text not null default 'received' check (status in ('received','profiling','harmonizing','validated','published','failed')),
  row_count bigint null,
  data_quality_score numeric null,
  validation_summary jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.amr_master_isolate_drug (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid null references public.amr_upload_batches(id) on delete set null,
  isolate_id text not null,
  source_cohort text null,
  iso3 text not null,
  country text null,
  year int not null check (year between 1900 and 2100),
  pathogen_type text not null check (pathogen_type in ('bacterial','fungal')),
  organism_canon text not null,
  drug_canon text not null,
  drug_class text null,
  mic_raw text null,
  mic_comparator text null,
  mic_value numeric null,
  mic_log2 numeric null,
  resistance_category text null,
  classification_basis text null,
  age_band text null,
  gender text null,
  specimen_source text null,
  laboratory text null,
  surveillance_program text null,
  beta_lactamase text null,
  data_quality_score numeric null,
  created_at timestamptz not null default now()
);

create table if not exists public.amr_country_year_external (
  id uuid primary key default gen_random_uuid(),
  iso3 text not null,
  country text null,
  year int not null check (year between 1900 and 2100),
  life_exp numeric null,
  hale numeric null,
  hib3 numeric null,
  pcv3 numeric null,
  health_exp numeric null,
  beds_per_1000 numeric null,
  vaccination_index numeric null,
  health_capacity_index numeric null,
  bacterial_relevant_funding_usd numeric null,
  fungal_relevant_funding_usd numeric null,
  created_at timestamptz not null default now(),
  unique (iso3, year)
);

create table if not exists public.amr_model_outputs (
  id uuid primary key default gen_random_uuid(),
  model_name text not null,
  model_version text not null,
  scope text not null,
  iso3 text null,
  organism_canon text null,
  drug_canon text null,
  year int null,
  output jsonb not null,
  confidence numeric null,
  created_at timestamptz not null default now()
);

create table if not exists public.amr_policy_recommendations (
  id uuid primary key default gen_random_uuid(),
  iso3 text not null,
  country text null,
  pathogen_type text not null check (pathogen_type in ('bacterial','fungal')),
  organism_canon text null,
  drug_canon text null,
  recommendation text not null,
  evidence_level text not null default 'limited' check (evidence_level in ('high','moderate','limited')),
  predicted_life_gain numeric null,
  predicted_resistance_reduction numeric null,
  confidence numeric null,
  assumptions jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_amr_master_country_year on public.amr_master_isolate_drug (iso3, year);
create index if not exists idx_amr_master_org_drug on public.amr_master_isolate_drug (organism_canon, drug_canon);
create index if not exists idx_amr_master_pathogen on public.amr_master_isolate_drug (pathogen_type);
create index if not exists idx_amr_external_country_year on public.amr_country_year_external (iso3, year);

-- Country-level live trend view. Replace formulas with model table outputs when production models are scheduled.
create or replace view public.v_live_country_trends as
with classified as (
  select
    m.iso3,
    coalesce(max(m.country), m.iso3) as country,
    m.pathogen_type,
    max(m.year) as latest_year,
    count(distinct m.isolate_id) as isolates,
    avg(case when lower(m.resistance_category) in ('r','resistant','non-susceptible') then 1.0 when m.resistance_category is not null then 0.0 end) as resistance_rate,
    percentile_cont(0.5) within group (order by m.mic_log2) as median_mic_log2
  from public.amr_master_isolate_drug m
  group by m.iso3, m.pathogen_type
), dominant as (
  select distinct on (iso3, pathogen_type)
    iso3, pathogen_type, organism_canon as dominant_organism, drug_canon as dominant_drug, count(*) as n
  from public.amr_master_isolate_drug
  group by iso3, pathogen_type, organism_canon, drug_canon
  order by iso3, pathogen_type, count(*) desc
), ext as (
  select distinct on (iso3)
    iso3, life_exp, health_capacity_index,
    coalesce(bacterial_relevant_funding_usd,0) as bacterial_funding,
    coalesce(fungal_relevant_funding_usd,0) as fungal_funding
  from public.amr_country_year_external
  order by iso3, year desc
), rec as (
  select distinct on (iso3, pathogen_type)
    iso3, pathogen_type, recommendation as recommended_intervention, evidence_level, predicted_life_gain, confidence
  from public.amr_policy_recommendations
  order by iso3, pathogen_type, created_at desc
)
select
  c.iso3,
  c.country,
  null::numeric as latitude,
  null::numeric as longitude,
  c.pathogen_type,
  c.latest_year,
  least(100, greatest(0, round(coalesce(c.resistance_rate, 0.2) * 100 + case when coalesce(e.health_capacity_index,0.5) < 0.45 then 15 else 0 end, 2))) as risk_score,
  least(100, greatest(0, round(coalesce(c.resistance_rate, 0.2) * 100 + coalesce(c.median_mic_log2,0) * 2 + 10, 2))) as early_warning_score,
  coalesce(c.resistance_rate, 0) as resistance_rate,
  0::numeric as trend_slope,
  case when coalesce(c.resistance_rate,0) >= 0.5 then 'surging' when coalesce(c.resistance_rate,0) >= 0.3 then 'rising' else 'stable' end as trend_label,
  e.life_exp,
  0::numeric as life_expectancy_delta,
  d.dominant_organism,
  d.dominant_drug,
  case when c.pathogen_type = 'bacterial' then 1 - least(1, e.bacterial_funding / 1000000000.0) else 1 - least(1, e.fungal_funding / 250000000.0) end as funding_mismatch,
  c.isolates,
  least(1, greatest(0.2, log(greatest(c.isolates, 2)) / 8.5)) as data_quality,
  coalesce(rec.confidence, least(0.95, greatest(0.5, log(greatest(c.isolates, 2)) / 10))) as confidence,
  coalesce(rec.evidence_level, 'limited') as evidence_level,
  coalesce(rec.predicted_life_gain, 0.15) as predicted_life_gain,
  coalesce(rec.recommended_intervention, case when c.pathogen_type='fungal' then 'Antifungal stewardship + diagnostics + IPC' else 'Antibiotic stewardship + diagnostics + vaccination where relevant' end) as recommended_intervention
from classified c
left join dominant d using (iso3, pathogen_type)
left join ext e using (iso3)
left join rec using (iso3, pathogen_type);

create or replace view public.v_live_pathogen_signals as
with by_signal as (
  select
    iso3,
    coalesce(max(country), iso3) as country,
    pathogen_type,
    organism_canon as organism,
    drug_canon as drug,
    count(distinct isolate_id) as isolates,
    avg(case when lower(resistance_category) in ('r','resistant','non-susceptible') then 1.0 when resistance_category is not null then 0.0 end) as resistance_rate,
    percentile_cont(0.5) within group (order by mic_log2) as median_mic_log2
  from public.amr_master_isolate_drug
  group by iso3, pathogen_type, organism_canon, drug_canon
)
select
  md5(iso3 || organism || drug)::uuid as id,
  organism,
  drug,
  pathogen_type,
  country,
  iso3,
  coalesce(resistance_rate,0) as resistance_rate,
  coalesce(median_mic_log2,0) as mic_shift,
  least(100, greatest(0, round(coalesce(resistance_rate,0.1) * 100 + coalesce(median_mic_log2,0) * 3 + log(greatest(isolates,2)) * 4, 2))) as evolutionary_fitness,
  greatest(0, 1 - coalesce(resistance_rate,0.05)) as distance_to_failure,
  least(0.95, greatest(0.45, log(greatest(isolates,2)) / 10)) as confidence,
  case when coalesce(resistance_rate,0) >= 0.5 then 'Immediate intervention and breakpoint review recommended.' when coalesce(resistance_rate,0) >= 0.3 then 'Increase diagnostics and stewardship monitoring.' else 'Maintain sentinel surveillance and data quality checks.' end as recommendation
from by_signal;

alter table public.amr_upload_batches enable row level security;
alter table public.amr_master_isolate_drug enable row level security;
alter table public.amr_country_year_external enable row level security;
alter table public.amr_model_outputs enable row level security;
alter table public.amr_policy_recommendations enable row level security;

drop policy if exists "Read AMR upload batches" on public.amr_upload_batches;
drop policy if exists "Read AMR master" on public.amr_master_isolate_drug;
drop policy if exists "Read AMR external" on public.amr_country_year_external;
drop policy if exists "Read AMR model outputs" on public.amr_model_outputs;
drop policy if exists "Read AMR recommendations" on public.amr_policy_recommendations;

create policy "Read AMR upload batches" on public.amr_upload_batches for select using (true);
create policy "Read AMR master" on public.amr_master_isolate_drug for select using (true);
create policy "Read AMR external" on public.amr_country_year_external for select using (true);
create policy "Read AMR model outputs" on public.amr_model_outputs for select using (true);
create policy "Read AMR recommendations" on public.amr_policy_recommendations for select using (true);
