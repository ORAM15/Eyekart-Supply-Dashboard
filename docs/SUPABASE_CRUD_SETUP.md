# EyeKart live CRUD and Supabase setup

This setup replaces the read-only Vercel snapshot only after the Supabase project, schema, Edge Function and first authorized admin profile are verified. Do not turn on `VITE_EYEKART_LIVE_MODE` before the tests pass.

## Intended architecture

- Vercel serves the React/Vite dashboard.
- Supabase Auth issues signed access tokens.
- The `eyekart-api` Supabase Edge Function validates the token, reads the server-owned `app_users` role, and performs inventory CRUD with the service role key kept inside Supabase.
- Postgres transactions in `adjust_branch_stock` update all three category balances, generate movement/audit rows and refresh low-stock alerts atomically.
- The branch record's `updated_at` is checked on save. If another user has changed the counter since it was opened, the API returns HTTP 409 instead of silently overwriting newer data.
- Live dashboards refresh every five seconds; the user who saves gets an immediate refresh after the successful write.
- The browser receives only the project URL and publishable key; it never receives the Supabase service-role/secret key.

## Schema baseline

Apply `supabase/schema.sql` to the **new dedicated EyeKart Supabase project** only. It creates the tables, enables RLS, revokes direct table access from `anon` and `authenticated`, grants the Edge Function's `service_role` access, installs audited stock/warehouse/dispatch/receipt RPCs, and seeds the 35 screenshot-confirmed branch rows only.

Expected initial branch balances: Male 1,500; Female 1,830; Kids 410; total 3,740. It does not import orders or movements from the old JSON because those were confirmed demo data. It intentionally leaves `warehouse_inventory` empty until a physical warehouse count is confirmed.

New Supabase projects no longer automatically expose new tables through the Data API as of the October 2026 change. This app does not require exposing the tables to client roles: its Edge Function is the only database caller. Keep RLS on and do not grant browser roles table access.

## Provisioning steps

1. Create the dedicated Supabase project under the owner-confirmed organization and a region suitable for Kenya/production traffic.
2. Apply `supabase/schema.sql` once through Supabase database migration tooling. Check that 35 branches sum to 3,740 and that four initial zero-stock alerts exist. Check `app_users` starts empty and warehouse inventory is absent.
3. Deploy `supabase/functions/eyekart-api/index.ts` as the `eyekart-api` Edge Function with JWT verification enabled. The function uses Supabase's server-managed `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, and `SUPABASE_ANON_KEY` fallback. Never copy its privileged key to Vercel or the frontend.
4. Create the first user under Supabase Auth using the actual owner's email. Then add exactly one row to `public.app_users` for that user's Auth UUID, setting `role='ADMIN'`, `is_active=true`, and a confirmed display name. Do not invent an email or promote a placeholder account.
5. Obtain the project URL and publishable key and configure these **Vercel Production build variables**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY`
   - `VITE_EYEKART_LIVE_MODE=true`
   These are public project settings; no service role secret is needed in Vercel.
6. Redeploy Vercel after setting build variables. Live mode shows a Supabase sign-in screen and does not allow the old preset demo-user identity to authorize writes.
7. Sign in as the authorized admin and test the API routes below before enabling normal stock operations for staff. Create accounts through Supabase Auth and assign roles via `app_users`; never trust browser role fields.

## Required pre-production test checklist

- `/functions/v1/eyekart-api/health` returns `LIVE_CRUD`.
- Signed-out branch and mutation requests are rejected.
- A signed-in user without an active `app_users` profile receives 403.
- An authorized admin/receptionist can load 35 branch rows with sum 3,740.
- Update one test branch by +1 and save with an audit reason; verify branch balance, total, movement audit and alert all update.
- Refresh the page and reopen the counter; the saved value must remain.
- Repeat from a second browser/session; the change should appear within the refresh interval.
- Send a stale `expectedUpdatedAt`; the API must return 409 and preserve the newer balance.
- Try negative quantities, missing audit reason, unassigned branch, and unauthorized admin endpoints; each must fail without changing stock.
- Confirm dispatch fails until a physical warehouse count is explicitly initialized.
- Confirm old JSON demo orders/movements were never imported.
- Run Supabase security advisors and verify the service/secret key never appears in browser assets or Vercel build variables.

## Current state

Code and schema are prepared on branch `feat/supabase-stock-persistence`. They are not live until a Supabase project is provisioned, the schema is applied, the Edge Function is deployed, an owner ADMIN profile is assigned, and Vercel build variables are set. Keep snapshot mode until these steps pass.
