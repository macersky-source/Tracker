create extension if not exists "pgcrypto";

create table if not exists users (
  id uuid primary key default gen_random_uuid(),
  telegram_id bigint unique not null,
  username text,
  first_name text,
  daily_calories int not null default 2000,
  daily_protein int not null default 120,
  daily_fat int not null default 70,
  daily_carbs int not null default 250,
  created_at timestamptz not null default now()
);

create table if not exists food_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  entry_date date not null,
  meal_type text check (meal_type in ('breakfast', 'lunch', 'dinner', 'snack')),
  food_name text not null,
  calories numeric not null,
  protein numeric not null default 0,
  fat numeric not null default 0,
  carbs numeric not null default 0,
  serving_amount numeric,
  serving_unit text,
  source text not null check (source in ('fatsecret', 'ai_estimate')),
  fatsecret_id text,
  raw_input text,
  created_at timestamptz not null default now()
);

create index if not exists food_entries_user_date_idx
  on food_entries (user_id, entry_date);

create table if not exists favorites (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  food_name text not null,
  fatsecret_id text,
  default_serving jsonb,
  created_at timestamptz not null default now()
);

create table if not exists food_cache (
  fatsecret_id text primary key,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);
