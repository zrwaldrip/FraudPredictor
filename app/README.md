# IS455 — Web app (Next.js)

Operational database: **Supabase Postgres** (connected via `DATABASE_URL`).

## Local development

```bash
npm install
npm run dev
```

Create `app/.env.local` with your Supabase connection string (see below). Ensure the `public` schema has the expected tables (`customers`, `orders`, `order_items`, `shipments`, `products`) and columns used by the app.

## Environment

| Variable | Meaning |
|----------|---------|
| `DATABASE_URL` | **Required.** Postgres URI from Supabase → **Project Settings → Database**. For Vercel/serverless, use the **Transaction pooler** (port **6543**) URI when available; include SSL (e.g. `?sslmode=require`) if not already in the string. |
| `FRAUD_PIPELINE_MODE` | Set to **`inference`** on Vercel to skip full training on cron: load committed [`artifacts/fraud_pipeline.json`](artifacts/fraud_pipeline.json) and score orders only (avoids long serverless timeouts). Omit or use any other value for **full** train (e.g. local `npm run train:fraud`). |
| `FRAUD_ARTIFACT_PATH` | Optional. Override path to the fraud JSON artifact (relative to app root or absolute). Defaults to `artifacts/fraud_pipeline.json`. |

The app uses the [`postgres`](https://github.com/porsager/postgres) client with `prepare: false` for PgBouncer compatibility.

### Fraud model artifact

The deployed app loads a `ml-random-forest` JSON artifact for scoring. The **Python notebook** (`Chapter17_Fraud_Pipeline_Heitor.ipynb`) selects the best model using `shop.db`, then a Python export script converts it to the JS-compatible format.

**Workflow to generate / refresh the artifact:**

1. **Run the notebook** on `shop.db` (Jupyter or `nbconvert`). It compares logistic regression, random forest, and gradient boosting, tunes the best RF, and saves `artifacts/fraud_pipeline.joblib` + `artifacts/fraud_pipeline_metadata.joblib`.
2. **Export to JS format** from the repo root: `python scripts/export_to_js_artifact.py` — reads the joblib files and writes `app/artifacts/fraud_pipeline.json`.
3. **Commit** `app/artifacts/fraud_pipeline.json` so Vercel bundles it.
4. Set **`FRAUD_PIPELINE_MODE=inference`** on Vercel so cron only scores (no training).

**Alternative (JS-only, needs Postgres data):** `npm run train:fraud` from `app/` trains the JS pipeline directly against `DATABASE_URL` and writes the same JSON artifact.

## Vercel deployment

1. Create a Vercel project and set **Root Directory** to **`app`**.
2. Add **`DATABASE_URL`** and, for fast cron, **`FRAUD_PIPELINE_MODE=inference`** after committing [`artifacts/fraud_pipeline.json`](artifacts/fraud_pipeline.json).

## Course features (Part 1)

| Route | Feature |
|-------|---------|
| `/` | Select customer (no login) |
| `/dashboard` | Customer dashboard (order summaries) |
| `/orders/new` | Place new order → writes `orders`, `order_items`, `shipments` |
| `/orders` | Order history for selected customer |
| `/warehouse` | Late delivery priority queue (top 50 by `late_delivery_probability`) |
| `POST /api/ml/score` | Runs warehouse scoring; updates `shipments.late_delivery_probability` |
| `GET` / `POST` `/api/cron/fraud-train` | **Full train:** JS CRISP-DM pipeline (slow; uses `/tmp` on Vercel for the artifact). **`FRAUD_PIPELINE_MODE=inference`:** load bundled `artifacts/fraud_pipeline.json` and score orders only. |

Schema changes (e.g. `late_delivery_probability`, fraud columns on `orders`) should be applied in Supabase via SQL migrations, not at app startup.

## Cron pipeline

`app/vercel.json` schedules **`/api/cron/fraud-train`** daily at **03:00 UTC**. Vercel Cron invokes that URL with **`GET`** (not POST).

Set **`CRON_SECRET`** in Vercel: scheduled runs receive **`Authorization: Bearer <CRON_SECRET>`**. Manual triggers can use the same header or **`x-cron-secret: <CRON_SECRET>`**.

The route sets **`maxDuration = 300`** (seconds). Full training often needs Pro and may still hit the cap; **inference mode** usually completes in seconds.

Example manual GET:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" "https://<your-deployment>/api/cron/fraud-train"
```
