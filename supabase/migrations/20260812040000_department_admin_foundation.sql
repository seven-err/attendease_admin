-- Department admin role, departments catalog, auth helpers, scoped RLS, audit log.
-- Preserves existing admin + attendance_checker behavior.
-- Safe to re-run (idempotent drops/creates).

-- ---------------------------------------------------------------------------
-- 1) Role constraint: allow department_admin
-- ---------------------------------------------------------------------------

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check
  check (role in ('admin', 'department_admin', 'attendance_checker'));

-- Department admins must have a department code assigned.
alter table public.users drop constraint if exists users_department_admin_requires_department;
alter table public.users
  add constraint users_department_admin_requires_department
  check (
    role <> 'department_admin'
    or nullif(trim(coalesce(department, '')), '') is not null
  );

-- ---------------------------------------------------------------------------
-- 2) Departments catalog (codes remain the join key for existing text columns)
-- ---------------------------------------------------------------------------

create table if not exists public.departments (
  code text primary key,
  name text not null,
  status text not null default 'active'
    check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.departments (code, name, status)
values
  ('CCS', 'College of Computer Studies', 'active'),
  ('CCJE', 'College of Criminal Justice Education', 'active'),
  ('CBE', 'College of Business Education', 'active'),
  ('CTE', 'College of Teacher Education', 'active'),
  ('PSYCH', 'Psychology', 'active')
on conflict (code) do nothing;

alter table public.departments enable row level security;

-- ---------------------------------------------------------------------------
-- 3) Admin audit log
-- ---------------------------------------------------------------------------

create table if not exists public.admin_audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  target_type text,
  target_id text,
  department text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_admin_audit_logs_created_at
  on public.admin_audit_logs (created_at desc);
create index if not exists idx_admin_audit_logs_actor_id
  on public.admin_audit_logs (actor_id);
create index if not exists idx_admin_audit_logs_department
  on public.admin_audit_logs (department);

alter table public.admin_audit_logs enable row level security;

-- ---------------------------------------------------------------------------
-- 4) Authorization helpers
-- ---------------------------------------------------------------------------

create or replace function public.is_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = user_id
      and u.role = 'admin'
      and u.status = 'active'
  );
$$;

create or replace function public.is_department_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.users u
    where u.id = user_id
      and u.role = 'department_admin'
      and u.status = 'active'
      and nullif(trim(coalesce(u.department, '')), '') is not null
  );
$$;

create or replace function public.is_portal_admin(user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.is_admin(user_id) or public.is_department_admin(user_id);
$$;

create or replace function public.user_department(user_id uuid)
returns text
language sql
stable
security definer
set search_path = public
as $$
  select public.normalize_department_code(u.department)
  from public.users u
  where u.id = user_id
    and u.status = 'active'
  limit 1;
$$;

create or replace function public.can_access_department(
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
      public.is_department_admin(user_id)
      and department_code is not null
      and public.normalize_department_code(department_code)
        = public.user_department(user_id)
    );
$$;

create or replace function public.person_in_user_department(
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
      public.is_department_admin(user_id)
      and (
        exists (
          select 1
          from public.student_academic_records r
          where r.student_id = person_id
            and public.can_access_department(user_id, r.department)
        )
        or exists (
          select 1
          from public.staff_assignments s
          where s.person_id = person_id
            and public.can_access_department(user_id, s.department)
        )
      )
    );
$$;

-- Prevent department admins from escalating roles via direct table updates.
create or replace function public.enforce_users_role_safety()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    return new;
  end if;

  -- Super admins may manage freely.
  if public.is_admin(v_actor) then
    return new;
  end if;

  -- Department admins may only touch attendance_checker rows in their dept.
  if public.is_department_admin(v_actor) then
    if tg_op = 'INSERT' then
      if new.role <> 'attendance_checker' then
        raise exception 'Department admins can only create checker accounts.';
      end if;
      if not public.can_access_department(v_actor, new.department) then
        raise exception 'Checker department is outside your scope.';
      end if;
      return new;
    end if;

    if old.role <> 'attendance_checker' or new.role <> 'attendance_checker' then
      raise exception 'Department admins cannot change administrative roles.';
    end if;

    if not public.can_access_department(v_actor, old.department)
       or not public.can_access_department(v_actor, new.department) then
      raise exception 'Checker department is outside your scope.';
    end if;

    return new;
  end if;

  -- Other roles: allow self profile-safe updates only when policies permit.
  return new;
end;
$$;

drop trigger if exists users_enforce_role_safety on public.users;
create trigger users_enforce_role_safety
before insert or update on public.users
for each row execute function public.enforce_users_role_safety();

-- ---------------------------------------------------------------------------
-- 5) Overview stats RPC (scoped)
-- ---------------------------------------------------------------------------

create or replace function public.get_admin_overview_stats(
  p_department text default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_actor uuid := auth.uid();
  v_dept text;
  v_today date := (timezone('Asia/Manila', now()))::date;
  v_start timestamptz;
  v_end timestamptz;
  v_result jsonb;
begin
  if not public.is_portal_admin(v_actor) then
    raise exception 'Not authorized.';
  end if;

  if public.is_department_admin(v_actor) then
    v_dept := public.user_department(v_actor);
  else
    v_dept := public.normalize_department_code(p_department);
  end if;

  v_start := timezone('Asia/Manila', v_today::timestamp);
  v_end := v_start + interval '1 day' - interval '1 second';

  select jsonb_build_object(
    'open_sessions', (
      select count(*)::int
      from public.attendance_sessions s
      where s.status = 'Open'
        and s.date = v_today
        and (v_dept is null or public.normalize_department_code(s.department) = v_dept)
    ),
    'attendance_today', (
      select count(*)::int
      from public.attendance_logs l
      join public.attendance_sessions s on s.id = l.session_id
      where l.scanned_at >= v_start
        and l.scanned_at <= v_end
        and (v_dept is null or public.normalize_department_code(s.department) = v_dept)
    ),
    'active_people', (
      select count(*)::int
      from public.students st
      where st.student_status = 'Active'
        and (
          v_dept is null
          or exists (
            select 1
            from public.student_academic_records r
            where r.student_id = st.id
              and public.normalize_department_code(r.department) = v_dept
          )
        )
    ),
    'active_checkers', (
      select count(*)::int
      from public.users u
      where u.role = 'attendance_checker'
        and u.status = 'active'
        and (
          v_dept is null
          or u.checker_scope = 'ssg'
          or public.normalize_department_code(u.department) = v_dept
        )
    ),
    'active_departments', (
      select count(*)::int
      from public.departments d
      where d.status = 'active'
        and (v_dept is null or d.code = v_dept)
    ),
    'department', v_dept
  )
  into v_result;

  return v_result;
end;
$$;

-- ---------------------------------------------------------------------------
-- 6) Grants
-- ---------------------------------------------------------------------------

revoke all on function public.is_department_admin(uuid) from public;
revoke all on function public.is_portal_admin(uuid) from public;
revoke all on function public.user_department(uuid) from public;
revoke all on function public.can_access_department(uuid, text) from public;
revoke all on function public.person_in_user_department(uuid, uuid) from public;
revoke all on function public.get_admin_overview_stats(text) from public;

grant execute on function public.is_admin(uuid) to authenticated;
grant execute on function public.is_department_admin(uuid) to authenticated;
grant execute on function public.is_portal_admin(uuid) to authenticated;
grant execute on function public.user_department(uuid) to authenticated;
grant execute on function public.can_access_department(uuid, text) to authenticated;
grant execute on function public.person_in_user_department(uuid, uuid) to authenticated;
grant execute on function public.get_admin_overview_stats(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 7) RLS — departments
-- ---------------------------------------------------------------------------

drop policy if exists "departments_portal_select" on public.departments;
create policy "departments_portal_select"
  on public.departments
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or (
      public.is_department_admin((select auth.uid()))
      and code = public.user_department((select auth.uid()))
    )
    or public.is_attendance_checker((select auth.uid()))
  );

drop policy if exists "departments_admin_manage" on public.departments;
create policy "departments_admin_manage"
  on public.departments
  for all
  to authenticated
  using (public.is_admin((select auth.uid())))
  with check (public.is_admin((select auth.uid())));

-- ---------------------------------------------------------------------------
-- 8) RLS — audit logs
-- ---------------------------------------------------------------------------

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

drop policy if exists "admin_audit_logs_insert" on public.admin_audit_logs;
create policy "admin_audit_logs_insert"
  on public.admin_audit_logs
  for insert
  to authenticated
  with check (
    public.is_portal_admin((select auth.uid()))
    and actor_id = (select auth.uid())
    and (
      public.is_admin((select auth.uid()))
      or public.can_access_department((select auth.uid()), department)
      or department is null
    )
  );

-- ---------------------------------------------------------------------------
-- 9) RLS — users (department admin scoped checker visibility/management)
-- ---------------------------------------------------------------------------

drop policy if exists "users_select_self_or_admin" on public.users;
create policy "users_select_self_or_admin"
  on public.users
  for select
  to authenticated
  using (
    (select auth.uid()) = id
    or public.is_admin((select auth.uid()))
    or (
      public.is_department_admin((select auth.uid()))
      and role = 'attendance_checker'
      and (
        checker_scope = 'ssg'
        or public.can_access_department((select auth.uid()), department)
      )
    )
  );

drop policy if exists "users_department_admin_insert" on public.users;
create policy "users_department_admin_insert"
  on public.users
  for insert
  to authenticated
  with check (
    public.is_department_admin((select auth.uid()))
    and role = 'attendance_checker'
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "users_department_admin_update" on public.users;
create policy "users_department_admin_update"
  on public.users
  for update
  to authenticated
  using (
    public.is_department_admin((select auth.uid()))
    and role = 'attendance_checker'
    and public.can_access_department((select auth.uid()), department)
  )
  with check (
    public.is_department_admin((select auth.uid()))
    and role = 'attendance_checker'
    and public.can_access_department((select auth.uid()), department)
  );

-- ---------------------------------------------------------------------------
-- 10) RLS — students / academic records
-- ---------------------------------------------------------------------------

drop policy if exists "students_admin_all_checker_select" on public.students;
create policy "students_admin_all_checker_select"
  on public.students
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or public.is_attendance_checker((select auth.uid()))
    or public.person_in_user_department((select auth.uid()), id)
  );

drop policy if exists "students_department_admin_insert" on public.students;
create policy "students_department_admin_insert"
  on public.students
  for insert
  to authenticated
  with check (public.is_department_admin((select auth.uid())));

drop policy if exists "students_department_admin_update" on public.students;
create policy "students_department_admin_update"
  on public.students
  for update
  to authenticated
  using (public.person_in_user_department((select auth.uid()), id))
  with check (public.is_department_admin((select auth.uid())));

drop policy if exists "students_department_admin_delete" on public.students;
create policy "students_department_admin_delete"
  on public.students
  for delete
  to authenticated
  using (public.person_in_user_department((select auth.uid()), id));

drop policy if exists "student_academic_admin_all_checker_select" on public.student_academic_records;
create policy "student_academic_admin_all_checker_select"
  on public.student_academic_records
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or public.is_attendance_checker((select auth.uid()))
    or public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "student_academic_department_admin_insert" on public.student_academic_records;
create policy "student_academic_department_admin_insert"
  on public.student_academic_records
  for insert
  to authenticated
  with check (
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "student_academic_department_admin_update" on public.student_academic_records;
create policy "student_academic_department_admin_update"
  on public.student_academic_records
  for update
  to authenticated
  using (
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  )
  with check (
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "student_academic_department_admin_delete" on public.student_academic_records;
create policy "student_academic_department_admin_delete"
  on public.student_academic_records
  for delete
  to authenticated
  using (
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  );

-- ---------------------------------------------------------------------------
-- 11) RLS — people / staff
-- ---------------------------------------------------------------------------

drop policy if exists "people_admin_all_checker_select" on public.people;
create policy "people_admin_all_checker_select"
  on public.people
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or public.is_attendance_checker((select auth.uid()))
    or public.person_in_user_department((select auth.uid()), id)
  );

drop policy if exists "people_department_admin_manage" on public.people;
create policy "people_department_admin_manage"
  on public.people
  for all
  to authenticated
  using (public.person_in_user_department((select auth.uid()), id))
  with check (public.is_department_admin((select auth.uid())));

drop policy if exists "staff_assignments_admin_checker_select" on public.staff_assignments;
create policy "staff_assignments_admin_checker_select"
  on public.staff_assignments
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or public.is_attendance_checker((select auth.uid()))
    or public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "staff_assignments_department_admin_manage" on public.staff_assignments;
create policy "staff_assignments_department_admin_manage"
  on public.staff_assignments
  for all
  to authenticated
  using (
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  )
  with check (
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  );

-- ---------------------------------------------------------------------------
-- 12) RLS — sessions / logs / main_sessions
-- ---------------------------------------------------------------------------

drop policy if exists "attendance_sessions_admin_all_checker_open" on public.attendance_sessions;
create policy "attendance_sessions_admin_all_checker_open"
  on public.attendance_sessions
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or (
      public.is_department_admin((select auth.uid()))
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
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "attendance_sessions_department_admin_update" on public.attendance_sessions;
create policy "attendance_sessions_department_admin_update"
  on public.attendance_sessions
  for update
  to authenticated
  using (
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  )
  with check (
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "attendance_sessions_department_admin_delete" on public.attendance_sessions;
create policy "attendance_sessions_department_admin_delete"
  on public.attendance_sessions
  for delete
  to authenticated
  using (
    public.is_department_admin((select auth.uid()))
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
      public.is_department_admin((select auth.uid()))
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
    public.is_department_admin((select auth.uid()))
    and exists (
      select 1
      from public.attendance_sessions s
      where s.id = attendance_logs.session_id
        and public.can_access_department((select auth.uid()), s.department)
    )
  )
  with check (
    public.is_department_admin((select auth.uid()))
    and exists (
      select 1
      from public.attendance_sessions s
      where s.id = attendance_logs.session_id
        and public.can_access_department((select auth.uid()), s.department)
    )
  );

drop policy if exists "main_sessions_department_admin_select" on public.main_sessions;
create policy "main_sessions_department_admin_select"
  on public.main_sessions
  for select
  to authenticated
  using (
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "main_sessions_department_admin_insert" on public.main_sessions;
create policy "main_sessions_department_admin_insert"
  on public.main_sessions
  for insert
  to authenticated
  with check (
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  );

drop policy if exists "main_sessions_department_admin_update" on public.main_sessions;
create policy "main_sessions_department_admin_update"
  on public.main_sessions
  for update
  to authenticated
  using (
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  )
  with check (
    public.is_department_admin((select auth.uid()))
    and public.can_access_department((select auth.uid()), department)
  );

-- ---------------------------------------------------------------------------
-- 13) checker_profiles — department admin read for own-dept accounts
-- ---------------------------------------------------------------------------

drop policy if exists "checker_profiles_department_admin_select" on public.checker_profiles;
create policy "checker_profiles_department_admin_select"
  on public.checker_profiles
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or (
      public.is_department_admin((select auth.uid()))
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
