# Sensor availability from MQTT disconnect notifications

Status: proposed; awaiting implementation approval. Revised 2026-10-26 to replace the frontend-only proposal with coordinated firmware, Go API and frontend changes.

## 1. Problem

Sensor badges currently render the database lifecycle status directly. An ESP32 can lose power while its card continues showing **Calibrating**. Go's MQTT connection is separate from each ESP32 connection: Go staying connected does not prove that a sensor is connected.

The firmware currently connects without an MQTT Last Will. Go subscribes to handshakes and telemetry, but not device disconnect notifications. Its existing `offline_nodes` handling depends on a root reporting another node; a standalone root cannot announce its own sudden power loss. The frontend has a ninety-second `last_seen` check for some counts, but badges do not consistently use it.

## 2. Success criteria

| Observed condition | Visible result |
| --- | --- |
| Fresh accepted backend contact and lifecycle CALIBRATING | Calibrating |
| Fresh accepted backend contact and lifecycle ACTIVE | Monitoring active |
| Accepted disconnect notification for the current connection | Unavailable, regardless of calibration status |
| No valid recent contact for ninety seconds | Unavailable, even if a disconnect notification was missed |
| Reconnect accepted by Go | Resume displaying the existing lifecycle state |
| Archived registration | Preserve its existing history-only presentation |

- Go records an accepted MQTT disconnect without waiting for the ninety-second fallback. The visible website reflects it on the next successful existing fifteen-second metadata refresh, without a manual reload.
- For silent power/network loss, detection depends on the broker. With the current twenty-second MQTT keepalive, the protocol timeout is thirty seconds without a client control packet; this is not an end-to-end latency guarantee. Network, broker, database and UI delays remain possible. See the [MQTT 3.1.1 specification](https://docs.oasis-open.org/mqtt/mqtt/v3.1.1/os/mqtt-v3.1.1-os.html), sections 3.1.2.5 and 3.1.2.10.
- Fallback expiry is reevaluated at least every fifteen seconds while the page is visible, including when an API refresh fails. Check immediately when returning to the tab. Missing or invalid `last_seen` is unavailable; materially future timestamps must not keep a sensor available indefinitely.
- Availability must not delete readings, reset or extend calibration dates, change ownership, or erase prediction bounds or alerts. No synthetic readings are inserted during outages. The existing calibration policy continues; its default window is seven days unless configured otherwise.
- Delayed or retained notifications from an earlier MQTT connection cannot mark a newer accepted connection unavailable. Notifications for an old mesh or archived registration cannot affect the current registration.
- Cards, detail badges, connection labels and live dashboard counts agree. Existing API errors remain visible. “Unavailable” describes lost contact, not proof of a particular hardware fault.

## 3. Scope

**Firmware:** register a retained offline Last Will for each MQTT connection; publish connected presence only after Go accepts its handshake; attempt an explicit offline publish before intentional disconnect/restart where a live connection permits it. Audit every disconnect/recovery path. Keep TLS, broker configuration, BLE PIN authentication, provisioning and Go acknowledgement gating intact.

**Go API and database:** add a device-presence subscription and validated payload handling. Persist the accepted connection identity and connection state for current devices, expose connection state through existing device responses, and invalidate affected device caches. Use a minimal additive migration with nullable fields so existing devices can continue using freshness checks. Keep connectivity separate from the calibration lifecycle rather than overwriting CALIBRATING/ACTIVE for this new path.

**Frontend:** extend existing device types/mapping and use one shared availability rule in `frontend/app/lib/sentrix-store.tsx` and its dashboard, group and device-detail consumers. Reuse existing metadata polling and add a lightweight visible-page expiry refresh. Update relevant fixtures and tests.

**Tests and documentation:** cover the MQTT contract, database handling, UI precedence, reconnect races, rollout and physical-check instructions across all three repositories.

Out of scope: simultaneous active membership in multiple groups, ownership-policy changes, a new MQTT broker, new dependencies, SSE/WebSocket infrastructure, a background database offline sweeper, calibration/ML redesign, visual redesign, production deployment, live migrations and flashing physical hardware.

## 4. Constraints

- Proposed presence topic: `sentrix/status/{mac}` using the existing colon-formatted MAC convention. Payload contains `mesh_id`, a random per-MQTT-connection `connection_id`, and `state` (`online` or `offline`). Do not include the hardware PIN, setup token or credentials. Offline detection must not depend on an NTP timestamp generated before connection loss.
- Extend the existing handshake with the same connection ID. Each new MQTT connection gets a new ID; periodic handshake renewal on that connection retains it. Bind the ID to the active device only after existing MAC/mesh/claim validation succeeds. Ignore unbound presence, mismatched IDs and invalid payloads.
- The Last Will is retained with QoS 1. A subsequent connected publication replaces stale retained offline state. A retained online message alone cannot refresh `last_seen` or bypass Go acceptance; reconnect availability requires a fresh accepted handshake. Matching retained offline messages must still be handled when Go restarts.
- Subscribe to presence during Go's broker reconnect as well as startup. Treat duplicates idempotently. Update only the current, non-archived registration matching MAC, mesh and connection ID. Keep the existing broker authentication/ACL trust model; session IDs prevent stale-message races, not malicious broker impersonation.
- Planned minimal database fields are a nullable MQTT connection ID and nullable connected flag. Legacy devices with no presence fields use the existing fresh-contact rule; an explicit disconnected flag always overrides fresh timestamps. Preserve compatibility with current lifecycle statuses, including existing OFFLINE records and child-node reports.
- Reuse the twenty-second MQTT keepalive, thirty-second Go handshake renewal, ninety-second freshness policy and fifteen-second website refresh. Do not introduce new timing configuration without a demonstrated need.
- Intentional offline publishing is best effort if the connection is failing. The Last Will and freshness fallback provide recovery; do not block BOOT recovery or restart indefinitely waiting for a publish.
- Browser control was disabled during the preceding investigation. Recheck access during implementation; report browser or physical checks that remain unavailable rather than claiming they passed.

## 5. Plan

1. Inspect applicable repository instructions and all MQTT connect/disconnect, handshake, database device-response and frontend availability callers. Add failing tests for the agreed contract and precedence before implementation.
2. Add the minimal migration and Go support first: validate presence, bind connection identity during accepted handshakes, persist and expose connectivity, subscribe on reconnect, and handle duplicate/stale/archived notifications safely. Keep older firmware functional.
3. Update firmware connection setup, Last Will, accepted-handshake online publication and intentional disconnect paths. Extend handshake fixtures and host tests. Build using the existing pinned ESP32 toolchain.
4. Update the shared frontend availability decision, device mapping, badge/count consumers and visible-page clock. Keep an explicit backend disconnect ahead of recent contact and lifecycle status; retain archive behavior.
5. Run focused protocol and UI tests, Go tests and vet, database integration tests against disposable PostgreSQL, the firmware host tests/build, frontend tests, TypeScript and focused lint. Test reconnect ordering, duplicate/retained messages, API restart replay, wrong mesh, legacy firmware and timer expiry after failed refreshes. Assert that readings, calibration dates, ownership and archive history survive disconnect/reconnect unchanged.
6. Reload affected routes in a browser when access permits. Use a disposable broker/device simulation for Last Will delivery if available. A real ESP32 power cut, Wi-Fi loss and BOOT recovery remain explicit hardware checks unless a physical device is available and flashing is authorized. Distinguish automated evidence from physical verification.
7. Record results and create focused local commits. Prepare rollout instructions: back up the database, apply the additive migration, deploy compatible Go, deploy frontend, then update firmware. No live rollout is included in implementation approval.

Rollback: revert application commits and return to older firmware as necessary. Leave the additive nullable database fields in place to avoid a destructive rollback; the older application ignores them. Clear obsolete retained presence messages only as a deliberate rollout/rollback operation. Older UI behavior may again show stale calibration badges, which must be stated in rollback notes.

## 6. Open questions

No product decision is required before approval. This proposal deliberately retains fifteen-second website polling: it improves disconnect detection without promising immediate browser push. If sub-second delivery to the browser is required, that needs a separately approved transport change.

Environment checks during implementation/rollout: confirm broker ACLs permit the new presence topic, confirm retained/Last Will behavior with the actual broker configuration, and determine whether browser access and a physical ESP32 are available. These checks are not assumed complete.

The same-device/two-group policy remains unchanged: completing physical setup in another group archives the previous registration and creates a new active registration with fresh calibration, even within the same account. The previous group's history stays preserved.
