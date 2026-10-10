import requests
import json
import time

BASE_URL = "http://127.0.0.1:8000"

def test_predictions():
    print("=" * 60)
    print("FINAL VALIDATION: TESTING FASTAPI BACKEND & ML INFERENCE API")
    print("=" * 60)

    # 1. Health check
    res = requests.get(f"{BASE_URL}/")
    print("\n1. GET / Root Status:")
    print(json.dumps(res.json(), indent=2))

    # 2. Test valid prediction input matching prompt Part 4
    sample_valid_input = {
        "latitude": 16.123456,
        "longitude": 78.123456,
        "month": 9,
        "max_temp": 35.4,
        "precipitation": 0.0,
        "wind_speed": 18.2,
        "min_humidity": 32,
        "14_day_rain": 12.4,
        "14_day_avg_temp": 31.2,
        "days_since_rain": 8
    }

    res_pred = requests.post(f"{BASE_URL}/api/fire-risk/predict", json=sample_valid_input)
    print("\n2. POST /api/fire-risk/predict (Sample Valid Data):")
    print(json.dumps(res_pred.json(), indent=2))

    # 3. Test invalid input handling
    sample_invalid_input = {
        "latitude": 16.123456,
        "month": "invalid_month_string"
    }
    res_inv = requests.post(f"{BASE_URL}/api/fire-risk/predict", json=sample_invalid_input)
    print("\n3. POST /api/fire-risk/predict (Invalid Data Test):")
    print(f"Status Code: {res_inv.status_code}")
    print(json.dumps(res_inv.json(), indent=2))

    # 4. Test Monitoring Evaluation & Threshold Crossing & Alert Deduplication
    print("\n4. Testing Location Weather Evaluation & Threshold Crossing Alert...")
    eval_res1 = requests.post(
        f"{BASE_URL}/api/monitoring/evaluate-location?lat=48.0537&lng=8.2037&location_name=Black%20Forest&user_id=usr_demo123&location_id=loc_test_01"
    )
    print("First Evaluation Call (Alert Triggered & Sent):")
    print(json.dumps(eval_res1.json(), indent=2))

    # Second call for same location (Deduplication Check)
    eval_res2 = requests.post(
        f"{BASE_URL}/api/monitoring/evaluate-location?lat=48.0537&lng=8.2037&location_name=Black%20Forest&user_id=usr_demo123&location_id=loc_test_01"
    )
    print("\nSecond Evaluation Call (Deduplication Cooldown Active):")
    print(json.dumps(eval_res2.json(), indent=2))

    print("=" * 60)

if __name__ == "__main__":
    test_predictions()
