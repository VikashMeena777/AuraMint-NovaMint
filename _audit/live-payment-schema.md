# Live payment schema evidence — verified read-only catalog snapshot

Date: 2026-09-17
Project: `drgparslvudatouqtjmx` (`AuraMint`, `ap-south-1`, Postgres `17.6.1.127`, `ga`)
Status: **LIVE SCHEMA OBTAINED — read-only. Verified against `pg_catalog` / `information_schema` and the
MCP server's own metadata tools. No SQL mutation of any kind was executed.**

History: the earlier "not obtained" blocker (project `INACTIVE`, every Postgres-backed MCP call timing out)
is documented in `_audit/database-availability.md`. The project became `ACTIVE_HEALTHY` at
2026-09-17T16:57:45Z (`_audit/database-restore.md`); these findings were captured immediately after, at
2026-09-17T16:59Z, and supersede every schema assumption in the previous revision of this file.

## 1. Access verification

| Check | Result |
|---|---|
| `get_project_url` | OK — project URL returned |
| `execute_sql "select 1"` | OK — `[{"probe":1}]` |
| `list_tables` / `list_migrations` / `list_extensions` | OK |
| Catalog sweep | 18/18 steps ok (see section 3 onwards) |

MCP server started as configured `@supabase/mcp-server-supabase` **stdio with `--read-only --project-ref
drgparslvudatouqtjmx`** (server-enforced read-only mode). Only metadata tools and catalog SELECTs were used;
no writes, no grants, no payments, no config edits.

## 2. Inventory (public schema)

| Class | Count | Detail |
|---|---|---|
| Tables | 7 | `activity_log`, `aura_events`, `friendships`, `orders`, `profiles`, `reactions`, `votes` |
| RLS | 7/7 enabled | `relrowsecurity = true`, `relforcerowsecurity = false` on every table |
| Row counts | 0 rows in every table | `pg_stat_user_tables.n_live_tup` and `list_tables` agree |
| Enums / domains | 0 | no `typtype in ('e','d')` types in `public` |
| Sequences | 0 visible | `information_schema.sequences` empty and no column default uses `nextval`; all UUID keys use `gen_random_uuid()` |
| Recorded migrations | none | `list_migrations` → `[]`; `supabase/migrations/` is empty |
| Installed extensions | 5 | `pgcrypto` 1.3 (`extensions`), `uuid-ossp` 1.1 (`extensions`), `pg_stat_statements` 1.11 (`extensions`), `supabase_vault` 0.3.1 (`vault`), `plpgsql` 1.0 (`pg_catalog`); 73 further extensions offered but not installed |
| Triggers (public) | 2 | both `BEFORE UPDATE ... FOR EACH ROW`, enabled |
| Functions (public) | 3 | `get_aura_tier`, `handle_new_user`, `update_updated_at` |

## 3. Columns (verbatim from `information_schema.columns`, `public`)

### public.orders — the payment table

| # | Column | Type | Null | Default / notes |
|---|---|---|---|---|
| 1 | `id` | uuid | NOT NULL | `gen_random_uuid()`; PRIMARY KEY |
| 2 | `user_id` | uuid | NOT NULL | FK → `auth.users(id)` ON DELETE CASCADE |
| 3 | `cashfree_order_id` | text | NULL | **no unique constraint, no index, not referenced by any constraint** |
| 4 | `amount` | numeric(10,2) | NOT NULL | |
| 5 | `currency` | text | NULL | `'INR'` |
| 6 | `status` | text | NULL | `'PENDING'`; CHECK `status IN ('PENDING','PAID','FAILED','REFUNDED')` |
| 7 | `plan` | text | NOT NULL | no CHECK constraint |
| 8 | `created_at` | timestamptz | NULL | `now()` |
| 9 | `updated_at` | timestamptz | NULL | `now()`; maintained by `orders_updated_at` trigger |

### public.profiles — entitlement fields live here

| # | Column | Type | Null | Default / notes |
|---|---|---|---|---|
| 1 | `id` | uuid | NOT NULL | PK; FK → `auth.users(id)` ON DELETE CASCADE |
| 2 | `username` | text | NOT NULL | UNIQUE (`profiles_username_key`) |
| 3 | `display_name` | text | NULL | |
| 4 | `avatar_url` | text | NULL | |
| 5 | `total_aura` | bigint | NULL | `0` |
| 6 | `current_tier` | text | NULL | `'NPC'` (mirrors `get_aura_tier()` thresholds) |
| 7 | `streak_days` | integer | NULL | `0` |
| 8 | `last_active_date` | date | NULL | |
| 9 | `is_premium` | boolean | NULL | **`false` (entitlement flag)** |
| 10 | `premium_expires_at` | timestamptz | NULL | **entitlement expiry** |
| 11 | `theme` | text | NULL | `'cosmic'` |
| 12 | `language` | text | NULL | `'en'` |
| 13 | `created_at` | timestamptz | NULL | `now()` |
| 14 | `updated_at` | timestamptz | NULL | `now()`; maintained by `profiles_updated_at` trigger |
| 15 | `username_changes` | timestamptz[] | NULL | `'{}'` |
| 16 | `boosts_remaining` | integer | NULL | `0` |

### public.aura_events

| Column | Type | Null | Default / notes |
|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()`; PK |
| `user_id` | uuid | NOT NULL | FK → `auth.users(id)` CASCADE |
| `description` | text | NOT NULL | CHECK `char_length(description) <= 280` |
| `aura_points` | integer | NOT NULL | |
| `ai_verdict` | text | NOT NULL | |
| `ai_vibe_tag` | text | NULL | |
| `ai_emoji` | text | NULL | |
| `category` | text | NOT NULL | |
| `is_public` | boolean | NULL | `true` |
| `reaction_counts` | jsonb | NULL | `{"npc":0,"fire":0,"crown":0,"skull":0,"yikes":0,"iconic":0}` |
| `upvotes` | integer | NULL | `0` |
| `downvotes` | integer | NULL | `0` |
| `created_at` | timestamptz | NULL | `now()` |
| `is_boosted` | boolean | NULL | `false` |
| `boosted_at` | timestamptz | NULL | |

### public.reactions

| Column | Type | Null | Default / notes |
|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()`; PK |
| `event_id` | uuid | NOT NULL | FK → `aura_events(id)` CASCADE |
| `user_id` | uuid | NOT NULL | FK → `auth.users(id)` CASCADE |
| `type` | text | NOT NULL | CHECK `type IN ('crown','skull','fire','yikes','iconic','npc')` |
| `created_at` | timestamptz | NULL | `now()` |

### public.votes

| Column | Type | Null | Default / notes |
|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()`; PK |
| `event_id` | uuid | NOT NULL | FK → `aura_events(id)` CASCADE |
| `user_id` | uuid | NOT NULL | FK → `auth.users(id)` CASCADE |
| `value` | integer | NOT NULL | CHECK `value IN (1, -1)` |
| `created_at` | timestamptz | NULL | `now()` |

### public.friendships

| Column | Type | Null | Default / notes |
|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()`; PK |
| `user_id` | uuid | NOT NULL | FK → `auth.users(id)` CASCADE |
| `friend_id` | uuid | NOT NULL | FK → `auth.users(id)` CASCADE |
| `status` | text | NULL | `'pending'`; CHECK `status IN ('pending','accepted','blocked')` |
| `created_at` | timestamptz | NULL | `now()` |

### public.activity_log

| Column | Type | Null | Default / notes |
|---|---|---|---|
| `id` | uuid | NOT NULL | `gen_random_uuid()`; PK |
| `user_id` | uuid | NULL | FK → `auth.users(id)` CASCADE |
| `action` | text | NOT NULL | |
| `metadata` | jsonb | NULL | `{}` |
| `created_at` | timestamptz | NULL | `now()` |

## 4. Constraints (from `pg_constraint`, all `validated = true`)

- **Primary keys**: `(id)` on all 7 tables.
- **Foreign keys** (all `ON DELETE CASCADE`): `activity_log.user_id`, `aura_events.user_id`,
  `friendships.user_id`, `friendships.friend_id`, `orders.user_id`, `profiles.id`, `reactions.user_id`,
  `reactions.event_id → aura_events`, `votes.user_id`, `votes.event_id → aura_events` — all referencing
  `auth.users(id)` except the two `aura_events` references.
- **Unique**: `friendships(user_id, friend_id)`, `profiles(username)`, `reactions(event_id, user_id)`,
  `votes(event_id, user_id)`.
- **Check**: `aura_events.description` length; `friendships.status`; `orders.status`;
  `reactions.type`; `votes.value`.
- **Not covered by any constraint**: `orders.cashfree_order_id`, `orders.plan`, `orders.amount > 0`.

## 5. Indexes (from `pg_indexes`, `public`)

`orders`: `orders_pkey` UNIQUE btree(`id`), `idx_orders_user` btree(`user_id`). **No index or unique index
on `cashfree_order_id` or `status`.**

`profiles`: `profiles_pkey` UNIQUE(`id`), `profiles_username_key` UNIQUE(`username`),
`idx_profiles_username` btree(`username`), `idx_profiles_total_aura` btree(`total_aura DESC`).

`aura_events`: `aura_events_pkey` UNIQUE(`id`), `idx_aura_events_created` btree(`created_at DESC`),
`idx_aura_events_public` btree(`is_public, created_at DESC`), `idx_aura_events_upvotes` btree(`upvotes DESC`),
`idx_aura_events_user` btree(`user_id`), `idx_aura_events_boosted` btree(`is_boosted`) WHERE `is_boosted = true`.

`votes`: `votes_pkey` UNIQUE(`id`), `votes_event_id_user_id_key` UNIQUE(`event_id, user_id`),
`idx_votes_event` btree(`event_id`), `idx_votes_user` btree(`user_id`).
`reactions`: `reactions_pkey` UNIQUE(`id`), `reactions_event_id_user_id_key` UNIQUE(`event_id, user_id`),
`idx_reactions_event` btree(`event_id`), `idx_reactions_user` btree(`user_id`).
`friendships`: `friendships_pkey` UNIQUE(`id`), `friendships_user_id_friend_id_key` UNIQUE(`user_id, friend_id`),
`idx_friendships_user` btree(`user_id`), `idx_friendships_friend` btree(`friend_id`).
`activity_log`: `activity_log_pkey` UNIQUE(`id`), `idx_activity_log_created` btree(`created_at DESC`),
`idx_activity_log_user` btree(`user_id`).

## 6. Triggers

| Table | Trigger | Timing | Function | Status |
|---|---|---|---|---|
| `orders` | `orders_updated_at` | BEFORE UPDATE, FOR EACH ROW | `update_updated_at()` | enabled |
| `profiles` | `profiles_updated_at` | BEFORE UPDATE, FOR EACH ROW | `update_updated_at()` | enabled |

## 7. Functions (`public`)

| Function | Args → Returns | Security | Volatility | Notes |
|---|---|---|---|---|
| `get_aura_tier` | `bigint → text` | invoker | IMMUTABLE | pure tier-threshold mapping (<5000 NPC, <25000 Civilian, <100000 Rising Star, <500000 Main Character, <1000000 Legendary, <5000000 Mythical, else GOD MODE; <0 Negative Aura) |
| `handle_new_user` | `→ trigger` | **SECURITY DEFINER** | VOLATILE | inserts a `profiles` row from `auth.users` metadata; its trigger lives on `auth.users` (outside `public`, not enumerated here) |
| `update_updated_at` | `→ trigger` | invoker | VOLATILE | sets `NEW.updated_at = NOW()` |

**No payment/entitlement RPC exists.** There is no `SECURITY DEFINER` function in `public` that a payment
grant could reuse.

## 8. RLS policies (`pg_policies`, all PERMISSIVE, all applied to role `public`)

| Table | SELECT | INSERT (with check) | UPDATE | DELETE |
|---|---|---|---|---|
| `orders` | own (`user_id = auth.uid()`) | own (`user_id = auth.uid()`) | **none** | **none** |
| `profiles` | `true` (everyone) | own (`auth.uid() = id`) | own (`auth.uid() = id`) | **none** |
| `aura_events` | `is_public = true OR user_id = auth.uid()` | own | own | own |
| `reactions` | `true` | own | **none** | own |
| `votes` | `true` | own | own | own |
| `friendships` | own or friend | own | own or friend | own |
| `activity_log` | own | own | **none** | **none** |

## 9. Base-table privileges (from `pg_class.relacl` via `aclexplode`, not privilege-filtered)

Every one of the 7 tables grants the identical set to `anon`, `authenticated`, `postgres` and
`service_role`: `DELETE, INSERT, MAINTAIN, REFERENCES, SELECT, TRIGGER, TRUNCATE, UPDATE`. No `PUBLIC`
grantee entries. This is the standard Supabase default grant set for `public`; RLS is the enforcement layer
for PostgREST traffic, and `TRUNCATE`/`MAINTAIN` are not reachable through PostgREST verbs.

Provenance note: the probe's original `information_schema.role_table_grants` query returns an empty set
because that view is privilege-filtered for the read-only DB role; the ACL query against `pg_class` was
added for this reason and its result is the one to trust. Both are retained in the evidence file.

## 10. Payment-relevant verified facts and their implications

Verified facts:

1. `orders` is the only application payment table: 9 columns, no gateway-payload column, no
   `paid_at`/`payment_id`/`payment_method`, no unique constraint on `cashfree_order_id`.
2. Status is a text column with a 4-value CHECK (`PENDING/PAID/FAILED/REFUNDED`), default `PENDING`;
   `plan` is free-form text with no CHECK.
3. `updated_at` is maintained by a BEFORE UPDATE trigger on `orders`.
4. Entitlement state lives on `profiles` (`is_premium boolean DEFAULT false`,
   `premium_expires_at timestamptz`), not on a dedicated table. There is no subscription, entitlement,
   ledger, invoice or plan table anywhere outside Supabase-internal schemas (`realtime.subscription` is
   Realtime's own registry, not application data).
5. RLS on `orders` allows only own-row SELECT and own-row INSERT; there is **no UPDATE and no DELETE
   policy**. With RLS enabled, non-bypassing roles (anon/authenticated) are default-denied those actions
   even though the base table grants UPDATE/DELETE.
6. RLS on `profiles` allows the owner to UPDATE their own row, and the base grant gives `authenticated`
   UPDATE on every column; no column-level restrictions were found in the table ACL.

Implications (inference, clearly labelled as such — not live-tested because the session was read-only):

- A conditional `UPDATE ... WHERE status = 'PENDING'` CAS claim on `orders` cannot lean on a unique index
  over `cashfree_order_id` today; either add a unique index/constraint or make the CAS predicate explicit
  inside one transaction.
- Because no UPDATE policy exists on `orders`, the user-facing client cannot change an order's status; the
  write path must currently run with `service_role` (bypasses RLS) or would need a new SECURITY DEFINER
  function.
- Because the `profiles` UPDATE policy is owner-scoped and the UPDATE grant is table-wide, a signed-in user
  can in principle write `is_premium` / `premium_expires_at` on their own profile through PostgREST, i.e.
  grant themselves premium, unless a column-level revoke or a stricter policy is added. This is derived from
  the verified policy text plus the verified base grant; no such write was attempted here.
- All tables are empty (0 rows), so there is no existing payment or entitlement data to reconcile or
  migrate; a schema change can be applied without data-preservation constraints (still out of scope here).

## 11. Not verified (explicit gaps)

- Column-level ACLs (`pg_attribute.attacl`) were not enumerated; only table-level ACLs were read.
- No RLS behaviour was exercised empirically; all analysis of policy effects is static.
- `auth` schema internals (including the trigger on `auth.users` that invokes `handle_new_user`) were not
  enumerated.
- `orders.plan` allowed values and `amount` sanity are not constrained by the database.

## 12. Method, evidence and reproduction

Probe scripts (read-only; kept as provenance):
- `_audit/mcp-single-probe.mjs` — one platform call + `select 1`.
- `_audit/mcp-schema-probe.mjs` — full catalog sweep. Two of its catalog queries were corrected during this
  run: the `information_schema.sequences` column names, and the addition of a `pg_catalog`-based ACL query
  (`table_grants_pg_catalog`) beside the privilege-filtered original.

Raw sanitized outputs: `_audit/mcp-evidence/probe-results.json` (full sweep),
`_audit/mcp-evidence/single-probe.json`, plus the restore evidence in `_audit/mcp-evidence/restore-*.json`.

```bash
cd "C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint"
node _audit/mcp-single-probe.mjs    # get_project_url + select 1
node _audit/mcp-schema-probe.mjs    # catalog sweep -> _audit/mcp-evidence/probe-results.json
```

Secret hygiene: the `sbp_` token is read from the configured MCP server env, never printed; probe output is
redacted and the persisted evidence files match no `sbp_`/JWT/`postgres://`/`password=` pattern.
