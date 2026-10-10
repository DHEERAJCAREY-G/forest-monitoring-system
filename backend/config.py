import os
from pydantic_settings import BaseSettings

class Settings:
    # Model Threshold Configuration
    FIRE_RISK_THRESHOLD: float = float(os.getenv("FIRE_RISK_THRESHOLD", "75.0"))
    FIRE_RISK_MEDIUM_THRESHOLD: float = float(os.getenv("FIRE_RISK_MEDIUM_THRESHOLD", "40.0"))

    # Backend Server
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))

    # Weather API Abstraction
    OPENWEATHER_API_KEY: str = os.getenv("OPENWEATHER_API_KEY", "")
    WEATHER_PROVIDER: str = os.getenv("WEATHER_PROVIDER", "open-meteo") # open-meteo or openweathermap

    # Email Alert Configuration (SMTP / Firebase Trigger Email)
    SMTP_HOST: str = os.getenv("SMTP_HOST", "smtp.gmail.com")
    SMTP_PORT: int = int(os.getenv("SMTP_PORT", "587"))
    SMTP_USER: str = os.getenv("SMTP_USER", "")
    SMTP_PASSWORD: str = os.getenv("SMTP_PASSWORD", "")
    ALERT_EMAIL_SENDER: str = os.getenv("ALERT_EMAIL_SENDER", "alerts@forestmonitoring.org")
    ALERT_COOLDOWN_HOURS: int = int(os.getenv("ALERT_COOLDOWN_HOURS", "24"))

    # Firebase Admin SDK Credentials
    FIREBASE_CREDENTIALS_PATH: str = os.getenv("FIREBASE_CREDENTIALS_PATH", "")

    # Google Earth Engine (GEE) & Deforestation Configuration
    GEE_PROJECT_ID: str = os.getenv("GEE_PROJECT_ID", "")
    GEE_SERVICE_ACCOUNT: str = os.getenv("GEE_SERVICE_ACCOUNT", "")
    GEE_PRIVATE_KEY_PATH: str = os.getenv("GEE_PRIVATE_KEY_PATH", "")
    DEFORESTATION_LOSS_THRESHOLD_PERCENT: float = float(os.getenv("DEFORESTATION_LOSS_THRESHOLD_PERCENT", "10.0"))
    DEFORESTATION_NDVI_DROP_THRESHOLD: float = float(os.getenv("DEFORESTATION_NDVI_DROP_THRESHOLD", "0.15"))
    DEFAULT_MONITORING_RADIUS_KM: float = float(os.getenv("DEFAULT_MONITORING_RADIUS_KM", "5.0"))
    BASELINE_WINDOW_DAYS: int = int(os.getenv("BASELINE_WINDOW_DAYS", "180"))
    RECENT_WINDOW_DAYS: int = int(os.getenv("RECENT_WINDOW_DAYS", "30"))

settings = Settings()
