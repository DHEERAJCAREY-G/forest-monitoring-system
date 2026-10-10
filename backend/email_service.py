import smtplib
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.config import settings

def _safe_print(text: str):
    """Safely print text handling Windows console encoding limitations (e.g. cp1252)."""
    try:
        print(text)
    except UnicodeEncodeError:
        print(text.encode('ascii', errors='replace').decode('ascii'))

# In-memory / persistent track record for alert deduplication
# Key: f"{user_id}_{location_id}", Value: { "last_alert_time": datetime, "last_risk_score": float }
_alert_history = {}

def should_send_alert_email(user_id: str, location_id: str, current_risk_score: float) -> bool:
    """
    Deduplication Logic: Returns True if alert email should be sent, False if within cooldown.
    """
    key = f"{user_id}_{location_id}"
    now = datetime.datetime.now(datetime.timezone.utc)

    if key not in _alert_history:
        _alert_history[key] = {
            "last_alert_time": now,
            "last_risk_score": current_risk_score,
            "above_threshold": True
        }
        return True

    record = _alert_history[key]
    last_time = record.get("last_alert_time")
    cooldown_delta = datetime.timedelta(hours=settings.ALERT_COOLDOWN_HOURS)

    # If risk dropped below threshold previously and now crossed again
    if not record.get("above_threshold", False):
        record["last_alert_time"] = now
        record["last_risk_score"] = current_risk_score
        record["above_threshold"] = True
        return True

    # If cooldown period has elapsed since last email
    if now - last_time >= cooldown_delta:
        record["last_alert_time"] = now
        record["last_risk_score"] = current_risk_score
        return True

    return False

def mark_location_below_threshold(user_id: str, location_id: str):
    """Call when a location's risk drops below the threshold to reset alert state."""
    key = f"{user_id}_{location_id}"
    if key in _alert_history:
        _alert_history[key]["above_threshold"] = False

def send_fire_alert_email(
    recipient_email: str,
    user_id: str,
    location_id: str,
    location_name: str,
    lat: float,
    lng: float,
    risk_score: int,
    risk_level: str
) -> bool:
    """
    Sends a Fire Risk Email notification with alert deduplication checks.
    """
    if not should_send_alert_email(user_id, location_id, float(risk_score)):
        print(f"[Email Service] Alert email suppressed for {location_name} (Location ID: {location_id}) - Cooldown Active.")
        return False

    timestamp_str = datetime.datetime.now().strftime("%d %b %Y, %I:%M %p")
    subject = "⚠️ Forest Fire Risk Alert"

    message_body = f"""An elevated fire-risk condition has been detected in one of your monitored forest areas.

Location: {location_name} ({lat:.6f}, {lng:.6f})
Risk Score: {risk_score}%
Risk Level: {risk_level}
Detected: {timestamp_str}

Please review the monitoring dashboard for more information.
"""

    _safe_print("\n" + "=" * 60)
    _safe_print(f"PART 9: EMAIL NOTIFICATION DISPATCH -> {recipient_email}")
    _safe_print("=" * 60)
    _safe_print(f"Subject: {subject}")
    _safe_print(message_body)
    _safe_print("=" * 60 + "\n")

    # Send SMTP Email if SMTP credentials are fully provided
    if settings.SMTP_USER and settings.SMTP_PASSWORD:
        try:
            msg = MIMEMultipart()
            msg['From'] = settings.ALERT_EMAIL_SENDER
            msg['To'] = recipient_email
            msg['Subject'] = subject
            msg.attach(MIMEText(message_body, 'plain'))

            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()
            print(f"[Email Service] Successfully sent SMTP email to {recipient_email}")
        except Exception as e:
            print(f"[Email Service SMTP Error] {e}")

    return True


# Dedicated alert deduplication tracking for deforestation
_deforestation_alert_history = {}

def should_send_deforestation_alert_email(user_id: str, location_id: str, current_loss_pct: float) -> bool:
    """
    Deduplication logic for Deforestation Alerts with configurable cooldown.
    """
    key = f"deforest_{user_id}_{location_id}"
    now = datetime.datetime.now(datetime.timezone.utc)

    if key not in _deforestation_alert_history:
        _deforestation_alert_history[key] = {
            "last_alert_time": now,
            "last_loss_pct": current_loss_pct,
            "above_threshold": True
        }
        return True

    record = _deforestation_alert_history[key]
    last_time = record.get("last_alert_time")
    cooldown_delta = datetime.timedelta(hours=settings.ALERT_COOLDOWN_HOURS)

    # If status was previously reset/cleared and threshold crossed again
    if not record.get("above_threshold", False):
        record["last_alert_time"] = now
        record["last_loss_pct"] = current_loss_pct
        record["above_threshold"] = True
        return True

    # If cooldown period has elapsed
    if now - last_time >= cooldown_delta:
        record["last_alert_time"] = now
        record["last_loss_pct"] = current_loss_pct
        return True

    return False


def mark_deforestation_below_threshold(user_id: str, location_id: str):
    """Resets alert state when forest canopy stabilizes below deforestation threshold."""
    key = f"deforest_{user_id}_{location_id}"
    if key in _deforestation_alert_history:
        _deforestation_alert_history[key]["above_threshold"] = False


def send_deforestation_alert_email(
    recipient_email: str,
    user_id: str,
    location_id: str,
    location_name: str,
    lat: float,
    lng: float,
    radius_km: float,
    total_area_ha: float,
    loss_ha: float,
    loss_pct: float,
    baseline_ndvi: float,
    recent_ndvi: float,
    confidence_score: float,
    cloud_cover_pct: float = 10.0
) -> bool:
    """
    Sends a Deforestation Alert Email notification comparing Sentinel-2 baseline vs. recent NDVI.
    Applies deduplication cooldown to prevent notification fatigue.
    """
    if not should_send_deforestation_alert_email(user_id, location_id, float(loss_pct)):
        print(f"[Email Service] Deforestation alert email suppressed for {location_name} (Location ID: {location_id}) - Cooldown Active.")
        return False

    timestamp_str = datetime.datetime.now().strftime("%d %b %Y, %I:%M %p")
    subject = "🚨 Forest Deforestation Alert — Monitored Area"

    message_body = f"""Significant canopy reduction and deforestation activity has been detected in one of your monitored forest areas via Sentinel-2 satellite analysis.

MONITORED ZONE:
• Location: {location_name}
• Center Coordinates: {lat:.6f}, {lng:.6f}
• Monitoring Radius: {radius_km:.1f} km
• Total Monitored Area: {total_area_ha:,.2f} hectares

DEFORESTATION ANALYSIS:
• Estimated Forest Loss: {loss_ha:,.2f} hectares ({loss_pct:.2f}% of monitored zone)
• Historical Baseline NDVI: {baseline_ndvi:.4f}
• Recent Observation NDVI: {recent_ndvi:.4f}
• Net Canopy Drop (Delta-NDVI): {max(0.0, baseline_ndvi - recent_ndvi):.4f}
• Detection Confidence: {confidence_score:.1f}%
• Cloud Cover During Observation: {cloud_cover_pct:.1f}%
• Analysis Timestamp: {timestamp_str}

Please review your interactive forest monitoring dashboard for detailed satellite overlays and risk metrics.
"""

    _safe_print("\n" + "=" * 60)
    _safe_print(f"DEFORESTATION ALERT NOTIFICATION DISPATCH -> {recipient_email}")
    _safe_print("=" * 60)
    _safe_print(f"Subject: {subject}")
    _safe_print(message_body)
    _safe_print("=" * 60 + "\n")

    # Send SMTP Email if SMTP credentials are provided
    if settings.SMTP_USER and settings.SMTP_PASSWORD:
        try:
            msg = MIMEMultipart()
            msg['From'] = settings.ALERT_EMAIL_SENDER
            msg['To'] = recipient_email
            msg['Subject'] = subject
            msg.attach(MIMEText(message_body, 'plain'))

            server = smtplib.SMTP(settings.SMTP_HOST, settings.SMTP_PORT)
            server.starttls()
            server.login(settings.SMTP_USER, settings.SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()
            print(f"[Email Service] Successfully sent Deforestation SMTP email to {recipient_email}")
        except Exception as e:
            print(f"[Email Service SMTP Error] {e}")

    return True
