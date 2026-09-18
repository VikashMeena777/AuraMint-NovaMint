# Payment lifecycle checkpoint — 2026-09-17

Status: BLOCKED, not production-approved.

## Request-to-evidence checklist

| Required deliverable | Evidence / current result |
|---|---|
| Read live AuraMint schema through Supabase MCP, read-only | MCP handshake and get_project_url succeeded for drgparslvudatouqtjmx. Database-backed calls, including SELECT 1, returned connection timeout. No schema obtained. See live-payment-schema.md and mcp-evidence/. |
| Atomic order claim + entitlement grant RPC migration | Not implemented: columns, constraints, triggers, policies, and existing entitlement lifecycle remain unverified. No assumed-schema migration created. |
| Wire webhook and verifyPayment to atomic transaction | Not implemented; current separate claim/grant and recovery remain. |
| Scheduled entitlement reconciler | Not implemented; no verified purchase-linked ledger or safe expiry/revocation semantics to reconcile. No recurring automation created. |
| Regression verification | Rerun: payment-final-hardening-tests.mjs 27/27; combined six suites 103/103; npx tsc --noEmit exit 0. These tests do not establish transactional atomicity or live integration. |

## Access blocker

Exact response: `Failed to run sql query: Connection terminated due to connection timeout`.

Platform API availability does not establish database availability. The cause of the database timeout is not diagnosed; no restart, resume, password change, or configuration change was attempted based on this symptom. Local environment has no database connection URL for a direct SQL fallback. Existing service-role REST credentials are not equivalent to SQL access.

Unblocking evidence required: successful read-only schema access, or a current schema-only export including policies, triggers, functions, grants and constraints. Do not paste secrets into chat.

## Corrections to previous completion claims

- Passing tests and geometry measurements do not constitute full production or visual acceptance.
- Direct DOM activation verified coin receipt count, serial and live announcement only. It did not establish receipt remount/animation frame quality. Failed pointer/keyboard attempts do not conclusively identify a browser-bridge bug or exonerate application behavior.
- Fixed after checkpoint: markOrderFailed excludes both PAID and FAILED rows. The route now preserves `updated`; the webhook re-reads zero-row outcomes and acknowledges only confirmed PAID/FAILED states. Missing/unreadable/still-PENDING results return retryable 500. Regression tests cover terminal no-ops, pending failures, lookup errors and matched foreign-currency refusal before claim/grant.
- Final verification: all six suites 106/106 passed; subsequently the exact three-backend-suite command passed 89/89, with full-source eslint and tsc --noEmit both exit 0. Final backend output is in payment-contract-check.log. Production build was not rerun after this small contract change; the previous build predates it.
- Analytics classification has source-wiring regression coverage, not a runtime test of getAnalyticsData against real query results.

No live schema mutations, payments, grants, deployment or configuration changes performed in this checkpoint.
