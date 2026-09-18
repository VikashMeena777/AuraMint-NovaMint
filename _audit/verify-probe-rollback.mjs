// Read-only post-check: the raise-rolled-back probe must have left no trace.
import fs from "node:fs";
const cfg = JSON.parse(fs.readFileSync("C:/Users/Vikash Meena/Desktop/Automations/.zcode/config.json", "utf8")).mcp.servers.supabase;
const H = { Authorization: `Bearer ${cfg.env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" };
const q = `select
  (select count(*)::int from public.premium_purchases) as ledger,
  (select count(*)::int from public.orders where cashfree_order_id like 'auramint_e2e_probe_%') as probe_orders,
  (select count(*)::int from auth.users where email like 'e2e-probe-%@probe.invalid') as probe_users,
  (select count(*)::int from public.activity_log where action='payment.fulfilled') as audit_rows`;
const res = await fetch("https://api.supabase.com/v1/projects/drgparslvudatouqtjmx/database/query", {
  method: "POST", headers: H, body: JSON.stringify({ query: q }), signal: AbortSignal.timeout(60000),
});
const rows = await res.json();
const r = Array.isArray(rows) ? rows[0] : rows;
console.log(JSON.stringify(r));
const ok = Number(r.ledger) === 0 && Number(r.probe_orders) === 0 && Number(r.probe_users) === 0;
console.log(ok ? "ROLLBACK VERIFIED: zero persistence" : "PERSISTENCE DETECTED — investigate");
process.exit(ok ? 0 : 1);
