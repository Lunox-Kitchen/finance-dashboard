-- Replace YOUR_LOGIN_EMAIL@example.com with the exact email address
-- of the Supabase Auth user you created.

alter table public.accounts enable row level security;
alter table public.transactions enable row level security;

revoke all on table public.accounts from anon;
revoke all on table public.transactions from anon;

grant select on table public.accounts to authenticated;
grant select on table public.transactions to authenticated;

drop policy if exists "finance owner can read accounts" on public.accounts;
create policy "finance owner can read accounts"
on public.accounts
for select
to authenticated
using (
  lower(auth.jwt() ->> 'email') = lower('YOUR_LOGIN_EMAIL@example.com')
);

drop policy if exists "finance owner can read transactions" on public.transactions;
create policy "finance owner can read transactions"
on public.transactions
for select
to authenticated
using (
  lower(auth.jwt() ->> 'email') = lower('YOUR_LOGIN_EMAIL@example.com')
);

-- Add the two tables to Supabase Realtime if they are not already there.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'accounts'
  ) then
    alter publication supabase_realtime add table public.accounts;
  end if;

  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'transactions'
  ) then
    alter publication supabase_realtime add table public.transactions;
  end if;
end $$;
