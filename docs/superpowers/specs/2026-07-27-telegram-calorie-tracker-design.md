# Telegram Mini App: AI Calorie Tracker — Design Spec

**Date:** 2026-07-27  
**Status:** Design approved; awaiting user review of this written spec before implementation plan  
**Audience:** Personal / small circle (~≤50 users)

## Goal

Telegram bot + Mini App for calorie tracking: log meals via free-text AI parsing and FatSecret food search, persist diary and goals in Supabase, host on Vercel.

## Decisions (locked)

| Topic | Choice |
|---|---|
| Input modes (MVP) | AI free-text + FatSecret search |
| Deferred (v2) | Photo of plate, barcode scan, day history calendar |
| Stack | Next.js (App Router) monorepo on Vercel + Supabase |
| Auth | Telegram WebApp `initData` (no passwords) |
| Food DB | FatSecret Platform API (OAuth2 client credentials) |
| AI | OpenAI GPT-4o-mini for text → structured food items (swap provider later if needed) |
| Hosting | Vercel (app + API + bot webhook) + Supabase (Postgres) |
| Cost target | ~$0–3/month for personal use |

## Architecture

```
Telegram User
  ├─ Bot (/start, optional text log, /today)
  └─ Mini App (React UI)
        │
        ▼
Vercel Next.js
  ├─ /api/auth/validate      — verify initData HMAC
  ├─ /api/diary/*            — CRUD food entries + daily totals
  ├─ /api/food/search        — FatSecret proxy
  ├─ /api/food/parse         — AI parse → FatSecret match
  └─ /api/bot/webhook        — Telegram updates
        │
        ├─► Supabase Postgres (users, food_entries, favorites, optional food_cache)
        ├─► FatSecret API
        └─► OpenAI API
```

### Data flows

**Search flow:** Mini App → `/api/food/search` → FatSecret `foods.search.v5` / `food.get.v5` → user picks serving → `/api/diary` → Supabase.

**AI text flow:** User text → `/api/food/parse` → LLM JSON `[{name, amount, unit}]` → for each item FatSecret search → best match + scaled macros → preview → user confirm → save. If no match: `source = ai_estimate`, UI shows ≈.

**Bot quick-add (optional MVP polish):** Message text → same parse pipeline → reply with kcal summary.

## Database schema (Supabase)

```sql
users
  id              uuid PK DEFAULT gen_random_uuid()
  telegram_id     bigint UNIQUE NOT NULL
  username        text
  first_name      text
  daily_calories  int DEFAULT 2000
  daily_protein   int DEFAULT 120
  daily_fat       int DEFAULT 70
  daily_carbs     int DEFAULT 250
  created_at      timestamptz DEFAULT now()

food_entries
  id              uuid PK DEFAULT gen_random_uuid()
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  entry_date      date NOT NULL
  meal_type       text  -- breakfast | lunch | dinner | snack
  food_name       text NOT NULL
  calories        numeric NOT NULL
  protein         numeric DEFAULT 0
  fat             numeric DEFAULT 0
  carbs           numeric DEFAULT 0
  serving_amount  numeric
  serving_unit    text
  source          text NOT NULL  -- fatsecret | ai_estimate
  fatsecret_id    text
  raw_input       text
  created_at      timestamptz DEFAULT now()

favorites
  id              uuid PK DEFAULT gen_random_uuid()
  user_id         uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE
  food_name       text NOT NULL
  fatsecret_id    text
  default_serving jsonb
  created_at      timestamptz DEFAULT now()

-- Optional cache to reduce FatSecret calls
food_cache
  fatsecret_id    text PK
  payload         jsonb NOT NULL
  updated_at      timestamptz DEFAULT now()
```

Indexes: `(user_id, entry_date)` on `food_entries`.

**Access pattern (MVP):** API uses Supabase `service_role` and filters by `telegram_id` resolved from validated `initData`. RLS policies can be added later if client talks to Supabase directly.

## Mini App screens (MVP)

1. **Today** — calorie progress, optional macro rings, meal list, “+ Add”.
2. **Add → Search** — FatSecret search, serving pick, save.
3. **Add → Text** — free-text field → AI preview (edit/remove lines) → confirm.
4. **Settings** — daily calorie/macro targets; FatSecret region language if needed.

**v1.1 / v2:** History calendar, photo recognition, barcode (`food.find_id_for_barcode.v2`).

UX: Telegram WebApp SDK theme; toast after save; disable double-submit on Save.

## External APIs

### FatSecret

- Register app at platform.fatsecret.com; Client ID + Secret.
- Backend-only OAuth2 client_credentials; cache access token ~1 hour.
- Methods: `foods.search.v5`, `food.get.v5`; barcode later.
- Prefer `region=RU` (or configurable) for Russian product names.
- Free tier ~5000 req/day is enough for personal use; use `food_cache` for hot items.

### OpenAI (parse)

System prompt returns strict JSON array of `{name, amount, unit}` for Russian/English meal descriptions. One retry on invalid JSON. Cost estimate: ~$0.001–0.003 per parse.

## Telegram bot

| Command / event | Behavior |
|---|---|
| `/start` | Welcome + WebApp button “Open tracker” |
| Free text | Offer/run AI parse + confirm kcal (optional in MVP polish) |
| `/today` | Text summary of today’s totals |

Webhook: `https://<vercel-app>/api/bot/webhook` with `secret_token` header check.

## Project structure

```
calorie-tracker/
├── app/
│   ├── page.tsx
│   ├── layout.tsx
│   └── api/
│       ├── auth/validate/
│       ├── diary/
│       ├── food/search/
│       ├── food/parse/
│       └── bot/webhook/
├── components/
├── lib/
│   ├── supabase.ts
│   ├── fatsecret.ts
│   ├── openai.ts
│   └── telegram.ts
├── supabase/migrations/
├── docs/superpowers/specs/
├── .env.example
└── README.md
```

### Environment variables

```
TELEGRAM_BOT_TOKEN=
TELEGRAM_WEBAPP_URL=
TELEGRAM_WEBHOOK_SECRET=
SUPABASE_URL=
SUPABASE_SERVICE_KEY=
FATSECRET_CLIENT_ID=
FATSECRET_CLIENT_SECRET=
OPENAI_API_KEY=
```

Never expose FatSecret/OpenAI/service keys to the client.

## Security

1. Verify Telegram Mini App `initData` with HMAC-SHA256 (`WebAppData` + bot token). Reject invalid → 401.
2. All FatSecret/OpenAI/Supabase service calls server-side only.
3. Bot webhook: validate `X-Telegram-Bot-Api-Secret-Token`.
4. Rate limits (personal, soft): parse ≤30/hour/user; search ≤60/hour/user.
5. Do not log full `initData` or API keys.

## Error handling

| Case | Behavior |
|---|---|
| FatSecret no match | AI estimate, `source=ai_estimate`, show ≈ |
| FatSecret down | Message: try text / retry later |
| Invalid AI JSON | One retry; then ask user to rephrase |
| Empty input | Client + server validation |
| Double tap save | Disable button until response |
| Supabase error | 503 + user-facing retry message |

## Testing (MVP)

- Unit: `initData` validation (valid / invalid).
- Integration: FatSecret search returns calories for a known query (mocked in CI if no keys).
- AI parse: sample Russian meal → ≥2 structured items (mock LLM in unit tests).
- Diary CRUD: create → list by date → delete → totals correct.
- Manual E2E in Telegram: `/start` → open Mini App → add via search and text → see Today.

## Implementation phases

1. **Skeleton** — Next.js + empty Mini App + bot `/start` + WebApp URL.
2. **Auth** — validate `initData`, upsert `users`.
3. **Diary** — CRUD + Today screen (manual/fixed macros OK).
4. **FatSecret** — search + serving + persist with `source=fatsecret`.
5. **AI text** — parse + match + preview + save.
6. **Polish** — settings, favorites, bot `/today` / quick text.
7. **v2** — photo, barcode, history.

## Out of scope (MVP)

- Billing / public multi-tenant product hardening
- Native mobile apps
- Direct client → Supabase without API
- Photo / barcode
- Full nutrition coaching / meal plans

## Cost estimate

| Service | Expected |
|---|---|
| Supabase | Free tier |
| Vercel | Hobby free |
| FatSecret | Free tier |
| OpenAI | ~$1–3/month light personal use |
| **Total** | **~$0–3/month** |
