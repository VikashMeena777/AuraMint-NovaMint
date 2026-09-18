// ONE-SHOT preview deployment of the local working tree to the existing AuraMint
// Vercel project (preview target — production stays on its current build).
//
// Decisive experiment: the project's env values cannot be read back via API
// (sensitive variables are write-only), so the only way to learn whether the stored
// Cashfree credentials are real is to run the app and exercise order creation.
//
// Guard rails:
//  - bearer token ONLY from the configured MCP server store (never printed, never logged)
//  - upload list = git-tracked files that exist on disk, minus _audit/.vercel/.env*/logs
//  - single POST with inline file data (no build artifacts, no secrets in payload)
//  - poll deployment until READY/ERROR; write leak-guarded evidence
import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

const ROOT = "C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint";
const WS_CONFIG = "C:/Users/Vikash Meena/Desktop/Automations/.zcode/config.json";
const PROJECT_ID = "prj_hWFMZo7qff7V59Q8pgqeoKY7XJeq";
const TEAM = "team_4XdN9uR6qLSZpnM4b2CBlFpn";
const OUT = ROOT + "/_audit/mcp-evidence/deploy-preview-request.json";

const cfg = JSON.parse(fs.readFileSync(WS_CONFIG, "utf8"));
const token = cfg?.mcp?.servers?.vercel?.headers?.Authorization?.replace(/^Bearer\s+/i, "");
if (!token || token.length < 20) { console.log("ABORT: no vercel token in configured store"); process.exit(3); }
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };
function q(extra = "") { return `?teamId=team_4XdN9uR6qLSZpnM4b2CBlFpn${extra}`; }

const REDACT = (s) => String(s)
  .replace(new RegExp(token.slice(0, 8) + "[A-Za-z0-9]*", "g"), "[REDACTED-TOKEN]")
  .replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[REDACTED-JWT]");

// ── collect deployable files: git-tracked + untracked-new (the redesign is uncommitted),
//    minus test/audit/env/build artifacts ──
const tracked = execFileSync("git", ["ls-files", "-z"], { cwd: ROOT }).toString().split("\0").filter(Boolean);
const untracked = execFileSync("git", ["ls-files", "--others", "--exclude-standard", "-z"], { cwd: ROOT })
  .toString().split("\0").filter(Boolean);
const EXCLUDE = [/^_audit\//, /^\.vercel\//, /^\.env/, /\.pem$/, /\.log$/, /^node_modules\//, /^\.next\//];
const files = [];
let totalBytes = 0;
for (const rel of [...new Set([...tracked, ...untracked])]) {
  if (EXCLUDE.some((re) => re.test(rel))) continue;
  const abs = path.join(ROOT, rel);
  if (!fs.existsSync(abs)) continue; // deleted in working tree
  const bytes = fs.readFileSync(abs);
  const data = bytes.toString("base64");
  if (!Buffer.from(data, "base64").equals(bytes)) throw new Error(`Encoding round-trip failed: ${rel}`);
  totalBytes += bytes.length;
  if (totalBytes > 25 * 1024 * 1024) { console.log("ABORT: payload exceeds 25MB sanity cap"); process.exit(4); }
  files.push({ file: rel, data, encoding: "base64" });
}
console.log(`[files] ${files.length} tracked files, ${(totalBytes / 1024).toFixed(0)} KB`);
if (files.length < 100) { console.log("ABORT: implausibly few files"); process.exit(4); }

// ── preflight: project exists and is linked to the expected repo ──
const pre = await fetch(`https://api.vercel.com/v9/projects/prj_hWFMZo7qff7V59Q8pgqeoKY7XJeq${q()}`, {
  headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(45000),
});
const preBody = await pre.json().catch(() => null);
console.log(`[preflight] project -> ${pre.status} name=${preBody?.name} repo=${preBody?.link?.org}/${preBody?.link?.repo}`);
if (pre.status !== 200 || preBody?.name !== "auramint") {
  fs.writeFileSync(OUT, REDACT(JSON.stringify({ abort: "preflight failed", http: pre.status }), null, 1));
  process.exit(4);
}

// ── create the preview deployment (one request; inline sources) ──
const t0 = Date.now();
const res = await fetch(`https://api.vercel.com/v13/deployments${q("&skipAutoDetectionConfirmation=1")}`, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({
    name: "auramint",
    project: PROJECT_ID,
    // target omitted: anything other than production/staging/custom env id is rejected; omitting = preview
    files,
    projectSettings: { framework: "nextjs" },
  }),
  signal: AbortSignal.timeout(120000),
});
const created = await res.json().catch(() => ({}));
const deploymentId = created.id ?? created.uid ?? null;
const url = created.url ?? null;
console.log(`[deploy] POST -> ${res.status} id=${deploymentId ?? JSON.stringify(created.error?.code ?? "no-id")} url=${url ?? "?"} (${Date.now() - t0}ms)`);
if (!res.ok || !deploymentId) {
  fs.writeFileSync(OUT, REDACT(JSON.stringify({ http: res.status, error: created.error ?? created }, null, 1)), "utf8");
  process.exit(5);
}

// ── poll to a terminal state (max ~8 min) ──
let state = created.readyState ?? "QUEUED";
let finalBody = created;
const deadline = Date.now() + 8 * 60 * 1000;
while (!["READY", "ERROR", "CANCELED"].includes(state) && Date.now() < deadline) {
  await new Promise((r) => setTimeout(r, 15000));
  const poll = await fetch(`https://api.vercel.com/v13/deployments/${deploymentId}${q()}`, {
    headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(30000),
  });
  finalBody = await poll.json().catch(() => finalBody);
  state = finalBody.readyState ?? state;
  console.log(`[poll] ${state}`);
}
const previewUrl = url ? `https://${url}` : (finalBody.alias ?? null);
const evidence = {
  action: "preview deployment of local working tree (operator-directed rebuild)",
  project: { id: PROJECT_ID, name: preBody?.name, repo: `${preBody?.link?.org}/${preBody?.link?.repo}` },
  target: "preview",
  files_uploaded: files.length,
  deployment_id: deploymentId,
  deployment_url: previewUrl,
  final_state: state,
  created_at: new Date().toISOString(),
  build_error_excerpt: state === "ERROR"
    ? REDACT(JSON.stringify(finalBody.errorMessage ?? finalBody.builds?.slice(-1) ?? "n/a")).slice(0, 500)
    : null,
};
fs.mkdirSync(ROOT + "/_audit/mcp-evidence", { recursive: true });
fs.writeFileSync(OUT, REDACT(JSON.stringify(evidence, null, 1)), "utf8");
const leaks = [new RegExp(token.slice(0, 10)), /eyJ[A-Za-z0-9._-]{20,}/].filter((re) => re.test(JSON.stringify(evidence)));
console.log("[leak-guard] " + (leaks.length ? "FAIL" : "clean"));
console.log(state === "READY" ? `DEPLOY READY: ${previewUrl}` : `DEPLOY ${state} — inspect build logs`);
process.exit(state === "READY" ? 0 : 6);
