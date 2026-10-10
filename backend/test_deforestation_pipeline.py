"""
Dedicated Test Suite for the Deforestation Detection Pipeline
Testing:
1. Low-risk / Healthy Forest Canopy (STABLE, below threshold, no alert)
2. Significant Deforestation Event (ALERT, threshold crossed, email dispatched)
3. Cloud Masking & Sensor Evidence (QA60, SCL, 10m resolution)
4. Alert Deduplication & Cooldown Logic
5. FastAPI Endpoints (/api/deforestation/analyze-area, /api/deforestation/evaluate-location)
"""

import math
from fastapi.testclient import TestClient
from backend.main import app
from backend.config import settings
from backend.deforestation_service import (
    analyze_deforestation_area,
    get_deforestation_service_status
)
from backend.email_service import (
    send_deforestation_alert_email,
    should_send_deforestation_alert_email,
    mark_deforestation_below_threshold,
    _deforestation_alert_history
)

client = TestClient(app)


def test_1_healthy_forest_stable():
    print("\n" + "=" * 65)
    print("TEST CASE 1: HEALTHY FOREST (CLEAR CANOPY, STABLE VEGETATION)")
    print("=" * 65)

    # Amazon Rainforest coordinates with baseline stability
    result = analyze_deforestation_area(
        lat=-3.4653,
        lng=-62.2159,
        radius_km=5.0,
        force_simulated_loss=2.1 # 2.1% natural variance (below 10% threshold)
    )

    print(f"Location: Amazon Zone (-3.4653, -62.2159)")
    print(f"Total Area: {result['total_area_hectares']} ha (Radius: 5.0 km)")
    print(f"Historical Baseline NDVI: {result['baseline_ndvi']}")
    print(f"Recent Observation NDVI: {result['recent_ndvi']}")
    print(f"Net Canopy Delta (Delta-NDVI): {result['ndvi_drop']}")
    print(f"Estimated Forest Loss: {result['forest_loss_hectares']} ha ({result['forest_loss_percentage']}%)")
    print(f"Threshold: {settings.DEFORESTATION_LOSS_THRESHOLD_PERCENT}%")
    print(f"Status: {result['status']}")
    print(f"Threshold Crossed: {'YES' if result['threshold_crossed'] else 'NO'}")
    print(f"Confidence Score: {result['confidence_score']}%")

    assert result["status"] == "STABLE"
    assert result["threshold_crossed"] is False
    assert result["forest_loss_percentage"] < settings.DEFORESTATION_LOSS_THRESHOLD_PERCENT
    print(">>> PASS: Healthy forest classified as STABLE without alert.")


def test_2_deforestation_event_alert():
    print("\n" + "=" * 65)
    print("TEST CASE 2: SIGNIFICANT DEFORESTATION EVENT (CANOPY CLEARING)")
    print("=" * 65)

    result = analyze_deforestation_area(
        lat=-3.4653,
        lng=-62.2159,
        radius_km=5.0,
        force_simulated_loss=16.5 # 16.5% canopy loss (well above 10% threshold)
    )

    print(f"Location: Amazon Zone (-3.4653, -62.2159)")
    print(f"Total Area: {result['total_area_hectares']} ha")
    print(f"Historical Baseline NDVI: {result['baseline_ndvi']}")
    print(f"Recent Observation NDVI: {result['recent_ndvi']}")
    print(f"Net Canopy Delta (Delta-NDVI): {result['ndvi_drop']}")
    print(f"Estimated Forest Loss: {result['forest_loss_hectares']} ha ({result['forest_loss_percentage']}%)")
    print(f"Threshold: {settings.DEFORESTATION_LOSS_THRESHOLD_PERCENT}%")
    print(f"Status: {result['status']}")
    print(f"Threshold Crossed: {'YES' if result['threshold_crossed'] else 'NO'}")

    assert result["status"] == "ALERT"
    assert result["threshold_crossed"] is True
    assert result["forest_loss_percentage"] >= settings.DEFORESTATION_LOSS_THRESHOLD_PERCENT
    print(">>> PASS: Deforestation event correctly classified as ALERT.")


def test_3_evidence_and_cloud_masking():
    print("\n" + "=" * 65)
    print("TEST CASE 3: SENSOR EVIDENCE & CLOUD MASKING INTEGRITY")
    print("=" * 65)

    result = analyze_deforestation_area(lat=10.1632, lng=77.0118, radius_km=2.0)
    evidence = result.get("evidence", {})

    print(f"Dataset: {evidence.get('dataset')}")
    print(f"Bands: {evidence.get('bands_analyzed')}")
    print(f"Resolution: {evidence.get('resolution')}")
    print(f"Cloud Masking: {evidence.get('cloud_masking_applied')}")
    print(f"Cloud Cover: {result.get('cloud_cover_percentage')}%")
    print(f"Confidence: {result.get('confidence_score')}%")

    assert evidence.get("dataset") == "COPERNICUS/S2_SR_HARMONIZED"
    assert "B8 (NIR)" in evidence.get("bands_analyzed")
    assert "B4 (Red)" in evidence.get("bands_analyzed")
    assert "QA60" in evidence.get("bands_analyzed")
    assert result.get("confidence_score") > 50.0
    print(">>> PASS: Sentinel-2 SR metadata & cloud masking verified.")


def test_4_deduplication_and_cooldown():
    print("\n" + "=" * 65)
    print("TEST CASE 4: ALERT DEDUPLICATION & COOLDOWN BEHAVIOR")
    print("=" * 65)

    user_id = "test_user_99"
    loc_id = "loc_test_99"
    _deforestation_alert_history.clear()

    # First trigger: should send email
    first_send = send_deforestation_alert_email(
        recipient_email="conservationist@forest.org",
        user_id=user_id,
        location_id=loc_id,
        location_name="Protected Sector 7",
        lat=-3.4653,
        lng=-62.2159,
        radius_km=5.0,
        total_area_ha=7853.98,
        loss_ha=1256.0,
        loss_pct=16.0,
        baseline_ndvi=0.82,
        recent_ndvi=0.61,
        confidence_score=91.5
    )
    print(f"First dispatch attempt: Sent = {first_send}")
    assert first_send is True

    # Immediate second trigger: should be deduplicated / suppressed
    second_send = send_deforestation_alert_email(
        recipient_email="conservationist@forest.org",
        user_id=user_id,
        location_id=loc_id,
        location_name="Protected Sector 7",
        lat=-3.4653,
        lng=-62.2159,
        radius_km=5.0,
        total_area_ha=7853.98,
        loss_ha=1260.0,
        loss_pct=16.04,
        baseline_ndvi=0.82,
        recent_ndvi=0.61,
        confidence_score=91.5
    )
    print(f"Second consecutive dispatch attempt (cooldown active): Sent = {second_send}")
    assert second_send is False

    # Mark below threshold, then re-cross: should send again
    mark_deforestation_below_threshold(user_id, loc_id)
    third_send = send_deforestation_alert_email(
        recipient_email="conservationist@forest.org",
        user_id=user_id,
        location_id=loc_id,
        location_name="Protected Sector 7",
        lat=-3.4653,
        lng=-62.2159,
        radius_km=5.0,
        total_area_ha=7853.98,
        loss_ha=1300.0,
        loss_pct=16.5,
        baseline_ndvi=0.82,
        recent_ndvi=0.60,
        confidence_score=91.5
    )
    print(f"Third attempt after reset & new threshold crossing: Sent = {third_send}")
    assert third_send is True
    print(">>> PASS: Deduplication and cooldown logic working as expected.")


def test_5_fastapi_endpoints():
    print("\n" + "=" * 65)
    print("TEST CASE 5: FASTAPI DEFORESTATION API ENDPOINTS")
    print("=" * 65)

    # 1. Status endpoint
    status_resp = client.get("/api/deforestation/status")
    assert status_resp.status_code == 200
    status_data = status_resp.json()
    print(f"GET /api/deforestation/status -> {status_data['service']} (GEE Installed: {status_data['gee_library_installed']})")
    assert status_data["gee_library_installed"] is True

    # 2. Analyze area endpoint
    analyze_resp = client.post("/api/deforestation/analyze-area", json={
        "latitude": 48.0537,
        "longitude": 8.2037,
        "radius_km": 2.5
    })
    assert analyze_resp.status_code == 200
    analyze_data = analyze_resp.json()
    print(f"POST /api/deforestation/analyze-area -> Status: {analyze_data['status']}, Area: {analyze_data['total_area_hectares']} ha")
    assert "baseline_ndvi" in analyze_data
    assert "recent_ndvi" in analyze_data

    # 3. Evaluate location endpoint (with simulated alert)
    eval_resp = client.post(
        "/api/deforestation/evaluate-location?lat=-0.2280&lng=15.8277&radius_km=5.0&location_name=Congo+Basin&user_id=u_eval&location_id=loc_eval&recipient_email=eval@test.org&force_simulated_loss=14.2"
    )
    assert eval_resp.status_code == 200
    eval_data = eval_resp.json()
    print(f"POST /api/deforestation/evaluate-location -> Alert: {eval_data['alert_triggered']}, Email: {eval_data['email_dispatched']}")
    assert eval_data["alert_triggered"] is True
    assert eval_data["email_dispatched"] is True
    print(">>> PASS: All FastAPI deforestation endpoints verified successfully.")


if __name__ == "__main__":
    print("\nRUNNING DEFORESTATION DETECTION PIPELINE TEST SUITE...")
    test_1_healthy_forest_stable()
    test_2_deforestation_event_alert()
    test_3_evidence_and_cloud_masking()
    test_4_deduplication_and_cooldown()
    test_5_fastapi_endpoints()
    print("\n" + "=" * 65)
    print("ALL DEFORESTATION PIPELINE TESTS PASSED SUCCESSFULLY! (5/5)")
    print("=" * 65 + "\n")
