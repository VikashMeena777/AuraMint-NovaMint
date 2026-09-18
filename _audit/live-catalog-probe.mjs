// READ-ONLY: confirm auth.users jsonb column types + profiles UPDATE policy shape.
import fs from "node:fs";
const cfg = JSON.parse(fs.readFileSync("C:/Users/Vikash Meena/Desktop/Automations/.zcode/config.json", "utf8")).mcp.servers.supabase;
const H = { Authorization: `Bearer ${cfg.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json", Accept: "application/json" };
const REF = "drgparslvudatouqtjmx";
const run = async (query) => {
  const r = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, { method: "POST", headers: H, body: JSON.stringify({ query }), signal: AbortSignal.timeout(60000) });
  return { status: r.status, body: await r.json().catch(() => null) };
};
const a = await run("select column_name, data_type from information_schema.columns where table_schema='auth' and table_name='users' and column_name in ('raw_app_meta_data','raw_user_meta_data')");
console.log("auth.users meta columns:", JSON.stringify(a.body));
const p = await run("select cmd, roles, qual, with_check from pg_policies where schemaname='public' and tablename='profiles'");
console.log("profiles policies:", JSON.stringify(p.body, null, 1).slice(0, 1200));
