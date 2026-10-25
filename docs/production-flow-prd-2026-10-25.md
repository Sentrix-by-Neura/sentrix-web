# Production frontend and group lifecycle — 2026-10-25

Status: approved by Felix with "proceed"; implemented. Verification results follow below.

## 1. Problem

The Next.js frontend does not implement the current Go/ESP32 registration contract:

- `frontend/app/lib/sentrix-store.tsx` creates browser-local groups and attempts direct Supabase writes without checking errors. The checked-in database policies allow browser reads, not these writes. Go already provides authenticated group creation/list/detail and device claiming routes.
- BLE onboarding sends `group.id` (a UUID) as `group_id`; current firmware expects the group's 12-character hexadecimal `mesh_id`. Firmware accepts the legacy field name only when its value is a mesh ID.
- Onboarding never calls Go's claim route. For real hardware it passes an empty PIN to a local device-insertion function, which skips the database write yet reports success. Go handshakes require an existing factory record, valid PIN, and claimed membership in the matching group.
- A successful BLE result means Wi-Fi settings were saved. The ESP32 then restarts with BLE off and separately requests Go confirmation. The website currently treats these stages as a completed connection.
- Demo login fallback, seeded groups/devices/alerts, simulated BLE devices/anomalies, generated telemetry/bounds, and a public fault simulator remain accessible. The PIN input is prefilled and a test PIN is printed; the context menu can copy device PINs. Devices are read using `select('*')`, including PIN data.
- Shared localStorage is treated as authoritative across users. Failed reads can silently become empty data; failed writes can appear successful. Group slugs based only on names collide after a database reload.
- Current delete controls attempt direct database deletion. Go has no group-delete/device-unclaim endpoints. Deleting a factory device row would prevent later claiming, and deleting a group alone leaves devices with no group but a claimed status.

## 2. Success criteria

- Only real Supabase authentication grants access. Missing configuration or failed requests produce actionable errors, never demo access or fake success. Sign-out/account switching clears user data and ignores stale responses.
- No shipped demo login, simulated hardware/anomaly actions, seeded fallback data, random chart readings, or interactive public fault simulator remains. Genuine empty and loading states replace fabricated values. Historical documentation may remain clearly historical; demo seed tooling is removed from the active setup instructions.
- PIN entry starts empty, directs users to the hardware label, is masked, and is used only transiently for BLE authentication and authenticated Go claiming. No default PIN, PIN-copy menu, PIN field in the application device model, or persisted PIN remains. No device read requests `pin_code`.
- Group creation/list/detail use Go with the current Supabase bearer token; database-returned group and mesh IDs are authoritative. Both dashboard and context-menu entry points await success, handle errors, and disable duplicate submissions. Reloading preserves real groups. Routes uniquely identify groups even with duplicate names.
- Registration follows: select a real device, enter hardware PIN, authenticate BLE, claim the factory-seeded device into the selected owned group through Go, provision Wi-Fi plus `mesh_id`, then display the saved/restarting stage and wait for backend contact. Neither claim status nor BLE save alone is labelled proof of MQTT readiness. A missing factory record is reported without inventing one in the browser.
- A failed Wi-Fi setup after a successful claim can resume for that same owned device/group after BLE PIN authentication without a second claim. Hardware reset opens temporary setup; it does not implicitly unclaim or move the device. Setup explains the existing BOOT hold/release recovery procedure and normal BLE-off behavior.
- Device status, calibration dates, telemetry, prediction bounds, and alerts come from backend data. Missing bounds/readings show unavailable states. Refreshing can observe backend contact and telemetry without reconnecting BLE. Availability and calibration status are presented separately.
- Group removal and device removal have explicit server-authorized behavior. Proposed default: allow deletion only for an empty owned group; reject nonempty groups with a clear error. Device removal means unclaiming through Go, preserving its factory ID/MAC/PIN, invalidating ingestion cache, and resetting its claim/calibration/contact metadata. Before releasing hardware for a new owner, delete its old telemetry, prediction bounds, and alerts in the same transaction so later claims cannot expose the former owner's history. The UI explicitly confirms this permanent history loss and tells the user to reset hardware before setting it up again.
- Existing UI entry points use the same operations and error handling. No success toast/navigation occurs before server success.

## 3. Scope

In:

- Audit and align the existing frontend authentication, group, registration/recovery, monitoring, and alert interactions with the Go contract.
- Remove demo functionality, generated data, displayed/default/persisted PINs, and the public simulator (including its navigation links). Preserve the surrounding design and useful product explanations.
- Replace local group/device authority and denied browser writes with authenticated Go calls. Keep Supabase for authentication and existing legitimate profile reads.
- Use existing Go read endpoints for groups/devices, alerts, telemetry, and prediction bounds. Use existing alert mutations. Hide unsupported local-only invitation/maintenance actions that currently claim work has happened without a real service operation; implementing those services is separate work.
- Add only the missing authenticated Go endpoints/store operations for empty-group deletion and safe device unclaim, including ownership checks, transactional cleanup, and ingestion cache invalidation. This extends the earlier frontend request because supported removal cannot be implemented safely only in Next.js.
- Update all affected callers, tests, configuration examples, setup/recovery instructions, and dated implementation notes.

Out:

- Deploying/pushing code, changing production database rows/policies, running destructive production operations, or flashing devices.
- Changing firmware or MQTT acknowledgment protocol, broker credentials/ACLs, ML algorithms, or manufacturing PINs.
- Implementing ESP-NOW child routing: website groups assign logical mesh membership; they cannot create radio mesh support absent from firmware.
- Cross-group transfers, account/team invitation services, maintenance dispatch services, and a visual redesign.

## 4. Constraints

- Preserve Next.js 16/React 19, current styles/components, Supabase Auth, Go ownership/rate-limit validation, and the firmware's encrypted BLE protocol. Read the installed Next.js documentation before implementation. No new dependency unless existing tools cannot meet a concrete requirement.
- Never ship service-role credentials or MQTT credentials to the browser. Keep PIN/passwords out of localStorage, logs, URLs, application snapshots, and error messages. Test fixture PINs and BLE UUIDs are not UI defaults.
- Reuse `POST /api/groups`, `GET /api/groups`, `GET /api/groups/{id}`, `GET/POST /api/groups/{id}/devices`, `/api/devices/{id}/telemetry`, `/api/devices/{id}/bounds`, and existing alert routes. Document the public API base URL and required exact CORS origin.
- BLE provisioning success is local configuration success, not an acknowledgment from Go. Recent `last_seen` is backend contact evidence, not proof the ESP32 received Go's ACK. Fresh telemetry is evidence of the complete path. Waiting/timeouts remain visible and retryable.
- Claims must survive partial setup failure without creating duplicates or automatically releasing a device whose setup may still complete.
- Keep factory device records. Any approved device unclaim removes historical monitoring rows permanently; implement it transactionally, enforce ownership, and explain the loss before execution. Empty-group deletion avoids implicit bulk release.
- Account changes/unmounts must not apply old requests to a new session. Private API data must not enter a shared public cache. Do not silently reuse legacy demo/local snapshots as live data.
- Preserve unrelated user edits; use named-file staging and Conventional Commits per completed implementation checkpoint. No push/deploy without separate authorization.

## 5. Plan

1. Add the production API/configuration boundary and account-scoped state/error/loading behavior. Remove demo fallback/storage authority and PIN fields; replace simulated reads with real data. Update chart callers for asynchronous loading and absent bounds rather than synthesizing measurements.
2. Wire group creation/list/detail and all callers to Go. Establish stable collision-safe group routes and preserve useful old links where unambiguous. Add group loading/empty/error and pending mutation states.
3. Align BLE onboarding with Go claim, `mesh_id`, saved/rebooting, backend waiting, and same-group recovery stages. Preserve encrypted transfer, user-gesture scanning, disconnect cleanup, and the firmware result window. Keep secrets transient and recover from partial completion.
4. Add safe Go empty-group deletion and device unclaim with transaction/ownership/cache invalidation tests; connect existing delete controls to explicit confirmations and awaited results. Cover concurrent claim/delete and ensure a newly claimed device cannot inherit a previous owner's monitoring history.
5. Remove remaining demo/simulation UI and exports, PIN displays, generated chart data, and unsupported pretend-success controls. Remove simulator-specific public navigation and active demo setup tooling without deleting production records. Keep edits within the existing visual system.
6. Verify with frontend unit tests using mocked fetch/auth/BLE, TypeScript/lint and production build, focused Go tests and the full applicable suite, plus browser checks of login, dashboard/group states, forms, PIN handling, and errors. Exercise wrong PIN, absent factory row, unauthorized access, duplicate group names, API failure, account switching, already-owned recovery, interrupted setup, nonempty deletion, and unclaim cleanup. Real hardware/production verification remains a deployment step.
7. Document findings, required API configuration, removal semantics, deployment ordering, known limitations, and verification performed; commit completed changes in each repository.

Rollback: revert feature commits and restore matching frontend/backend versions together. The implementation does not run production mutations. A device unclaim executed later by a user permanently deletes that device's history; reverting code cannot restore those records, which require a backup.

## 6. Open questions

- Felix approved this implementation plan with "proceed", including the Go extension and removal semantics: groups must be empty before deletion; removing a device releases it and permanently clears monitoring history while preserving the factory record. No production deletion was executed during development.
- Production API base URL/CORS and deployment revision must be checked during rollout. The handshake acknowledgment support must be deployed for upgraded firmware to become ready. Local tracking references alone do not prove the live server revision.
- The checked-in Supabase policies permit users to read all columns on their owned devices, including `pin_code`. Removing it from frontend queries/UI stops this application requesting/displaying it but does not revoke direct authenticated access to that column. Database-level PIN isolation is a separate security migration to review and deploy.
- The UI cannot observe GPIO2 or MQTT ACK receipt directly. It will label configuration, backend contact, and arriving telemetry according to the evidence available rather than promise a connection before it is confirmed.

## Implementation and verification

- Go commit `8738bdf` adds authenticated empty-group deletion and transactional device release. Manufacturing identity survives; monitoring rows are cleared. MQTT writes recheck live database membership under a row lock rather than relying on cached ownership, and lifecycle changes invalidate bounds/breach caches.
- The frontend now uses authenticated Go group/device/alert operations, collision-safe routes, entered transient hardware PINs, encrypted `mesh_id` transfer, same-group recovery, and separate saved/backend-contact/telemetry states. API errors stay visible and mutations do not invent local records. Account switches reject old request results.
- Demo login/seeds, public simulator, simulated BLE/anomalies, generated chart data, default PIN/prefill/copying, and unsupported invitation/dispatch/account/notification controls were removed. The old SQL demo seed was removed from the repository; no production seed records were deleted. Real empty readings and missing prediction bounds remain empty.
- Full Go unit suite passed. Expanded PostgreSQL store/ingest integration suites compile; they were not executed because no disposable database was available and the local Docker daemon was stopped. Tests never target the production database.
- 33 frontend tests passed, covering the API boundary, real telemetry/bound joins, encrypted BLE protocol, wrong PIN/proof/ciphertext handling, real mesh versus UUID validation, failed server writes, claiming/recovery, and account isolation. The firmware sibling UUID contract test ran successfully locally and skips explicitly when that sibling checkout is absent in standalone frontend CI.
- TypeScript passed; ESLint passed with no errors and existing image/context-menu warnings. Both repositories passed `git diff --check`.
- A Webpack production build passed with the existing Tailwind dependency integrated into Next's CSS pipeline. Repeated Turbopack worker startup panics occurred with/without sandbox and with relocated temporary storage. Production builds now explicitly use the supported `--webpack` option; development retains Turbopack. No dependency was added.
- Headless Edge checks against the built site used intercepted local Auth/Go fixtures and a peripheral implementing the real ECDH/HMAC/AES-GCM wire protocol. They passed login, failed/successful group creation, reload persistence, stable routes, empty masked PIN, phone overflow, claim-before-config ordering, mesh-ID transfer, no persisted PIN, saved/backend-waiting display, nonempty-group rejection, device release, empty-group deletion, logout, and protected-route redirects. No browser runtime exceptions were observed. Desktop/mobile screenshots were inspected.
- Browser verification uses test-only public service values injected by an ignored local build helper; the generated `.next` is a local test artifact. Production must rebuild with its own public API/Supabase configuration.
- Rollout still requires actual Go/website deployment, MQTT ACK ACL verification, physical ESP32 testing, and a disposable-database integration run. Supabase PIN-column privilege isolation and Python job cancellation/generation checks remain separate backend work. Drain active model jobs before releasing hardware under training.
