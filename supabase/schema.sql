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
  first_name text not null,
  last_name text not null,
  email text not null,
  created_at timestamptz default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'admins'
      and column_name = 'full_name'
  ) then
    alter table admins add column if not exists first_name text;
    alter table admins add column if not exists last_name text;
    update admins
    set
      first_name = coalesce(first_name, split_part(full_name, ' ', 1)),
      last_name = coalesce(
        nullif(last_name, ''),
        nullif(trim(substr(full_name, length(split_part(full_name, ' ', 1)) + 1)), ''),
        'User'
      )
    where full_name is not null and (first_name is null or last_name is null);
  end if;
end $$;

-- Students
create table if not exists students (
  id uuid primary key default gen_random_uuid(),
  student_number int unique not null,
  first_name text,
  last_name text,
  birth_date date,
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
  created_by uuid references admins(user_id),
  created_at timestamptz default now()
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'age'
  ) then
    alter table students add column if not exists birth_date date;

    update students
    set birth_date = (current_date - make_interval(years => age))::date
    where birth_date is null and age is not null;

    alter table students drop column if exists age;
  end if;
end $$;

create table if not exists student_guardians (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references students(id) on delete cascade,
  guardian_first_name text,
  guardian_last_name text,
  guardian_email text not null,
  created_at timestamptz default now(),
  unique (student_id, guardian_email)
);

do $$
begin
  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'students'
      and column_name = 'guardian_email'
  ) then
    execute $sql$
      insert into student_guardians (
        student_id,
        guardian_first_name,
        guardian_last_name,
        guardian_email
      )
      select
        id,
        nullif(trim(guardian_first_name), ''),
        nullif(trim(guardian_last_name), ''),
        lower(trim(guardian_email))
      from students
      where guardian_email is not null and trim(guardian_email) <> ''
      on conflict (student_id, guardian_email) do update
      set
        guardian_first_name = coalesce(excluded.guardian_first_name, student_guardians.guardian_first_name),
        guardian_last_name = coalesce(excluded.guardian_last_name, student_guardians.guardian_last_name)
    $sql$;

    alter table students drop column if exists guardian_first_name;
    alter table students drop column if exists guardian_last_name;
    alter table students drop column if exists guardian_email;
  end if;
end $$;

drop table if exists parents;

-- Link auth users (students/guardians) to student records
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

alter table instructors add column if not exists about text;
alter table instructors add column if not exists image_path text;
alter table instructors add column if not exists image_name text;
alter table instructors add column if not exists image_mime_type text;

create table if not exists instructor_qualifications (
  instructor_id uuid references instructors(id) on delete cascade,
  class_type text not null,
  primary key (instructor_id, class_type)
);

create table if not exists class_catalog (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  created_at timestamptz default now()
);

-- Recurring class schedules
create table if not exists class_schedules (
  id uuid primary key default gen_random_uuid(),
  class_type text not null,
  instructor_id uuid references instructors(id),
  day_of_week int not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  timezone text not null default 'America/Toronto',
  is_active boolean not null default true,
  created_at timestamptz default now()
);

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select c.conname
    from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    join pg_namespace n on n.oid = t.relnamespace
    where n.nspname = 'public'
      and t.relname = 'class_schedules'
      and c.contype = 'c'
      and pg_get_constraintdef(c.oid) ilike '%class_type%'
  loop
    execute format('alter table public.class_schedules drop constraint if exists %I', constraint_name);
  end loop;
end $$;

create table if not exists class_schedule_exceptions (
  id uuid primary key default gen_random_uuid(),
  schedule_id uuid not null references class_schedules(id) on delete cascade,
  occurrence_date date not null,
  created_by uuid references admins(user_id),
  created_at timestamptz default now(),
  unique (schedule_id, occurrence_date)
);

create index if not exists idx_class_schedule_exceptions_lookup
  on class_schedule_exceptions (schedule_id, occurrence_date);

insert into class_catalog (name)
values
  ('Bjj Gi'),
  ('Bjj Nogi'),
  ('Kids Bjj Gi'),
  ('Kids Bjj Nogi'),
  ('Kids Wrestling'),
  ('Kids Strength Conditioning'),
  ('Kids Muay Thai'),
  ('Muay Thai'),
  ('Boxing'),
  ('Mma')
on conflict (name) do nothing;

insert into class_catalog (name)
select distinct class_type
from class_schedules
where class_type is not null and trim(class_type) <> ''
on conflict (name) do nothing;

insert into class_catalog (name)
select distinct class_type
from instructor_qualifications
where class_type is not null and trim(class_type) <> ''
on conflict (name) do nothing;

-- News posts for admin announcements/events
create table if not exists mamute_news (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text not null,
  attachment_path text,
  attachment_name text,
  attachment_mime_type text,
  expires_at timestamptz,
  created_by uuid references admins(user_id),
  created_at timestamptz default now()
);

alter table mamute_news
  add column if not exists visibility text not null default 'public'
    check (visibility in ('public', 'private'));
alter table mamute_news
  add column if not exists student_id uuid references students(id) on delete cascade;
alter table mamute_news
  add column if not exists post_type text not null default 'general'
    check (post_type in ('general', 'birthday', 'badge', 'payment'));
update mamute_news set visibility = 'public' where visibility is null;

-- Shop merchandise catalog
create table if not exists shop_merchandise (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text not null,
  item_type text not null check (
    item_type in (
      'uniform',
      'shirt',
      'sweater',
      'jacket',
      'pants',
      'shorts',
      'accessory',
      'training'
    )
  ),
  sex text not null check (sex in ('male', 'female', 'unisex')),
  sizes text[] not null default '{}',
  image_path text,
  image_name text,
  image_mime_type text,
  is_active boolean not null default true,
  created_by uuid references admins(user_id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select tc.constraint_name
    from information_schema.table_constraints tc
    join information_schema.check_constraints cc
      on cc.constraint_name = tc.constraint_name
     and cc.constraint_schema = tc.constraint_schema
    where tc.table_schema = 'public'
      and tc.table_name = 'shop_merchandise'
      and tc.constraint_type = 'CHECK'
      and cc.check_clause ilike '%item_type%'
  loop
    execute format(
      'alter table public.shop_merchandise drop constraint if exists %I',
      constraint_name
    );
  end loop;

  alter table public.shop_merchandise
    add constraint shop_merchandise_item_type_check
    check (
      item_type in (
        'uniform',
        'shirt',
        'sweater',
        'jacket',
        'pants',
        'shorts',
        'accessory',
        'training'
      )
    );
end $$;

create index if not exists idx_shop_merchandise_filters
  on shop_merchandise (is_active, item_type, sex, created_at desc);

create or replace function touch_shop_merchandise_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists shop_merchandise_touch_updated_at on shop_merchandise;
create trigger shop_merchandise_touch_updated_at
before update on shop_merchandise
for each row execute function touch_shop_merchandise_updated_at();

create or replace function schedule_day_label(p_day int)
returns text
language sql
immutable
as $$
  select case p_day
    when 0 then 'Sunday'
    when 1 then 'Monday'
    when 2 then 'Tuesday'
    when 3 then 'Wednesday'
    when 4 then 'Thursday'
    when 5 then 'Friday'
    when 6 then 'Saturday'
    else 'Unknown day'
  end;
$$;

create or replace function schedule_class_label(p_class_type text)
returns text
language sql
immutable
returns null on null input
as $$
  select initcap(replace(p_class_type, '-', ' '));
$$;

create or replace function notify_class_schedule_change()
returns trigger
language plpgsql
as $$
declare
  actor_id uuid := auth.uid();
  expiry_at timestamptz := now() + interval '48 hours';
  active_row class_schedules%rowtype;
  prior_row class_schedules%rowtype;
  class_label text;
  instructor_name text;
  old_instructor_name text;
begin
  if tg_op = 'DELETE' then
    active_row := old;
    prior_row := old;
  else
    active_row := new;
    prior_row := old;
  end if;

  class_label := schedule_class_label(active_row.class_type);

  if active_row.instructor_id is not null then
    select trim(concat_ws(' ', first_name, last_name))
    into instructor_name
    from instructors
    where id = active_row.instructor_id;
  end if;

  if tg_op = 'UPDATE' and prior_row.instructor_id is not null then
    select trim(concat_ws(' ', first_name, last_name))
    into old_instructor_name
    from instructors
    where id = prior_row.instructor_id;
  end if;

  if tg_op = 'INSERT' then
    insert into mamute_news (
      title,
      description,
      visibility,
      post_type,
      expires_at,
      created_by
    )
    values (
      format('New Class Added: %s', class_label),
      format(
        '%s has been scheduled for %s from %s to %s.%s',
        class_label,
        schedule_day_label(active_row.day_of_week),
        left(active_row.start_time::text, 5),
        left(active_row.end_time::text, 5),
        case
          when nullif(trim(coalesce(instructor_name, '')), '') is not null
            then format(' Instructor: %s.', instructor_name)
          else ''
        end
      ),
      'public',
      'general',
      expiry_at,
      actor_id
    );
    return new;
  end if;

  if tg_op = 'DELETE' then
    insert into mamute_news (
      title,
      description,
      visibility,
      post_type,
      expires_at,
      created_by
    )
    values (
      format('Class Removed: %s', class_label),
      format(
        '%s on %s at %s has been removed from the schedule.',
        class_label,
        schedule_day_label(active_row.day_of_week),
        left(active_row.start_time::text, 5)
      ),
      'public',
      'general',
      expiry_at,
      actor_id
    );
    return old;
  end if;

  if prior_row.is_active = true and active_row.is_active = false then
    insert into mamute_news (
      title,
      description,
      visibility,
      post_type,
      expires_at,
      created_by
    )
    values (
      format('Class Cancelled: %s', class_label),
      format(
        '%s on %s at %s has been cancelled.%s',
        class_label,
        schedule_day_label(active_row.day_of_week),
        left(active_row.start_time::text, 5),
        case
          when nullif(trim(coalesce(instructor_name, '')), '') is not null
            then format(' Instructor: %s.', instructor_name)
          else ''
        end
      ),
      'public',
      'general',
      expiry_at,
      actor_id
    );
    return new;
  end if;

  if (
    prior_row.day_of_week is distinct from active_row.day_of_week or
    prior_row.start_time is distinct from active_row.start_time or
    prior_row.end_time is distinct from active_row.end_time
  ) then
    insert into mamute_news (
      title,
      description,
      visibility,
      post_type,
      expires_at,
      created_by
    )
    values (
      format('Class Time Changed: %s', class_label),
      format(
        '%s moved from %s at %s-%s to %s at %s-%s.%s',
        class_label,
        schedule_day_label(prior_row.day_of_week),
        left(prior_row.start_time::text, 5),
        left(prior_row.end_time::text, 5),
        schedule_day_label(active_row.day_of_week),
        left(active_row.start_time::text, 5),
        left(active_row.end_time::text, 5),
        case
          when nullif(trim(coalesce(instructor_name, old_instructor_name, '')), '') is not null
            then format(' Instructor: %s.', coalesce(instructor_name, old_instructor_name))
          else ''
        end
      ),
      'public',
      'general',
      expiry_at,
      actor_id
    );
    return new;
  end if;

  return new;
end;
$$;

create or replace function notify_class_schedule_exception_change()
returns trigger
language plpgsql
as $$
declare
  actor_id uuid := coalesce(auth.uid(), new.created_by);
  expiry_at timestamptz := now() + interval '48 hours';
  schedule_row class_schedules%rowtype;
  instructor_name text;
begin
  if tg_op <> 'INSERT' then
    return new;
  end if;

  select *
  into schedule_row
  from class_schedules
  where id = new.schedule_id;

  if schedule_row.id is null then
    return new;
  end if;

  if schedule_row.instructor_id is not null then
    select trim(concat_ws(' ', first_name, last_name))
    into instructor_name
    from instructors
    where id = schedule_row.instructor_id;
  end if;

  insert into mamute_news (
    title,
    description,
    visibility,
    post_type,
    expires_at,
    created_by
  )
  values (
    format('Class Cancelled: %s', schedule_class_label(schedule_row.class_type)),
    format(
      '%s on %s at %s has been cancelled for %s only.%s',
      schedule_class_label(schedule_row.class_type),
      schedule_day_label(schedule_row.day_of_week),
      left(schedule_row.start_time::text, 5),
      new.occurrence_date::text,
      case
        when nullif(trim(coalesce(instructor_name, '')), '') is not null
          then format(' Instructor: %s.', instructor_name)
        else ''
      end
    ),
    'public',
    'general',
    expiry_at,
    actor_id
  );

  return new;
end;
$$;

-- Badge catalog and student badge assignments
create table if not exists badges (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text,
  image_path text,
  image_name text,
  image_mime_type text,
  milestone_count int unique,
  created_by uuid references admins(user_id),
  created_at timestamptz default now()
);

create table if not exists student_badges (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  badge_id uuid not null references badges(id) on delete cascade,
  visibility text not null default 'public' check (visibility in ('public', 'private')),
  assigned_source text not null default 'manual' check (assigned_source in ('auto', 'manual')),
  assigned_by uuid references admins(user_id),
  assigned_at timestamptz default now(),
  unique (student_id, badge_id)
);

create index if not exists idx_student_badges_student
  on student_badges (student_id, assigned_at desc);
create index if not exists idx_mamute_news_visibility
  on mamute_news (visibility, student_id, created_at desc);

-- Notification records and device push tokens
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  type text not null check (type in ('reminder', 'cancel', 'dues', 'general')),
  target jsonb not null default '{}'::jsonb,
  title text not null,
  body text not null,
  scheduled_at timestamptz default now(),
  sent_at timestamptz,
  created_by uuid references admins(user_id),
  created_at timestamptz default now()
);

create index if not exists idx_notifications_target_profile
  on notifications ((target->>'profileId'), scheduled_at desc);

create table if not exists push_tokens (
  profile_id uuid not null references auth.users(id) on delete cascade,
  expo_token text not null,
  platform text not null check (platform in ('ios', 'android', 'web')),
  app_variant text,
  updated_at timestamptz not null default now(),
  primary key (profile_id, platform)
);

do $$
begin
  alter table push_tokens add column if not exists app_variant text;
exception
  when undefined_table then null;
end $$;

do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select tc.constraint_name
    from information_schema.table_constraints tc
    where tc.table_schema = 'public'
      and tc.table_name = 'push_tokens'
      and tc.constraint_type = 'PRIMARY KEY'
  loop
    execute format('alter table public.push_tokens drop constraint if exists %I', constraint_name);
  end loop;
exception
  when undefined_table then null;
end $$;

do $$
begin
  delete from public.push_tokens p
  using public.push_tokens newer
  where p.expo_token = newer.expo_token
    and p.ctid < newer.ctid;
exception
  when undefined_table then null;
end $$;

create unique index if not exists idx_push_tokens_expo_token
  on push_tokens (expo_token);

create index if not exists idx_push_tokens_profile_id
  on push_tokens (profile_id, updated_at desc);

create table if not exists student_automation_events (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references students(id) on delete cascade,
  event_type text not null check (event_type in ('birthday', 'adult_transition')),
  event_date date not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz default now(),
  unique (student_id, event_type, event_date)
);

create index if not exists idx_student_automation_events_type_date
  on student_automation_events (event_type, event_date desc);

create or replace function student_age_years(
  p_birth_date date,
  p_on_date date default current_date
)
returns int
language sql
stable
returns null on null input
as $$
  select extract(year from age(p_on_date, p_birth_date))::int;
$$;

create or replace function ensure_attendance_badge(p_milestone int)
returns uuid
language plpgsql
as $$
declare
  badge_id uuid;
begin
  select b.id
  into badge_id
  from badges b
  where b.milestone_count = p_milestone
  limit 1;

  if badge_id is null then
    insert into badges (title, description, milestone_count)
    values (
      format('%s Class Milestone', p_milestone),
      format('Awarded for completing %s classes.', p_milestone),
      p_milestone
    )
    on conflict (milestone_count) do update
      set
        title = excluded.title,
        description = excluded.description
    returning id into badge_id;
  end if;

  return badge_id;
end;
$$;

create or replace function assign_attendance_milestone_badge()
returns trigger
language plpgsql
as $$
declare
  allowed_milestones int[] := array[10, 25, 50, 100, 200, 300, 400, 500];
  attendance_count int;
  target_milestone int;
  milestone_badge_id uuid;
  assigned_student_badge_id uuid;
  badge_title text;
  badge_description text;
  badge_image_path text;
  badge_image_name text;
  badge_image_mime_type text;
begin
  select count(*)
  into attendance_count
  from attendance
  where student_id = new.student_id;

  if attendance_count = any(allowed_milestones) then
    target_milestone := attendance_count;
  end if;

  if target_milestone is null then
    return new;
  end if;

  milestone_badge_id := ensure_attendance_badge(target_milestone);

  insert into student_badges (
    student_id,
    badge_id,
    visibility,
    assigned_source,
    assigned_by
  )
  values (
    new.student_id,
    milestone_badge_id,
    'private',
    'auto',
    null
  )
  on conflict (student_id, badge_id) do nothing
  returning id into assigned_student_badge_id;

  if assigned_student_badge_id is null then
    return new;
  end if;

  select
    b.title,
    b.description,
    b.image_path,
    b.image_name,
    b.image_mime_type
  into
    badge_title,
    badge_description,
    badge_image_path,
    badge_image_name,
    badge_image_mime_type
  from badges b
  where b.id = milestone_badge_id;

  insert into mamute_news (
    title,
    description,
    visibility,
    post_type,
    student_id,
    attachment_path,
    attachment_name,
    attachment_mime_type
  )
  values (
    format('Badge Earned: %s', coalesce(badge_title, format('%s Class Milestone', target_milestone))),
    coalesce(
      badge_description,
      format('Great work! You reached %s classes and unlocked a new badge.', target_milestone)
    ),
    'private',
    'badge',
    new.student_id,
    badge_image_path,
    badge_image_name,
    badge_image_mime_type
  );

  return new;
end;
$$;

do $$
begin
  perform ensure_attendance_badge(10);
  perform ensure_attendance_badge(25);
  perform ensure_attendance_badge(50);
  perform ensure_attendance_badge(100);
  perform ensure_attendance_badge(200);
  perform ensure_attendance_badge(300);
  perform ensure_attendance_badge(400);
  perform ensure_attendance_badge(500);

  update student_badges
  set visibility = 'private'
  where assigned_source = 'auto' and visibility <> 'private';
end $$;

create or replace function notify_overdue_membership()
returns trigger
language plpgsql
as $$
declare
  actor_id uuid;
begin
  if new.membership_standing not in ('overdue', 'active') then
    return new;
  end if;

  actor_id := coalesce(auth.uid(), new.created_by);

  if tg_op = 'UPDATE'
    and old.membership_standing = 'overdue'
    and new.membership_standing = 'active'
  then
    delete from mamute_news
    where student_id = new.id
      and visibility = 'private'
      and title = 'Payment Required';

    delete from mamute_news
    where student_id = new.id
      and visibility = 'private'
      and title = 'Payment Received';

  insert into mamute_news (
    title,
    description,
    visibility,
    post_type,
    student_id,
    expires_at,
    created_by
  )
  values (
    'Payment Received',
    'Thank you! We have received your membership payment.',
    'private',
    'payment',
    new.id,
    now() + interval '24 hours',
    actor_id
    );

    return new;
  end if;

  if new.membership_standing <> 'overdue' then
    return new;
  end if;

  if tg_op = 'UPDATE' and coalesce(old.membership_standing, '') = 'overdue' then
    return new;
  end if;

  insert into mamute_news (
    title,
    description,
    visibility,
    post_type,
    student_id,
    created_by
  )
  values (
    'Payment Required',
    'Hey there, we noticed you are behind on membership payment. Please make payment at your earliest convenience to help us keep running smoothly. If you believe this notification is in error, please contact us.',
    'private',
    'payment',
    new.id,
    actor_id
  );

  insert into notifications (
    type,
    target,
    title,
    body,
    scheduled_at,
    created_by
  )
  select
    'dues',
    jsonb_build_object(
      'profileId', sa.user_id::text,
      'studentId', new.id::text,
      'studentNumber', new.student_number
    ),
    'Payment Required',
    'Hey there, we noticed you are behind on membership payment. Please make payment at your earliest convenience to help us keep running smoothly. If you believe this notification is in error, please contact us.',
    now(),
    actor_id
  from student_access sa
  where sa.student_id = new.id;

  return new;
end;
$$;

create or replace function run_student_automation(p_run_date date default current_date)
returns void
language plpgsql
as $$
begin
  with birthday_students as (
    select
      s.id,
      s.student_number,
      coalesce(
        nullif(trim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '')), ''),
        format('Student #%s', s.student_number)
      ) as display_name
    from students s
    where s.birth_date is not null
      and extract(month from s.birth_date) = extract(month from p_run_date)
      and extract(day from s.birth_date) = extract(day from p_run_date)
  ),
  birthday_events as (
    insert into student_automation_events (student_id, event_type, event_date, details)
    select
      b.id,
      'birthday',
      p_run_date,
      jsonb_build_object('studentNumber', b.student_number)
    from birthday_students b
    on conflict (student_id, event_type, event_date) do nothing
    returning student_id
  )
  insert into mamute_news (
    title,
    description,
    visibility,
    post_type,
    expires_at,
    created_by
  )
  select
    format('Happy Birthday %s!', b.display_name),
    'Please join us in wishing them a very happy birthday from the Mamute family!',
    'public',
    'birthday',
    p_run_date::timestamptz + interval '24 hours',
    null
  from birthday_students b
  join birthday_events e on e.student_id = b.id;

  with adult_candidates as (
    select
      s.id,
      s.student_number,
      s.membership_type,
      (s.birth_date + interval '13 years')::date as transition_date,
      coalesce(
        nullif(trim(coalesce(s.first_name, '') || ' ' || coalesce(s.last_name, '')), ''),
        format('Student #%s', s.student_number)
      ) as display_name
    from students s
    where s.birth_date is not null
      and student_age_years(s.birth_date, p_run_date) >= 13
      and s.membership_type in ('kids-unlimited', 'kids-limited-once-weekly')
  ),
  adult_events as (
    insert into student_automation_events (student_id, event_type, event_date, details)
    select
      c.id,
      'adult_transition',
      c.transition_date,
      jsonb_build_object(
        'studentNumber', c.student_number,
        'membershipType', c.membership_type
      )
    from adult_candidates c
    on conflict (student_id, event_type, event_date) do nothing
    returning student_id
  )
  insert into notifications (
    type,
    target,
    title,
    body,
    scheduled_at,
    created_by
  )
  select
    'general',
    jsonb_build_object(
      'profileId', a.user_id::text,
      'studentId', c.id::text,
      'studentNumber', c.student_number
    ),
    'Student Now Requires Adult Membership',
    c.display_name || ' is now age 13+ and is no longer eligible for kids classes or membership types. Please update membership and class eligibility.',
    now(),
    null
  from adult_candidates c
  join adult_events e on e.student_id = c.id
  cross join admins a;
end;
$$;

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

drop trigger if exists attendance_assign_badges on attendance;
create trigger attendance_assign_badges
after insert on attendance
for each row execute function assign_attendance_milestone_badge();

drop trigger if exists class_schedules_notify_news on class_schedules;
create trigger class_schedules_notify_news
after insert or update or delete on class_schedules
for each row execute function notify_class_schedule_change();

drop trigger if exists class_schedule_exceptions_notify_news on class_schedule_exceptions;
create trigger class_schedule_exceptions_notify_news
after insert on class_schedule_exceptions
for each row execute function notify_class_schedule_exception_change();

drop trigger if exists students_notify_overdue_membership on students;
create trigger students_notify_overdue_membership
after insert or update of membership_standing on students
for each row execute function notify_overdue_membership();

-- RLS
alter table admins enable row level security;
alter table students enable row level security;
alter table student_access enable row level security;
alter table instructors enable row level security;
alter table instructor_qualifications enable row level security;
alter table class_catalog enable row level security;
alter table class_schedules enable row level security;
alter table class_schedule_exceptions enable row level security;
alter table attendance enable row level security;
alter table mamute_news enable row level security;
alter table badges enable row level security;
alter table student_badges enable row level security;
alter table notifications enable row level security;
alter table push_tokens enable row level security;
alter table shop_merchandise enable row level security;
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

create policy "admins full access class catalog" on class_catalog
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "admins full access schedules" on class_schedules
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "admins full access schedule exceptions" on class_schedule_exceptions
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "admins full access attendance" on attendance
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "admins full access news" on mamute_news
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

drop policy if exists "admins full access badges" on badges;
create policy "admins full access badges" on badges
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

drop policy if exists "admins full access student badges" on student_badges;
create policy "admins full access student badges" on student_badges
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

drop policy if exists "admins full access notifications" on notifications;
create policy "admins full access notifications" on notifications
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

drop policy if exists "admins full access push tokens" on push_tokens;
create policy "admins full access push tokens" on push_tokens
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

drop policy if exists "admins full access shop merchandise" on shop_merchandise;
create policy "admins full access shop merchandise" on shop_merchandise
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "admins full access guardians" on student_guardians
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "admins full access gym settings" on gym_settings
  for all using (exists (select 1 from admins a where a.user_id = auth.uid()))
  with check (exists (select 1 from admins a where a.user_id = auth.uid()));

create policy "student guardians read linked" on student_guardians
  for select using (
    exists (
      select 1 from student_access sa
      where sa.user_id = auth.uid() and sa.student_id = student_guardians.student_id
    )
  );

create policy "student instructors read" on instructors
  for select using (auth.role() = 'authenticated' or auth.role() = 'anon');

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

create policy "class catalog public read" on class_catalog
  for select using (true);

create policy "student schedule read" on class_schedules
  for select using (true);

create policy "schedule exceptions public read" on class_schedule_exceptions
  for select using (true);

drop policy if exists "student news read active" on mamute_news;
create policy "student news read active" on mamute_news
  for select using (
    (auth.role() = 'authenticated' or auth.role() = 'anon')
    and (expires_at is null or expires_at > now())
    and (
      visibility = 'public'
      or (
        visibility = 'private'
        and auth.uid() is not null
        and student_id is not null
        and exists (
          select 1 from student_access sa
          where sa.user_id = auth.uid() and sa.student_id = mamute_news.student_id
        )
      )
    )
  );

drop policy if exists "badge catalog read" on badges;
create policy "badge catalog read" on badges
  for select using (true);

drop policy if exists "student badge records read linked" on student_badges;
create policy "student badge records read linked" on student_badges
  for select using (
    exists (
      select 1 from student_access sa
      where sa.user_id = auth.uid() and sa.student_id = student_badges.student_id
    )
  );

drop policy if exists "student notifications read own" on notifications;
create policy "student notifications read own" on notifications
  for select using (
    auth.uid() is not null
    and target->>'profileId' = auth.uid()::text
  );

drop policy if exists "student push tokens manage own" on push_tokens;
create policy "student push tokens manage own" on push_tokens
  for all using (
    auth.uid() is not null and profile_id = auth.uid()
  )
  with check (
    auth.uid() is not null and profile_id = auth.uid()
  );

drop policy if exists "shop merchandise public read" on shop_merchandise;
create policy "shop merchandise public read" on shop_merchandise
  for select using ((auth.role() = 'authenticated' or auth.role() = 'anon') and is_active = true);

do $$
begin
  begin
    create extension if not exists pg_cron;
  exception
    when insufficient_privilege then null;
    when undefined_file then null;
  end;

  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid)
    from cron.job
    where jobname = 'mamute-daily-student-automation';

    perform cron.schedule(
      'mamute-daily-student-automation',
      '5 5 * * *',
      $cron$select public.run_student_automation(current_date);$cron$
    );
  end if;
exception
  when undefined_table then null;
  when undefined_function then null;
end $$;

do $$
begin
  perform public.run_student_automation(current_date);
exception
  when undefined_function then null;
end $$;

insert into storage.buckets (id, name, public)
values ('mamute-news', 'mamute-news', true)
on conflict (id) do update
set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('mamute-badges', 'mamute-badges', true)
on conflict (id) do update
set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('mamute-shop', 'mamute-shop', true)
on conflict (id) do update
set public = excluded.public;

insert into storage.buckets (id, name, public)
values ('mamute-instructors', 'mamute-instructors', true)
on conflict (id) do update
set public = excluded.public;

drop policy if exists "admins manage mamute news files" on storage.objects;
create policy "admins manage mamute news files"
on storage.objects
for all
using (
  bucket_id = 'mamute-news'
  and exists (select 1 from admins a where a.user_id = auth.uid())
)
with check (
  bucket_id = 'mamute-news'
  and exists (select 1 from admins a where a.user_id = auth.uid())
);

drop policy if exists "admins manage mamute badge files" on storage.objects;
create policy "admins manage mamute badge files"
on storage.objects
for all
using (
  bucket_id = 'mamute-badges'
  and exists (select 1 from admins a where a.user_id = auth.uid())
)
with check (
  bucket_id = 'mamute-badges'
  and exists (select 1 from admins a where a.user_id = auth.uid())
);

drop policy if exists "admins manage mamute shop files" on storage.objects;
create policy "admins manage mamute shop files"
on storage.objects
for all
using (
  bucket_id = 'mamute-shop'
  and exists (select 1 from admins a where a.user_id = auth.uid())
)
with check (
  bucket_id = 'mamute-shop'
  and exists (select 1 from admins a where a.user_id = auth.uid())
);

drop policy if exists "admins manage mamute instructor files" on storage.objects;
create policy "admins manage mamute instructor files"
on storage.objects
for all
using (
  bucket_id = 'mamute-instructors'
  and exists (select 1 from admins a where a.user_id = auth.uid())
)
with check (
  bucket_id = 'mamute-instructors'
  and exists (select 1 from admins a where a.user_id = auth.uid())
);

insert into gym_settings (id, latitude, longitude)
values (1, 43.92171016104063, -78.87364279024405)
on conflict (id) do nothing;
