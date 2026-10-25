# Production frontend setup

The website uses Supabase Auth and the Go HTTP API. Groups/devices/alerts and telemetry are never loaded from a demo seed or authoritative browser cache. Existing demo snapshots are discarded on startup; no production database records are deleted by upgrading the website.

## Configuration

Set these in the frontend deployment environment **before building**:

```dotenv
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR_PUBLIC_ANON_KEY
NEXT_PUBLIC_API_URL=https://YOUR_API_HOST
```

The API URL is the Go origin without a trailing `/api`; requests append `/api` automatically. The older `NEXT_PUBLIC_GO_API_URL` name remains a fallback. Use only a public anonymous Supabase key here, never a service-role key. Go must allow the exact website origin in `ALLOWED_ORIGINS`.

Install with `pnpm install --frozen-lockfile`, run `pnpm test`, `pnpm lint`, `pnpm build`, and `pnpm start`. CI uses the existing pnpm lockfile. Production builds use Next.js's supported Webpack option with the existing Tailwind loader in Next's CSS pipeline; the local Turbopack CSS worker repeatedly exited before connecting. Development retains the existing Turbopack configuration.

## Device flow

1. Log in, create a group, and open it. Go supplies its ID and mesh ID. Groups with identical names have distinct stable routes.
2. Find a powered ESP32 using Chrome/Edge Web Bluetooth on HTTPS or localhost. Enter the PIN from its physical label. The site neither prepopulates nor displays a default PIN.
3. The website authenticates the hardware PIN and claims its existing factory record through Go. Missing records or wrong claims remain errors; the browser cannot manufacture devices.
4. The site transfers encrypted Wi-Fi credentials plus the group's `mesh_id`. Settings-save success is displayed separately from backend contact and incoming telemetry. Firmware restarts with BLE off and waits for Go's MQTT confirmation.
5. For recovery, keep the device powered, hold BOOT/GPIO0 for five seconds until two long LED flashes, then release. Scan it again in its existing group. Its claim and calibration are reused. Normal power loss/reboot retains Wi-Fi settings and requires no registration.

Go data refreshes every 15 seconds while the page is visible. Open telemetry views refresh every minute. Missing readings/prediction bounds show empty or unavailable states. Calibration status is distinct from recent backend contact; `last_seen` alone is not proof of MQTT ACK delivery. Logical website groups do not implement ESP-NOW child routing.

## Removal

Deploy the Go removal routes first; see the API repository's `docs/production-groups.md`. Only empty groups can be deleted. Removing a sensor explicitly releases its claim and permanently deletes its telemetry, predictions, and alerts, while keeping its factory MAC/PIN/ID. Reset its hardware setup before registering it again.

Drain the separate ML service's active model jobs before releasing hardware under training; current Python jobs are not tagged with a registration generation. Browser-only invitation, maintenance dispatch, password-change, and notification toggles that previously implied an unsupported backend operation have been removed. Account name changes use Supabase Auth metadata; email and role are read-only in the frontend.

The frontend no longer requests `pin_code`. The existing Supabase policies still permit an owner to query that database column directly; enforcing PIN secrecy at the database level needs a separate privilege/view migration. This work does not deploy migrations, delete production rows, change broker ACLs, or push/deploy services.

## Rollout checks

- Deploy the Go MQTT acknowledgment support and removal routes before the website. Grant the backend write access to ACK topics and each device read access to its own topic.
- Configure the frontend API/Auth values, rebuild, and confirm the website origin is allowed by Go.
- Test a real factory-seeded sensor: claim, Wi-Fi save/restart, Go acceptance, first minute batch, power restoration, and deliberate BOOT recovery.
- Exercise failed API calls and wrong PINs; there must be no ghost groups, invented measurements, or premature success.

Local verification results are recorded in the production-flow PRD. Browser checks use intercepted local fixtures, not production credentials or database writes.
