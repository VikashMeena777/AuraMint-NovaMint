// Bounded, read-only status polling after the one-shot restore.
// GET /v1/projects/{ref} (same documented project-details endpoint) every 20 s,
// up to 24 attempts (~8 min), stopping early on ACTIVE_HEALTHY or a definitive error.
// Never prints the token; writes sanitized evidence only.
import fs from "node:fs";

const ROOT = "C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint";
const WS_CONFIG = "C:/Users/Vikash Meena/Desktop/Automations/.zcode/config.json";
const REF = "drgparslvudatouqtjmx";
const OUT = ROOT + "/_audit/mcp-evidence/restore-poll.json";
const INTERVAL_MS = 20_000;
const MAX_ATTEMPTS = 24; // ~8 minutes

const REDACT = (s) =>
  String(s)
    .replace(/sbp_[A-Za-z0-9]+/g, "sbp_[REDACTED]")
    .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[REDACTED-JWT]")
    .replace(/Bearer\s+[A-Za-z0-9._-]+/gi, "Bearer [REDACTED]");

const token = JSON.parse(fs.readFileSync(WS_CONFIG, "utf8")).mcp.servers.supabase?.env?.SUPABASE_ACCESS_TOKEN;
if (!token || !String(token).startsWith("sbp_")) {
  console.log("ABORT: no supabase personal access token in configured server env");
  process.exit(3);
}
const H = { Authorization: `Bearer ${token}`, Accept: "application/json" };

const TERMINAL_FAILURE = new Set(["RESTORE_FAILED", "INIT_FAILED", "REMOVED", "PAUSE_FAILED"]);
const result = { probe: "bounded-restore-status-poll", ref: REF, interval_ms: INTERVAL_MS, max_attempts: MAX_ATTEMPTS, started_at: new Date().toISOString(), attempts: [], outcome: "PENDING" };
const started = Date.now();

for (let i = 1; i <= MAX_ATTEMPTS; i++) {
  const t = Date.now();
  let http = "NETWORK_ERROR";
  let body = null;
  let netError = null;
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${REF}`, { headers: H, signal: AbortSignal.timeout(45000) });
    http = res.status;
    body = await res.json().catch(() => null);
  } catch (e) {
    netError = `${e?.name || "Error"}: ${String(e?.message || e).slice(0, 150)}`;
  }
  const elapsed = ((Date.now() - started) / 1000).toFixed(0);
  const status = body?.status ?? null;
  result.attempts.push({ attempt: i, elapsed_s: Number(elapsed), http_status: http, id: body?.id ?? null, name: body?.name ?? null, status, network_error: netError });
  console.log(`[poll ${i}/${MAX_ATTEMPTS} +${elapsed}s] http=${http} id=${body?.id ?? "-"} status=${status ?? "-"}${netError ? " net=" + netError : ""}`);

  if (http === 200 && status === "ACTIVE_HEALTHY") { result.outcome = "ACTIVE_HEALTHY"; break; }
  if (http === 200 && TERMINAL_FAILURE.has(status)) { result.outcome = "FAILED:" + status; break; }
  if ([401, 403, 404].includes(http)) { result.outcome = "DEFINITIVE_ERROR:HTTP_" + http; break; }
  if (i < MAX_ATTEMPTS) await new Promise((r) => setTimeout(r, INTERVAL_MS));
}
if (result.outcome === "PENDING") result.outcome = "TIMEOUT_NOT_HEALTHY";
result.finished_at = new Date().toISOString();
result.final_status = result.attempts.at(-1)?.status ?? null;
result.final_http_status = result.attempts.at(-1)?.http_status ?? null;

fs.mkdirSync(ROOT + "/_audit/mcp-evidence", { recursive: true });
fs.writeFileSync(OUT, REDACT(JSON.stringify(result, null, 1)), "utf8");
console.log(`[poll] outcome=${result.outcome} final_status=${result.final_status} (evidence: ${OUT})`);
// exitCode instead of process.exit(): avoids a libuv assertion on Windows with pending undici handles
process.exitCode = result.outcome === "ACTIVE_HEALTHY" ? 0 : 1;
