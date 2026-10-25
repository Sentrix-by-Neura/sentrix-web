# Center Settings and remove administrator referrals

Status: approved by Felix on 2026-10-26; implemented. Scope is limited to website layout and user-facing copy.

## 1. Problem

The Settings profile form has `max-w-xl` but stays aligned to the left of the app canvas. Several messages tell people to contact a website administrator, although this product has no website administrator service.

## 2. Success criteria

- Center the Settings heading and profile card together horizontally within the available app canvas, using a shared full-width `max-w-xl` wrapper with automatic horizontal margins. Keep form text left-aligned, current spacing and mobile gutters.
- Remove administrator-contact instructions from Settings, login/recovery and authentication/API configuration errors. Do not replace them with an invented support contact.
- Remove the login's placeholder Forgot password button whose only action is an administrator referral. Do not imply a working password reset exists when it does not.
- Preserve profile-name saving, session handling, login/signup and existing data/ownership permissions. This task does not change stored `ADMIN`/`USER` values or build an administration feature.

## 3. Scope

Modify `frontend/app/settings/page.tsx`, `frontend/app/components/auth-form.tsx`, and `frontend/app/lib/sentrix-api.ts`; add or adapt focused regression checks if they cover changed behavior/copy. Search all first-party UI sources for remaining administrator-contact referrals. Preserve unrelated user edits.

No authentication redesign, email-change flow, password-reset backend, role/schema migration, shared-shell layout change, firmware/API change, deployment or push.

## 4. Constraints

Keep the current Sentrix palette, typography, form controls and dependencies. Use existing React/Tailwind patterns and the installed Next.js guidance. Retain clear errors: for unavailable authentication/API configuration use a brief unavailable/try-again message without directing users to a nonexistent administrator.

Browser control was disabled in Work settings during the preceding task; check whether it is available again. If it remains unavailable, report that the final visual check could not be performed instead of claiming a browser-verified layout.

## 5. Plan

1. Inspect Settings and the relevant copy (completed for proposal); current tracked working tree is clean.
2. Center the page-local wrapper and remove redundant form width sizing; remove the Settings referral, placeholder recovery action and administrator referrals in first-party error strings.
3. Run the relevant component/API checks, TypeScript, focused ESLint, source search and whitespace check. Attempt browser inspection of `/settings` and the login page at desktop/phone widths without changing account data.
4. Review the small diff and commit only the named changes locally with a Conventional Commit. Rollback is a normal revert of this focused UI commit.

## 6. Open questions

No product clarification remains: centered means horizontal centering of the Settings content, with readable left-aligned form text. Approval was received before implementation. Browser control is still disabled in Work settings, so final visual verification cannot be completed in this session.

## Execution notes

- Centered the Settings heading and card in one `mx-auto w-full max-w-xl` wrapper; form text remains left-aligned and the shared app shell is unchanged.
- Removed the Settings administrator referral and the placeholder login recovery button. Authentication/API setup failures now show a brief service-unavailable message; no invented support contact or password-reset flow was added.
- Stored account roles and displayed role labels are unchanged; this task removes instructions to contact an administrator, not database values or permissions.
- Browser access was attempted through the existing in-app tab and returned "Local browser use is disabled in Work settings." No alternative browser automation was used to bypass that setting.
- Verification: all 58 existing frontend tests, TypeScript no-emit, focused ESLint and whitespace checks passed. Searching first-party UI source found no remaining contact/call/ask-administrator referrals. Existing login, profile and session operations are unchanged.
- No new qualifying Next.js feedback issue was encountered. The browser restriction is an environment limit, not a framework failure. No push or deployment performed.
