# Sensor recorded-data CSV export

Status: approved and implemented locally on 2026-11-08, with browser-local timezone required by Felix. Deployment pending.

## 1. Problem

The sensor detail route `app/dashboard/[groupName]/[sensorId]` has no way to download all recorded readings. Its chart API supports only 1 hour, 24 hours and 7 days, averages longer ranges, and excludes historical temperatures. Exporting chart points would omit or alter recorded data.

## 2. Success criteria

- Add an accessible `Export all data (CSV)` control to the sensor detail page, using its existing control style and a loading state that prevents duplicate downloads.
- Export every stored telemetry row for this sensor, oldest first, independently of the selected chart range. Keep an upper timestamp snapshot for the request and respect archived-history ownership boundaries.
- Use exactly these columns, in order: `date,time,current_rms,target_temp,room_temp`.
- Map `current_rms` from `rms_current`, `target_temp` from `target_temperature`, and `room_temp` from `current_temperature`. Preserve stored numeric precision; missing temperatures are empty cells, and actual zero remains zero. Units are amperes and Celsius.
- Use the user's browser timezone for dates (`YYYY-MM-DD`) and times (`HH:mm:ss`, preserving fractional seconds if recorded), with a visible local-time hint beside the export action. Send the browser's IANA timezone to the API so historical daylight-saving offsets are applied correctly, rather than applying today's fixed offset to every record.
- Download a sensor-specific `.csv` filename. An empty history produces a header-only CSV. A failed request shows a local error with the ability to retry.
- Require authentication and the same device ownership check used by existing telemetry/state reads. Reject another account's sensor without revealing its records.

## 3. Scope

Add one authenticated Go export endpoint and its raw-history store query in `sentrix-api`, plus a download helper and sensor-page control in `sentrix-web`. Add focused authorization, CSV content, null/zero, complete-history and UI-state checks. Include archived devices' retained history using existing access rules.

Out of scope: firmware changes, schema changes, chart redesign, date-range export filters, additional formats, deployment, and changing data retention or device ownership behavior.

## 4. Constraints

Reuse Go's standard CSV encoder and current frontend dependencies. Stream database rows into CSV on the server rather than materializing an unbounded history in server memory. Preserve existing chart endpoints. Use existing frontend authentication and environment configuration, handle non-success responses before initiating a download, and release browser object URLs after download. Read installed Next.js guidance before implementation and match surrounding UI styles.

## 5. Plan

1. Add the raw-history query and authenticated CSV route with a request snapshot, oldest-first ordering, exact headers, validated browser-timezone formatting and optional temperature handling.
2. Add the frontend authenticated download helper and export control, reusing sensor-detail styling and providing loading, local-time context and request-error feedback.
3. Run focused Go HTTP/store checks, frontend tests, TypeScript and relevant lint. Verify exported history beyond seven days and real raw samples rather than chart averages. Inspect desktop/mobile controls in a local browser preview where available.
4. Record verification and limitations, then commit each repository's focused change with Conventional Commits. Do not deploy. Roll back by reverting these feature changes; existing data requires no migration.

## 6. Open questions

Resolved: Felix approved implementation and explicitly requested the user's timezone (for example GMT+7). Use the browser's IANA timezone, include it in the filename, and preserve exactly the five requested CSV columns. No unresolved product decision blocks implementation.

## Verification and implementation notes

- Added `GET /api/devices/{id}/telemetry/export?timezone=Asia%2FJakarta` in `sentrix-api`. Reuses device ownership/archive checks, validates the timezone, and streams oldest-first raw samples through the ownership/history reference without a time-range filter or row cap. A database failure before output returns an HTTP error; a failure after streaming starts aborts the response so the browser cannot treat partial history as a complete CSV.
- Added the sensor-page export component and shared authenticated CSV response helper. The browser detects its timezone on click, waits for a complete successful CSV response, downloads a sensor/timezone-specific filename, and releases the object URL. Leaving the page cancels a pending export. No schema or firmware changes.
- All 76 frontend tests, TypeScript, focused ESLint, the Go test suite, Go vet, and the production Next.js build passed. Tests cover GMT+7 midnight rollover, fractional-offset zones, historical daylight-saving changes, exact headers, precision, NULL/zero, auth/ownership, archives, failed/truncated streams, loading, retry, cancellation and URL cleanup.
- A disposable PostgreSQL test verified 2,505 raw readings older than seven days, reverse insertion/order, both temperatures, exclusion of another device and post-reference records, inclusive archive boundary, callback errors, cancellation and connection cleanup. Its table is connection-local and does not change permanent schema/data.
- Local browser checks use simulated sensor/API data, rather than an authenticated production session. Verified actual component download, browser timezone forwarding, focus, loading/error feedback and desktop/tablet/phone dark/light layouts. The app inspector has zero failures; its warm-palette warning belongs to the existing Sentrix theme, which this focused feature retains. The final timezone hint was shortened to keep header actions compact on phones.
- No Next.js feedback report is needed: the production build succeeded after allowing network access for the existing Google Fonts; the isolated preview disables minification when using Next's internal bundled Webpack outside its normal build environment. These are environment/preview-tool constraints, not verified framework defects.
