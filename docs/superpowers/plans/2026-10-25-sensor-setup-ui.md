# Sensor setup UI implementation plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make setup progress, detected Wi-Fi selection, scanning, and password visibility clear in the existing modal.

**Architecture:** Keep the current four-stage modal and all BLE and backend operations. Add presentation and transient password visibility state in the component, with behavioral component tests and an isolated browser fixture.

**Tech Stack:** Next.js 16, React 19, TypeScript, Tailwind 4, Node test runner.

**Spec:** `docs/superpowers/specs/2026-10-25-sensor-setup-ui-design.md` (approved 2026-10-25).

## Global constraints

- Keep Sentrix's palette, typography and current modal; no new dependencies.
- Sensor → PIN → Wi-Fi → Finish reflects actual state; no clickable skipping or invented percentage.
- Keep exact SSIDs, manual entry, retry, encryption, claim ordering and backend waiting.
- Wi-Fi password starts masked; accessible eye control must not submit; hardware PIN remains masked.
- Chips and eye controls have at least 44px targets; loading respects reduced motion; no horizontal overflow at 390px.

## Review focus

- A rescan retains the selected SSID and previous results while pending or failed.
- Hidden networks remain enterable and an edited SSID updates chip selection.
- Long and non-ASCII SSIDs wrap without truncating their actual value.
- Password toggling preserves the value and never sends a form; completing setup clears the secret and visibility.
- Saving settings alone does not mark the final stage complete; live telemetry does.

### Task 1: Setup controls

**Files:** Modify `frontend/app/dashboard/[groupName]/ble-onboarding-modal.tsx`; create `frontend/tests/ble-onboarding-modal.test.mjs`.

**Interfaces:** Preserve `BleOnboardingModal({ group, onClose, initialScan })`, store hooks and Bluetooth helpers unchanged.

- [x] Add behavioral tests executing the real component handlers with isolated hook state and mocked external hardware/store: current steps, scan pending/empty/error, exact SSID selection/manual editing, rescan retention, visibility toggle and final telemetry status.
- [x] Run `rtk proxy node --test tests/ble-onboarding-modal.test.mjs` from `frontend`; expect failures for absent controls.
- [x] Implement ordered step labels with `aria-current="step"`, chips with `aria-pressed`, live scan status and reduced-motion spinner, password eye with dynamic accessible label and pressed state. Keep manual entry and all existing operations.
- [x] Run the focused test, full `rtk proxy npm test`, TypeScript no-emit and focused ESLint; expect all pass.
- [x] Render the real component in a local isolated fixture. Use CUA for interaction and screenshots; inspect desktop/tablet/390px and light/dark, keyboard selection, reduced motion, real state transitions and no premature completion. Do not create production records or use real secrets.
- [x] Run taste lint/inspector, inspect screenshots, address failures within the component, record any unrelated diagnostic.
- [x] Review diff, commit only component, test and task docs with `feat(onboarding): clarify sensor setup progress and wifi controls`.

## Execution notes

- User approved the proposed design with "proceed"; implementation continues inline in the current checkout. This is one small component, so a new worktree and another approval would add no useful isolation.
- Before editing: working tree contains only the proposed design document; no tracked user edits.
- RED: five focused tests failed on absent progress, spinner, chips and eye control. GREEN: five focused tests passed after implementation; full suite 41/41 passed. TypeScript, focused ESLint and `git diff --check` passed.
- A concurrent verification attempt exhausted Windows memory before test modules loaded. Sequential rerun of the unchanged full suite passed 41/41; no test failures remain.
- Browser: CUA exercised the real rendered component through scan, PIN, Wi-Fi, chip click/Space selection, manual override, eye show/hide, provisioning and truthful backend waiting. Pending/failed scans retain selections; empty scans remove chips and retain manual entry. The inspector captured 1440/768/390 in light/dark; all final checks have zero failures. The phone spacing was tightened after the first screenshot.
- Reduced motion: the spinner renders `motion-reduce:animate-none`; generated Tailwind CSS contains the reduced-motion rule. OS preference was not changed.
- Taste allowances: existing warm neutral palette retained to match Sentrix; empty surrounding canvas belongs to the isolated modal fixture. `heavy-shadow` is allowed for the existing floating dialog, as expressly permitted by the app-screen rules. These are not changes to the dashboard design.
- Ruling: the local browser fixture substitutes hardware/store boundaries; existing dedicated Bluetooth tests exercise the encrypted wire protocol. This avoids production writes for a presentation-only change. Physical ESP32 timing and transport remain unverified.
- Final review: independent read-only reviewer inspected the component, tests, protocol validation, telemetry hook and both modal callers; no Critical/Important findings. Screenshots/keyboard were verified by the implementer; physical hardware and existing focus trapping were outside this presentation change.
- Final: minor (deferred): the eye test verifies field removal, not direct in-memory visibility/password reset. The implementation explicitly clears both; stronger cleanup assertion remains optional.
- Final: minor (deferred): add backend-contact-only and stale-telemetry cases to the UI progress test; current fresh-telemetry completion path passes.
- Next.js feedback pass: no new qualifying framework issue encountered; the transient host memory shortage was not a Next.js issue.
- Keeping the existing `main` checkout and a local commit; no merge, push or deployment requested. Local previews and inspector output live in ignored `frontend/.browser-check/`.
