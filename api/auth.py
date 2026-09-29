import hashlib
import os
from datetime import datetime

from api.utils import read_json, write_json, DATA_DIR, format_iso_datetime, parse_iso_datetime


def handle(method: str, path: str, body: dict | None, params: dict) -> tuple[int, dict]:
    if method != "POST":
        return 405, {"error": "Method Not Allowed"}
    if body is None:
        return 400, {"error": "無效的請求內容。"}

    if path == "/api/auth/register":
        return _do_register(body)
    if path == "/api/auth/login":
        return _do_login(body)
    if path == "/api/auth/logout":
        return _do_logout(body)

    return 404, {"error": "Unknown auth route."}


# ---------- helpers ----------

def _hash_password(password):
    return "sha256:" + hashlib.sha256(password.encode("utf-8")).hexdigest()


def _next_user_id(users):
    max_num = 0
    for item in users.get("items", []):
        uid = item.get("user_id", "")
        if uid.startswith("u_"):
            try:
                max_num = max(max_num, int(uid[2:]))
            except ValueError:
                pass
    return f"u_{max_num + 1:04d}"


def _next_session_id(sessions):
    max_num = 0
    for item in sessions.get("items", []):
        sid = item.get("session_id", "")
        if sid.startswith("s_"):
            try:
                max_num = max(max_num, int(sid[2:]))
            except ValueError:
                pass
    return f"s_{max_num + 1:04d}"


# ---------- routes ----------

def _do_register(body):
    name     = (body.get("name") or "").strip()
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not name or not email or not password:
        return 400, {"error": "姓名、Email、密碼為必填。"}
    if len(password) < 8:
        return 400, {"error": "密碼至少需要 8 個字元。"}

    users_path = os.path.join(DATA_DIR, "users.json")
    users = read_json(users_path, {"schema_version": 1, "items": []})

    for user in users.get("items", []):
        if user.get("email", "").lower() == email:
            return 409, {"error": "此 Email 已被註冊。"}

    new_user = {
        "user_id":       _next_user_id(users),
        "name":          name,
        "email":         email,
        "password_hash": _hash_password(password),
        "created_at":    format_iso_datetime(datetime.now())
    }
    users["items"].append(new_user)
    write_json(users_path, users)

    return 201, {
        "user_id":    new_user["user_id"],
        "name":       new_user["name"],
        "email":      new_user["email"],
        "created_at": new_user["created_at"]
    }


def _do_login(body):
    email    = (body.get("email") or "").strip().lower()
    password = body.get("password") or ""

    if not email or not password:
        return 400, {"error": "請填寫 Email 和密碼。"}

    users_path = os.path.join(DATA_DIR, "users.json")
    users = read_json(users_path, {"schema_version": 1, "items": []})

    matched = next(
        (u for u in users.get("items", []) if u.get("email", "").lower() == email),
        None
    )
    if not matched or matched.get("password_hash") != _hash_password(password):
        return 401, {"error": "Email 或密碼錯誤。"}

    sessions_path = os.path.join(DATA_DIR, "login_sessions.json")
    sessions = read_json(sessions_path, {"schema_version": 1, "items": []})

    new_session = {
        "session_id":   _next_session_id(sessions),
        "user_id":      matched["user_id"],
        "login_at":     format_iso_datetime(datetime.now()),
        "logout_at":    None,
        "duration_sec": None,
        "active":       True
    }
    sessions["items"].append(new_session)
    write_json(sessions_path, sessions)

    return 200, {
        "session_id": new_session["session_id"],
        "user_id":    matched["user_id"],
        "name":       matched["name"],
        "login_at":   new_session["login_at"]
    }


def _do_logout(body):
    session_id = body.get("session_id") or ""
    if not session_id:
        return 400, {"error": "session_id 為必填。"}

    sessions_path = os.path.join(DATA_DIR, "login_sessions.json")
    sessions = read_json(sessions_path, {"schema_version": 1, "items": []})

    session = next(
        (s for s in sessions.get("items", []) if s.get("session_id") == session_id),
        None
    )
    if session and session.get("active"):
        logout_at = datetime.now()
        login_at  = parse_iso_datetime(session["login_at"])
        session["logout_at"]    = format_iso_datetime(logout_at)
        session["duration_sec"] = max(0, int((logout_at - login_at).total_seconds()))
        session["active"]       = False
        write_json(sessions_path, sessions)

    return 200, {"ok": True}
