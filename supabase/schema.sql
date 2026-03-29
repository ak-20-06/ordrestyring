create extension if not exists pgcrypto;

create table if not exists profiles (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  customer text,
  status text not null default 'igang',
  start_date date not null,
  end_date date,
  location text,
  address text,
  notes text,
  created_at timestamptz default now()
);

create table if not exists time_entries (
  id uuid primary key default gen_random_uuid(),
  profile_name text not null,
  entry_date date not null,
  start_time time,
  end_time time,
  green_hours numeric not null default 0,
  red_hours numeric not null default 0,
  note text,
  created_at timestamptz default now()
);

create table if not exists day_notes (
  id uuid primary key default gen_random_uuid(),
  entry_date date not null unique,
  note text,
  created_at timestamptz default now()
);

create table if not exists ks_files (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete cascade,
  file_name text not null,
  file_path text,
  created_at timestamptz default now()
);

insert into profiles (name)
values ('Asger'), ('Kasper')
on conflict (name) do nothing;

alter table profiles enable row level security;
alter table orders enable row level security;
alter table time_entries enable row level security;
alter table day_notes enable row level security;
alter table ks_files enable row level security;

drop policy if exists "profiles_all" on profiles;
drop policy if exists "orders_all" on orders;
drop policy if exists "time_entries_all" on time_entries;
drop policy if exists "day_notes_all" on day_notes;
drop policy if exists "ks_files_all" on ks_files;

create policy "profiles_all" on profiles for all using (true) with check (true);
create policy "orders_all" on orders for all using (true) with check (true);
create policy "time_entries_all" on time_entries for all using (true) with check (true);
create policy "day_notes_all" on day_notes for all using (true) with check (true);
create policy "ks_files_all" on ks_files for all using (true) with check (true);

alter table orders add column if not exists assigned_to text;
alter table orders add column if not exists memory_list text;
alter table orders add column if not exists task_list text;

NOTIFY pgrst, 'reload schema';

select column_name
from information_schema.columns
where table_name = 'orders'
order by ordinal_position;
