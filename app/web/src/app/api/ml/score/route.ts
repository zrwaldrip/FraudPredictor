import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { getDb } from "@/lib/db";
import { runLateDeliveryScoringJob } from "@/lib/scoring";

export const runtime = "nodejs";

/**
 * POST /api/ml/score — runs late-delivery scoring over all shipments and updates
 * `shipments.late_delivery_probability` in shop.db.
 */
export async function POST() {
  try {
    const db = getDb();
    const updated = runLateDeliveryScoringJob(db);
    revalidatePath("/warehouse");
    return NextResponse.json({ ok: true, updated });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Scoring failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
