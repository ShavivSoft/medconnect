import os
import json
import logging
import datetime

logger = logging.getLogger("medconnect.storage")

_DIR = os.path.dirname(os.path.abspath(__file__))
VITALS_STORE_FILE = os.path.join(_DIR, "vitals_store.json")

def _load_json(path, default):
    try:
        if os.path.exists(path):
            with open(path, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return default

def _save_json(path, data):
    try:
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, default=str)
    except Exception as e:
        logger.error(f"Save failed {path}: {e}")

def _load_vitals_store():
    return _load_json(VITALS_STORE_FILE, {})

def _save_vitals_store(data):
    _save_json(VITALS_STORE_FILE, data)
