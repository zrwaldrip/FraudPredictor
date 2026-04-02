import fs from "fs";
import path from "path";
import type Database from "better-sqlite3";
import { RandomForestClassifier } from "ml-random-forest";

type Row = Record<string, unknown>;

type TrainedPreprocessor = {
  featureColumns: string[];
  droppedColumns: string[];
  numericCols: string[];
  categoricalCols: string[];
  numericMedians: Record<string, number>;
  numericMeans: Record<string, number>;
  numericStd: Record<string, number>;
  categoricalModes: Record<string, string>;
  oneHotValues: Record<string, string[]>;
  encodedFeatureNames: string[];
};

type PipelineArtifact = {
  generatedAt: string;
  modelType: "random_forest";
  modelJson: unknown;
  preprocessor: TrainedPreprocessor;
  selectedFeatureNames: string[];
  selectedFeatureIndices: number[];
  optimalThreshold: number;
  metrics: Record<string, number>;
  notebookParityNotes: string[];
};

type NotebookParityReport = {
  tableNames: string[];
  rowCounts: Array<{ table: string; row_count: number }>;
  modelShape: { rows: number; cols: number };
  droppedColumns: string[];
  initialModelMetrics: Array<Record<string, number | string>>;
  tunedModelMetrics: Record<string, number>;
  optimalThreshold: number;
  topFeatureImportances: Array<{ feature: string; importance: number }>;
  artifactPath: string;
};

function isFiniteNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function toNumber(v: unknown): number | null {
  if (isFiniteNumber(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function quantile(sorted: number[], q: number): number {
  if (!sorted.length) return 0;
  const idx = (sorted.length - 1) * q;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  if (lo === hi) return sorted[lo] ?? 0;
  const h = idx - lo;
  return (sorted[lo] ?? 0) * (1 - h) + (sorted[hi] ?? 0) * h;
}

function median(values: number[]): number {
  if (!values.length) return 0;
  const s = [...values].sort((a, b) => a - b);
  return quantile(s, 0.5);
}

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

function std(values: number[], avg: number): number {
  if (!values.length) return 1;
  const v = values.reduce((acc, x) => acc + (x - avg) ** 2, 0) / values.length;
  return Math.sqrt(v) || 1;
}

function sigmoid(x: number): number {
  return 1 / (1 + Math.exp(-x));
}

function trainLogisticRegression(
  X: number[][],
  y: number[],
  options?: { iterations?: number; learningRate?: number; l2?: number },
): { weights: number[]; bias: number } {
  const iterations = options?.iterations ?? 1200;
  const learningRate = options?.learningRate ?? 0.03;
  const l2 = options?.l2 ?? 1e-4;
  const nFeatures = X[0]?.length ?? 0;
  const weights = new Array<number>(nFeatures).fill(0);
  let bias = 0;
  const n = X.length || 1;

  for (let step = 0; step < iterations; step += 1) {
    const gradW = new Array<number>(nFeatures).fill(0);
    let gradB = 0;
    for (let i = 0; i < X.length; i += 1) {
      const row = X[i] ?? [];
      let z = bias;
      for (let j = 0; j < nFeatures; j += 1) z += (row[j] ?? 0) * (weights[j] ?? 0);
      const p = sigmoid(z);
      const err = p - (y[i] ?? 0);
      for (let j = 0; j < nFeatures; j += 1) gradW[j] += err * (row[j] ?? 0);
      gradB += err;
    }
    for (let j = 0; j < nFeatures; j += 1) {
      const reg = l2 * (weights[j] ?? 0);
      weights[j] -= learningRate * ((gradW[j] / n) + reg);
    }
    bias -= learningRate * (gradB / n);
  }

  return { weights, bias };
}

function predictLogisticProba(model: { weights: number[]; bias: number }, X: number[][]): number[] {
  const nFeatures = model.weights.length;
  return X.map((row) => {
    let z = model.bias;
    for (let j = 0; j < nFeatures; j += 1) z += (row[j] ?? 0) * (model.weights[j] ?? 0);
    return sigmoid(z);
  });
}

function trainGradientBoostingStumps(
  X: number[][],
  y: number[],
  options?: { nEstimators?: number; learningRate?: number },
): {
  baseLogit: number;
  stumps: Array<{ feature: number; threshold: number; left: number; right: number }>;
} {
  const nEstimators = options?.nEstimators ?? 80;
  const learningRate = options?.learningRate ?? 0.08;
  const n = X.length;
  const d = X[0]?.length ?? 0;
  const yMean = Math.max(1e-6, Math.min(1 - 1e-6, mean(y)));
  const baseLogit = Math.log(yMean / (1 - yMean));
  const scores = new Array<number>(n).fill(baseLogit);
  const stumps: Array<{ feature: number; threshold: number; left: number; right: number }> = [];

  for (let m = 0; m < nEstimators; m += 1) {
    const p = scores.map((s) => sigmoid(s));
    const residual = y.map((yy, i) => yy - (p[i] ?? 0));

    let best: { feature: number; threshold: number; left: number; right: number; loss: number } | null = null;
    for (let j = 0; j < d; j += 1) {
      const col = X.map((r) => r[j] ?? 0);
      const sorted = [...col].sort((a, b) => a - b);
      const thresholds = [0.2, 0.4, 0.6, 0.8].map((q) => quantile(sorted, q));
      for (const threshold of thresholds) {
        let lCount = 0;
        let rCount = 0;
        let lSum = 0;
        let rSum = 0;
        for (let i = 0; i < n; i += 1) {
          if ((col[i] ?? 0) <= threshold) {
            lCount += 1;
            lSum += residual[i] ?? 0;
          } else {
            rCount += 1;
            rSum += residual[i] ?? 0;
          }
        }
        if (lCount === 0 || rCount === 0) continue;
        const left = lSum / lCount;
        const right = rSum / rCount;
        let loss = 0;
        for (let i = 0; i < n; i += 1) {
          const pred = (col[i] ?? 0) <= threshold ? left : right;
          const err = (residual[i] ?? 0) - pred;
          loss += err * err;
        }
        if (!best || loss < best.loss) best = { feature: j, threshold, left, right, loss };
      }
    }
    if (!best) break;
    stumps.push({
      feature: best.feature,
      threshold: best.threshold,
      left: best.left * learningRate,
      right: best.right * learningRate,
    });
    for (let i = 0; i < n; i += 1) {
      const xv = X[i]?.[best.feature] ?? 0;
      scores[i] += xv <= best.threshold ? best.left * learningRate : best.right * learningRate;
    }
  }

  return { baseLogit, stumps };
}

function predictGradientBoostingStumpsProba(
  model: {
    baseLogit: number;
    stumps: Array<{ feature: number; threshold: number; left: number; right: number }>;
  },
  X: number[][],
): number[] {
  return X.map((row) => {
    let score = model.baseLogit;
    for (const stump of model.stumps) {
      const xv = row[stump.feature] ?? 0;
      score += xv <= stump.threshold ? stump.left : stump.right;
    }
    return sigmoid(score);
  });
}

function accuracy(y: number[], pred: number[]): number {
  if (!y.length) return 0;
  let ok = 0;
  for (let i = 0; i < y.length; i += 1) if ((y[i] ?? 0) === (pred[i] ?? 0)) ok += 1;
  return ok / y.length;
}

function precision(y: number[], pred: number[]): number {
  let tp = 0;
  let fp = 0;
  for (let i = 0; i < y.length; i += 1) {
    if ((pred[i] ?? 0) === 1) {
      if ((y[i] ?? 0) === 1) tp += 1;
      else fp += 1;
    }
  }
  return tp + fp === 0 ? 0 : tp / (tp + fp);
}

function recall(y: number[], pred: number[]): number {
  let tp = 0;
  let fn = 0;
  for (let i = 0; i < y.length; i += 1) {
    if ((y[i] ?? 0) === 1) {
      if ((pred[i] ?? 0) === 1) tp += 1;
      else fn += 1;
    }
  }
  return tp + fn === 0 ? 0 : tp / (tp + fn);
}

function f1(y: number[], pred: number[]): number {
  const p = precision(y, pred);
  const r = recall(y, pred);
  return p + r === 0 ? 0 : (2 * p * r) / (p + r);
}

function confusionMatrix(y: number[], pred: number[]): [[number, number], [number, number]] {
  let tn = 0;
  let fp = 0;
  let fn = 0;
  let tp = 0;
  for (let i = 0; i < y.length; i += 1) {
    const yy = y[i] ?? 0;
    const pp = pred[i] ?? 0;
    if (yy === 1 && pp === 1) tp += 1;
    else if (yy === 1 && pp === 0) fn += 1;
    else if (yy === 0 && pp === 1) fp += 1;
    else tn += 1;
  }
  return [[tn, fp], [fn, tp]];
}

function rocAuc(y: number[], prob: number[]): number {
  const pairs = y.map((yy, i) => ({ y: yy, p: prob[i] ?? 0 })).sort((a, b) => b.p - a.p);
  const positives = y.filter((v) => v === 1).length;
  const negatives = y.length - positives;
  if (positives === 0 || negatives === 0) return 0.5;
  let tp = 0;
  let fp = 0;
  let prevTPR = 0;
  let prevFPR = 0;
  let prevP = Number.POSITIVE_INFINITY;
  let auc = 0;
  for (const pair of pairs) {
    if (pair.p !== prevP) {
      const tpr = tp / positives;
      const fpr = fp / negatives;
      auc += (fpr - prevFPR) * (tpr + prevTPR) * 0.5;
      prevTPR = tpr;
      prevFPR = fpr;
      prevP = pair.p;
    }
    if (pair.y === 1) tp += 1;
    else fp += 1;
  }
  const tpr = tp / positives;
  const fpr = fp / negatives;
  auc += (fpr - prevFPR) * (tpr + prevTPR) * 0.5;
  return auc;
}

function precisionRecallThresholdSweep(y: number[], prob: number[]): {
  bestThreshold: number;
  bestPrecision: number;
  bestRecall: number;
  bestF1: number;
} {
  const thresholds = [...new Set(prob)].sort((a, b) => a - b);
  if (!thresholds.length) {
    return { bestThreshold: 0.5, bestPrecision: 0, bestRecall: 0, bestF1: 0 };
  }
  let best = { bestThreshold: 0.5, bestPrecision: 0, bestRecall: 0, bestF1: -1 };
  for (const t of thresholds) {
    const pred = prob.map((p) => (p >= t ? 1 : 0));
    const p = precision(y, pred);
    const r = recall(y, pred);
    const f = p + r === 0 ? 0 : (2 * p * r) / (p + r);
    if (f > best.bestF1) best = { bestThreshold: t, bestPrecision: p, bestRecall: r, bestF1: f };
  }
  return best;
}

function shuffleInPlace<T>(arr: T[], seed = 42): T[] {
  let s = seed >>> 0;
  const rnd = () => {
    s = (1664525 * s + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rnd() * (i + 1));
    const tmp = arr[i];
    arr[i] = arr[j] as T;
    arr[j] = tmp as T;
  }
  return arr;
}

function stratifiedSplit(rows: Row[], y: number[], testRatio = 0.2): {
  trainRows: Row[];
  testRows: Row[];
  yTrain: number[];
  yTest: number[];
} {
  const pos: number[] = [];
  const neg: number[] = [];
  for (let i = 0; i < y.length; i += 1) (y[i] === 1 ? pos : neg).push(i);
  shuffleInPlace(pos);
  shuffleInPlace(neg, 1337);
  const nPosTest = Math.floor(pos.length * testRatio);
  const nNegTest = Math.floor(neg.length * testRatio);
  const testSet = new Set<number>([...pos.slice(0, nPosTest), ...neg.slice(0, nNegTest)]);
  const trainRows: Row[] = [];
  const testRows: Row[] = [];
  const yTrain: number[] = [];
  const yTest: number[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    if (testSet.has(i)) {
      testRows.push(rows[i] ?? {});
      yTest.push(y[i] ?? 0);
    } else {
      trainRows.push(rows[i] ?? {});
      yTrain.push(y[i] ?? 0);
    }
  }
  return { trainRows, testRows, yTrain, yTest };
}

function computeMissingCounts(rows: Row[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      if (v === null || v === undefined || v === "") counts[k] = (counts[k] ?? 0) + 1;
    }
  }
  return counts;
}

function parseDateMaybe(v: unknown): Date | null {
  if (v instanceof Date && !Number.isNaN(v.getTime())) return v;
  if (typeof v !== "string") return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

function engineerDateFeatures(rows: Row[]): Row[] {
  const dateLikeCols = new Set<string>();
  for (const row of rows) {
    for (const [k, v] of Object.entries(row)) {
      const low = k.toLowerCase();
      if (
        low.includes("date") ||
        low.includes("time") ||
        low.includes("timestamp") ||
        low.includes("_at")
      ) {
        const d = parseDateMaybe(v);
        if (d) dateLikeCols.add(k);
      }
    }
  }

  return rows.map((row) => {
    const out: Row = { ...row };
    for (const col of dateLikeCols) {
      const d = parseDateMaybe(row[col]);
      if (!d) continue;
      out[`${col}_year`] = d.getUTCFullYear();
      out[`${col}_month`] = d.getUTCMonth() + 1;
      out[`${col}_day`] = d.getUTCDate();
      out[`${col}_dayofweek`] = d.getUTCDay();
      out[`${col}_hour`] = d.getUTCHours();
      delete out[col];
    }
    return out;
  });
}

function classifyColumns(rows: Row[]): { numeric: string[]; categorical: string[] } {
  const cols = new Set<string>();
  for (const row of rows) for (const c of Object.keys(row)) cols.add(c);
  const numeric: string[] = [];
  const categorical: string[] = [];
  for (const c of cols) {
    let numCount = 0;
    let nonNull = 0;
    for (const row of rows) {
      const v = row[c];
      if (v === null || v === undefined || v === "") continue;
      nonNull += 1;
      if (toNumber(v) !== null) numCount += 1;
    }
    if (nonNull > 0 && numCount / nonNull > 0.9) numeric.push(c);
    else categorical.push(c);
  }
  return { numeric, categorical };
}

function fitPreprocessor(trainRows: Row[], droppedColumns: string[], featureColumns: string[]): TrainedPreprocessor {
  const { numeric, categorical } = classifyColumns(trainRows);
  const numericCols = numeric.filter((c) => featureColumns.includes(c));
  const categoricalCols = categorical.filter((c) => featureColumns.includes(c));

  const numericMedians: Record<string, number> = {};
  const numericMeans: Record<string, number> = {};
  const numericStd: Record<string, number> = {};
  for (const c of numericCols) {
    const vals = trainRows.map((r) => toNumber(r[c])).filter((v): v is number => v !== null);
    const med = median(vals);
    const m = mean(vals.length ? vals : [med]);
    numericMedians[c] = med;
    numericMeans[c] = m;
    numericStd[c] = std(vals.length ? vals : [m], m);
  }

  const categoricalModes: Record<string, string> = {};
  const oneHotValues: Record<string, string[]> = {};
  for (const c of categoricalCols) {
    const freq = new Map<string, number>();
    for (const row of trainRows) {
      const val = row[c] === null || row[c] === undefined || row[c] === "" ? "__MISSING__" : String(row[c]);
      freq.set(val, (freq.get(val) ?? 0) + 1);
    }
    const sorted = [...freq.entries()].sort((a, b) => b[1] - a[1]);
    categoricalModes[c] = sorted[0]?.[0] ?? "__MISSING__";
    oneHotValues[c] = sorted.map(([v]) => v);
  }

  const encodedFeatureNames: string[] = [];
  for (const c of numericCols) encodedFeatureNames.push(`num__${c}`);
  for (const c of categoricalCols) {
    for (const v of oneHotValues[c] ?? []) encodedFeatureNames.push(`cat__${c}__${v}`);
  }

  return {
    featureColumns,
    droppedColumns,
    numericCols,
    categoricalCols,
    numericMedians,
    numericMeans,
    numericStd,
    categoricalModes,
    oneHotValues,
    encodedFeatureNames,
  };
}

function transformRows(rows: Row[], pre: TrainedPreprocessor): number[][] {
  const matrix: number[][] = [];
  for (const row of rows) {
    const out: number[] = [];
    for (const c of pre.numericCols) {
      const raw = toNumber(row[c]);
      const imputed = raw === null ? (pre.numericMedians[c] ?? 0) : raw;
      const scaled = (imputed - (pre.numericMeans[c] ?? 0)) / (pre.numericStd[c] ?? 1);
      out.push(scaled);
    }
    for (const c of pre.categoricalCols) {
      const mode = pre.categoricalModes[c] ?? "__MISSING__";
      const val = row[c] === null || row[c] === undefined || row[c] === "" ? mode : String(row[c]);
      const vocab = pre.oneHotValues[c] ?? [];
      for (const candidate of vocab) out.push(candidate === val ? 1 : 0);
    }
    matrix.push(out);
  }
  return matrix;
}

function pickFeatureColumns(rows: Row[]): { featureColumns: string[]; dropped: string[] } {
  if (!rows.length) return { featureColumns: [], dropped: [] };
  const allCols = new Set<string>();
  for (const row of rows) for (const c of Object.keys(row)) allCols.add(c);
  const idLike = [...allCols].filter((c) => c.toLowerCase() === "id" || c.toLowerCase().endsWith("_id"));
  const leakageKeywords = ["fraud_score", "predicted", "probability", "score"];
  const leakage = [...allCols].filter(
    (c) => c !== "is_fraud" && leakageKeywords.some((k) => c.toLowerCase().includes(k)),
  );
  const dropped = [...new Set([...idLike, ...leakage])].filter((c) => c !== "is_fraud");
  const featureColumns = [...allCols].filter((c) => c !== "is_fraud" && !dropped.includes(c));
  return { featureColumns, dropped };
}

function applyFeatureSelection(
  XTrain: number[][],
  XTest: number[][],
  encodedNames: string[],
  yTrain: number[],
): { selectedTrain: number[][]; selectedTest: number[][]; indices: number[]; names: string[] } {
  const logit = trainLogisticRegression(XTrain, yTrain, { iterations: 1000, learningRate: 0.02, l2: 1e-4 });
  const absW = logit.weights.map((w) => Math.abs(w));
  const cutoff = median(absW);
  let indices = absW.map((w, i) => ({ w, i })).filter((x) => x.w >= cutoff).map((x) => x.i);
  if (indices.length < 5) {
    indices = absW
      .map((w, i) => ({ w, i }))
      .sort((a, b) => b.w - a.w)
      .slice(0, Math.min(10, absW.length))
      .map((x) => x.i);
  }
  const selectedTrain = XTrain.map((r) => indices.map((i) => r[i] ?? 0));
  const selectedTest = XTest.map((r) => indices.map((i) => r[i] ?? 0));
  const names = indices.map((i) => encodedNames[i] ?? `f_${i}`);
  return { selectedTrain, selectedTest, indices, names };
}

function kFoldIndices(n: number, k = 3): number[][] {
  const idx = Array.from({ length: n }, (_, i) => i);
  shuffleInPlace(idx, 2026);
  const folds: number[][] = Array.from({ length: k }, () => []);
  idx.forEach((v, i) => folds[i % k]?.push(v));
  return folds;
}

function fitAndScoreRandomForest(
  XTrain: number[][],
  yTrain: number[],
  XTest: number[][],
  yTest: number[],
  options: { nEstimators: number; maxDepth?: number; minNumSamples?: number },
): { rf: RandomForestClassifier; prob: number[]; pred: number[]; metrics: Record<string, number> } {
  const rf = new RandomForestClassifier({
    seed: 42,
    replacement: true,
    maxFeatures: Math.max(1, Math.floor(Math.sqrt(XTrain[0]?.length || 1))),
    nEstimators: options.nEstimators,
    treeOptions: {
      maxDepth: options.maxDepth,
      minNumSamples: options.minNumSamples ?? 2,
      gainFunction: "gini",
    },
  });
  rf.train(XTrain, yTrain);
  const prob = rf.predictProbability(XTest, 1);
  const pred = prob.map((p) => (p >= 0.5 ? 1 : 0));
  const metrics = {
    accuracy: accuracy(yTest, pred),
    precision: precision(yTest, pred),
    recall: recall(yTest, pred),
    f1: f1(yTest, pred),
    roc_auc: rocAuc(yTest, prob),
  };
  return { rf, prob, pred, metrics };
}

function evaluateModel(yTrue: number[], prob: number[]): Record<string, number> {
  const pred = prob.map((p) => (p >= 0.5 ? 1 : 0));
  return {
    accuracy: accuracy(yTrue, pred),
    precision: precision(yTrue, pred),
    recall: recall(yTrue, pred),
    f1: f1(yTrue, pred),
    roc_auc: rocAuc(yTrue, prob),
  };
}

function joinRelationalTables(database: Database.Database, orders: Row[]): Row[] {
  const tableRows = database
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all() as Array<{ name: string }>;
  const tableNames = tableRows.map((r) => r.name);
  const model = orders.map((o) => ({ ...o }));
  const modelCols = () => new Set<string>(Object.keys(model[0] ?? {}));

  for (const table of tableNames.filter((t) => t !== "orders")) {
    const cols = (
      database.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>
    ).map((c) => c.name);
    const shared = cols.filter((c) => modelCols().has(c) && c !== "is_fraud");
    const preferred = shared.filter(
      (c) =>
        c.endsWith("_id") ||
        c === "customer_id" ||
        c === "product_id" ||
        c === "payment_id" ||
        c === "shipment_id" ||
        c === "address_id",
    );
    if (preferred.length !== 1) continue;
    const key = preferred[0] as string;
    const uniqueCheck = database
      .prepare(`SELECT COUNT(*) AS n_rows, COUNT(DISTINCT ${key}) AS n_distinct FROM ${table}`)
      .get() as { n_rows: number; n_distinct: number };
    if (uniqueCheck.n_rows !== uniqueCheck.n_distinct) continue;

    const right = database.prepare(`SELECT * FROM ${table}`).all() as Row[];
    const byKey = new Map<string, Row>();
    for (const r of right) byKey.set(String(r[key]), r);

    for (const row of model) {
      const r = byKey.get(String(row[key]));
      if (!r) continue;
      for (const [col, value] of Object.entries(r)) {
        if (col === key) continue;
        if (col in row) row[`${table}__${col}`] = value;
        else row[col] = value;
      }
    }
  }
  return model;
}

function savePipelineArtifacts(artifactPath: string, artifact: PipelineArtifact): void {
  const dir = path.dirname(artifactPath);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(artifactPath, JSON.stringify(artifact, null, 2), "utf8");
}

export function runFraudNotebookPipeline(
  database: Database.Database,
  options?: { artifactPath?: string },
): NotebookParityReport {
  const artifactPath =
    options?.artifactPath ?? path.join(process.cwd(), "artifacts", "fraud_pipeline.json");

  // 2. Data Understanding
  const tableRows = database
    .prepare(`SELECT name FROM sqlite_master WHERE type='table' ORDER BY name`)
    .all() as Array<{ name: string }>;
  const tableNames = tableRows.map((r) => r.name);
  const rowCounts = tableNames.map((table) => {
    const row = database.prepare(`SELECT COUNT(*) AS row_count FROM ${table}`).get() as {
      row_count: number;
    };
    return { table, row_count: row.row_count };
  });
  const orders = database.prepare(`SELECT * FROM orders`).all() as Row[];
  if (!orders.length) throw new Error("orders table is empty; cannot train fraud pipeline");
  if (!("is_fraud" in orders[0])) throw new Error("orders table missing is_fraud column");
  const missingByCol = computeMissingCounts(orders);
  void missingByCol; // retained for parity/reporting use if needed later

  // 2. Analytic base table via safe single-key joins.
  const modelRowsRaw = joinRelationalTables(database, orders);
  const modelRows = engineerDateFeatures(modelRowsRaw);

  // 3. Data preparation
  const { featureColumns, dropped } = pickFeatureColumns(modelRows);
  const target = modelRows.map((r) => Number(toNumber(r.is_fraud) ?? 0));
  const features = modelRows.map((r) => {
    const out: Row = {};
    for (const col of featureColumns) out[col] = r[col];
    return out;
  });
  const split = stratifiedSplit(features, target, 0.2);
  const pre = fitPreprocessor(split.trainRows, dropped, featureColumns);
  const XTrain = transformRows(split.trainRows, pre);
  const XTest = transformRows(split.testRows, pre);
  const yTrain = split.yTrain;
  const yTest = split.yTest;

  // 4. Modeling: logistic, random forest, gradient boosting (stumps).
  const logit = trainLogisticRegression(XTrain, yTrain);
  const logitProb = predictLogisticProba(logit, XTest);
  const rfInitial = fitAndScoreRandomForest(XTrain, yTrain, XTest, yTest, {
    nEstimators: 300,
    maxDepth: undefined,
    minNumSamples: 2,
  });
  const gb = trainGradientBoostingStumps(XTrain, yTrain);
  const gbProb = predictGradientBoostingStumpsProba(gb, XTest);

  const initialResults: Array<Record<string, number | string>> = [
    { model: "logistic_regression", ...evaluateModel(yTest, logitProb) },
    { model: "random_forest", ...rfInitial.metrics },
    { model: "gradient_boosting", ...evaluateModel(yTest, gbProb) },
  ];
  initialResults.sort((a, b) => {
    const roc = (Number(b.roc_auc) || 0) - (Number(a.roc_auc) || 0);
    if (roc !== 0) return roc;
    return (Number(b.f1) || 0) - (Number(a.f1) || 0);
  });

  // 5. Evaluation/tuning: feature selection + grid search RF + threshold tuning.
  const selected = applyFeatureSelection(XTrain, XTest, pre.encodedFeatureNames, yTrain);
  const grid = {
    nEstimators: [200, 300],
    maxDepth: [undefined, 8, 16],
    minNumSamples: [2, 10],
  };
  let bestCfg: { nEstimators: number; maxDepth?: number; minNumSamples: number } | null = null;
  let bestCvAuc = -Infinity;
  const folds = kFoldIndices(selected.selectedTrain.length, 3);
  for (const nEstimators of grid.nEstimators) {
    for (const maxDepth of grid.maxDepth) {
      for (const minNumSamples of grid.minNumSamples) {
        const aucs: number[] = [];
        for (let f = 0; f < folds.length; f += 1) {
          const validIdx = new Set(folds[f] ?? []);
          const XTr: number[][] = [];
          const yTr: number[] = [];
          const XVa: number[][] = [];
          const yVa: number[] = [];
          for (let i = 0; i < selected.selectedTrain.length; i += 1) {
            if (validIdx.has(i)) {
              XVa.push(selected.selectedTrain[i] ?? []);
              yVa.push(yTrain[i] ?? 0);
            } else {
              XTr.push(selected.selectedTrain[i] ?? []);
              yTr.push(yTrain[i] ?? 0);
            }
          }
          const fold = fitAndScoreRandomForest(XTr, yTr, XVa, yVa, {
            nEstimators,
            maxDepth,
            minNumSamples,
          });
          aucs.push(fold.metrics.roc_auc ?? 0);
        }
        const cvAuc = mean(aucs);
        if (cvAuc > bestCvAuc) {
          bestCvAuc = cvAuc;
          bestCfg = { nEstimators, maxDepth, minNumSamples };
        }
      }
    }
  }
  if (!bestCfg) throw new Error("failed to tune random forest");

  const tuned = fitAndScoreRandomForest(
    selected.selectedTrain,
    yTrain,
    selected.selectedTest,
    yTest,
    bestCfg,
  );
  const threshold = precisionRecallThresholdSweep(yTest, tuned.prob);
  const customPred = tuned.prob.map((p) => (p >= threshold.bestThreshold ? 1 : 0));
  const tunedMetrics = {
    accuracy: accuracy(yTest, customPred),
    precision: precision(yTest, customPred),
    recall: recall(yTest, customPred),
    f1: f1(yTest, customPred),
    roc_auc: rocAuc(yTest, tuned.prob),
  };
  const cm = confusionMatrix(yTest, customPred);
  void cm; // kept for parity; can be returned later.

  // 5b. Feature importance approximation (absolute logistic coefficients on selected features).
  const selectedLogit = trainLogisticRegression(selected.selectedTrain, yTrain, {
    iterations: 1200,
    learningRate: 0.02,
    l2: 1e-4,
  });
  const featureImportance = selected.names
    .map((feature, i) => ({
      feature,
      importance: Math.abs(selectedLogit.weights[i] ?? 0),
    }))
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 20);

  // 6. Deployment artifacts + scoring metadata.
  const artifact: PipelineArtifact = {
    generatedAt: new Date().toISOString(),
    modelType: "random_forest",
    modelJson: tuned.rf.toJSON(),
    preprocessor: pre,
    selectedFeatureNames: selected.names,
    selectedFeatureIndices: selected.indices,
    optimalThreshold: threshold.bestThreshold,
    metrics: tunedMetrics,
    notebookParityNotes: [
      "Business understanding is documented in Assignment.md AI context.",
      "Data understanding includes table list, row counts, missingness, and target checks.",
      "Analytic base table uses safe single-key relational joins.",
      "Preparation includes datetime engineering, ID/leakage drop, and train/test split.",
      "Modeling trains logistic, random forest, and gradient boosting stumps.",
      "Evaluation performs RF tuning, threshold optimization, confusion matrix, and AUC/F1 metrics.",
      "Deployment writes serialized model + metadata JSON for cron/job usage.",
    ],
  };
  savePipelineArtifacts(artifactPath, artifact);

  return {
    tableNames,
    rowCounts,
    modelShape: { rows: modelRows.length, cols: Object.keys(modelRows[0] ?? {}).length },
    droppedColumns: dropped,
    initialModelMetrics: initialResults,
    tunedModelMetrics: tunedMetrics,
    optimalThreshold: threshold.bestThreshold,
    topFeatureImportances: featureImportance,
    artifactPath,
  };
}

export function loadFraudPipelineArtifact(
  artifactPath = path.join(process.cwd(), "artifacts", "fraud_pipeline.json"),
): PipelineArtifact {
  if (!fs.existsSync(artifactPath)) {
    throw new Error(`Fraud pipeline artifact not found at ${artifactPath}`);
  }
  return JSON.parse(fs.readFileSync(artifactPath, "utf8")) as PipelineArtifact;
}

export function scoreNewOrdersWithArtifact(
  newOrders: Row[],
  artifact: PipelineArtifact,
): Array<Row & { fraud_probability: number; fraud_prediction: number }> {
  const transformed = transformRows(newOrders, artifact.preprocessor);
  const selected = transformed.map((row) =>
    artifact.selectedFeatureIndices.map((idx) => row[idx] ?? 0),
  );
  const model = RandomForestClassifier.load(artifact.modelJson as never);
  const probs = model.predictProbability(selected, 1);
  return newOrders
    .map((row, i) => {
      const p = probs[i] ?? 0;
      return {
        ...row,
        fraud_probability: p,
        fraud_prediction: p >= artifact.optimalThreshold ? 1 : 0,
      };
    })
    .sort((a, b) => b.fraud_probability - a.fraud_probability);
}

