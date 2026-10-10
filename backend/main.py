import asyncio
from fastapi import FastAPI, HTTPException, Depends
from fastapi.middleware.cors import CORSMiddleware
from backend.inference import predictor, PredictionInput
from backend.config import settings
from backend.weather_service import get_weather_provider
from backend.email_service import send_fire_alert_email, mark_location_below_threshold, send_deforestation_alert_email
from backend.ee_service import initialize_ee, detect_deforestation

# Initialize Earth Engine
initialize_ee()

app = FastAPI(
    title="Intelligent Forest Monitoring System - Inference & Alert API",
    description="Backend ML Service for Wildfire Risk Assessment, Weather Integration & Automated Alerts",
    version="1.0.0"
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
        "service": "Wildfire Risk Inference API",
        "model_loaded": predictor.model is not None,
        "configured_threshold": settings.FIRE_RISK_THRESHOLD
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

@app.get("/api/deforestation/detect")
def check_deforestation(lat: float, lng: float, start_date: str = '2022-01-01', end_date: str = '2022-12-31', location_name: str = "Forest Region", recipient_email: str = "user@forestmonitoring.org"):
    """
    Check for deforestation in a given region using Earth Engine.
    """
    result = detect_deforestation(lat, lng, start_date, end_date)
    
    # If there's an error, just return it
    if "error" in result:
        return result
    
    # Check if deforestation was detected and send alert email
    if result.get("deforestation_detected", False):
        send_deforestation_alert_email(
            recipient_email=recipient_email,
            location_name=location_name,
            lat=lat,
            lng=lng,
            ndvi_drop=result.get("ndvi_drop", 0.0)
        )
        result["email_dispatched"] = True
    else:
        result["email_dispatched"] = False
        
    return result

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("backend.main:app", host=settings.HOST, port=settings.PORT, reload=True)
