BEGIN;

ALTER TABLE public.devices
  ADD COLUMN mqtt_connection_id text,
  ADD COLUMN mqtt_connected boolean,
  ADD CONSTRAINT devices_mqtt_connection_presence_check CHECK (
    (mqtt_connection_id IS NULL AND mqtt_connected IS NULL)
    OR (mqtt_connection_id IS NOT NULL AND mqtt_connection_id ~ '^[0-9a-f]{32}$' AND mqtt_connected IS NOT NULL)
  );

COMMIT;
