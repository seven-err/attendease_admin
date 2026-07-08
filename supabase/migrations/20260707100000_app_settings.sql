create table if not exists public.app_settings (
  key text primary key,
  value text not null default '',
  updated_at timestamptz not null default now()
);

alter table public.app_settings enable row level security;

drop policy if exists "Admins manage app settings" on public.app_settings;

create policy "Admins manage app settings"
  on public.app_settings
  for all
  to authenticated
  using (
    exists (
      select 1
      from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
        and users.status = 'active'
    )
  )
  with check (
    exists (
      select 1
      from public.users
      where users.id = auth.uid()
        and users.role = 'admin'
        and users.status = 'active'
    )
  );

insert into public.app_settings (key, value)
values
  ('institution_name', 'AttendEase'),
  ('academic_year', ''),
  ('qr_sheet_url', '')
on conflict (key) do nothing;
