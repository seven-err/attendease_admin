-- Replace placeholder school code with a numeric campus/org code.

update public.schools
set
  code = '001',
  name = case
    when name in ('Default Campus', 'DEFAULT') then 'CRMC'
    else name
  end,
  updated_at = now()
where code = 'DEFAULT';
