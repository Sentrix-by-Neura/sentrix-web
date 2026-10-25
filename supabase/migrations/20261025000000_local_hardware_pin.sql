-- Hardware PINs authenticate local encrypted BLE only. This intentionally removes
-- prior PIN values, while retaining device IDs, ownership and monitoring history.
alter table public.devices drop column pin_code;
alter table public.devices add column archived_at timestamptz;
alter table public.devices drop constraint devices_mac_address_key;
create unique index devices_active_mac_idx on public.devices(mac_address)
  where archived_at is null;

create table public.device_setup_claims (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  mac_address text not null check (mac_address ~ '^[0-9A-F]{12}$'),
  name text check (char_length(name) <= 100),
  token_hash bytea not null check (octet_length(token_hash) = 32),
  expires_at timestamptz not null,
  confirmed_at timestamptz,
  device_id uuid references public.devices(id) on delete cascade,
  unique (mac_address, group_id),
  check ((confirmed_at is null) = (device_id is null))
);
create index device_setup_claims_user_expiry_idx
  on public.device_setup_claims(user_id, expires_at);
alter table public.device_setup_claims enable row level security;
-- Go uses its privileged DB connection. Browser roles receive no access, even
-- where a project's default privileges grant newly created public tables.
revoke all on public.device_setup_claims from public, anon, authenticated;

-- Historical ownership sessions are read-only. Row locks make late ML/ingest
-- writes finish before archival or fail after it, never mutate the saved history.
create function public.guard_archived_device_history() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
declare
  old_device uuid;
  new_device uuid;
begin
  if TG_OP <> 'INSERT' then old_device := OLD.device_id; end if;
  if TG_OP <> 'DELETE' then new_device := NEW.device_id; end if;
  perform id from public.devices where id in (old_device, new_device)
    order by id for share;
  if exists (select 1 from public.devices
      where id in (old_device, new_device) and archived_at is not null) then
    raise exception 'archived device history is read-only' using errcode = '55000';
  end if;
  if TG_OP = 'DELETE' then return OLD; end if;
  return NEW;
end $$;
create trigger telemetry_archive_guard before insert or update or delete on public.telemetry
  for each row execute function public.guard_archived_device_history();
create trigger prediction_bounds_archive_guard before insert or update or delete on public.prediction_bounds
  for each row execute function public.guard_archived_device_history();
create trigger alerts_archive_guard before insert or update or delete on public.alerts
  for each row execute function public.guard_archived_device_history();

create function public.guard_archived_device() returns trigger
language plpgsql set search_path = pg_catalog, public as $$
begin
  if OLD.archived_at is not null then
    raise exception 'archived device is read-only' using errcode = '55000';
  end if;
  return NEW;
end $$;
create trigger devices_archive_guard before update on public.devices
  for each row execute function public.guard_archived_device();
