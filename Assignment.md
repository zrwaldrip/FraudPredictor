# Chapter 17 Assignment — Deploying ML Pipelines

## Overview

Two deliverables:

1. **Part 1** — A deployed web app backed by `shop.db`
2. **Part 2** — A JavaScript CRISP-DM fraud pipeline (ported from the notebook) running via Vercel Cron

---

## Part 1: Web App (Vercel Deployment)

### Tech Stack

Choose one:

- **Next.js** (recommended for full-stack JS)
- **FastAPI** (recommended for Python-heavy teams)
- **ASP.NET** (recommended for .NET shops)

Use **Cursor** (or another AI coding tool) to scaffold following prompts in Sections 17.8–17.9.

### Database

- Operational DB: `shop.db` (SQLite)
- All reads/writes go through this database

### Required Pages & Features


| Page                             | Description                                                                        |
| -------------------------------- | ---------------------------------------------------------------------------------- |
| **Select Customer**              | Landing screen — no login/signup required; user picks a customer to act as         |
| **Customer Dashboard**           | Shows order summaries for the selected customer                                    |
| **Place New Order**              | Form to create a new order; persists to `shop.db`                                  |
| **Order History**                | Lists all past orders for the selected customer                                    |
| **Late Delivery Priority Queue** | Warehouse page showing top 50 orders ranked by predicted late-delivery probability |
| **Run Scoring Button**           | Triggers the ML inference job and refreshes the priority queue in place            |


### Deployment

- Deploy to **Vercel** (or equivalent platform)
- Submit the **live URL**

---

## Part 2: CRISP-DM JavaScript Pipeline — Predicting `is_fraud`

### Target

- **Table:** `orders` in `shop.db`
- **Column:** `is_fraud` (binary classification)

### Pipeline Structure (follow CRISP-DM phases)

#### 1. Business Understanding

- Define the fraud-detection problem
- State success criteria (e.g., target precision/recall, business cost of false negatives vs. false positives)

#### 2. Data Understanding *(Ch. 6, 8)*

- Load data from `shop.db` via SQLite
- Feature-level exploration (distributions, nulls, dtypes)
- Relationship discovery (correlations, fraud rate by feature segment)

#### 3. Data Preparation *(Ch. 2–4, 7)*

- Wrangle and clean raw data
- Build **automated preparation pipelines** (sklearn `Pipeline` / `ColumnTransformer`)
- Feature engineering (derived columns, encodings, scaling)

#### 4. Modeling *(Ch. 13, 14)*

- Train classification models (logistic regression, decision tree, etc.)
- Apply **ensemble methods** (random forest, gradient boosting, or similar)

#### 5. Evaluation *(Ch. 15, 16)*

- Evaluate models (accuracy, precision, recall, F1, ROC-AUC)
- Select and tune the best model (cross-validation, hyperparameter search)
- Perform **feature selection** and document impact on performance

#### 6. Deployment *(Ch. 17)*

- **Serialize** the trained model (e.g., `joblib.dump` or `pickle`)
- Demonstrate how the serialized model loads and scores new records
- Show integration point with the Part 1 pipeline ("Run Scoring" button flow)

### Deliverable

- Upload completed JavaScript fraud pipeline module(s)

---

## File & Folder Conventions (suggested)

```text
project-root/
├── app/                  # Web app (Next.js / FastAPI / ASP.NET)
│   ├── pages/ or routes/
│   └── ...
├── artifacts/            # JS model + metadata artifacts written by cron
├── Chapter17_Fraud_Pipeline_Heitor.ipynb  # Source notebook used for JS conversion
├── shop.db               # SQLite operational database
└── README.md
```

---

## Submission Checklist

- Live deployed URL (Part 1)
- All 6 pages/features working in the deployed app
- "Run Scoring" button triggers inference and refreshes queue
- JS fraud pipeline committed under `app/src/lib/` (Part 2)
- Pipeline covers all 6 CRISP-DM phases
- Model serialized and integration demonstrated in cron route

---

## AI Agent Context

> **This section is for the AI coding agent, not the student grader. Keep it accurate and up-to-date as the architecture evolves.**

### Deployment Architecture

| Layer | Service | Notes |
|-------|---------|-------|
| Web app | **Vercel** | Next.js App Router, Root Directory = `app/` |
| Database | **Supabase** | Managed Postgres; replaces the local `shop.db` SQLite file |
| ML pipeline | **Vercel Cron Job** | JS port of notebook logic; runs on a schedule inside the Next.js app |

There is **no separate backend service**. All server-side logic (data access, auth cookies, ML scoring) lives in the Next.js app under `app/` and runs on Vercel serverless/edge functions and Cron Jobs.

---

### Repository Layout

```text
project-root/
├── app/                        # Next.js app — deploy root for Vercel
│   ├── src/
│   │   ├── app/                # App Router pages & API routes
│   │   │   ├── page.tsx              # Select Customer (landing)
│   │   │   ├── dashboard/page.tsx    # Customer Dashboard
│   │   │   ├── orders/page.tsx       # Order History
│   │   │   ├── orders/new/page.tsx   # Place New Order
│   │   │   ├── warehouse/page.tsx    # Late Delivery Queue
│   │   │   ├── api/ml/score/route.ts       # POST /api/ml/score (Run Scoring)
│   │   │   └── api/cron/fraud-train/route.ts # POST /api/cron/fraud-train (cron training)
│   │   ├── components/         # Shared UI (Nav, PlaceOrderForm, RunScoringButton)
│   │   └── lib/                # DB client, queries, scoring logic, session helpers
│   ├── next.config.ts
│   ├── package.json
│   └── README.md
├── artifacts/
│   └── fraud_pipeline.json     # Serialized JS model + metadata
├── Chapter17_Fraud_Pipeline_Heitor.ipynb  # Source notebook used for JS conversion
└── README.md
```

---

### Database: Supabase (Postgres)

**Current state:** The app still uses `better-sqlite3` against a local `shop.db` file. This must be migrated to Supabase before deployment.

**Migration plan:**
1. Replace `src/lib/db.ts` with a Supabase/Postgres client (use `postgres` npm package or `@supabase/supabase-js` — pick one and stay consistent).
2. Remove `better-sqlite3` and the `serverExternalPackages` entry in `next.config.ts`.
3. Replace all SQLite-style `db.prepare(...)` calls in `src/lib/queries.ts` and `src/app/actions.ts` with parameterised Postgres queries.
4. Recreate the `shop.db` schema in Supabase (tables: `customers`, `orders`, `order_items`, `shipments`, `products`).
5. The `late_delivery_probability` column migration in `db.ts` becomes a one-time SQL migration in the Supabase dashboard.
6. `shop.db` at the repo root is still used by the app and as the source dataset for JS pipeline parity checks.

**Required environment variables (set in Vercel dashboard):**

| Variable | Where to get it |
|----------|----------------|
| `SUPABASE_URL` | Supabase project → Settings → API → Project URL |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase project → Settings → API → `service_role` key (**never expose to the browser**) |

> Use the `service_role` key server-side only (server components, server actions, API routes). Never pass it to client components.

---

### ML Pipeline: Vercel Cron Job

**Source of truth (fraud pipeline):** `app/src/lib/fraudNotebookPipeline.ts` — JavaScript port of `Chapter17_Fraud_Pipeline_Heitor.ipynb`.

**Source of truth (warehouse queue):** `app/src/lib/scoring.ts` — late-delivery queue scoring used by `/warehouse`.

**How scoring now works (two pipelines):**
1. **Warehouse button path:** `RunScoringButton` calls `POST /api/ml/score`, which runs `runLateDeliveryScoringJob(db)` and refreshes `/warehouse`.
2. **Fraud cron path:** Vercel Cron calls `POST /api/cron/fraud-train`, which runs the full CRISP-DM JS training pipeline and writes `app/artifacts/fraud_pipeline.json`.

**Adding a scheduled Cron Job (Vercel):**
- `app/vercel.json` should include cron entry for `/api/cron/fraud-train`.
- Example `vercel.json`:
  ```json
  {
    "crons": [
      { "path": "/api/cron/fraud-train", "schedule": "0 3 * * *" }
    ]
  }
  ```
- Protect the route with a `CRON_SECRET` env var check so only Vercel can invoke it.

---

### Next.js App Router Conventions

- The Next.js version in this project **has breaking changes from older versions**. Always read `node_modules/next/dist/docs/` before writing new API patterns.
- All pages are **server components** by default (`async` functions, no `"use client"`).
- Interactive components (forms, buttons that call server actions) are **client components** (`"use client"` at the top).
- DB access and environment variables only ever appear in **server components, server actions (`"use server"`), or Route Handlers** — never in client components.
- Session: acting customer ID stored in an **httpOnly cookie** (`acting_customer_id`). Read via `src/lib/session.ts → getActingCustomerId()`.
- Server actions live in `src/app/actions.ts`. Always add `"use server"` at the top.
- Route invalidation after mutations uses `revalidatePath(...)` from `next/cache`.

---

### Required Pages Checklist (must all work in production)

| Route | Page | Required feature |
|-------|------|-----------------|
| `/` | Select Customer | Dropdown of active customers from DB; sets session cookie |
| `/dashboard` | Customer Dashboard | Order count, total spent, last order date from DB |
| `/orders/new` | Place New Order | Form → inserts `orders`, `order_items`, `shipments` rows |
| `/orders` | Order History | Paginated list of past orders for the session customer |
| `/warehouse` | Late Delivery Queue | Top 50 shipments by `late_delivery_probability` DESC |
| `POST /api/ml/score` | Run Scoring (warehouse) | Scores shipments, updates `late_delivery_probability`, refreshes warehouse page |
| `POST /api/cron/fraud-train` | Fraud Training Cron | Runs full JS CRISP-DM pipeline and writes serialized model artifact |

---

### What NOT to Do

- Do **not** import `better-sqlite3` or reference `shop.db` file path in any `app/src/` file after the Supabase migration.
- Do **not** add a separate Express, FastAPI, or other backend process. Everything server-side runs in Next.js on Vercel.
- Do **not** expose `SUPABASE_SERVICE_ROLE_KEY` to client components or `"use client"` files.
- Do **not** create a Vite or React SPA frontend — the UI is built with Next.js App Router pages.
- Do **not** remove `Chapter17_Fraud_Pipeline_Heitor.ipynb`; it is the source notebook used for JS parity checks.
- Do **not** use `export type { ... }` from `"use server"` files — Turbopack will error. Export types from `lib/` modules instead.




