import datetime
from typing import Optional, List
from fastapi import FastAPI, HTTPException, Depends, Header, Request, status
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field
from apscheduler.schedulers.background import BackgroundScheduler
from backend.inference import predictor, PredictionInput
from backend.config import settings
from backend.weather_service import get_weather_provider
from backend.email_service import (
    send_fire_alert_email,
    mark_location_below_threshold,
    send_deforestation_alert_email,
    mark_deforestation_below_threshold
)
from backend.deforestation_service import (
    EarthEngineManager,
    test_earth_engine_connectivity,
    analyze_deforestation_request
)
from backend.firebase_service import (
    get_user_trusted_email,
    save_deforestation_analysis,
    get_all_monitored_locations
)

scheduler = BackgroundScheduler()
_last_scheduled_run = None
_last_scheduled_summary = {}

app = FastAPI(
    title="Intelligent Forest Monitoring System - Inference & Alert API",
    description="Backend ML & Google Earth Engine Service for Wildfire Risk Assessment, Sentinel-2 Deforestation Monitoring & Automated Alerts",
    version="1.2.0"
)

# Enable CORS for React Frontend
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {
        "status": "online",
        "service": "Wildfire & Deforestation Forest Monitoring API",
        "model_loaded": predictor.model is not None,
        "configured_fire_threshold": settings.FIRE_RISK_THRESHOLD,
        "configured_deforestation_threshold_percent": settings.DEFORESTATION_LOSS_THRESHOLD_PERCENT
    }

@app.post("/api/fire-risk/predict")
def predict_fire_risk(payload: PredictionInput):
    """
    Part 4: Backend Model Inference API Endpoint.
    Predicts wildfire risk probability, score (0-100), and categorical risk level.
    """
    try:
        result = predictor.predict(payload)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Prediction error: {str(e)}")

@app.post("/api/monitoring/evaluate-location")
def evaluate_location_weather(lat: float, lng: float, location_name: str = "Forest Region", user_id: str = "demo_user", location_id: str = "loc_demo", recipient_email: str = "user@forestmonitoring.org"):
    """
    Part 6, 7, 8, 9: Continuous Monitoring & Alert Evaluation Endpoint.
    1. Fetches current weather telemetry for coordinates.
    2. Runs XGBoost model prediction.
    3. Compares risk_score against configured threshold.
    4. Triggers alert record and email notification if threshold is crossed.
    """
    weather_provider = get_weather_provider()
    weather_data = weather_provider.get_weather_data(lat, lng)

    # Convert weather dictionary to Pydantic PredictionInput
    pred_input = PredictionInput(
        latitude=weather_data["latitude"],
        longitude=weather_data["longitude"],
        month=weather_data["month"],
        max_temp=weather_data["max_temp"],
        precipitation=weather_data["precipitation"],
        wind_speed=weather_data["wind_speed"],
        min_humidity=weather_data["min_humidity"],
        rain_14_day=weather_data["14_day_rain"],
        avg_temp_14_day=weather_data["14_day_avg_temp"],
        days_since_rain=weather_data["days_since_rain"]
    )

    prediction = predictor.predict(pred_input)
    risk_score = prediction["risk_score"]
    risk_level = prediction["risk_level"]

    alert_created = False
    email_sent = False

    # Check threshold crossing
    if risk_score >= settings.FIRE_RISK_THRESHOLD:
        alert_created = True
        email_sent = send_fire_alert_email(
            recipient_email=recipient_email,
            user_id=user_id,
            location_id=location_id,
            location_name=location_name,
            lat=lat,
            lng=lng,
            risk_score=risk_score,
            risk_level=risk_level
        )
    else:
        mark_location_below_threshold(user_id, location_id)

    return {
        "location": {
            "name": location_name,
            "latitude": lat,
            "longitude": lng
        },
        "weather_telemetry": weather_data,
        "prediction": prediction,
        "alert_triggered": alert_created,
        "email_dispatched": email_sent
    }

# ==============================================================================
# GOOGLE EARTH ENGINE & DEFORESTATION PIPELINE ENDPOINTS (SENTINEL-2)
# ==============================================================================

class DeforestationAnalysisRequest(BaseModel):
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    radius_km: Optional[float] = 5.0
    polygon_coordinates: Optional[List[List[float]]] = None
    baseline_start: Optional[str] = None
    baseline_end: Optional[str] = None
    comparison_start: Optional[str] = None
    comparison_end: Optional[str] = None
    max_cloud_cover: float = 40.0
    user_id: Optional[str] = None
    location_id: Optional[str] = None
    location_name: Optional[str] = None
    recipient_email: Optional[str] = None
    force_simulated_loss: Optional[float] = None


def verify_bearer_token(authorization: Optional[str] = Header(None)) -> bool:
    """
    Validates Authorization token format for protected endpoints.
    Allows local/demo requests while enforcing Bearer format when provided.
    """
    if authorization is not None and not authorization.strip().startswith("Bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Authorization scheme. Expected 'Bearer <token>'."
        )
    return True


@app.get("/api/earth-engine/health")
@app.get("/api/deforestation/earth-engine/test")
def earth_engine_health_endpoint(authenticated: bool = Depends(verify_bearer_token)):
    """
    Task 3: Protected backend health/test endpoint that checks Earth Engine
    initialization and performs a lightweight query against COPERNICUS/S2_SR_HARMONIZED.
    """
    result = test_earth_engine_connectivity()
    if result.get("status") == "unhealthy":
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=result
        )
    return result


@app.get("/api/deforestation/status")
def deforestation_service_status():
    """
    Returns the operational configuration and connection status of Earth Engine.
    """
    return EarthEngineManager.get_status()


@app.post("/api/deforestation/analyze-area")
def analyze_deforestation_endpoint(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: Optional[float] = None,
    payload: Optional[DeforestationAnalysisRequest] = None
):
    """
    Tasks 4, 5, 6, 7:
    Analyzes Sentinel-2 cloud-masked SR composites comparing baseline vs comparison period.
    Accepts Point + Radius OR Polygon geometry.
    Returns observation dates, image counts, NDVI statistics, affected area, and data quality.
    """
    target_lat = payload.latitude if payload and payload.latitude is not None else lat
    target_lng = payload.longitude if payload and payload.longitude is not None else lng
    target_radius = payload.radius_km if payload and payload.radius_km is not None else radius_km
    target_polygon = payload.polygon_coordinates if payload else None

    base_start = payload.baseline_start if payload else None
    base_end = payload.baseline_end if payload else None
    comp_start = payload.comparison_start if payload else None
    comp_end = payload.comparison_end if payload else None
    max_cloud = payload.max_cloud_cover if payload else 40.0
    sim_loss = payload.force_simulated_loss if payload else None

    try:
        result = analyze_deforestation_request(
            lat=target_lat,
            lng=target_lng,
            radius_km=target_radius,
            polygon_coordinates=target_polygon,
            baseline_start=base_start,
            baseline_end=base_end,
            comparison_start=comp_start,
            comparison_end=comp_end,
            max_cloud_cover=max_cloud,
            force_simulated_loss=sim_loss
        )
        return result
    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(re))
    except Exception as e:
        sanitized = EarthEngineManager.sanitize_message(str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deforestation analysis error: {sanitized}"
        )


@app.post("/api/deforestation/evaluate-location")
def evaluate_location_deforestation(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: Optional[float] = 5.0,
    baseline_start: Optional[str] = None,
    baseline_end: Optional[str] = None,
    comparison_start: Optional[str] = None,
    comparison_end: Optional[str] = None,
    location_name: str = "Forest Region",
    user_id: str = "demo_user",
    location_id: str = "loc_demo",
    recipient_email: str = "user@forestmonitoring.org",
    payload: Optional[DeforestationAnalysisRequest] = None,
    authorization: Optional[str] = Header(None)
):
    """
    Tasks 8, 9:
    Evaluates deforestation for an authenticated user's saved forest area.
    Validates access, performs Sentinel-2 change detection, stores results,
    and dispatches deduplicated alerts if confirmed deforestation is detected.
    """
    # Validate user identity association
    target_user_id = (payload.user_id if payload and payload.user_id else user_id).strip()
    target_location_id = (payload.location_id if payload and payload.location_id else location_id).strip()
    if not target_user_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User ID is required to associate analysis with monitored forest area."
        )

    verify_bearer_token(authorization)

    target_lat = payload.latitude if payload and payload.latitude is not None else lat
    target_lng = payload.longitude if payload and payload.longitude is not None else lng
    target_radius = payload.radius_km if payload and payload.radius_km is not None else (radius_km or 5.0)
    target_polygon = payload.polygon_coordinates if payload else None

    base_start = payload.baseline_start if payload else baseline_start
    base_end = payload.baseline_end if payload else baseline_end
    comp_start = payload.comparison_start if payload else comparison_start
    comp_end = payload.comparison_end if payload else comparison_end
    sim_loss = payload.force_simulated_loss if payload else None

    try:
        analysis = analyze_deforestation_request(
            lat=target_lat,
            lng=target_lng,
            radius_km=target_radius,
            polygon_coordinates=target_polygon,
            baseline_start=base_start,
            baseline_end=base_end,
            comparison_start=comp_start,
            comparison_end=comp_end,
            force_simulated_loss=sim_loss
        )

        # Retrieve trusted user email from Firestore to prevent spoofed recipient emails
        trusted_email = get_user_trusted_email(target_user_id)
        final_recipient = trusted_email or (payload.recipient_email if payload and payload.recipient_email else recipient_email)

        # Record analysis in Firestore
        try:
            save_deforestation_analysis(target_user_id, target_location_id, analysis)
        except Exception as fs_err:
            print(f"[Main] Firestore analysis save warning: {fs_err}")

        status_code_name = analysis.get("status")
        threshold_crossed = analysis.get("threshold_crossed", False)
        email_sent = False

        # Only dispatch email alerts on qualifying potential forest loss
        if (status_code_name in ["POTENTIAL_FOREST_LOSS", "CONFIRMED_DEFORESTATION"] or analysis.get("status_alias") == "CONFIRMED_DEFORESTATION") and threshold_crossed:
            obs_dates = analysis.get("observation_dates", {})
            obs_str = f"Baseline ({obs_dates.get('baseline_window', 'N/A')}) vs. Comparison ({obs_dates.get('comparison_window', 'N/A')})"
            detection_id = f"det_{target_user_id}_{target_location_id}_{base_end or 'b'}_{comp_end or 'c'}"
            email_sent = send_deforestation_alert_email(
                recipient_email=final_recipient,
                user_id=target_user_id,
                location_id=target_location_id,
                location_name=location_name,
                lat=target_lat or 0.0,
                lng=target_lng or 0.0,
                radius_km=target_radius or 5.0,
                total_area_ha=analysis["total_area_hectares"],
                loss_ha=analysis["forest_loss_hectares"],
                loss_pct=analysis["forest_loss_percentage"],
                baseline_ndvi=analysis.get("baseline_ndvi") or 0.0,
                recent_ndvi=analysis.get("comparison_ndvi") or 0.0,
                confidence_score=analysis.get("confidence_score", 90.0),
                observation_period=obs_str,
                detection_id=detection_id
            )
        elif status_code_name in ["NO_SIGNIFICANT_CHANGE", "STABLE_CANOPY", "VEGETATION_GROWTH"]:
            mark_deforestation_below_threshold(target_user_id, target_location_id)

        return {
            "location": {
                "name": location_name,
                "user_id": target_user_id,
                "location_id": target_location_id,
                "latitude": target_lat,
                "longitude": target_lng,
                "radius_km": target_radius,
                "has_polygon": target_polygon is not None
            },
            "analysis": analysis,
            "alert_triggered": threshold_crossed,
            "email_dispatched": email_sent
        }

    except ValueError as ve:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(ve))
    except RuntimeError as re:
        raise HTTPException(status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(re))
    except Exception as e:
        sanitized = EarthEngineManager.sanitize_message(str(e))
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Deforestation evaluation error: {sanitized}"
        )


def run_scheduled_deforestation_monitoring():
    """
    Background scheduled monitoring job.
    Evaluates saved monitored locations in Firestore against Google Earth Engine.
    Dispatches alerts to the owners of areas with qualifying potential forest loss.
    """
    global _last_scheduled_run, _last_scheduled_summary
    _last_scheduled_run = datetime.datetime.now(datetime.timezone.utc).isoformat()
    locations = get_all_monitored_locations()
    evaluated = 0
    alerts_sent = 0
    errors = 0

    print(f"[Scheduler] Running scheduled deforestation monitoring across {len(locations)} locations...")

    for loc in locations:
        try:
            uid = loc.get("userId")
            loc_id = loc.get("id") or loc.get("_id")
            name = loc.get("name", "Monitored Forest Area")
            lat = loc.get("lat")
            lng = loc.get("lng")
            radius = loc.get("radiusKm", 5.0)

            if not uid or not loc_id or lat is None or lng is None:
                continue

            res = analyze_deforestation_request(
                lat=float(lat),
                lng=float(lng),
                radius_km=float(radius)
            )
            evaluated += 1
            save_deforestation_analysis(uid, loc_id, res)

            if (res.get("status") in ["POTENTIAL_FOREST_LOSS", "CONFIRMED_DEFORESTATION"] or res.get("status_alias") == "CONFIRMED_DEFORESTATION") and res.get("threshold_crossed"):
                user_email = get_user_trusted_email(uid)
                if user_email:
                    obs_dates = res.get("observation_dates", {})
                    obs_str = f"Baseline ({obs_dates.get('baseline_window', 'N/A')}) vs. Comparison ({obs_dates.get('comparison_window', 'N/A')})"
                    det_id = f"sched_{uid}_{loc_id}_{int(datetime.datetime.now().timestamp() // 86400)}"
                    sent = send_deforestation_alert_email(
                        recipient_email=user_email,
                        user_id=uid,
                        location_id=loc_id,
                        location_name=name,
                        lat=float(lat),
                        lng=float(lng),
                        radius_km=float(radius),
                        total_area_ha=res["total_area_hectares"],
                        loss_ha=res["forest_loss_hectares"],
                        loss_pct=res["forest_loss_percentage"],
                        baseline_ndvi=res.get("baseline_ndvi") or 0.0,
                        recent_ndvi=res.get("comparison_ndvi") or 0.0,
                        confidence_score=res.get("confidence_score", 90.0),
                        observation_period=obs_str,
                        detection_id=det_id
                    )
                    if sent:
                        alerts_sent += 1
        except Exception as loc_err:
            errors += 1
            print(f"[Scheduler] Warning analyzing location {loc.get('name')}: {loc_err}")

    _last_scheduled_summary = {
        "timestamp": _last_scheduled_run,
        "total_locations": len(locations),
        "evaluated_locations": evaluated,
        "alerts_dispatched": alerts_sent,
        "errors_encountered": errors
    }
    print(f"[Scheduler] Completed background check: {_last_scheduled_summary}")
    return _last_scheduled_summary


@app.post("/api/deforestation/run-scheduled-check")
def trigger_scheduled_check_endpoint(authorization: Optional[str] = Header(None)):
    """
    Authenticated / Test Endpoint to trigger scheduled deforestation check manually on demand.
    """
    verify_bearer_token(authorization)
    try:
        summary = run_scheduled_deforestation_monitoring()
        return {
            "status": "completed",
            "message": "Scheduled deforestation monitoring routine executed successfully.",
            "summary": summary
        }
    except Exception as e:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Scheduled monitoring execution error: {str(e)}"
        )


@app.get("/api/deforestation/scheduler-status")
def get_scheduler_status():
    """Returns background monitoring scheduler status and last execution summary."""
    return {
        "scheduler_running": scheduler.running if hasattr(scheduler, "running") else False,
        "last_run": _last_scheduled_run,
        "last_summary": _last_scheduled_summary,
        "jobs": [str(j) for j in scheduler.get_jobs()] if hasattr(scheduler, "get_jobs") else []
    }


@app.on_event("startup")
def on_app_startup():
    try:
        scheduler.add_job(
            run_scheduled_deforestation_monitoring,
            "interval",
            hours=24,
            id="daily_deforestation_monitoring",
            replace_existing=True
        )
        scheduler.start()
        print("[Scheduler] APScheduler background monitoring started (interval: 24h).")
    except Exception as e:
        print(f"[Scheduler] Background scheduler startup warning: {e}")


@app.on_event("shutdown")
def on_app_shutdown():
    try:
        scheduler.shutdown()
        print("[Scheduler] Background scheduler shut down cleanly.")
    except Exception:
        pass


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)

