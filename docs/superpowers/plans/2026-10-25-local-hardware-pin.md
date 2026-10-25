# Local hardware PIN implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans, with independent backend and firmware workstreams under superpowers:dispatching-parallel-agents. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Keep the six-digit hardware PIN local to BLE and register a MAC only after device confirmation.

**Architecture:** Go issues a random expiring setup challenge, the browser transfers it using existing PIN-authenticated encrypted BLE, and the ESP32 returns it in its MQTT handshake. The database atomically finalizes a first claim, confirms same-group recovery, or archives a former ownership session and starts a new one. Existing correlated MQTT acknowledgments still gate telemetry; ordinary registered-device reconnects use MAC/mesh validation over the trusted broker without a setup challenge.

**Tech Stack:** Go/pgx/Postgres; Supabase SQL migrations; Next.js/React/TypeScript; ESP32 Arduino/C++/ArduinoJson.

**Spec:** `docs/superpowers/specs/2026-10-25-local-hardware-pin-design.md`.

## Global constraints

- Keep encrypted BLE PIN verification, device proof, attempt throttling and service UUIDs. No hardware PIN in HTTP, MQTT, database or browser persistence.
- No dependencies added; no physical upload, live migration, production claims, push or deployment.
- Preserve same-group registration/monitoring history and calibration, NVS recovery and ACK-based runtime readiness. The user's updated physical-possession policy permits confirmed cross-group/account transfer and preserves the former account's complete history in a read-only archive.
- Use the current checkouts; initial tracked working trees are clean. The only untracked file is the approved spec.

## Protocol contracts

- `POST /api/groups/{id}/devices` accepts `{mac,name?}` only, returns HTTP 202 `{id,setup_token,expires_at}`. `id` is a nonsecret UUID identifying the claim; token is 32 random bytes encoded as 64 lowercase hex characters, lifetime ten minutes. No ownership or device row is created by this HTTP call.
- `GET /api/groups/{id}/device-claims/{claimID}` is authenticated/owned-group scoped, returns `{id,status:"pending"|"confirmed"|"expired",expires_at,device?:Device}`. A token never appears in URLs. Confirmed status returns the device only while it still belongs to the same group.
- New pending table: `device_setup_claims`: UUID `id`, unique `(mac_address,group_id)`, `user_id`, `group_id`, normalized `mac_address`, nullable `name`, SHA256 `token_hash`, `expires_at`, nullable `confirmed_at` and `device_id`. RLS with no browser grants/policies. Store only the hash; JSON results never serialize it. Bound unconfirmed pending rows to 20/account and clear expired rows for that account when issuing another challenge.
- Only MQTT confirmation creates/attaches/transfers the device. It validates challenge/hash/MAC/target group owner/mesh/expiry. Concurrent confirmation is serialized on the device row after `INSERT ... ON CONFLICT DO NOTHING`; claim row locks follow device locks, matching release. The user's updated policy allows a different group/account to take an owned MAC after fresh physical setup confirmation; issuing HTTP alone cannot take it.
- Repeat delivery of a completed challenge must not reset calibration or reassign membership. Removal and confirmed cross-group transfer revoke other pending claims for that MAC in the same transaction. Claim expiry is checked again after acquiring each blocking lock using actual database time. Existing membership validation can still accept a normal reconnect even if firmware retained a consumed/expired challenge after an acknowledgment was lost; this fallback never creates or changes ownership.
- BLE config adds required `setup_token` to `{ssid,password,mesh_id}`; PIN remains a local helper argument for BLE authentication, excluded from encrypted config JSON too. New firmware requires a valid 64-hex token for BLE provisioning; old saved/compile-time settings may omit it.
- Firmware MQTT replaces `device_pin` with optional `setup_token` until accepted. Persist it atomically in the existing network record; remove only after a valid matching accepted ACK. Retry a failed token-clear write without erasing Wi-Fi or reopening BLE. Never print the token. Keep payload limits sufficient for maximum SSID/password plus token.
- Backend ignores legacy unknown PIN fields without logging/persisting them, and does not require a PIN. Old unclaimed devices cannot self-register without the new setup confirmation. Claimed existing devices retain runtime connectivity.

## Review focus

- HTTP alone or an incorrect/expired/token-for-other-MAC confirmation must not create ownership.
- Backend restart, duplicate MQTT, competing claims, and unclaim/reclaim must not allow a revoked/expired challenge to transfer ownership. Fresh physical setup confirmation is an authorized transfer under the new policy.
- Wrong BLE PIN must stop before the HTTP claim; account switch/unmount must not expose challenges or stale device data.
- Power loss with pending setup retains the challenge; normal power restoration after acceptance needs no re-registration.
- First claim starts calibration once; same-group recovery, confirmation retries and runtime reconnects preserve it.

### Task 1: Backend and schema (independent workstream)

**Files:** Go `internal/store` claim methods and integration tests, HTTP claim/status handlers and tests, ingest handshake parser/database flow and tests, simulator, current backend docs; web `supabase/migrations/20261025000000_local_hardware_pin.sql` and `supabase/seed.sql` only.

- [x] Write/run failing claim and pinless-handshake tests, including ownership/expiry/replay/concurrency behavior.
- [x] Implement the protocol above, add the new migration dropping `devices.pin_code`, update seed for MAC-only fixture rows, and adapt tests/fakes without leaving a PIN-based bypass.
- [x] Run Go suite/vet and compile integration tests; run actual integration checks with a disposable DB if available, never a production DB.
- [x] Document migration, compatibility, runtime broker-trust boundary and deployment order. Commit only owned files after verification; report exact changes/limits to coordinator.

### Task 2: Firmware (independent workstream)

**Files:** `SentrixESP32/SentrixESP32.ino`, relevant companion headers/host tests, firmware README and protocol notes.

- [x] Add/run failing host contract checks for token validation/persistence and no PIN in MQTT while keeping local PIN authentication.
- [x] Implement the BLE/NVS/MQTT contract above, bounds, clear-after-ACK and retry behavior. Keep hardware constants/credentials and calibration intact.
- [x] Run host checks and ESP32 compilation with installed tooling when available; no upload. Update docs and commit owned changes after verification.

### Task 3: Frontend integration (coordinator)

**Files:** `frontend/app/lib/sentrix-store.tsx`, `sentrix-api.ts` as needed, `sentrix-bluetooth.ts`, onboarding modal, corresponding tests, task docs.

- [x] Add failing tests: HTTP excludes PIN; claim response remains transient without a ghost device; polling is authenticated/account-scoped; config sends challenge but no PIN; wrong PIN prevents registration; waiting/expiry/confirmed UI states.
- [x] Implement typed claim/status helpers, token validation and encrypted transfer. Poll claim status every two seconds after settings save, publish the real device on confirmation, and then follow existing contact/telemetry checks. Closing does not cancel device-side finalization. No challenge storage or URLs/logging.
- [x] Preserve progress/chips/spinner/eye controls. Claim-start errors do not imply Wi-Fi settings were sent; transfer uncertainty and expiration have specific recovery guidance.
- [x] Run full web tests, TypeScript and focused lint; exercise the isolated runtime fixture where browser access permits. Wrong PIN and pending setup were inspected earlier; final archive/confirmation/expiry visual check remains unavailable with browser control disabled, as recorded below.
- [x] Review cross-repo protocol equality, request independent whole-change review, fix blocking issues with regression checks, commit verified frontend and plan/spec updates.

## Execution record

- Approved choice: automatic new-device registration with a one-time device-confirmed setup challenge, not MAC-only trusting of the browser.
- Workstream isolation: backend owns all API files and two named Supabase files; firmware owns firmware files; coordinator owns frontend source/tests and these task docs. Interfaces are fixed above before parallel edits.
- User amendment: deliberate physical BOOT recovery + correct local PIN + new device challenge can transfer to another account/group without the old account. Normal restart/power restoration remains registered to its existing owner.
- Approval review rejected the earlier history-deletion proposal. The user then explicitly chose to preserve previous monitoring history. Implemented archive-old/current-new: actual MAC retained in both records, only one active record per MAC, old UUID/group/history retained privately, new UUID/fresh calibration for the destination. Automatic transfer never deletes history.
- Independent review found two P2s: challenge expiry could be evaluated before waiting for the claim lock; backend worker reproduced/fixed with a fresh post-lock database clock check. Client cancellation replaced the API timeout; coordinator reproduced a stalled request and combined cancellation with the existing twenty-second timeout, then verified RED→GREEN and retry/unmount behavior.
- Cross-group identity isolation: a fresh database device UUID (same physical MAC) prevents old external Python jobs using the former UUID from writing into the new ownership session. Same-group recovery retains the UUID. Archive write guards serialize with transfer; historical charts anchor to the archival date. Explicit archive deletion never releases the current physical sensor.
- Final verification on 2026-10-26: full Go unit and tagged integration suites, vet and API/simulator build passed. Integration used only disposable PostgreSQL 17.6 at localhost. Clean migration checks retained old identity/history and verified PIN removal, claims RLS/browser denial and active-MAC uniqueness.
- Firmware committed in `6f60243`; policy documentation finalized in `0a7ba7e`. All 26 host groups plus four Go ACK fixtures passed; pinned ESP32 build passed at 19.6% RAM and 65.4% flash. No board was flashed.
- Frontend full suite passed 58 tests again after final copy/status polish; type check passed. ESLint has zero errors and one pre-existing `menuState` dependency warning in the context menu; unrelated to archive handling and left unchanged. Archive component tests cover group/detail/dashboard/alerts and legacy MAC routing; old history is readable, has no live controls and is excluded from current health.
- Browser: the earlier isolated CUA pass verified wrong local PIN, correct PIN, encrypted setup transfer and truthful waiting-for-confirmation UI. Final live archive/confirmation/expiry visual checks could not be completed after Work settings disabled browser control. Do not equate component tests with a completed visual pass; this remains a validation limitation.
- Independent final review of the preservation policy found no remaining Critical/Important or Minor issues after fixing active-row filtering in claim-status fetch. No fresh re-review was dispatched for already covered fixes.
- Next.js feedback reporting pass: no new qualifying framework issue was encountered; host memory pressure and disabled browser control are environment limits.
- Rollout prerequisite: an existing presence/temperature migration is referenced by older API docs but missing from the repository. Required seven nullable columns and migration/deployment order are documented in `sentrix-api/docs/local-hardware-pin.md`; no live schema repair was attempted.
- Keeping existing checkouts and local commits; no merge, push, deployment, production claim or live migration. The unfinished visual check and physical BLE/NVS/broker permission checks remain explicit limits.
- Backend checkpoint: `893e63d` records the coordinated Go claim/confirmation/archive implementation and rollout documentation. Final unit/integration/vet/build verification passed before this commit.
