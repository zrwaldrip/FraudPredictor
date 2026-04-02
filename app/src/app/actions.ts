"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/lib/db";
import { runFraudPipelineAndWriteback } from "@/lib/fraudNotebookPipeline";
import { runLateDeliveryScoringJob } from "@/lib/scoring";

const COOKIE = "acting_customer_id";

export async function selectCustomer(formData: FormData) {
  const raw = formData.get("customer_id");
  const id = typeof raw === "string" ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(id) || id < 1) {
    redirect("/?error=invalid");
  }
  const db = getDb();
  const row = db
    .prepare(`SELECT customer_id FROM customers WHERE customer_id = ?`)
    .get(id) as { customer_id: number } | undefined;
  if (!row) redirect("/?error=notfound");

  const jar = await cookies();
  jar.set(COOKIE, String(id), {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 90,
  });
  redirect("/dashboard");
}

export async function clearCustomer() {
  const jar = await cookies();
  jar.delete(COOKIE);
  redirect("/");
}

export type LineInput = {
  product_id: number;
  quantity: number;
  unit_price: number;
};

export async function placeOrder(input: {
  billing_zip: string | null;
  shipping_zip: string | null;
  shipping_state: string | null;
  payment_method: string;
  device_type: string;
  ip_country: string;
  promo_used: boolean;
  promo_code: string | null;
  shipping_fee: number;
  tax_amount: number;
  items: LineInput[];
}) {
  const jar = await cookies();
  const raw = jar.get(COOKIE)?.value;
  const customer_id = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(customer_id) || customer_id < 1) {
    return { error: "No customer selected." };
  }
  if (!input.items.length) return { error: "Add at least one line item." };

  const db = getDb();
  const subtotal = input.items.reduce(
    (s, it) => s + it.quantity * it.unit_price,
    0,
  );
  const order_subtotal = Math.round(subtotal * 100) / 100;
  const shipping_fee = Math.round(input.shipping_fee * 100) / 100;
  const tax_amount = Math.round(input.tax_amount * 100) / 100;
  const order_total =
    Math.round((order_subtotal + shipping_fee + tax_amount) * 100) / 100;

  const order_datetime = new Date()
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);

  const tx = db.transaction(() => {
    const info = db
      .prepare(
        `INSERT INTO orders (
          customer_id, order_datetime, billing_zip, shipping_zip, shipping_state,
          payment_method, device_type, ip_country, promo_used, promo_code,
          order_subtotal, shipping_fee, tax_amount, order_total, risk_score, is_fraud
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 0)`,
      )
      .run(
        customer_id,
        order_datetime,
        input.billing_zip,
        input.shipping_zip,
        input.shipping_state,
        input.payment_method,
        input.device_type,
        input.ip_country,
        input.promo_used ? 1 : 0,
        input.promo_used ? input.promo_code : null,
        order_subtotal,
        shipping_fee,
        tax_amount,
        order_total,
      );
    const order_id = Number(info.lastInsertRowid);

    const insItem = db.prepare(
      `INSERT INTO order_items (order_id, product_id, quantity, unit_price, line_total)
       VALUES (?, ?, ?, ?, ?)`,
    );
    for (const it of input.items) {
      const line_total =
        Math.round(it.quantity * it.unit_price * 100) / 100;
      insItem.run(order_id, it.product_id, it.quantity, it.unit_price, line_total);
    }

    db.prepare(
      `INSERT INTO shipments (
        order_id, ship_datetime, carrier, shipping_method, distance_band,
        promised_days, actual_days, late_delivery, late_delivery_probability
      ) VALUES (?, ?, 'UPS', 'standard', 'regional', 5, 0, 0, NULL)`,
    ).run(order_id, order_datetime);
  });

  try {
    tx();
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Failed to place order.";
    return { error: msg };
  }

  revalidatePath("/dashboard");
  revalidatePath("/orders");
  revalidatePath("/warehouse");
  redirect("/orders");
}

export async function runScoring() {
  const db = getDb();
  const n = runLateDeliveryScoringJob(db);
  revalidatePath("/warehouse");
  return { ok: true as const, updated: n };
}

export async function setPipelineFraudStatus(formData: FormData) {
  const rawOrderId = formData.get("order_id");
  const rawPrediction = formData.get("prediction");
  const orderId =
    typeof rawOrderId === "string" ? Number.parseInt(rawOrderId, 10) : NaN;
  const prediction =
    typeof rawPrediction === "string"
      ? Number.parseInt(rawPrediction, 10)
      : NaN;

  if (!Number.isFinite(orderId) || orderId < 1) {
    return;
  }
  if (prediction !== 0 && prediction !== 1) {
    return;
  }

  const db = getDb();
  const now = new Date().toISOString().replace("T", " ").slice(0, 19);
  db.prepare(
    `UPDATE orders
     SET fraud_prediction = ?, fraud_scored_at = ?
     WHERE order_id = ?`,
  ).run(prediction, now, orderId);

  revalidatePath("/admin/orders");
}

export async function runFraudPipelineNow() {
  const db = getDb();
  runFraudPipelineAndWriteback(db);
  revalidatePath("/admin/orders");
}
