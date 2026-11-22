-- Optional per-unit AC naming and room location photo metadata for service calls.
ALTER TABLE public.devices
  ADD COLUMN IF NOT EXISTS unit_name text,
  ADD COLUMN IF NOT EXISTS room_location text,
  ADD COLUMN IF NOT EXISTS location_photo_url text;
