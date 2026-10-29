# EyeKart Supply Dashboard — Production Repair Plan

Status: investigation and isolated-branch repair only. No application behavior, inventory data, or production deployment has been changed by this document.

## Confirmed repository findings

- Frontend API client uses `API_BASE = '/api'`.
- Express API routes are defined in `server.ts`, but the Vercel deployment returned 404 for API paths.
- `package.json` uses `vite build`; this does not itself deploy/run the Express server.
- `server.ts` reads/writes `data/eyekart_db.json`, which is not durable storage for a serverless deployment.
- The JSON file currently contains 35 branches and related orders, movements, alerts, validation issues, warehouse, users, and settings.
- The backend currently derives authorization from client-controlled headers/body fields. These must not be trusted for production authorization.
- There is no known EyeKart Firebase project. Firestore must not be assumed to be an existing source of truth.

## Safety rules

1. Do not edit `main` or deploy from this branch.
2. Do not reset, replace, or overwrite `data/eyekart_db.json`.
3. Do not import into a database until the current JSON is backed up, schema-validated, reconciled against the screenshot baseline and operational records, and reviewed.
4. Treat sample/demo users and activity in the JSON as non-production unless independently verified.
5. Never trust `x-user-role`, `x-user-id`, `x-user-email`, or body fields as proof of identity or role.
6. Never expose secrets or configure public database write access.

## Recommended target architecture

- Keep the existing Vite/React frontend on Vercel.
- Deploy the Express API as a separate persistent backend service initially, unless deliberately refactored into Vercel-compatible serverless functions.
- Configure the API base URL via an environment variable.
- Add verified authentication and server-side role authorization before enabling production writes.
- Move persistent state from local JSON to a managed durable database only after source reconciliation.
- Add transactions/consistency controls for stock movements and order receiving, audit logging, and idempotency.

## Read-only data audit (2026-10-30)

- The JSON parses and contains 35 branches, 4 orders, 52 movements, 5 alerts, 6 validation issues, 5 warehouse entries, and 3 seeded user records.
- Branch IDs and SRNs are unique. SRN 3 and SRN 35 are absent in the supplied list; do not invent branches for these gaps.
- The JSON currently sums to 3,719 frames (Male 1,490; Female 1,810; Kids 419). The seed validation note claims 3,740 (Male 1,500; Female 1,830; Kids 410). The discrepancy is -21 total, with category differences of -10, -20, +9.
- JSON includes dated October 29 orders and movements. The owner confirmed these are test/demo transactions and not genuine operational transactions.
- Seed user records do not prove real authenticated identities.
- Warehouse figures also require independent verification before migration.

## Owner-provided screenshot baseline (received 2026-10-29)

The owner confirmed there is no XLSX/CSV file; the supplied phone screenshot is the only available source artifact and is to be treated as the inventory baseline. The screenshot is titled **SSD FRAME LIST**, sheet **Sheet1**, with columns SRN, BRANCH, MALE FRAMES, FEMALE FRAMES, KIDS, REMARKS, TOTAL. It visibly reports a total of **3,740 frames**.

The screenshot visibly contains these important cases:
- SRN 1 branch text appears as `Bliss BusiaB3:D27` (likely spreadsheet artifact; canonical name needs confirmation before normalizing).
- SRN 3 and SRN 35 are absent; do not create fictitious branches.
- Zero-stock highlighted rows: SRN 2 Bliss Diani, SRN 10 Bliss Iten, SRN 28 Bliss Ol Kalou, SRN 29 Bliss Rongai.
- SRN 30 Bliss Siaya shows 40 Male, 50 Female, 0 Kids, total 90.
- Remarks visible on rows are `MIX Metals &Plast`.

The screenshot is a visual record, not a machine-readable spreadsheet. Any manual transcription must be independently checked against the visible row totals and the declared sheet total before being used as an import. The declared total of 3,740 must not be assumed to validate every row automatically. Until the full row-by-row manual transcription is verified, do not use an automatically generated import or alter the current JSON.

## Required gates

### Gate A — source transcription and reconciliation (in progress)
- Transcribe all 35 listed branch rows from the screenshot into a separate review artifact; preserve displayed names exactly.
- Validate each row total against its three categories and sum category totals across all rows.
- Compare against the JSON by SRN, branch name, and category; identify exact row-level differences.
- Mark uncertain/OCR-ambiguous values for review rather than guessing.
- Keep the JSON unchanged; prepare a separate proposed import only after reconciliation.

### Gate B — backend and auth
- Implement deployment/runtime configuration and a health check.
- Ensure all frontend-used API endpoints are served by the backend.
- Replace client-trusted identity/role fields with verified server identity and role authorization.
- Add CORS allowlisting, request validation, and safe error responses.

### Gate C — durable persistence
- Select and configure a managed database.
- Write a one-time, idempotent migration with dry-run/report mode.
- Verify record counts and reconciled totals before switching reads/writes.
- Keep the original JSON backup unchanged and recoverable.

### Gate D — tests and release
- Run type-check/build/tests and API integration tests.
- Test unauthorized access, role permissions, stock adjustments, alerts, orders, warehouse, reporting, and persistence across restart.
- Verify no write request succeeds without authentication.
- Review changes via pull request; do not deploy until explicitly approved.

## Current decision

The screenshot is the owner-designated inventory baseline. The October 29 JSON orders/movements are demo data and must be excluded from any production import, while the current JSON remains preserved as an audit snapshot. No production database has been confirmed or configured. No migration, database creation, inventory overwrite, production deployment, or changes to `main` are authorized.