"""
backend/iot_engine.py
IoT wearable device management for MedConnect.

Supports: smartwatch, BP monitor, pulse oximeter, custom ESP32/Arduino devices.
Devices authenticate with an API key issued at registration time.
Data is stored in Supabase vitals table with source='iot_*' for real-time push.
"""

import os
import json
import uuid
import hashlib
import logging
import datetime
from typing import Optional

logger = logging.getLogger(__name__)

# ── In-memory device store (fallback when Supabase is not configured) ─────────
_devices: dict = {}  # api_key → device info

# ── Device Types ──────────────────────────────────────────────────────────────
DEVICE_TYPES = {
    "smartwatch":  {"label": "Smart Watch",     "emoji": "⌚", "metrics": ["heart_rate","spo2","respiratory_rate","temperature_f","step_count","sleep_hours","calories_burned","distance_m"]},
    "health_framework": {"label": "Native Health", "emoji": "📱", "metrics": ["heart_rate","spo2","step_count","sleep_hours","calories_burned","distance_m","activity_workouts"]},
    "bp_monitor":  {"label": "BP Monitor",      "emoji": "💊", "metrics": ["systolic_bp","diastolic_bp","heart_rate"]},
    "oximeter":    {"label": "Pulse Oximeter",  "emoji": "🩸", "metrics": ["spo2","heart_rate"]},
    "custom":      {"label": "Custom Device",   "emoji": "🔧", "metrics": ["heart_rate","systolic_bp","diastolic_bp","spo2","temperature_f","respiratory_rate"]},
}

# ── Helper ────────────────────────────────────────────────────────────────────
def _generate_api_key(device_id: str) -> str:
    """Generate a deterministic but secure API key for a device."""
    secret = os.environ.get("JWT_SECRET", "medconnect_iot_secret")
    raw = f"{device_id}:{secret}:{uuid.uuid4()}"
    return "mck_" + hashlib.sha256(raw.encode()).hexdigest()[:40]


def _now_iso() -> str:
    return datetime.datetime.utcnow().isoformat() + "Z"


# ── Device Registration ───────────────────────────────────────────────────────
def register_device(patient_id: str, device_type: str, device_name: str) -> dict:
    """
    Register a new IoT device for a patient.
    Returns the device record including the API key (shown once).
    """
    # Limit to 3 devices per patient
    existing = list_devices(patient_id)
    active_count = len([d for d in existing if d.get("is_active")])
    if active_count >= 3:
        raise ValueError("Patient already has the maximum (3) IoT devices registered. Please remove an old device first.")

    device_id = f"{device_type}_{patient_id}_{uuid.uuid4().hex[:8]}"
    api_key   = _generate_api_key(device_id)

    device = {
        "id":           device_id,
        "patient_id":   patient_id,
        "device_type":  device_type,
        "device_name":  device_name or DEVICE_TYPES[device_type]["label"],
        "api_key":      api_key,
        "is_active":    True,
        "last_seen":    None,
        "battery_pct":  100,
        "firmware":     "1.0.0",
        "registered_at": _now_iso(),
        "supported_metrics": DEVICE_TYPES[device_type]["metrics"],
    }

    # Save to local cache
    _devices[api_key] = device

    # Try Supabase
    try:
        from database import get_client
        sb = get_client()
        if sb:
            sb.table("iot_devices").insert({
                k: v for k, v in device.items() if k != "supported_metrics"
            }).execute()
    except Exception as e:
        logger.warning(f"Supabase device store failed: {e}")

    return device


def authenticate_device(api_key: str) -> Optional[dict]:
    """Validate an API key and return the device record."""
    # Check local cache first
    if api_key in _devices:
        return _devices[api_key]

    # Check Supabase
    try:
        from database import get_client
        sb = get_client()
        if sb:
            res = sb.table("iot_devices").select("*").eq("api_key", api_key).eq("is_active", True).limit(1).execute()
            if res.data:
                device = res.data[0]
                _devices[api_key] = device  # cache it
                return device
    except Exception as e:
        logger.warning(f"Device auth lookup failed: {e}")

    return None


def list_devices(patient_id: str) -> list:
    """List all devices registered for a patient."""
    devices = []

    # Try Supabase
    try:
        from database import get_client
        sb = get_client()
        if sb:
            res = sb.table("iot_devices").select("id,patient_id,device_type,device_name,is_active,last_seen,battery_pct,firmware,registered_at").eq("patient_id", patient_id).execute()
            return res.data or []
    except Exception as e:
        logger.warning(f"Device list failed: {e}")

    # Local cache fallback
    return [d for d in _devices.values() if d.get("patient_id") == patient_id]


def deregister_device(device_id: str) -> bool:
    """Deactivate a device."""
    try:
        from database import get_client
        sb = get_client()
        if sb:
            sb.table("iot_devices").update({"is_active": False}).eq("id", device_id).execute()
    except Exception as e:
        logger.warning(f"Device deregister failed: {e}")

    # Remove from cache
    _devices = {k: v for k, v in _devices.items() if v.get("id") != device_id}
    return True


def update_device_heartbeat(api_key: str, battery_pct: Optional[int] = None, firmware: Optional[str] = None):
    """Update last_seen and battery for a device."""
    patch = {"last_seen": _now_iso()}
    if battery_pct is not None:
        patch["battery_pct"] = battery_pct
    if firmware:
        patch["firmware"] = firmware

    if api_key in _devices:
        _devices[api_key].update(patch)

    try:
        from database import get_client
        sb = get_client()
        if sb:
            sb.table("iot_devices").update(patch).eq("api_key", api_key).execute()
    except Exception as e:
        logger.warning(f"Heartbeat update failed: {e}")


# ── IoT Data Ingestion ────────────────────────────────────────────────────────
def ingest_iot_reading(device: dict, reading: dict) -> dict:
    """
    Process a vitals reading from an IoT device.
    Stores in Supabase (triggers Realtime push to caretaker) and local file.
    Returns the analysis result from vitals_engine.
    """
    patient_id  = device["patient_id"]
    device_id   = device["id"]
    device_type = device["device_type"]
    source      = f"iot_{device_type}"

    # Enrich reading with source metadata
    enriched = {
        **reading,
        "patient_id":  patient_id,
        "device_id":   device_id,
        "source":      source,
        "recorded_at": _now_iso(),
    }

    # Store to Supabase vitals (triggers Realtime push)
    try:
        from database import get_client
        sb = get_client()
        if sb:
            row = {
                "patient_id":       patient_id,
                "device_id":        device_id,
                "source":           source,
                "heart_rate":       reading.get("heart_rate"),
                "systolic_bp":      reading.get("systolic_bp"),
                "diastolic_bp":     reading.get("diastolic_bp"),
                "spo2":             reading.get("spo2"),
                "temperature_f":    reading.get("temperature_f"),
                "respiratory_rate": reading.get("respiratory_rate"),
                "step_count":       reading.get("step_count"),
                "sleep_hours":      reading.get("sleep_hours"),
                "calories_burned":  reading.get("calories_burned"),
                "distance_m":       reading.get("distance_m"),
                "latitude":         reading.get("latitude"),
                "longitude":        reading.get("longitude"),
                "battery_pct":      reading.get("battery_pct"),
                "source_device_model": reading.get("source_device_model"),
                "is_validated":     reading.get("is_validated", True),
                "recorded_at":      enriched["recorded_at"],
            }
            sb.table("vitals").insert({k: v for k, v in row.items() if v is not None}).execute()
            logger.info(f"IoT reading stored for {patient_id} from {device_id}")
    except Exception as e:
        logger.error(f"IoT Supabase store error: {e}")

    # Also run through vitals analysis engine
    try:
        from vitals_engine import check_all_thresholds, analyze_trend, generate_risk_flags, validate_reading
        from app import _load_vitals_store, _save_vitals_store

        store = _load_vitals_store()
        if patient_id not in store:
            store[patient_id] = {}
        metrics = [
            "heart_rate", "systolic_bp", "diastolic_bp", "spo2", "temperature_f", 
            "respiratory_rate", "step_count", "sleep_hours", "calories_burned", "distance_m"
        ]
        
        # Validation checks
        validated_reading = {k: v for k, v in reading.items() if k in metrics}
        for m, v in list(validated_reading.items()):
            if not validate_reading(m, v):
                logger.warning(f"Rejecting unrealistic {m}: {v}")
                validated_reading.pop(m)

        for m, v in validated_reading.items():
            store[patient_id].setdefault(m, [])
            store[patient_id][m].append({"value": v, "ts": enriched["recorded_at"]})
            store[patient_id][m] = store[patient_id][m][-100:]
        _save_vitals_store(store)

        thresholds = check_all_thresholds(validated_reading)
        risk_flags = generate_risk_flags(validated_reading, [], thresholds)
        
        # ACTUALLY TRIGGER EMERGENCY if critical
        auto_emergency_triggered = False
        for t in thresholds:
            is_auto = t.get("auto_emergency") if isinstance(t, dict) else getattr(t, "auto_emergency", False)
            if is_auto:
                try:
                    from emergency_engine import trigger_emergency
                    msg = t.get("message") if isinstance(t, dict) else getattr(t, "message", "Critical VITALS")
                    trigger_emergency(
                        patient_id=patient_id,
                        trigger_source="VITALS_CRITICAL",
                        medical_context=msg,
                        vitals_snapshot=reading
                    )
                    auto_emergency_triggered = True
                    break
                except Exception as ee:
                    logger.error(f"Failed to auto-trigger emergency: {ee}")

        return {
            "status":        "ok",
            "patient_id":    patient_id,
            "device_id":     device_id,
            "source":        source,
            "timestamp":     enriched["recorded_at"],
            "thresholds":    [t.__dict__ if hasattr(t, '__dict__') else t for t in thresholds],
            "risk_flags":    [r.__dict__ if hasattr(r, '__dict__') else r for r in risk_flags],
            "auto_emergency_triggered": auto_emergency_triggered,
        }
    except Exception as e:
        logger.warning(f"Analysis engine error: {e}")
        return {"status": "ok", "patient_id": patient_id, "device_id": device_id, "timestamp": enriched["recorded_at"]}
