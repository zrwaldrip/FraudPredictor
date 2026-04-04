import { getSql } from "@/lib/db";

export type CustomerListItem = {
  customer_id: number;
  full_name: string;
  email: string;
  city: string | null;
  state: string | null;
};

export async function listCustomers(): Promise<CustomerListItem[]> {
  const sql = getSql();
  const rows = (await sql`SELECT customer_id, full_name, email, city, state
    FROM customers
    WHERE is_active = 1
    ORDER BY full_name
    LIMIT 500`) as CustomerListItem[];
  return rows.map((r) => ({
    ...r,
    customer_id: Number(r.customer_id),
  }));
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

export async function getDashboardSummary(
  customerId: number,
): Promise<DashboardSummary | null> {
  const sql = getSql();
  const [customer] = await sql`SELECT customer_id, full_name, email FROM customers WHERE customer_id = ${customerId}`;
  if (!customer) return null;

  const [agg] = await sql`SELECT COUNT(*)::int AS order_count, COALESCE(SUM(order_total), 0)::float8 AS total_spent,
           MAX(order_datetime)::text AS last_order_at
     FROM orders WHERE customer_id = ${customerId}`;

  return {
    customer: {
      customer_id: Number(customer.customer_id),
      full_name: customer.full_name,
      email: customer.email,
    },
    order_count: Number(agg?.order_count ?? 0),
    total_spent: Number(agg?.total_spent ?? 0),
    last_order_at: agg?.last_order_at ?? null,
  };
}

export type OrderHistoryRow = {
  order_id: number;
  order_datetime: string;
  order_total: number;
  is_fraud: number;
  shipment_late: number | null;
};

export async function listOrdersForCustomer(
  customerId: number,
): Promise<OrderHistoryRow[]> {
  const sql = getSql();
  const rows = await sql`SELECT o.order_id, o.order_datetime, o.order_total, o.is_fraud,
           s.late_delivery AS shipment_late
    FROM orders o
    LEFT JOIN shipments s ON s.order_id = o.order_id
    WHERE o.customer_id = ${customerId}
    ORDER BY o.order_datetime DESC`;
  return rows.map((r) => ({
    order_id: Number(r.order_id),
    order_datetime: r.order_datetime,
    order_total: Number(r.order_total),
    is_fraud: Number(r.is_fraud),
    shipment_late:
      r.shipment_late === null || r.shipment_late === undefined
        ? null
        : Number(r.shipment_late),
  }));
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

export async function getLateDeliveryQueueTop50(): Promise<WarehouseRow[]> {
  const sql = getSql();
  const rows = await sql`SELECT s.shipment_id, s.order_id, s.late_delivery_probability, s.promised_days, s.actual_days,
           s.late_delivery, o.order_datetime, o.order_total, o.customer_id, c.full_name,
           s.carrier, s.shipping_method
    FROM shipments s
    JOIN orders o ON o.order_id = s.order_id
    JOIN customers c ON c.customer_id = o.customer_id
    ORDER BY COALESCE(s.late_delivery_probability, 0) DESC
    LIMIT 50`;
  return rows.map((r) => ({
    shipment_id: Number(r.shipment_id),
    order_id: Number(r.order_id),
    late_delivery_probability:
      r.late_delivery_probability === null || r.late_delivery_probability === undefined
        ? null
        : Number(r.late_delivery_probability),
    promised_days: Number(r.promised_days),
    actual_days: Number(r.actual_days),
    late_delivery: Number(r.late_delivery),
    order_datetime: String(r.order_datetime),
    order_total: Number(r.order_total),
    customer_id: Number(r.customer_id),
    full_name: String(r.full_name),
    carrier: String(r.carrier),
    shipping_method: String(r.shipping_method),
  }));
}

export type ProductRow = {
  product_id: number;
  sku: string;
  product_name: string;
  price: number;
};

export async function listActiveProducts(): Promise<ProductRow[]> {
  const sql = getSql();
  const rows = await sql`SELECT product_id, sku, product_name, price FROM products WHERE is_active = 1 ORDER BY product_name LIMIT 500`;
  return rows.map((r) => ({
    product_id: Number(r.product_id),
    sku: r.sku,
    product_name: r.product_name,
    price: Number(r.price),
  }));
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

export async function listAllOrdersForAdmin(
  limit = 1000,
): Promise<AdminOrderRow[]> {
  const sql = getSql();
  const rows = await sql`SELECT o.order_id, o.order_datetime, o.customer_id, c.full_name AS customer_name,
           o.order_total, o.risk_score, o.is_fraud,
           o.fraud_prediction, o.fraud_probability, o.fraud_scored_at
    FROM orders o
    JOIN customers c ON c.customer_id = o.customer_id
    ORDER BY o.order_datetime DESC
    LIMIT ${limit}`;
  return rows.map((r) => ({
    order_id: Number(r.order_id),
    order_datetime: String(r.order_datetime),
    customer_id: Number(r.customer_id),
    customer_name: String(r.customer_name),
    order_total: Number(r.order_total),
    risk_score: Number(r.risk_score),
    is_fraud: Number(r.is_fraud),
    fraud_prediction:
      r.fraud_prediction === null || r.fraud_prediction === undefined
        ? null
        : Number(r.fraud_prediction),
    fraud_probability:
      r.fraud_probability === null || r.fraud_probability === undefined
        ? null
        : Number(r.fraud_probability),
    fraud_scored_at:
      r.fraud_scored_at === null || r.fraud_scored_at === undefined
        ? null
        : String(r.fraud_scored_at),
  }));
}
