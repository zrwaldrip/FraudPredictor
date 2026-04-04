import path from "path";
import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import {
  runFraudPipelineAndWriteback,
} from "@/lib/fraudNotebookPipeline";

export const runtime = "nodejs";

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true;
  const header = request.headers.get("x-cron-secret");
  return header === secret;
}

/**
 * POST /api/cron/fraud-train
 * Runs the JavaScript port of the Chapter17 fraud notebook and writes
 * artifacts to app/artifacts/fraud_pipeline.json.
 */
export async function POST(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const sql = getSql();
    const artifactPath = path.join(process.cwd(), "artifacts", "fraud_pipeline.json");
    const { report, updated, scored_at } = await runFraudPipelineAndWriteback(
      sql,
      artifactPath,
    );

    return NextResponse.json({
      ok: true,
      report,
      writeback: { updated, scored_at },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Fraud training failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

