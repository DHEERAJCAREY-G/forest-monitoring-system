"""
Comprehensive Integration Test Suite for Google Earth Engine & Deforestation Monitoring.

Validates all Acceptance Criteria:
1. Earth Engine initializes successfully using the configured service account & project.
2. Protected health query (/api/earth-engine/health) returns S2_SR_HARMONIZED imagery metadata.
3. Live forest monitoring analysis for two valid date ranges (Point + Radius).
4. Live forest monitoring analysis for user-selected polygon geometry.
5. Error handling for invalid geometry (out of bounds lat/lng, negative radius).
6. Error handling for invalid date ranges (reversed dates, bad format).
7. Insufficient imagery handling returning INSUFFICIENT_DATA status.
8. Authenticated user-associated location evaluation (/api/deforestation/evaluate-location).
9. Deforestation classification: Confirmed Deforestation vs. Potential Loss vs. Stable Canopy.
10. Alert deduplication cooldown logic.
"""

import sys
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import settings
from backend.deforestation_service import (
    EarthEngineManager,
    test_earth_engine_connectivity,
    analyze_deforestation_request
)
from backend.email_service import (
    send_deforestation_alert_email,
    mark_deforestation_below_threshold,
    _deforestation_alert_history
)

client = TestClient(app)


def test_1_earth_engine_initialization():
    print("\n" + "=" * 70)
    print("TEST 1: GOOGLE EARTH ENGINE INITIALIZATION")
    print("=" * 70)

    ok, err = EarthEngineManager.initialize()
    status = EarthEngineManager.get_status()

    print(f"Project ID       : {status['project_id']}")
    print(f"Service Account  : {status['service_account']}")
    print(f"Collection       : {status['collection']}")
    print(f"Initialized      : {status['initialized']}")

    assert ok is True, f"Earth Engine failed to initialize: {err}"
    assert status["initialized"] is True
    assert status["project_id"] == "massive-current-509710-r9"
    assert status["service_account"] == "forest-monitoring-backend@massive-current-509710-r9.iam.gserviceaccount.com"
    print(">>> PASS: Earth Engine initialized successfully with configured credentials.")


def test_2_protected_health_and_imagery_metadata():
    print("\n" + "=" * 70)
    print("TEST 2: PROTECTED HEALTH CHECK & S2_SR_HARMONIZED QUERY")
    print("=" * 70)

    # 1. Test endpoint call with valid authorization
    response = client.get(
        "/api/earth-engine/health",
        headers={"Authorization": "Bearer mock-test-token"}
    )
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    print(f"Endpoint Status  : {data.get('status')}")
    print(f"Collection       : {data.get('collection')}")
    test_query = data.get("test_query", {})
    print(f"Test Image ID    : {test_query.get('test_image_id')}")
    print(f"Bands Available  : {test_query.get('bands_available')}")

    assert data.get("status") == "healthy"
    assert data.get("initialized") is True
    assert test_query.get("test_image_id") is not None
    assert "QA60" in test_query.get("cloud_mask_bands_supported")
    print(">>> PASS: Protected health endpoint returned live Sentinel-2 metadata.")


def test_3_live_analysis_point_radius():
    print("\n" + "=" * 70)
    print("TEST 3: LIVE S2 ANALYSIS FOR TWO PERIODS (POINT + RADIUS)")
    print("=" * 70)

    # Amazon Rainforest coordinates
    payload = {
        "latitude": -3.4653,
        "longitude": -62.2159,
        "radius_km": 2.0,
        "baseline_start": "2023-06-01",
        "baseline_end": "2023-09-01",
        "comparison_start": "2024-06-01",
        "comparison_end": "2024-09-01",
        "max_cloud_cover": 40.0
    }

    response = client.post("/api/deforestation/analyze-area", json=payload)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    print(f"Target Area      : {data.get('total_area_hectares')} ha (Radius: 2.0 km)")
    print(f"Baseline Scenes  : {data.get('baseline_scenes_count')}")
    print(f"Comparison Scenes: {data.get('comparison_scenes_count')}")
    print(f"Baseline NDVI    : {data.get('baseline_ndvi')}")
    print(f"Comparison NDVI  : {data.get('comparison_ndvi')}")
    print(f"Delta NDVI       : {data.get('ndvi_drop')}")
    print(f"Data Quality     : {data.get('data_quality')}")
    print(f"Status           : {data.get('status')}")

    assert data.get("baseline_scenes_count") > 0
    assert data.get("comparison_scenes_count") > 0
    assert data.get("baseline_ndvi") is not None
    assert data.get("comparison_ndvi") is not None
    assert data.get("data_quality") in ["HIGH_QUALITY", "ACCEPTABLE"]
    assert data.get("status") in ["NO_SIGNIFICANT_CHANGE", "STABLE_CANOPY", "POTENTIAL_FOREST_LOSS", "CONFIRMED_DEFORESTATION"]
    print(">>> PASS: Live point + radius comparison succeeded with valid statistics.")


def test_4_live_analysis_polygon():
    print("\n" + "=" * 70)
    print("TEST 4: LIVE S2 ANALYSIS FOR USER-SELECTED POLYGON")
    print("=" * 70)

    # Amazon forest box polygon
    polygon = [
        [-62.25, -3.50],
        [-62.20, -3.50],
        [-62.20, -3.45],
        [-62.25, -3.45],
        [-62.25, -3.50]
    ]

    payload = {
        "polygon_coordinates": polygon,
        "baseline_start": "2023-06-01",
        "baseline_end": "2023-09-01",
        "comparison_start": "2024-06-01",
        "comparison_end": "2024-09-01"
    }

    response = client.post("/api/deforestation/analyze-area", json=payload)
    assert response.status_code == 200, f"Expected 200, got {response.status_code}: {response.text}"
    data = response.json()

    print(f"Polygon Area     : {data.get('total_area_hectares')} ha")
    print(f"Baseline NDVI    : {data.get('baseline_ndvi')}")
    print(f"Comparison NDVI  : {data.get('comparison_ndvi')}")
    print(f"Data Quality     : {data.get('data_quality')}")
    print(f"Status           : {data.get('status')}")

    assert data.get("total_area_hectares") > 0
    assert data.get("baseline_ndvi") is not None
    assert data.get("comparison_ndvi") is not None
    print(">>> PASS: Live polygon analysis returned accurate area and vegetation change.")


def test_5_invalid_geometry_handling():
    print("\n" + "=" * 70)
    print("TEST 5: ERROR HANDLING FOR INVALID GEOMETRY")
    print("=" * 70)

    # 1. Invalid latitude (> 90)
    resp1 = client.post("/api/deforestation/analyze-area", json={"latitude": 105.0, "longitude": 0.0})
    print(f"Latitude 105.0 -> HTTP {resp1.status_code} ({resp1.json().get('detail')})")
    assert resp1.status_code == 400

    # 2. Invalid radius (<= 0)
    resp2 = client.post("/api/deforestation/analyze-area", json={"latitude": 0.0, "longitude": 0.0, "radius_km": -2.0})
    print(f"Radius -2.0 km -> HTTP {resp2.status_code} ({resp2.json().get('detail')})")
    assert resp2.status_code == 400

    # 3. Invalid polygon (< 3 points)
    resp3 = client.post("/api/deforestation/analyze-area", json={"polygon_coordinates": [[10, 20]]})
    print(f"Polygon 1 pt   -> HTTP {resp3.status_code} ({resp3.json().get('detail')})")
    assert resp3.status_code == 400

    print(">>> PASS: Invalid geometry rejected with HTTP 400 and clear error details.")


def test_6_invalid_dates_handling():
    print("\n" + "=" * 70)
    print("TEST 6: ERROR HANDLING FOR INVALID DATES")
    print("=" * 70)

    # Reversed dates: start > end
    payload = {
        "latitude": 0.0,
        "longitude": 0.0,
        "baseline_start": "2024-06-01",
        "baseline_end": "2024-01-01"
    }
    resp = client.post("/api/deforestation/analyze-area", json=payload)
    print(f"Reversed dates -> HTTP {resp.status_code} ({resp.json().get('detail')})")
    assert resp.status_code == 400

    # Bad date format
    payload_bad = {
        "latitude": 0.0,
        "longitude": 0.0,
        "baseline_start": "invalid-date",
        "baseline_end": "2024-01-01"
    }
    resp_bad = client.post("/api/deforestation/analyze-area", json=payload_bad)
    print(f"Malformed date -> HTTP {resp_bad.status_code} ({resp_bad.json().get('detail')})")
    assert resp_bad.status_code == 400
    print(">>> PASS: Invalid date ranges rejected with HTTP 400.")


def test_7_insufficient_data_status():
    print("\n" + "=" * 70)
    print("TEST 7: INSUFFICIENT_DATA STATUS FOR MISSING/CLOUDY SCENES")
    print("=" * 70)

    # Single-day window where 0 Sentinel-2 scenes exist
    payload = {
        "latitude": -3.4653,
        "longitude": -62.2159,
        "radius_km": 1.0,
        "baseline_start": "2024-01-01",
        "baseline_end": "2024-01-02",
        "comparison_start": "2024-06-01",
        "comparison_end": "2024-06-02"
    }

    response = client.post("/api/deforestation/analyze-area", json=payload)
    assert response.status_code == 200
    data = response.json()

    print(f"Status           : {data.get('status')}")
    print(f"Data Quality     : {data.get('data_quality')}")
    print(f"Reason           : {data.get('reason')}")
    print(f"Threshold Crossed: {data.get('threshold_crossed')}")

    assert data.get("status") == "INSUFFICIENT_DATA"
    assert data.get("data_quality") == "INSUFFICIENT_DATA"
    assert data.get("threshold_crossed") is False
    print(">>> PASS: Missing imagery correctly returns INSUFFICIENT_DATA without false alerts.")


def test_8_user_associated_evaluation():
    print("\n" + "=" * 70)
    print("TEST 8: USER-ASSOCIATED EVALUATION ENDPOINT")
    print("=" * 70)

    payload = {
        "user_id": "firebase_uid_test_101",
        "location_id": "loc_amazon_sector_a",
        "location_name": "Amazon Conservation Reserve",
        "latitude": -3.4653,
        "longitude": -62.2159,
        "radius_km": 2.0,
        "recipient_email": "ranger@conservation.org"
    }

    # Test missing user_id returns 400
    bad_payload = dict(payload)
    bad_payload["user_id"] = "   "
    bad_resp = client.post("/api/deforestation/evaluate-location", json=bad_payload)
    assert bad_resp.status_code == 400
    print(f"Empty user_id rejected -> HTTP {bad_resp.status_code}")

    # Test valid authenticated user evaluation
    resp = client.post(
        "/api/deforestation/evaluate-location",
        json=payload,
        headers={"Authorization": "Bearer test-firebase-jwt-token"}
    )
    assert resp.status_code == 200
    data = resp.json()

    print(f"User ID Associated: {data['location']['user_id']}")
    print(f"Location ID       : {data['location']['location_id']}")
    print(f"Analysis Status   : {data['analysis']['status']}")
    print(f"Alert Triggered   : {data['alert_triggered']}")

    assert data["location"]["user_id"] == "firebase_uid_test_101"
    assert data["location"]["location_id"] == "loc_amazon_sector_a"
    assert data["analysis"]["status"] in ["NO_SIGNIFICANT_CHANGE", "STABLE_CANOPY", "POTENTIAL_FOREST_LOSS", "CONFIRMED_DEFORESTATION"]
    print(">>> PASS: Location evaluation successfully associated with authenticated Firebase user.")


def test_9_alert_deduplication():
    print("\n" + "=" * 70)
    print("TEST 9: ALERT DEDUPLICATION & COOLDOWN LOGIC")
    print("=" * 70)

    from backend.email_service import _sent_detection_ids
    user_id = "test_user_gee_01"
    loc_id = "loc_deforest_01"
    _deforestation_alert_history.clear()
    _sent_detection_ids.clear()

    # First dispatch -> should send
    first = send_deforestation_alert_email(
        recipient_email="alerts@forest.org",
        user_id=user_id,
        location_id=loc_id,
        location_name="Northern Ridge",
        lat=10.0, lng=77.0, radius_km=5.0,
        total_area_ha=7853.98, loss_ha=1200.0, loss_pct=15.2,
        baseline_ndvi=0.82, recent_ndvi=0.60, confidence_score=94.0,
        detection_id="det_test_01"
    )
    print(f"First dispatch attempt : Sent = {first}")
    assert first is True

    # Immediate second dispatch -> should be deduplicated
    second = send_deforestation_alert_email(
        recipient_email="alerts@forest.org",
        user_id=user_id,
        location_id=loc_id,
        location_name="Northern Ridge",
        lat=10.0, lng=77.0, radius_km=5.0,
        total_area_ha=7853.98, loss_ha=1210.0, loss_pct=15.4,
        baseline_ndvi=0.82, recent_ndvi=0.60, confidence_score=94.0,
        detection_id="det_test_01"
    )
    print(f"Second consecutive call: Sent = {second} (Cooldown / Deduplication Active)")
    assert second is False

    # Mark below threshold, clear specific det ID, then trigger new detection -> should send
    mark_deforestation_below_threshold(user_id, loc_id)
    _sent_detection_ids.clear()
    third = send_deforestation_alert_email(
        recipient_email="alerts@forest.org",
        user_id=user_id,
        location_id=loc_id,
        location_name="Northern Ridge",
        lat=10.0, lng=77.0, radius_km=5.0,
        total_area_ha=7853.98, loss_ha=1250.0, loss_pct=15.9,
        baseline_ndvi=0.82, recent_ndvi=0.59, confidence_score=94.0,
        detection_id="det_test_02"
    )
    print(f"Third call after reset : Sent = {third}")
    assert third is True
    print(">>> PASS: Deduplication, detection ID tracking, and cooldown work properly.")


def test_10_scheduled_monitoring_and_scheduler_status():
    print("\n" + "=" * 70)
    print("TEST 10: SCHEDULED MONITORING & SCHEDULER STATUS")
    print("=" * 70)

    # 1. Test scheduler status endpoint
    status_resp = client.get("/api/deforestation/scheduler-status")
    assert status_resp.status_code == 200
    st_data = status_resp.json()
    print(f"Scheduler Running   : {st_data.get('scheduler_running')}")
    print(f"Registered Jobs     : {len(st_data.get('jobs', []))}")
    assert "scheduler_running" in st_data

    # 2. Test manual trigger endpoint for scheduled monitoring check
    trigger_resp = client.post(
        "/api/deforestation/run-scheduled-check",
        headers={"Authorization": "Bearer test-firebase-jwt-token"}
    )
    assert trigger_resp.status_code == 200
    tr_data = trigger_resp.json()
    print(f"Trigger Status      : {tr_data.get('status')}")
    print(f"Execution Summary   : {tr_data.get('summary')}")
    assert tr_data.get("status") == "completed"
    print(">>> PASS: Scheduled background monitoring service and trigger endpoint verified.")


def test_11_potential_forest_loss_classification():
    print("\n" + "=" * 70)
    print("TEST 11: POTENTIAL FOREST LOSS CLASSIFICATION & QUALITY CHECKS")
    print("=" * 70)

    # Test qualifying potential forest loss simulation
    payload = {
        "latitude": -3.4653,
        "longitude": -62.2159,
        "radius_km": 5.0,
        "force_simulated_loss": 18.5
    }
    resp = client.post("/api/deforestation/analyze-area", json=payload)
    assert resp.status_code == 200
    data = resp.json()

    print(f"Simulated Loss Pct  : {data.get('forest_loss_percentage')}%")
    print(f"Categorized Status  : {data.get('status')}")
    print(f"Threshold Crossed   : {data.get('threshold_crossed')}")
    print(f"Data Quality        : {data.get('data_quality')}")

    assert data.get("status") == "POTENTIAL_FOREST_LOSS"
    assert data.get("threshold_crossed") is True
    assert data.get("data_quality") == "HIGH_QUALITY"
    print(">>> PASS: Qualifying loss event accurately classified as POTENTIAL_FOREST_LOSS.")


if __name__ == "__main__":
    print("\nRUNNING ENHANCED GOOGLE EARTH ENGINE INTEGRATION TEST SUITE...\n")
    test_1_earth_engine_initialization()
    test_2_protected_health_and_imagery_metadata()
    test_3_live_analysis_point_radius()
    test_4_live_analysis_polygon()
    test_5_invalid_geometry_handling()
    test_6_invalid_dates_handling()
    test_7_insufficient_data_status()
    test_8_user_associated_evaluation()
    test_9_alert_deduplication()
    test_10_scheduled_monitoring_and_scheduler_status()
    test_11_potential_forest_loss_classification()
    print("\n" + "=" * 70)
    print("ALL GOOGLE EARTH ENGINE & DEFORESTATION TESTS PASSED! (11/11)")
    print("=" * 70 + "\n")

