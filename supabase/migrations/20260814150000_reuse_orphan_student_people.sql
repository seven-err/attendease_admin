-- Reuse orphaned student people rows (failed imports left people without students)
-- and avoid duplicate person_number collisions on retry.

create or replace function public.ensure_people_row_for_student()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_existing_id uuid;
begin
  if new.qr_token is null or btrim(new.qr_token) = '' then
    new.qr_token := encode(gen_random_bytes(32), 'hex');
  end if;

  if new.created_at is null then
    new.created_at := now();
  end if;

  if new.updated_at is null then
    new.updated_at := now();
  end if;

  select p.id
  into v_existing_id
  from public.people p
  where p.person_number = new.student_number
    and p.person_kind = 'student'
  limit 1;

  if v_existing_id is not null then
    if exists (select 1 from public.students s where s.id = v_existing_id) then
      raise exception 'student number % already exists', new.student_number
        using errcode = '23505';
    end if;

    new.id := v_existing_id;

    update public.people
    set
      full_name = new.full_name,
      qr_token = new.qr_token,
      person_status = new.student_status,
      updated_at = now()
    where id = v_existing_id;

    return new;
  end if;

  if new.id is null then
    new.id := gen_random_uuid();
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
