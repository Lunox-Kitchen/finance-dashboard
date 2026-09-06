-- Full-sync upgrade for the personal finance dashboard.
-- Run this once in Supabase -> SQL Editor.
-- It keeps transactions/accounts in Supabase, adds synced dashboard settings,
-- seeds the starting balances you provided, and enables safe authenticated access.

begin;

-- ---------------------------------------------------------
-- 1) Extend the existing accounts / transactions tables
-- ---------------------------------------------------------

alter table public.accounts
  add column if not exists credit_limit numeric(14,3),
  add column if not exists due_day smallint;

alter table public.transactions
  add column if not exists source_hash text;

-- Prevent duplicate SMS retries from being recorded twice.
create unique index if not exists transactions_source_hash_uidx
  on public.transactions (source_hash)
  where source_hash is not null;

-- ---------------------------------------------------------
-- 2) Synced dashboard-only settings
-- ---------------------------------------------------------

create table if not exists public.finance_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  savings_current numeric(14,3) not null default 0,
  savings_goal numeric(14,3) not null default 5000,
  loan_original_amount numeric(14,3) not null default 0,
  loan_contracted_total numeric(14,3) not null default 0,
  loan_outstanding numeric(14,3) not null default 0,
  loan_monthly_installment numeric(14,3) not null default 0,
  loan_profit_rate numeric(8,4) not null default 0,
  loan_total_installments integer not null default 0,
  loan_paid_installments integer not null default 0,
  loan_next_payment_date date,
  loan_end_date date,
  updated_at timestamptz not null default now()
);

-- This project was set up with one personal login. Seed only the oldest Auth user
-- so any future Auth user is NOT automatically granted finance access.
insert into public.finance_settings (
  user_id,
  savings_current,
  savings_goal,
  loan_original_amount,
  loan_contracted_total,
  loan_outstanding,
  loan_monthly_installment,
  loan_profit_rate,
  loan_total_installments,
  loan_paid_installments
)
select
  id,
  0.000,
  5000.000,
  14200.000,
  0.000,
  14200.000,
  201.000,
  0.0000,
  84,
  0
from auth.users
order by created_at asc
limit 1
on conflict (user_id) do update set
  savings_current = excluded.savings_current,
  savings_goal = excluded.savings_goal,
  loan_original_amount = excluded.loan_original_amount,
  loan_outstanding = excluded.loan_outstanding,
  loan_monthly_installment = excluded.loan_monthly_installment,
  loan_total_installments = excluded.loan_total_installments,
  loan_paid_installments = excluded.loan_paid_installments,
  updated_at = now();

-- ---------------------------------------------------------
-- 3) Seed the exact starting values supplied
-- ---------------------------------------------------------

update public.accounts
set
  balance = 1.050,
  updated_at = now()
where upper(bank) = 'KFH'
  and account_type = 'debit';

update public.accounts
set
  credit_limit = 200.000,
  available_credit = 59.516,
  due_day = 27,
  updated_at = now()
where upper(bank) = 'NBB'
  and account_type = 'credit';

update public.accounts
set
  credit_limit = 1000.000,
  available_credit = 437.960,
  due_day = 27,
  updated_at = now()
where lower(bank) = 'ila'
  and account_type = 'credit';

-- ---------------------------------------------------------
-- 4) Atomic KFH balance adjustment RPC
-- ---------------------------------------------------------

create or replace function public.adjust_kfh_balance(
  p_amount numeric,
  p_direction text
)
returns numeric
language plpgsql
security definer
set search_path = public
as $$
declare
  v_balance numeric;
  v_delta numeric;
begin
  if p_amount is null or p_amount < 0 then
    raise exception 'Invalid amount';
  end if;

  if p_direction = 'credit' then
    v_delta := p_amount;
  elsif p_direction = 'debit' then
    v_delta := -p_amount;
  else
    raise exception 'Invalid direction: %', p_direction;
  end if;

  update public.accounts
  set
    balance = coalesce(balance, 0) + v_delta,
    updated_at = now()
  where upper(bank) = 'KFH'
    and account_type = 'debit'
  returning balance into v_balance;

  if v_balance is null then
    raise exception 'KFH debit account row was not found in public.accounts';
  end if;

  return v_balance;
end;
$$;

revoke all on function public.adjust_kfh_balance(numeric, text) from public;
grant execute on function public.adjust_kfh_balance(numeric, text) to service_role;

-- ---------------------------------------------------------
-- 5) Row Level Security
-- ---------------------------------------------------------

alter table public.accounts enable row level security;
alter table public.transactions enable row level security;
alter table public.finance_settings enable row level security;

revoke all on table public.accounts from anon;
revoke all on table public.transactions from anon;
revoke all on table public.finance_settings from anon;

grant select, update on table public.accounts to authenticated;
grant select on table public.transactions to authenticated;
grant select, update on table public.finance_settings to authenticated;

-- finance_settings: a user may only read/update their own row.
drop policy if exists "finance owner read settings" on public.finance_settings;
create policy "finance owner read settings"
on public.finance_settings
for select
to authenticated
using (user_id = auth.uid());

drop policy if exists "finance owner update settings" on public.finance_settings;
create policy "finance owner update settings"
on public.finance_settings
for update
to authenticated
using (user_id = auth.uid())
with check (user_id = auth.uid());

-- accounts / transactions: only the one Auth user seeded into finance_settings
-- is treated as the finance owner.
drop policy if exists "finance owner can read accounts" on public.accounts;
create policy "finance owner can read accounts"
on public.accounts
for select
to authenticated
using (
  exists (
    select 1
    from public.finance_settings fs
    where fs.user_id = auth.uid()
  )
);

drop policy if exists "finance owner can update accounts" on public.accounts;
create policy "finance owner can update accounts"
on public.accounts
for update
to authenticated
using (
  exists (
    select 1
    from public.finance_settings fs
    where fs.user_id = auth.uid()
  )
)
with check (
  exists (
    select 1
    from public.finance_settings fs
    where fs.user_id = auth.uid()
  )
);

drop policy if exists "finance owner can read transactions" on public.transactions;
create policy "finance owner can read transactions"
on public.transactions
for select
to authenticated
using (
  exists (
    select 1
    from public.finance_settings fs
    where fs.user_id = auth.uid()
  )
);

-- ---------------------------------------------------------
-- 6) Realtime
-- ---------------------------------------------------------

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'accounts'
  ) then
    alter publication supabase_realtime add table public.accounts;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transactions'
  ) then
    alter publication supabase_realtime add table public.transactions;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'finance_settings'
  ) then
    alter publication supabase_realtime add table public.finance_settings;
  end if;
end $$;

commit;
