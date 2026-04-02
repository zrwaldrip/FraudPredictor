import type Database from "better-sqlite3";

type ShipmentRow = {
  shipment_id: number;
  promised_days: number;
  actual_days: number;
  distance_band: string;
  shipping_method: string;
  late_delivery: number;
};

/**
 * Mock late-delivery probability (0–1) for classroom / demo.
 * Replace with your pipeline or ONNX model behind an API later.
 */
function predictLateDeliveryProbability(r: ShipmentRow): number {
  let logit = -1.1;
  if (r.distance_band === "national") logit += 0.85;
  else if (r.distance_band === "regional") logit += 0.35;
  if (r.shipping_method === "standard") logit += 0.45;
  if (r.shipping_method === "expedited") logit += 0.1;
  if (r.shipping_method === "overnight") logit -= 0.55;
  if (r.promised_days <= 2) logit += 0.35;
  const overdue = Math.max(0, r.actual_days - r.promised_days);
  logit += overdue * 0.12;
  if (r.late_delivery === 1) logit += 0.55;
  const p = 1 / (1 + Math.exp(-logit));
  const jitter = (Math.random() - 0.5) * 0.06;
  return Math.min(0.999, Math.max(0.001, p + jitter));
}

export function runLateDeliveryScoringJob(database: Database.Database): number {
  const rows = database
    .prepare(
      `SELECT shipment_id, promised_days, actual_days, distance_band, shipping_method, late_delivery
       FROM shipments`,
    )
    .all() as ShipmentRow[];

  const update = database.prepare(
    `UPDATE shipments SET late_delivery_probability = ? WHERE shipment_id = ?`,
  );

  const tx = database.transaction(() => {
    for (const r of rows) {
      const p = predictLateDeliveryProbability(r);
      update.run(p, r.shipment_id);
    }
  });
  tx();
  return rows.length;
}
