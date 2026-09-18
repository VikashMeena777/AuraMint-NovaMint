import { PGlite } from './.atomic-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';

const migration = readFileSync(new URL('../supabase/migrations/202609170001_atomic_payments.sql', import.meta.url), 'utf8');
const db = new PGlite();
try {
  await db.exec(`
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
  `);
  await db.exec(migration);

  const user = randomUUID(), other = randomUUID();
  for (const u of [user, other]) await db.query('insert into auth.users(id) values($1)', [u]);
  for (const [u, n] of [[user, 'u1'], [other, 'other']]) await db.query('insert into profiles(id,username) values($1,$2)', [u, n]);

  const mk = async (u, status) => {
    const id = randomUUID(), m = `auramint_${id}`;
    await db.query('insert into orders(id,user_id,cashfree_order_id,amount,currency,status,plan) values($1,$2,$3,9900,$4,$5,$6)', [id, u, m, 'INR', status, 'premium']);
    return m;
  };

  // Intended semantics under test:
  //  A. a FAILED attempt that the provider later reports PAID must stay fulfillable;
  //  B. once ledgered, a retry must not refill boosts even if the flag was lost;
  //  C. the sweep targets exactly PAID orders lacking a ledger or lacking the flag.
  const failedThenPaid = await mk(user, 'FAILED');
  console.log('A. fulfill FAILED order ->', JSON.stringify((await db.query('select public.fulfill_premium_order($1,$2,9900,$3) r', [failedThenPaid, user, 'INR'])).rows[0].r));

  const paidLedgered = (await db.query('select cashfree_order_id from orders where user_id=$1 and status=$2', [user, 'PAID'])).rows.map(r => r.cashfree_order_id);
  console.log('   ledgered merchant ids for user:', paidLedgered.length, paidLedgered.includes(failedThenPaid));

  // Crash window: flag lost after both grants.
  await db.query('update profiles set is_premium=false, boosts_remaining=2 where id=$1', [user]);
  await mk(other, 'PAID'); // unledgered PAID order for the other user

  // The sweep's own candidate query, printed verbatim before running the RPC.
  const candidates = (await db.query(`
    select o.cashfree_order_id, o.user_id = $1 as is_user,
      not exists (select 1 from premium_purchases l where l.merchant_order_id = o.cashfree_order_id) as no_ledger,
      exists (select 1 from profiles p where p.id = o.user_id and p.is_premium is distinct from true) as flag_missing
    from orders o where o.status = 'PAID' and o.cashfree_order_id is not null
      and (not exists (select 1 from premium_purchases l where l.merchant_order_id = o.cashfree_order_id)
        or exists (select 1 from profiles p where p.id = o.user_id and p.is_premium is distinct from true))
    order by o.created_at nulls last, o.id`, [user])).rows;
  console.log('C. sweep candidates:', JSON.stringify(candidates));

  const before = (await db.query('select boosts_remaining from profiles where id=$1', [user])).rows[0].boosts_remaining;
  const result = (await db.query('select reconcile_premium_entitlements(100) r')).rows[0].r;
  const after = (await db.query('select is_premium, boosts_remaining from profiles where id=$1', [user])).rows[0];
  const ledger = (await db.query('select merchant_order_id, boosts_granted from premium_purchases order by created_at')).rows;
  console.log('B. reconcile ->', JSON.stringify(result), '| profile after:', JSON.stringify(after));
  console.log('   ledger rows:', JSON.stringify(ledger));

  const assertions = [
    ['A: FAILED->PAID fulfilled', paidLedgered.includes(failedThenPaid)],
    ['C: two candidates (user ledgered w/ missing flag + other unledgered)', candidates.length === 2],
    ['B: counts', JSON.stringify(Object.entries(result).sort()) === JSON.stringify(Object.entries({ attempted: 2, repaired: 2, failed: 0 }).sort())],
    ['B: boosts never refilled (stayed 2)', Number(after.boosts_remaining) === 2],
    ['B: flag repaired', after.is_premium === true],
    ['ledger: exactly one row per purchase, all grants = 5', ledger.length === 2 && ledger.every(l => Number(l.boosts_granted) === 5)],
    ['sweep idempotent', JSON.stringify(Object.entries((await db.query('select reconcile_premium_entitlements(100) r')).rows[0].r).sort()) === JSON.stringify(Object.entries({ attempted: 0, repaired: 0, failed: 0 }).sort())],
  ];
  for (const [name, ok] of assertions) console.log(ok ? `PASS ${name}` : `FAIL ${name}`);
  if (assertions.some(([, ok]) => !ok)) process.exitCode = 1;
} finally { await db.close(); }
