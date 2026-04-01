# Fraud Classification Frontend (React + Vite)

Frontend-only SPA for creating purchases and (as an admin) reviewing purchases and overriding fraud labels. The data model mirrors your current SQLite schema (`orders` + `order_items`) and is structured so we can later swap the mock repository to **Supabase** and/or a **pipeline API**.

## Run locally

```bash
cd frontend
npm install
npm run dev
```

## Routes

- `/purchase/new`: Create a purchase (adds an `orders` row + `order_items` rows in the mock store)
- `/admin/purchases`: Admin-only purchases table + fraud override
- `/login`: Frontend-only admin login

## Admin login (frontend-only)

- Email: `admin@example.com`
- Password: `admin`

## Data layer (today vs later)

### Today (mock)
- Seed snapshot: `src/services/seedData.ts`
- Persistence: browser storage in `src/services/mockPurchaseRepository.ts`

### Later (Supabase / API)
- Replace the repository implementation created in `src/services/RepositoryContext.tsx`
- Keep the UI unchanged because pages use the `PurchaseRepository` interface in `src/services/purchaseRepository.ts`

## SQLite mapping

- Purchases: `orders`
- Line items: `order_items`
- Labels: `orders.risk_score` and `orders.is_fraud`
