"""
Convert the sklearn fraud pipeline (joblib) to the ml-random-forest JSON
format used by the Next.js app's inference-only cron.

Usage (from repo root after running the notebook):
    python scripts/export_to_js_artifact.py

Reads:
    artifacts/fraud_pipeline.joblib          (trained sklearn Pipeline)
    artifacts/fraud_pipeline_metadata.joblib (feature_columns, dropped_columns, optimal_threshold)
Writes:
    app/artifacts/fraud_pipeline.json        (PipelineArtifact for JS)
"""

from __future__ import annotations

import json
import sys
from datetime import datetime, timezone
from pathlib import Path

import joblib
import numpy as np


REPO_ROOT = Path(__file__).resolve().parent.parent
MODEL_PATH = REPO_ROOT / "artifacts" / "fraud_pipeline.joblib"
META_PATH = REPO_ROOT / "artifacts" / "fraud_pipeline_metadata.joblib"
OUT_PATH = REPO_ROOT / "app" / "artifacts" / "fraud_pipeline.json"


# ---------------------------------------------------------------------------
# sklearn tree -> ml-cart recursive JSON
# ---------------------------------------------------------------------------

def _convert_tree_node(tree, node_id: int, n_classes: int) -> dict:
    """Walk sklearn's flat tree arrays and build the nested ml-cart node."""
    left = tree.children_left[node_id]
    right = tree.children_right[node_id]

    if left == -1:  # leaf
        counts = tree.value[node_id][0]
        total = counts.sum()
        probs = (counts / total).tolist() if total > 0 else [1.0 / n_classes] * n_classes
        return {"distribution": [probs]}

    return {
        "splitColumn": int(tree.feature[node_id]),
        "splitValue": float(tree.threshold[node_id]),
        "gain": float(tree.impurity[node_id]),
        "numberSamples": int(tree.n_node_samples[node_id]),
        "left": _convert_tree_node(tree, left, n_classes),
        "right": _convert_tree_node(tree, right, n_classes),
    }


def convert_sklearn_tree(sk_tree, n_classes: int) -> dict:
    """Convert one sklearn DecisionTreeClassifier to ml-cart DTClassifier JSON."""
    return {
        "name": "DTClassifier",
        "options": {
            "kind": "classifier",
            "gainFunction": "gini",
            "splitFunction": "mean",
            "minNumSamples": int(sk_tree.min_samples_split)
                if hasattr(sk_tree, "min_samples_split") else 3,
            "maxDepth": int(sk_tree.max_depth)
                if sk_tree.max_depth is not None else 2 ** 31,
        },
        "root": _convert_tree_node(sk_tree.tree_, 0, n_classes),
    }


def convert_random_forest(rf, n_input_features: int) -> dict:
    """Convert sklearn RandomForestClassifier to ml-random-forest RFClassifier JSON."""
    n_classes = rf.n_classes_
    all_indices = list(range(n_input_features))

    estimators_json = []
    indexes = []
    for est in rf.estimators_:
        estimators_json.append(convert_sklearn_tree(est, n_classes))
        indexes.append(all_indices)

    return {
        "name": "RFClassifier",
        "baseModel": {
            "indexes": indexes,
            "n": n_input_features,
            "replacement": True,
            "maxFeatures": n_input_features,
            "nEstimators": len(rf.estimators_),
            "treeOptions": {},
            "isClassifier": True,
            "seed": 42,
            "estimators": estimators_json,
            "useSampleBagging": True,
        },
    }


# ---------------------------------------------------------------------------
# sklearn preprocessor -> TrainedPreprocessor
# ---------------------------------------------------------------------------

def extract_preprocessor(pipe) -> dict:
    """Extract TrainedPreprocessor fields from the fitted ColumnTransformer."""
    ct = pipe.named_steps["preprocessor"]

    num_name, num_pipe, num_cols = ct.transformers_[0]
    cat_name, cat_pipe, cat_cols = ct.transformers_[1]

    num_cols = list(num_cols)
    cat_cols = list(cat_cols)

    imputer_num = num_pipe.named_steps["imputer"]
    scaler = num_pipe.named_steps["scaler"]
    imputer_cat = cat_pipe.named_steps["imputer"]
    ohe = cat_pipe.named_steps["onehot"]

    numeric_medians = {col: float(imputer_num.statistics_[i]) for i, col in enumerate(num_cols)}
    numeric_means = {col: float(scaler.mean_[i]) for i, col in enumerate(num_cols)}
    numeric_std = {col: float(scaler.scale_[i]) for i, col in enumerate(num_cols)}

    categorical_modes = {col: str(imputer_cat.statistics_[i]) for i, col in enumerate(cat_cols)}

    one_hot_values: dict[str, list[str]] = {}
    for i, col in enumerate(cat_cols):
        one_hot_values[col] = [str(v) for v in ohe.categories_[i]]

    encoded_feature_names: list[str] = []
    for col in num_cols:
        encoded_feature_names.append(f"num__{col}")
    for col in cat_cols:
        for val in one_hot_values[col]:
            encoded_feature_names.append(f"cat__{col}__{val}")

    return {
        "featureColumns": num_cols + cat_cols,
        "droppedColumns": [],  # filled from metadata below
        "numericCols": num_cols,
        "categoricalCols": cat_cols,
        "numericMedians": numeric_medians,
        "numericMeans": numeric_means,
        "numericStd": numeric_std,
        "categoricalModes": categorical_modes,
        "oneHotValues": one_hot_values,
        "encodedFeatureNames": encoded_feature_names,
    }


# ---------------------------------------------------------------------------
# Feature selection (SelectFromModel)
# ---------------------------------------------------------------------------

def extract_selection(pipe, encoded_feature_names: list[str]) -> tuple[list[str], list[int]]:
    selector = pipe.named_steps["selector"]
    mask = selector.get_support()
    indices = [int(i) for i, m in enumerate(mask) if m]
    names = [encoded_feature_names[i] for i in indices]
    return names, indices


# ---------------------------------------------------------------------------
# Metrics (evaluate tuned model -- recompute from stored test predictions)
# ---------------------------------------------------------------------------

def compute_metrics(pipe, X_test, y_test, threshold: float) -> dict:
    """Evaluate the pipeline on the test set and return JS-compatible metrics dict."""
    from sklearn.metrics import (
        accuracy_score,
        f1_score,
        precision_score,
        recall_score,
        roc_auc_score,
    )

    y_prob = pipe.predict_proba(X_test)[:, 1]
    y_pred = (y_prob >= threshold).astype(int)

    return {
        "accuracy": float(accuracy_score(y_test, y_pred)),
        "precision": float(precision_score(y_test, y_pred, zero_division=0)),
        "recall": float(recall_score(y_test, y_pred, zero_division=0)),
        "f1": float(f1_score(y_test, y_pred, zero_division=0)),
        "roc_auc": float(roc_auc_score(y_test, y_prob)),
    }


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------

def main() -> None:
    if not MODEL_PATH.exists():
        print(f"ERROR: {MODEL_PATH} not found. Run the Python notebook first.", file=sys.stderr)
        sys.exit(1)
    if not META_PATH.exists():
        print(f"ERROR: {META_PATH} not found. Run the Python notebook first.", file=sys.stderr)
        sys.exit(1)

    pipe = joblib.load(MODEL_PATH)
    meta = joblib.load(META_PATH)

    preprocessor = extract_preprocessor(pipe)
    preprocessor["droppedColumns"] = meta.get("dropped_columns", [])
    preprocessor["featureColumns"] = meta.get("feature_columns", preprocessor["featureColumns"])

    selected_names, selected_indices = extract_selection(pipe, preprocessor["encodedFeatureNames"])

    rf = pipe.named_steps["model"]
    n_selected = len(selected_indices)
    model_json = convert_random_forest(rf, n_selected)

    # Attempt to recompute metrics if the notebook's test data is reachable.
    # Fall back to empty metrics if not (the artifact is still valid for inference).
    metrics: dict = {}
    try:
        import sqlite3
        import pandas as pd

        db_path = REPO_ROOT / "shop.db"
        if db_path.exists():
            conn = sqlite3.connect(str(db_path))
            tables = pd.read_sql_query(
                "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;", conn
            )["name"].tolist()

            orders = pd.read_sql_query("SELECT * FROM orders;", conn)
            if "is_fraud" in orders.columns:
                model_df = orders.copy()
                for t in tables:
                    if t == "orders":
                        continue
                    right = pd.read_sql_query(f"SELECT * FROM [{t}];", conn)
                    shared = set(orders.columns) & set(right.columns)
                    id_keys = [c for c in shared if c.lower().endswith("_id") or c.lower() == "id"]
                    if len(id_keys) != 1:
                        continue
                    key = id_keys[0]
                    if right[key].nunique() != len(right):
                        continue
                    model_df = model_df.merge(right, on=key, how="left", suffixes=("", f"__{t}"))
                conn.close()

                for col in list(model_df.columns):
                    if any(tok in col.lower() for tok in ["date", "time", "timestamp", "_at"]):
                        try:
                            converted = pd.to_datetime(model_df[col], errors="coerce")
                            if converted.notna().sum() > 0:
                                model_df[col] = converted
                        except Exception:
                            pass
                for col in model_df.select_dtypes(include=["datetime64[ns]", "datetime64[ns, UTC]"]).columns.tolist():
                    model_df[f"{col}_year"] = model_df[col].dt.year
                    model_df[f"{col}_month"] = model_df[col].dt.month
                    model_df[f"{col}_day"] = model_df[col].dt.day
                    model_df[f"{col}_dayofweek"] = model_df[col].dt.dayofweek
                    model_df[f"{col}_hour"] = model_df[col].dt.hour
                    model_df = model_df.drop(columns=[col])

                drop_cols = meta.get("dropped_columns", [])
                X = model_df.drop(columns=["is_fraud"] + drop_cols, errors="ignore")
                y = model_df["is_fraud"].astype(int)

                from sklearn.model_selection import train_test_split
                _, X_test, _, y_test = train_test_split(
                    X, y, test_size=0.20, random_state=42,
                    stratify=y if y.nunique() == 2 else None,
                )
                metrics = compute_metrics(pipe, X_test, y_test, meta["optimal_threshold"])
    except Exception as exc:
        print(f"Warning: could not recompute metrics ({exc}); continuing without them.")

    artifact = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "modelType": "random_forest",
        "modelJson": model_json,
        "preprocessor": preprocessor,
        "selectedFeatureNames": selected_names,
        "selectedFeatureIndices": selected_indices,
        "optimalThreshold": float(meta["optimal_threshold"]),
        "metrics": metrics,
        "notebookParityNotes": [
            "Exported from Python notebook Chapter17_Fraud_Pipeline_Heitor.ipynb via export_to_js_artifact.py.",
            "Model selection: logistic regression, random forest, gradient boosting compared; tuned RF chosen.",
            "Preprocessing: median imputation + z-score for numeric; mode imputation + one-hot for categorical.",
            "Feature selection: SelectFromModel(LogisticRegression).",
            "Threshold optimised for F1 on test set.",
        ],
    }

    OUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with open(OUT_PATH, "w") as f:
        json.dump(artifact, f, separators=(",", ":"), default=_json_fallback)

    size_kb = OUT_PATH.stat().st_size / 1024
    print(f"Wrote {OUT_PATH} ({size_kb:.1f} KB)")
    print(f"  selectedFeatures: {len(selected_names)}")
    print(f"  nEstimators:      {len(rf.estimators_)}")
    print(f"  optimalThreshold: {meta['optimal_threshold']:.4f}")
    if metrics:
        print(f"  roc_auc:          {metrics.get('roc_auc', '?')}")
        print(f"  f1:               {metrics.get('f1', '?')}")


def _json_fallback(obj):
    """Handle numpy types that json.dump can't serialize natively."""
    if isinstance(obj, (np.integer,)):
        return int(obj)
    if isinstance(obj, (np.floating,)):
        return float(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")


if __name__ == "__main__":
    main()
