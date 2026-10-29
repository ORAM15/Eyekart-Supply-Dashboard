# EyeKart Supply Dashboard — Production Repair Plan

Status: investigation only. No application behavior, inventory data, or production deployment has been changed by this document.

## Confirmed repository findings

- Frontend API client uses `API_BASE = '/api'`.
- Express API routes are defined in `server.ts`, but the Vercel deployment returned 404 for API paths.
- `package.json` uses `vite build` for the production build; this does not itself deploy/run the Express server.
- `server.ts` reads/writes `data/eyekart_db.json`.
- The JSON file currently contains 35 branches and related orders, movements, alerts, validation issues, warehouse, users, and settings.
- The backend currently derives authorization from client-controlled headers/body fields. These must not be trusted for production authorization.
- There is no known EyeKart Firebase project. Firestore must not be assumed to be the existing source of truth.

## Safety rules

1. Do not edit `main` or deploy from this branch.
2. Do not reset, replace, or overwrite `data/eyekart_db.json`.
3. Do not import into a database until the current JSON file is backed up, schema-validated, reconciled with the user's source spreadsheet/current operational records, and approved.
4. Treat any sample/demo users and activity in the JSON file as potentially non-production until verified.
5. Never trust `x-user-role`, `x-user-id`, `x-user-email`, or body fields as proof of identity or role.
6. Do not expose secrets or configure public database write access.

## Recommended target architecture

- Keep the existing Vite/React frontend on Vercel.
- Deploy the Express API as a separate persistent backend service initially, unless the app is deliberately refactored into Vercel-compatible serverless functions.
- Configure a server-side API base URL via environment variable; avoid hardcoded localhost or preview URLs.
- Before production use, add verified authentication (for example, Firebase Authentication only if a project is intentionally created and configured, with backend token verification) and server-side role authorization.
- Move persistent state from a local JSON file to a managed durable database after source-of-truth verification. Do not use ephemeral serverless filesystem storage for inventory.
- Add database transactions or equivalent consistency controls for stock movements and order receiving, plus audit logging and idempotency where appropriate.

## Required implementation and release gates

### Gate A — data source verification
- Confirm whether this repository JSON is authoritative and current.
- Preserve a byte-for-byte backup of the original file.
- Validate branch count, names, category quantities, totals, orders, and movement history.
- Reconcile discrepancies before migration.

### Gate B — backend and auth
- Implement deployment/runtime configuration and a health check.
- Ensure all frontend-used API endpoints are served by the backend.
- Replace client-trusted identity/role fields with verified server identity and role authorization.
- Add CORS allowlisting, request validation, safe error responses, and production secret management.

### Gate C — durable persistence
- Select and configure a managed database.
- Write a one-time, idempotent migration with a dry-run/report mode.
- Verify record counts and reconciled totals before switching reads/writes.
- Keep the original JSON backup unchanged and readily recoverable.

### Gate D — tests and release
- Run type-check/build/tests and API integration tests.
- Test unauthorized access, receptionist/admin permissions, stock adjustments, alerts, orders, warehouse, monthly reports, and persistence across restart.
- Verify no write request succeeds without authentication.
- Review changes via pull request; do not deploy until explicitly approved.

## Current decision

No authoritative production database has been confirmed beyond the repository JSON being the user's stated candidate source of truth. No migration, database creation, inventory overwrite, production deployment, or changes to `main` are authorized by this plan.
