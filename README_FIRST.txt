FIXED VERSION

1. Supabase SQL Editor: run repair_setup.sql once.
2. Supabase Edge Functions: replace the whole existing index.ts with edge_function_index.ts and Deploy.
3. Website: replace index.html, app.js, style.css with these files.
4. Push website files to GitHub.
5. Sign in once on laptop and once on phone.

This version uses public.finance_state as the only source of truth for:
- KFH balance
- NBB credit card values
- ila credit card values
- Savings
- KFH financing

Transactions remain in public.transactions.
Realtime plus a 5-second fallback refresh keeps laptop and phone synchronized.
