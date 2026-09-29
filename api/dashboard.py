import json
import os
import urllib.request
import urllib.error
from datetime import datetime, timedelta

from api.utils import read_json, write_json, DATA_DIR, format_iso_datetime, parse_iso_datetime, parse_iso_date

ALLOWED_FILES = {
    "calendar_tasks.json",
    "daily_suggestions.json",
    "dashboard_actions_log.json",
    "dashboard_metrics_weekly.json",
    "dashboard_state.json",
    "login_sessions.json",
}


def handle(method: str, path: str, body: dict | None, params: dict) -> tuple[int, dict]:
    if path == "/api/health":
        return 200, {"status": "ok"}

    if path.startswith("/api/data/"):
        return _handle_data(method, path, body)

    if path == "/api/daily-suggestions" and method == "GET":
        return _handle_daily_suggestions(params)

    if path == "/api/dashboard/metrics" and method == "GET":
        return _handle_dashboard_metrics(params)

    return 404, {"error": "Unknown API route."}


# ---------- /api/data/ ----------

def _normalize_file_name(file_name):
    safe_name = os.path.basename(file_name)
    return safe_name if safe_name in ALLOWED_FILES else None


def _handle_data(method, path, body):
    file_name = _normalize_file_name(path.replace("/api/data/", "", 1))
    if not file_name:
        return 404, {"error": "Unsupported data file."}
    data_path = os.path.join(DATA_DIR, file_name)

    if method == "GET":
        data = read_json(data_path)
        if data is None:
            return 404, {"error": "Data file not found."}
        return 200, data

    if method in ("POST", "PUT"):
        if not body:
            return 400, {"error": "Empty request body."}
        if not isinstance(body, dict) or "schema_version" not in body or "items" not in body:
            return 400, {"error": "Payload must include schema_version and items."}
        write_json(data_path, body)
        return 200, body

    return 405, {"error": "Method Not Allowed"}


# ---------- /api/daily-suggestions ----------

def _handle_daily_suggestions(params):
    user_id    = (params.get("user_id") or [None])[0]
    date_value = (params.get("date") or [None])[0]
    if not user_id:
        return 400, {"error": "user_id is required."}
    if not date_value:
        date_value = datetime.now().date().isoformat()

    data_path = os.path.join(DATA_DIR, "daily_suggestions.json")
    data = read_json(data_path, {"schema_version": 1, "items": []})
    entry = next(
        (item for item in data.get("items", [])
         if item.get("user_id") == user_id and item.get("date") == date_value),
        None
    )
    if not entry:
        try:
            entry = _build_daily_suggestions(user_id, date_value)
        except (urllib.error.URLError, ValueError, KeyError, IndexError, json.JSONDecodeError) as exc:
            return 502, {"error": f"Daily suggest generation failed: {exc}"}
        data["items"].append(entry)
        write_json(data_path, data)
    return 200, data


def _build_daily_suggestions(user_id, target_date):
    tasks_data = read_json(os.path.join(DATA_DIR, "calendar_tasks.json"), {"schema_version": 1, "items": []})
    tasks = [
        t for t in tasks_data.get("items", [])
        if t.get("user_id") == user_id and t.get("status") != "completed"
    ]
    use_local = os.getenv("USE_LOCAL_MODEL", "").lower() in {"1", "true", "yes"}
    if use_local:
        task_lines = "\n".join(
            f"- {t.get('title')}（截止 {t.get('due_at', '未定')}）" for t in tasks[:5]
        ) or "- 目前沒有待辦工作"
        prompt = (
            "請根據以下待辦清單，產生 3 條 Daily Suggest。\n"
            "請只輸出 JSON 陣列，例如：[\"...\", \"...\"]。\n"
            f"日期：{target_date}\n待辦清單：\n{task_lines}"
        )
        suggestions = _call_local_model(prompt)
        source = "local_model"
    else:
        suggestions = _generate_rule_based_suggestions(tasks)
        source = "rule_based"
    return {
        "date":        target_date,
        "user_id":     user_id,
        "suggestions": suggestions,
        "source":      source,
        "status":      "active",
        "feedback":    {"done": 0, "skipped": 0},
        "created_at":  format_iso_datetime(datetime.now())
    }


def _generate_rule_based_suggestions(tasks):
    upcoming = sorted(tasks, key=lambda t: t.get("due_at") or "")[:2]
    suggestions = []
    if upcoming:
        first = upcoming[0]["title"]
        suggestions.append(f"先完成 {first} 的重點整理")
        if len(upcoming) > 1:
            second = upcoming[1]["title"]
            suggestions.append(f"安排 30 分鐘檢查 {second} 的進度")
    if not suggestions:
        suggestions = ["安排 30 分鐘複習本週重點", "整理明天的待辦清單"]
    return suggestions


def _call_local_model(prompt):
    base_url = os.getenv("LOCAL_LLM_URL", "http://localhost:11434/v1").rstrip("/")
    model    = os.getenv("LOCAL_LLM_MODEL", "gemma3:4b")
    url      = f"{base_url}/chat/completions"
    payload  = {
        "model":    model,
        "messages": [
            {"role": "system", "content": "你是校園 AI 助手，請使用繁體中文。"},
            {"role": "user",   "content": prompt}
        ],
        "temperature": 0.7
    }
    data    = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(
        url, data=data,
        headers={"Content-Type": "application/json"},
        method="POST"
    )
    with urllib.request.urlopen(request, timeout=20) as resp:
        result = json.loads(resp.read().decode("utf-8"))
    content     = result["choices"][0]["message"]["content"].strip()
    suggestions = json.loads(content)
    if not isinstance(suggestions, list) or not suggestions:
        raise ValueError("Model output is not a valid suggestion list.")
    return [str(item).strip() for item in suggestions if str(item).strip()]


# ---------- /api/dashboard/metrics ----------

def _handle_dashboard_metrics(params):
    user_id          = (params.get("user_id") or [None])[0]
    week_start_value = (params.get("week_start") or [None])[0]
    if not user_id:
        return 400, {"error": "user_id is required."}
    if week_start_value:
        week_start = parse_iso_date(week_start_value)
    else:
        today = datetime.now().date()
        week_start = today - timedelta(days=today.weekday())

    entry        = _compute_metrics(user_id, week_start)
    metrics_path = os.path.join(DATA_DIR, "dashboard_metrics_weekly.json")
    metrics_data = read_json(metrics_path, {"schema_version": 1, "items": []})
    items        = metrics_data.get("items", [])
    existing     = next(
        (item for item in items
         if item.get("user_id") == user_id and item.get("week_start") == entry["week_start"]),
        None
    )
    if existing:
        existing.update(entry)
    else:
        items.append(entry)
    metrics_data["items"] = items
    write_json(metrics_path, metrics_data)
    return 200, entry


def _compute_metrics(user_id, week_start):
    tasks_data    = read_json(os.path.join(DATA_DIR, "calendar_tasks.json"), {"schema_version": 1, "items": []})
    sessions_data = read_json(os.path.join(DATA_DIR, "login_sessions.json"), {"schema_version": 1, "items": []})
    login_seconds = [0] * 7
    completed     = [0] * 7
    total         = [0] * 7
    now           = datetime.now().astimezone()

    for session in sessions_data.get("items", []):
        if session.get("user_id") != user_id:
            continue
        login_at_value = session.get("login_at")
        if not login_at_value:
            continue
        login_at = parse_iso_datetime(login_at_value)
        if login_at.tzinfo is not None:
            login_at = login_at.astimezone()
        index = (login_at.date() - week_start).days
        if index < 0 or index > 6:
            continue
        duration = session.get("duration_sec")
        if duration is None:
            last_ping_value = session.get("last_ping_at")
            logout_at_value = session.get("logout_at")
            if last_ping_value:
                last_ping = parse_iso_datetime(last_ping_value)
                if last_ping.tzinfo is not None:
                    last_ping = last_ping.astimezone()
                duration = max(0, int((last_ping - login_at).total_seconds()))
            elif logout_at_value:
                logout_at = parse_iso_datetime(logout_at_value)
                if logout_at.tzinfo is not None:
                    logout_at = logout_at.astimezone()
                duration = max(0, int((logout_at - login_at).total_seconds()))
            elif session.get("active") and (now - login_at).total_seconds() < 300:
                duration = max(0, int((now - login_at).total_seconds()))
            else:
                duration = 0
        login_seconds[index] += max(0, int(duration))

    for task in tasks_data.get("items", []):
        if task.get("user_id") != user_id:
            continue
        due_at_value = task.get("due_at")
        if not due_at_value:
            continue
        due_dt = parse_iso_datetime(due_at_value)
        if due_dt.tzinfo is not None:
            due_dt = due_dt.astimezone()
        due_date = due_dt.date()
        index = (due_date - week_start).days
        if index < 0 or index > 6:
            continue
        total[index] += 1
        if task.get("status") == "completed":
            completed[index] += 1

    login_minutes   = [int(s // 60) for s in login_seconds]
    completion_rate = []
    for d_total, d_done in zip(total, completed):
        completion_rate.append(100 if d_total == 0 else round((d_done / d_total) * 100))

    today = now.date()
    for i in range(7):
        if week_start + timedelta(days=i) > today:
            login_minutes[i]   = 0
            completion_rate[i] = 0
            total[i]           = 0
            completed[i]       = 0

    return {
        "user_id":              user_id,
        "week_start":           week_start.isoformat(),
        "login_minutes":        login_minutes,
        "task_completion_rate": completion_rate,
        "tasks_due":            total,
        "tasks_done":           completed,
        "created_at":           format_iso_datetime(datetime.now())
    }
