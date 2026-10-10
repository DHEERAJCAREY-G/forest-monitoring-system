import os
import sys
import json

# Ensure project root is in Python path
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from backend.inference import predictor, PredictionInput
from backend.config import settings

def run_test_case(name: str, input_dict: dict):
    print("\n" + "=" * 60)
    print(f"TEST CASE: {name}")
    print("=" * 60)

    # 1. Prepare PredictionInput using exact production Pydantic model
    pred_input = PredictionInput(**input_dict)

    # 2. Run prediction using the loaded production XGBoost model
    result = predictor.predict(pred_input)

    risk_score = result["risk_score"]
    risk_level = result["risk_level"]
    risk_proba = result["risk_probability"]
    threshold = int(result["threshold_configured"])
    threshold_crossed = "YES" if risk_score >= threshold else "NO"

    # 3. Print formatted output
    print("\n[Input Features]")
    for k, v in input_dict.items():
        print(f"  {k:<16}: {v}")

    print("\n[Inference Output]")
    print(f"Model Probability : {risk_proba:.4f}")
    print(f"Fire Risk Score   : {risk_score}%")
    print(f"Threshold         : {threshold}%")
    print(f"Risk Level        : {risk_level}")
    print(f"Threshold Crossed : {threshold_crossed}")
    print("=" * 60)

    return result

def main():
    print("=" * 60)
    print("XGBOOST INFERENCE PIPELINE — TEST UTILITY")
    print("=" * 60)
    print(f"Loaded Model         : backend/model/xgboost_model.joblib")
    print(f"Production Threshold : {settings.FIRE_RISK_THRESHOLD}%")

    # 1. Low-Risk Test Case (Cool, humid, recent heavy rain -> Below 75% threshold)
    low_risk_input = {
        "latitude": 50.1234,
        "longitude": -71.5000,
        "month": 6,
        "max_temp": 14.2,
        "precipitation": 12.5,
        "wind_speed": 10.5,
        "min_humidity": 78.0,
        "14_day_rain": 68.4,
        "14_day_avg_temp": 12.8,
        "days_since_rain": 1.0
    }

    # 2. High-Risk Test Case (High temp, low humidity, dry period -> Crosses 75% threshold)
    high_risk_input = {
        "latitude": 49.5192,
        "longitude": -72.6159,
        "month": 6,
        "max_temp": 29.5,
        "precipitation": 0.8,
        "wind_speed": 16.9,
        "min_humidity": 35.0,
        "14_day_rain": 36.8,
        "14_day_avg_temp": 17.45,
        "days_since_rain": 8.0
    }

    res_low = run_test_case("1. Low-Risk Test Case (Remains below threshold)", low_risk_input)
    res_high = run_test_case("2. High-Risk Test Case (Crosses threshold)", high_risk_input)

    print("\n" + "=" * 60)
    print("SUMMARY RESULT RECAP")
    print("=" * 60)
    print(f"  Low-Risk Case  -> Score: {res_low['risk_score']}% | Threshold: {int(settings.FIRE_RISK_THRESHOLD)}% | Level: {res_low['risk_level']} | Threshold Crossed: {'YES' if res_low['risk_score'] >= settings.FIRE_RISK_THRESHOLD else 'NO'}")
    print(f"  High-Risk Case -> Score: {res_high['risk_score']}% | Threshold: {int(settings.FIRE_RISK_THRESHOLD)}% | Level: {res_high['risk_level']} | Threshold Crossed: {'YES' if res_high['risk_score'] >= settings.FIRE_RISK_THRESHOLD else 'NO'}")
    print("=" * 60)

if __name__ == "__main__":
    main()
