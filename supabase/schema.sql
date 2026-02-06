-- Supabase schema for Mamute MAA (revamp)
create extension if not exists "pgcrypto";

create table if not exists gym_settings (
  id int primary key check (id = 1),
  timezone text not null default 'America/Toronto',
  latitude numeric not null,
  longitude numeric not null,
  checkin_radius_m int not null default 100,
  barcode_prefix text not null default 'MMAA-',
  created_at timestamptz default now()
);

-- Core roles (admins are auth users; students/instructors are domain records)
create table if not exists admins (
  user_id uuid primary key references auth.users on delete cascade,
  full_name text not null,
  email text not null,
  created_at timestamptz default now()
);

create table if not exists parents (
  user_id uuid primary key references auth.users on delete cascade,
  first_name text,
  last_name text,
  email text not null,
  created_at timestamptz default now()
);

-- Students
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_number int unique not null,
  first_name text,
  last_name text,
  age int,
  email text,
  barcode_value text generated always as ('MMAA-' || student_number::text) stored unique,
  membership_type text not null check (
    membership_type in (
      'adults-unlimited',
      'kids-unlimited',
      'striking-only',
      'grappling-only',
      'adults-limited-once-weekly',
      'kids-limited-once-weekly'
    )
  ),
  membership_standing text not null check (
    membership_standing in ('active','inactive','overdue')
  ),
  guardian_first_name text,
  guardian_last_name text,
  guardian_email text,
  created_by uuid references admins(user_id),
  created_at timestamptz default now()
);

create table if not exists student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  guardian_first_name text,
  guardian_last_name text,
  guardian_email text not null,
  created_at timestamptz default now(),
  unique (student_id, guardian_email)
);

-- Link auth users (students/parents) to student records
create table if not exists student_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users on delete cascade,
  student_id uuid references students(id) on delete cascade,
  role text not null check (role in ('student','parent')),
  created_at timestamptz default now(),
  unique (user_id, student_id)
);

-- Instructors
create table if not exists instructors (
  id uuid primary key default gen_random_uuid(),
  first_name text,
  last_name text,
  email text not null,
  created_at timestamptz default now()
);

create table if not exists instructor_qualifications (
  instructor_id uuid references instructors(id) on delete cascade,
  class_type text not null,
  primary key (instructor_id, class_type)
);

-- Recurring class schedules
create table if not exists class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_type text not null check (
    class_type in (
      'bjj-gi',
      'bjj-nogi',
      'kids-bjj-gi',
      'kids-bjj-nogi',
      'kids-wrestling',
      'kids-strength-conditioning',
      'kids-muay-thai',
      'muay-thai',
      'boxing',
      'mma'
    )
  ),
  instructor_id uuid references instructors(id),
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Toronto',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

-- Attendance records
create table if not exists attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  schedule_id uuid references class_schedules(id) on delete set null,
  session_start_at timestamptz,
  session_end_at timestamptz,
  scanned_at timestamptz not null default now(),
  device_id text,
  source text not null check (source in ('frontdesk','mobile')),
  location_verified boolean not null default false
);

-- RLS
alter table admins enable row level security;
alter table parents enable row level security;
alter table students enable row level security;
alter table student_access enable row level security;
alter table instructors enable row level security;
alter table instructor_qualifications enable row level security;
alter table class_schedules enable row level security;
alter table attendance enable row level security;
alter table gym_settings enable row level security;
alter table student_guardians enable row level security;

-- Admins: self read only (writes via service role)
create policy "admins self read" on admins
  for select using (auth.uid() = user_id);

create policy "admins full access students" on students
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "admins full access instructors" on instructors
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "admins full access qualifications" on instructor_qualifications
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "admins full access schedules" on class_schedules
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "admins full access attendance" on attendance
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "admins full access guardians" on student_guardians
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "admins full access gym settings" on gym_settings
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

-- Student/parent access: read-only to linked student data
create policy "student access read" on student_access
  for select using (auth.uid() = user_id);

create policy "student self read" on students
  for select using (
    exists (
      select 1 from student_access sa
      where sa.user_id = auth.uid() and sa.student_id = students.id
    )
  );

create policy "student attendance read" on attendance
  for select using (
    exists (
      select 1 from student_access sa
      where sa.user_id = auth.uid() and sa.student_id = attendance.student_id
    )
  );

create policy "student schedule read" on class_schedules
  for select using (true);

insert into gym_settings (id, latitude, longitude)
values (1, 43.92171016104063, -78.87364279024405)
on conflict (id) do nothing;
