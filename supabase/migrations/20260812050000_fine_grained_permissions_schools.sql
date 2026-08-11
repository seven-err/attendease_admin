-- Fine-grained department-admin permissions + multi-school hierarchy.
-- Preserves checker mobile/offline paths (attendance_checker + checker_profiles).

-- ---------------------------------------------------------------------------
-- 1) Schools (multi-school ready)
-- ---------------------------------------------------------------------------

create table if not exists public.schools (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.schools (code, name, status)
values ('001', 'CRMC', 'active')
on conflict (code) do nothing;

alter table public.schools enable row level security;

-- ---------------------------------------------------------------------------
-- 2) Departments: school link + archive status
-- ---------------------------------------------------------------------------

alter table public.departments
  add column if not exists school_id uuid references public.schools(id) on delete restrict;

alter table public.departments
  add column if not exists description text;

update public.departments d
set school_id = s.id
from public.schools s
where s.code in ('001', 'DEFAULT')
  and d.school_id is null;

alter table public.departments
  alter column school_id set not null;

alter table public.departments drop constraint if exists departments_status_check;
alter table public.departments
  add constraint departments_status_check
  check (status in ('active', 'inactive', 'archived'));

-- ---------------------------------------------------------------------------
-- 3) Permission catalog + grants per department admin
-- ---------------------------------------------------------------------------

create table if not exists public.permission_catalog (
  key text primary key,
  group_key text not null,
  label text not null,
  description text,
  high_risk boolean not null default false,
  sort_order int not null default 0
);

insert into public.permission_catalog (key, group_key, label, description, high_risk, sort_order)
values
  ('people.view', 'people', 'View people', 'Browse students and staff in scope', false, 10),
  ('people.create', 'people', 'Create people', 'Add students or staff records', false, 20),
  ('people.edit', 'people', 'Edit people', 'Update roster and academic records', false, 30),
  ('people.archive', 'people', 'Archive people', 'Archive or restore people', true, 40),
  ('people.delete', 'people', 'Delete people', 'Permanently delete people', true, 50),
  ('qr.view', 'qr', 'View QR', 'View QR credentials', false, 60),
  ('qr.generate', 'qr', 'Generate QR', 'Generate missing QR tokens', false, 70),
  ('qr.regenerate', 'qr', 'Regenerate QR', 'Replace existing QR tokens', true, 80),
  ('qr.export', 'qr', 'Export QR', 'Export or print QR sheets', false, 90),
  ('sessions.view', 'sessions', 'View sessions', 'Browse sessions in scope', false, 100),
  ('sessions.create', 'sessions', 'Create sessions', 'Create main and sub-sessions', false, 110),
  ('sessions.edit', 'sessions', 'Edit sessions', 'Update and open/close sessions', false, 120),
  ('sessions.archive', 'sessions', 'Archive sessions', 'Archive or restore sessions', true, 130),
  ('sessions.delete', 'sessions', 'Delete sessions', 'Permanently delete sessions', true, 140),
  ('attendance.view', 'attendance', 'View attendance', 'Browse attendance logs', false, 150),
  ('attendance.edit', 'attendance', 'Edit attendance', 'Correct attendance records', true, 160),
  ('attendance.void', 'attendance', 'Void attendance', 'Void attendance records', true, 170),
  ('attendance.export', 'attendance', 'Export attendance', 'Export attendance data', false, 180),
  ('checkers.view', 'checkers', 'View checkers', 'Browse checker accounts', false, 190),
  ('checkers.manage', 'checkers', 'Manage checkers', 'Create and edit checker accounts', true, 200),
  ('checkers.pin_manage', 'checkers', 'Manage checker PINs', 'Reset or manage checker PINs', true, 210),
  ('reports.view', 'reports', 'View reports', 'Browse report screens', false, 220),
  ('reports.export', 'reports', 'Export reports', 'Download report exports', false, 230),
  ('bulk_import.view', 'bulk_import', 'View bulk import', 'Open bulk import tools', false, 240),
  ('bulk_import.execute', 'bulk_import', 'Execute bulk import', 'Confirm and run imports', true, 250)
on conflict (key) do update
set
  group_key = excluded.group_key,
  label = excluded.label,
  description = excluded.description,
  high_risk = excluded.high_risk,
  sort_order = excluded.sort_order;

create table if not exists public.department_admin_permissions (
  user_id uuid not null references public.users(id) on delete cascade,
  permission_key text not null references public.permission_catalog(key) on delete cascade,
  granted_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, permission_key)
);

create index if not exists idx_dept_admin_perms_user
  on public.department_admin_permissions (user_id);
create index if not exists idx_dept_admin_perms_key
  on public.department_admin_permissions (permission_key);

alter table public.permission_catalog enable row level security;
alter table public.department_admin_permissions enable row level security;

-- Audit log: optional school scope
alter table public.admin_audit_logs
  add column if not exists school_id uuid references public.schools(id) on delete set null;

-- ---------------------------------------------------------------------------
-- 4) Authorization helpers
-- ---------------------------------------------------------------------------

create or replace function public.has_permission(
  user_id uuid,
  permission_key text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin(user_id)
    or (
      public.is_department_admin(user_id)
      and exists (
        select 1
        from public.department_admin_permissions p
        where p.user_id = has_permission.user_id
          and p.permission_key = has_permission.permission_key
      )
    );
$$;

create or replace function public.can_access_person(
  user_id uuid,
  person_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin(user_id)
    or (
      public.has_permission(user_id, 'people.view')
      and public.person_in_user_department(user_id, person_id)
    );
$$;

create or replace function public.can_manage_sessions(
  user_id uuid,
  department_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin(user_id)
    or (
      public.has_permission(user_id, 'sessions.edit')
      and public.can_access_department(user_id, department_code)
    );
$$;

create or replace function public.can_edit_attendance(
  user_id uuid,
  session_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin(user_id)
    or (
      public.has_permission(user_id, 'attendance.edit')
      and exists (
        select 1
        from public.attendance_sessions s
        where s.id = session_id
          and public.can_access_department(user_id, s.department)
      )
    );
$$;

create or replace function public.can_manage_checkers(
  user_id uuid,
  department_code text
)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    public.is_admin(user_id)
    or (
      public.has_permission(user_id, 'checkers.manage')
      and public.can_access_department(user_id, department_code)
    );
$$;

create or replace function public.can_export_reports(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.has_permission(user_id, 'reports.export');
$$;

create or replace function public.user_school_id(user_id uuid)
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select d.school_id
  from public.users u
  left join public.departments d
    on d.code = public.normalize_department_code(u.department)
  where u.id = user_id
  limit 1;
$$;

-- Replace department-admin permissions in bulk (super admin only).
create or replace function public.set_department_admin_permissions(
  p_user_id uuid,
  p_permission_keys text[]
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_role text;
begin
  if not public.is_admin(v_actor) then
    raise exception 'Only super admins can configure department admin permissions.';
  end if;

  select role into v_role from public.users where id = p_user_id;
  if v_role is distinct from 'department_admin' then
    raise exception 'Permissions can only be assigned to department admins.';
  end if;

  if exists (
    select 1
    from unnest(coalesce(p_permission_keys, array[]::text[])) k(key)
    where not exists (
      select 1 from public.permission_catalog c where c.key = k.key
    )
  ) then
    raise exception 'One or more permission keys are invalid.';
  end if;

  delete from public.department_admin_permissions where user_id = p_user_id;

  insert into public.department_admin_permissions (user_id, permission_key, granted_by)
  select p_user_id, k.key, v_actor
  from unnest(coalesce(p_permission_keys, array[]::text[])) as k(key)
  on conflict do nothing;
end;
$$;

revoke all on function public.has_permission(uuid, text) from public;
revoke all on function public.can_access_person(uuid, uuid) from public;
revoke all on function public.can_manage_sessions(uuid, text) from public;
revoke all on function public.can_edit_attendance(uuid, uuid) from public;
revoke all on function public.can_manage_checkers(uuid, text) from public;
revoke all on function public.can_export_reports(uuid) from public;
revoke all on function public.user_school_id(uuid) from public;
revoke all on function public.set_department_admin_permissions(uuid, text[]) from public;

grant execute on function public.has_permission(uuid, text) to authenticated;
grant execute on function public.can_access_person(uuid, uuid) to authenticated;
grant execute on function public.can_manage_sessions(uuid, text) to authenticated;
grant execute on function public.can_edit_attendance(uuid, uuid) to authenticated;
grant execute on function public.can_manage_checkers(uuid, text) to authenticated;
grant execute on function public.can_export_reports(uuid) to authenticated;
grant execute on function public.user_school_id(uuid) to authenticated;
grant execute on function public.set_department_admin_permissions(uuid, text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 5) RLS — schools / catalog / grants
-- ---------------------------------------------------------------------------

drop policy if exists "schools_portal_select" on public.schools;
create policy "schools_portal_select"
  on public.schools
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or (
      public.is_department_admin((select auth.uid()))
      and id = public.user_school_id((select auth.uid()))
    )
    or public.is_attendance_checker((select auth.uid()))
  );

drop policy if exists "schools_admin_manage" on public.schools;
create policy "schools_admin_manage"
  on public.schools
  for all
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

drop policy if exists "permission_catalog_select" on public.permission_catalog;
create policy "permission_catalog_select"
  on public.permission_catalog
  for select
  to authenticated
  using (public.is_portal_admin((select auth.uid())));

drop policy if exists "dept_admin_perms_select" on public.department_admin_permissions;
create policy "dept_admin_perms_select"
  on public.department_admin_permissions
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or user_id = (select auth.uid())
  );

drop policy if exists "dept_admin_perms_admin_manage" on public.department_admin_permissions;
create policy "dept_admin_perms_admin_manage"
  on public.department_admin_permissions
  for all
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- ---------------------------------------------------------------------------
-- 6) Tighten department-admin write policies with permission keys
-- ---------------------------------------------------------------------------

drop policy if exists "students_admin_all_checker_select" on public.students;
create policy "students_admin_all_checker_select"
  on public.students
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or public.is_attendance_checker((select auth.uid()))
    or (
      public.has_permission((select auth.uid()), 'people.view')
      and public.person_in_user_department((select auth.uid()), id)
    )
  );

drop policy if exists "students_department_admin_insert" on public.students;
create policy "students_department_admin_insert"
  on public.students
  for insert
  to authenticated
  with check (public.has_permission((select auth.uid()), 'people.create'));

drop policy if exists "students_department_admin_update" on public.students;
create policy "students_department_admin_update"
  on public.students
  for update
  to authenticated
  using (
    public.person_in_user_department((select auth.uid()), id)
    and (
      public.has_permission((select auth.uid()), 'people.edit')
      or public.has_permission((select auth.uid()), 'people.archive')
    )
  )
  with check (
    public.has_permission((select auth.uid()), 'people.edit')
    or public.has_permission((select auth.uid()), 'people.archive')
  );

drop policy if exists "students_department_admin_delete" on public.students;
create policy "students_department_admin_delete"
  on public.students
  for delete
  to authenticated
  using (
    public.has_permission((select auth.uid()), 'people.delete')
    and public.person_in_user_department((select auth.uid()), id)
  );

drop policy if exists "student_academic_admin_all_checker_select" on public.student_academic_records;
create policy "student_academic_admin_all_checker_select"
  on public.student_academic_records
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or public.is_attendance_checker((select auth.uid()))
    or (
      public.has_permission((select auth.uid()), 'people.view')
      and public.can_access_department((select auth.uid()), department)
    )
  );

drop policy if exists "student_academic_department_admin_insert" on public.student_academic_records;
create policy "student_academic_department_admin_insert"
  on public.student_academic_records
  for insert
  to authenticated
  with check (
    public.has_permission((select auth.uid()), 'people.create')
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "student_academic_department_admin_update" on public.student_academic_records;
create policy "student_academic_department_admin_update"
  on public.student_academic_records
  for update
  to authenticated
  using (
    public.can_access_department((select auth.uid()), department)
    and (
      public.has_permission((select auth.uid()), 'people.edit')
      or public.has_permission((select auth.uid()), 'people.archive')
    )
  )
  with check (
    public.can_access_department((select auth.uid()), department)
    and (
      public.has_permission((select auth.uid()), 'people.edit')
      or public.has_permission((select auth.uid()), 'people.archive')
    )
  );

drop policy if exists "student_academic_department_admin_delete" on public.student_academic_records;
create policy "student_academic_department_admin_delete"
  on public.student_academic_records
  for delete
  to authenticated
  using (
    public.has_permission((select auth.uid()), 'people.delete')
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "people_admin_all_checker_select" on public.people;
create policy "people_admin_all_checker_select"
  on public.people
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or public.is_attendance_checker((select auth.uid()))
    or public.can_access_person((select auth.uid()), id)
  );

drop policy if exists "people_department_admin_manage" on public.people;
create policy "people_department_admin_manage"
  on public.people
  for all
  to authenticated
  using (
    public.can_access_person((select auth.uid()), id)
    and (
      public.has_permission((select auth.uid()), 'people.edit')
      or public.has_permission((select auth.uid()), 'people.archive')
      or public.has_permission((select auth.uid()), 'people.delete')
    )
  )
  with check (
    public.has_permission((select auth.uid()), 'people.create')
    or public.has_permission((select auth.uid()), 'people.edit')
    or public.has_permission((select auth.uid()), 'people.archive')
  );

drop policy if exists "attendance_sessions_admin_all_checker_open" on public.attendance_sessions;
create policy "attendance_sessions_admin_all_checker_open"
  on public.attendance_sessions
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or (
      public.has_permission((select auth.uid()), 'sessions.view')
      and public.can_access_department((select auth.uid()), department)
    )
    or (
      public.is_attendance_checker((select auth.uid()))
      and status = any (array['Open'::text, 'Closed'::text, 'Draft'::text])
      and (assigned_checker_id is null or assigned_checker_id = (select auth.uid()))
      and public.checker_can_access_session_department((select auth.uid()), department)
    )
  );

drop policy if exists "attendance_sessions_department_admin_insert" on public.attendance_sessions;
create policy "attendance_sessions_department_admin_insert"
  on public.attendance_sessions
  for insert
  to authenticated
  with check (
    public.has_permission((select auth.uid()), 'sessions.create')
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "attendance_sessions_department_admin_update" on public.attendance_sessions;
create policy "attendance_sessions_department_admin_update"
  on public.attendance_sessions
  for update
  to authenticated
  using (
    public.can_access_department((select auth.uid()), department)
    and (
      public.has_permission((select auth.uid()), 'sessions.edit')
      or public.has_permission((select auth.uid()), 'sessions.archive')
    )
  )
  with check (
    public.can_access_department((select auth.uid()), department)
    and (
      public.has_permission((select auth.uid()), 'sessions.edit')
      or public.has_permission((select auth.uid()), 'sessions.archive')
    )
  );

drop policy if exists "attendance_sessions_department_admin_delete" on public.attendance_sessions;
create policy "attendance_sessions_department_admin_delete"
  on public.attendance_sessions
  for delete
  to authenticated
  using (
    public.has_permission((select auth.uid()), 'sessions.delete')
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "attendance_logs_admin_all_checker_own_sessions" on public.attendance_logs;
create policy "attendance_logs_admin_all_checker_own_sessions"
  on public.attendance_logs
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or (
      public.has_permission((select auth.uid()), 'attendance.view')
      and exists (
        select 1
        from public.attendance_sessions s
        where s.id = attendance_logs.session_id
          and public.can_access_department((select auth.uid()), s.department)
      )
    )
    or (
      public.is_attendance_checker((select auth.uid()))
      and exists (
        select 1
        from public.attendance_sessions s
        where s.id = attendance_logs.session_id
          and s.status = 'Open'
          and (s.assigned_checker_id is null or s.assigned_checker_id = (select auth.uid()))
      )
    )
  );

drop policy if exists "attendance_logs_department_admin_update" on public.attendance_logs;
create policy "attendance_logs_department_admin_update"
  on public.attendance_logs
  for update
  to authenticated
  using (
    public.can_edit_attendance((select auth.uid()), session_id)
    or (
      public.has_permission((select auth.uid()), 'attendance.void')
      and exists (
        select 1
        from public.attendance_sessions s
        where s.id = attendance_logs.session_id
          and public.can_access_department((select auth.uid()), s.department)
      )
    )
  )
  with check (
    public.can_edit_attendance((select auth.uid()), session_id)
    or (
      public.has_permission((select auth.uid()), 'attendance.void')
      and exists (
        select 1
        from public.attendance_sessions s
        where s.id = attendance_logs.session_id
          and public.can_access_department((select auth.uid()), s.department)
      )
    )
  );

drop policy if exists "main_sessions_department_admin_select" on public.main_sessions;
create policy "main_sessions_department_admin_select"
  on public.main_sessions
  for select
  to authenticated
  using (
    public.has_permission((select auth.uid()), 'sessions.view')
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "main_sessions_department_admin_insert" on public.main_sessions;
create policy "main_sessions_department_admin_insert"
  on public.main_sessions
  for insert
  to authenticated
  with check (
    public.has_permission((select auth.uid()), 'sessions.create')
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "main_sessions_department_admin_update" on public.main_sessions;
create policy "main_sessions_department_admin_update"
  on public.main_sessions
  for update
  to authenticated
  using (
    public.can_access_department((select auth.uid()), department)
    and (
      public.has_permission((select auth.uid()), 'sessions.edit')
      or public.has_permission((select auth.uid()), 'sessions.archive')
    )
  )
  with check (
    public.can_access_department((select auth.uid()), department)
    and (
      public.has_permission((select auth.uid()), 'sessions.edit')
      or public.has_permission((select auth.uid()), 'sessions.archive')
    )
  );

drop policy if exists "users_department_admin_insert" on public.users;
create policy "users_department_admin_insert"
  on public.users
  for insert
  to authenticated
  with check (
    public.has_permission((select auth.uid()), 'checkers.manage')
    and role = 'attendance_checker'
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "users_department_admin_update" on public.users;
create policy "users_department_admin_update"
  on public.users
  for update
  to authenticated
  using (
    public.has_permission((select auth.uid()), 'checkers.manage')
    and role = 'attendance_checker'
    and public.can_access_department((select auth.uid()), department)
  )
  with check (
    public.has_permission((select auth.uid()), 'checkers.manage')
    and role = 'attendance_checker'
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin"
  on public.users
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or public.is_admin((select auth.uid()))
    or (
      public.has_permission((select auth.uid()), 'checkers.view')
      and role = 'attendance_checker'
      and (
        checker_scope = 'ssg'
        or public.can_access_department((select auth.uid()), department)
      )
    )
  );

drop policy if exists "checker_profiles_department_admin_select" on public.checker_profiles;
create policy "checker_profiles_department_admin_select"
  on public.checker_profiles
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or (
      (
        public.has_permission((select auth.uid()), 'checkers.view')
        or public.has_permission((select auth.uid()), 'checkers.pin_manage')
      )
      and exists (
        select 1
        from public.users u
        where u.id = checker_profiles.account_id
          and u.role = 'attendance_checker'
          and (
            u.checker_scope = 'ssg'
            or public.can_access_department((select auth.uid()), u.department)
          )
      )
    )
  );

-- Audit: department admins only see own-dept when authorized (any portal permission).
drop policy if exists "admin_audit_logs_select" on public.admin_audit_logs;
create policy "admin_audit_logs_select"
  on public.admin_audit_logs
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or (
      public.is_department_admin((select auth.uid()))
      and public.can_access_department((select auth.uid()), department)
    )
  );

-- Seed default permissions for existing department admins with zero grants.
insert into public.department_admin_permissions (user_id, permission_key)
select u.id, k.key
from public.users u
cross join (
  values
    ('people.view'),('people.create'),('people.edit'),
    ('qr.view'),('qr.generate'),('qr.export'),
    ('sessions.view'),('sessions.create'),('sessions.edit'),
    ('attendance.view'),('attendance.export'),
    ('checkers.view'),
    ('reports.view'),('reports.export')
) as k(key)
where u.role = 'department_admin'
  and u.status = 'active'
  and not exists (
    select 1 from public.department_admin_permissions p where p.user_id = u.id
  )
on conflict do nothing;
