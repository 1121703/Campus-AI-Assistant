import os
import uuid
from datetime import datetime

from api.utils import read_json, write_json, DATA_DIR, format_iso_datetime

TASKS_FILE  = os.path.join(DATA_DIR, "calendar_tasks.json")
EVENTS_FILE = os.path.join(DATA_DIR, "calendar_events.json")
AUDIT_FILE  = os.path.join(DATA_DIR, "calendar_audit_log.json")

_EMPTY = {"schema_version": 1, "items": []}


def handle(method: str, path: str, body: dict | None, params: dict) -> tuple[int, dict]:
    # Tasks
    if path == "/api/calendar/tasks":
        if method == "GET":  return _list_tasks()
        if method == "POST": return _add_task(body)

    if path.startswith("/api/calendar/tasks/"):
        rest  = path[len("/api/calendar/tasks/"):]
        parts = rest.split("/")
        task_id = parts[0]
        if len(parts) == 2 and parts[1] == "complete":
            if method == "POST": return _complete_task(task_id)
        elif len(parts) == 1:
            if method == "GET":    return _get_task(task_id)
            if method == "PUT":    return _update_task(task_id, body)
            if method == "DELETE": return _delete_task(task_id)

    # Events
    if path == "/api/calendar/events":
        if method == "GET":  return _list_events()
        if method == "POST": return _add_event(body)

    if path.startswith("/api/calendar/events/"):
        event_id = path[len("/api/calendar/events/"):]
        if method == "GET":    return _get_event(event_id)
        if method == "PUT":    return _update_event(event_id, body)
        if method == "DELETE": return _delete_event(event_id)

    return 404, {"error": "Unknown calendar route."}


# ── helpers ──────────────────────────────────────────────────────────────────

def _next_id(data, prefix):
    id_key  = "task_id" if prefix == "t_" else "event_id"
    max_num = 0
    for item in data.get("items", []):
        item_id = item.get(id_key, "")
        if item_id.startswith(prefix):
            try:
                max_num = max(max_num, int(item_id[len(prefix):]))
            except ValueError:
                pass
    return f"{prefix}{max_num + 1:04d}"


def _audit(action, target_id, user_id, detail=None):
    data = read_json(AUDIT_FILE, dict(_EMPTY))
    data["items"].append({
        "log_id":    "cal_" + uuid.uuid4().hex[:8].upper(),
        "user_id":   user_id,
        "action":    action,
        "target_id": target_id,
        "ts":        format_iso_datetime(datetime.now()),
        "detail":    detail or {},
    })
    write_json(AUDIT_FILE, data)


# ── tasks ─────────────────────────────────────────────────────────────────────

def _list_tasks():
    data  = read_json(TASKS_FILE, dict(_EMPTY))
    items = [t for t in data["items"] if t.get("status") != "archived"]
    return 200, {"success": True, "tasks": items}


def _get_task(task_id):
    data = read_json(TASKS_FILE, dict(_EMPTY))
    task = next((t for t in data["items"] if t.get("task_id") == task_id), None)
    if not task:
        return 404, {"error": "任務不存在"}
    return 200, {"success": True, "task": task}


def _add_task(body):
    if not body:
        return 400, {"error": "無效的請求內容"}
    title  = (body.get("title") or "").strip()
    due_at = (body.get("due_at") or "").strip()
    if not title or not due_at:
        return 400, {"error": "缺少必填欄位: title, due_at"}

    data = read_json(TASKS_FILE, dict(_EMPTY))
    task = {
        "task_id":      _next_id(data, "t_"),
        "user_id":      body.get("user_id", "u_0001"),
        "title":        title,
        "course":       (body.get("course") or "").strip(),
        "due_at":       due_at,
        "status":       "pending",
        "completed_at": None,
        "source":       body.get("source", "manual"),
        "note":         (body.get("note") or "").strip(),
        "created_at":   format_iso_datetime(datetime.now()),
        "updated_at":   format_iso_datetime(datetime.now()),
    }
    data["items"].append(task)
    write_json(TASKS_FILE, data)
    _audit("create_task", task["task_id"], task["user_id"], {"source": task["source"]})
    return 201, {"success": True, "message": "任務新增成功", "task": task}


def _update_task(task_id, body):
    if not body:
        return 400, {"error": "無效的請求內容"}
    data = read_json(TASKS_FILE, dict(_EMPTY))
    task = next((t for t in data["items"] if t.get("task_id") == task_id), None)
    if not task:
        return 404, {"error": "任務不存在"}
    for field in ("title", "course", "due_at", "note", "status", "completed_at"):
        if field in body:
            task[field] = body[field]
    task["updated_at"] = format_iso_datetime(datetime.now())
    write_json(TASKS_FILE, data)
    _audit("update_task", task_id, task.get("user_id", ""), {"updates": body})
    return 200, {"success": True, "message": "任務更新成功", "task": task}


def _complete_task(task_id):
    data = read_json(TASKS_FILE, dict(_EMPTY))
    task = next((t for t in data["items"] if t.get("task_id") == task_id), None)
    if not task:
        return 404, {"error": "任務不存在"}
    task["status"]       = "completed"
    task["completed_at"] = format_iso_datetime(datetime.now())
    task["updated_at"]   = format_iso_datetime(datetime.now())
    write_json(TASKS_FILE, data)
    _audit("complete_task", task_id, task.get("user_id", ""), {})
    return 200, {"success": True, "message": "任務已完成", "task": task}


def _delete_task(task_id):
    data = read_json(TASKS_FILE, dict(_EMPTY))
    task = next((t for t in data["items"] if t.get("task_id") == task_id), None)
    if not task:
        return 404, {"error": "任務不存在"}
    task["status"]     = "archived"
    task["updated_at"] = format_iso_datetime(datetime.now())
    write_json(TASKS_FILE, data)
    _audit("delete_task", task_id, task.get("user_id", ""), {})
    return 200, {"success": True, "message": "任務已刪除", "task": task}


# ── events ────────────────────────────────────────────────────────────────────

def _list_events():
    data  = read_json(EVENTS_FILE, dict(_EMPTY))
    items = [e for e in data["items"] if e.get("status") != "cancelled"]
    return 200, {"success": True, "events": items}


def _get_event(event_id):
    data  = read_json(EVENTS_FILE, dict(_EMPTY))
    event = next((e for e in data["items"] if e.get("event_id") == event_id), None)
    if not event:
        return 404, {"error": "活動不存在"}
    return 200, {"success": True, "event": event}


def _add_event(body):
    if not body:
        return 400, {"error": "無效的請求內容"}
    title    = (body.get("title") or "").strip()
    start_at = (body.get("start_at") or "").strip()
    end_at   = (body.get("end_at") or "").strip()
    if not title or not start_at or not end_at:
        return 400, {"error": "缺少必填欄位: title, start_at, end_at"}

    data  = read_json(EVENTS_FILE, dict(_EMPTY))
    event = {
        "event_id":             _next_id(data, "e_"),
        "user_id":              body.get("user_id", "u_0001"),
        "title":                title,
        "start_at":             start_at,
        "end_at":               end_at,
        "all_day":              bool(body.get("all_day", False)),
        "location":             (body.get("location") or "").strip(),
        "note":                 (body.get("note") or "").strip(),
        "source":               body.get("source", "manual"),
        "linked_suggestion_id": body.get("linked_suggestion_id"),
        "status":               "active",
        "created_at":           format_iso_datetime(datetime.now()),
    }
    data["items"].append(event)
    write_json(EVENTS_FILE, data)
    _audit("create_event", event["event_id"], event["user_id"], {"source": event["source"]})
    return 201, {"success": True, "message": "活動新增成功", "event": event}


def _update_event(event_id, body):
    if not body:
        return 400, {"error": "無效的請求內容"}
    data  = read_json(EVENTS_FILE, dict(_EMPTY))
    event = next((e for e in data["items"] if e.get("event_id") == event_id), None)
    if not event:
        return 404, {"error": "活動不存在"}
    for field in ("title", "start_at", "end_at", "all_day", "location", "note", "status"):
        if field in body:
            event[field] = body[field]
    write_json(EVENTS_FILE, data)
    _audit("update_event", event_id, event.get("user_id", ""), {"updates": body})
    return 200, {"success": True, "message": "活動更新成功", "event": event}


def _delete_event(event_id):
    data  = read_json(EVENTS_FILE, dict(_EMPTY))
    event = next((e for e in data["items"] if e.get("event_id") == event_id), None)
    if not event:
        return 404, {"error": "活動不存在"}
    event["status"] = "cancelled"
    write_json(EVENTS_FILE, data)
    _audit("delete_event", event_id, event.get("user_id", ""), {})
    return 200, {"success": True, "message": "活動已刪除", "event": event}
