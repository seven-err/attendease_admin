-- Department admins may only see/manage checkers in their own department.
-- Remove campus-wide SSG visibility that previously leaked into their lists.

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
      and checker_scope = 'department'
      and public.can_access_department((select auth.uid()), department)
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
          and u.checker_scope = 'department'
          and public.can_access_department((select auth.uid()), u.department)
      )
    )
  );
