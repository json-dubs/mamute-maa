-- Supabase schema for Mamute MAA
create table if not exists profiles (
  id uuid primary key references auth.users on delete cascade,
  role text not null check (role in ('student','parent','instructor','admin','front-desk')),
  full_name text not null,
  email text not null,
  phone text,
  guardian_for uuid references profiles(id),
  created_at timestamptz default now()
);

create table if not exists memberships (
  profile_id uuid primary key references profiles(id) on delete cascade,
  status text not null default 'good' check (status in ('good','delinquent','suspended')),
  tier text,
  renewal_date date,
  updated_at timestamptz default now()
);

create table if not exists classes (
  id uuid primary key default gen_random_uuid(),
  discipline text not null,
  title text not null,
  instructor_id uuid references profiles(id),
  start_at timestamptz not null,
  end_at timestamptz not null,
  capacity int,
  status text not null default 'scheduled' check (status in ('scheduled','cancelled','completed')),
  created_at timestamptz default now()
);

create table if not exists enrollments (
  profile_id uuid references profiles(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  role text not null check (role in ('student','guardian')),
  attendance_count int default 0,
  primary key (profile_id, class_id)
);

create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid references profiles(id) on delete cascade,
  class_id uuid references classes(id) on delete cascade,
  scanned_at timestamptz not null default now(),
  device_id text,
  source text not null default 'web' check (source in ('web','mobile'))
);

create table if not exists payment_status (
  profile_id uuid primary key references profiles(id) on delete cascade,
  provider_ref text,
  amount_due numeric,
  due_date date,
  last_payment_at timestamptz,
  status text not null default 'current' check (status in ('current','due','overdue'))
);

create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('reminder','cancel','dues','general')),
  target jsonb not null,
  payload jsonb not null,
  scheduled_at timestamptz,
  sent_at timestamptz
);

create table if not exists push_tokens (
  profile_id uuid references profiles(id) on delete cascade,
  expo_token text,
  platform text not null check (platform in ('ios','android','web')),
  updated_at timestamptz default now(),
  primary key (profile_id, platform)
);

-- RLS
alter table profiles enable row level security;
alter table memberships enable row level security;
alter table classes enable row level security;
alter table enrollments enable row level security;
alter table attendance enable row level security;
alter table payment_status enable row level security;
alter table notifications enable row level security;
alter table push_tokens enable row level security;

-- Simple RLS examples
create policy "profiles self access" on profiles
  for select using (auth.uid() = id or role in ('admin','front-desk','instructor'));

create policy "memberships self access" on memberships
  for select using (auth.uid() = profile_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','front-desk','instructor')));

create policy "classes readable" on classes
  for select using (true);

create policy "classes instructor write" on classes
  for insert with check (auth.uid() = instructor_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin')));

create policy "enrollments self" on enrollments
  for select using (auth.uid() = profile_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','front-desk','instructor')));

create policy "attendance self" on attendance
  for select using (auth.uid() = profile_id or exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','front-desk','instructor')));

create policy "attendance insert admin/frontdesk" on attendance
  for insert with check (exists (select 1 from profiles p where p.id = auth.uid() and p.role in ('admin','front-desk','instructor')));

create policy "push tokens self" on push_tokens
  for all using (auth.uid() = profile_id);
