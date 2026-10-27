# Sensor detail UI simplification — 2026-10-28

## 1. Problem

The sensor detail route `/dashboard/[groupName]/[sensorId]` repeats context and explains obvious labels in separate paragraphs. Its metric cards mix measured values, historical observations and implementation details, making it harder to read the sensor's condition quickly. Felix requested Hallmark for this screen and explicitly removed the measured-current activity readout and observation/received timestamps from its UI.

## 2. Success criteria

- Show four clear measurements: **RMS Current**, **Room Temperature**, **Target Temperature** and **AC Power**, using the existing units and data. Group the readouts into a restrained, responsive summary rather than four decorative cards.
- AC Power displays **ON**, **OFF** or **Unknown**, based on the existing nullable remote-power field. Unknown must never become OFF. A disconnected or stale live reading must not imply a confirmed current power state; show Unknown without adding an explanatory paragraph. Archived readings remain historical under their existing archive context.
- Remove “Last target setpoint,” “Last remote power command,” measured-current activity, “Command heard” date/time, “Last received” date/time, and the paragraph explaining room temperature, remote commands and compressor activity.
- Keep exactly one device-status indicator in the header: **Connected**, **Calibrating** or **Unavailable**, retaining existing availability precedence. Archived devices retain one concise history-only context.
- Remove the repeated group subtitle/back-navigation control where the breadcrumb already provides it. Retain the breadcrumb links and sensor identity.
- Follow-up confirmed during implementation: retain a prominent **Normal RMS Current Range** readout using the existing latest 24-hour prediction bounds, in addition to the chart's historical shaded range and point tooltip. Felix identified this readout as central to the product's anomaly detection. Missing bounds remain Unknown, never a zero threshold. Keep the current snapshot and the historical chart because they answer different questions. Historical anomaly readings and timestamps remain useful event records, not duplicate current measurements.
- Simplify this route's chart titles, legend and anomaly section; use sentence-case labels, restrained surfaces, existing color/font tokens, accessible focus and no decorative glowing/pulsing dots. Preserve timeframe controls, actual anomaly markers, alert feedback/resolution and delete confirmation.
- Loading, missing readings and refresh errors remain visible through compact states or skeletons. No routine explanatory footer, invented readings or silent conversion of missing values to zero.
- Verify desktop/mobile and light/dark rendering, including unknown/disconnected/calibrating/archived/error states. Run focused and existing frontend checks, then commit locally.

## 3. Scope

Edit `frontend/app/dashboard/[groupName]/[sensorId]/operating-metrics.tsx`, its owning `page.tsx`, and `telemetry-chart.tsx`. Update the focused `frontend/tests/operating-metrics.test.mjs` and affected sensor-detail assertions in `frontend/tests/archived-history.test.mjs`; add a small route/chart regression check only if necessary to cover meaningful behavior. Use the route-local `sensor-detail.module.css` and `tokens.css` for styling. Hallmark records go in `.hallmark/` as appropriate; browser screenshots are local verification artifacts. Include the Next.js-generated `frontend/AGENTS.md` feedback-wording update as its repository instructions require.

This is a redesign of the requested sensor detail screen inside the existing application shell. Other dashboard/group/settings screens, navigation architecture, firmware, Go, database, wire fields, polling cadence, calibration, device ownership and live deployments are outside scope. Removing a displayed field does not delete stored monitoring history or stop recording it.

## 4. Constraints

Preserve Sentrix's current theme, real data, route destinations, handlers, IDs and archive/ownership protections. Use existing React, Recharts, CSS/Tailwind and application tokens without new runtime dependencies. Follow installed Next.js guidance. Apply Hallmark's app-screen rules, using real readings only; any isolated visual fixture must be identified as simulated. Do not bypass authentication for a route capture.

AC Power is still derived from an observed remote command, not a new physical power sensor. Current-based activity must not substitute for logical ON/OFF. Keep freshness checks even though the user-facing timestamps and explanations are removed. Archive context must remain identifiable without repeating it in every metric label.

## 5. Plan

1. Obtain approval for this file-level plan. Read the applicable installed Next.js guide and Hallmark app-screen/style guidance, capture the existing route if an authenticated local session is available, and record the chosen direction using the existing brand tokens.
2. Replace the noisy metric layout with the four-readout summary and concise unknown/loading/error states. Retain the original parent 24-hour chart-data hook and pass its latest bounds to the prominent Normal RMS Current Range readout, as clarified during implementation.
3. Clean up the route header, chart chrome and anomaly section without changing data, actions or historical detail. Preserve one availability indicator and archive context.
4. Update assertions for the explicitly requested presentation and verify unknown/stale/disconnected/archive behavior. Run frontend tests, TypeScript and focused ESLint.
5. Run Hallmark's static/render sweep and inspect before/after desktop/mobile, light/dark and data states. If authentication is unavailable, capture what is accessible and verify the actual components in a clearly labeled local fixture, reporting the authenticated-route limitation.
6. Record results and create a focused local Conventional Commit. Roll back by reverting that commit; no data migration or hardware upload is involved.

## 6. Open questions

No product clarification is needed for the requested removals. Interpret “all UI” as all visible sections of this sensor detail route, keeping the application shell and other routes outside the request. The intended tone is a quiet, utilitarian monitoring screen: measurements first, one status, concise labels and no decorative dashboard ornament.

Runtime access to an authenticated sensor route remains to be checked. No deployment or live account mutation is authorized by this UI task.

Implementation verified on 2026-10-28:

- All 68 frontend tests pass. Coverage includes the retained normal range, missing bounds versus valid zero bounds, unknown remote power, stale/disconnected data, archived history and requested copy removals. TypeScript, focused ESLint, whitespace checks and the final production build pass.
- Chrome reload and interaction checks pass for ten states: live ON, OFF, calibrating, unknown values, offline, stale, archived, loading, empty and refresh error. Checked phone overflow (including a 320 px archived case), normal range, hidden archived mutation buttons, chart timeframe switching and keyboard focus. Inspected before/after desktop and phone screenshots in both light and dark themes.
- Hallmark static/render sweep is clean: 0 FAIL, 0 REFLEX and 0 WARN across the five route implementation/style files and both theme URLs. The initial contrast report came from an offscreen, aria-hidden Recharts measuring node in a fixture lacking the app canvas; matching the real app canvas resolved the report without modifying the library or hiding content.
- Finish review ran in-thread: ship, no blocking finding and no gap from the declared direction. The old screen provided more verbose observation context, deliberately removed at Felix's request. Its normal-current range remains prominent; chart bounds, historical events and actions remain available. Preserve those during later styling changes.
- Authenticated runtime route redirects to login in the available browser session. Visual and interaction checks used actual page/chart/metric components with clearly labeled simulated readings and existing app fonts/styles; they do not establish production account/API integration. No live data, firmware, Go code, database schema or polling cadence was changed.
- Next.js feedback pass found no qualifying framework issue. Local browser tooling was installed only inside the ignored verification folder, with no application dependency or lockfile changes.
