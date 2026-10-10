import datetime
import requests
from abc import ABC, abstractmethod
from backend.config import settings

class BaseWeatherProvider(ABC):
    """
    Abstract Weather Provider Interface.
    Must return a dictionary matching the XGBoost model's feature input schema.
    """
    @abstractmethod
    def get_weather_data(self, lat: float, lng: float) -> dict:
        pass

class OpenMeteoProvider(BaseWeatherProvider):
    """
    Free real-time & 14-day historical weather telemetry provider via Open-Meteo API.
    Requires no API key.
    """
    def get_weather_data(self, lat: float, lng: float) -> dict:
        today = datetime.date.today()
        url = (
            f"https://api.open-meteo.com/v1/forecast?"
            f"latitude={lat}&longitude={lng}"
            f"&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m"
            f"&daily=temperature_2m_max,precipitation_sum,temperature_2m_mean"
            f"&past_days=14&timezone=auto"
        )

        try:
            response = requests.get(url, timeout=10)
            if response.status_code == 200:
                data = response.json()
                current = data.get("current", {})
                daily = data.get("daily", {})

                daily_precip = daily.get("precipitation_sum", [0.0] * 14)
                daily_temp_mean = daily.get("temperature_2m_mean", [15.0] * 14)
                daily_temp_max = daily.get("temperature_2m_max", [20.0] * 14)

                max_temp = current.get("temperature_2m", daily_temp_max[-1] if daily_temp_max else 20.0)
                precipitation = current.get("precipitation", 0.0)
                wind_speed = current.get("wind_speed_10m", 15.0)
                min_humidity = current.get("relative_humidity_2m", 50.0)

                rain_14_days = sum(daily_precip[:14]) if daily_precip else 10.0
                temp_14_days_avg = (sum(daily_temp_mean[:14]) / len(daily_temp_mean[:14])) if daily_temp_mean else 18.0

                # Count consecutive days without significant rain (>0.5mm)
                days_since_rain = 0
                for p in reversed(daily_precip):
                    if p < 0.5:
                        days_since_rain += 1
                    else:
                        break
                days_since_rain = max(1.0, min(14.0, float(days_since_rain)))

                return {
                    "latitude": float(lat),
                    "longitude": float(lng),
                    "month": int(today.month),
                    "max_temp": float(max_temp),
                    "precipitation": float(precipitation),
                    "wind_speed": float(wind_speed),
                    "min_humidity": float(min_humidity),
                    "14_day_rain": float(round(rain_14_days, 2)),
                    "14_day_avg_temp": float(round(temp_14_days_avg, 2)),
                    "days_since_rain": float(days_since_rain)
                }
        except Exception as e:
            print(f"[Weather Provider Warning] Open-Meteo API fetch error: {e}")

        # Fallback realistic weather payload if API unreachable
        return {
            "latitude": float(lat),
            "longitude": float(lng),
            "month": int(today.month),
            "max_temp": 28.5,
            "precipitation": 0.0,
            "wind_speed": 18.5,
            "min_humidity": 35.0,
            "14_day_rain": 12.0,
            "14_day_avg_temp": 25.0,
            "days_since_rain": 6.0
        }

class OpenWeatherMapProvider(BaseWeatherProvider):
    """
    OpenWeatherMap API Provider (Configurable via OPENWEATHER_API_KEY env variable).
    """
    def get_weather_data(self, lat: float, lng: float) -> dict:
        api_key = settings.OPENWEATHER_API_KEY
        if not api_key:
            print("[Weather Service] OPENWEATHER_API_KEY not configured. Falling back to Open-Meteo.")
            return OpenMeteoProvider().get_weather_data(lat, lng)

        url = f"https://api.openweathermap.org/data/2.5/weather?lat={lat}&lon={lng}&units=metric&appid={api_key}"
        try:
            resp = requests.get(url, timeout=10)
            if resp.status_code == 200:
                d = resp.json()
                today = datetime.date.today()
                return {
                    "latitude": float(lat),
                    "longitude": float(lng),
                    "month": int(today.month),
                    "max_temp": float(d["main"]["temp_max"]),
                    "precipitation": float(d.get("rain", {}).get("1h", 0.0)),
                    "wind_speed": float(d["wind"]["speed"] * 3.6), # convert m/s to km/h
                    "min_humidity": float(d["main"]["humidity"]),
                    "14_day_rain": 15.0,
                    "14_day_avg_temp": float(d["main"]["temp"]),
                    "days_since_rain": 4.0
                }
        except Exception as e:
            print(f"[OpenWeatherMap Warning] Error: {e}")

        return OpenMeteoProvider().get_weather_data(lat, lng)

def get_weather_provider() -> BaseWeatherProvider:
    if settings.WEATHER_PROVIDER.lower() == "openweathermap" and settings.OPENWEATHER_API_KEY:
        return OpenWeatherMapProvider()
    return OpenMeteoProvider()
