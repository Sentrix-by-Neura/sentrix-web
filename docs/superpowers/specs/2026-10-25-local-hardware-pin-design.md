# Keep the hardware PIN local to ESP32 setup

Status: approved on 2026-10-25: automatic MAC registration with device-confirmed claiming. PIN verification stays local to the browser and ESP32.

## 1. Problem

The intended PIN identifies the selected physical ESP32 during Bluetooth setup. Each device contains its hardcoded PIN, and the user enters the PIN printed on that hardware. The existing encrypted BLE challenge/proof already performs that check.

The application currently gives the same PIN extra duties: the website sends it in the Go claim request, the database stores `devices.pin_code`, and the firmware publishes `device_pin` in MQTT handshakes. Go checks the stored PIN in both paths. This causes the reported MAC/PIN mismatch and requires factory PIN rows, contrary to the requested model.

## 2. Success criteria

- `DEVICE_PIN` remains hardcoded in each ESP32. A correct PIN authenticates setup with that selected device; a wrong PIN blocks Wi-Fi scanning/provisioning. Keep encryption, device proof and attempt throttling.
- The hardware PIN is never sent to the HTTP API or MQTT, stored in the database, persisted in browser storage, or exposed by the UI. It remains transient in the browser only while needed for BLE authentication.
- Firmware and Go agree on a handshake without `device_pin`; correlated Go acceptance, retry/backoff, readiness lease and telemetry gating continue to work.
- Go records device identity, ownership and group membership independently of the hardware PIN. Updated user policy: someone with physical recovery access and the correct local hardware PIN can claim an already-owned sensor into a different account/group after fresh device confirmation; the old website account is not required. A MAC-only HTTP request cannot transfer ownership. Same-group recovery and ordinary power-loss behavior remain intact.
- Proposed first-setup behavior: create the device record automatically rather than requiring manual MAC/PIN seeding. Preserve existing identities, ownership, calibration and monitoring history when migrating/recovering.
- Each unit needs its own assigned hardcoded PIN to distinguish units. Flashing the same PIN to every unit would make the PIN check succeed on every one of them.

## 3. Scope and approaches

The change reaches firmware handshake serialization; Go HTTP claiming, store and MQTT parsing/validation; Next.js claim requests and setup status; Supabase schema/seed; related tests and current operational documentation. No visual redesign, sensor calibration changes, group deletion or deployment is included.

Two approaches fit the local-PIN requirement:

1. **MAC-only backend claiming:** after BLE authentication, the browser asks Go to claim/create the MAC. Smallest code change, but the backend must trust the browser: a direct authenticated HTTP request can skip the BLE PIN check. Rejecting another owner's device prevents reassignment, but does not establish possession for the first claim.
2. **Device-confirmed claiming (recommended):** Go creates an expiring, random setup challenge tied to the authenticated account, target MAC and group. The website transfers it through the existing PIN-authenticated encrypted BLE channel. The ESP32 returns it through MQTT; Go finalizes ownership only after matching that confirmation, then sends the existing application acknowledgment. This is separate from the hardware PIN and is never derived from it. Challenges must be bounded, expiring and one-use, with atomic conflict handling. Recovery must not reset ownership/calibration or depend on an expired setup challenge after a normal reboot.

The second approach retains a backend check that the setup reached the device while removing the PIN from all backend duties. It relies on the existing trusted MQTT connection and correct device/topic authorization; a challenge does not by itself establish factory identity against a caller who can also impersonate the device on MQTT. Broker authentication and TLS remain required.

### Physical ownership policy amendment

The user explicitly changed the earlier ownership restriction during implementation: "who ever can access the sensor, they own it." A normal EN/RST restart or power loss still reconnects using saved settings and retains the current owner. Deliberate BOOT recovery opens BLE; a new account can then authenticate the hardcoded hardware PIN and complete a fresh setup challenge to transfer ownership. Starting an HTTP challenge never changes ownership, and successful transfer invalidates older outstanding setup challenges for that MAC.

The user explicitly chose **Preserve the previous monitoring history**. Cross-group transfer archives the old device record and its complete history in the previous account, and creates a fresh active UUID for the same physical MAC in the destination group. The new owner starts fresh calibration and cannot access the old owner's data. Same-group recovery retains its current UUID, history and calibration. Ordinary restart/power restoration retains ownership. The old archive is read-only; background jobs targeting its UUID cannot contaminate the new session. All runtime MAC routing selects the current, unarchived record. Explicit deletion of an archive affects only that archive, after the existing website confirmation.

## 4. Constraints

- Preserve the existing BLE service UUIDs and ECDH/HMAC/AES-GCM authentication. Reuse the current MQTT confirmation mechanism rather than inventing a second success indicator.
- Backend authentication and group ownership checks stay mandatory; no `pin_verified: true` flag is treated as server proof.
- Avoid new dependencies. Keep per-device identity and concurrency rules explicit in database operations.
- Existing production data needs a new migration, not an edited historical migration. Removing the PIN column permanently removes its existing values when applied; identity, ownership and monitoring data must survive. Authoring a migration does not apply it to the live database.
- Treat firmware/API compatibility as a coordinated rollout. Existing flashed firmware currently publishes the PIN; it needs an update to stop that transmission. A backend transition must never log or persist legacy PIN fields.

## 5. Plan

1. Resolve the two choices below, then produce the focused implementation plan for the selected approach.
2. Add failing tests for local PIN success/failure and absence of the PIN from HTTP, MQTT and persistence. Pin down new-device creation, same-group recovery and ownership conflicts. For device-confirmed claiming, cover expiration, replay, backend restart, concurrent attempts and no ownership finalization without confirmation.
3. Update the schema/store, Go claim flow and MQTT handshake together; preserve runtime readiness acknowledgment and telemetry gating. Update backend and simulator tests/fixtures.
4. Update frontend claim data and firmware MQTT payload while keeping the current local PIN authentication. Adapt provisioning only as required by the selected confirmation approach. Replace the misleading generic claim-error suffix with stage-specific guidance.
5. Run the web suite, type checking and lint; Go unit and relevant database integration checks when a disposable database is available; firmware host checks/build where tooling permits. Use an isolated browser fixture for success, wrong PIN, backend waiting, recovery and ownership conflict. No production claims for verification.
6. Document deployment order, migration effects, rollback limits and any physical-hardware validation still needed. Commit the coordinated work locally; do not silently run the live migration or deploy services.

Rollback: code can be reverted before rollout. A deployed column-removal migration cannot restore prior PIN values; a backup or separately managed device inventory would be needed for that old model. Do not reintroduce PIN storage as a silent fallback.

## 6. Open questions

- Resolved: use device-confirmed claiming and automatically register new MACs. The user approved this proposal with "okey proceed".
- Resolved by later steering: physical recovery plus local PIN and fresh device confirmation permits transfer to a new account without the old website account.
- Resolved: preserve previous monitoring history privately in the old account; new account/group receives a fresh active ownership session and calibration. No monitoring history is deleted by automatic transfer.

Live migration and deployment are separate from implementation and local verification.
