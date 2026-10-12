"""
Firebase & Firestore Service for Intelligent Forest Monitoring System.
Interacts with the project's Firestore database (wildfire-project-5d6dc) to:
1. Retrieve trusted, verified user email addresses by user UID.
2. Store deforestation and wildfire analysis history.
3. Record alert dispatches and delivery status in Firestore.
4. Provide access to all saved user monitoring areas for scheduled background monitoring.
5. Provide persistent deduplication checking.
"""

import os
import datetime
import httpx
from typing import Dict, Any, Optional, List
from backend.config import settings

FIRESTORE_BASE_URL = f"https://firestore.googleapis.com/v1/projects/{settings.FIREBASE_PROJECT_ID}/databases/(default)/documents"


def _to_firestore_value(val: Any) -> Dict[str, Any]:
    """Encodes a native Python value into Firestore REST value format."""
    if val is None:
        return {"nullValue": None}
    if isinstance(val, bool):
        return {"booleanValue": val}
    if isinstance(val, int):
        return {"integerValue": str(val)}
    if isinstance(val, float):
        return {"doubleValue": val}
    if isinstance(val, str):
        return {"stringValue": val}
    if isinstance(val, list):
        return {"arrayValue": {"values": [_to_firestore_value(i) for i in val]}}
    if isinstance(val, dict):
        return {"mapValue": {"fields": {k: _to_firestore_value(v) for k, v in val.items()}}}
    return {"stringValue": str(val)}


def _from_firestore_value(val: Dict[str, Any]) -> Any:
    """Decodes a Firestore REST value format into a native Python value."""
    if not isinstance(val, dict):
        return None
    if "stringValue" in val:
        return val["stringValue"]
    if "doubleValue" in val:
        return float(val["doubleValue"])
    if "integerValue" in val:
        return int(val["integerValue"])
    if "booleanValue" in val:
        return bool(val["booleanValue"])
    if "nullValue" in val:
        return None
    if "arrayValue" in val:
        return [_from_firestore_value(v) for v in val["arrayValue"].get("values", [])]
    if "mapValue" in val:
        return {k: _from_firestore_value(v) for k, v in val["mapValue"].get("fields", {}).items()}
    if "timestampValue" in val:
        return val["timestampValue"]
    return None


def _doc_to_dict(doc_data: Dict[str, Any]) -> Dict[str, Any]:
    """Converts a Firestore document object to a plain Python dictionary."""
    fields = doc_data.get("fields", {})
    res = {k: _from_firestore_value(v) for k, v in fields.items()}
    # Include doc ID from name path if present
    name = doc_data.get("name", "")
    if name:
        res["_id"] = name.split("/")[-1]
    return res


def get_user_trusted_email(user_id: str) -> Optional[str]:
    """
    Retrieves the verified user email from Firestore `users/{user_id}`.
    Never trusts client-supplied email parameters blindly.
    """
    if not user_id:
        return None
    
    clean_uid = user_id.strip()
    url = f"{FIRESTORE_BASE_URL}/users/{clean_uid}"
    try:
        with httpx.Client(timeout=8.0) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                data = _doc_to_dict(resp.json())
                email = data.get("email")
                if email and isinstance(email, str):
                    return email.strip().lower()
            elif resp.status_code == 404:
                print(f"[Firebase Service] User document not found for UID: {clean_uid}")
    except Exception as e:
        print(f"[Firebase Service] Error retrieving user email for {clean_uid}: {e}")
    
    return None


def get_all_monitored_locations() -> List[Dict[str, Any]]:
    """
    Retrieves all saved forest monitoring areas from Firestore `monitored_locations`.
    Used by the background scheduler to evaluate locations across all users.
    """
    url = f"{FIRESTORE_BASE_URL}/monitored_locations"
    locations = []
    try:
        with httpx.Client(timeout=10.0) as client:
            resp = client.get(url)
            if resp.status_code == 200:
                docs = resp.json().get("documents", [])
                for d in docs:
                    loc = _doc_to_dict(d)
                    if loc.get("lat") is not None and loc.get("lng") is not None:
                        locations.append(loc)
    except Exception as e:
        print(f"[Firebase Service] Error fetching monitored locations: {e}")
    
    return locations


def save_deforestation_analysis(user_id: str, location_id: str, analysis: Dict[str, Any]) -> bool:
    """
    Saves deforestation analysis results in Firestore `deforestation_analyses`
    and updates the latest analysis fields in `monitored_locations/{location_id}`.
    """
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    analysis_id = f"analysis_{location_id}_{int(datetime.datetime.now().timestamp())}"
    
    doc_payload = {
        "userId": user_id,
        "locationId": location_id,
        "analysisId": analysis_id,
        "status": analysis.get("status", "UNKNOWN"),
        "dataQuality": analysis.get("data_quality", "UNKNOWN"),
        "confidenceScore": float(analysis.get("confidence_score", 0.0)),
        "forestLossPercentage": float(analysis.get("forest_loss_percentage", 0.0)),
        "forestLossHectares": float(analysis.get("forest_loss_hectares", 0.0)),
        "baselineNdvi": analysis.get("baseline_ndvi"),
        "comparisonNdvi": analysis.get("comparison_ndvi"),
        "deltaNdvi": analysis.get("ndvi_drop"),
        "totalAreaHectares": float(analysis.get("total_area_hectares", 0.0)),
        "baselineScenesCount": int(analysis.get("baseline_scenes_count", 0)),
        "comparisonScenesCount": int(analysis.get("comparison_scenes_count", 0)),
        "observationDates": analysis.get("observation_dates", {}),
        "analyzedAt": now_iso
    }

    url = f"{FIRESTORE_BASE_URL}/deforestation_analyses/{analysis_id}"
    try:
        fields = {k: _to_firestore_value(v) for k, v in doc_payload.items()}
        with httpx.Client(timeout=8.0) as client:
            resp = client.patch(url, json={"fields": fields})
            if resp.status_code in [200, 201]:
                # Also update latest stats in monitored_locations doc
                loc_url = f"{FIRESTORE_BASE_URL}/monitored_locations/{location_id}"
                loc_update = {
                    "deforestationStatus": analysis.get("status"),
                    "deforestationLossHectares": float(analysis.get("forest_loss_hectares", 0.0)),
                    "deforestationLossPercentage": float(analysis.get("forest_loss_percentage", 0.0)),
                    "baselineNdvi": analysis.get("baseline_ndvi"),
                    "recentNdvi": analysis.get("comparison_ndvi"),
                    "deforestationConfidence": float(analysis.get("confidence_score", 0.0)),
                    "dataQuality": analysis.get("data_quality"),
                    "baselineScenesCount": int(analysis.get("baseline_scenes_count", 0)),
                    "comparisonScenesCount": int(analysis.get("comparison_scenes_count", 0)),
                    "lastAnalyzed": now_iso
                }
                update_fields = {k: _to_firestore_value(v) for k, v in loc_update.items()}
                # Update with mask so existing fields (lat, lng, name) are preserved
                mask_params = "&".join([f"updateMask.fieldPaths={k}" for k in loc_update.keys()])
                client.patch(f"{loc_url}?{mask_params}", json={"fields": update_fields})
                return True
    except Exception as e:
        print(f"[Firebase Service] Error saving deforestation analysis: {e}")
    
    return False


def record_deforestation_alert(
    detection_id: str,
    user_id: str,
    location_id: str,
    location_name: str,
    observation_period: str,
    affected_area_ha: float,
    loss_pct: float,
    recipient_email: str,
    email_delivered: bool,
    confidence_score: float
) -> bool:
    """
    Stores an immutable alert log in `deforestation_alerts` in Firestore.
    Contains detection ID, observation period, estimated affected area,
    user UID, and email delivery status.
    """
    now_iso = datetime.datetime.now(datetime.timezone.utc).isoformat()
    alert_id = f"alert_{detection_id}"
    
    alert_payload = {
        "alertId": alert_id,
        "detectionId": detection_id,
        "userId": user_id,
        "locationId": location_id,
        "locationName": location_name,
        "observationPeriod": observation_period,
        "affectedAreaHectares": float(affected_area_ha),
        "lossPercentage": float(loss_pct),
        "recipientEmail": recipient_email,
        "emailDelivered": email_delivered,
        "confidenceScore": float(confidence_score),
        "status": "POTENTIAL_FOREST_LOSS",
        "createdAt": now_iso
    }

    url = f"{FIRESTORE_BASE_URL}/deforestation_alerts/{alert_id}"
    try:
        fields = {k: _to_firestore_value(v) for k, v in alert_payload.items()}
        with httpx.Client(timeout=8.0) as client:
            resp = client.patch(url, json={"fields": fields})
            return resp.status_code in [200, 201]
    except Exception as e:
        print(f"[Firebase Service] Error recording alert in Firestore: {e}")
    
    return False


def check_existing_alert(detection_id: str) -> bool:
    """Checks whether an alert record already exists in Firestore for the given detection ID."""
    alert_id = f"alert_{detection_id}"
    url = f"{FIRESTORE_BASE_URL}/deforestation_alerts/{alert_id}"
    try:
        with httpx.Client(timeout=6.0) as client:
            resp = client.get(url)
            return resp.status_code == 200
    except Exception:
        return False
