# EyeKart Supply Dashboard — Repair and Release Plan

Status: repair is isolated to `repair/production-backend`. A read-only Vercel API fallback has been added to prevent API 404s and serve the verified screenshot baseline. This is **not yet production-ready for stock writes**. No production deploy has been performed by this work.

## Root cause

- The frontend called `/api/branches`, `/api/orders`, `/api/alerts`, `/api/activity-log`, `/api/validation`, and `/api/warehouse`.
- The repository previously had an Express API in `server.ts`, but the Vercel project built only the Vite frontend. With no Vercel function routes, API requests returned 404.
- The existing Express service persists to a local JSON file/in-memory cache and trusts client-supplied `x-user-role`, `x-user-id`, `x-user-email` and body actor fields. Those are not production authentication and do not provide durable/concurrency-safe storage.

## Inventory reconciliation completed against screenshot baseline

Owner confirmed that the phone screenshot titled **SSD FRAME LIST** is the only stock source artifact and there is no XLSX/CSV. The branch values in `src/data/initialBranches.ts` reconcile with the visible rows and printed total:

| Measure | Verified baseline |
|---|---:|
| Listed branch rows | 35 |
| Male | 1,500 |
| Female | 1,830 |
| Kids | 410 |
| **Total** | **3,740** |

Every seed row's category sum equals its row total. SRNs 3 and 35 are absent; no phantom branch is created. SRN 1 is retained as displayed (`Bliss BusiaB3:D27`); `Bliss Busia` is only a candidate canonical label and remains unconfirmed.

The exact difference from `data/eyekart_db.json` is identified:
- **SRN 8 — Bliss Githurai:** screenshot 40/50/10 = 100; JSON 20/20/9 = 49; source minus JSON = +51.
- **SRN 10 — Bliss Iten:** screenshot 0/0/0 = 0; JSON 10/10/10 = 30; source minus JSON = −30.
- Net total difference = +21. Category deltas (source minus JSON): Male +10, Female +20, Kids −9.

The reproducible row-level transcription/comparison is in `docs/SSD_FRAME_LIST_RECONCILIATION.csv` and the result summary is in `docs/INVENTORY_RECONCILIATION.md`.

The original `data/eyekart_db.json` has **not** been overwritten. The owner confirmed its October 29 orders/movements are demo transactions. Those records are excluded from the read-only API; activity log and orders are currently empty. Warehouse stock is not established by the screenshot and is deliberately returned as unknown/null rather than invented.

## Vercel API fallback added (isolated branch only)

- `api/[...path].ts` provides Vercel function routes for the API GET endpoints.
- It builds branch balances from `src/data/initialBranches.ts` and fails closed if counts/category totals do not equal the verified baseline.
- It serves the baseline branches, branch detail, empty order/activity history, baseline stock alerts, source reconciliation, and a baseline-only monthly report.
- It returns `warehouse: null` because the screenshot does not state warehouse balances.
- All mutation requests return HTTP 503 with `READ_ONLY_SNAPSHOT`; no stock/order/admin writes are accepted.
- The UI displays a warning when `VITE_API_BASE_URL` is unset, explaining this is read-only, baseline-only mode and the demo role switcher is not authentication.
- A smoke-test script checks totals, Githurai/Iten corrections, exclusion of demo orders/movements, unknown warehouse, and blocked writes.
- GitHub Actions workflow `.github/workflows/validate-repair.yml` runs type-check, smoke test and Vite build.

This fallback is a **safe bridge** to fix the missing API routes and give the UI verified baseline data. It is not a live operational backend: data are snapshot-only, and changes are intentionally disabled. The Vercel site must not be used as the live stock-management system until the security/persistence gates below are completed.

## Recent deployment-readiness changes

- `npm start` runs `tsx server.ts`.
- Express honours hosting `PORT`.
- Frontend API client supports `VITE_API_BASE_URL` for an eventual secure API service.
- `.env.example` documents the API URL and port configuration.
- `docs/BACKEND_DEPLOYMENT_NOTES.md` covers hosted API requirements.

## Production gates still open

### Authentication and authorization
- Replace preset-user/role switching as proof of identity with a selected real identity provider.
- Verify signed identity tokens server-side.
- Enforce roles on every relevant read and mutation endpoint; ignore client-supplied role/email/id/actor values for authorization.
- Add exact-origin CORS allowlisting, request schemas, safe error handling and rate limits.

### Durable database and transaction integrity
- Configure a managed durable database (e.g. hosted PostgreSQL) and secret environment variables in the hosting account.
- Use transactional stock/order workflows, persistent idempotency, audit trails, backups and restore validation.
- Migrate only verified inventory balances; exclude the demo orders/movements.
- Keep the existing JSON as an audit snapshot and stage a separate dry-run import. Do not update stock until reviewed.

### Deployment and verification
- Run GitHub CI and resolve all failures.
- Deploy/preview the branch through the linked Vercel project and verify `/api/health`, `/api/branches`, `/api/validation`, plus 503 on mutations.
- Confirm the dashboard no longer shows the connection error and shows the read-only banner.
- Configure authenticated persistent production backend before removing read-only mode.
- Do not merge, deploy as production, or change `main` until reviewed and explicitly approved.

## State of truth

Inventory screenshot reconciliation: **complete for branch starting balances**. API 404: **addressed in branch by new Vercel functions, awaiting CI/Vercel deployment verification**. Production writes, verified auth, warehouse stock and transaction history: **not solved/configured**. No database or production credentials are available in this environment; no production deployment has been performed.