# FraudPredictor (IS 455)

Layout per `Assignment.md`:

```text
project-root/
├── app/              # Next.js web app (Part 1 + cron pipeline)
├── artifacts/        # Generated fraud model artifacts (runtime output)
├── Chapter17_Fraud_Pipeline_Heitor.ipynb  # Source notebook converted to JS
├── shop.db           # SQLite operational database
└── README.md
```

## Part 1 — Web app (Next.js)

Operational database: `shop.db` at the repository root. From `app/`, the default DB path is `../shop.db` (or set `DATABASE_PATH`).

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
| `/warehouse` | Late delivery queue + Run Scoring button |
| `POST /api/ml/score` | Warehouse queue scoring job |
| `POST /api/cron/fraud-train` | Full JS fraud training pipeline (cron route) |

## Part 2 — JavaScript CRISP-DM pipeline

The notebook has been ported to JavaScript in:

- `app/src/lib/fraudNotebookPipeline.ts`
- Cron route: `app/src/app/api/cron/fraud-train/route.ts`
- Vercel schedule: `app/vercel.json`

Generated model artifact:

- `app/artifacts/fraud_pipeline.json`

Reference source notebook (kept for parity checks):

- `Chapter17_Fraud_Pipeline_Heitor.ipynb`

