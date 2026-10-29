# Backend Deployment Notes (repair branch)

## Current code changes
- `npm start` now runs the TypeScript Express entry point with `tsx`.
- Express listens on the platform-provided `PORT` (falls back to 3000).
- The frontend API client reads `VITE_API_BASE_URL`; if unset it keeps using same-origin `/api`.

## Why this does not by itself fix the live Vercel deployment
Vercel currently builds the Vite frontend. It does not run the long-lived Express process merely because `server.ts` exists in the repository. The API must be deployed as a separate Node service or intentionally refactored into serverless functions. Configure Vercel's `VITE_API_BASE_URL` to the actual API origin plus `/api`, then rebuild the frontend. Do not use the example placeholder in `.env.example`.

## Required before connecting a real database or enabling writes
1. Add a real identity provider and verify its signed access token server-side. Client-supplied `x-user-role`, `x-user-id`, `x-user-email`, and body actor fields are not authentication.
2. Apply server-side authorization to every read/write route as appropriate. Current role middleware is not production-safe.
3. Configure strict CORS for the exact deployed frontend origin.
4. Replace JSON-file persistence with a managed database or prove a persistent-volume strategy appropriate to the chosen host. Multiple API instances cannot safely share the current in-memory cache/file writes.
5. Add database transactions, idempotency persistence, input schemas, rate limiting, safe errors, backups and restore tests.
6. Configure a real health check and test every API endpoint against the deployed backend.
7. Run build/type-check and integration tests; inspect the diff; review via pull request.

## Safety
Do not point the frontend at an API that has real inventory writes enabled until identity verification, authorization and durable persistence have been implemented and tested. No production URL, credentials, or database are configured by this document. No production deployment has been performed.
