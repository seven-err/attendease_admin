-- Grant bulk attendance export to existing department admins.
-- Additive only; does not remove or replace other grants.
insert into public.department_admin_permissions (user_id, permission_key)
select u.id, 'attendance.export'
from public.users u
where u.role = 'department_admin'
  and u.status = 'active'
on conflict do nothing;
