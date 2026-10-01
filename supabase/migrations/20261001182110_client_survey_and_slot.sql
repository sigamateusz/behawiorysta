-- Roles, consultations with the dog survey, availability blocks and client isolation (S-01).

-- profiles ------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null default 'client' check (role in ('client', 'behaviorist')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Roles are assigned only from Studio / SQL; the API can read its own row and nothing else.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (id = (select auth.uid()));

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, role) values (new.id, 'client');
  return new;
end;
$$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

insert into public.profiles (id, role)
select id, 'client' from auth.users
on conflict (id) do nothing;

-- consultations -------------------------------------------------------------

create table public.consultations (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null default auth.uid() references public.profiles on delete cascade,
  dog_name text not null check (char_length(dog_name) between 1 and 60),
  breed text not null check (char_length(breed) between 1 and 80),
  age_years smallint not null check (age_years between 0 and 25),
  age_months smallint not null check (age_months between 0 and 11),
  basic_info text not null check (char_length(basic_info) between 1 and 2000),
  goals text not null check (char_length(goals) between 20 and 2000),
  slot_start timestamptz not null,
  status text not null default 'pending' check (status in ('pending', 'accepted', 'rejected')),
  created_at timestamptz not null default now(),
  check (age_years * 12 + age_months >= 1)
);

create index consultations_client_id_idx on public.consultations (client_id);

create unique index consultations_active_slot_uidx on public.consultations (slot_start)
  where status in ('pending', 'accepted');

alter table public.consultations enable row level security;

revoke all on public.consultations from anon, authenticated;
grant select, insert on public.consultations to authenticated;

create policy "consultations_select_own" on public.consultations
  for select to authenticated
  using (client_id = (select auth.uid()));

create policy "consultations_insert_own_pending" on public.consultations
  for insert to authenticated
  with check (
    client_id = (select auth.uid())
    and status = 'pending'
    and exists (
      select 1 from public.profiles p
      where p.id = (select auth.uid()) and p.role = 'client'
    )
  );

-- availability_blocks -------------------------------------------------------

-- A whole-day block is the range 00:00–24:00 Europe/Warsaw. Writes go through Studio (service role) until S-03.
create table public.availability_blocks (
  id uuid primary key default gen_random_uuid(),
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at)
);

create index availability_blocks_range_idx on public.availability_blocks (starts_at, ends_at);

alter table public.availability_blocks enable row level security;

revoke all on public.availability_blocks from anon, authenticated;
grant select on public.availability_blocks to authenticated;

create policy "availability_blocks_select_authenticated" on public.availability_blocks
  for select to authenticated
  using (true);

-- taken_slot_starts ---------------------------------------------------------

-- Exposes only start times of active consultations, because RLS hides other clients' rows.
create function public.taken_slot_starts(p_from timestamptz, p_to timestamptz)
returns setof timestamptz
language sql
stable
security definer
set search_path = ''
as $$
  select c.slot_start
  from public.consultations c
  where c.status in ('pending', 'accepted')
    and c.slot_start >= p_from
    and c.slot_start < p_to
  order by c.slot_start;
$$;

revoke execute on function public.taken_slot_starts(timestamptz, timestamptz) from public, anon;
grant execute on function public.taken_slot_starts(timestamptz, timestamptz) to authenticated;
