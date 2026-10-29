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

## Follow-up read-only data audit (2026-10-30)

The repository data file and seed records were inspected without writing either file.

- The JSON parses and contains 35 branches, 4 orders, 52 movements, 5 alerts, 6 validation issues, 5 warehouse entries, and 3 user records.
- Branch IDs and SRNs are unique. One branch name remains flagged as anomalous/unverified.
- The seed data's validation note says the source spreadsheet reconciled to 3,740 frames (Male 1,500; Female 1,830; Kids 410). The current JSON branch inventory sums to 3,719 (Male 1,490; Female 1,810; Kids 419): a net difference of -21 frames, with category deltas of -10, -20, and +9. This is a material reconciliation gap; do not treat either total as the current physical truth without source records.
- The JSON contains recent orders and movement entries dated 2026-10-29, including received/submitted/draft orders. These may represent actual activity or test activity; their legitimacy cannot be inferred from the repository alone.
- The three user entries are application seed identities, not proof of authenticated real users. No credentials or verified identity provider were found in the inspected setup.
- The warehouse values in the JSON must also be checked against a current warehouse count and source records before migration.

### Gate A decision: blocked pending owner verification

Do not migrate, reset, normalize, or deploy writes against this data yet. Ask the business owner to identify the authoritative current inventory/source spreadsheet and confirm whether the 2026-10-29 orders and movements are genuine operational transactions or test records. Preserve the JSON unchanged until that reconciliation is complete.

## Owner confirmation received (2026-10-30)

The owner has confirmed:
- The original Excel/Google Sheets stock spreadsheet is the authoritative inventory source.
- The October 29, 2026 orders and stock movements in the JSON are test/demo transactions, not genuine operational transactions.

Implementation gate remains blocked until the original spreadsheet is supplied or its accessible source is identified and its totals/branch/category rows are reconciled. The demo transaction records must be excluded from any production import, but preserved in the existing repository snapshot until a verified backup and reviewed import plan exist. Do not delete or rewrite the current JSON as part of this step.

Next safe step: obtain the original spreadsheet export (CSV/XLSX) or a directly accessible Google Sheets export. Build a read-only reconciliation report comparing its branch IDs/names and category quantities against the seed and JSON, then prepare a separately reviewed production import. Authentication provider and persistent database must be selected and configured before enabling write routes.

