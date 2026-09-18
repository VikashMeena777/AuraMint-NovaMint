// Single bounded read-only probe: is the REST/platform API reachable while DB SQL times out?
// - get_project_url: platform API, no Postgres involved.
// - execute_sql "select 1": one minimal catalog-free query, read-only mode.
import fs from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = "C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint";
const WS_CONFIG = "C:/Users/Vikash Meena/Desktop/Automations/.zcode/config.json";
const SDK_BASE = "C:/Users/Vikash Meena/AppData/Roaming/npm/node_modules/@modelcontextprotocol/sdk/dist/esm/";

const REDACT = (s) => String(s).replace(/sbp_[A-Za-z0-9]+/g, "sbp_[REDACTED]").replace(/eyJ[A-Za-z0-9._-]{20,}/g, "[REDACTED-JWT]");

const cfg = JSON.parse(fs.readFileSync(WS_CONFIG, "utf8")).mcp.servers.supabase;
const envLocal = fs.readFileSync(path.join(ROOT, ".env.local"), "utf8");
const projectRef = envLocal.split(/\r?\n/).find((l) => l.startsWith("NEXT_PUBLIC_SUPABASE_URL=")).replace(/^[^=]*=/, "").replace(/^https?:\/\//, "").split(".")[0];

const { Client } = await import(pathToFileURL(SDK_BASE + "client/index.js").href);
const { StdioClientTransport } = await import(pathToFileURL(SDK_BASE + "client/stdio.js").href);
const transport = new StdioClientTransport({
  command: cfg.command,
  args: [...cfg.args, "--read-only", "--project-ref", projectRef],
  env: { ...process.env, ...(cfg.env || {}) },
});
const client = new Client({ name: "aura-single-probe", version: "1.0.0" });
await client.connect(transport);

const out = { projectRef, mode: "read-only", step: "single", calls: [] };
const rec = async (name, args) => {
  try {
    const r = await client.callTool({ name, arguments: args });
    const text = (r.content || []).filter((c) => c.type === "text").map((c) => c.text).join("\n");
    out.calls.push({ name, isError: !!r.isError, text: REDACT(text).slice(0, 500) });
    console.log(`[${r.isError ? "ERR" : "ok"}] ${name}: ${REDACT(text).slice(0, 160).replace(/\n/g, " ")}`);
  } catch (e) {
    out.calls.push({ name, thrown: REDACT(e?.message || String(e)).slice(0, 300) });
    console.log(`[THROW] ${name}: ${REDACT(e?.message || String(e)).slice(0, 200)}`);
  }
};

await rec("get_project_url", {});
await rec("execute_sql", { query: "select 1 as probe;" });

fs.writeFileSync(path.join(ROOT, "_audit", "mcp-evidence", "single-probe.json"), JSON.stringify(out, null, 1), "utf8");
await client.close();
console.log("[single-probe] done");
