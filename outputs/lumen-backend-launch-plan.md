# Lumen Backend Launch Plan

## Lowest-cost production shape

- Keep the current frontend on Vercel.
- Add Supabase Auth with magic link and Google sign-in.
- Add Supabase Postgres for the six PRD tables plus Row Level Security.
- Keep TXT/DOCX/PDF export client-side to avoid server costs.
- Keep the free reveal mostly deterministic, then call an LLM only for paid/full generation or explicit re-runs.
- Add Paddle or Lemon Squeezy only when the paywall is ready.
- Use one-time payment, not a trial or subscription: launch at £19, test £24, and offer one optional +£7 checkout bump.
- Keep the longer onboarding before the paywall. CV paste and job description paste must stay optional so the funnel works for users who are browsing on mobile or do not have documents nearby.

## Database tables

```sql
create table users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null,
  target_role text,
  search_stage text,
  plan text default 'free',
  lifetime_access_at timestamptz,
  created_at timestamptz default now()
);

create table cv_documents (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  raw_text text not null,
  optimized_text text,
  created_at timestamptz default now()
);

create table jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  jd_text text,
  company text,
  role text,
  created_at timestamptz default now()
);

create table analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  cv_id uuid references cv_documents(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  score integer not null,
  issues_json jsonb not null,
  created_at timestamptz default now()
);

create table cover_letters (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  job_id uuid references jobs(id) on delete cascade,
  body text not null,
  created_at timestamptz default now()
);

create table applications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  company text not null,
  role text not null,
  link text,
  status text not null default 'Applied',
  applied_at date,
  notes text,
  next_followup_at date,
  created_at timestamptz default now()
);
```

Add RLS on every table with policies where `auth.uid() = user_id`.

## Payment and usage tables

The PRD keeps the product data model to six tables. For production commerce, add two small operational tables:

```sql
create table purchases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  provider text not null,
  provider_checkout_id text unique,
  amount_gbp numeric(10,2) not null,
  product text not null,
  status text not null,
  purchased_at timestamptz default now()
);

create table generation_usage (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  generation_month date not null,
  count integer not null default 0,
  unique(user_id, generation_month)
);
```

Use `purchases` to restore access, handle refunds, and record the +£7 order bump. Use `generation_usage` for the fair-use cap.

## Paywall model

- Launch price: £19 inc. VAT.
- Test price: £24 inc. VAT once the funnel has enough traffic.
- No trial, no monthly renewal, no annual renewal.
- Checkout promise: "one payment, yours forever" and "no subscription".
- Order bump: optional +£7 Interview Answer Workbook or Role-Specific Bullet Builder.
- Fair use: unlimited for normal job searching, with a soft monthly generation cap to protect AI cost.
- Paywall should appear after the free reveal, never before the user has chosen a role, described the blocker, and either pasted or skipped their CV.

## AI integration

- Create one server endpoint: `POST /api/generate-application`.
- Inputs: `cv_text`, `job_text`, `target_role`, `mode`.
- Outputs: strict JSON matching the current frontend shapes: `analysis`, `optimizedCv`, `coverLetter`, `linkedInKit`, `interviewPrep`.
- Cost control: cache generations by a hash of `cv_text + job_text + target_role`, rate-limit free users, and only use LLM generation after email capture or payment.
- Keep the current deterministic engine as fallback if the AI call fails.
- Suggested fair-use starting point: 40 full generations per month per paid user, with manual review or cooldown above that.

## Environment variables

```bash
VITE_SUPABASE_URL=
VITE_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
AI_PROVIDER_API_KEY=
PADDLE_OR_LEMONSQUEEZY_API_KEY=
CHECKOUT_PRODUCT_ID_LIFETIME=
CHECKOUT_PRODUCT_ID_ORDER_BUMP=
```

## Launch order

1. Wire Supabase Auth and replace localStorage session persistence.
2. Add the six database tables and RLS policies.
3. Save scans, generated documents and tracker records to Supabase.
4. Add the LLM endpoint behind the same JSON contract as `src/engine.ts`.
5. Add the £19 one-time payment gate between reveal and workspace.
6. Add purchase restore, refund handling, fair-use tracking and the optional +£7 checkout bump.
7. Add privacy policy, terms, refund policy, file-retention/deletion policy, contact page and FAQ before running ads.

## Landing proof points

Use current stats only with source/date shown. Current copy uses:

- ONS Labour Market Overview, June 2026: 707,000 vacancies in March to May 2026, lowest since February to April 2021.
- ONS Labour Market Overview, June 2026: 4.9% UK unemployment for people aged 16+ in February to April 2026.
- Indeed Hiring Lab, June 2026: youth unemployment at 16.2%, described as the highest in over a decade.
