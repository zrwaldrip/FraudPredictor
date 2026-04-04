import { NextResponse } from "next/server";
import { getSql } from "@/lib/db";
import {
  fraudPipelineArtifactPath,
  runFraudPipelineAndWriteback,
} from "@/lib/fraudNotebookPipeline";

export const runtime = "nodejs";
/** Pro plan allows up to 300s; reduce if your Vercel tier caps lower. */
export const maxDuration = 300;

function isAuthorized(request: Request): boolean {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return true;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) {
    const token = auth.slice(7).trim();
    if (token === secret) return true;
  }
  const cronHeader = request.headers.get("x-cron-secret");
  return cronHeader === secret;
}

/**
 * GET — Vercel Cron invokes this method (vercel-cron/1.0).
 * POST — manual triggers (curl, etc.).
 * Runs the JS fraud notebook pipeline and writes scores to `orders`.
 * With `FRAUD_PIPELINE_MODE=inference`, loads the bundled artifact only (no full train).
 * Full-train artifact path: `/tmp` on Vercel, else `app/artifacts/fraud_pipeline.json` locally.
 */
async function runFraudTrain(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
    }
    const sql = getSql();
    const artifactPath = fraudPipelineArtifactPath();
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

export async function GET(request: Request) {
  return runFraudTrain(request);
}

export async function POST(request: Request) {
  return runFraudTrain(request);
}
