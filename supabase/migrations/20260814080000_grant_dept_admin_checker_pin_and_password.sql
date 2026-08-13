-- Department admins: manage own-dept checkers (profile + PIN) by default.
-- Additive grants; harden insert/update so SSG/Employee checkers stay campus-wide.

insert into public.department_admin_permissions (user_id, permission_key)
select u.id, k.key
from public.users u
cross join (
  values
    ('checkers.manage'),
    ('checkers.pin_manage')
) as k(key)
where u.role = 'department_admin'
  and u.status = 'active'
on conflict do nothing;

-- Ensure insert/update cannot promote a checker to campus-wide SSG/Employee.
drop policy if exists "users_department_admin_insert" on public.users;
create policy "users_department_admin_insert"
  on public.users
  for insert
  to authenticated
  with check (
    public.has_permission((select auth.uid()), 'checkers.manage')
    and role = 'attendance_checker'
    and checker_scope = 'department'
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
    and checker_scope = 'department'
    and public.can_access_department((select auth.uid()), department)
  )
  with check (
    public.has_permission((select auth.uid()), 'checkers.manage')
    and role = 'attendance_checker'
    and checker_scope = 'department'
    and public.can_access_department((select auth.uid()), department)
  );
