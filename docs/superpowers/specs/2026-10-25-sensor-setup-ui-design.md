# Sensor setup progress and Wi-Fi controls

Status: approved by Felix on 2026-10-25. Includes the follow-up request for an eye button on the Wi-Fi password.

## 1. Problem

The existing BLE onboarding modal changes between scan, PIN, Wi-Fi, and saved screens without an overall progress indicator. Detected Wi-Fi networks are presented through a datalist rather than obvious selectable controls. Scanning only changes text, and the Wi-Fi password has no visibility toggle. This makes a hardware setup operation harder to follow, especially while waiting for the ESP32.

## 2. Success criteria

- A compact progress strip stays visible below the modal title: **Sensor → PIN → Wi-Fi → Finish**. The current stage uses the Sentrix amber accent; completed stages use a small check; upcoming stages are muted. Labels remain readable on a phone. Progress reflects actual setup state, without made-up percentages or clickable shortcuts past authentication.
- Detected SSIDs appear as wrapping chip buttons. Selecting a chip fills the SSID field and clearly marks that chip selected. Selecting a different chip replaces the value. Manually entering a different SSID clears the visual selection. Hidden/open networks and failed/empty scans still permit manual entry.
- Wi-Fi scanning shows one small loading animation with a short label. The network area keeps a stable footprint; re-scans retain the previous choices and current SSID instead of resetting the form. The animation stops when the scan finishes or fails and respects reduced-motion preferences.
- The Wi-Fi password starts masked. A trailing eye button toggles Show password / Hide password, changes neither the typed value nor the form step, has an accessible label and pressed state, and does not submit the form. Use a 44px touch target. Password visibility resets when leaving the Wi-Fi stage or closing/reopening setup. The hardware PIN remains masked.
- Keyboard focus, current-step semantics, selected-network semantics, scan announcements, light/dark themes, long SSID names, and mobile wrapping work. No horizontal overflow at 390px.
- Current Go claim ordering, encrypted BLE transfer, mesh ID validation, and reset/recovery behavior remain unchanged. The final stage distinguishes settings saved, waiting for backend contact, and telemetry received; it must not mark the device fully connected merely because Wi-Fi settings were saved.

## 3. Scope

In: visual and interaction changes inside `frontend/app/dashboard/[groupName]/ble-onboarding-modal.tsx`, narrowly scoped styling if needed, focused regression/browser checks, and implementation notes.

Out: dashboard redesign, new setup screens, backend or firmware changes, new dependencies, Wi-Fi signal/security information the firmware does not provide, synthetic networks, real device registration during development, and deployment.

### Approach

Keep the existing modal and its four real stages. Add a quiet horizontal progress strip, chip-style network selection above the manual SSID field, and a compact loading treatment. Keep Sentrix's current colors/type and one primary action per stage.

A separate full-screen wizard would add navigation and layout work without improving this short existing flow. A percentage progress bar would imply measurable progress the BLE scan and backend wait cannot supply. The proposed approach makes those actual states visible without changing the registration protocol.

## 4. Constraints

- Use tasteskill's app-screen/component guidance: match the surrounding visual system, flat neutral surfaces, restrained borders, clear text, and accent only for the active step/selected choice/main action. No decorative gradients, glow, shimmer, or added imagery.
- This is a component within an established app, so use the existing palette and typography instead of drawing a new whole-page direction. Keep shadows only on the floating modal.
- Keep the existing modal size and comfortable mobile spacing. SSID chips must wrap and handle long names without clipping essential content; manual entry remains available.
- Reuse the current async `scan`, `authenticate`, `scanWifi`, and `provision` operations. Preserve user-gesture Bluetooth scanning, disabled pending actions, error/retry messages, and secret cleanup. Secrets must stay out of logs, URLs, persistent storage, and screenshots.
- Preserve unrelated user edits, including `.env.example`. Use no extra UI or animation dependency; draw the eye/check/loading affordances with simple inline SVG/CSS and accessible native controls.

## 5. Plan

1. Capture the current modal states using isolated fixtures; note desktop and phone dimensions, content hierarchy, and controls that must survive.
2. Add the progress strip using the existing step state. Keep the last stage active while backend confirmation/telemetry are pending; expose the actual status in its existing text.
3. Replace the Wi-Fi datalist with selectable chips plus the existing manual input. Add loading/empty/error/re-scan states and keyboard-accessible selection.
4. Add the eye toggle to the Wi-Fi password with accessible labels, visible focus, and transient visibility state. Preserve the password's value across toggles.
5. Verify the progress transitions, chip selection/manual entry, scan pending/success/empty/error states, reduced motion, eye toggle, keyboard interaction, and secret cleanup. Run the existing setup tests, TypeScript, focused lint, and tasteskill checks appropriate to this component.
6. Inspect real-browser screenshots at desktop, tablet, and 390px. Use local intercepted services and a simulated peripheral implementing the existing encrypted protocol; do not write production records. Fix visible problems, document limits, and commit the completed change locally.

Rollback: revert the focused UI commit. No database, firmware, or persisted configuration format changes are involved.

## 6. Open questions

No product questions remain. Felix approved Sensor, PIN, Wi-Fi, and Finish, with the eye button on the Wi-Fi password, before implementation.
