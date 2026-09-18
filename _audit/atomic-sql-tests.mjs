import { PGlite } from './.atomic-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import assert from 'node:assert/strict';
import test from 'node:test';

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
create policy orders_read on public.orders for select using(user_id=auth.uid());
create policy orders_insert on public.orders for insert with check(user_id=auth.uid());
create policy profiles_read on public.profiles for select using(true);
create policy profiles_insert on public.profiles for insert with check(id=auth.uid());
create policy profiles_update on public.profiles for update using(id=auth.uid()) with check(id=auth.uid());
grant all on all tables in schema public to anon, authenticated, service_role;
`;

async function setup() {
  const db = new PGlite();
  await db.exec(baseline);
  return db;
}
async function buyer(db, profile = true) {
  const id = randomUUID();
  await db.query('insert into auth.users(id) values($1)', [id]);
  if (profile) await db.query('insert into profiles(id,username) values($1,$2)', [id, `test_${id}`]);
  return id;
}
async function order(db, user, status = 'PENDING', amount = 9900) {
  const id = randomUUID(); const merchant = `auramint_${id}`;
  await db.query('insert into orders(id,user_id,cashfree_order_id,amount,currency,status,plan) values($1,$2,$3,$4,$5,$6,$7)', [id,user,merchant,amount,'INR',status,'premium']);
  return merchant;
}
async function fulfill(db, merchant, user) {
  return (await db.query('select public.fulfill_premium_order($1,$2,$3,$4) as result', [merchant,user,9900,'INR'])).rows[0].result;
}
async function asRole(db, role, work) {
  const statements = { authenticated: 'set role authenticated', anon: 'set role anon', service_role: 'set role service_role' };
  await db.exec(statements[role]);
  try { return await work(); } finally { await db.exec('reset role'); }
}

test('SQL migration and payment lifecycle execute in an isolated database', async t => {
  const db = await setup();
  try {
    await db.exec(migration);
    await t.test('both payment RPCs exist with pinned search_path', async () => {
      const {rows} = await db.query("select proname, prosecdef, proconfig from pg_proc where proname in ('fulfill_premium_order','reconcile_premium_entitlements')");
      assert.equal(rows.length, 2); assert.ok(rows.every(r => r.prosecdef && r.proconfig.some(x => x.startsWith('search_path='))));
    });
    const user = await buyer(db); const merchant = await order(db,user);
    await t.test('service fulfillment changes order, ledger and profile together', async () => {
      assert.deepEqual(await asRole(db,'service_role',()=>fulfill(db,merchant,user)), {applied:true,recovered:false});
      assert.equal((await db.query('select status from orders where cashfree_order_id=$1',[merchant])).rows[0].status,'PAID');
      assert.equal((await db.query('select boosts_remaining from profiles where id=$1',[user])).rows[0].boosts_remaining,5);
    });
    await t.test('duplicate delivery never refills spent boosts', async () => {
      await db.query('update profiles set boosts_remaining=2 where id=$1',[user]);
      assert.deepEqual(await fulfill(db,merchant,user),{applied:false,recovered:false});
      assert.equal((await db.query('select boosts_remaining from profiles where id=$1',[user])).rows[0].boosts_remaining,2);
      assert.equal((await db.query('select count(*)::int as n from premium_purchases where user_id=$1',[user])).rows[0].n,1);
    });
    await t.test('missing profile rolls back and leaves order pending', async () => {
      const missing = await buyer(db,false); const m = await order(db,missing);
      await assert.rejects(fulfill(db,m,missing), /no profile/);
      assert.equal((await db.query('select status from orders where cashfree_order_id=$1',[m])).rows[0].status,'PENDING');
      assert.equal((await db.query('select count(*)::int as n from premium_purchases where merchant_order_id=$1',[m])).rows[0].n,0);
    });
    await t.test('a write failure after ledger insert rolls back ledger and order', async () => {
      const m = await order(db,user);
      await db.exec("create function fail_profile_write() returns trigger language plpgsql as $$begin raise exception 'injected profile write failure'; end$$; create trigger fail_profile_write before update on profiles for each row execute function fail_profile_write();");
      try { await assert.rejects(fulfill(db,m,user),/injected profile write failure/); }
      finally { await db.exec('drop trigger fail_profile_write on profiles; drop function fail_profile_write();'); }
      assert.equal((await db.query('select status from orders where cashfree_order_id=$1',[m])).rows[0].status,'PENDING');
      assert.equal((await db.query('select count(*)::int as n from premium_purchases where merchant_order_id=$1',[m])).rows[0].n,0);
    });
    await t.test('foreign owner, wrong amount, plan and refunded orders are refused', async () => {
      await assert.rejects(fulfill(db,merchant,randomUUID()), /does not belong/);
      await assert.rejects(fulfill(db,await order(db,user,'PENDING',1),user),/amount/);
      await assert.rejects(fulfill(db,await order(db,user,'REFUNDED'),user),/refunded/);
      const m = await order(db,user); await db.query('update orders set plan=$1 where cashfree_order_id=$2',['other',m]);
      await assert.rejects(fulfill(db,m,user), /plan/);
    });
    await t.test('verified success after failed attempt remains fulfillable', async () => {
      const m = await order(db,user,'FAILED');
      assert.deepEqual(await fulfill(db,m,user), {applied:true,recovered:false});
      assert.equal((await db.query('select status from orders where cashfree_order_id=$1',[m])).rows[0].status,'PAID');
    });
    await t.test('client roles cannot call RPCs or write orders/ledger', async () => {
      await db.query("select set_config('test.uid',$1,false)",[user]);
      for (const role of ['anon','authenticated']) await asRole(db,role,async()=> {
        await assert.rejects(fulfill(db,merchant,user),/permission denied/);
        await assert.rejects(db.query('select reconcile_premium_entitlements($1)',[100]),/permission denied/);
        await assert.rejects(db.query('update orders set status=$1 where cashfree_order_id=$2',['PAID',merchant]),/permission denied/);
        await assert.rejects(db.query('insert into orders(user_id,amount,plan) values($1,$2,$3)',[user,9900,'premium']),/permission denied/);
        await assert.rejects(db.query('delete from premium_purchases where user_id=$1',[user]),/permission denied/);
      });
    });
    await t.test('profile guard blocks client entitlement increases but allows boost debit', async () => {
      await db.query("select set_config('test.uid',$1,false)",[user]);
      await asRole(db,'authenticated',async()=> {
        await assert.rejects(db.query('update profiles set boosts_remaining=100 where id=$1',[user]),/cannot be increased/);
        await assert.rejects(db.query('update profiles set is_premium=false where id=$1',[user]),/cannot be changed/);
        await assert.rejects(db.query("update profiles set premium_expires_at=now() where id=$1",[user]),/cannot be changed/);
        await db.query('update profiles set boosts_remaining=boosts_remaining-1 where id=$1',[user]);
      });
      const newUser = await buyer(db,false);
      await db.query("select set_config('test.uid',$1,false)",[newUser]);
      await asRole(db,'authenticated',()=>assert.rejects(db.query('insert into profiles(id,username,is_premium) values($1,$2,true)',[newUser,`test_${newUser}`]), /cannot be granted/));
    });
    await t.test('reconciliation repairs paid crash window and never refills ledgered boosts', async () => {
      const other = await buyer(db); await order(db,other,'PAID');
      await db.query('update profiles set is_premium=false where id=$1',[user]);
      const before = (await db.query('select boosts_remaining from profiles where id=$1',[user])).rows[0].boosts_remaining;
      const r = (await asRole(db,'service_role',()=>db.query('select reconcile_premium_entitlements($1) as result',[100]))).rows[0].result;
      // Candidates: other's unledgered PAID order plus user's two PAID orders whose
      // owner lacks the flag. The first repair restores the shared flag, so the
      // second user order is a counted attempt but a legitimate no-op.
      assert.deepEqual(r,{attempted:3,repaired:2,failed:0});
      assert.equal((await db.query('select boosts_remaining from profiles where id=$1',[user])).rows[0].boosts_remaining,before);
      assert.equal((await db.query('select is_premium from profiles where id=$1',[other])).rows[0].is_premium,true);
      assert.deepEqual((await db.query('select reconcile_premium_entitlements($1) as result',[100])).rows[0].result,{attempted:0,repaired:0,failed:0});
    });
  } finally { await db.close(); }
});

test('migration refuses historical PAID rows before creating payment objects', async () => {
  const db = await setup();
  try {
    const user = await buyer(db); await order(db,user,'PAID');
    await assert.rejects(db.exec(migration),/migration refused/);
    await db.exec("rollback");
    assert.equal((await db.query("select to_regclass('public.premium_purchases') as t")).rows[0].t,null);
  } finally { await db.close(); }
});
