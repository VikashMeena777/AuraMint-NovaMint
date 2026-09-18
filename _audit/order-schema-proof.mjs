import { PGlite } from './.atomic-test-runtime/node_modules/@electric-sql/pglite/dist/index.js';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
const db = new PGlite();
try {
  await db.exec(`create table orders (id uuid primary key default gen_random_uuid(), user_id uuid not null, cashfree_order_id text, amount numeric(10,2) not null, currency text default 'INR', status text default 'PENDING' check (status in ('PENDING','PAID','FAILED','REFUNDED')), plan text not null, created_at timestamptz default now(), updated_at timestamptz default now());`);
  const userId = randomUUID();
  const merchantId = `auramint_${userId.slice(0,8)}_${Date.now()}`;
  for (const [label, sql, values, code] of [
    ['current insert contains absent payment_provider', 'insert into orders(id,user_id,amount,currency,status,payment_provider) values($1,$2,$3,$4,$5,$6)', [merchantId,userId,9900,'INR','PENDING','cashfree'],'42703'],
    ['removing absent column exposes non-UUID id', 'insert into orders(id,user_id,amount,currency,status) values($1,$2,$3,$4,$5)',[merchantId,userId,9900,'INR','PENDING'],'22P02'],
    ['UUID alone still omits required plan', 'insert into orders(id,user_id,amount,currency,status) values($1,$2,$3,$4,$5)',[randomUUID(),userId,9900,'INR','PENDING'],'23502'],
  ]) {
    await assert.rejects(db.query(sql, values), e => { console.log(`${label}: ${e.code} ${e.message}`); return e.code === code; });
  }
  const result = await db.query('insert into orders(id,user_id,cashfree_order_id,amount,currency,status,plan) values($1,$2,$3,$4,$5,$6,$7) returning id,cashfree_order_id,plan', [randomUUID(),userId,merchantId,9900,'INR','PENDING','premium']);
  assert.equal(result.rows[0].cashfree_order_id,merchantId);
  console.log('PASS: UUID primary key + prefixed text merchant id + premium plan inserted. Local isolated database only.');
} finally { await db.close(); }
