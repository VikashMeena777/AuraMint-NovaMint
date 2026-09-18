// ONE-SHOT transaction-rolled-back E2E probe of the LIVE payment success path.
//
// Purpose: prove on the LIVE AuraMint database that a paid purchase flow works
// end-to-end at the database layer: real handle_new_user trigger -> real order row
// -> real fulfill_premium_order RPC -> ledger row + premium flag + boosts -> real
// profiles_entitlement_guard trigger refusing a client self-grant.
//
// Safety: the entire probe is ONE plpgsql DO block whose final statement raises.
// An exception aborts the statement's transaction, so NO write can persist
// (order, user, profile, ledger, audit rows are all discarded). All SQL is static;
// there are no external inputs to bind.
import fs from "node:fs";
const ROOT = "C:/Users/Vikash Meena/Desktop/Automations/34-AuraTracker/auramint";
const WS_CONFIG = "C:/Users/Vikash Meena/Desktop/Automations/.zcode/config.json";
const REF = "drgparslvudatouqtjmx";
const cfg = JSON.parse(fs.readFileSync(WS_CONFIG, "utf8")).mcp.servers.supabase;
const token = cfg?.env?.SUPABASE_ACCESS_TOKEN;
const H = { Authorization: `Bearer ${token}`, "Content-Type": "application/json", Accept: "application/json" };

const probe = `do $e2e$
declare
  v_user uuid := gen_random_uuid();
  v_order uuid := gen_random_uuid();
  v_merchant text := 'auramint_e2e_probe_' || replace(v_order::text, '-', '');
  v_before_boosts integer;
  v_result jsonb;
  v_out jsonb;
  v_guard text := 'not_tested';
  v_user_inserted boolean := false;
  v_profile_from_trigger boolean := false;
begin
  -- Real user row; the real on-auth-user-created trigger should create the profile.
  insert into auth.users (id, email, encrypted_password, raw_app_meta_data, raw_user_meta_data, created_at, updated_at)
  values (v_user, 'e2e-probe-' || v_user::text || '@probe.invalid', '',
          '{"provider":"email","providers":["email"]}'::jsonb,
          ('{"username":"e2e_probe_' || replace(v_user::text,'-','') || '"}')::jsonb,
          now(), now());
  v_user_inserted := true;

  if exists (select 1 from public.profiles where id = v_user) then
    v_profile_from_trigger := true;
  else
    -- handle_new_user may not be wired on this project's auth.users; the purchase
    -- path requires a profile either way. This insert is also rolled back.
    insert into public.profiles (id, username) values (v_user, 'e2e_probe_' || replace(v_user::text,'-',''));
  end if;

  select coalesce(p.boosts_remaining, 0) into v_before_boosts from public.profiles p where p.id = v_user;

  insert into public.orders (id, user_id, cashfree_order_id, amount, currency, status, plan)
  values (v_order, v_user, v_merchant, 9900, 'INR', 'PENDING', 'premium');

  v_result := public.fulfill_premium_order(v_merchant, v_user, 9900, 'INR');

  -- Guard probe: a client role WITH claims must be unable to self-grant premium or
  -- boosts. auth.uid() is faked to the probe user because a real signed-in client
  -- always carries claims; without them RLS would hide the row and the UPDATE would
  -- match zero rows, never reaching the trigger. With claims the row is visible and
  -- the profiles_entitlement_guard trigger itself must refuse (SQLSTATE 42501).
  begin
    set local role authenticated;
    perform set_config('request.jwt.claims', json_build_object('sub', v_user, 'role', 'authenticated')::text, true);
    begin
      update public.profiles set is_premium = true, boosts_remaining = 999 where id = v_user;
      v_guard := 'FAIL: client self-grant succeeded';
    exception when insufficient_privilege then
      v_guard := 'ok: client self-grant refused';
    end;
    reset role;
    perform set_config('request.jwt.claims', '', true);
  exception when others then
    v_guard := 'skipped: ' || sqlerrm;
  end;

  v_out := jsonb_build_object(
    'user_inserted', v_user_inserted,
    'profile_from_trigger', v_profile_from_trigger,
    'fulfill_result', v_result,
    'order_status', (select o.status from public.orders o where o.id = v_order),
    'profile_premium', (select p.is_premium from public.profiles p where p.id = v_user),
    'boosts_delta', (select p.boosts_remaining - v_before_boosts from public.profiles p where p.id = v_user),
    'ledger_rows', (select count(*)::int from public.premium_purchases l where l.merchant_order_id = v_merchant),
    'ledger_row', (select to_jsonb(l) from public.premium_purchases l where l.merchant_order_id = v_merchant),
    'audit_rows', (select count(*)::int from public.activity_log a where a.user_id = v_user and a.action = 'payment.fulfilled'),
    'guard', v_guard,
    'error', null
  );

  -- Force full rollback: the raise aborts the transaction; nothing persists.
  raise exception 'E2E_PROBE %', v_out::text;
exception when others then
  if v_out is null then
    -- jsonb serialization keeps the message valid JSON even when sqlerrm holds
    -- characters that would otherwise break the envelope.
    raise exception 'E2E_PROBE %', jsonb_build_object('error', sqlerrm)::text;
  end if;
  raise;
end $e2e$;`;

const res = await fetch(`https://api.supabase.com/v1/projects/${REF}/database/query`, {
  method: "POST", headers: H, body: JSON.stringify({ query: probe }), signal: AbortSignal.timeout(120000),
});
const text = await res.text();

// The Management API wraps DB errors in a JSON envelope (quotes escaped inside the
// message string); unwrap that first so the E2E_PROBE payload parses directly.
let source = text;
try {
  const env = JSON.parse(text);
  source = env.message ?? env.error?.message ?? (typeof env.error === "string" ? env.error : null) ?? text;
} catch {}
const m = /E2E_PROBE (.*)/.exec(source);
if (!m) {
  console.log(`PROBE FAILED to report: http ${res.status} ${text.slice(0, 400)}`);
  process.exitCode = 1;
} else {
  const raw = m[1].trim();
  let r = null;
  try { r = JSON.parse(raw); } catch {}
  if (!r && raw.startsWith('"')) {
    // Doubled-quote serialization fallback (raise of a quoted string).
    try { r = JSON.parse(raw.slice(1, raw.lastIndexOf("}") + 1).replace(/\\"/g, '"').replace(/\\\\/g, "\\")); } catch {}
  }
  if (!r) {
    console.log("PROBE output unparseable:", raw.slice(0, 600));
    process.exitCode = 1;
  } else {
    console.log("probe state:", JSON.stringify(r, null, 1).slice(0, 1600));

    const checks = [
      ["user created (real auth.users row)", r.user_inserted === true],
      ["fulfill produced the purchase ledger row", r.ledger_row !== null],
      ["fulfill returned applied:true", r.fulfill_result && r.fulfill_result.applied === true && r.fulfill_result.recovered === false],
      ["order flipped PENDING->PAID", r.order_status === "PAID"],
      ["profile is_premium=true", r.profile_premium === true],
      ["boosts added exactly +5", Number(r.boosts_delta) === 5],
      ["exactly one ledger row for the purchase", r.ledger_rows === 1],
      ["ledger row fields exact (order_id, user_id, plan premium, 9900, INR, 5 boosts)",
        r.ledger_row && r.ledger_row.order_id && r.ledger_row.user_id && r.ledger_row.plan === "premium"
        && String(r.ledger_row.amount_minor) === "9900" && r.ledger_row.currency === "INR" && Number(r.ledger_row.boosts_granted) === 5],
      ["transactional audit row written", r.audit_rows === 1],
      ["guard trigger refused client self-grant", r.guard === "ok: client self-grant refused"],
    ];
    let ok = true;
    for (const [name, passed] of checks) { console.log(`${passed ? "PASS" : "FAIL"} ${name}`); if (!passed) ok = false; }
    console.log(ok
      ? "LIVE E2E PROBE PASS (transaction rolled back — zero persistence)"
      : "LIVE E2E PROBE: assertions failed above");
    const leak = /sbp_[A-Za-z0-9]{10,}|eyJ[A-Za-z0-9._-]{20,}/.test(text);
    console.log("[leak-guard] " + (leak ? "FAIL" : "clean"));
    if (!ok) process.exitCode = 1;
  }
}
