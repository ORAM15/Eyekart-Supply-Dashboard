# EyeKart Supply Dashboard — Production Repair Plan

Status: investigation only. No application code, inventory data, or production deployment has been changed.

## Confirmed technical findings

- Frontend API client uses `API_BASE = '/api'`; the Vercel deployment returned 404 for API paths.
- Express routes are defined in `server.ts`, but `package.json` runs `vite build`; this does not deploy the Express server.
- The server reads/writes `data/eyekart_db.json`, unsuitable as durable storage for a serverless runtime.
- Backend authorization currently trusts client-controlled identity/role headers or body fields. These are spoofable and must not authorize production actions.
- No existing EyeKart Firebase project is confirmed.

## Owner confirmations

- The phone screenshot titled **SSD FRAME LIST** is the only available inventory source artifact; there is no XLSX/CSV file.
- The screenshot's displayed grand total is **3,740 frames**.
- October 29, 2026 orders and movements in the JSON are test/demo transactions, not genuine operational transactions.
- Do not touch `main`, deploy, or overwrite the existing JSON before review.

## Read-only JSON audit

The JSON parses and has 35 branch records, 4 orders, 52 movements, 5 alerts, 6 validation issues, warehouse values, and 3 seeded user records. The JSON branch totals previously audited are 3,719 frames (Male 1,490; Female 1,810; Kids 419). A seed validation note claims 3,740 (Male 1,500; Female 1,830; Kids 410). These do not reconcile.

Branch IDs/SRNs are unique in JSON, but the source list has gaps at SRNs 3 and 35. Do not invent branches to fill those gaps. SRN 1 name includes `B3:D27`, likely an accidental spreadsheet artifact; preserve it as displayed until the canonical name is confirmed.

## Preliminary screenshot transcription check — not import-ready

A first manual visual pass is **not yet safe to treat as an exact transcription**. Adding the values provisionally read from the visible rows yields a total inconsistent with the screenshot's displayed grand total of 3,740. At least one value may have been misread during visual transcription, the screenshot resolution may be insufficient for reliable extraction, or the displayed total/cells may be inconsistent. The prior seed category totals must not be substituted for verified row-level data.

**Decision:** do not create or apply a stock import from this manual pass. The screenshot remains the only source artifact, but exact row-by-row values must be reviewed at higher zoom/cropped sections or confirmed by the owner before migration. If no higher-resolution source exists, record each uncertain cell and ask for explicit confirmation rather than guessing.

## Safe implementation order

### Gate A — data reconciliation (blocked)
- Transcribe rows at readable zoom; retain exact displayed SRNs and names.
- Check each row total equals Male + Female + Kids.
- Sum each category and all row totals; compare with the displayed 3,740.
- Compare verified values with JSON by SRN/name/category and produce a row-level diff.
- Exclude demo orders/movements from any production import but preserve the JSON snapshot.

### Gate B — backend and authentication (not started)
- Implement backend deployment/runtime configuration and health check.
- Ensure all frontend API endpoints are served.
- Replace client-trusted identity/role values with verified server identity and server-side role checks.
- Add CORS allowlisting, input validation, safe errors, and tests.

### Gate C — durable persistence (not started)
- Select and configure a managed database only after source reconciliation.
- Prepare a one-time idempotent migration with dry-run reporting.
- Verify counts/totals and retain a recoverable JSON backup before switching writes.

### Gate D — release (not started)
- Run build/type-check/tests and API integration tests.
- Verify unauthorized writes fail, roles are enforced, and data survives restarts.
- Review changes through a pull request; do not deploy until explicitly approved.

## Current decision

The API 404 and unsafe authorization issues are known, but no application code has yet been changed. The inventory discrepancy is unresolved. No database has been configured, no migration has been run, no production deployment has occurred, and `main` has not been changed.