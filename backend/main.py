import asyncio
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional
from pydantic import BaseModel, Field
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
    analyze_deforestation_area,
    get_deforestation_service_status
)

app = FastAPI(
    title="Intelligent Forest Monitoring System - Inference & Alert API",
    description="Backend ML & Satellite Service for Wildfire Risk Assessment, Sentinel-2 Deforestation Monitoring & Automated Alerts",
    version="1.1.0"
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
# DEFORESTATION DETECTION PIPELINE ENDPOINTS (SENTINEL-2 / GEE)
# ==============================================================================

class DeforestationAnalysisRequest(BaseModel):
    latitude: float = Field(..., ge=-90.0, le=90.0)
    longitude: float = Field(..., ge=-180.0, le=180.0)
    radius_km: float = Field(default=5.0, gt=0.0, le=50.0)
    baseline_days_ago: int = Field(default=180, ge=30)
    recent_days_ago: int = Field(default=30, ge=5)
    force_simulated_loss: Optional[float] = None


@app.get("/api/deforestation/status")
def deforestation_service_status():
    """
    Returns the status and configuration of the Google Earth Engine / Sentinel-2 pipeline.
    """
    return get_deforestation_service_status()


@app.post("/api/deforestation/analyze-area")
def analyze_deforestation_endpoint(
    lat: Optional[float] = None,
    lng: Optional[float] = None,
    radius_km: Optional[float] = 5.0,
    payload: Optional[DeforestationAnalysisRequest] = None
):
    """
    Analyzes Sentinel-2 cloud-masked SR composites comparing baseline vs recent observation.
    Returns NDVI metrics, estimated forest loss (hectares & percentage), and detection evidence.
    """
    target_lat = payload.latitude if payload else lat
    target_lng = payload.longitude if payload else lng
    target_radius = payload.radius_km if payload else (radius_km or 5.0)
    baseline_days = payload.baseline_days_ago if payload else 180
    recent_days = payload.recent_days_ago if payload else 30
    simulated_loss = payload.force_simulated_loss if payload else None

    if target_lat is None or target_lng is None:
        raise HTTPException(status_code=400, detail="Latitude and Longitude are required.")

    try:
        result = analyze_deforestation_area(
            lat=target_lat,
            lng=target_lng,
            radius_km=target_radius,
            baseline_days_ago=baseline_days,
            recent_days_ago=recent_days,
            force_simulated_loss=simulated_loss
        )
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deforestation analysis error: {str(e)}")


@app.post("/api/deforestation/evaluate-location")
def evaluate_location_deforestation(
    lat: float,
    lng: float,
    radius_km: float = 5.0,
    location_name: str = "Forest Region",
    user_id: str = "demo_user",
    location_id: str = "loc_demo",
    recipient_email: str = "user@forestmonitoring.org",
    force_simulated_loss: Optional[float] = None
):
    """
    Comprehensive Deforestation Evaluation & Alert Dispatch.
    1. Analyzes Sentinel-2 NDVI change over the monitored radius.
    2. Compares forest loss against configured threshold.
    3. Dispatches deduplicated alert email if threshold is crossed.
    """
    try:
        analysis = analyze_deforestation_area(
            lat=lat,
            lng=lng,
            radius_km=radius_km,
            force_simulated_loss=force_simulated_loss
        )

        threshold_crossed = analysis["threshold_crossed"]
        email_sent = False

        if threshold_crossed:
            email_sent = send_deforestation_alert_email(
                recipient_email=recipient_email,
                user_id=user_id,
                location_id=location_id,
                location_name=location_name,
                lat=lat,
                lng=lng,
                radius_km=radius_km,
                total_area_ha=analysis["total_area_hectares"],
                loss_ha=analysis["forest_loss_hectares"],
                loss_pct=analysis["forest_loss_percentage"],
                baseline_ndvi=analysis["baseline_ndvi"],
                recent_ndvi=analysis["recent_ndvi"],
                confidence_score=analysis["confidence_score"],
                cloud_cover_pct=analysis["cloud_cover_percentage"]
            )
        else:
            mark_deforestation_below_threshold(user_id, location_id)

        return {
            "location": {
                "name": location_name,
                "latitude": lat,
                "longitude": lng,
                "radius_km": radius_km
            },
            "analysis": analysis,
            "alert_triggered": threshold_crossed,
            "email_dispatched": email_sent
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Deforestation evaluation error: {str(e)}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
