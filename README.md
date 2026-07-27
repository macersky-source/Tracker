# Calorie Tracker (Telegram Mini App)

Personal AI calorie tracker: FatSecret search + free-text AI parsing, diary in Supabase, hosted on Vercel.

## Stack

- Next.js (App Router) Mini App + API
- Supabase Postgres
- FatSecret Platform API
- Gemini (`gemini-2.0-flash`) for meal text parsing
- Telegram Bot webhook

## Setup

1. Copy env file:

```bash
cp .env.example .env.local
```

2. Fill variables:

| Variable | Where |
|---|---|
| `TELEGRAM_BOT_TOKEN` | [@BotFather](https://t.me/BotFather) `/newbot` |
| `TELEGRAM_WEBAPP_URL` | Your Vercel URL (or local HTTPS tunnel) |
| `TELEGRAM_WEBHOOK_SECRET` | Random string you choose |
| `SUPABASE_URL` / `SUPABASE_SERVICE_KEY` | Supabase project settings |
| `FATSECRET_CLIENT_ID` / `FATSECRET_CLIENT_SECRET` | [platform.fatsecret.com](https://platform.fatsecret.com) |
| `GEMINI_API_KEY` | Google AI Studio / Gemini API |

3. Run SQL migration in Supabase SQL Editor:

`supabase/migrations/001_init.sql`

4. Install and run locally:

```bash
npm install
npm run dev
```

5. For Telegram Mini App locally you need HTTPS (ngrok / Cloudflare Tunnel) pointed at `localhost:3000`.

## Deploy (Vercel)

1. Push repo and import in Vercel.
2. Add the same env vars in Vercel project settings.
3. Deploy, then set BotFather Mini App URL to `https://<your-app>.vercel.app`.
4. Set webhook:

```text
https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<your-app>.vercel.app/api/bot/webhook&secret_token=<TELEGRAM_WEBHOOK_SECRET>
```

## Scripts

```bash
npm run dev
npm test
npm run build
```

## Bot commands

- `/start` — welcome + open Mini App
- `/today` — today’s calorie summary

## Docs

- Design: `docs/superpowers/specs/2026-07-27-telegram-calorie-tracker-design.md`
- Plan: `docs/superpowers/plans/2026-07-27-telegram-calorie-tracker.md`
