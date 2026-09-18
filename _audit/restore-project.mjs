// ONE-SHOT, OPERATOR-AUTHORIZED restore of the approved AuraMint project.
//
// Documented endpoint (Supabase Management API OpenAPI spec, https://api.supabase.com/api/v1-json,
// which backs https://supabase.com/docs/reference/api/v1-restore-a-project):
//   POST /v1/projects/{ref}/restore   operationId: v1-restore-a-project
//   summary: "Restores the given project"; no request body; bearer auth;
//   OAuth scope projects:write; fine-grained permission project_admin_write;
//   documented responses: 200 (success), 401, 403, 429.
// There is no separate "unpause" endpoint in the spec; this is the documented
// counterpart to POST /v1/projects/{ref}/pause ("Pauses the given project").
//
// Guard rails:
//  - refuses to run unless .env.local ref == approved REF
//  - re-reads project status first and only issues the POST if status is INACTIVE
//  - issues at most ONE POST; no retries, no loops
//  - never prints the token; redacts all output; leak-guards the evidence file
import fs from "node:fs";

const ROOT = "C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint";
const WS_CONFIG = "C:/Users/Vikash Meena/Desktop/Automations/.zcode/config.json";
const REF = "drgparslvudatouqtjmx"; // exact approved project
const OUT = ROOT + "/_audit/mcp-evidence/restore-request.json";

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

const H = { Authorization: `Bearer ${token}`, Accept: "application/json" };
const evidence = {
  action: "restore-a-project (one-shot, operator-authorized)",
  documented_endpoint: "POST https://api.supabase.com/v1/projects/{ref}/restore",
  doc_sources: [
    "https://api.supabase.com/api/v1-json (OpenAPI: operationId v1-restore-a-project, no request body)",
    "https://supabase.com/docs/reference/api/v1-restore-a-project",
  ],
  requested_at: new Date().toISOString(),
  preflight: {},
  restore: null,
};

// --- preflight: identity + status (read-only, same endpoint as management-project-details.mjs) ---
const t0 = Date.now();
const pre = await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: H, signal: AbortSignal.timeout(45000) });
const preBody = await pre.json().catch(() => null);
evidence.preflight = {
  http_status: pre.status,
  duration_ms: Date.now() - t0,
  id: preBody?.id ?? null,
  name: preBody?.name ?? null,
  status: preBody?.status ?? null,
};
console.log(`[preflight] GET /v1/projects/${REF} -> ${pre.status} id=${evidence.preflight.id} name=${evidence.preflight.name} status=${evidence.preflight.status}`);

if (pre.status !== 200 || preBody?.id !== REF) {
  evidence.restore = { issued: false, reason: `preflight failed (http ${pre.status} or id mismatch)` };
  fs.writeFileSync(OUT, REDACT(JSON.stringify(evidence, null, 1)), "utf8");
  console.log("ABORT: preflight did not confirm the approved project");
  process.exit(4);
}

if (preBody.status !== "INACTIVE") {
  evidence.restore = { issued: false, reason: `project status is '${preBody.status}', not INACTIVE — no restore needed` };
  fs.writeFileSync(OUT, REDACT(JSON.stringify(evidence, null, 1)), "utf8");
  console.log(`NO-OP: status is '${preBody.status}'; refusing to send restore for a non-INACTIVE project`);
  process.exit(0);
}

// --- the single documented restore request ---
const t1 = Date.now();
let httpStatus = "NETWORK_ERROR";
let bodyText = "";
let netError = null;
try {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/restore`, {
    method: "POST",
    headers: H, // no request body: the spec declares none
    signal: AbortSignal.timeout(90000),
  });
  httpStatus = res.status;
  bodyText = await res.text();
} catch (e) {
  netError = `${e?.name || "Error"}: ${String(e?.message || e).slice(0, 200)}`;
}
evidence.restore = {
  issued: true,
  method: "POST",
  path: `/v1/projects/${REF}/restore`,
  request_body: null,
  http_status: httpStatus,
  duration_ms: Date.now() - t1,
  network_error: netError,
  response_excerpt: bodyText ? REDACT(bodyText).slice(0, 300) : "",
};
console.log(`[restore] POST /v1/projects/${REF}/restore -> ${httpStatus} (${Date.now() - t1} ms)`);

fs.mkdirSync(ROOT + "/_audit/mcp-evidence", { recursive: true });
const json = REDACT(JSON.stringify(evidence, null, 1));
fs.writeFileSync(OUT, json, "utf8");

const leaks = [/sbp_[A-Za-z0-9]{10,}/, /eyJ[A-Za-z0-9._-]{20,}/, /\bpostgres(ql)?:\/\//i, /password=/i].filter((re) => re.test(json));
console.log("[leak-guard] " + (leaks.length ? "FAIL " + leaks.map(String).join(",") : "clean"));
process.exit(httpStatus === 200 ? 0 : 5);
