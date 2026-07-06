# Batch auth.2 / auth.1 — Account recovery + identity migration

**Author:** DC + Lacey · **Date:** 2026-07-05 · **v3 — Jenny PASS-WITH-FINDINGS folded**
**Status:** BUILD-READY (Jenny pre-flight complete; C1/H3/M1 + H1/H2/M2/M3/M4 folded)
**Repo:** `lacey-griffith/cqip` · `cqip.l-hay.workers.dev`
**Read order:** this spec → `CLAUDE.md` §15 auth entry + §5 schema + §13 r19/r22 → build.
**Build order:** auth.2 first → auth.1 → cleanup. "Last active" rides along with auth.1.

## 0. Scope
**In:** auth.2 (admin temp-password reset for read-only users, forced change, + read-only-only guard + r19 audit) · auth.1 (migrate 7 `@cqip.local` → fusion emails, email-primary login via dual-mode shim) · "Last active" column + drift indicator.
**Out:** login-activity heatmap / `login_events` (own spec + commits right behind, no Jenny — §9) · read-only RLS changes · deleting the legacy branch (cleanup commit after all 7 migrate — §6).

## 1. Current-state findings (all verified TRUE by Jenny against live code)
1. Login is email-keyed via synthesized `username@cqip.local` (`login/page.tsx:122-125`).
2. Login "Forgot password?" + admin `reset_password` both call `resetPasswordForEmail`, both refuse `@cqip.local` → recovery dead for all 7.
3. `user_profiles`: PK `id`, `email`, `display_name`, `role`, `is_active`, `created_at`, `color_preference`, `theme_preference`. No `username` col, no password-state col, `display_name` not a key/FK (`001:84-93`). **No UNIQUE on `display_name`** (see H3 note).
4. `/api/admin/users`: caller-admin guarded, **target-role NOT guarded**, **zero audit rows** for user mutations.
5. r22 trigger = `BEFORE UPDATE OF role, is_active`, SECURITY INVOKER, `auth.uid() IS NOT NULL` guard (`016:60-84`).
6. Users page loads client-side → `last_sign_in_at` unreachable → forces a service-role route.
7. Create-user POST auto-sends a reset email for real-email accounts (`route.ts:100-102`) — transactional, not marketing; out of scope, note only.
8. **[Jenny C1] `audit_log_target_shape_chk` (`015:60-64`) permits only `quality_log|test_milestone|brand|alert_event`** — NOT `'user'`. Every user audit row would throw a CHECK violation. → fixed in Migration 022.

## 2. Locked decisions
- Login → **email-primary** end state; **dual-mode shim** during migration.
- auth.2 = **system-generated temp password, shown once** + forced change. Read-only targets only.
- **App never resets an admin.** Admin recovery = self-initiated email (post-auth.1) or out-of-band Supabase console (Xandor).
- **No unsolicited email.** App emails only on user-initiated forgot-password or an admin explicitly clicking reset. **Email changes send nothing** (`email_confirm:true` suppresses — Jenny confirmed).
- **Email-drift handling [Jenny M3, resolved]:** no 2-phase rollback. Order writes so the recoverable state is the failure-landing state; retry the profile write once; hard-fail loudly naming which side won; surface a cheap drift indicator on the users page (§5).

## 3. auth.2 — Admin temp-password reset (BUILD FIRST)

### 3.1 Migration `022_auth2_recovery.sql` (idempotent) — does THREE things
1. `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT FALSE;`
2. **[C1]** DROP + re-ADD `audit_log_target_shape_chk` to allow `'user'`, following the exact idempotent pattern migration 015 used for `'alert_event'`. New allowed set: `quality_log|test_milestone|brand|alert_event|user`.
3. **[M1]** Extend the r22 trigger to also protect the new column: `BEFORE UPDATE OF role, is_active, must_change_password`. Same function/guard — non-admin browser writes to the flag now raise `insufficient_privilege`; service-role clears (auth.uid() null) still pass.

### 3.2 Route `app/api/admin/users/route.ts`
- **[H1] Guard ALL state-changing surfaces, not just named actions** — enumerate the ~6: `set_temp_password` (new), `reset_password` (email), the **generic PATCH `updates` branch** (`route.ts:148-161`, role change + `is_active` both directions), and `DELETE`. Wrap each with the target-role guard.
- **[H2] Two guards:** `assertTargetIsReadOnly(id)` for reset/temp-pw/role/deactivate; **`assertTargetIsReadOnlyOrSelf(id, caller)`** for the email action only (§4.2) — uniform read-only-only would deadlock admin self-migration.
- New action **`set_temp_password`:** read-only target → generate strong pw server-side (never client-supplied) → `auth.admin.updateUserById(id,{password})` → set `must_change_password=true` (service role) → one audit row → return `{temp_password}` with `Cache-Control: no-store`; never log the pw, never persist it, no telemetry on the body.
- **`reset_password`** (email): keep + add guard + audit row. Explicit admin action → consistent with §2. Still refuses `@cqip.local` until auth.1.
- **Audit backfill** on create / role / deactivate (closes finding 4). **[M4]** `getChangedBy()` must be passed the **cookie-bound route client** (it derives `auth.uid()`); `supabaseAdmin` has none and it *does* throw on no-user despite its doc.

### 3.3 Forced change [M1 + M2]
- **Gate in middleware** (server-side, stronger than layout; r24 gate on `/settings/users` already there — `middleware.ts:63-80`): authenticated request + `must_change_password=true` → redirect to the change-password screen, block elsewhere until cleared.
- Change-password form is **`settings/profile/page.tsx:200-240`**, client-side `supabase.auth.updateUser({password})` (NOT layout — Jenny corrected). After that GoTrue call succeeds, the client calls a **new server route** (e.g. `POST /api/account/password-changed`) that clears the flag via service role. Browser cannot clear it directly (trigger-protected per 3.1).

### 3.4 UI (`settings/users/page.tsx`)
Read-only rows → **"Set temp password"** → one-time copy callout ("share over a secure channel; won't be shown again"). Admin rows show no reset/temp-pw/delete controls (server-enforced; UI matches).

### 3.5 Verify (click-through)
temp-pw → forced change → flag clears · **[M1]** browser `update({must_change_password:false})` is rejected · every action 403s on admin targets **via direct API call** · **[C1]** user audit rows INSERT without CHECK violation · one audit row each, temp pw absent · role/is_active admin toggles still work.

## 4. auth.1 — Email migration + email-primary login (BUILD SECOND)

### 4.1 Dual-mode login [H3 — FIXED]
`input.includes('@')` → use as email. Else → **resolve username→email via `user_profiles` lookup** (the reset flow already does this, `login/page.tsx:169-173`), NOT blind `@cqip.local` synthesis. This is order- and habit-safe: a migrated user typing their old username still resolves to their real email. Label → "Email or username". Mark legacy fallback `// TODO(auth.1-cleanup)`.
*Low [Jenny]: `display_name` has no UNIQUE constraint — two users normalizing to the same name make the lookup ambiguous. Fine at 7 distinct first names; add a TODO.*

### 4.2 Edit-email UI + `set_email` action
- Guard: **`assertTargetIsReadOnlyOrSelf`** [H2] — self-edit allowed, other admins blocked.
- Validate (RFC + non-`@cqip.local`); reject duplicates (unique in `auth.users`).
- **[M3] Ordered two-write:** update `auth.users` email via `auth.admin.updateUserById(id,{email,email_confirm:true})` (suppresses send) and `user_profiles.email`. Order so the recoverable state is the failure-landing state; **retry the profile write once**; on hard failure, error loudly naming which side won. No rollback machinery.
- **No email sent.** Ownership established out-of-band (Lacey sets from the fusion directory). Password unchanged → user signs in with new email + existing password.
- Audit: `action='email_change'`, old→new in payload, `changed_by` r19 (cookie-bound client).

### 4.3 Rollout
(1) ship dual-mode login + edit-email together. (2) Lacey edits the 7 one at a time — **self first** (app never resets admins; console is her only fallback until hers is real). (3) Lacey tells users out-of-band their login is now their fusion email (no app email does this). (4) after all 7 + informed → cleanup commit removes the legacy branch.

### 4.4 Verify
username and email both authenticate mid-migration, **including a migrated user typing their old username** [H3] · editing one email never locks out another · `auth.users.email` == `user_profiles.email` after each edit · **no email sent on email change** · drift indicator (§5) reflects any mismatch · duplicate rejected.

## 5. "Last active" column + drift indicator (rides along with §4)
`GET /api/admin/users` (admin-gated, service role) → profiles + `last_sign_in_at` from `auth.admin.listUsers()`; page switches its load to this route. New "Last active" column (relative; "Never" if null). **[M3]** Since we're already calling `listUsers()`, cheaply compare its email vs `user_profiles.email` per row → show a drift flag if they differ. *Low: `listUsers()` pagination — fine at 7; add a TODO.*

## 6. Deploy sequence (Lacey)
```
docs:    Claudette commits this spec → docs/batch-auth-spec.md (docs-only)
auth.2:  migration 022 (manual SQL) → Claudette commits route+UI+middleware (no push) → Karen → smoke → push
auth.1:  Claudette commits dual-mode login + edit-email + Last active/drift (no push) → Karen → smoke
         → push → Lacey edits 7 emails (self first) → informs users
cleanup: after all 7 migrated + informed → commit removing legacy branch → push
```
Atomic `CLAUDE.md` §16 + version bump per code commit (r23; structural). No new edge fn → `verify_jwt` N/A.

## 7. Residual risks
- r22: all writes service-role → trigger bypassed by design; confirm no new *browser-side* role/is_active/flag write is introduced.
- Email/profile drift: handled per §2/M3 (ordered write + retry + loud fail + indicator) — no silent stale-recovery-address bug.
- Admin lockout: Lacey migrates self first.

## 8. NOT this batch — login-activity heatmap (fast-follow, no Jenny)
`023_login_events.sql` (`user_id` FK, `occurred_at`; admin-only SELECT, insert-own RLS) · fire-and-forget insert on successful login · GitHub-style per-user calendar + total on the users page (admin-gated). Open: all-admins vs owner-only visibility — decided in this batch.

## 9. Test checklist
- [ ] **[C1]** user audit rows (password_reset / email_change / backfill) INSERT without CHECK violation
- [ ] Temp-pw → forced change → flag clears; **[M1]** browser flag write rejected
- [ ] Middleware forced-change gate redirects; flag-clear route couples to the client password change
- [ ] **[H1]** all ~6 state-changing surfaces 403 on admin targets (direct API call)
- [ ] **[H2]** admin self-email-edit allowed; other-admin email-edit blocked
- [ ] **[H3]** migrated user authenticates typing BOTH email and old username
- [ ] Editing one email never locks out another; duplicate rejected
- [ ] `auth.users.email` == `user_profiles.email` after each edit; drift indicator fires on forced mismatch
- [ ] No email sent on email change; user-initiated forgot-password still works; `@cqip.local` refused
- [ ] "Last active" via new route; "Never" when null
- [ ] No regression: create / role toggle / deactivate (r22 service-role bypass intact)
- [ ] **[M4]** getChangedBy receives cookie-bound client (audit rows carry the admin, not null)

---
*DC spec v3 — Jenny findings folded, build-ready. Build auth.2 first. Do not push.*
