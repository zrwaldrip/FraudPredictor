import { getDb } from "@/lib/db";

export type CustomerListItem = {
  customer_id: number;
  full_name: string;
  email: string;
  city: string | null;
  state: string | null;
};

export function listCustomers(): CustomerListItem[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT customer_id, full_name, email, city, state
       FROM customers
       WHERE is_active = 1
       ORDER BY full_name
       LIMIT 500`,
    )
    .all() as CustomerListItem[];
}

export type DashboardSummary = {
  customer: {
    customer_id: number;
    full_name: string;
    email: string;
  };
  order_count: number;
  total_spent: number;
  last_order_at: string | null;
};

export function getDashboardSummary(customerId: number): DashboardSummary | null {
  const db = getDb();
  const customer = db
    .prepare(
      `SELECT customer_id, full_name, email FROM customers WHERE customer_id = ?`,
    )
    .get(customerId) as
    | { customer_id: number; full_name: string; email: string }
    | undefined;
  if (!customer) return null;

  const agg = db
    .prepare(
      `SELECT COUNT(*) AS order_count, COALESCE(SUM(order_total), 0) AS total_spent,
              MAX(order_datetime) AS last_order_at
       FROM orders WHERE customer_id = ?`,
    )
    .get(customerId) as {
    order_count: number;
    total_spent: number;
    last_order_at: string | null;
  };

  return {
    customer,
    order_count: agg.order_count,
    total_spent: agg.total_spent,
    last_order_at: agg.last_order_at,
  };
}

export type OrderHistoryRow = {
  order_id: number;
  order_datetime: string;
  order_total: number;
  is_fraud: number;
  shipment_late: number | null;
};

export function listOrdersForCustomer(customerId: number): OrderHistoryRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT o.order_id, o.order_datetime, o.order_total, o.is_fraud,
              s.late_delivery AS shipment_late
       FROM orders o
       LEFT JOIN shipments s ON s.order_id = o.order_id
       WHERE o.customer_id = ?
       ORDER BY o.order_datetime DESC`,
    )
    .all(customerId) as OrderHistoryRow[];
}

export type WarehouseRow = {
  shipment_id: number;
  order_id: number;
  late_delivery_probability: number | null;
  promised_days: number;
  actual_days: number;
  late_delivery: number;
  order_datetime: string;
  order_total: number;
  customer_id: number;
  full_name: string;
  carrier: string;
  shipping_method: string;
};

export function getLateDeliveryQueueTop50(): WarehouseRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT s.shipment_id, s.order_id, s.late_delivery_probability, s.promised_days, s.actual_days,
              s.late_delivery, o.order_datetime, o.order_total, o.customer_id, c.full_name,
              s.carrier, s.shipping_method
       FROM shipments s
       JOIN orders o ON o.order_id = s.order_id
       JOIN customers c ON c.customer_id = o.customer_id
       ORDER BY COALESCE(s.late_delivery_probability, 0) DESC
       LIMIT 50`,
    )
    .all() as WarehouseRow[];
}

export type ProductRow = {
  product_id: number;
  sku: string;
  product_name: string;
  price: number;
};

export function listActiveProducts(): ProductRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT product_id, sku, product_name, price FROM products WHERE is_active = 1 ORDER BY product_name LIMIT 500`,
    )
    .all() as ProductRow[];
}

export type AdminOrderRow = {
  order_id: number;
  order_datetime: string;
  customer_id: number;
  customer_name: string;
  order_total: number;
  risk_score: number;
  is_fraud: number;
  fraud_prediction: number | null;
  fraud_probability: number | null;
  fraud_scored_at: string | null;
};

export function listAllOrdersForAdmin(limit = 1000): AdminOrderRow[] {
  const db = getDb();
  return db
    .prepare(
      `SELECT o.order_id, o.order_datetime, o.customer_id, c.full_name AS customer_name,
              o.order_total, o.risk_score, o.is_fraud,
              o.fraud_prediction, o.fraud_probability, o.fraud_scored_at
       FROM orders o
       JOIN customers c ON c.customer_id = o.customer_id
       ORDER BY o.order_datetime DESC
       LIMIT ?`,
    )
    .all(limit) as AdminOrderRow[];
}
