-- Finance dashboard repair / simplification
-- Run this ONCE in Supabase -> SQL Editor.
-- It creates one reliable source-of-truth row for the dashboard.

begin;

create table if not exists public.finance_state (
  id smallint primary key check (id = 1),
  kfh_balance numeric(14,3) not null default 1.050,

  nbb_credit_limit numeric(14,3) not null default 200.000,
  nbb_available_credit numeric(14,3) not null default 59.516,
  nbb_statement_balance numeric(14,3),
  nbb_minimum_payment numeric(14,3),
  nbb_due_day smallint not null default 27,
  nbb_payment_due_date date,
  nbb_card_last4 text,

  ila_credit_limit numeric(14,3) not null default 1000.000,
  ila_available_credit numeric(14,3) not null default 437.960,
  ila_statement_balance numeric(14,3),
  ila_minimum_payment numeric(14,3),
  ila_due_day smallint not null default 27,
  ila_payment_due_date date,
  ila_card_last4 text,

  savings_current numeric(14,3) not null default 0.000,
  savings_goal numeric(14,3) not null default 5000.000,

  loan_original_amount numeric(14,3) not null default 14200.000,
  loan_contracted_total numeric(14,3) not null default 0.000,
  loan_outstanding numeric(14,3) not null default 14200.000,
  loan_monthly_installment numeric(14,3) not null default 201.000,
  loan_profit_rate numeric(8,4) not null default 0.0000,
  loan_total_installments integer not null default 84,
  loan_paid_installments integer not null default 0,
  loan_next_payment_date date,
  loan_end_date date,

  updated_at timestamptz not null default now()
);

insert into public.finance_state (id) values (1)
on conflict (id) do nothing;

-- Ensure the baseline values are present if this is the first repair run.
-- Existing values are intentionally not overwritten after row 1 exists.

alter table public.finance_state enable row level security;
alter table public.transactions enable row level security;

revoke all on table public.finance_state from anon;
revoke all on table public.transactions from anon;
grant select, update on table public.finance_state to authenticated;
grant select on table public.transactions to authenticated;

drop policy if exists "finance authenticated read state" on public.finance_state;
create policy "finance authenticated read state"
on public.finance_state for select to authenticated
using (true);

drop policy if exists "finance authenticated update state" on public.finance_state;
create policy "finance authenticated update state"
on public.finance_state for update to authenticated
using (true) with check (true);

-- Remove policies from the previous package that depended on finance_settings,
-- then give the signed-in dashboard straightforward read access.
drop policy if exists "finance owner can read transactions" on public.transactions;
drop policy if exists "finance authenticated read transactions" on public.transactions;
create policy "finance authenticated read transactions"
on public.transactions for select to authenticated
using (true);

create or replace function public.adjust_finance_state_kfh_balance(
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
    raise exception 'Invalid direction';
  end if;

  update public.finance_state
  set kfh_balance = coalesce(kfh_balance, 0) + v_delta,
      updated_at = now()
  where id = 1
  returning kfh_balance into v_balance;

  return v_balance;
end;
$$;

revoke all on function public.adjust_finance_state_kfh_balance(numeric, text) from public;
grant execute on function public.adjust_finance_state_kfh_balance(numeric, text) to service_role;

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='finance_state'
  ) then
    alter publication supabase_realtime add table public.finance_state;
  end if;

  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='transactions'
  ) then
    alter publication supabase_realtime add table public.transactions;
  end if;
end $$;

commit;
