-- DEV ONLY: a fake unclaimed device for testing with mosquitto_pub / MQTTX
-- (architecture guide, section 13). Never run this against production.
-- Registration also works without this row, after a device confirms setup.
insert into devices (mac_address)
values ('AABBCCDDEEFF')
on conflict (mac_address) where archived_at is null do nothing;
