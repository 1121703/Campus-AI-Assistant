import os
from datetime import datetime, timezone, timedelta

from api.utils import read_json, write_json, DATA_DIR

TW_TZ = timezone(timedelta(hours=8))


def handle(method: str, path: str, body: dict | None, params: dict) -> tuple[int, dict]:
    if path == "/api/game/sessions" and method == "POST":
        return _save_session(body)
    if path == "/api/game/settings" and method == "POST":
        return _save_settings(body)
    return 404, {"error": "Unknown game API route."}


def _append_items(filename: str, new_data: dict):
    filepath = os.path.join(DATA_DIR, filename)
    default = {"schema_version": 1, "items": []}
    file_data = read_json(filepath, default=default) or default
    if "items" not in file_data:
        file_data = default
    file_data["items"].append(new_data)
    write_json(filepath, file_data)


def _save_session(body):
    if not body:
        return 400, {"error": "No data provided"}
    body["ended_at"] = datetime.now(TW_TZ).isoformat(timespec="seconds")
    _append_items("game_sessions.json", body)
    return 200, {"status": "success"}


def _save_settings(body):
    if not body:
        return 400, {"error": "No data provided"}
    body["updated_at"] = datetime.now(TW_TZ).isoformat(timespec="seconds")
    _append_items("game_settings.json", body)
    return 200, {"status": "success"}
