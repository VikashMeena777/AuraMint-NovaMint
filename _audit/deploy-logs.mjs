// Read-only: pull the tail of the failed deployment's build log (dpl_EQ4rjo7pFzW6fcPQ34yAHzPd6xBF).
import fs from "node:fs";
const cfg = JSON.parse(fs.readFileSync("C:/Users/Vikash Meena/Desktop/Automations/.zcode/config.json", "utf8"));
const H = { Authorization: cfg.mcp.servers.vercel.headers.Authorization };
const Q = "teamId=team_4XdN9uR6qLSZpnM4b2CBlFpn";
const dep = await (await fetch(`https://api.vercel.com/v13/deployments/dpl_EQ4rjo7pFzW6fcPQ34yAHzPd6xBF?${Q}`, { headers: H })).json();
console.log(JSON.stringify({ readyState: dep.readyState, errorMessage: dep.errorMessage ?? null }));
const res = await fetch(`https://api.vercel.com/v2/deployments/${dep.id}/events?${Q}&limit=100&direction=backward`, { headers: H });
console.log("events HTTP", res.status);
const events = await res.json().catch(() => null);
if (Array.isArray(events)) {
  const text = events.filter(e => e.payload?.text).map(e => e.payload.text).join("\n");
  const lower = text.toLowerCase();
  const idx = Math.max(lower.lastIndexOf("error"), lower.lastIndexOf("failed"));
  console.log("---- tail ----\n" + (idx >= 0 ? text.slice(Math.max(0, idx - 900), idx + 500) : text.slice(-1200)));
} else {
  console.log("no events array:", JSON.stringify(events).slice(0, 200));
}
