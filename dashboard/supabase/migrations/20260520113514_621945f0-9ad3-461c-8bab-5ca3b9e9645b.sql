
-- Roles enum + table
create type public.app_role as enum ('admin', 'researcher', 'viewer');

create table public.user_roles (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  role app_role not null default 'researcher',
  created_at timestamptz not null default now(),
  unique(user_id, role)
);
alter table public.user_roles enable row level security;

create or replace function public.has_role(_user_id uuid, _role app_role)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.user_roles where user_id = _user_id and role = _role)
$$;

create policy "Users view own roles" on public.user_roles for select to authenticated
  using (auth.uid() = user_id or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage roles" on public.user_roles for all to authenticated
  using (public.has_role(auth.uid(), 'admin')) with check (public.has_role(auth.uid(), 'admin'));

-- Profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  institution text,
  country text,
  title text,
  avatar_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.profiles enable row level security;

create policy "Profiles viewable by authenticated" on public.profiles for select to authenticated using (true);
create policy "Users update own profile" on public.profiles for update to authenticated using (auth.uid() = id);
create policy "Users insert own profile" on public.profiles for insert to authenticated with check (auth.uid() = id);

-- Auto-create profile + default role on signup
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, full_name, institution)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'institution'
  );
  insert into public.user_roles (user_id, role) values (new.id, 'researcher');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users for each row execute function public.handle_new_user();

-- Updated_at trigger fn
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end;
$$;

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- Sentinel sites
create type public.site_status as enum ('active', 'paused', 'planned');

create table public.sentinel_sites (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  country text not null,
  city text,
  latitude numeric,
  longitude numeric,
  population_served integer,
  status site_status not null default 'active',
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.sentinel_sites enable row level security;
create policy "Sites viewable by authenticated" on public.sentinel_sites for select to authenticated using (true);
create policy "Researchers create sites" on public.sentinel_sites for insert to authenticated
  with check (public.has_role(auth.uid(), 'researcher') or public.has_role(auth.uid(), 'admin'));
create policy "Owners or admins update sites" on public.sentinel_sites for update to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admins delete sites" on public.sentinel_sites for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create trigger sentinel_sites_updated_at before update on public.sentinel_sites
  for each row execute function public.set_updated_at();

-- Samples
create table public.samples (
  id uuid primary key default gen_random_uuid(),
  site_id uuid references public.sentinel_sites(id) on delete cascade not null,
  collected_at timestamptz not null default now(),
  pathogen text not null,
  volume_ml numeric,
  ct_value numeric,
  viral_load numeric,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.samples enable row level security;
create policy "Samples viewable by authenticated" on public.samples for select to authenticated using (true);
create policy "Researchers create samples" on public.samples for insert to authenticated
  with check (public.has_role(auth.uid(), 'researcher') or public.has_role(auth.uid(), 'admin'));
create policy "Owners update samples" on public.samples for update to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admins delete samples" on public.samples for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Sequences
create table public.sequences (
  id uuid primary key default gen_random_uuid(),
  sample_id uuid references public.samples(id) on delete cascade,
  pathogen text not null,
  lineage text,
  accession text,
  length_bp integer,
  quality_score numeric,
  sequenced_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now()
);
alter table public.sequences enable row level security;
create policy "Sequences viewable by authenticated" on public.sequences for select to authenticated using (true);
create policy "Researchers create sequences" on public.sequences for insert to authenticated
  with check (public.has_role(auth.uid(), 'researcher') or public.has_role(auth.uid(), 'admin'));
create policy "Owners update sequences" on public.sequences for update to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admins delete sequences" on public.sequences for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Variants
create type public.variant_impact as enum ('low', 'moderate', 'high', 'critical');

create table public.variants (
  id uuid primary key default gen_random_uuid(),
  sequence_id uuid references public.sequences(id) on delete cascade,
  gene text not null,
  position integer not null,
  ref_aa text,
  alt_aa text,
  mutation text not null,
  impact variant_impact not null default 'moderate',
  notes text,
  created_at timestamptz not null default now()
);
alter table public.variants enable row level security;
create policy "Variants viewable by authenticated" on public.variants for select to authenticated using (true);
create policy "Researchers create variants" on public.variants for insert to authenticated
  with check (public.has_role(auth.uid(), 'researcher') or public.has_role(auth.uid(), 'admin'));
create policy "Admins manage variants" on public.variants for update to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create policy "Admins delete variants" on public.variants for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Alerts
create type public.alert_severity as enum ('low', 'moderate', 'high', 'very_high', 'extreme');
create type public.alert_status as enum ('active', 'investigating', 'resolved');

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  country text not null,
  pathogen text not null,
  severity alert_severity not null default 'moderate',
  status alert_status not null default 'active',
  title text not null,
  description text,
  detected_at timestamptz not null default now(),
  resolved_at timestamptz,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.alerts enable row level security;
create policy "Alerts viewable by authenticated" on public.alerts for select to authenticated using (true);
create policy "Researchers create alerts" on public.alerts for insert to authenticated
  with check (public.has_role(auth.uid(), 'researcher') or public.has_role(auth.uid(), 'admin'));
create policy "Owners update alerts" on public.alerts for update to authenticated
  using (created_by = auth.uid() or public.has_role(auth.uid(), 'admin'));
create policy "Admins delete alerts" on public.alerts for delete to authenticated
  using (public.has_role(auth.uid(), 'admin'));
create trigger alerts_updated_at before update on public.alerts
  for each row execute function public.set_updated_at();
