-- student_academic_records was missing now() defaults on timestamp columns.

alter table public.student_academic_records
  alter column created_at set default now();

alter table public.student_academic_records
  alter column updated_at set default now();

update public.student_academic_records
set
  created_at = coalesce(created_at, now()),
  updated_at = coalesce(updated_at, now())
where created_at is null
   or updated_at is null;
