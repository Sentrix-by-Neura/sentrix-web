# Show target temperature and AC state on sensor detail

Status: proposed; AC-state meaning and implementation approval pending.

## 1. Problem

The sensor detail screen uses a metric card for Backend contact / Recent / Go service. Felix wants that space to show the latest target temperature and whether the AC is on or off.

The current firmware sends valid `target_temperature` values in its sixty-second MQTT batch after decoding a supported remote setpoint. It does not measure room temperature. It also calculates a current-based `active` flag locally, but does not publish it. Go stores target temperature, while the HTTP chart response returns only RMS current and timestamps; the frontend cannot display target temperature from that response today.

## 2. Success criteria

- Replace the Backend contact metric with readable target temperature and AC state, keeping the current sensor-detail visual style. Preserve RMS current, expected bounds, chart and the main availability/calibration badge.
- Temperature means the last valid target setpoint heard from the remote, displayed in Celsius. Missing/unsupported IR data shows Unknown or a dash, never zero, NaN or fabricated room temperature. It is not proof that the appliance received the command.
- AC state follows the product choice below: measured current activity, or the last decoded remote power command. The label must make that source clear and must not imply that compressor activity and remote power setting are identical.
- If measured activity is chosen, publish the existing valid current-based state from firmware rather than inferring hysteresis from averaged chart points. Current thresholds currently switch active at >=0.25 A and inactive at <=0.15 A, retaining the prior state between them; they need validation against the real installation before treating the result as authoritative.
- If remote power is chosen, start Unknown until an explicit supported power command is decoded. Partial/temperature-only/toggle commands must not invent an absolute state or reset it from decoder defaults. A reboot without a new usable command must not imply Off.
- Expose a latest raw sample and its timestamp through authenticated Go API access. Do not use time-bucketed chart averages to represent the current appliance state. Preserve account/ownership and archived-history isolation.
- Reuse fifteen-second visible-page polling for the displayed snapshot. Firmware batches remain sixty seconds apart: values are latest received, not instantaneous; normal batching plus polling can add about seventy-five seconds of delay, excluding outages and network latency. Show an update age or last-reported context.
- A disconnected sensor or stale measurement must not be shown as Off. Retain existing availability precedence and distinguish Unknown, Unavailable and the last reported historical values. A recent handshake alone does not make an old measurement fresh. Archived devices show last-recorded information, not live operating state.

## 3. Scope

Firmware: add the chosen nullable/known AC-state value to the existing batch reading, with appropriate validity checks. For the remote-power option, decode only explicit supported power information. Keep existing TLS, provisioning, PIN, retry and ACK behavior.

Go/database: validate and store the optional AC-state field using an additive nullable telemetry column if needed; reuse the existing target-temperature column. Add an authenticated latest-state read using the latest raw telemetry record and current ownership rules. Keep old firmware compatible with unknown AC state. Update wire fixtures and relevant store/HTTP tests.

Frontend: map the latest-state response, poll while visible, and replace the Backend contact card with target setpoint/AC state and honest unknown/stale/update-age behavior. Reuse surrounding layout and styles; avoid a general dashboard redesign.

Out of scope: changing chart transport to WebSockets, increasing sampling/publication frequency, remote AC control, room-temperature sensing, ML/calibration changes, retuning sensor thresholds without hardware measurements, changing ownership rules, live migrations/deployment or flashing hardware.

## 4. Constraints

Use existing dependencies and pinned ESP32 toolchain. Read the installed Next.js guides before implementation and follow existing app-screen styling. Keep the sixty-second MQTT batch and fifteen-second device refresh policy; any different latency requirement needs an explicit scope change.

Optional fields must remain backward compatible. Unknown must remain distinct from boolean false. Parse bounded, correctly typed MQTT values, and never send hardware PINs, secrets or synthetic state. Preserve telemetry timestamps and historical records. Use the existing device/timestamp index for latest-raw lookup and enforce access before returning readings.

Browser control was disabled in Work settings during preceding checks. Recheck access for visual verification and report any remaining limitation. Physical IR/current interpretation cannot be verified by a software build.

## 5. Plan

1. Resolve whether AC On/Off means measured current activity or the last remote power command, then obtain implementation sign-off on this PRD.
2. Add focused tests for chosen-state validity/unknowns, optional-field compatibility, typed MQTT parsing, latest raw temperature/state lookup, ownership/archive access and stale-sample handling.
3. Prepare the minimal additive migration and Go ingest/latest-state response, then implement the matching firmware field without changing unrelated constants or behavior. Document deployment order and legacy fallback.
4. Replace the detail card using the existing UI components/styles and freshness policy. Include last-update context and distinct unknown/unavailable states. Update component fixtures and tests.
5. Run firmware host tests/build, Go tests/vet and disposable database integration tests, frontend tests/type checks/focused lint, and a browser reload when permitted. Separately document physical remote-command and current-threshold checks.
6. Commit the focused changes locally. Do not deploy, run live migrations or flash hardware. Rollback app/firmware commits while retaining any additive nullable column to avoid destructive schema rollback.

## 6. Open questions

Pending Felix's choice: should On/Off represent activity inferred from SCT current, or the last On/Off command heard from the IR remote? Current activity can fall when the compressor cycles even though the remote power setting is On. A remote command may be missed or may never reach the AC.

The observed serial readings around 0.3 A exceed the existing 0.25 A activity threshold. This does not establish whether those readings represent a running appliance or a measurement offset/noise; do not silently promise reliable current-based On/Off without a hardware check.

Latest-state design and tests must preserve that semantic distinction. No application code has been changed for this request.
