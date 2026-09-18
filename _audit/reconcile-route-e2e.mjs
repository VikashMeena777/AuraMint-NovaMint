/**
 * End-to-end test of the REAL production cron route:
 *   src/app/api/cron/reconcile-payments/route.ts
 *
 * What is real:
 *   - the actual GET handler module (imported, not re-implemented)
 *   - assertCronRequest / checkCronAuthorization with a runtime-generated CRON_SECRET
 *   - getSupabaseAdmin building a genuine supabase-js client from env
 *   - the supabase-js rpc() wire call (HTTP POST /rest/v1/rpc/...)
 *   - a fresh PGlite database with supabase/migrations/202609170001_atomic_payments.sql applied
 *   - the real reconcilePremiumEntitlements wrapper (response validation, fail-closed)
 *
 * What is emulated (disclosed limitation): the PostgREST wire layer between supabase-js
 * and Postgres is a minimal local HTTP shim that executes the same parameter-bound SQL.
 * Client-role EXECUTE denial was already proven directly in _audit/atomic-sql-tests.mjs.
 *
 * Credentials: random per run, only ever present in process.env. No secrets in source.
 */
import { PGlite } from './.atomic-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import { randomUUID, randomBytes } from 'node:crypto';
import { createServer } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';
import test from 'node:test';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const migration = readFileSync(new URL('../supabase/migrations/202609170001_atomic_payments.sql', import.meta.url), 'utf8');

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

test('cron reconcile-payments route: real handler, real auth, real RPC wire call, migrated PGlite', async () => {
  const db = new PGlite();
  let server;
  try {
    await db.exec(baseline);
    await db.exec(migration);

    // ── Seed the exact business scenario: one PAID-but-unledgered order (the crash
    // window), one PENDING order that must stay untouched.
    const paidUser = randomUUID();
    const pendingUser = randomUUID();
    const paidOrderId = randomUUID();
    const pendingOrderId = randomUUID();
    const paidMerchant = `auramint_${paidOrderId}`;
    const pendingMerchant = `auramint_${pendingOrderId}`;
    for (const u of [paidUser, pendingUser]) await db.query('insert into auth.users(id) values($1)', [u]);
    for (const [u, n] of [[paidUser, 'paid_user'], [pendingUser, 'pending_user']]) {
      await db.query('insert into profiles(id,username) values($1,$2)', [u, n]);
    }
    await db.query('insert into orders(id,user_id,cashfree_order_id,amount,currency,status,plan) values($1,$2,$3,9900,$4,$5,$6)', [paidOrderId, paidUser, paidMerchant, 'INR', 'PAID', 'premium']);
    await db.query('insert into orders(id,user_id,cashfree_order_id,amount,currency,status,plan) values($1,$2,$3,9900,$4,$5,$6)', [pendingOrderId, pendingUser, pendingMerchant, 'INR', 'PENDING', 'premium']);

    // Minimal PostgREST wire shim: rpc POST -> parameter-bound SQL on PGlite.
    let rpcCalls = 0;
    let failNextRpc = false;
    server = createServer((req, res) => {
      let raw = '';
      req.on('data', (c) => { raw += c; });
      req.on('end', async () => {
        try {
          if (!req.url.includes('/rpc/reconcile_premium_entitlements')) {
            res.writeHead(404, { 'content-type': 'application/json' });
            return res.end('{}');
          }
          if (failNextRpc) {
            failNextRpc = false;
            res.writeHead(500, { 'content-type': 'application/json' });
            return res.end(JSON.stringify({ message: 'injected shim failure' }));
          }
          rpcCalls += 1;
          const body = JSON.parse(raw || '{}');
          // Parameter binding only — no string-assembled SQL.
          const { rows } = await db.query('select public.reconcile_premium_entitlements($1) as result', [Number(body.p_limit)]);
          res.writeHead(200, { 'content-type': 'application/json' });
          res.end(JSON.stringify(rows[0].result));
        } catch (err) {
          res.writeHead(500, { 'content-type': 'application/json' });
          res.end(JSON.stringify({ message: String(err && err.message || err) }));
        }
      });
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    const port = server.address().port;

    // ── Environment: runtime-generated secrets, env-only (never in source).
    const cronSecret = randomBytes(32).toString('hex');
    process.env.CRON_SECRET = cronSecret;
    process.env.SUPABASE_SERVICE_ROLE_KEY = randomBytes(32).toString('hex');
    process.env.NEXT_PUBLIC_SUPABASE_URL = `http://127.0.0.1:${port}`;

    // ── Import the REAL route handler.
    const route = await import(pathToFileURL(path.join(root, 'src/app/api/cron/reconcile-payments/route.ts')).href);
    assert.equal(typeof route.GET, 'function');

    const call = (authorization) => new Request('http://127.0.0.1/api/cron/reconcile-payments', {
      headers: authorization === undefined ? {} : { authorization },
    });

    // ── Fail-closed auth: missing header, wrong secret, unconfigured secret.
    assert.equal((await route.GET(call())).status, 401, 'missing Authorization header must 401');
    assert.equal((await route.GET(call('Bearer not-the-secret'))).status, 401, 'wrong secret must 401');
    const savedSecret = process.env.CRON_SECRET;
    delete process.env.CRON_SECRET;
    assert.equal((await route.GET(call(`Bearer ${savedSecret}`))).status, 503, 'missing CRON_SECRET must 503, never authorize');
    process.env.CRON_SECRET = savedSecret;
    assert.equal(rpcCalls, 0, 'no unauthorized request may reach the database');

    // ── The business outcome: PAID-but-unledgered order becomes premium, with a
    // matching premium_purchases row. Correct Bearer <CRON_SECRET> authorizes.
    const ok = await route.GET(call(`Bearer ${cronSecret}`));
    assert.equal(ok.status, 200);
    assert.deepEqual(await ok.json(), { ok: true, attempted: 1, repaired: 1, failed: 0 });

    const paidProfile = (await db.query('select is_premium, boosts_remaining from profiles where id=$1', [paidUser])).rows[0];
    assert.equal(paidProfile.is_premium, true, 'PAID-but-unledgered order must become premium');
    assert.equal(Number(paidProfile.boosts_remaining), 5, 'first grant adds exactly 5 boosts');
    const ledger = (await db.query('select order_id, merchant_order_id, user_id, plan, amount_minor, currency, boosts_granted from premium_purchases')).rows;
    assert.equal(ledger.length, 1);
    assert.deepEqual(
      {
        order_id: ledger[0].order_id,
        merchant_order_id: ledger[0].merchant_order_id,
        user_id: ledger[0].user_id,
        plan: ledger[0].plan,
        amount_minor: String(ledger[0].amount_minor),
        currency: ledger[0].currency,
        boosts_granted: ledger[0].boosts_granted,
      },
      {
        order_id: paidOrderId,
        merchant_order_id: paidMerchant,
        user_id: paidUser,
        plan: 'premium',
        amount_minor: '9900',
        currency: 'INR',
        boosts_granted: 5,
      },
      'premium_purchases row must match the fulfilled order exactly'
    );

    // ── The PENDING order must not have been touched by the sweep.
    const pendingProfile = (await db.query('select is_premium from profiles where id=$1', [pendingUser])).rows[0];
    assert.equal(pendingProfile.is_premium, false, 'PENDING orders must never be reconciled into premium');

    // ── Idempotent through the real route.
    const again = await route.GET(call(`Bearer ${cronSecret}`));
    assert.equal(again.status, 200);
    assert.deepEqual(await again.json(), { ok: true, attempted: 0, repaired: 0, failed: 0 });

    // ── Database failure through the real route: 500, no partial writes.
    failNextRpc = true;
    const failed = await route.GET(call(`Bearer ${cronSecret}`));
    assert.equal(failed.status, 500, 'an unreachable/failed RPC must surface as 500 for the scheduler');
    const ledgerCount = (await db.query('select count(*)::int as n from premium_purchases')).rows[0].n;
    assert.equal(ledgerCount, 1, 'a failed sweep must not write anything');

    console.log('E2E PASS: real route handler + real auth + real supabase-js rpc + migrated PGlite');
    console.log(`  unauthorized attempts: 3 (401/401/503, 0 db calls) | authorized sweep: 1 PAID-unledgered -> premium + ledger row | retry: no-op | injected db failure: 500`);
  } finally {
    if (server) await new Promise((r) => server.close(r));
    await db.close();
    delete process.env.CRON_SECRET;
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  }
});
