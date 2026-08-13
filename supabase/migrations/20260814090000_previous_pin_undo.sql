-- Store previous hashed PIN so admins can undo a reset within a time window.
-- Plaintext PINs are never stored; only hash/salt snapshots.

alter table public.checker_profiles
  add column if not exists previous_pin_hash text,
  add column if not exists previous_pin_salt text,
  add column if not exists previous_pin_updated_at timestamptz,
  add column if not exists pin_reset_at timestamptz;

comment on column public.checker_profiles.previous_pin_hash is
  'Hashed PIN before the most recent admin reset; cleared after restore or next overwrite.';
comment on column public.checker_profiles.previous_pin_salt is
  'Salt for previous_pin_hash; cleared with previous_pin_hash.';
comment on column public.checker_profiles.previous_pin_updated_at is
  'pin_updated_at value captured at reset time.';
comment on column public.checker_profiles.pin_reset_at is
  'When the current PIN was set via admin reset; used for undo TTL.';
