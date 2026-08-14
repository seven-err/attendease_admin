-- BEFORE INSERT triggers receive explicit NULLs for omitted columns, which
-- prevents column defaults (now()) from applying on the students row.

create or replace function public.ensure_people_row_for_student()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
begin
  if new.id is null then
    new.id := gen_random_uuid();
  end if;

  if new.qr_token is null or btrim(new.qr_token) = '' then
    new.qr_token := encode(gen_random_bytes(32), 'hex');
  end if;

  if new.created_at is null then
    new.created_at := now();
  end if;

  if new.updated_at is null then
    new.updated_at := now();
  end if;

  insert into public.people (
    id,
    person_number,
    full_name,
    qr_token,
    person_status,
    person_kind,
    created_at,
    updated_at
  )
  values (
    new.id,
    new.student_number,
    new.full_name,
    new.qr_token,
    new.student_status,
    'student',
    new.created_at,
    new.updated_at
  )
  on conflict (id) do update
  set
    person_number = excluded.person_number,
    full_name = excluded.full_name,
    qr_token = excluded.qr_token,
    person_status = excluded.person_status,
    updated_at = now()
  where public.people.person_kind = 'student';

  return new;
end;
$$;
