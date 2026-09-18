begin;

-- ============================================================================
-- 202609170001_atomic_payments.sql
--
-- Atomic payment fulfillment for AuraMint.  LOCAL MIGRATION ONLY — applying it to
-- any live database is a separate, explicit release gate.
--
-- Baseline: the read-only catalog snapshot in `_audit/live-payment-schema.md`
-- (project drgparslvudatouqtjmx, Postgres 17.6.1.127): `public.orders` (9 columns,
-- `id uuid` PK, `cashfree_order_id text` with no constraint), `public.profiles`
-- (16 columns incl. `is_premium`, `premium_expires_at`, `boosts_remaining`), RLS
-- enabled on both, no payment RPC, table-wide INSERT/UPDATE/DELETE granted to
-- `anon`/`authenticated`.  No assumed columns are introduced: this migration adds
-- no column to any existing table.
--
-- Contents:
--   0. Preflight: refuse to migrate while untrusted PAID rows exist.
--   1. Durable purchase ledger (one row per fulfilled merchant order id).
--   2. public.orders: unique merchant order id + client write revocation.
--   3. public.profiles: invoker-rights entitlement guard trigger.
--   4. public.fulfill_premium_order(text, uuid, numeric, text) -> jsonb.
--   5. public.reconcile_premium_entitlements(integer) -> jsonb.
--   6. EXECUTE grants (service_role only).
--
-- Every statement is static SQL bound to no external input; the two RPC bodies use
-- only parameters and literals.  No dynamic SQL (no EXECUTE/format of statements)
-- appears anywhere in this file.
-- ============================================================================

-- ============================================================================
-- 0. Preflight — refuse any preexisting PAID order row
-- ============================================================================
-- Before this migration the ONLY write path to public.orders was the client INSERT
-- policy (`user_id = auth.uid()`, role `public`), so a historical row could carry
-- `status = 'PAID'` without any verified provider payment.  Such a row is
-- indistinguishable from a fabricated one, so the migration refuses to apply and
-- nothing after this block is created.  Review flagged rows against provider
-- records before re-applying.
do $preflight$
declare
  v_paid_count bigint;
begin
  select count(*)
    into v_paid_count
    from public.orders o
   where o.status = 'PAID';

  if v_paid_count > 0 then
    raise exception using
      errcode = 'P0001',
      message = 'atomic_payments migration refused: preexisting PAID orders require provider review';
  end if;
end
$preflight$;

-- ============================================================================
-- 1. Durable purchase ledger
-- ============================================================================
-- One immutable row per fulfilled merchant order id.  The ledger is what separates
-- "this purchase was already granted" from "this purchase was never granted", so a
-- retry can repair a missing premium flag without ever re-granting boosts.
--
-- `order_id` is unique (one grant per order row) but deliberately carries NO foreign
-- key: deleting an order row must not be able to erase the record that an
-- entitlement was granted.  `merchant_order_id` — the natural key the provider
-- reports and the key `fulfill_premium_order` conflicts on — is also unique, so a
-- re-created order row can never yield a second grant for the same provider order.
create table if not exists public.premium_purchases (
  id                uuid        not null default gen_random_uuid(),
  order_id          uuid        not null,
  merchant_order_id text        not null,
  user_id           uuid        not null references auth.users (id) on delete cascade,
  plan              text        not null,
  amount_minor      numeric     not null,
  currency          text        not null,
  boosts_granted    integer     not null,
  created_at        timestamptz not null default now(),
  constraint premium_purchases_pkey primary key (id),
  constraint premium_purchases_order_id_key unique (order_id),
  constraint premium_purchases_merchant_order_id_key unique (merchant_order_id),
  constraint premium_purchases_plan_check check (plan = 'premium'),
  constraint premium_purchases_amount_minor_check check (amount_minor = 9900),
  constraint premium_purchases_currency_check check (currency = 'INR'),
  constraint premium_purchases_boosts_granted_check check (boosts_granted = 5),
  constraint premium_purchases_merchant_order_id_check
    check (length(pg_catalog.btrim(merchant_order_id)) > 0)
);

comment on table public.premium_purchases is
  'Immutable ledger of fulfilled premium purchases. One row per fulfilled merchant order id; grants boosts exactly once per row.';

alter table public.premium_purchases enable row level security;

-- Clients have no legitimate access to the ledger: no policy is created for
-- anon/authenticated (deny by default) and their table privileges are revoked
-- below.  The explicit service_role policy keeps the service client working even
-- in environments where the role does not carry BYPASSRLS.
drop policy if exists premium_purchases_service_role_all on public.premium_purchases;
create policy premium_purchases_service_role_all
  on public.premium_purchases
  for all
  to service_role
  using (true)
  with check (true);

revoke all on table public.premium_purchases from public;
revoke all on table public.premium_purchases from anon, authenticated;
grant select, insert, update, delete on table public.premium_purchases to service_role;

-- ============================================================================
-- 2. public.orders — merchant order id uniqueness + client write revocation
-- ============================================================================
-- The provider-facing API resolves an order by merchant order id, so that id must
-- identify exactly one row (also makes the row lock in fulfill_premium_order
-- unambiguous).  The audit snapshot shows no such constraint exists today.
create unique index if not exists orders_cashfree_order_id_key
  on public.orders (cashfree_order_id)
  where cashfree_order_id is not null;

-- Bounded reconciliation scans PAID orders oldest-first.
create index if not exists orders_paid_created_at_idx
  on public.orders (created_at)
  where status = 'PAID';

-- Client roles must never create or mutate order rows again: a client-writable
-- INSERT is exactly how a fabricated PAID row could reach the reconciler.  Only the
-- service-role path writes orders from here on.  Column-level REVOKEs follow the
-- table-level ones: PostgreSQL keeps per-column ACL entries separately, so a
-- table-wide REVOKE alone would leave a pre-existing column grant active.
-- SELECT stays granted: the user-session read path proves ownership by
-- `user_id = auth.uid()` under the existing RLS policy.
revoke insert, update, delete, truncate, references, trigger
  on table public.orders from public;
revoke insert, update, delete, truncate, references, trigger
  on table public.orders from public, anon, authenticated;

revoke insert (id, user_id, cashfree_order_id, amount, currency, status, plan,
               created_at, updated_at)
  on table public.orders from public, anon, authenticated;
revoke update (id, user_id, cashfree_order_id, amount, currency, status, plan,
               created_at, updated_at)
  on table public.orders from public, anon, authenticated;
revoke references (id, user_id, cashfree_order_id, amount, currency, status, plan,
                   created_at, updated_at)
  on table public.orders from public, anon, authenticated;

-- ============================================================================
-- 3. public.profiles — entitlement guard (invoker rights)
-- ============================================================================
-- The owner-scoped UPDATE policy plus a table-wide UPDATE grant let a signed-in
-- user set `is_premium` / `premium_expires_at` on their own profile.  The guard
-- below runs BEFORE INSERT OR UPDATE on the profile row and refuses client-role
-- changes to entitlement fields while preserving the existing boost debit
-- (`boosts_remaining = boosts_remaining - 1`) behaviour.
--
-- Trust is decided from the ACTUAL database role executing the statement
-- (`current_user`) — superusers, BYPASSRLS roles, the profiles table owner and
-- members of the service/server roles pass.  Request metadata such as
-- `request.jwt.claims` is never consulted, so a client cannot spoof the check.
--
-- The function is SECURITY INVOKER on purpose: inside a SECURITY DEFINER function
-- owned by postgres (app trigger `handle_new_user`, or `fulfill_premium_order`)
-- `current_user` is the owner, which is a trusted writer.
create or replace function public.enforce_profile_entitlement_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $guard$
declare
  v_trusted boolean := false;
begin
  select (r.rolsuper or r.rolbypassrls)
    into v_trusted
    from pg_catalog.pg_roles r
   where r.rolname = current_user;

  if coalesce(v_trusted, false) then
    return new;
  end if;

  if current_user = (
       select pg_catalog.pg_get_userbyid(c.relowner)
         from pg_catalog.pg_class c
        where c.oid = 'public.profiles'::pg_catalog.regclass
     ) then
    return new;
  end if;

  if exists (
    select 1
      from pg_catalog.pg_roles r
     where r.rolname in ('service_role', 'supabase_admin', 'supabase_auth_admin', 'postgres')
       and pg_catalog.pg_has_role(current_user, r.oid, 'USAGE')
  ) then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if coalesce(new.is_premium, false) then
      raise exception using
        errcode = '42501',
        message = 'profiles.is_premium cannot be granted by a client role';
    end if;
    if new.premium_expires_at is not null then
      raise exception using
        errcode = '42501',
        message = 'profiles.premium_expires_at cannot be set by a client role';
    end if;
    if coalesce(new.boosts_remaining, 0) > 0 then
      raise exception using
        errcode = '42501',
        message = 'profiles.boosts_remaining cannot be granted by a client role';
    end if;
  elsif tg_op = 'UPDATE' then
    if new.is_premium is distinct from old.is_premium then
      raise exception using
        errcode = '42501',
        message = 'profiles.is_premium cannot be changed by a client role';
    end if;
    if new.premium_expires_at is distinct from old.premium_expires_at then
      raise exception using
        errcode = '42501',
        message = 'profiles.premium_expires_at cannot be changed by a client role';
    end if;
    if coalesce(new.boosts_remaining, 0) > coalesce(old.boosts_remaining, 0) then
      raise exception using
        errcode = '42501',
        message = 'profiles.boosts_remaining cannot be increased by a client role';
    end if;
  end if;

  return new;
end;
$guard$;

drop trigger if exists profiles_entitlement_guard on public.profiles;
create trigger profiles_entitlement_guard
  before insert or update on public.profiles
  for each row
  execute function public.enforce_profile_entitlement_guard();

-- ============================================================================
-- 4. fulfill_premium_order — the single transactional fulfillment entry point
-- ============================================================================
-- Contract:
--   p_order_id     text    merchant order id (public.orders.cashfree_order_id)
--   p_user_id      uuid    buyer (must equal orders.user_id and have a profile)
--   p_amount_minor numeric verified amount in minor units (must be exactly 9900)
--   p_currency     text    verified currency (must be INR)
--   returns jsonb  { "applied": boolean, "recovered": boolean }
--
--   applied   = this call created the ledger grant (boosts were added once)
--   recovered = this call repaired drift on an already-ledgered purchase
--               (missing is_premium flag and/or a PENDING status); boosts untouched
--   Both false = the purchase was already fully granted; nothing changed.
--
--   Any refused input (missing/blank/mismatched arguments, unknown or foreign order,
--   non-premium plan, stored amount/currency mismatch, REFUNDED/absent status,
--   missing profile) raises, which rolls back every write of the call.
--
--   Refunded orders are rejected explicitly.  PAID orders without a ledger are
--   fulfillable because, after section 0 and section 2, only trusted service writes
--   can produce a PAID row at all.
create or replace function public.fulfill_premium_order(
  p_order_id text,
  p_user_id uuid,
  p_amount_minor numeric,
  p_currency text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $function$
declare
  c_plan          constant text    := 'premium';
  c_amount_minor  constant numeric := 9900;
  c_currency      constant text    := 'INR';
  c_boosts        constant integer := 5;
  v_order         public.orders%rowtype;
  v_is_premium    boolean;
  v_ledger_id     uuid;
  v_applied       boolean := false;
  v_recovered     boolean := false;
begin
  -- Defensive argument validation: a malformed call must never reach a grant.
  if p_order_id is null or pg_catalog.btrim(p_order_id) = '' then
    raise exception 'fulfill_premium_order: merchant order id is required';
  end if;
  if p_user_id is null then
    raise exception 'fulfill_premium_order: user id is required';
  end if;
  if p_amount_minor is null or p_amount_minor is distinct from c_amount_minor then
    raise exception 'fulfill_premium_order: amount must be exactly % minor units', c_amount_minor;
  end if;
  if p_currency is null
     or pg_catalog.upper(pg_catalog.btrim(p_currency)) is distinct from c_currency then
    raise exception 'fulfill_premium_order: currency must be %', c_currency;
  end if;

  -- Lock the merchant order row first: validation and mutation happen under one
  -- lock, so there is no check/write gap.
  select o.*
    into v_order
    from public.orders o
   where o.cashfree_order_id = p_order_id
   order by o.id
   limit 1
     for update;

  if not found then
    raise exception 'fulfill_premium_order: no order found for the provided merchant order id';
  end if;

  if v_order.user_id is distinct from p_user_id then
    raise exception 'fulfill_premium_order: order does not belong to the provided user';
  end if;
  if v_order.plan is distinct from c_plan then
    raise exception 'fulfill_premium_order: only the % plan can be fulfilled', c_plan;
  end if;
  if v_order.amount is null
     or v_order.amount is distinct from c_amount_minor
     or v_order.amount is distinct from p_amount_minor then
    raise exception 'fulfill_premium_order: stored order amount does not match the verified amount';
  end if;
  if v_order.currency is null
     or pg_catalog.upper(pg_catalog.btrim(v_order.currency)) is distinct from c_currency
     or pg_catalog.upper(pg_catalog.btrim(v_order.currency))
        is distinct from pg_catalog.upper(pg_catalog.btrim(p_currency)) then
    raise exception 'fulfill_premium_order: stored order currency does not match %', c_currency;
  end if;
  if v_order.status is null then
    raise exception 'fulfill_premium_order: order has no status';
  end if;
  if v_order.status = 'REFUNDED' then
    raise exception 'fulfill_premium_order: refunded orders cannot be fulfilled';
  end if;
  if v_order.status not in ('PENDING', 'FAILED', 'PAID') then
    raise exception 'fulfill_premium_order: order status % is not fulfillable', v_order.status;
  end if;

  -- Lock the entitlement row.  A missing profile (or user) rolls back everything
  -- this call wrote; the order stays exactly as the caller left it.
  select p.is_premium
    into v_is_premium
    from public.profiles p
   where p.id = p_user_id
     for update;

  if not found then
    raise exception 'fulfill_premium_order: no profile exists for the provided user';
  end if;

  -- One durable grant per merchant order id.  Conflicting on the merchant order id
  -- (the provider's natural key) means a re-created order row still cannot yield a
  -- second grant.  A duplicate delivery reaches the ELSE branch.
  insert into public.premium_purchases (
    order_id, merchant_order_id, user_id, plan, amount_minor, currency, boosts_granted
  ) values (
    v_order.id, p_order_id, p_user_id, c_plan, c_amount_minor, c_currency, c_boosts
  )
  on conflict (merchant_order_id) do nothing
  returning id into v_ledger_id;

  if v_ledger_id is not null then
    v_applied := true;

    -- First grant for this purchase: ADD five boosts; never reset them, never
    -- rewrite premium_expires_at (lifetime premium).
    update public.profiles p
       set is_premium = true,
           boosts_remaining = coalesce(p.boosts_remaining, 0) + c_boosts
     where p.id = p_user_id;
  else
    if not exists (
      select 1 from public.premium_purchases l
       where l.merchant_order_id = p_order_id
         and l.order_id = v_order.id and l.user_id = p_user_id
    ) then
      raise exception 'fulfill_premium_order: purchase identity mismatch';
    end if;
    -- Duplicate delivery for an already-ledgered purchase: never re-grant boosts.
    if v_is_premium is distinct from true then
      update public.profiles p
         set is_premium = true
       where p.id = p_user_id;
      v_recovered := true;
    end if;
  end if;

  if v_order.status in ('PENDING', 'FAILED') then
    update public.orders o
       set status = 'PAID'
     where o.id = v_order.id
       and o.status in ('PENDING', 'FAILED');

    if not v_applied then
      -- Ledger existed while the status was still PENDING: repaired drift.
      v_recovered := true;
    end if;
  end if;

  if v_applied or v_recovered then
    insert into public.activity_log(user_id, action, metadata)
      values(p_user_id, 'payment.fulfilled',
        jsonb_build_object('order_id', p_order_id, 'applied', v_applied, 'recovered', v_recovered));
  end if;
  return jsonb_build_object('applied', v_applied, 'recovered', v_recovered);
end;
$function$;

comment on function public.fulfill_premium_order(text, uuid, numeric, text) is
  'Service-only atomic fulfillment: locks the merchant order and profile, validates plan=premium / amount=9900 / currency=INR, records one ledger grant, adds 5 boosts once per distinct purchase, repairs a missing premium flag on retries. Returns {applied, recovered}.';

-- ============================================================================
-- 5. reconcile_premium_entitlements — bounded, self-healing sweep
-- ============================================================================
-- Considers only PAID orders that either have no purchase-ledger row or whose owner
-- is missing the premium flag, locks a bounded batch with SKIP LOCKED, and reuses
-- the transactional fulfillment function row by row.  One row's exception is
-- counted as `failed` and does not abort the sweep.
--
-- Returns jsonb { "attempted": int, "repaired": int, "failed": int }.
create or replace function public.reconcile_premium_entitlements(p_limit integer default 100)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $reconcile$
declare
  c_max_limit  constant integer := 100;
  v_limit      integer;
  v_order      record;
  v_result     jsonb;
  v_attempted  integer := 0;
  v_repaired   integer := 0;
  v_failed     integer := 0;
begin
  -- Bounded 1..100; NULL falls back to the default.
  v_limit := least(c_max_limit, greatest(1, coalesce(p_limit, c_max_limit)));

  for v_order in
    select o.id, o.cashfree_order_id, o.user_id
      from public.orders o
     where o.status = 'PAID'
       and o.cashfree_order_id is not null
       and pg_catalog.btrim(o.cashfree_order_id) <> ''
       and (
         not exists (
           select 1
             from public.premium_purchases l
            where l.merchant_order_id = o.cashfree_order_id
         )
         or exists (
           select 1
             from public.profiles p
            where p.id = o.user_id
              and p.is_premium is distinct from true
         )
       )
     order by o.created_at nulls last, o.id
     limit v_limit
       for update of o skip locked
  loop
    v_attempted := v_attempted + 1;

    begin
      v_result := public.fulfill_premium_order(
        v_order.cashfree_order_id,
        v_order.user_id,
        9900,
        'INR'
      );

      if coalesce((v_result ->> 'applied')::boolean, false)
         or coalesce((v_result ->> 'recovered')::boolean, false) then
        v_repaired := v_repaired + 1;
      end if;
    exception
      when others then
        -- Per-row isolation: one unrecoverable row is counted, never rethrown.
        v_failed := v_failed + 1;
    end;
  end loop;

  return jsonb_build_object(
    'attempted', v_attempted,
    'repaired', v_repaired,
    'failed', v_failed
  );
end;
$reconcile$;

comment on function public.reconcile_premium_entitlements(integer) is
  'Service-only bounded sweep over PAID orders with a missing ledger grant or missing premium flag. Locks at most 1..100 rows with SKIP LOCKED and reuses fulfill_premium_order per row. Returns {attempted, repaired, failed}.';

-- ============================================================================
-- 6. EXECUTE grants — service_role only
-- ============================================================================
-- New functions default to EXECUTE for PUBLIC, which would expose these definer
-- functions to every role including anon/authenticated.  Revoke first, then grant
-- exactly service_role.
revoke all on function public.fulfill_premium_order(text, uuid, numeric, text)
  from public;
revoke all on function public.fulfill_premium_order(text, uuid, numeric, text)
  from anon, authenticated;
grant execute on function public.fulfill_premium_order(text, uuid, numeric, text)
  to service_role;

revoke all on function public.reconcile_premium_entitlements(integer) from public;
revoke all on function public.reconcile_premium_entitlements(integer)
  from anon, authenticated;
grant execute on function public.reconcile_premium_entitlements(integer)
  to service_role;

revoke all on function public.enforce_profile_entitlement_guard() from public;
revoke all on function public.enforce_profile_entitlement_guard() from anon, authenticated;

commit;
