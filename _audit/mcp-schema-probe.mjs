// Read-only live-schema probe via the configured Supabase MCP stdio server.
// - Reads MCP server config from workspace/user .zcode/config.json (never prints secrets).
// - Starts the server with --read-only --project-ref <ref> (no config file writes).
// - Calls only metadata/read-only tools. No SQL mutations, no payments, no grants.
// Output: _audit/mcp-evidence/*.json  (sanitized, metadata only)

import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = "C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint";
const WS_CONFIG = "C:/Users/Vikash Meena/Desktop/Automations/.zcode/config.json";
const USER_CONFIG = "C:/Users/Vikash Meena/.zcode/cli/config.json";
const OUT_DIR = path.join(ROOT, "_audit", "mcp-evidence");
const SDK_BASE = "C:/Users/Vikash Meena/AppData/Roaming/npm/node_modules/@modelcontextprotocol/sdk/dist/esm/";

const REDACT = (s) =>
  String(s)
    .replace(/sbp_[A-Za-z0-9]+/g, "sbp_[REDACTED]")
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[REDACTED-JWT]")
    .replace(/(Bearer\s+)[A-Za-z0-9._-]{10,}/gi, "$1[REDACTED]");

function loadSupabaseServerConfig() {
  for (const p of [WS_CONFIG, USER_CONFIG]) {
    try {
      const j = JSON.parse(fs.readFileSync(p, "utf8"));
      const cfg = j?.mcp?.servers?.supabase;
      if (cfg) return { cfg, source: p };
    } catch (e) {
      console.error(`config read failed at ${p}: ${e.message}`);
    }
  }
  throw new Error("supabase MCP server config not found");
}

const { cfg, source } = loadSupabaseServerConfig();
const token = process.env.SUPABASE_ACCESS_TOKEN || cfg.env?.SUPABASE_ACCESS_TOKEN;
if (!token) throw new Error("SUPABASE_ACCESS_TOKEN not present in config/env");

// Project ref from local .env.local (public URL host) — identity only, no secret.
const envLocal = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const urlLine = envLocal.split(/\r?\n/).find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL="));
const projectRef = (urlLine || "").replace(/^[^=]*=/, "").replace(/^https?:\/\//, "").split(".")[0];
if (!/^[a-z]{20}$/.test(projectRef)) throw new Error(`bad project ref parse: '${projectRef}'`);

console.log(`[probe] config source: ${source}`);
console.log(`[probe] server command: ${cfg.command} <global mcp-server-supabase stdio>`);
console.log(`[probe] project ref: ${projectRef}`);
console.log(`[probe] mode: --read-only (server-enforced)`);

fs.mkdirSync(OUT_DIR, { recursive: true });

const { Client } = await import(pathToFileURL(SDK_BASE + "client/index.js").href);
const { StdioClientTransport } = await import(pathToFileURL(SDK_BASE + "client/stdio.js").href);

const transport = new StdioClientTransport({
  command: cfg.command,
  args: [...cfg.args, "--read-only", "--project-ref", projectRef],
  env: { ...process.env, ...(cfg.env || {}) },
  stderr: "pipe",
});
transport.stderr?.on("data", (d) => {
  const s = REDACT(d.toString());
  if (s.trim()) console.error(`[server-stderr] ${s.trim().slice(0, 400)}`);
});

const client = new Client({ name: "aura-readonly-schema-probe", version: "1.0.0" });
await client.connect(transport);
console.log("[probe] connected");

const results = { meta: { source, projectRef, mode: "read-only", timestamp: new Date().toISOString() }, steps: [] };

async function step(name, fn) {
  try {
    const value = await fn();
    results.steps.push({ name, ok: true, value });
    console.log(`[ok] ${name}`);
  } catch (e) {
    results.steps.push({ name, ok: false, error: REDACT(e?.message || String(e)).slice(0, 600) });
    console.log(`[FAIL] ${name}: ${REDACT(e?.message || String(e)).slice(0, 300)}`);
  }
}

const tools = await client.listTools();
results.tools = tools.tools.map((t) => ({ name: t.name, inputProps: Object.keys(t.inputSchema?.properties || {}) }));
console.log(`[tools] ${tools.tools.map((t) => t.name).join(", ")}`);
console.log(`[tool-args] ${tools.tools.map((t) => t.name + "(" + Object.keys(t.inputSchema?.properties || {}).join(",") + ")").join(" ")}`);

const declared = Object.fromEntries(tools.tools.map((t) => [t.name, Object.keys(t.inputSchema?.properties || {})]));
const call = (name, args = {}) => {
  // Only pass arguments the server actually declares (project binding comes from --project-ref).
  const allowed = declared[name] || [];
  const filtered = Object.fromEntries(Object.entries(args).filter(([k]) => allowed.includes(k)));
  const dropped = Object.keys(args).filter((k) => !allowed.includes(k));
  if (dropped.length) console.log(`[call] ${name}: dropped non-declared args: ${dropped.join(",")}`);
  return client.callTool({ name, arguments: filtered });
};
const textOf = (r) => (r.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
const jsonOf = (r) => {
  const t = textOf(r);
  if (r.isError) throw new Error(`MCP isError: ${t.slice(0, 400)}`);
  try { return JSON.parse(t); } catch { return t; }
};
const rawOf = (r) => textOf(r);

await step("list_projects", async () => {
  const r = await call("list_projects");
  const raw = rawOf(r);
  let parsed;
  try { parsed = JSON.parse(raw); } catch { parsed = raw; }
  const arr = Array.isArray(parsed) ? parsed : parsed?.projects || [];
  return {
    rawTextSample: String(raw).slice(0, 300),
    projects: arr.map((p) => ({ id: p.id, name: p.name, region: p.region, status: p.status })),
  };
});

await step("list_tables_public_verbose", async () => jsonOf(await call("list_tables", { schemas: ["public"], verbose: true })));

await step("list_migrations", async () => jsonOf(await call("list_migrations", { project_id: projectRef })));
await step("list_extensions", async () => jsonOf(await call("list_extensions")));

const Q = {
  columns: `select jsonb_agg(t order by t.table_name, t.ordinal_position) from (
    select table_schema, table_name, ordinal_position, column_name, data_type, udt_name, is_nullable,
           column_default, is_identity, is_generated, character_maximum_length, numeric_precision, numeric_scale
    from information_schema.columns where table_schema='public') t;`,

  primary_keys: `select jsonb_agg(t order by t.table_name) from (
    select tc.table_name, tc.constraint_name,
           jsonb_agg(kcu.column_name order by kcu.ordinal_position) as columns
    from information_schema.table_constraints tc
    join information_schema.key_column_usage kcu on kcu.constraint_name=tc.constraint_name and kcu.constraint_schema=tc.constraint_schema
    where tc.table_schema='public' and tc.constraint_type='PRIMARY KEY'
    group by tc.table_name, tc.constraint_name) t;`,

  constraints: `select jsonb_agg(t order by t.table_name, t.constraint_name) from (
    select n.nspname as schema, rel.relname as table_name, con.conname as constraint_name, con.contype as kind,
           pg_get_constraintdef(con.oid) as definition, con.convalidated as validated
    from pg_constraint con join pg_class rel on rel.oid=con.conrelid join pg_namespace n on n.oid=rel.relnamespace
    where n.nspname='public') t;`,

  indexes: `select jsonb_agg(t order by t.table_name, t.indexname) from (
    select schemaname, tablename as table_name, indexname, indexdef from pg_indexes where schemaname='public') t;`,

  triggers: `select jsonb_agg(t order by t.table_name, t.trigger_name) from (
    select n.nspname as schema, c.relname as table_name, tg.tgname as trigger_name,
           pg_get_triggerdef(tg.oid) as definition, p.proname as function_name,
           case tg.tgenabled when 'O' then 'enabled' when 'D' then 'disabled' when 'R' then 'replica' when 'A' then 'always' end as status
    from pg_trigger tg join pg_class c on c.oid=tg.tgrelid join pg_namespace n on n.oid=c.relnamespace
    join pg_proc p on p.oid=tg.tgfoid where not tg.tgisinternal and n.nspname='public') t;`,

  rls_policies: `select jsonb_agg(t order by t.table_name, t.policyname) from (
    select schemaname, tablename as table_name, policyname, permissive, roles, cmd, qual, with_check
    from pg_policies where schemaname='public') t;`,

  rls_enabled: `select jsonb_agg(t order by t.table_name) from (
    select n.nspname as schema, c.relname as table_name, c.relrowsecurity as rls_enabled, c.relforcerowsecurity as rls_forced
    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relkind='r') t;`,

  functions: `select jsonb_agg(t order by t.name, t.args) from (
    select p.proname as name, pg_get_function_identity_arguments(p.oid) as args, pg_get_function_result(p.oid) as returns,
           l.lanname as language, p.prosecdef as security_definer, p.provolatile as volatility,
           pg_get_functiondef(p.oid) as definition
    from pg_proc p join pg_namespace n on n.oid=p.pronamespace join pg_language l on l.oid=p.prolang
    where n.nspname='public') t;`,

  enums_domains: `select jsonb_agg(t order by t.name) from (
    select t.typname as name, t.typtype as kind,
           case when t.typtype='e' then (select jsonb_agg(e.enumlabel order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid) end as enum_labels,
           t.typnotnull as domain_notnull, pg_get_expr(t.typdefaultbin,0) as domain_default
    from pg_type t join pg_namespace n on n.oid=t.typnamespace where n.nspname='public' and t.typtype in ('e','d')) t;`,

  // information_schema.role_table_grants is privilege-filtered for the read-only role and
  // returns an empty set here; kept for provenance, superseded by the pg_catalog ACL query below.
  table_grants: `select jsonb_agg(t order by t.table_name, t.grantee) from (
    select table_name, grantee, string_agg(distinct privilege_type, ',' order by privilege_type) as privileges
    from information_schema.role_table_grants
    where table_schema='public' and grantee in ('anon','authenticated','service_role','postgres','PUBLIC')
    group by table_name, grantee) t;`,

  // pg_catalog ACLs are not privilege-filtered, so this shows the true base-table grants.
  table_grants_pg_catalog: `select jsonb_agg(t order by t.table_name, t.grantee) from (
    select c.relname as table_name,
           case when g.grantee = 0 then 'PUBLIC' else g.grantee::regrole::text end as grantee,
           string_agg(distinct g.privilege_type, ',' order by g.privilege_type) as privileges
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    cross join lateral aclexplode(coalesce(c.relacl, acldefault('r', c.relowner))) g
    where n.nspname = 'public' and c.relkind = 'r'
    group by c.relname, g.grantee) t;`,

  sequences: `select jsonb_agg(t order by t.sequence_name) from (
    select sequence_name, data_type, start_value, minimum_value, maximum_value, increment, cycle_option
    from information_schema.sequences where sequence_schema='public') t;`,

  row_estimates: `select jsonb_agg(t order by t.table_name) from (
    select relname as table_name, n_live_tup as estimated_live_rows
    from pg_stat_user_tables where schemaname='public') t;`,

  payment_like_tables_all_schemas: `select jsonb_agg(t order by t.table_schema, t.table_name) from (
    select table_schema, table_name from information_schema.tables
    where table_schema not in ('pg_catalog','information_schema')
      and (table_name ~* 'order|subscri|entitle|premium|plan|payment|invoice|ledger|purchase')) t;`,
};

for (const [name, sql] of Object.entries(Q)) {
  await step(`sql:${name}`, async () => jsonOf(await call("execute_sql", { query: sql })));
}

// Sanitized persistence (metadata only)
const sanitized = REDACT(JSON.stringify(results, null, 1));
fs.writeFileSync(path.join(OUT_DIR, "probe-results.json"), sanitized, "utf8");
console.log(`[probe] wrote ${path.join(OUT_DIR, "probe-results.json")}`);

await client.close();
console.log("[probe] done");
