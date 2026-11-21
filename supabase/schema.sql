create table public.family_households (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(trim(name)) between 1 and 80),
  invite_code_hash text not null unique check (invite_code_hash ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create table public.family_chores (
  household_id uuid not null references public.family_households(id) on delete cascade,
  id uuid not null default gen_random_uuid(),
  chore_name text not null check (char_length(trim(chore_name)) between 1 and 160),
  date_added date not null default current_date,
  assigned_to text not null default 'Anyone' check (char_length(trim(assigned_to)) between 1 and 80),
  points integer not null default 0 check (points >= 0 and points <= 999999),
  completed boolean not null default false,
  completed_by text check (completed_by is null or char_length(trim(completed_by)) between 1 and 80),
  created_at timestamptz not null default now(),
  primary key (household_id, id)
);

create index family_chores_household_created_idx
  on public.family_chores (household_id, created_at desc);

alter table public.family_households enable row level security;
alter table public.family_chores enable row level security;

create policy "No direct client access to family households"
  on public.family_households for all to anon, authenticated
  using (false) with check (false);

create policy "No direct client access to family chores"
  on public.family_chores for all to anon, authenticated
  using (false) with check (false);

revoke all privileges on table public.family_households, public.family_chores from anon, authenticated;
grant all privileges on public.family_households, public.family_chores to service_role;
