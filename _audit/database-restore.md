# AuraMint database restore — outcome (operator-authorized)

Date: 2026-09-17
Project: `drgparslvudatouqtjmx` — `AuraMint`, region `ap-south-1`, Postgres `17.6.1.127` (release channel `ga`)
Scope: bring the INACTIVE (paused) project back online under the operator's explicit approval, then verify
with the existing read-only probes. Migrations were explicitly NOT authorized and were not applied.

Verdict: **PROJECT RESTORED — `ACTIVE_HEALTHY` since 2026-09-17T16:57:45Z. Read-only DB access verified.
No migrations applied, no credentials changed, no project settings mutated.**

## 1. Documented endpoint (researched before any state-changing call)

Primary source, the official OpenAPI spec that backs the Management API docs
(`https://api.supabase.com/api/v1-json`):

| Item | Value |
|---|---|
| Endpoint | `POST /v1/projects/{ref}/restore` |
| operationId | `v1-restore-a-project` |
| Summary | "Restores the given project" |
| Request body | **none** (the spec declares no requestBody) |
| Auth | bearer token; OAuth scope `projects:write`; fine-grained permission `project_admin_write` |
| Documented responses | `200` success, `401`, `403`, `429` |

Secondary source: `https://supabase.com/docs/reference/api/v1-restore-a-project` (same method/path, no body,
same documented responses). The spec contains **no separate "unpause" endpoint**; the documented pair is
`POST /v1/projects/{ref}/pause` ("Pauses the given project") and `POST /v1/projects/{ref}/restore`. The
documented status enum includes `INACTIVE`, `COMING_UP`, `RESTORING`, `ACTIVE_HEALTHY`, `RESTORE_FAILED`,
so the paused → restore → healthy lifecycle is a documented state machine.

## 2. What was actually executed (timeline, all times UTC)

| Time | Action | Result |
|---|---|---|
| 16:47:16Z (prior session) | `GET /v1/projects/{ref}` (`management-project-details.mjs`) | 200, status `INACTIVE` |
| 16:54:20Z (this session) | `GET /v1/projects/{ref}` — re-check before acting | 200, id `drgparslvudatouqtjmx`, name `AuraMint`, status **`INACTIVE`** |
| 16:54:43Z | Guarded one-shot script preflight (`restore-project.mjs`) | 200, status **`COMING_UP`** → restore already in flight |
| 16:54:43Z | Documented `POST /v1/projects/{ref}/restore` | **NOT SENT** — guard refused to duplicate a restore that was already underway; recorded as `issued: false` in `_audit/mcp-evidence/restore-request.json` |
| 16:55:01Z → 16:57:45Z | Bounded poll (20 s interval, 24 attempts max) | `COMING_UP` (x8) → `RESTORING` (+144 s) → **`ACTIVE_HEALTHY` (+165 s)** |

The `INACTIVE → COMING_UP` transition was observed between two read-only GETs, i.e. the restore was
initiated outside this session (operator dashboard action or another authorized automation). This session
issued **no state-changing request of any kind**: its only HTTP calls were documented read-only
`GET /v1/projects/{ref}` reads, all logged in the evidence files. Consequently the "issue restore exactly
once" authorization was satisfied trivially — nothing was sent, so nothing can have been double-issued.

## 3. Post-restore verification (read-only only)

| Check | Result |
|---|---|
| Minimal MCP probe (`_audit/mcp-single-probe.mjs`, `--read-only`) | OK — `get_project_url` returned the project URL; `execute_sql "select 1"` returned `[{"probe":1}]` |
| Full catalog sweep (`_audit/mcp-schema-probe.mjs`, `--read-only`) | **18/18 steps ok** (7 tables catalogued, constraints/indexes/triggers/RLS/functions/ACLs, 0 rows everywhere) |
| Schema findings | Recorded in `_audit/live-payment-schema.md` |

## 4. Deliberately NOT done (scope discipline)

- No `POST /restore` duplicate; no `POST /pause`; no restart, resize, or upgrade.
- No credential, JWT, API-key, or network-setting change; no config-file edits.
- No migrations applied; `supabase/migrations/` remains empty and `list_migrations` remains `[]`.
- No other projects touched; no application tests re-run; no source modified.
- MCP server always started with `--read-only`; only metadata and `pg_catalog`/`information_schema` SELECTs.

## 5. Secret hygiene

The `sbp_` personal access token was read only from the configured MCP server env
(`Automations/.zcode/config.json` → `mcp.servers.supabase.env`) and never printed. All persisted artefacts
pass a redactor (`sbp_…`, JWT-shaped, `Bearer …`, DB URLs, `password=`); a grep for `sbp_`/JWT patterns
across `_audit/` returns no matches.

## 6. Evidence files and reproduction

```
_audit/mcp-evidence/management-project-details.json   # 16:54:20Z read: INACTIVE, exact project identity
_audit/mcp-evidence/restore-request.json              # documented endpoint cited; POST issued: false
_audit/mcp-evidence/restore-poll.json                 # 9 polls -> ACTIVE_HEALTHY (+165 s)
_audit/mcp-evidence/single-probe.json                 # get_project_url + select 1 = OK
_audit/mcp-evidence/probe-results.json                # full read-only catalog sweep (sanitized)
```

```bash
cd "C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint"
node _audit/management-project-details.mjs   # project identity + current status
node _audit/poll-project-status.mjs          # bounded read-only status polling (if ever paused again)
node _audit/mcp-single-probe.mjs             # minimal read-only DB reachability
node _audit/mcp-schema-probe.mjs             # full read-only catalog sweep
```

`_audit/restore-project.mjs` is the guarded one-shot restore request (re-runnable safely: it refuses to
POST unless the project is `INACTIVE`, and only ever sends one request).
