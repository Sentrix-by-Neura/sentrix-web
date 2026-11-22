-- =============================================================================
-- Sentrix: Realistic Demo Data Seed Script
-- Run this script in your Supabase SQL Editor (https://supabase.com/dashboard)
-- 
-- Features:
-- 1. Automatically sets your role to 'ADMIN' (System Administrator).
-- 2. Seeds 3 Facilities / Groups with valid ESP-NOW Mesh IDs.
-- 3. Seeds 5 ESP32 Devices across Active, Calibrating, and Offline statuses.
-- 4. Seeds 24 hours of continuous telemetry with RMS Current and Temperature curves.
-- 5. Seeds hourly AI Prediction Bounds (safe operating envelopes).
-- 6. Seeds unresolved and resolved Alerts (Critical & Warning) matching telemetry spikes.
-- =============================================================================

DO $$
DECLARE
  target_user_id uuid;
  -- If you want to seed data for a specific account email, enter it below.
  -- If left empty (''), it will automatically target your most recently created user.
  specific_email text := ''; 
  
  -- Stable Group UUIDs
  grp_server_id  uuid := '11111111-1111-1111-1111-111111111111';
  grp_east_id    uuid := '22222222-2222-2222-2222-222222222222';
  grp_chiller_id uuid := '33333333-3333-3333-3333-333333333333';

  -- Stable Device UUIDs
  dev_crac01_id  uuid := 'aaaaaaaa-1111-1111-1111-111111111111';
  dev_crac02_id  uuid := 'aaaaaaaa-2222-2222-2222-222222222222';
  dev_split3f_id uuid := 'bbbbbbbb-1111-1111-1111-111111111111';
  dev_split4f_id uuid := 'bbbbbbbb-2222-2222-2222-222222222222';
  dev_chiller_id uuid := 'cccccccc-1111-1111-1111-111111111111';
BEGIN
  -- 1. Identify Target User
  IF specific_email <> '' THEN
    SELECT id INTO target_user_id FROM auth.users WHERE email = specific_email LIMIT 1;
    IF target_user_id IS NULL THEN
      SELECT id INTO target_user_id FROM public.users WHERE email = specific_email LIMIT 1;
    END IF;
  END IF;

  -- Fallback to the latest user created in auth or public
  IF target_user_id IS NULL THEN
    SELECT id INTO target_user_id FROM auth.users ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF target_user_id IS NULL THEN
    SELECT id INTO target_user_id FROM public.users ORDER BY created_at DESC LIMIT 1;
  END IF;

  IF target_user_id IS NULL THEN
    RAISE EXCEPTION 'No user found! Please sign up or create an account in Sentrix first.';
  END IF;

  -- 2. Upgrade user to System Administrator (ADMIN)
  UPDATE public.users
  SET role = 'ADMIN'
  WHERE id = target_user_id;

  -- 3. Seed Facility Groups
  INSERT INTO public.groups (id, user_id, name, mesh_id, description, updated_at)
  VALUES 
    (grp_server_id,  target_user_id, 'Main Server Room', 'A1B2C3D4E501', 'Precision CRAC units cooling primary server racks and UPS bank', now()),
    (grp_east_id,    target_user_id, 'East Wing AC Panel', 'A1B2C3D4E502', 'Multi-split inverter compressors serving 3rd and 4th floor workstations', now()),
    (grp_chiller_id, target_user_id, 'Chiller Plant & Pumps', 'A1B2C3D4E503', 'Central chillers and chilled water circulation pumps', now())
  ON CONFLICT (id) DO UPDATE 
    SET user_id     = EXCLUDED.user_id, 
        name        = EXCLUDED.name, 
        mesh_id     = EXCLUDED.mesh_id, 
        description = EXCLUDED.description,
        updated_at  = now();

  -- 4. Seed Devices
  INSERT INTO public.devices (
    id, mac_address, pin_code, name, group_id, status, 
    calibration_started_at, calibration_ends_at, last_seen, 
    firmware_version, local_ip, wifi_rssi, node_role, updated_at
  )
  VALUES
    (
      dev_crac01_id, '246F28A13C01', '482913', 'CRAC Compressor 01 · Primary', grp_server_id, 'ACTIVE',
      now() - interval '30 days', now() - interval '23 days', now() - interval '20 seconds',
      'v1.2.4', '192.168.10.141', -54, 'ROOT', now()
    ),
    (
      dev_crac02_id, '246F28A13C02', '715204', 'CRAC Compressor 02 · Backup', grp_server_id, 'CALIBRATING',
      now() - interval '2 days', now() + interval '5 days', now() - interval '45 seconds',
      'v1.2.4', '192.168.10.142', -62, 'NODE', now()
    ),
    (
      dev_split3f_id, '246F28B7910A', '390671', 'Split AC 3F-East · MCB', grp_east_id, 'ACTIVE',
      now() - interval '20 days', now() - interval '13 days', now() - interval '15 seconds',
      'v1.2.4', '192.168.20.55', -48, 'ROOT', now()
    ),
    (
      dev_split4f_id, '246F28B7910B', '604158', 'Split AC 4F-East · MCB', grp_east_id, 'OFFLINE',
      now() - interval '20 days', now() - interval '13 days', now() - interval '4 hours',
      'v1.2.3', '192.168.20.56', -85, 'NODE', now()
    ),
    (
      dev_chiller_id, '246F28C38801', '829105', 'Centrifugal Chiller Pump #1', grp_chiller_id, 'ACTIVE',
      now() - interval '15 days', now() - interval '8 days', now() - interval '35 seconds',
      'v1.2.4', '192.168.30.12', -58, 'ROOT', now()
    )
  ON CONFLICT (id) DO UPDATE
    SET name                   = EXCLUDED.name, 
        group_id               = EXCLUDED.group_id, 
        status                 = EXCLUDED.status,
        last_seen              = EXCLUDED.last_seen,
        calibration_started_at = EXCLUDED.calibration_started_at,
        calibration_ends_at    = EXCLUDED.calibration_ends_at,
        firmware_version       = EXCLUDED.firmware_version,
        local_ip               = EXCLUDED.local_ip,
        wifi_rssi              = EXCLUDED.wifi_rssi,
        node_role              = EXCLUDED.node_role,
        updated_at             = now();

  -- 5. Seed Prediction Bounds (Safe Operating Zones)
  DELETE FROM public.prediction_bounds 
  WHERE device_id IN (dev_crac01_id, dev_split3f_id, dev_chiller_id);

  -- Hourly bounds for past 24 hours + next 12 hours
  INSERT INTO public.prediction_bounds (device_id, "timestamp", lower_bound, upper_bound)
  SELECT 
    dev_crac01_id,
    date_trunc('hour', now() - (h || ' hours')::interval),
    11.5 + sin(h::double precision / 4.0) * 0.8,
    17.0 + sin(h::double precision / 4.0) * 0.8
  FROM generate_series(-12, 24) AS h
  ON CONFLICT (device_id, "timestamp") DO UPDATE
    SET lower_bound = EXCLUDED.lower_bound, upper_bound = EXCLUDED.upper_bound;

  INSERT INTO public.prediction_bounds (device_id, "timestamp", lower_bound, upper_bound)
  SELECT 
    dev_split3f_id,
    date_trunc('hour', now() - (h || ' hours')::interval),
    8.0 + cos(h::double precision / 5.0) * 0.6,
    14.5 + cos(h::double precision / 5.0) * 0.6
  FROM generate_series(-12, 24) AS h
  ON CONFLICT (device_id, "timestamp") DO UPDATE
    SET lower_bound = EXCLUDED.lower_bound, upper_bound = EXCLUDED.upper_bound;

  INSERT INTO public.prediction_bounds (device_id, "timestamp", lower_bound, upper_bound)
  SELECT 
    dev_chiller_id,
    date_trunc('hour', now() - (h || ' hours')::interval),
    15.0 + sin(h::double precision / 6.0) * 1.0,
    22.0 + sin(h::double precision / 6.0) * 1.0
  FROM generate_series(-12, 24) AS h
  ON CONFLICT (device_id, "timestamp") DO UPDATE
    SET lower_bound = EXCLUDED.lower_bound, upper_bound = EXCLUDED.upper_bound;

  -- 6. Seed Telemetry (Data points every 3 minutes across 24h = 480 rows)
  DELETE FROM public.telemetry 
  WHERE device_id IN (dev_crac01_id, dev_split3f_id, dev_chiller_id);

  -- CRAC 01: with high spike 2 hours ago
  INSERT INTO public.telemetry (device_id, "timestamp", rms_current, current_temperature, target_temperature)
  SELECT 
    dev_crac01_id,
    now() - (m || ' minutes')::interval,
    CASE 
      WHEN m BETWEEN 110 AND 130 THEN 22.8 + sin(m::double precision) * 0.4
      ELSE 14.2 + sin(m::double precision / 35.0) * 1.8 + cos(m::double precision / 12.0) * 0.5
    END,
    CASE 
      WHEN m BETWEEN 110 AND 130 THEN 27.5
      ELSE 23.2 + sin(m::double precision / 50.0) * 0.8
    END,
    22.0
  FROM generate_series(0, 1440, 3) AS m
  ON CONFLICT (device_id, "timestamp") DO NOTHING;

  -- Split AC 3F: with spike 7 hours ago
  INSERT INTO public.telemetry (device_id, "timestamp", rms_current, current_temperature, target_temperature)
  SELECT 
    dev_split3f_id,
    now() - (m || ' minutes')::interval,
    CASE 
      WHEN m BETWEEN 400 AND 430 THEN 18.2 + cos(m::double precision) * 0.3
      ELSE 10.5 + sin(m::double precision / 40.0) * 1.5 + cos(m::double precision / 15.0) * 0.4
    END,
    24.0 + sin(m::double precision / 60.0) * 1.1,
    23.0
  FROM generate_series(0, 1440, 3) AS m
  ON CONFLICT (device_id, "timestamp") DO NOTHING;

  -- Chiller: smooth load profile
  INSERT INTO public.telemetry (device_id, "timestamp", rms_current, current_temperature, target_temperature)
  SELECT 
    dev_chiller_id,
    now() - (m || ' minutes')::interval,
    18.5 + sin(m::double precision / 30.0) * 1.9 + cos(m::double precision / 10.0) * 0.6,
    19.0 + sin(m::double precision / 45.0) * 0.7,
    18.0
  FROM generate_series(0, 1440, 3) AS m
  ON CONFLICT (device_id, "timestamp") DO NOTHING;

  -- 7. Seed Varied Demo Alerts (across all groups, date windows, and workflow states)
  DELETE FROM public.alerts 
  WHERE device_id IN (dev_crac01_id, dev_crac02_id, dev_split3f_id, dev_split4f_id, dev_chiller_id);

  INSERT INTO public.alerts (
    id, device_id, "timestamp", actual_value, expected_max, expected_min, 
    severity, is_resolved, user_feedback, created_at, updated_at
  )
  VALUES
    -- 1. Critical Unresolved, no feedback yet (35 mins ago · Main Server Room)
    (
      gen_random_uuid(), dev_crac01_id, now() - interval '35 minutes',
      23.4, 17.0, 11.5, 'CRITICAL', false, null, now() - interval '35 minutes', now() - interval '35 minutes'
    ),
    -- 2. Critical Unresolved, no feedback yet (2 hours ago · matches CRAC 01 spike)
    (
      gen_random_uuid(), dev_crac01_id, now() - interval '2 hours',
      22.8, 17.0, 11.5, 'CRITICAL', false, null, now() - interval '2 hours', now() - interval '2 hours'
    ),
    -- 3. Warning Unresolved, no feedback yet (7 hours ago · East Wing Split AC 3F)
    (
      gen_random_uuid(), dev_split3f_id, now() - interval '7 hours',
      18.2, 14.5, 8.0, 'WARNING', false, null, now() - interval '7 hours', now() - interval '7 hours'
    ),
    -- 4. Warning Unresolved, already marked Valid Issue (14 hours ago · Chiller Plant)
    (
      gen_random_uuid(), dev_chiller_id, now() - interval '14 hours',
      24.6, 22.0, 15.0, 'WARNING', false, true, now() - interval '14 hours', now() - interval '12 hours'
    ),
    -- 5. Warning Unresolved, drop below safe range (2 days ago · East Wing Split AC 4F)
    (
      gen_random_uuid(), dev_split4f_id, now() - interval '2 days',
      4.1, 14.5, 8.0, 'WARNING', false, null, now() - interval '2 days', now() - interval '2 days'
    ),
    -- 6. Resolved Alert from 1 day ago (confirmed Valid Issue · East Wing Split AC 3F)
    (
      gen_random_uuid(), dev_split3f_id, now() - interval '26 hours',
      6.2, 14.5, 8.0, 'WARNING', true, true, now() - interval '26 hours', now() - interval '20 hours'
    ),
    -- 7. Resolved Alert from 3 days ago (False Alarm · Chiller Plant)
    (
      gen_random_uuid(), dev_chiller_id, now() - interval '3 days',
      23.4, 22.0, 15.0, 'WARNING', true, false, now() - interval '3 days', now() - interval '2 days'
    ),
    -- 8. Older Resolved Alert from 10 days ago (outside 7d filter · Main Server Room)
    (
      gen_random_uuid(), dev_crac01_id, now() - interval '10 days',
      20.9, 17.0, 11.5, 'CRITICAL', true, true, now() - interval '10 days', now() - interval '9 days'
    );

  RAISE NOTICE '>>> Fake demo data seeded successfully for User: %! Role updated to ADMIN.', target_user_id;
END $$;
