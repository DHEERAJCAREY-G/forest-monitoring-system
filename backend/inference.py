import os
import json
import joblib
import pandas as pd
import numpy as np
from pydantic import BaseModel, Field
from backend.config import settings

class PredictionInput(BaseModel):
    latitude: float
    longitude: float
    month: int
    max_temp: float
    precipitation: float
    wind_speed: float
    min_humidity: float
    rain_14_day: float = Field(..., alias="14_day_rain")
    avg_temp_14_day: float = Field(..., alias="14_day_avg_temp")
    days_since_rain: float

    class Config:
        populate_by_name = True

class ModelPredictor:
    def __init__(self):
        self.model = None
        self.features = []
        self.load_model()

    def load_model(self):
        model_path = os.path.join("backend", "model", "xgboost_model.joblib")
        metadata_path = os.path.join("backend", "model", "model_metadata.json")

        if not os.path.exists(model_path):
            raise FileNotFoundError(f"Model file not found at {model_path}. Run train_model.py first.")

        self.model = joblib.load(model_path)

        if os.path.exists(metadata_path):
            with open(metadata_path, "r") as f:
                meta = json.load(f)
                self.features = meta.get("features", [])
        else:
            self.features = [
                'latitude', 'longitude', 'month', 'max_temp', 'precipitation',
                'wind_speed', 'min_humidity', '14_day_rain', '14_day_avg_temp', 'days_since_rain'
            ]

    def predict(self, input_data: PredictionInput) -> dict:
        feature_dict = {
            'latitude': input_data.latitude,
            'longitude': input_data.longitude,
            'month': input_data.month,
            'max_temp': input_data.max_temp,
            'precipitation': input_data.precipitation,
            'wind_speed': input_data.wind_speed,
            'min_humidity': input_data.min_humidity,
            '14_day_rain': input_data.rain_14_day,
            '14_day_avg_temp': input_data.avg_temp_14_day,
            'days_since_rain': input_data.days_since_rain
        }

        df_input = pd.DataFrame([feature_dict])[self.features]

        # Model inference probability
        proba = float(self.model.predict_proba(df_input)[0, 1])
        risk_score = int(round(proba * 100))

        # Risk level derived from configured thresholds
        if risk_score >= settings.FIRE_RISK_THRESHOLD:
            risk_level = "HIGH"
        elif risk_score >= settings.FIRE_RISK_MEDIUM_THRESHOLD:
            risk_level = "MEDIUM"
        else:
            risk_level = "LOW"

        return {
            "risk_probability": round(proba, 4),
            "risk_score": risk_score,
            "risk_level": risk_level,
            "threshold_configured": settings.FIRE_RISK_THRESHOLD
        }

predictor = ModelPredictor()
