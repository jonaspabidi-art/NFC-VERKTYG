-- Kors detta i Supabase SQL Editor for att skapa hela schemat.

create extension if not exists pgcrypto;

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  google_place_id text not null,
  password_hash text not null,
  discount_percent int not null default 10,
  discount_valid_days int not null default 30,
  high_rating_threshold smallint not null default 4, -- rating >= detta räknas som "högt" betyg
  owner_email text, -- valfri: dit lågbetygslarm/månadsrapport skickas, ingen alert om null
  last_monthly_report_sent_at timestamptz, -- null = aldrig skickad
  created_at timestamptz not null default now()
);

create table if not exists reviews (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text,
  device_id text not null,
  ip_hash text not null,
  clicked_google boolean not null default false,
  contact_email text, -- valfri: gästen vill bli kontaktad av restaurangen
  contact_phone text,
  created_at timestamptz not null default now()
);
create index if not exists reviews_restaurant_idx on reviews (restaurant_id, created_at desc);
create index if not exists reviews_device_idx on reviews (restaurant_id, device_id, created_at);

create table if not exists discount_codes (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants(id) on delete cascade,
  review_id uuid unique references reviews(id) on delete cascade,
  code text unique not null,
  valid_until timestamptz not null,
  used boolean not null default false,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists discount_codes_restaurant_idx on discount_codes (restaurant_id);
create index if not exists discount_codes_code_idx on discount_codes (code);

-- RLS på som försvar-i-djupled. Backend använder service_role-nyckeln som
-- alltid bypassar RLS, så ingen policy behövs här (default-deny för alla
-- andra nycklar, t.ex. om anon-nyckeln någonsin läckte till klienten).
alter table restaurants enable row level security;
alter table reviews enable row level security;
alter table discount_codes enable row level security;
