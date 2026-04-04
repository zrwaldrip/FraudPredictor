/**
 * Offline training: writes `artifacts/fraud_pipeline.json` (committed) for inference-only cron.
 * Run from the `app/` directory: `npm run train:fraud` (requires `DATABASE_URL`).
 *
 * Python notebook artifacts (pickle/joblib on `shop.db`) are not loadable here; this uses the
 * same JS pipeline as production. Migrate data to Postgres before training.
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config as dotenvConfig } from "dotenv";
import { getSql } from "../src/lib/db";
import {
  bundledFraudArtifactPath,
  runFraudPipelineAndWriteback,
} from "../src/lib/fraudNotebookPipeline";

const appRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

process.chdir(appRoot);
dotenvConfig({ path: path.join(appRoot, ".env.local") });
dotenvConfig({ path: path.join(appRoot, ".env") });

// Always run full training from this script, even if .env.local sets inference mode for dev.
delete process.env.FRAUD_PIPELINE_MODE;

async function main(): Promise<void> {
  fs.mkdirSync(path.join(appRoot, "artifacts"), { recursive: true });
  const sql = getSql();
  const artifactPath = bundledFraudArtifactPath();
  const { report, updated, scored_at } = await runFraudPipelineAndWriteback(
    sql,
    artifactPath,
  );
  console.log("Fraud artifact:", report.artifactPath);
  console.log("Orders scored / updated:", updated, "scored_at:", scored_at);
  await sql.end({ timeout: 5 });
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
