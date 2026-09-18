// ONE-SHOT, OPERATOR-AUTHORIZED application of the atomic payments migration.
//
// Authorization: the user explicitly chose "Apply now" for
// supabase/migrations/202609170001_atomic_payments.sql on the live AuraMint
// database (project drgparslvudatouqtjmx), 2026-09-17.
//
// Endpoint: POST https://api.supabase.com/v1/projects/{ref}/database/query
//   (documented Management API SQL execution endpoint; bearer auth).
//
// Guard rails:
//  - refuses to run unless .env.local ref == approved REF
//  - re-reads project status first; refuses unless ACTIVE_HEALTHY
//  - reads the migration file from disk; sends it verbatim in ONE request
//  - issues at most ONE POST; no retries, no loops
//  - never prints the token; redacts all output; leak-guards the evidence file
import fs from "node:fs";

const ROOT = "C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint";
const WS_CONFIG = "C:/Users/Vikash Meena/Desktop/Automations/.zcode/config.json";
const REF = "drgparslvudatouqtjmx"; // exact approved project
const MIGRATION = ROOT + "/supabase/migrations/202609170001_atomic_payments.sql";
const OUT = ROOT + "/_audit/mcp-evidence/apply-migration-request.json";

const REDACT = (s) =>
  String(s)
    .replace(/sbp_[A-Za-z0-9]+/g, "sbp_[REDACTED]")
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[REDACTED-JWT]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]")
    .replace(/\bpostgres(ql)?:\/\/\S+/gi, "[REDACTED-DB-URL]")
    .replace(/password=\S+/gi, "password=[REDACTED]");

// --- identity guard ---
const envLocal = fs.readFileSync(ROOT + "/.env.local", "utf8");
const urlLine = envLocal.split(/\r?\n/).find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL="));
const refFromEnv = urlLine.replace(/^[^=]*=/, "").trim().replace(/^https?:\/\//, "").split(".")[0];
if (refFromEnv !== REF) {
  console.log("ABORT: ref mismatch between .env.local and approved ref");
  process.exit(2);
}

// --- token from configured MCP server env (never printed) ---
const cfg = JSON.parse(fs.readFileSync(WS_CONFIG, "utf8")).mcp.servers.supabase;
const token = cfg?.env?.SUPABASE_ACCESS_TOKEN;
if (!token || !String(token).startsWith("sbp_")) {
  console.log("ABORT: no supabase personal access token in configured server env");
  process.exit(3);
}

const H = {
  Authorization: `Bearer ${token}`,
  "Content-Type": "application/json",
  Accept: "application/json",
};
const evidence = {
  action: "apply atomic_payments migration (one-shot, operator-authorized via AskUserQuestion 'Apply now')",
  migration_file: "supabase/migrations/202609170001_atomic_payments.sql",
  requested_at: new Date().toISOString(),
  preflight: {},
  apply: null,
};

// --- preflight: identity + status ---
const t0 = Date.now();
const pre = await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: { Authorization: H.Authorization, Accept: "application/json" }, signal: AbortSignal.timeout(45000) });
const preBody = await pre.json().catch(() => null);
evidence.preflight = {
  http_status: pre.status,
  duration_ms: Date.now() - t0,
  id: preBody?.id ?? null,
  name: preBody?.name ?? null,
  status: preBody?.status ?? null,
};
console.log(`[preflight] GET /v1/projects/${REF} -> ${pre.status} status=${evidence.preflight.status}`);

if (pre.status !== 200 || preBody?.id !== REF || preBody?.status !== "ACTIVE_HEALTHY") {
  evidence.apply = { issued: false, reason: `preflight failed (http ${pre.status}, id match ${preBody?.id === REF}, status '${preBody?.status}')` };
  fs.writeFileSync(OUT, REDACT(JSON.stringify(evidence, null, 1)), "utf8");
  console.log("ABORT: preflight did not confirm an ACTIVE_HEALTHY approved project");
  process.exit(4);
}

// --- pre-apply business guard (same query the migration itself runs) ---
const tGuard = Date.now();
const guard = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST",
  headers: H,
  body: JSON.stringify({ query: "select count(*)::int as paid from public.orders where status = 'PAID'" }),
  signal: AbortSignal.timeout(45000),
});
const guardBody = await guard.json().catch(() => null);
evidence.preflight.paid_row_guard = {
  http_status: guard.status,
  duration_ms: Date.now() - tGuard,
  response: Array.isArray(guardBody) ? { paid: guardBody[0]?.paid ?? null } : guardBody,
};
console.log(`[preflight] PAID-row guard -> ${guard.status} ${JSON.stringify(evidence.preflight.paid_row_guard.response)}`);

if (guard.status !== 200 && guard.status !== 201) {
  evidence.apply = { issued: false, reason: `guard query failed (http ${guard.status})` };
  fs.writeFileSync(OUT, REDACT(JSON.stringify(evidence, null, 1)), "utf8");
  console.log("ABORT: could not verify the pre-apply PAID-row guard");
  process.exit(5);
}
if (Number(guardBody?.[0]?.paid ?? 0) > 0) {
  evidence.apply = { issued: false, reason: "preexisting PAID rows present — migration preflight would abort; review required" };
  fs.writeFileSync(OUT, REDACT(JSON.stringify(evidence, null, 1)), "utf8");
  console.log("ABORT: preexisting PAID orders must be reviewed before applying");
  process.exit(6);
}

// --- the single apply request ---
const sql = fs.readFileSync(MIGRATION, "utf8");
const t1 = Date.now();
let httpStatus = "NETWORK_ERROR";
let bodyText = "";
let netError = null;
try {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
    method: "POST",
    headers: H,
    body: JSON.stringify({ query: sql }),
    signal: AbortSignal.timeout(120000),
  });
  httpStatus = res.status;
  bodyText = await res.text();
} catch (e) {
  netError = `${e?.name || "Error"}: ${String(e?.message || e).slice(0, 200)}`;
}
evidence.apply = {
  issued: true,
  method: "POST",
  path: `/v1/projects/${REF}/database/query`,
  bytes_sent: sql.length,
  http_status: httpStatus,
  duration_ms: Date.now() - t1,
  network_error: netError,
  response_excerpt: bodyText ? REDACT(bodyText).slice(0, 500) : "",
};
console.log(`[apply] POST /v1/projects/${REF}/database/query -> ${httpStatus} (${Date.now() - t1} ms)`);

fs.mkdirSync(ROOT + "/_audit/mcp-evidence", { recursive: true });
const json = REDACT(JSON.stringify(evidence, null, 1));
fs.writeFileSync(OUT, json, "utf8");

const leaks = [/sbp_[A-Za-z0-9]{10,}/, /eyJ[A-Za-z0-9._-]{20,}/, /\bpostgres(ql)?:\/\//i, /password=/i].filter((re) => re.test(json));
console.log("[leak-guard] " + (leaks.length ? "FAIL " + leaks.map(String).join(",") : "clean"));
process.exit(httpStatus === 200 || httpStatus === 201 ? 0 : 7);