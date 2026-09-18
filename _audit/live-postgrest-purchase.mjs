import assert from 'node:assert/strict';
import { randomBytes, randomUUID } from 'node:crypto';
import fs from 'node:fs';

const base = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, '');
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;
assert.equal(base, 'https://drgparslvudatouqtjmx.supabase.co');
assert.ok(anon && service, 'Required environment credentials missing');
const ids = [randomUUID(), randomUUID()];
const merchants = ids.map(id => `auramint_${id}`);
const evidence = { at: new Date().toISOString(), checks: [], cleanup: [], error: null };
let userId;

async function request(path, { method = 'GET', body, bearer = service, key = service } = {}) {
  const res = await fetch(`${base}${path}`, {
    method, headers: { apikey: key, Authorization: `Bearer ${bearer}`, 'Content-Type': 'application/json', Prefer: 'return=representation' },
    body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(45000),
  });
  const text = await res.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = null; }
  if (!res.ok) throw new Error(`${method} ${path.split('?')[0]} HTTP ${res.status}; code=${data?.code ?? data?.error_code ?? 'unknown'}`);
  return data;
}
function pass(name) { evidence.checks.push(name); console.log(`PASS ${name}`); }
async function paidRows() {
  return request('/rest/v1/orders?status=eq.PAID&select=id,user_id');
}
async function sweep() {
  // The RPC is global; refuse to sweep if another user's paid order is present.
  const rows = await paidRows();
  assert.ok(rows.every(row => row.user_id === userId && ids.includes(row.id)), 'Unrelated paid orders present; global sweep not authorized');
  return request('/rest/v1/rpc/reconcile_premium_entitlements', { method: 'POST', body: { p_limit: 100 } });
}
try {
  assert.deepEqual(await paidRows(), [], 'Paid orders already exist; refuse isolated live test');
  const email = `wire-probe-${randomUUID()}@probe.invalid`;
  const password = randomBytes(36).toString('base64url');
  const created = await request('/auth/v1/admin/users', { method: 'POST', body: {
    email, password, email_confirm: true, user_metadata: { username: `wire_${randomBytes(6).toString('hex')}` },
  } });
  userId = created.id ?? created.user?.id;
  assert.ok(userId, 'Admin API did not return user id');
  const signed = await request('/auth/v1/token?grant_type=password', {
    method: 'POST', key: anon, bearer: anon, body: { email, password },
  });
  assert.ok(signed.access_token && signed.user?.id === userId, 'Sign-in failed');
  const session = { key: anon, bearer: signed.access_token };
  const who = await request('/auth/v1/user', session);
  assert.equal(who.id, userId);
  pass('Confirmed throwaway user signed in; JWT accepted by live Auth API');
  async function profile() {
    const rows = await request(`/rest/v1/profiles?id=eq.${userId}&select=id,is_premium,boosts_remaining`, session);
    assert.equal(rows.length, 1);
    return rows[0];
  }
  const before = await profile();
  pass('Real signed-in JWT reads trigger-created profile over PostgREST');
  await request('/rest/v1/orders', { method: 'POST', body: ids.map((id, i) => ({
    id, user_id: userId, cashfree_order_id: merchants[i], amount: 9900, currency: 'INR', status: 'PENDING', plan: 'premium',
  })) });
  const visible = await request(`/rest/v1/orders?user_id=eq.${userId}&select=id,status`, session);
  assert.equal(visible.length, 2);
  pass('Signed-in user reads both owned orders over PostgREST');
  const args = { p_order_id: merchants[0], p_user_id: userId, p_amount_minor: 9900, p_currency: 'INR' };
  assert.deepEqual(await request('/rest/v1/rpc/fulfill_premium_order', { method: 'POST', body: args }), { applied: true, recovered: false });
  const premium = await profile();
  assert.equal(premium.is_premium, true);
  assert.equal(premium.boosts_remaining, (before.boosts_remaining ?? 0) + 5);
  pass('Service-role fulfillment is visible through the real signed-in session: premium and +5 boosts');
  assert.deepEqual(await request('/rest/v1/rpc/fulfill_premium_order', { method: 'POST', body: args }), { applied: false, recovered: false });
  assert.equal((await profile()).boosts_remaining, premium.boosts_remaining);
  pass('Duplicate fulfillment does not refill boosts');
  await request(`/rest/v1/orders?id=eq.${ids[1]}&user_id=eq.${userId}`, { method: 'PATCH', body: { status: 'PAID' } });
  assert.deepEqual(await sweep(), { attempted: 1, repaired: 1, failed: 0 });
  assert.equal((await profile()).boosts_remaining, premium.boosts_remaining + 5);
  const ledger = await request(`/rest/v1/premium_purchases?user_id=eq.${userId}&select=order_id,merchant_order_id,user_id,plan,amount_minor,currency,boosts_granted`);
  assert.equal(ledger.length, 2);
  for (let i = 0; i < 2; i++) assert.deepEqual(ledger.find(row => row.order_id === ids[i]), {
    order_id: ids[i], merchant_order_id: merchants[i], user_id: userId, plan: 'premium', amount_minor: 9900, currency: 'INR', boosts_granted: 5,
  });
  pass('Live reconciliation repairs synthetic PAID crash window with exact matching ledger rows');
  assert.deepEqual(await sweep(), { attempted: 0, repaired: 0, failed: 0 });
  pass('Second live reconciliation is a no-op');
} catch (error) {
  evidence.error = error instanceof assert.AssertionError ? error.message.split('\n')[0] : error.message;
  console.log(`FAIL ${evidence.error}`);
  process.exitCode = 1;
} finally {
  if (userId) {
    for (const table of ['activity_log', 'premium_purchases', 'orders']) {
      try {
        await request(`/rest/v1/${table}?user_id=eq.${userId}`, { method: 'DELETE' });
        const rows = await request(`/rest/v1/${table}?user_id=eq.${userId}&select=user_id`);
        assert.deepEqual(rows, []);
        evidence.cleanup.push(`${table}: zero probe rows`);
      } catch (error) { evidence.cleanup.push(`${table}: cleanup failed (${error.message})`); process.exitCode = 1; }
    }
    try {
      await request(`/auth/v1/admin/users/${userId}`, { method: 'DELETE' });
      const profiles = await request(`/rest/v1/profiles?id=eq.${userId}&select=id`);
      assert.deepEqual(profiles, []);
      evidence.cleanup.push('Auth user deleted; profile cascade verified');
    } catch (error) { evidence.cleanup.push(`Auth cleanup failed (${error.message})`); process.exitCode = 1; }
    if (process.exitCode) evidence.cleanupUserId = userId;
  }
  for (const line of evidence.cleanup) console.log(`CLEANUP ${line}`);
  const output = JSON.stringify(evidence, null, 2);
  assert.ok(!output.includes(service) && !output.includes(anon), 'Credential leak in evidence');
  fs.writeFileSync(new URL('./mcp-evidence/live-postgrest-purchase.json', import.meta.url), output);
}
