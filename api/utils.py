import json
import os
from datetime import datetime

DATA_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "data")


def read_json(path, default=None):
    if not os.path.exists(path):
        if default is None:
            return None
        write_json(path, default)
        return default
    with open(path, "r", encoding="utf-8") as f:
        content = f.read().strip()
        if not content:
            if default is None:
                return None
            write_json(path, default)
            return default
        return json.loads(content)


def write_json(path, payload):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    tmp = f"{path}.tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    os.replace(tmp, path)


def format_iso_datetime(value):
    return value.astimezone().isoformat(timespec="seconds")


def parse_iso_datetime(value):
    if isinstance(value, str) and value.endswith("Z"):
        value = value[:-1] + "+00:00"
    return datetime.fromisoformat(value)


def parse_iso_date(value):
    return datetime.fromisoformat(value).date()
