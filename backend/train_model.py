import os
import json
import pandas as pd
import numpy as np
import joblib

from sklearn.metrics import (
    accuracy_score,
    precision_score,
    recall_score,
    f1_score,
    roc_auc_score,
    confusion_matrix,
    classification_report
)
import xgboost as xgb

def run_pipeline():
    print("=" * 60)
    print("PART 1 & 2: DATA PREPROCESSING & XGBOOST TRAINING")
    print("=" * 60)

    csv_path = "wildfire_dataset.csv"
    if not os.path.exists(csv_path):
        raise FileNotFoundError(f"Dataset file not found at {csv_path}")

    # 1. Load Dataset
    df = pd.read_csv(csv_path)
    print(f"Loaded dataset with {len(df)} total records.")

    # Parse DATE_DEBUT with mixed format support for chronological splitting
    df['DATE_DEBUT'] = pd.to_datetime(df['DATE_DEBUT'], format='mixed')
    df = df.sort_values('DATE_DEBUT').reset_index(drop=True)

    # Standardize column mapping to match API input schema
    feature_mapping = {
        'LATITUDE': 'latitude',
        'LONGITUDE': 'longitude',
        'MONTH': 'month',
        'MAX_TEMP': 'max_temp',
        'PRECIPITATION': 'precipitation',
        'WIND_SPEED': 'wind_speed',
        'MIN_HUMIDITY': 'min_humidity',
        '14_DAY_RAIN': '14_day_rain',
        '14_DAY_AVG_TEMP': '14_day_avg_temp',
        'DAYS_SINCE_RAIN': 'days_since_rain'
    }

    df = df.rename(columns=feature_mapping)
    feature_cols = list(feature_mapping.values())
    target_col = 'FIRE_RISK'

    print(f"Features used ({len(feature_cols)}): {feature_cols}")
    print(f"Target distribution: {df[target_col].value_counts().to_dict()}")

    # 2. Time-Based Train / Validation / Test Splitting
    df['YEAR'] = df['DATE_DEBUT'].dt.year

    train_df = df[df['YEAR'] <= 2022].copy()
    val_df = df[df['YEAR'] == 2023].copy()
    test_df = df[df['YEAR'] >= 2024].copy()

    # Fallback if year distribution is concentrated
    if len(val_df) == 0 or len(test_df) == 0:
        n = len(df)
        train_df = df.iloc[:int(n * 0.7)].copy()
        val_df = df.iloc[int(n * 0.7):int(n * 0.85)].copy()
        test_df = df.iloc[int(n * 0.85):].copy()

    X_train, y_train = train_df[feature_cols], train_df[target_col]
    X_val, y_val = val_df[feature_cols], val_df[target_col]
    X_test, y_test = test_df[feature_cols], test_df[target_col]

    print(f"\nTrain set: {len(X_train)} samples ({train_df['DATE_DEBUT'].min().date()} to {train_df['DATE_DEBUT'].max().date()})")
    print(f"Validation set: {len(X_val)} samples ({val_df['DATE_DEBUT'].min().date()} to {val_df['DATE_DEBUT'].max().date()})")
    print(f"Test set: {len(X_test)} samples ({test_df['DATE_DEBUT'].min().date()} to {test_df['DATE_DEBUT'].max().date()})")

    # 3. XGBoost Model Training
    scale_pos_weight = (len(y_train) - sum(y_train)) / sum(y_train) if sum(y_train) > 0 else 1.0

    model = xgb.XGBClassifier(
        n_estimators=300,
        max_depth=5,
        learning_rate=0.03,
        subsample=0.8,
        colsample_bytree=0.8,
        scale_pos_weight=scale_pos_weight,
        objective='binary:logistic',
        eval_metric='logloss',
        random_state=42
    )

    print("\nTraining XGBoost Classifier...")
    model.fit(
        X_train, y_train,
        eval_set=[(X_val, y_val)],
        verbose=False
    )

    # 4. PART 3: MODEL EVALUATION
    print("\n" + "=" * 60)
    print("PART 3: MODEL EVALUATION RESULTS (TEST SET)")
    print("=" * 60)

    y_pred_proba = model.predict_proba(X_test)[:, 1]
    y_pred = (y_pred_proba >= 0.5).astype(int)

    acc = accuracy_score(y_test, y_pred)
    prec = precision_score(y_test, y_pred, zero_division=0)
    rec = recall_score(y_test, y_pred, zero_division=0)
    f1 = f1_score(y_test, y_pred, zero_division=0)
    roc_auc = roc_auc_score(y_test, y_pred_proba)
    cm = confusion_matrix(y_test, y_pred)

    print(f"Accuracy:  {acc * 100:.2f}%")
    print(f"Precision: {prec * 100:.2f}%")
    print(f"Recall:    {rec * 100:.2f}% (Minimized False Negatives)")
    print(f"F1-Score:  {f1 * 100:.2f}%")
    print(f"ROC-AUC:   {roc_auc:.4f}")
    print("\nConfusion Matrix:")
    print(f"  [TN: {cm[0][0]:<5} FP: {cm[0][1]:<5}]")
    print(f"  [FN: {cm[1][0]:<5} TP: {cm[1][1]:<5}]")

    print("\nDetailed Classification Report:")
    print(classification_report(y_test, y_pred))

    # 5. Save Model Artifacts
    output_dir = os.path.join("backend", "model")
    os.makedirs(output_dir, exist_ok=True)

    model_path = os.path.join(output_dir, "xgboost_model.joblib")
    joblib.dump(model, model_path)

    metadata = {
        "features": feature_cols,
        "metrics": {
            "accuracy": float(acc),
            "precision": float(prec),
            "recall": float(rec),
            "f1_score": float(f1),
            "roc_auc": float(roc_auc)
        },
        "default_threshold": 75.0
    }

    metadata_path = os.path.join(output_dir, "model_metadata.json")
    with open(metadata_path, "w") as f:
        json.dump(metadata, f, indent=2)

    print(f"\nSaved model artifact to: {model_path}")
    print(f"Saved metadata to: {metadata_path}")
    print("=" * 60)

if __name__ == "__main__":
    run_pipeline()
