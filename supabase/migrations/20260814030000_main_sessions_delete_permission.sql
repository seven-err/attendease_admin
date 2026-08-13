-- Allow sessions.delete to soft-trash main sessions (status = Trashed).
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
      or public.has_permission((select auth.uid()), 'sessions.delete')
    )
  )
  with check (
    public.can_access_department((select auth.uid()), department)
    and (
      public.has_permission((select auth.uid()), 'sessions.edit')
      or public.has_permission((select auth.uid()), 'sessions.archive')
      or public.has_permission((select auth.uid()), 'sessions.delete')
    )
  );
