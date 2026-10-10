import smtplib
import datetime
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from backend.config import settings

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

    print("\n" + "=" * 60)
    print(f"PART 9: EMAIL NOTIFICATION DISPATCH -> {recipient_email}")
    print("=" * 60)
    print(f"Subject: {subject}")
    print(message_body)
    print("=" * 60 + "\n")

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
