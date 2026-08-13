-- Align handle_new_user with portal roles. Auth signup still creates the
-- public.users stub; admin create flows must upsert (not insert) afterward.

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_role text;
  v_department text;
begin
  v_role := lower(coalesce(new.raw_user_meta_data ->> 'role', ''));
  if v_role not in ('admin', 'department_admin', 'attendance_checker') then
    v_role := 'attendance_checker';
  end if;

  v_department := nullif(trim(coalesce(new.raw_user_meta_data ->> 'department', '')), '');

  -- department_admin requires a department (table check constraint).
  if v_role = 'department_admin' and v_department is null then
    v_role := 'attendance_checker';
  end if;

  insert into public.users (id, full_name, email, role, status, department)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'full_name',
      split_part(new.email, '@', 1),
      'Unnamed User'
    ),
    lower(new.email),
    v_role,
    'active',
    case
      when v_role in ('department_admin', 'attendance_checker') then v_department
      else null
    end
  )
  on conflict (id) do update
  set
    full_name = excluded.full_name,
    email = excluded.email,
    role = excluded.role,
    department = excluded.department,
    updated_at = now();

  return new;
end;
$function$;
