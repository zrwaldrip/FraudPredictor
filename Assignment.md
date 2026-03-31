# Chapter 17 Assignment — Deploying ML Pipelines

## Overview

Two deliverables:

1. **Part 1** — A deployed web app backed by `shop.db`
2. **Part 2** — A CRISP-DM Jupyter notebook predicting `is_fraud`

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

## Part 2: CRISP-DM Jupyter Notebook — Predicting `is_fraud`

### Target

- **Table:** `orders` in `shop.db`
- **Column:** `is_fraud` (binary classification)

### Notebook Structure (follow CRISP-DM phases)

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

- Upload completed `.ipynb` notebook file

---

## File & Folder Conventions (suggested)

```
project-root/
├── app/                  # Web app (Next.js / FastAPI / ASP.NET)
│   ├── pages/ or routes/
│   └── ...
├── ml/
│   ├── notebook.ipynb    # Part 2 CRISP-DM notebook
│   └── model.pkl         # Serialized model artifact
├── shop.db               # SQLite operational database
└── README.md
```

---

## Submission Checklist

- Live deployed URL (Part 1)
- All 6 pages/features working in the deployed app
- "Run Scoring" button triggers inference and refreshes queue
- `.ipynb` notebook uploaded (Part 2)
- Notebook covers all 6 CRISP-DM phases
- Model serialized and integration demonstrated in notebook

