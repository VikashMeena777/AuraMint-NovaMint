// ONE authenticated, read-only Supabase Management API call: project details.
// Purpose: prove exact project ref + region + status (paused/inactive vs active) without Postgres.
// The token is read from the configured MCP server env and is never printed.
// Nothing is written except a sanitized evidence JSON.
import fs from "node:fs";

const ROOT = "C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint";
const WS_CONFIG = "C:/Users/Vikash Meena/Desktop/Automations/.zcode/config.json";
const REF = "drgparslvudatouqtjmx";

const REDACT = (s) =>
  String(s)
    .replace(/sbp_[A-Za-z0-9]+/g, "sbp_[REDACTED]")
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[REDACTED-JWT]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");

// --- identity from workspace env (key-name/host only) ---
const envLocal = fs.readFileSync(ROOT + "/.env.local", "utf8");
const urlLine = envLocal.split(/\r?\n/).find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL="));
const refFromEnv = urlLine.replace(/^[^=]*=/, "").trim().replace(/^https?:\/\//, "").split(".")[0];
if (refFromEnv !== REF) {
  console.log("ABORT: ref mismatch between .env.local and requested ref");
  process.exit(2);
}

// --- token from configured MCP server env (never printed) ---
const cfg = JSON.parse(fs.readFileSync(WS_CONFIG, "utf8")).mcp.servers.supabase;
const token = cfg?.env?.SUPABASE_ACCESS_TOKEN;
if (!token || !String(token).startsWith("sbp_")) {
  console.log("ABORT: no supabase personal access token in configured server env");
  process.exit(3);
}

const requestedAt = new Date().toISOString();
const t0 = Date.now();
let httpStatus = "NETWORK_ERROR";
let bodyText = "";
let netError = null;
try {
  const res = await fetch(`https://api.supabase.com/v1/projects/${REF}`, {
    method: "GET",
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
    signal: AbortSignal.timeout(45000),
  });
  httpStatus = res.status;
  bodyText = await res.text();
} catch (e) {
  netError = `${e?.name || "Error"}: ${String(e?.message || e).slice(0, 200)}`;
}

let body = null;
try {
  body = JSON.parse(bodyText);
} catch {}

const topKeys = body && typeof body === "object" ? Object.keys(body).sort() : [];
const db = body?.database || {};

// Allowlist only. Host / pooler / connection material deliberately omitted.
const allowlisted = {
  id: body?.id ?? null,
  name: body?.name ?? null,
  region: body?.region ?? null,
  status: body?.status ?? null,
  created_at: body?.created_at ?? null,
  database: {
    version: db.version ?? null,
    postgres_engine: db.postgres_engine ?? null,
    release_channel: db.release_channel ?? null,
  },
};
const allowKeys = new Set(Object.keys(allowlisted));

const evidence = {
  probe: "supabase-management-api-project-details",
  endpoint: `GET https://api.supabase.com/v1/projects/${REF}`,
  auth: "Authorization: Bearer <SUPABASE_ACCESS_TOKEN from configured MCP server env>; value never printed",
  requested_at: requestedAt,
  duration_ms: Date.now() - t0,
  http_status: httpStatus,
  network_error: netError,
  response_top_level_keys: topKeys,
  response_allowlisted: allowlisted,
  omitted_top_level_fields: topKeys.filter((k) => !allowKeys.has(k)),
  non_200_body_excerpt: httpStatus === 200 ? null : REDACT(bodyText).slice(0, 300),
};

const json = REDACT(JSON.stringify(evidence, null, 1));
const outDir = ROOT + "/_audit/mcp-evidence";
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outDir + "/management-project-details.json", json, "utf8");

// secret-leak guard on the artefact we just wrote
const leaks = [
  /sbp_[A-Za-z0-9]{10,}/,
  /eyJ[A-Za-z0-9._-]{20,}/,
  /\bpostgres(ql)?:\/\//i,
  /password=/i,
].filter((re) => re.test(json));
console.log(json);
console.log("[leak-guard] " + (leaks.length ? "FAIL " + leaks.map(String).join(",") : "clean"));
