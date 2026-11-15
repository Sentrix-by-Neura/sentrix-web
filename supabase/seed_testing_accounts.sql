-- Sentrix testing accounts for a Supabase test project.
-- Run the entire file in SQL Editor. Copy the passwords from the result grid.
BEGIN;

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;
SET LOCAL search_path = extensions, public;

CREATE TEMP TABLE sentrix_test_accounts ON COMMIT DROP AS
SELECT
  account_number,
  gen_random_uuid() AS user_id,
  'sentrix.test' || lpad(account_number::text, 2, '0') || '@example.com' AS email,
  'Sentrix Tester ' || lpad(account_number::text, 2, '0') AS full_name,
  'Stx!' || replace(gen_random_uuid()::text, '-', '') AS password
FROM generate_series(1, 10) AS accounts(account_number);

DO $$
DECLARE
  existing_email text;
BEGIN
  SELECT account.email INTO existing_email
  FROM pg_temp.sentrix_test_accounts AS account
  JOIN auth.users AS existing ON lower(existing.email) = account.email
  LIMIT 1;

  IF existing_email IS NOT NULL THEN
    RAISE EXCEPTION 'Seed cancelled because % already exists', existing_email;
  END IF;
END
$$;

-- The existing Sentrix auth trigger creates the corresponding public.users rows.
INSERT INTO auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  confirmation_token, recovery_token, email_change, email_change_token_new,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000', user_id, 'authenticated', 'authenticated',
  email, crypt(password, gen_salt('bf', 10)), now(),
  '', '', '', '', '', '', '', '',
  '{"provider":"email","providers":["email"]}'::jsonb,
  jsonb_build_object('full_name', full_name, 'name', full_name, 'email_verified', true),
  now(), now()
FROM pg_temp.sentrix_test_accounts;

INSERT INTO auth.identities (
  provider_id, user_id, identity_data, provider, created_at, updated_at
)
SELECT user_id::text, user_id,
  jsonb_build_object(
    'sub', user_id::text, 'email', email, 'email_verified', true, 'phone_verified', false
  ),
  'email', now(), now()
FROM pg_temp.sentrix_test_accounts;

WITH room_sets (set_number, room_names) AS (
  VALUES
    (0, ARRAY['Room A', 'Room B', 'Room C', 'Room D']),
    (1, ARRAY['Room 1', 'Room 2', 'Room 3', 'Room 4']),
    (2, ARRAY['Teacher Room', 'Studio Room', 'Computer Lab', 'Science Lab']),
    (3, ARRAY['Meeting Room', 'Training Room', 'Reception', 'Break Room']),
    (4, ARRAY['Reading Room', 'Art Studio', 'Workshop', 'Music Room'])
)
INSERT INTO public.groups (user_id, name, mesh_id, created_at)
SELECT
  account.user_id,
  room.name,
  upper(left(replace(gen_random_uuid()::text, '-', ''), 12)),
  now() - (5 - room.position) * interval '1 second'
FROM pg_temp.sentrix_test_accounts AS account
JOIN room_sets ON room_sets.set_number = (account.account_number - 1) % 5
CROSS JOIN LATERAL unnest(room_sets.room_names) WITH ORDINALITY AS room(name, position);

WITH group_sizes AS MATERIALIZED (
  SELECT g.id, 3 + floor(random() * 3)::integer AS sensor_count
  FROM public.groups AS g
  JOIN pg_temp.sentrix_test_accounts AS account ON account.user_id = g.user_id
)
INSERT INTO public.devices (group_id, mac_address, name, status, created_at)
SELECT
  g.id,
  '02' || upper(left(replace(gen_random_uuid()::text, '-', ''), 10)),
  'Current Sensor ' || sensor.position,
  'OFFLINE',
  now() - (6 - sensor.position) * interval '1 second'
FROM group_sizes AS g
CROSS JOIN LATERAL generate_series(1, g.sensor_count) AS sensor(position);

-- Dense sampling in the latest hour keeps the chart's one-hour line connected.
-- Older samples match the dashboard's five- and fifteen-minute buckets.
WITH sample_offsets AS (
  SELECT generate_series(0, 59) AS minutes_ago
  UNION ALL SELECT generate_series(60, 1435, 5)
  UNION ALL SELECT generate_series(1440, 10080, 15)
), sensor_profiles AS MATERIALIZED (
  SELECT
    d.id,
    0.12 + random() * 0.55 AS idle_amps,
    1.8 + random() * 8.0 AS typical_load,
    random() * 2 * pi() AS phase
  FROM public.devices AS d
  JOIN public.groups AS g ON g.id = d.group_id
  JOIN pg_temp.sentrix_test_accounts AS account ON account.user_id = g.user_id
)
INSERT INTO public.telemetry (device_id, "timestamp", rms_current)
SELECT
  sensor.id,
  date_trunc('minute', now()) - sample.minutes_ago * interval '1 minute',
  round((
    sensor.idle_amps + random() * 0.18
    + sensor.typical_load
      * (0.1 + 0.9 * greatest(0, sin(2 * pi() * sample.minutes_ago / 1440 + sensor.phase)))
      * (0.85 + 0.15 * sin(2 * pi() * sample.minutes_ago / 120 + sensor.phase))
    + CASE WHEN random() < 0.015 THEN 1.5 + random() * 2.5 ELSE 0 END
  )::numeric, 2)
FROM sensor_profiles AS sensor
CROSS JOIN sample_offsets AS sample;

CREATE TEMP TABLE sentrix_test_results AS
WITH group_totals AS (
  SELECT
    g.user_id,
    g.id,
    count(d.id) AS sensors,
    coalesce(sum(history.readings), 0)::bigint AS readings,
    min(history.readings) AS fewest_readings_per_sensor
  FROM pg_temp.sentrix_test_accounts AS account
  JOIN public.groups AS g ON g.user_id = account.user_id
  LEFT JOIN public.devices AS d ON d.group_id = g.id
  LEFT JOIN LATERAL (
    SELECT count(*) AS readings FROM public.telemetry AS t WHERE t.device_id = d.id
  ) AS history ON true
  GROUP BY g.user_id, g.id
)
SELECT
  account.email,
  account.password,
  count(g.id) AS groups,
  coalesce(sum(g.sensors), 0)::integer AS sensors,
  coalesce(sum(g.readings), 0)::bigint AS rms_readings,
  min(g.sensors) AS fewest_sensors_per_group,
  max(g.sensors) AS most_sensors_per_group,
  min(g.fewest_readings_per_sensor) AS fewest_readings_per_sensor
FROM pg_temp.sentrix_test_accounts AS account
JOIN auth.identities AS identity
  ON identity.user_id = account.user_id AND identity.provider = 'email'
LEFT JOIN group_totals AS g ON g.user_id = account.user_id
GROUP BY account.email, account.password;

DO $$
BEGIN
  IF (SELECT count(*) FROM pg_temp.sentrix_test_results) <> 10 OR EXISTS (
    SELECT 1
    FROM pg_temp.sentrix_test_results
    WHERE groups <> 4
      OR fewest_sensors_per_group < 3
      OR most_sensors_per_group > 5
      OR fewest_readings_per_sensor <> 913
      OR rms_readings <> sensors * 913
  ) THEN
    RAISE EXCEPTION 'Seed verification failed';
  END IF;
END
$$;

COMMIT;

-- Show the committed results and clear the temporary plaintext password rows.
WITH credentials AS (
  DELETE FROM pg_temp.sentrix_test_results
  RETURNING email, password, groups, sensors, rms_readings
)
SELECT email, password, groups, sensors, rms_readings
FROM credentials
ORDER BY email;
