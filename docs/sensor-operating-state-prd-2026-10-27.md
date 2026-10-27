# Record room temperature and show AC operating information

Status: proposed; Felix selected both remote power information and measured current activity, then added a physical room-temperature sensor on 2026-10-27. Sensor model/wiring and implementation approval pending.

## 1. Problem

The sensor detail screen uses a metric card for Backend contact / Recent / Go service. Felix wants that space to show the latest target temperature and whether the AC is on or off, and also wants an additional physical room-temperature sensor whose readings are recorded in the database.

The current firmware sends valid `target_temperature` values in its sixty-second MQTT batch after decoding a supported remote setpoint. It does not measure room temperature. It also calculates a current-based `active` flag locally, but does not publish it. Go stores target temperature, while the HTTP chart response returns only RMS current and timestamps; the frontend cannot display target temperature from that response today.

Go already parses optional `current_temperature` and writes it to telemetry. Reuse this field for actual measured room temperature. The checked-in initial schema lacks both temperature columns and the historical migration cited by existing docs is absent; new schema work must include the missing nullable column prerequisites safely for both existing and fresh databases.

## 2. Success criteria

- Replace the Backend contact metric with readable target temperature and AC state, keeping the current sensor-detail visual style. Preserve RMS current, expected bounds, chart and the main availability/calibration badge.
- Temperature means the last valid target setpoint heard from the remote, displayed in Celsius. Missing/unsupported IR data shows Unknown or a dash, never zero, NaN or fabricated room temperature. It is not proof that the appliance received the command.
- Keep two distinct temperatures: **Room temperature** from the added physical sensor as `current_temperature`, and **Target temperature** from the IR setpoint as `target_temperature`. Record valid room measurements in Celsius with their telemetry timestamp and the existing device identity. Do not mix, overwrite or infer one from the other.
- Read the selected room sensor at its supported cadence outside the CT acquisition window; publish a fresh valid value in the existing sixty-second batch. Sensor disconnection, failed checksums, nonfinite/out-of-range data or an expired cached sample must not become zero or a silently repeated fresh reading. Omit invalid optional room temperature so its stored value is NULL, while valid current telemetry continues.
- Return room temperature through the authenticated latest-state read and show its latest recorded value with the other operating information. Existing chart transport and RMS chart stay unchanged; a new temperature history chart is not part of this request.
- Display both **Last remote power command** (On / Off / Unknown) and **Measured current activity** (Active / Low or standby / Unknown). Keep them separate; current activity does not conclusively establish the appliance's logical power setting or why a compressor has cycled off. Do not label low current alone as confirmed AC Off.
- Publish the valid current-based state from firmware rather than inferring hysteresis from averaged chart points. Current thresholds currently switch active at >=0.25 A and inactive at <=0.15 A, retaining the prior state between them; they need validation against the real installation before treating the result as authoritative. Start Unknown until a valid sample establishes a threshold state; an invalid measurement cannot establish a new state.
- Remote power starts Unknown until an explicit supported absolute power command is decoded. Partial/temperature-only/toggle commands must not invent an absolute state or reset it from decoder defaults. A reboot without a new usable command must not imply Off. Preserve the observation time of the last explicit remote command separately from the latest measurement time, so repeated telemetry does not imply a newly heard command.
- Expose a latest raw sample and its timestamp through authenticated Go API access. Do not use time-bucketed chart averages to represent the current appliance state. Preserve account/ownership and archived-history isolation.
- Reuse fifteen-second visible-page polling for the displayed snapshot. Firmware batches remain sixty seconds apart: values are latest received, not instantaneous; normal batching plus polling can add about seventy-five seconds of delay, excluding outages and network latency. Show an update age or last-reported context.
- A disconnected sensor or stale measurement must not be shown as Off. Retain existing availability precedence and distinguish Unknown, Unavailable and the last reported historical values. A recent handshake alone does not make an old measurement fresh. Archived devices show last-recorded information, not live operating state.

## 3. Scope

Firmware: initialize and read the chosen physical room sensor on confirmed unused GPIO(s), add valid room readings as `current_temperature`, and add optional `remote_power_on` and `load_active` values to the existing batch reading, with known-state/validity checks, plus the observation time of the last explicit power command. Decode only explicit supported power information. Keep existing TLS, provisioning, PIN, retry and ACK behavior.

Go/database: validate and store the optional remote-power/current-activity fields and remote observation time using additive nullable telemetry columns; reuse `current_temperature` and `target_temperature`, providing the missing schema prerequisites without overwriting existing columns/data. Add an authenticated latest-state read using the latest raw telemetry record and current ownership rules, exposing both temperatures. Keep old firmware compatible with unknown AC state and room temperature. Update wire fixtures and relevant store/HTTP tests.

Frontend: map the latest-state response, poll while visible, and replace the Backend contact card with target setpoint/AC state, include room temperature, and preserve honest unknown/stale/update-age behavior. Reuse surrounding layout and styles; avoid a general dashboard redesign.

Out of scope: changing chart transport to WebSockets, increasing MQTT publication frequency, adding a temperature history chart, remote AC control, ML/calibration changes, retuning sensor thresholds without hardware measurements, changing ownership rules, live migrations/deployment or flashing hardware. The existing batch requires a valid current reading; independent temperature-only telemetry during a CT sensor fault would require a separate schema/ingest decision and is not silently introduced here.

## 4. Constraints

Use existing dependencies and pinned ESP32 toolchain. Add only the selected sensor's required driver dependency if an existing library or supported platform API cannot handle it. Confirm sensor voltage, bus, pull-up requirements and model-specific conversion timing from its manufacturer documentation before implementing; do not guess wiring. Read the installed Next.js guides before implementation and follow existing app-screen styling. Keep the sixty-second MQTT batch and fifteen-second device refresh policy; any different latency requirement needs an explicit scope change.

GPIO 34 is used for the CT sensor, 35 for IR, 4/2 for indicator LEDs, 0 for BOOT, and 25/26/27 are reserved for the optional RGB indicator. Do not silently reuse any of those pins for the new room sensor. Do not block CT sampling while waiting for a sensor conversion.

Optional fields must remain backward compatible. Unknown must remain distinct from boolean false. Parse bounded, correctly typed MQTT values, and never send hardware PINs, secrets or synthetic state. Preserve telemetry timestamps and historical records. Use the existing device/timestamp index for latest-raw lookup and enforce access before returning readings.

Browser control was disabled in Work settings during preceding checks. Recheck access for visual verification and report any remaining limitation. Physical IR/current interpretation cannot be verified by a software build.

## 5. Plan

1. Confirm the room sensor model and wiring, inspect its manufacturer timing/electrical documentation, then obtain sign-off on the combined scope. Preserve Felix's selected separate observations: last remote power command and measured current activity.
2. Add focused tests for room-sensor valid/invalid/stale values and failure isolation, both AC states' validity/unknowns, optional-field compatibility, typed MQTT parsing, latest raw temperature/state lookup, ownership/archive access and stale-sample handling. Cover valid target/power commands, partial/unsupported/toggle IR commands, no IR since boot, invalid current samples and hysteresis transitions.
3. Prepare the minimal additive migration (including missing temperature-column prerequisites) and Go ingest/latest-state response, then implement the matching firmware fields and room sensor read without changing unrelated constants or behavior. Document deployment order, hardware wiring and legacy fallback.
4. Replace the detail card using the existing UI components/styles and freshness policy. Include last-update context and distinct unknown/unavailable states. Update component fixtures and tests.
5. Run firmware host tests/build, Go tests/vet and disposable database integration tests, frontend tests/type checks/focused lint, and a browser reload when permitted. Verify that room and target temperature coexist in persisted readings and invalid room values stay NULL. Separately document physical room-sensor disconnect/recovery, remote-command and current-threshold checks.
6. Commit the focused changes locally. Do not deploy, run live migrations or flash hardware. Rollback app/firmware commits while retaining any additive nullable column to avoid destructive schema rollback.

## 6. Open questions

Resolved: Felix requested both observations as information about the current AC condition. Show their sources separately and include last-received context. Current activity can fall when the compressor cycles even though the remote power setting is On. A remote command may be missed or may never reach the AC. Do not derive an authoritative combined On/Off state from these conflicting signals.

The observed serial readings around 0.3 A exceed the existing 0.25 A activity threshold. This does not establish whether those readings represent a running appliance or a measurement offset/noise; do not silently promise reliable current-based On/Off without a hardware check.

Pending hardware detail: which room-temperature sensor model and ESP32 GPIO/bus pins will be used? Do not choose a driver or invent wiring until Felix provides that information. The database field remains `current_temperature` regardless of the hardware model.

Latest-state design and tests must preserve that semantic distinction. No application code has been changed for this request.
