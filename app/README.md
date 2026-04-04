# IS455 — Web app (Next.js)

Operational database: **Supabase Postgres** (connected via `DATABASE_URL`).

## Local development

```bash
npm install
npm run dev
```

Create `app/.env.local` with your Supabase connection string (see below). Ensure the `public` schema has the expected tables (`customers`, `orders`, `order_items`, `shipments`, `products`) and columns used by the app.

## Environment

| Variable         | Meaning |
|------------------|---------|
| `DATABASE_URL`   | **Required.** Postgres URI from Supabase → **Project Settings → Database**. For Vercel/serverless, use the **Transaction pooler** (port **6543**) URI when available; include SSL (e.g. `?sslmode=require`) if not already in the string. |

The app uses the [`postgres`](https://github.com/porsager/postgres) client with `prepare: false` for PgBouncer compatibility.

## Vercel deployment

1. Create a Vercel project and set **Root Directory** to **`app`**.
2. Add **`DATABASE_URL`** in the project environment variables (same value as local production DB).

## Course features (Part 1)

| Route | Feature |
|-------|---------|
| `/` | Select customer (no login) |
| `/dashboard` | Customer dashboard (order summaries) |
| `/orders/new` | Place new order → writes `orders`, `order_items`, `shipments` |
| `/orders` | Order history for selected customer |
| `/warehouse` | Late delivery priority queue (top 50 by `late_delivery_probability`) |
| `POST /api/ml/score` | Runs warehouse scoring; updates `shipments.late_delivery_probability` |
| `POST /api/cron/fraud-train` | Runs full JS fraud training pipeline; writes `artifacts/fraud_pipeline.json` |

Schema changes (e.g. `late_delivery_probability`, fraud columns on `orders`) should be applied in Supabase via SQL migrations, not at app startup.

## Cron pipeline

`app/vercel.json` schedules `POST /api/cron/fraud-train` daily at 03:00 UTC.

Set `CRON_SECRET` in Vercel and send it as `x-cron-secret` when manually invoking the route.
