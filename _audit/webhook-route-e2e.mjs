/**
 * End-to-end regression for the REAL production Cashfree webhook route:
 *   src/app/api/webhooks/cashfree/route.ts  (POST)
 *
 * What is REAL (not re-implemented):
 *   - the actual route module, imported via the project's ESM loader
 *   - next/server NextRequest/NextResponse, the 413 pre-check, the 503 misconfig
 *     branch, the whole `handleCashfreeWebhookEvent` security core (signature,
 *     payload validation, owner resolution, amount/currency verification,
 *     idempotency) and the real `fulfillPremiumOrder` / `markOrderFailed` /
 *     `logPaymentEvent` wrappers
 *   - a genuine supabase-js client (createClient) built by getSupabaseAdmin from env
 *   - real HTTP: every DB call the route makes goes over 127.0.0.1 to a local shim
 *   - a fresh PGlite database with supabase/migrations/202609170001_atomic_payments.sql
 *     applied, so the real PL/pgSQL `fulfill_premium_order` executes
 *
 * DISCLOSED LIMITATION (transport shim, NOT provider E2E):
 *   The PostgREST wire layer between supabase-js and Postgres is a minimal local HTTP
 *   shim. It accepts only the specific requests this route issues (GET/PATCH orders,
 *   POST activity_log, POST rpc) and executes the equivalent SQL with BOUND PARAMETERS
 *   only — no value is ever interpolated into SQL text. Column names are whitelisted.
 *   It is not a general PostgREST implementation, and this test does NOT contact
 *   Cashfree or any network/service outside 127.0.0.1. What the shim faithfully
 *   reproduces is the request/response contract supabase-js relies on: array JSON for
 *   maybeSingle(), representation arrays for update().select(), and the jsonb result
 *   for rpc().
 *
 * Credentials: the webhook secret and service-role key are randomly generated per run
 * and live only in process.env. They are never printed and never written to source.
 * No .env is read; no live credentials are used.
 *
 * Run:
 *   node --loader ./_audit/loader.mjs --test _audit/webhook-route-e2e.mjs
 */
import { PGlite } from './.atomic-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import { randomUUID, randomBytes, createHmac } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = readFileSync(
  new URL('../supabase/migrations/202609170001_atomic_payments.sql', import.meta.url),
  'utf8'
);

/** Baseline schema owned by the app's own migrations (mirrors reconcile-route-e2e). */
const baseline = `
create role anon; create role authenticated; create role service_role bypassrls;
create schema auth; create table auth.users(id uuid primary key);
create function auth.uid() returns uuid language sql stable as $$select nullif(current_setting('test.uid',true),'')::uuid$$;
grant usage on schema public, auth to anon, authenticated, service_role;
grant execute on function auth.uid() to public;
create table public.orders(id uuid primary key default gen_random_uuid(), user_id uuid not null references auth.users(id) on delete cascade, cashfree_order_id text, amount numeric(10,2) not null, currency text default 'INR', status text default 'PENDING' check(status in ('PENDING','PAID','FAILED','REFUNDED')), plan text not null, created_at timestamptz default now(), updated_at timestamptz default now());
create table public.profiles(id uuid primary key references auth.users(id) on delete cascade, username text not null unique, display_name text, avatar_url text, total_aura bigint default 0, current_tier text default 'NPC', streak_days integer default 0, last_active_date date, is_premium boolean default false, premium_expires_at timestamptz, theme text default 'cosmic', language text default 'en', created_at timestamptz default now(), updated_at timestamptz default now(), username_changes timestamptz[] default '{}', boosts_remaining integer default 0);
create table public.activity_log(id uuid primary key default gen_random_uuid(), user_id uuid references auth.users(id), action text not null, metadata jsonb default '{}', created_at timestamptz default now());
alter table public.orders enable row level security; alter table public.profiles enable row level security;
grant all on all tables in schema public to anon, authenticated, service_role;
`;

const ORDER_COLUMNS = new Set([
  'id', 'user_id', 'status', 'amount', 'currency', 'plan',
  'cashfree_order_id', 'created_at', 'updated_at',
]);

/** Column-name guard: identifiers are whitelisted, values are always bound. */
function checkedColumn(name) {
  if (typeof name !== 'string' || !/^[a-z_][a-z0-9_]*$/.test(name) || !ORDER_COLUMNS.has(name)) {
    throw new Error(`shim: unsupported column ${JSON.stringify(name)}`);
  }
  return name;
}

/** Parses only `col=eq.value` filters; every value is returned for parameter binding. */
function parseEqFilters(searchParams, allowed) {
  const filters = [];
  for (const [key, value] of searchParams.entries()) {
    if (['select', 'limit', 'offset', 'order'].includes(key)) continue;
    if (!allowed.has(key)) throw new Error(`shim: unsupported filter ${key}`);
    const match = /^eq\.(.*)$/s.exec(value);
    if (!match) throw new Error(`shim: unsupported operator in ${key}=${value}`);
    filters.push([checkedColumn(key), match[1]]);
  }
  return filters;
}

/** Minimal PostgREST-contract HTTP shim over PGlite. Bound params only. */
function startShim(db) {
  let requestCount = 0;
  const server = createServer((req, res) => {
    let raw = '';
    req.on('data', (chunk) => { raw += chunk; });
    req.on('end', async () => {
      const send = (status, body) => {
        res.writeHead(status, { 'content-type': 'application/json' });
        res.end(body === undefined ? '' : JSON.stringify(body));
      };
      try {
        requestCount += 1;
        const url = new URL(req.url, 'http://127.0.0.1');
        const q = url.searchParams;

        if (url.pathname === '/rest/v1/rpc/fulfill_premium_order' && req.method === 'POST') {
          const body = JSON.parse(raw || '{}');
          const { rows } = await db.query(
            'select public.fulfill_premium_order($1, $2, $3, $4) as result',
            [body.p_order_id, body.p_user_id, body.p_amount_minor, body.p_currency]
          );
          return send(200, rows[0].result);
        }

        if (url.pathname === '/rest/v1/orders' && req.method === 'GET') {
          const columns = (q.get('select') || 'id').split(',').map((c) => checkedColumn(c.trim()));
          const filters = parseEqFilters(q, ORDER_COLUMNS);
          const where = filters.map(([col], i) => `${col} = $${i + 1}`).join(' and ');
          const { rows } = await db.query(
            `select ${columns.join(', ')} from public.orders${where ? ` where ${where}` : ''} limit 100`,
            filters.map(([, value]) => value)
          );
          // PostgREST serialises numeric columns as JSON numbers; PGlite returns text.
          const shaped = rows.map((row) =>
            row.amount === undefined || row.amount === null ? row : { ...row, amount: Number(row.amount) }
          );
          return send(200, shaped);
        }

        if (url.pathname === '/rest/v1/orders' && req.method === 'PATCH') {
          const body = JSON.parse(raw || '{}');
          const setColumns = Object.keys(body).map(checkedColumn);
          const filters = parseEqFilters(q, ORDER_COLUMNS);
          const setSql = setColumns.map((col, i) => `${col} = $${i + 1}`).join(', ');
          const where = filters.map(([col], i) => `${col} = $${setColumns.length + i + 1}`).join(' and ');
          const returning = (q.get('select') || '')
            .split(',').filter(Boolean).map((c) => checkedColumn(c.trim()));
          const { rows } = await db.query(
            `update public.orders set ${setSql}${where ? ` where ${where}` : ''}${returning.length ? ` returning ${returning.join(', ')}` : ''}`,
            [...setColumns.map((col) => body[col]), ...filters.map(([, value]) => value)]
          );
          return send(200, rows);
        }

        if (url.pathname === '/rest/v1/activity_log' && req.method === 'POST') {
          const body = JSON.parse(raw || '{}');
          // $3::jsonb is a cast on a bound parameter, not string-assembled SQL.
          await db.query(
            'insert into public.activity_log(user_id, action, metadata) values($1, $2, $3::jsonb)',
            [body.user_id, body.action, JSON.stringify(body.metadata ?? {})]
          );
          return send(201, undefined);
        }

        return send(404, { message: `shim: no route for ${req.method} ${url.pathname}` });
      } catch (err) {
        // PostgREST surfaces raised SQL as a 4xx JSON error object; supabase-js reads .message.
        return send(400, { code: 'P0001', message: String((err && err.message) || err) });
      }
    });
  });
  return {
    server,
    get requestCount() { return requestCount; },
  };
}

const sign = (secret, timestamp, body) =>
  createHmac('sha256', secret).update(`${timestamp}${body}`).digest('base64');

/** Builds one synthetic, correctly signed Cashfree delivery. */
function signedDelivery(secret, { orderId, amount = 99, currency = 'INR', type = 'PAYMENT_SUCCESS_WEBHOOK', orderStatus = 'PAID', timestamp }) {
  const rawBody = JSON.stringify({
    type,
    data: {
      order: { order_id: orderId, order_amount: amount, order_currency: currency, order_status: orderStatus },
      payment: { payment_amount: amount, payment_status: type === 'PAYMENT_FAILED_WEBHOOK' ? 'FAILED' : 'SUCCESS' },
    },
  });
  const ts = timestamp ?? String(Math.floor(Date.now() / 1000));
  return { rawBody, timestamp: ts, signature: sign(secret, ts, rawBody) };
}

function webhookRequest({ rawBody, timestamp, signature, extraHeaders = {} }) {
  const headers = { 'content-type': 'application/json', ...extraHeaders };
  if (timestamp !== undefined) headers['x-webhook-timestamp'] = timestamp;
  if (signature !== undefined) headers['x-webhook-signature'] = signature;
  return new Request('http://127.0.0.1/api/webhooks/cashfree', { method: 'POST', headers, body: rawBody });
}

test('cashfree webhook route: real signed handler, entitlement + ledger, duplicate no refill, fail-closed guards', async () => {
  const db = new PGlite();
  let shim;
  try {
    await db.exec(baseline);
    await db.exec(migration);

    // ── Seed: one PENDING premium order for the success path, one for failure-path,
    // one for the amount-mismatch refusal.
    const buyer = randomUUID();
    const failBuyer = randomUUID();
    const mismatchBuyer = randomUUID();
    for (const [user, name, orderId, merchant] of [
      [buyer, 'e2e_buyer', randomUUID(), null],
      [failBuyer, 'e2e_fail_buyer', randomUUID(), null],
      [mismatchBuyer, 'e2e_mismatch_buyer', randomUUID(), null],
    ]) {
      await db.query('insert into auth.users(id) values($1)', [user]);
      await db.query('insert into profiles(id, username) values($1, $2)', [user, name]);
      await db.query(
        'insert into orders(id, user_id, cashfree_order_id, amount, currency, status, plan) values($1,$2,$3,$4,$5,$6,$7)',
        [orderId, user, `auramint_${orderId}`, 9900, 'INR', 'PENDING', 'premium']
      );
    }
    const merchantOf = async (user) =>
      (await db.query('select cashfree_order_id from orders where user_id=$1', [user])).rows[0].cashfree_order_id;
    const buyerMerchant = await merchantOf(buyer);
    const failMerchant = await merchantOf(failBuyer);
    const mismatchMerchant = await merchantOf(mismatchBuyer);

    shim = startShim(db);
    await new Promise((resolve) => shim.server.listen(0, '127.0.0.1', resolve));
    const port = shim.server.address().port;

    // ── Runtime-generated credentials, env-only. Never printed.
    const webhookSecret = randomBytes(32).toString('hex');
    process.env.CASHFREE_WEBHOOK_SECRET = webhookSecret;
    process.env.SUPABASE_SERVICE_ROLE_KEY = randomBytes(32).toString('hex');
    process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${port}`;

    // ── Import the REAL route handler (loader resolves @/ and next/server).
    const route = await import(pathToFileURL(path.join(root, 'src/app/api/webhooks/cashfree/route.ts')).href);
    assert.equal(typeof route.POST, 'function', 'route must export POST');

    const countLedger = async () =>
      (await db.query('select count(*)::int as n from premium_purchases')).rows[0].n;
    const countLogs = async () =>
      (await db.query('select count(*)::int as n from activity_log')).rows[0].n;

    // ══ 1. Missing webhook secret ⇒ 503, zero DB traffic and zero writes. ══
    const savedSecret = process.env.CASHFREE_WEBHOOK_SECRET;
    delete process.env.CASHFREE_WEBHOOK_SECRET;
    const noSecret = signedDelivery(savedSecret, { orderId: buyerMerchant });
    const beforeGuard = shim.requestCount;
    const r503 = await route.POST(webhookRequest(noSecret));
    assert.equal(r503.status, 503, 'unconfigured CASHFREE_WEBHOOK_SECRET must be 503');
    assert.equal(shim.requestCount - beforeGuard, 0, 'no-secret request must not touch the database');
    process.env.CASHFREE_WEBHOOK_SECRET = savedSecret;

    // ══ 2. Invalid signature ⇒ 401, zero DB traffic and zero writes. ══
    const valid = signedDelivery(savedSecret, { orderId: buyerMerchant });
    const tampered = { ...valid, signature: sign('not-the-secret', valid.timestamp, valid.rawBody) };
    const beforeBad = shim.requestCount;
    const r401 = await route.POST(webhookRequest(tampered));
    assert.equal(r401.status, 401, 'bad HMAC must be 401');
    assert.deepEqual(await r401.json(), { message: 'Invalid signature' });
    assert.equal(shim.requestCount - beforeBad, 0, 'rejected signature must not reach the database');

    // ══ 3. Oversized payload ⇒ 413 (actual limit: 256 KiB). ══
    const MAX_BODY_BYTES = 256 * 1024; // must match route.ts
    const oversizedBody = JSON.stringify({ type: 'PAYMENT_SUCCESS_WEBHOOK', pad: 'x'.repeat(MAX_BODY_BYTES) });
    assert.ok(oversizedBody.length > MAX_BODY_BYTES, 'fixture must exceed the route limit');
    const beforeBig = shim.requestCount;
    const r413 = await route.POST(webhookRequest({
      rawBody: oversizedBody,
      timestamp: valid.timestamp,
      signature: sign(savedSecret, valid.timestamp, oversizedBody),
    }));
    assert.equal(r413.status, 413, `a > ${MAX_BODY_BYTES}-byte body must be 413`);
    assert.deepEqual(await r413.json(), { message: 'Payload too large' });
    assert.equal(shim.requestCount - beforeBig, 0, '413 must be returned before any DB access');

    // ══ 4. Valid signed delivery ⇒ entitlement granted, exactly one ledger row. ══
    const rOk = await route.POST(webhookRequest(valid));
    assert.equal(rOk.status, 200, 'valid delivery must be 200');
    assert.deepEqual(await rOk.json(), { message: 'OK' });

    const orderAfter = (await db.query('select status from orders where user_id=$1', [buyer])).rows[0];
    assert.equal(orderAfter.status, 'PAID', 'verified order must transition to PAID');
    const profileAfter = (await db.query('select is_premium, boosts_remaining from profiles where id=$1', [buyer])).rows[0];
    assert.equal(profileAfter.is_premium, true, 'buyer must become premium');
    assert.equal(Number(profileAfter.boosts_remaining), 5, 'first grant must add exactly 5 boosts');
    assert.equal(await countLedger(), 1, 'exactly one premium_purchases row');
    const ledger = (await db.query('select merchant_order_id, user_id, plan, amount_minor, currency, boosts_granted from premium_purchases')).rows[0];
    assert.deepEqual(
      {
        merchant_order_id: ledger.merchant_order_id,
        user_id: ledger.user_id,
        plan: ledger.plan,
        amount_minor: String(ledger.amount_minor),
        currency: ledger.currency,
        boosts_granted: ledger.boosts_granted,
      },
      { merchant_order_id: buyerMerchant, user_id: buyer, plan: 'premium', amount_minor: '9900', currency: 'INR', boosts_granted: 5 },
      'ledger row must match the verified order'
    );
    // Two audit rows are expected: 'payment.fulfilled' written inside the PL/pgSQL
    // fulfillment transaction, and 'payment.webhook.success' written by the route's
    // logEvent. Both are real; neither duplicates on replay (asserted below).
    const logsAfterSuccess = await countLogs();
    assert.equal(logsAfterSuccess, 2, 'fulfillment + route each record exactly one audit row');
    const actions = (await db.query('select action from activity_log order by action')).rows.map((r) => r.action);
    assert.deepEqual(actions, ['payment.fulfilled', 'payment.webhook.success'], 'both audit rows must carry the expected actions');

    // ══ 5. Duplicate delivery ⇒ 200 no-op, no boost refill, no new ledger row. ══
    const rDup = await route.POST(webhookRequest(valid));
    assert.equal(rDup.status, 200);
    assert.deepEqual(await rDup.json(), { message: 'Already processed' }, 'a replay must be acknowledged as already processed');
    const profileDup = (await db.query('select is_premium, boosts_remaining from profiles where id=$1', [buyer])).rows[0];
    assert.equal(Number(profileDup.boosts_remaining), 5, 'replay must not refill boosts');
    assert.equal(await countLedger(), 1, 'replay must not add a ledger row');
    assert.equal(await countLogs(), logsAfterSuccess, 'replay must not add an audit row');

    // ══ 6. Amount mismatch ⇒ refused, no entitlement (fail-closed verification). ══
    const ledgerBeforeMismatch = await countLedger();
    const mismatch = signedDelivery(savedSecret, { orderId: mismatchMerchant, amount: 1 });
    const rMismatch = await route.POST(webhookRequest(mismatch));
    assert.equal(rMismatch.status, 200);
    assert.deepEqual(await rMismatch.json(), { message: 'Amount mismatch' });
    const mismatchProfile = (await db.query('select is_premium from profiles where id=$1', [mismatchBuyer])).rows[0];
    assert.equal(mismatchProfile.is_premium, false, 'a mismatched amount must never grant premium');
    assert.equal(await countLedger(), ledgerBeforeMismatch, 'a mismatch must not write a ledger row');

    // ══ 7. Real failure webhook ⇒ order marked FAILED via the route's PATCH path. ══
    const failed = signedDelivery(savedSecret, {
      orderId: failMerchant, type: 'PAYMENT_FAILED_WEBHOOK', orderStatus: 'FAILED',
    });
    const rFail = await route.POST(webhookRequest(failed));
    assert.equal(rFail.status, 200);
    assert.deepEqual(await rFail.json(), { message: 'OK' });
    assert.equal(
      (await db.query('select status from orders where user_id=$1', [failBuyer])).rows[0].status,
      'FAILED',
      'PAYMENT_FAILED_WEBHOOK must mark the order FAILED'
    );

    // ══ 8. Route-level misconfig: no service-role key ⇒ 503, zero DB traffic. ══
    const savedKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const beforeMisconfig = shim.requestCount;
    const rNoClient = await route.POST(webhookRequest(valid));
    assert.equal(rNoClient.status, 503, 'missing service-role env must be 503');
    assert.deepEqual(await rNoClient.json(), { message: 'Server misconfigured' });
    assert.equal(shim.requestCount - beforeMisconfig, 0, 'misconfigured route must not touch the database');
    process.env.SUPABASE_SERVICE_ROLE_KEY = savedKey;

    // ── Summary line: exact observable outcomes for the report.
    console.log('E2E PASS: real POST /api/webhooks/cashfree + real HMAC + real supabase-js HTTP + migrated PGlite');
    console.log('  guards: missing-secret 503 (0 db) | bad-signature 401 (0 db) | oversized 413 (0 db) | misconfig 503 (0 db)');
    console.log('  valid signed delivery -> 200 OK: order PAID, is_premium=true, boosts=5, 1 ledger row (9900 INR), 2 audit rows (payment.fulfilled + payment.webhook.success)');
    console.log('  duplicate -> 200 Already processed: boosts stay 5, ledger stays 1, audit unchanged');
    console.log('  amount mismatch -> 200 Amount mismatch: no premium, no ledger write');
    console.log('  PAYMENT_FAILED_WEBHOOK -> 200 OK: order FAILED');
    console.log(`  total DB round-trips through supabase-js: ${shim.requestCount}`);
  } finally {
    if (shim) await new Promise((r) => shim.server.close(r));
    await db.close();
    delete process.env.CASHFREE_WEBHOOK_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  }
});
