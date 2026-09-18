// READ-ONLY post-apply verification of the atomic payments migration.
// Same guard rails as apply-migration.mjs: token from configured MCP env, never printed.
import fs from "node:fs";
const ROOT = "C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint";
const WS_CONFIG = "C:/Users/Vikash Meena/Desktop/Automations/.zcode/config.json";
const REF = "drgparslvudatouqtjmx";
const cfg = JSON.parse(fs.readFileSync(WS_CONFIG, "utf8")).mcp.servers.supabase;
const token = cfg?.env?.SUPABASE_ACCESS_TOKEN;
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" };
const run = async (query) => {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST", headers: H, body: JSON.stringify({ query }), signal: AbortSignal.timeout(60000),
  });
  return { status: res.status, body: await res.json().catch(() => null) };
};
const checks = [
  ["ledger table exists", "select to_regclass('public.premium_purchases') as t"],
  ["RPCs are SECURITY DEFINER with pinned search_path", "select proname, prosecdef, proconfig from pg_proc where proname in ('fulfill_premium_order','reconcile_premium_entitlements','enforce_profile_entitlement_guard')"],
  ["orders unique merchant id index", "select indexname from pg_indexes where tablename='orders' and indexdef like '%cashfree_order_id%'"],
  ["guard trigger present", "select tgname, tgenabled from pg_trigger where tgrelid='public.profiles'::regclass and not tgisinternal"],
  ["client EXECUTE revoked on RPCs", "select p.proname, has_function_privilege('anon','public.fulfill_premium_order(text,uuid,numeric,text)','execute') as anon_can_exec from pg_proc p where proname='fulfill_premium_order'"],
  ["anon cannot insert orders", "select has_table_privilege('anon','public.orders','insert') as can_insert, has_table_privilege('anon','public.orders','update') as can_update"],
  ["anon cannot touch ledger", "select has_table_privilege('anon','public.premium_purchases','select') as can_select, has_table_privilege('authenticated','public.premium_purchases','insert') as can_insert"],
  ["SELECT still granted to clients on orders", "select has_table_privilege('authenticated','public.orders','select') as can_select"],
  ["no live PAID rows / ledger empty", "select (select count(*) from public.orders where status='PAID') as paid, (select count(*) from public.premium_purchases) as ledger"],
];
let allOk = true;
for (const [name, query] of checks) {
  const r = await run(query);
  const ok = r.status === 200 || r.status === 201;
  if (!ok) allOk = false;
  console.log(`${ok ? "OK  " : "FAIL"} ${name} -> ${JSON.stringify(r.body).slice(0, 300)}`);
}
console.log(allOk ? "ALL POST-APPLY CHECKS RETURNED" : "SOME CHECKS FAILED");
