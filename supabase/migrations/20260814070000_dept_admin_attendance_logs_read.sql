-- Department admins with sessions.view / attendance.export must be able to
-- read attendance_logs for View Details and bulk export (same data super
-- admins see, still scoped by can_access_department).

drop policy if exists "attendance_logs_admin_all_checker_own_sessions" on public.attendance_logs;
create policy "attendance_logs_admin_all_checker_own_sessions"
  on public.attendance_logs
  for select
  to authenticated
  using (
    public.is_admin((select auth.uid()))
    or (
      (
        public.has_permission((select auth.uid()), 'attendance.view')
        or public.has_permission((select auth.uid()), 'attendance.export')
        or public.has_permission((select auth.uid()), 'sessions.view')
      )
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
          and (
            s.assigned_checker_id is null
            or s.assigned_checker_id = (select auth.uid())
          )
      )
    )
  );

-- Ensure department admins who already export/view sessions can also use
-- attendance.view for roster UI (matches updated default grants).
insert into public.department_admin_permissions (user_id, permission_key)
select distinct u.id, 'attendance.view'
from public.users u
where u.role = 'department_admin'
  and (
    exists (
      select 1
      from public.department_admin_permissions p
      where p.user_id = u.id
        and p.permission_key in ('attendance.export', 'sessions.view')
    )
  )
  and not exists (
    select 1
    from public.department_admin_permissions p
    where p.user_id = u.id
      and p.permission_key = 'attendance.view'
  );
