-- Accountax – database setup. Paste this whole file into Supabase > SQL Editor > Run.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  email text,
  role text not null default 'manager' check (role in ('admin','manager')),
  created_at timestamptz not null default now()
);

create table if not exists public.offices (
  id bigint generated always as identity primary key,
  name text not null unique
);

create table if not exists public.shifts (
  id bigint generated always as identity primary key,
  name text not null unique
);

-- The entry sheet: the single source of truth for every summary and closing.
create table if not exists public.entries (
  id bigint generated always as identity primary key,
  entry_date date not null,
  entry_type text not null default 'main' check (entry_type in ('main','service')),
  account_name text not null,
  customer_name text,
  amount numeric(12,2) not null,
  status text not null,
  office text,
  shift text,
  manager_id uuid references public.profiles(id) on delete set null,
  manager_name text,
  grp text,
  remarks text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists entries_type_date_idx on public.entries (entry_type, entry_date desc);
create index if not exists entries_status_idx on public.entries (status);
create index if not exists entries_office_idx on public.entries (office);

create or replace function public.touch_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
drop trigger if exists entries_touch on public.entries;
create trigger entries_touch before update on public.entries
  for each row execute function public.touch_updated_at();

-- New auth users automatically get a manager profile.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email,'@',1)));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin');
$$;

-- Row level security
alter table public.profiles enable row level security;
alter table public.offices  enable row level security;
alter table public.shifts   enable row level security;
alter table public.entries  enable row level security;

create policy "profiles read"   on public.profiles for select to authenticated using (true);
create policy "profiles admin"  on public.profiles for update to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "offices read"    on public.offices for select to authenticated using (true);
create policy "offices admin"   on public.offices for all to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "shifts read"     on public.shifts for select to authenticated using (true);
create policy "shifts admin"    on public.shifts for all to authenticated using (public.is_admin()) with check (public.is_admin());

create policy "entries read"    on public.entries for select to authenticated using (true);
create policy "entries insert"  on public.entries for insert to authenticated
  with check (public.is_admin() or manager_id = auth.uid());
create policy "entries update"  on public.entries for update to authenticated
  using (public.is_admin() or manager_id = auth.uid())
  with check (public.is_admin() or manager_id = auth.uid());
create policy "entries delete"  on public.entries for delete to authenticated
  using (public.is_admin() or manager_id = auth.uid());

-- Starter dropdown values (edit later from the Table Editor)
insert into public.shifts (name) values ('Morning'), ('Evening'), ('Night') on conflict do nothing;
insert into public.offices (name) values ('Vortex'), ('Lessonplay'), ('Highrollers'), ('Casinoze'), ('Techbytes') on conflict do nothing;
