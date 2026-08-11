-- Allow schools to carry optional descriptions (parity with departments).

alter table public.schools
  add column if not exists description text;
