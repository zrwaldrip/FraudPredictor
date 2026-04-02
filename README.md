# FraudPredictor (IS 455)

Layout per **Assignment.md**:

```text
project-root/
├── app/              # Next.js web app (Part 1)
├── ml/               # Part 2 notebook + model artifact
├── shop.db           # SQLite operational database
└── README.md
```

## Part 1 — Web app (Next.js)

Operational database: **`shop.db`** at the **repository root**. From `app/`, the default path is `../shop.db` (or set `DATABASE_PATH`).

```bash
cd app
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

| Route | Feature |
|-------|---------|
| `/` | Select customer |
| `/dashboard` | Customer dashboard |
| `/orders/new` | Place new order |
| `/orders` | Order history |
| `/warehouse` | Late delivery queue + **Run scoring** |
| `POST /api/ml/score` | ML scoring job (used by the Run scoring button) |

### Deploy (e.g. Vercel)

Set the project **Root Directory** to **`app`**. See `app/README.md` for `DATABASE_PATH` and SQLite caveats on serverless.

## Part 2 — Notebook

See `ml/notebook.ipynb` and `Assignment.md`.

## Leftover `app/frontend` folder

If a `node_modules` file is still locked from an old Vite dev server, stop that process and delete the `app/frontend` folder manually. It is removed from version control.
