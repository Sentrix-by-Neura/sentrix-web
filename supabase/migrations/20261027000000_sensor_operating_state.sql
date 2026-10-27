BEGIN;

-- These two columns were required by ingest but missing from historical migrations.
ALTER TABLE public.telemetry
  ADD COLUMN IF NOT EXISTS current_temperature double precision,
  ADD COLUMN IF NOT EXISTS target_temperature double precision;

ALTER TABLE public.telemetry
  ADD COLUMN remote_power_on boolean,
  ADD COLUMN remote_power_observed_at timestamptz,
  ADD COLUMN load_active boolean,
  ADD CONSTRAINT telemetry_remote_power_observation_check CHECK (
    (remote_power_on IS NULL AND remote_power_observed_at IS NULL)
    OR (remote_power_on IS NOT NULL AND remote_power_observed_at IS NOT NULL
        AND isfinite(remote_power_observed_at)
        AND remote_power_observed_at > TIMESTAMPTZ '1970-01-01'
        AND remote_power_observed_at <= "timestamp")
  );

COMMIT;
