# Telegram AI Calorie Tracker Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship a personal Telegram Mini App + bot that logs meals via FatSecret search and AI free-text parsing, stores diary/goals in Supabase, and runs on Vercel.

**Architecture:** Next.js App Router on Vercel serves the Mini App UI and serverless API routes. Telegram `initData` is verified with HMAC; all FatSecret/OpenAI/Supabase service calls stay server-side. Bot webhook shares the same parse/diary logic.

**Tech Stack:** Next.js 15 (App Router), React 19, TypeScript, Vitest, `@supabase/supabase-js`, OpenAI SDK, Telegram Bot API (fetch), FatSecret Platform API (OAuth2 client credentials).

**Spec:** `docs/superpowers/specs/2026-07-27-telegram-calorie-tracker-design.md`

## Global Constraints

- MVP only: AI free-text + FatSecret search + diary + settings; no photo, barcode, or history calendar
- Secrets never in client: FatSecret, OpenAI, Supabase service key, bot token are server-only
- Auth: Telegram WebApp `initData` HMAC-SHA256 only (no passwords)
- AI provider: OpenAI `gpt-4o-mini`
- FatSecret region default: `RU`
- API uses Supabase `service_role` and filters by validated `telegram_id`
- Rate limits: parse ≤30/hour/user, search ≤60/hour/user
- Meal types: `breakfast` | `lunch` | `dinner` | `snack`
- Entry sources: `fatsecret` | `ai_estimate`
- Commits: small, frequent; do not change git config
- TDD for pure libs and API handlers where practical

---

## File Structure

| Path | Responsibility |
|---|---|
| `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts` | Tooling |
| `.env.example` | Documented env vars (no secrets) |
| `supabase/migrations/001_init.sql` | Schema: users, food_entries, favorites, food_cache |
| `lib/types.ts` | Shared domain types |
| `lib/telegram.ts` | `verifyInitData`, `parseInitDataUser`, webhook secret check |
| `lib/supabase.ts` | Service-role client factory |
| `lib/users.ts` | Upsert / get user by telegram_id |
| `lib/diary.ts` | List / create / delete entries, daily totals |
| `lib/fatsecret.ts` | OAuth token + search + get food |
| `lib/openai-parse.ts` | Text → structured food items JSON |
| `lib/match-foods.ts` | Match parsed items to FatSecret or ai_estimate |
| `lib/rate-limit.ts` | In-memory per-user hourly limits |
| `lib/auth-request.ts` | Extract + verify `X-Telegram-Init-Data` → user |
| `app/api/auth/validate/route.ts` | POST validate + upsert user |
| `app/api/diary/route.ts` | GET list by date, POST create |
| `app/api/diary/[id]/route.ts` | DELETE entry |
| `app/api/food/search/route.ts` | GET FatSecret search |
| `app/api/food/[id]/route.ts` | GET food details + servings |
| `app/api/food/parse/route.ts` | POST AI parse + match |
| `app/api/settings/route.ts` | GET/PATCH daily goals |
| `app/api/bot/webhook/route.ts` | Telegram updates |
| `app/layout.tsx`, `app/page.tsx`, `app/globals.css` | Mini App shell |
| `components/TodayView.tsx` | Progress + meal list |
| `components/AddSearch.tsx` | Search + serving pick |
| `components/AddText.tsx` | Free-text parse preview |
| `components/SettingsView.tsx` | Goals form |
| `components/Nav.tsx` | Simple tab/nav |
| `tests/*.test.ts` | Unit tests for libs |

---

### Task 1: Scaffold Next.js + Vitest

**Files:**
- Create: `package.json`, `tsconfig.json`, `next.config.ts`, `vitest.config.ts`, `app/layout.tsx`, `app/page.tsx`, `app/globals.css`, `.env.example`, `.gitignore`
- Test: smoke via `npm test` (empty suite ok) and `npm run build`

**Interfaces:**
- Consumes: none
- Produces: runnable Next.js app with Vitest configured for `tests/**/*.test.ts`

- [ ] **Step 1: Create Next.js app with TypeScript in the repo root**

Run from `C:\Users\user\Projects\calorie-tracker` (keep existing `docs/` and `.git`):

```bash
npx create-next-app@latest . --typescript --eslint --app --src-dir=false --tailwind=false --import-alias "@/*" --turbopack --yes
```

If create-next-app refuses non-empty dir, scaffold into a temp folder and move `app/`, `package.json`, `tsconfig.json`, `next.config.*`, `eslint.config.*`, `public/` into the repo root without deleting `docs/`.

- [ ] **Step 2: Add Vitest + dependencies**

```bash
npm install @supabase/supabase-js openai
npm install -D vitest @types/node
```

Update `package.json` scripts:

```json
{
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint",
    "test": "vitest run",
    "test:watch": "vitest"
  }
}
```

Create `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
    },
  },
});
```

- [ ] **Step 3: Add `.env.example` and ensure `.gitignore` includes `.env*`**

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

- [ ] **Step 4: Replace `app/page.tsx` with a stub**

```tsx
export default function Home() {
  return (
    <main style={{ padding: 16, fontFamily: "system-ui" }}>
      <h1>Calorie Tracker</h1>
      <p>Mini App scaffold</p>
    </main>
  );
}
```

- [ ] **Step 5: Verify**

```bash
npm test
npm run build
```

Expected: tests exit 0 (0 tests ok); build succeeds.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "chore: scaffold Next.js app with Vitest"
```

---

### Task 2: Telegram initData verification (TDD)

**Files:**
- Create: `lib/telegram.ts`, `tests/telegram.test.ts`
- Create: `lib/types.ts` (minimal `TelegramWebAppUser`)

**Interfaces:**
- Consumes: `process.env.TELEGRAM_BOT_TOKEN`
- Produces:
  - `verifyInitData(initData: string, botToken: string): boolean`
  - `parseInitDataUser(initData: string): TelegramWebAppUser | null`
  - `verifyWebhookSecret(headerValue: string | null, expected: string): boolean`
  - type `TelegramWebAppUser = { id: number; first_name?: string; username?: string }`

- [ ] **Step 1: Write failing tests**

Create `tests/telegram.test.ts`:

```ts
import { createHmac } from "crypto";
import { describe, expect, it } from "vitest";
import {
  parseInitDataUser,
  verifyInitData,
  verifyWebhookSecret,
} from "@/lib/telegram";

function buildInitData(user: object, botToken: string): string {
  const userJson = JSON.stringify(user);
  const params = new URLSearchParams();
  params.set("user", userJson);
  params.set("auth_date", "1700000000");
  params.set("query_id", "AAEAAAE");

  const filtered: string[] = [];
  for (const [k, v] of params.entries()) {
    if (k !== "hash") filtered.push(`${k}=${v}`);
  }
  filtered.sort();
  const dataCheckString = filtered.join("\n");
  const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
  const hash = createHmac("sha256", secretKey).update(dataCheckString).digest("hex");
  params.set("hash", hash);
  return params.toString();
}

describe("verifyInitData", () => {
  const token = "123456:ABC-DEF";

  it("accepts valid initData", () => {
    const initData = buildInitData(
      { id: 42, first_name: "Maksim", username: "m" },
      token,
    );
    expect(verifyInitData(initData, token)).toBe(true);
  });

  it("rejects tampered initData", () => {
    const initData = buildInitData({ id: 42, first_name: "Maksim" }, token);
    expect(verifyInitData(initData + "x", token)).toBe(false);
  });

  it("rejects wrong bot token", () => {
    const initData = buildInitData({ id: 42 }, token);
    expect(verifyInitData(initData, "wrong")).toBe(false);
  });
});

describe("parseInitDataUser", () => {
  it("returns user id from valid initData", () => {
    const token = "123456:ABC-DEF";
    const initData = buildInitData(
      { id: 99, first_name: "A", username: "u" },
      token,
    );
    expect(verifyInitData(initData, token)).toBe(true);
    expect(parseInitDataUser(initData)).toEqual({
      id: 99,
      first_name: "A",
      username: "u",
    });
  });
});

describe("verifyWebhookSecret", () => {
  it("matches expected secret", () => {
    expect(verifyWebhookSecret("s3cret", "s3cret")).toBe(true);
    expect(verifyWebhookSecret("nope", "s3cret")).toBe(false);
    expect(verifyWebhookSecret(null, "s3cret")).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL**

```bash
npm test
```

Expected: FAIL — cannot find module `@/lib/telegram` or functions undefined.

- [ ] **Step 3: Implement `lib/types.ts` and `lib/telegram.ts`**

`lib/types.ts`:

```ts
export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  username?: string;
};

export type MealType = "breakfast" | "lunch" | "dinner" | "snack";
export type EntrySource = "fatsecret" | "ai_estimate";

export type UserRow = {
  id: string;
  telegram_id: number;
  username: string | null;
  first_name: string | null;
  daily_calories: number;
  daily_protein: number;
  daily_fat: number;
  daily_carbs: number;
};

export type FoodEntryRow = {
  id: string;
  user_id: string;
  entry_date: string;
  meal_type: MealType | null;
  food_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  serving_amount: number | null;
  serving_unit: string | null;
  source: EntrySource;
  fatsecret_id: string | null;
  raw_input: string | null;
  created_at: string;
};

export type ParsedFoodItem = {
  name: string;
  amount: number;
  unit: string;
};

export type MatchedFoodItem = ParsedFoodItem & {
  food_name: string;
  calories: number;
  protein: number;
  fat: number;
  carbs: number;
  source: EntrySource;
  fatsecret_id: string | null;
};
```

`lib/telegram.ts`:

```ts
import { createHmac, timingSafeEqual } from "crypto";
import type { TelegramWebAppUser } from "./types";

export function verifyInitData(initData: string, botToken: string): boolean {
  try {
    const params = new URLSearchParams(initData);
    const hash = params.get("hash");
    if (!hash) return false;

    const pairs: string[] = [];
    for (const [key, value] of params.entries()) {
      if (key === "hash") continue;
      pairs.push(`${key}=${value}`);
    }
    pairs.sort();
    const dataCheckString = pairs.join("\n");
    const secretKey = createHmac("sha256", "WebAppData").update(botToken).digest();
    const computed = createHmac("sha256", secretKey)
      .update(dataCheckString)
      .digest("hex");

    const a = Buffer.from(computed, "hex");
    const b = Buffer.from(hash, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function parseInitDataUser(initData: string): TelegramWebAppUser | null {
  try {
    const params = new URLSearchParams(initData);
    const raw = params.get("user");
    if (!raw) return null;
    const user = JSON.parse(raw) as TelegramWebAppUser;
    if (typeof user.id !== "number") return null;
    return {
      id: user.id,
      first_name: user.first_name,
      username: user.username,
    };
  } catch {
    return null;
  }
}

export function verifyWebhookSecret(
  headerValue: string | null,
  expected: string,
): boolean {
  if (!headerValue || !expected) return false;
  const a = Buffer.from(headerValue);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npm test
```

Expected: all telegram tests PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/types.ts lib/telegram.ts tests/telegram.test.ts
git commit -m "feat: verify Telegram WebApp initData HMAC"
```

---

### Task 3: Supabase schema + client + user upsert

**Files:**
- Create: `supabase/migrations/001_init.sql`, `lib/supabase.ts`, `lib/users.ts`, `tests/users.test.ts` (mock optional — prefer integration skip if no env)

**Interfaces:**
- Consumes: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`
- Produces:
  - `getSupabase(): SupabaseClient`
  - `upsertTelegramUser(input: { telegram_id: number; username?: string; first_name?: string }): Promise<UserRow>`
  - `getUserByTelegramId(telegram_id: number): Promise<UserRow | null>`

- [ ] **Step 1: Write migration SQL**

`supabase/migrations/001_init.sql`:

```sql
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
```

Apply manually in Supabase SQL Editor when credentials exist (document in README later).

- [ ] **Step 2: Implement client + users**

`lib/supabase.ts`:

```ts
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let client: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient {
  if (client) return client;
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) {
    throw new Error("SUPABASE_URL and SUPABASE_SERVICE_KEY are required");
  }
  client = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return client;
}
```

`lib/users.ts`:

```ts
import { getSupabase } from "./supabase";
import type { UserRow } from "./types";

export async function upsertTelegramUser(input: {
  telegram_id: number;
  username?: string;
  first_name?: string;
}): Promise<UserRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .upsert(
      {
        telegram_id: input.telegram_id,
        username: input.username ?? null,
        first_name: input.first_name ?? null,
      },
      { onConflict: "telegram_id" },
    )
    .select(
      "id, telegram_id, username, first_name, daily_calories, daily_protein, daily_fat, daily_carbs",
    )
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Failed to upsert user");
  }
  return data as UserRow;
}

export async function getUserByTelegramId(
  telegram_id: number,
): Promise<UserRow | null> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .select(
      "id, telegram_id, username, first_name, daily_calories, daily_protein, daily_fat, daily_carbs",
    )
    .eq("telegram_id", telegram_id)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as UserRow | null) ?? null;
}

export async function updateUserGoals(
  telegram_id: number,
  goals: Partial<{
    daily_calories: number;
    daily_protein: number;
    daily_fat: number;
    daily_carbs: number;
  }>,
): Promise<UserRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("users")
    .update(goals)
    .eq("telegram_id", telegram_id)
    .select(
      "id, telegram_id, username, first_name, daily_calories, daily_protein, daily_fat, daily_carbs",
    )
    .single();
  if (error || !data) {
    throw new Error(error?.message ?? "Failed to update goals");
  }
  return data as UserRow;
}
```

- [ ] **Step 3: Auth request helper**

`lib/auth-request.ts`:

```ts
import { parseInitDataUser, verifyInitData } from "./telegram";
import { upsertTelegramUser } from "./users";
import type { UserRow } from "./types";

export async function requireUserFromRequest(
  request: Request,
): Promise<UserRow> {
  const initData = request.headers.get("x-telegram-init-data");
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!initData || !botToken) {
    throw new AuthError("Missing init data or bot token");
  }
  if (!verifyInitData(initData, botToken)) {
    throw new AuthError("Invalid init data");
  }
  const tgUser = parseInitDataUser(initData);
  if (!tgUser) throw new AuthError("Missing user in init data");
  return upsertTelegramUser({
    telegram_id: tgUser.id,
    username: tgUser.username,
    first_name: tgUser.first_name,
  });
}

export class AuthError extends Error {
  status = 401;
  constructor(message: string) {
    super(message);
    this.name = "AuthError";
  }
}
```

- [ ] **Step 4: Auth validate route**

`app/api/auth/validate/route.ts`:

```ts
import { NextResponse } from "next/server";
import { AuthError, requireUserFromRequest } from "@/lib/auth-request";

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    return NextResponse.json({ user });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 5: Commit**

```bash
git add supabase lib/supabase.ts lib/users.ts lib/auth-request.ts app/api/auth
git commit -m "feat: Supabase schema and Telegram user upsert"
```

---

### Task 4: Diary CRUD (TDD on totals helper)

**Files:**
- Create: `lib/diary.ts`, `tests/diary.test.ts`, `app/api/diary/route.ts`, `app/api/diary/[id]/route.ts`

**Interfaces:**
- Consumes: `UserRow`, Supabase
- Produces:
  - `sumMacros(entries: Pick<FoodEntryRow,'calories'|'protein'|'fat'|'carbs'>[]): { calories: number; protein: number; fat: number; carbs: number }`
  - `listEntries(userId: string, entryDate: string): Promise<FoodEntryRow[]>`
  - `createEntry(input: CreateEntryInput): Promise<FoodEntryRow>`
  - `deleteEntry(userId: string, entryId: string): Promise<boolean>`

- [ ] **Step 1: Failing test for `sumMacros`**

`tests/diary.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { sumMacros } from "@/lib/diary";

describe("sumMacros", () => {
  it("sums calories and macros", () => {
    expect(
      sumMacros([
        { calories: 100, protein: 10, fat: 5, carbs: 8 },
        { calories: 50.5, protein: 1, fat: 2, carbs: 3 },
      ]),
    ).toEqual({ calories: 150.5, protein: 11, fat: 7, carbs: 11 });
  });

  it("returns zeros for empty list", () => {
    expect(sumMacros([])).toEqual({
      calories: 0,
      protein: 0,
      fat: 0,
      carbs: 0,
    });
  });
});
```

- [ ] **Step 2: Run — expect FAIL**

```bash
npm test -- tests/diary.test.ts
```

- [ ] **Step 3: Implement diary lib + routes**

`lib/diary.ts`:

```ts
import { getSupabase } from "./supabase";
import type { EntrySource, FoodEntryRow, MealType } from "./types";

export function sumMacros(
  entries: Pick<FoodEntryRow, "calories" | "protein" | "fat" | "carbs">[],
): { calories: number; protein: number; fat: number; carbs: number } {
  return entries.reduce(
    (acc, e) => ({
      calories: acc.calories + Number(e.calories),
      protein: acc.protein + Number(e.protein),
      fat: acc.fat + Number(e.fat),
      carbs: acc.carbs + Number(e.carbs),
    }),
    { calories: 0, protein: 0, fat: 0, carbs: 0 },
  );
}

export type CreateEntryInput = {
  user_id: string;
  entry_date: string;
  meal_type?: MealType;
  food_name: string;
  calories: number;
  protein?: number;
  fat?: number;
  carbs?: number;
  serving_amount?: number;
  serving_unit?: string;
  source: EntrySource;
  fatsecret_id?: string;
  raw_input?: string;
};

export async function listEntries(
  userId: string,
  entryDate: string,
): Promise<FoodEntryRow[]> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("food_entries")
    .select("*")
    .eq("user_id", userId)
    .eq("entry_date", entryDate)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as FoodEntryRow[];
}

export async function createEntry(
  input: CreateEntryInput,
): Promise<FoodEntryRow> {
  const supabase = getSupabase();
  const { data, error } = await supabase
    .from("food_entries")
    .insert({
      user_id: input.user_id,
      entry_date: input.entry_date,
      meal_type: input.meal_type ?? null,
      food_name: input.food_name,
      calories: input.calories,
      protein: input.protein ?? 0,
      fat: input.fat ?? 0,
      carbs: input.carbs ?? 0,
      serving_amount: input.serving_amount ?? null,
      serving_unit: input.serving_unit ?? null,
      source: input.source,
      fatsecret_id: input.fatsecret_id ?? null,
      raw_input: input.raw_input ?? null,
    })
    .select("*")
    .single();
  if (error || !data) throw new Error(error?.message ?? "create failed");
  return data as FoodEntryRow;
}

export async function deleteEntry(
  userId: string,
  entryId: string,
): Promise<boolean> {
  const supabase = getSupabase();
  const { error, count } = await supabase
    .from("food_entries")
    .delete({ count: "exact" })
    .eq("id", entryId)
    .eq("user_id", userId);
  if (error) throw new Error(error.message);
  return (count ?? 0) > 0;
}
```

`app/api/diary/route.ts`:

```ts
import { NextResponse } from "next/server";
import { AuthError, requireUserFromRequest } from "@/lib/auth-request";
import { createEntry, listEntries, sumMacros } from "@/lib/diary";
import type { EntrySource, MealType } from "@/lib/types";

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const url = new URL(request.url);
    const date =
      url.searchParams.get("date") ?? new Date().toISOString().slice(0, 10);
    const entries = await listEntries(user.id, date);
    return NextResponse.json({
      date,
      entries,
      totals: sumMacros(entries),
      goals: {
        daily_calories: user.daily_calories,
        daily_protein: user.daily_protein,
        daily_fat: user.daily_fat,
        daily_carbs: user.daily_carbs,
      },
    });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    const body = (await request.json()) as {
      entry_date?: string;
      meal_type?: MealType;
      food_name?: string;
      calories?: number;
      protein?: number;
      fat?: number;
      carbs?: number;
      serving_amount?: number;
      serving_unit?: string;
      source?: EntrySource;
      fatsecret_id?: string;
      raw_input?: string;
    };
    if (!body.food_name || body.calories == null || !body.source) {
      return NextResponse.json(
        { error: "food_name, calories, source required" },
        { status: 400 },
      );
    }
    const entry = await createEntry({
      user_id: user.id,
      entry_date: body.entry_date ?? new Date().toISOString().slice(0, 10),
      meal_type: body.meal_type,
      food_name: body.food_name,
      calories: Number(body.calories),
      protein: body.protein,
      fat: body.fat,
      carbs: body.carbs,
      serving_amount: body.serving_amount,
      serving_unit: body.serving_unit,
      source: body.source,
      fatsecret_id: body.fatsecret_id,
      raw_input: body.raw_input,
    });
    return NextResponse.json({ entry }, { status: 201 });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 503 });
  }
}
```

`app/api/diary/[id]/route.ts`:

```ts
import { NextResponse } from "next/server";
import { AuthError, requireUserFromRequest } from "@/lib/auth-request";
import { deleteEntry } from "@/lib/diary";

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const user = await requireUserFromRequest(request);
    const { id } = await context.params;
    const ok = await deleteEntry(user.id, id);
    if (!ok) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json({ error: "Server error" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run unit tests PASS**

```bash
npm test -- tests/diary.test.ts
```

- [ ] **Step 5: Commit**

```bash
git add lib/diary.ts tests/diary.test.ts app/api/diary
git commit -m "feat: diary list/create/delete API"
```

---

### Task 5: Mini App shell + Today UI

**Files:**
- Create: `lib/client-api.ts`, `components/Nav.tsx`, `components/TodayView.tsx`
- Modify: `app/layout.tsx`, `app/page.tsx`, `app/globals.css`

**Interfaces:**
- Consumes: `/api/auth/validate`, `/api/diary`
- Produces: client helpers `getInitData()`, `apiFetch(path, init?)`

- [ ] **Step 1: Client API helper**

`lib/client-api.ts`:

```ts
declare global {
  interface Window {
    Telegram?: {
      WebApp?: {
        initData: string;
        ready: () => void;
        expand: () => void;
        themeParams?: Record<string, string>;
      };
    };
  }
}

export function getInitData(): string {
  if (typeof window === "undefined") return "";
  return window.Telegram?.WebApp?.initData ?? "";
}

export async function apiFetch(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set("x-telegram-init-data", getInitData());
  if (init.body && !headers.has("content-type")) {
    headers.set("content-type", "application/json");
  }
  const res = await fetch(path, { ...init, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error((data as { error?: string }).error ?? res.statusText);
  }
  return data;
}
```

- [ ] **Step 2: TodayView + Nav + page**

`components/Nav.tsx`:

```tsx
type Tab = "today" | "search" | "text" | "settings";

export function Nav({
  tab,
  onChange,
}: {
  tab: Tab;
  onChange: (t: Tab) => void;
}) {
  const items: { id: Tab; label: string }[] = [
    { id: "today", label: "Сегодня" },
    { id: "search", label: "Поиск" },
    { id: "text", label: "Текст" },
    { id: "settings", label: "Цели" },
  ];
  return (
    <nav className="nav">
      {items.map((i) => (
        <button
          key={i.id}
          className={tab === i.id ? "active" : ""}
          type="button"
          onClick={() => onChange(i.id)}
        >
          {i.label}
        </button>
      ))}
    </nav>
  );
}
```

`components/TodayView.tsx`:

```tsx
"use client";

import { useCallback, useEffect, useState } from "react";
import { apiFetch } from "@/lib/client-api";
import type { FoodEntryRow } from "@/lib/types";

type DiaryResponse = {
  date: string;
  entries: FoodEntryRow[];
  totals: { calories: number; protein: number; fat: number; carbs: number };
  goals: {
    daily_calories: number;
    daily_protein: number;
    daily_fat: number;
    daily_carbs: number;
  };
};

export function TodayView({ refreshKey }: { refreshKey: number }) {
  const [data, setData] = useState<DiaryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const json = (await apiFetch("/api/diary")) as DiaryResponse;
      setData(json);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Ошибка загрузки");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  async function remove(id: string) {
    await apiFetch(`/api/diary/${id}`, { method: "DELETE" });
    await load();
  }

  if (loading) return <p>Загрузка…</p>;
  if (error) return <p className="error">{error}</p>;
  if (!data) return null;

  const pct = Math.min(
    100,
    Math.round((data.totals.calories / data.goals.daily_calories) * 100),
  );

  return (
    <section>
      <h2>Сегодня</h2>
      <p>
        {Math.round(data.totals.calories)} / {data.goals.daily_calories} ккал
      </p>
      <div className="bar">
        <div className="bar-fill" style={{ width: `${pct}%` }} />
      </div>
      <p className="macros">
        Б {Math.round(data.totals.protein)} · Ж {Math.round(data.totals.fat)} ·
        У {Math.round(data.totals.carbs)}
      </p>
      <ul className="entries">
        {data.entries.map((e) => (
          <li key={e.id}>
            <div>
              <strong>
                {e.food_name}
                {e.source === "ai_estimate" ? " ≈" : ""}
              </strong>
              <span>{Math.round(Number(e.calories))} ккал</span>
            </div>
            <button type="button" onClick={() => void remove(e.id)}>
              Удалить
            </button>
          </li>
        ))}
      </ul>
      {data.entries.length === 0 && <p>Пока пусто — добавьте еду.</p>}
    </section>
  );
}
```

`app/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { Nav } from "@/components/Nav";
import { TodayView } from "@/components/TodayView";
import { AddSearch } from "@/components/AddSearch";
import { AddText } from "@/components/AddText";
import { SettingsView } from "@/components/SettingsView";
import { apiFetch, getInitData } from "@/lib/client-api";

type Tab = "today" | "search" | "text" | "settings";

export default function Home() {
  const [tab, setTab] = useState<Tab>("today");
  const [refreshKey, setRefreshKey] = useState(0);
  const [authError, setAuthError] = useState<string | null>(null);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
    async function boot() {
      if (!getInitData()) {
        setAuthError(
          "Откройте приложение из Telegram (нет initData в браузере).",
        );
        return;
      }
      try {
        await apiFetch("/api/auth/validate", { method: "POST" });
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : "Auth failed");
      }
    }
    void boot();
  }, []);

  function onSaved() {
    setRefreshKey((k) => k + 1);
    setTab("today");
  }

  return (
    <main className="app">
      <h1>Calorie Tracker</h1>
      {authError && <p className="error">{authError}</p>}
      <Nav tab={tab} onChange={setTab} />
      {tab === "today" && <TodayView refreshKey={refreshKey} />}
      {tab === "search" && <AddSearch onSaved={onSaved} />}
      {tab === "text" && <AddText onSaved={onSaved} />}
      {tab === "settings" && <SettingsView />}
    </main>
  );
}
```

Temporary stubs so build passes until Task 6–8:

`components/AddSearch.tsx`:

```tsx
export function AddSearch({ onSaved }: { onSaved: () => void }) {
  return <p>Search — next task</p>;
}
```

`components/AddText.tsx`:

```tsx
export function AddText({ onSaved }: { onSaved: () => void }) {
  return <p>Text — upcoming</p>;
}
```

`components/SettingsView.tsx`:

```tsx
export function SettingsView() {
  return <p>Settings — upcoming</p>;
}
```

`app/layout.tsx` — include Telegram script:

```tsx
import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "Calorie Tracker",
  description: "Telegram Mini App calorie tracker",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ru">
      <body>
        <Script
          src="https://telegram.org/js/telegram-web-app.js"
          strategy="beforeInteractive"
        />
        {children}
      </body>
    </html>
  );
}
```

`app/globals.css` — minimal readable styles (progress bar, nav, errors); use CSS variables, avoid purple gradient AI cliché — soft dusty blue `#7A8B9E` accents on warm off-white `#F7F5F2`.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: success.

- [ ] **Step 4: Commit**

```bash
git add app components lib/client-api.ts
git commit -m "feat: Mini App shell and Today diary view"
```

---

### Task 6: FatSecret client + search API

**Files:**
- Create: `lib/fatsecret.ts`, `lib/rate-limit.ts`, `tests/fatsecret.test.ts`, `app/api/food/search/route.ts`, `app/api/food/[id]/route.ts`

**Interfaces:**
- Produces:
  - `searchFoods(query: string, opts?: { region?: string }): Promise<FatSecretSearchItem[]>`
  - `getFood(foodId: string): Promise<FatSecretFoodDetail>`
  - `checkRateLimit(key: string, limit: number, windowMs?: number): boolean`

- [ ] **Step 1: Rate limit tests**

`tests/rate-limit.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import { checkRateLimit, _resetRateLimitsForTests } from "@/lib/rate-limit";

describe("checkRateLimit", () => {
  it("allows up to limit then blocks", () => {
    _resetRateLimitsForTests();
    expect(checkRateLimit("u1:search", 2)).toBe(true);
    expect(checkRateLimit("u1:search", 2)).toBe(true);
    expect(checkRateLimit("u1:search", 2)).toBe(false);
  });
});
```

`lib/rate-limit.ts`:

```ts
type Bucket = { count: number; resetAt: number };
const buckets = new Map<string, Bucket>();

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs = 60 * 60 * 1000,
): boolean {
  const now = Date.now();
  const cur = buckets.get(key);
  if (!cur || now >= cur.resetAt) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  if (cur.count >= limit) return false;
  cur.count += 1;
  return true;
}

export function _resetRateLimitsForTests() {
  buckets.clear();
}
```

- [ ] **Step 2: FatSecret lib**

`lib/fatsecret.ts`:

```ts
type TokenCache = { accessToken: string; expiresAt: number };
let tokenCache: TokenCache | null = null;

async function getAccessToken(): Promise<string> {
  if (tokenCache && Date.now() < tokenCache.expiresAt - 60_000) {
    return tokenCache.accessToken;
  }
  const id = process.env.FATSECRET_CLIENT_ID;
  const secret = process.env.FATSECRET_CLIENT_SECRET;
  if (!id || !secret) throw new Error("FatSecret credentials missing");

  const basic = Buffer.from(`${id}:${secret}`).toString("base64");
  const res = await fetch("https://oauth.fatsecret.com/connect/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials&scope=basic",
  });
  if (!res.ok) throw new Error(`FatSecret token error: ${res.status}`);
  const json = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  tokenCache = {
    accessToken: json.access_token,
    expiresAt: Date.now() + json.expires_in * 1000,
  };
  return json.access_token;
}

export type FatSecretSearchItem = {
  food_id: string;
  food_name: string;
  brand_name?: string;
  food_description?: string;
};

export type FatSecretServing = {
  serving_id: string;
  serving_description: string;
  metric_serving_amount?: string;
  metric_serving_unit?: string;
  number_of_units?: string;
  calories: string;
  protein: string;
  fat: string;
  carbohydrate: string;
};

export type FatSecretFoodDetail = {
  food_id: string;
  food_name: string;
  servings: FatSecretServing[];
};

export async function searchFoods(
  query: string,
  opts: { region?: string } = {},
): Promise<FatSecretSearchItem[]> {
  const token = await getAccessToken();
  const region = opts.region ?? "RU";
  const url = new URL("https://platform.fatsecret.com/rest/foods/search/v5");
  url.searchParams.set("search_expression", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("region", region);
  url.searchParams.set("max_results", "20");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`FatSecret search error: ${res.status}`);
  const json = (await res.json()) as {
    foods_search?: {
      results?: { food?: FatSecretSearchItem[] | FatSecretSearchItem };
    };
  };
  const food = json.foods_search?.results?.food;
  if (!food) return [];
  return Array.isArray(food) ? food : [food];
}

export async function getFood(foodId: string): Promise<FatSecretFoodDetail> {
  const token = await getAccessToken();
  const url = new URL("https://platform.fatsecret.com/rest/food/v5");
  url.searchParams.set("food_id", foodId);
  url.searchParams.set("format", "json");

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`FatSecret get error: ${res.status}`);
  const json = (await res.json()) as {
    food: {
      food_id: string;
      food_name: string;
      servings: { serving: FatSecretServing[] | FatSecretServing };
    };
  };
  const serving = json.food.servings.serving;
  return {
    food_id: json.food.food_id,
    food_name: json.food.food_name,
    servings: Array.isArray(serving) ? serving : [serving],
  };
}
```

Note: If FatSecret path/version differs for the account, adjust URL to match [platform docs](https://platform.fatsecret.com/docs) while keeping the same function signatures.

- [ ] **Step 3: API routes with rate limit 60/hour**

`app/api/food/search/route.ts`:

```ts
import { NextResponse } from "next/server";
import { AuthError, requireUserFromRequest } from "@/lib/auth-request";
import { searchFoods } from "@/lib/fatsecret";
import { checkRateLimit } from "@/lib/rate-limit";

export async function GET(request: Request) {
  try {
    const user = await requireUserFromRequest(request);
    if (!checkRateLimit(`${user.telegram_id}:search`, 60)) {
      return NextResponse.json({ error: "Rate limit" }, { status: 429 });
    }
    const q = new URL(request.url).searchParams.get("q")?.trim();
    if (!q) {
      return NextResponse.json({ error: "q required" }, { status: 400 });
    }
    const foods = await searchFoods(q);
    return NextResponse.json({ foods });
  } catch (e) {
    if (e instanceof AuthError) {
      return NextResponse.json({ error: e.message }, { status: 401 });
    }
    console.error(e);
    return NextResponse.json(
      { error: "База продуктов временно недоступна" },
      { status: 502 },
    );
  }
}
```

`app/api/food/[id]/route.ts` — GET via `getFood(id)`, auth + rate limit same key family `search`.

- [ ] **Step 4: Tests PASS + commit**

```bash
npm test -- tests/rate-limit.test.ts
git add lib/fatsecret.ts lib/rate-limit.ts tests app/api/food
git commit -m "feat: FatSecret search proxy with rate limits"
```

---

### Task 7: AddSearch UI

**Files:**
- Modify: `components/AddSearch.tsx`

**Interfaces:**
- Consumes: `GET /api/food/search?q=`, `GET /api/food/:id`, `POST /api/diary`
- Produces: user can search → pick serving → save (`source: fatsecret`)

- [ ] **Step 1: Replace stub with full AddSearch**

Implement client component that:
1. Debounced search input (≥2 chars)
2. Lists `food_name` / brand
3. On select, loads servings
4. On save, POSTs diary entry with chosen serving macros, `source: "fatsecret"`, disables button until done
5. Calls `onSaved()`

Include meal_type select defaulting to `snack`.

- [ ] **Step 2: Manual check checklist (document in commit body)**

- Search «творог» returns items when FatSecret keys set
- Save appears on Today

- [ ] **Step 3: Commit**

```bash
git add components/AddSearch.tsx
git commit -m "feat: FatSecret search and serving picker UI"
```

---

### Task 8: AI parse + FatSecret match

**Files:**
- Create: `lib/openai-parse.ts`, `lib/match-foods.ts`, `tests/openai-parse.test.ts`, `tests/match-foods.test.ts`, `app/api/food/parse/route.ts`

**Interfaces:**
- Produces:
  - `parseMealText(text: string): Promise<ParsedFoodItem[]>`
  - `estimateMacros(item: ParsedFoodItem): Promise<MatchedFoodItem>` (AI fallback)
  - `matchParsedFoods(items: ParsedFoodItem[]): Promise<MatchedFoodItem[]>`

- [ ] **Step 1: Tests for JSON extraction helper**

Add pure helper in `lib/openai-parse.ts`:

```ts
export function extractJsonArray(raw: string): unknown {
  const trimmed = raw.trim();
  const fence = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const text = fence ? fence[1].trim() : trimmed;
  return JSON.parse(text);
}

export function normalizeParsedItems(data: unknown): ParsedFoodItem[] {
  if (!Array.isArray(data)) throw new Error("Expected array");
  return data.map((row) => {
    const r = row as Record<string, unknown>;
    const name = String(r.name ?? "").trim();
    const amount = Number(r.amount);
    const unit = String(r.unit ?? "г").trim() || "г";
    if (!name || !Number.isFinite(amount) || amount <= 0) {
      throw new Error("Invalid item");
    }
    return { name, amount, unit };
  });
}
```

Tests: valid array, fenced markdown, invalid throws.

- [ ] **Step 2: Implement `parseMealText` with OpenAI**

Use `openai` SDK, model `gpt-4o-mini`, temperature 0, system prompt:

```
Ты парсер еды. Верни ТОЛЬКО JSON-массив объектов { "name": string, "amount": number, "unit": string }.
Единицы: г, мл, шт, порция. Язык названий — русский. Без комментариев.
```

On invalid JSON: one retry with "Верни только валидный JSON-массив."

- [ ] **Step 3: `matchParsedFoods`**

For each item: `searchFoods(name)`, take first result, `getFood`, pick default/first serving, scale calories/macros by `amount / metric_serving_amount` when units are grams and metric is g; else use serving as-is and set amount/unit from serving description. If search empty: call `estimateMacros` via short OpenAI prompt returning `{calories, protein, fat, carbs}` and set `source: "ai_estimate"`.

- [ ] **Step 4: POST `/api/food/parse`**

Body: `{ text: string }`. Auth + rate limit 30/hour. Empty text → 400. Return `{ items: MatchedFoodItem[] }`.

- [ ] **Step 5: Tests + commit**

```bash
npm test
git add lib/openai-parse.ts lib/match-foods.ts tests app/api/food/parse
git commit -m "feat: AI meal parse and FatSecret matching"
```

---

### Task 9: AddText UI

**Files:**
- Modify: `components/AddText.tsx`

- [ ] **Step 1: Implement flow**

1. Textarea + button «Разобрать»
2. Show editable preview list (name, amount, calories; remove row)
3. «Сохранить всё» → sequential `POST /api/diary` with `raw_input`, correct `source`, disable while saving
4. Show ≈ for `ai_estimate`
5. `onSaved()`

- [ ] **Step 2: Commit**

```bash
git add components/AddText.tsx
git commit -m "feat: free-text AI meal entry UI"
```

---

### Task 10: Settings API + UI

**Files:**
- Create: `app/api/settings/route.ts`
- Modify: `components/SettingsView.tsx`, use `updateUserGoals` from `lib/users.ts`

- [ ] **Step 1: GET/PATCH settings**

GET returns goals for authenticated user. PATCH accepts positive integers for `daily_calories`, `daily_protein`, `daily_fat`, `daily_carbs` (each optional but at least one required).

- [ ] **Step 2: SettingsView form** bound to those fields, save button.

- [ ] **Step 3: Commit**

```bash
git add app/api/settings components/SettingsView.tsx
git commit -m "feat: daily calorie and macro goals settings"
```

---

### Task 11: Telegram bot webhook

**Files:**
- Create: `app/api/bot/webhook/route.ts`, `lib/bot.ts`

**Interfaces:**
- Produces: handle `/start`, `/today`; ignore other for MVP (optional: reply hint to open Mini App)

- [ ] **Step 1: `lib/bot.ts` helpers**

```ts
export async function tgSendMessage(chatId: number, text: string, replyMarkup?: object) {
  const token = process.env.TELEGRAM_BOT_TOKEN!;
  await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      reply_markup: replyMarkup,
    }),
  });
}
```

- [ ] **Step 2: Webhook route**

- Verify `X-Telegram-Bot-Api-Secret-Token` via `verifyWebhookSecret`
- `/start` → welcome + `web_app` button URL = `TELEGRAM_WEBAPP_URL`
- `/today` → upsert user by `message.from.id`, `listEntries` for today, `sumMacros`, reply text summary
- Always return 200 quickly

- [ ] **Step 3: Commit**

```bash
git add app/api/bot lib/bot.ts
git commit -m "feat: Telegram bot webhook with start and today"
```

---

### Task 12: Favorites (light) + README deploy checklist

**Files:**
- Create: `lib/favorites.ts`, `app/api/favorites/route.ts` (GET list, POST add)
- Modify: `AddSearch.tsx` — «В избранное» optional button after save
- Create: `README.md`

**README must include:**
1. Copy `.env.example` → `.env.local`
2. Run `001_init.sql` in Supabase
3. Create FatSecret app, Telegram bot + Mini App URL, OpenAI key
4. `npm run dev` / deploy to Vercel with same env
5. Set webhook:

```
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<app>/api/bot/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

6. BotFather set WebApp URL to Vercel URL

- [ ] **Step 1: Implement favorites GET/POST scoped to user**

- [ ] **Step 2: Write README**

- [ ] **Step 3: Full verify**

```bash
npm test
npm run build
```

Expected: all tests pass; build succeeds.

- [ ] **Step 4: Commit**

```bash
git add lib/favorites.ts app/api/favorites components/AddSearch.tsx README.md
git commit -m "feat: favorites endpoint and deploy README"
```

---

## Self-Review (plan vs spec)

| Spec requirement | Task |
|---|---|
| Next.js + Vercel + Supabase | 1, 3 |
| initData auth | 2, 3 |
| Diary CRUD + Today | 4, 5 |
| FatSecret search | 6, 7 |
| AI text parse + match | 8, 9 |
| Settings goals | 10 |
| Bot /start + /today | 11 |
| Rate limits | 6, 8 |
| Favorites | 12 |
| food_cache table | 3 (schema); optional use later — YAGNI for write path in MVP |
| Photo / barcode / history | Out of scope (deferred) |
| Deploy HTTPS | 12 README |

**Placeholder scan:** none intentional. FatSecret URL note allows doc-aligned adjustment without changing interfaces.

**Type consistency:** `UserRow`, `FoodEntryRow`, `MealType`, `EntrySource`, `ParsedFoodItem`, `MatchedFoodItem` defined in Task 2 and reused.

---

## Execution Handoff

Plan complete and saved to `docs/superpowers/plans/2026-07-27-telegram-calorie-tracker.md`.

**Two execution options:**

1. **Subagent-Driven (recommended)** — fresh subagent per task, review between tasks, fast iteration  
2. **Inline Execution** — execute tasks in this session with executing-plans and checkpoints  

Which approach?
