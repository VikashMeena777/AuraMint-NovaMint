# Database availability — AuraMint live project (bounded diagnosis)

Date: 2026-09-17
Project ref: `drgparslvudatouqtjmx` (verified, exact match to `NEXT_PUBLIC_SUPABASE_URL` host in `auramint/.env.local`)
Verdict: **PROJECT IS INACTIVE (PAUSED) — ROOT CAUSE IDENTIFIED. Stopped by rule: no resume, no restart, no retry, no mutations.**

## 1. Proven facts (single authenticated request)

| Item | Value |
|---|---|
| Endpoint | `GET https://api.supabase.com/v1/projects/drgparslvudatouqtjmx` |
| Requested at | 2026-09-17T16:47:16.352Z (UTC) — 22:17 IST |
| HTTP status | **200** (duration 466 ms) |
| `id` returned | `drgparslvudatouqtjmx` — equals env-derived ref, no ambiguity |
| `name` | `AuraMint` |
| `region` | `ap-south-1` |
| `status` | **`INACTIVE`** |
| `created_at` | 2026-05-27T16:11:25.839834Z |
| `database.postgres_engine` | `17` |
| `database.version` | `17.6.1.127` |
| `database.release_channel` | `ga` |

Auth: `Authorization: Bearer <SUPABASE_ACCESS_TOKEN>` read from the configured MCP server env
(`Automations/.zcode/config.json` → `mcp.servers.supabase.env`; `sbp_` personal access token).
The value was never printed. `database.host` and all connection material were deliberately excluded
from the evidence allowlist. Sanitized evidence: `_audit/mcp-evidence/management-project-details.json`.

Secret hygiene verified after write: grep for `sbp_…`, JWT-shaped, and `postgres://` / `password=` patterns
across `_audit/` returns no matches.

## 2. What is now ruled out (not speculation — each has positive evidence)

- **Bad/expired token** — ruled out. Management API returned 200 with a real project body, so the token
  is valid and authorized for this project.
- **Wrong project ref** — ruled out. Returned `id` matches the ref derived from `.env.local` exactly,
  and the project name is `AuraMint`.
- **MCP server misconfiguration / bad handshake** — ruled out previously: stdio handshake and the
  non-DB tools (`get_project_url`) succeed.
- **Application-level SQL error (syntax, RLS, permissions)** — ruled out: every failure is
  `Connection terminated due to connection timeout`, i.e. it fails before any statement is validated.

## 3. Inferred cause (inference, clearly labelled)

Supabase reports the project status as `INACTIVE`, which is the paused/inactive state in which the
Postgres instance is not serving connections. This is consistent with — and sufficient to explain —
the deterministic `Connection terminated due to connection timeout` returned by every
Postgres-backed MCP tool (`execute_sql`, `list_tables`, `list_migrations`) across all 15 prior
attempts, while platform-API tools continued to work.

- **Proven:** project status is `INACTIVE`; platform API reachable; Postgres-backed tools time out.
- **Inferred:** the pause is the cause of the timeouts. The exact transport path was not traced, and
  no second cause (e.g. local egress filtering) was independently excluded. Note that a paused
  project is alone sufficient to produce this exact failure, so no additional explanation is required.
- **Not attempted:** the documented health/status endpoint was not called, because the project-details
  response already carried an authoritative `status` field. (Doc pages tried for the status enum,
  `supabase.com/docs/reference/api/v1-get-a-project` and `/docs/guides/platform/project-status`,
  both returned HTTP 404, so no doc citation is claimed.)

## 4. Actions taken / deliberately NOT taken

Taken: one Management API GET; sanitized evidence write; leak-guard grep.

Deliberately NOT taken, per the pause rule and scope:
- No resume / unpause / restart, and no project-settings mutation of any kind.
- No MCP `SELECT 1` retry (permitted only for an active project; the project is inactive).
- No additional Management API calls (no health endpoint, no retry).
- No SQL, no schema writes, no migrations.
- No config edits, no credential rotation or reset.
- No connection strings, hosts, or passwords retrieved into the report.

## 5. Consequence and next step

No live schema was obtained. `_audit/live-payment-schema.md` remains accurate: the schema for
`orders`/`profiles` and any subscription/entitlement tables is **still unverified**, and no migration
should be written against assumed columns.

Operator action (outside this read-only scope): restore/unpause the project in the Supabase dashboard.
After the project reports active/healthy, re-run the existing read-only probes unchanged:

```bash
cd "C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint"
node _audit/management-project-details.mjs   # re-verify status flips from INACTIVE (single GET)
node _audit/mcp-single-probe.mjs             # get_project_url + select 1
node _audit/mcp-schema-probe.mjs             # full read-only catalog sweep once SELECT 1 passes
```

Anything beyond that (unpausing, further retries) was intentionally left to the operator.
