# IS455 — Web app (Next.js)

Operational database: **`shop.db`** (SQLite) at the **repository root** (`../shop.db` when you run commands from this `app/` directory).

## Local development

```bash
npm install
npm run dev
```

Ensure `../shop.db` exists (parent of this folder is the repo root).

## Environment

| Variable         | Meaning |
|------------------|---------|
| `DATABASE_PATH`  | Optional absolute path to `shop.db`. If unset, defaults to `../shop.db` relative to the process cwd (this `app/` folder). |

## Vercel deployment

1. Create a Vercel project and set **Root Directory** to **`app`**.
2. Add environment variable `DATABASE_PATH` if your hosted `shop.db` lives somewhere other than the default relative path.
3. **SQLite on serverless**: Vercel’s default serverless filesystem is not a durable writable database volume. For production you may need **persistent storage** (e.g. mounted volume on another host), **Turso/libSQL**, or another managed SQLite-compatible service.

## Course features (Part 1)

| Route | Feature |
|-------|---------|
| `/` | Select customer (no login) |
| `/dashboard` | Customer dashboard (order summaries) |
| `/orders/new` | Place new order → writes `orders`, `order_items`, `shipments` |
| `/orders` | Order history for selected customer |
| `/warehouse` | Late delivery priority queue (top 50 by `late_delivery_probability`) |
| `POST /api/ml/score` | Runs scoring job; updates `shipments.late_delivery_probability` |

The first time you open the app, the migration adds `late_delivery_probability` to `shipments` if it is missing.
