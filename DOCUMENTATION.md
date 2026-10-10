# Intelligent Forest Monitoring System — Technical Documentation

## 1. Dataset Overview
- **Dataset File**: `wildfire_dataset.csv`
- **Total Records**: 9,171 samples
- **Geographic Focus**: Boreal forest region (North America)
- **Timeframe**: 2018-05-01 to 2024-09-27 (Fire seasons: May through September)

## 2. Dataset Columns
| Column Name | Data Type | Description |
| :--- | :--- | :--- |
| `DATE_DEBUT` | Date/String | Fire detection date (YYYY-MM-DD) |
| `LATITUDE` | Float | Geographic latitude coordinate (45.01 to 58.74°N) |
| `LONGITUDE` | Float | Geographic longitude coordinate (-79.50 to -57.25°W) |
| `MONTH` | Float/Int | Calendar month of observation (5 to 9) |
| `MAX_TEMP` | Float | Maximum daily temperature (°C) |
| `PRECIPITATION` | Float | Daily rainfall amount (mm) |
| `WIND_SPEED` | Float | Wind speed velocity (km/h) |
| `MIN_HUMIDITY` | Float | Minimum relative humidity (%) |
| `14_DAY_RAIN` | Float | Cumulative rainfall over the preceding 14 days (mm) |
| `14_DAY_AVG_TEMP` | Float | Average temperature over the preceding 14 days (°C) |
| `DAYS_SINCE_RAIN` | Float | Number of consecutive days without significant rain (>= 0.5mm) |
| `FIRE_RISK` | Integer | Binary target label (1 = High Risk / Active Fire, 0 = Normal / Low Risk) |

## 3. Target Variable
- `FIRE_RISK` is a binary target label (0 or 1).
- Class Distribution:
  - Class 1 (Fire Risk): 4,618 records (50.35%)
  - Class 0 (No Risk): 4,553 records (49.65%)
  - The dataset is well-balanced across binary classes.

## 4. Feature Selection
The model uses 10 numerical and environmental features:
1. `latitude`
2. `longitude`
3. `month`
4. `max_temp`
5. `precipitation`
6. `wind_speed`
7. `min_humidity`
8. `14_day_rain`
9. `14_day_avg_temp`
10. `days_since_rain`

Raw `DATE_DEBUT` text is excluded to prevent data leakage and replaced with date-derived features.

## 5. Preprocessing & Data Cleaning
- Missing values: 0 across all columns.
- Feature standardization: Column names mapped to standardized JSON schema (`latitude`, `longitude`, `14_day_rain`, etc.).
- Datetime parsing: `pd.to_datetime(format='mixed')` applied for chronological ordering.

## 6. Train / Validation / Test Strategy
To avoid temporal data leakage (mixing future environmental conditions into historical training data), a chronological split strategy was applied:
- **Train Split (2018–2022)**: 6,396 records (~70% of dataset)
- **Validation Split (2023)**: 1,562 records (~15% of dataset)
- **Test Split (2024)**: 1,213 records (~15% of dataset)

Reasoning: Chronological splits preserve natural climate seasonality and ensure that evaluation reflects real-world predictive performance on unseen future dates.

## 7. XGBoost Model Configuration
- **Algorithm**: `xgb.XGBClassifier`
- **Hyperparameters**:
  - `n_estimators`: 300
  - `max_depth`: 5
  - `learning_rate`: 0.03
  - `subsample`: 0.8
  - `colsample_bytree`: 0.8
  - `scale_pos_weight`: 1.0
  - `objective`: `'binary:logistic'`
  - `eval_metric`: `'logloss'`
- Early stopping monitored on validation loss.

## 8. Model Evaluation Results (Test Set - 2024 Data)
- **Accuracy**: 79.23%
- **Precision**: 75.04%
- **Recall (Class 1)**: 83.01% (Minimized False Negatives to avoid missing potential fire risks)
- **F1-Score**: 78.82%
- **ROC-AUC**: 0.8765
- **Confusion Matrix**:
  - True Negatives: 492
  - False Positives: 156
  - False Negatives: 96
  - True Positives: 469

## 9. Risk-Score Calculation
- The model outputs a continuous class probability `proba` between 0.0 and 1.0 via `predict_proba()`.
- `risk_score` = `int(round(proba * 100))` (0% to 100%).
- `risk_level` classification based on configurable thresholds:
  - `risk_score >= 75%` -> **HIGH**
  - `risk_score >= 40%` -> **MEDIUM**
  - `risk_score < 40%` -> **LOW**

## 10. Monitoring Architecture
```
React Frontend (Dashboard)
   │ (Coordinates saved)
   ▼
Firestore (`monitored_locations` linked to user UID)
   │ (Periodic telemetry lookup)
   ▼
Python FastAPI Inference Service (`/api/fire-risk/predict`)
   │
   ├── Weather Provider (Open-Meteo / OpenWeatherMap)
   ├── Preprocessing Pipeline
   └── XGBoost Model Inference
   │
   ▼
Threshold Comparison (`risk_score >= FIRE_RISK_THRESHOLD`)
   │
   ├── Threshold Crossed: Generate Alert Document
   └── Alert Deduplication Check: Send Email Notification
```

## 11. Weather-Data Integration
- Uses an abstract provider pattern (`BaseWeatherProvider`).
- **Open-Meteo Provider**: Retrieves real-time & 14-day historical weather telemetry without requiring an API key.
- **OpenWeatherMap Provider**: Configurable via `OPENWEATHER_API_KEY` in environment variables.

## 12. Fire-Risk Threshold
- Configurable environment variable: `FIRE_RISK_THRESHOLD=75.0`.
- Stored in `backend/config.py` as a single point of configuration.

## 13. Alert Generation
When `risk_score >= FIRE_RISK_THRESHOLD`, an alert payload is constructed:
```json
{
  "type": "WILDFIRE_RISK",
  "riskScore": 83,
  "riskLevel": "HIGH",
  "latitude": 16.123456,
  "longitude": 78.123456,
  "status": "ACTIVE",
  "userId": "user_uid_123",
  "locationId": "loc_test_01"
}
```

## 14. Email Notification & Deduplication Flow
- Email Subject: `⚠️ Forest Fire Risk Alert`
- Body includes: Location coordinates, Risk Score %, Risk Level, Timestamp, and Dashboard link.
- **Deduplication Cooldown**: `ALERT_COOLDOWN_HOURS=24`. Suppresses duplicate emails for the same location if already alerted, unless 24 hours pass or risk drops below threshold and re-crosses.

## 15. Firestore Data Structure
- `users/{uid}`: User profile documents.
- `monitored_locations/{locationId}`:
  - `id`: String
  - `userId`: String (Firebase UID)
  - `name`: String
  - `lat`: Number
  - `lng`: Number
  - `riskScore`: Number (0-100)
  - `riskLevel`: String (HIGH/MEDIUM/LOW)
  - `status`: String ("ACTIVE")
  - `lastUpdated`: Timestamp
