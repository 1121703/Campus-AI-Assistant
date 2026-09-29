from __future__ import annotations

import json
import os
import re
from copy import deepcopy
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import ollama

from api.utils import DATA_DIR

_DATA = Path(DATA_DIR)

TZ = timezone(timedelta(hours=8))
OLLAMA_MODEL = "qwen3:1.7b"
DEFAULT_USER_ID = "system"


# ── Ollama helper ─────────────────────────────────────────────────────────────

def _ollama_chat(system_prompt: str, user_prompt: str) -> str:
    """呼叫本地 Ollama，剝除 qwen3 思考標籤後回傳純文字。"""
    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
    )
    content = response["message"]["content"].strip()
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    return content


def _ollama_chat_safe(system_prompt: str, user_prompt: str, fallback: str = "") -> str:
    """呼叫 Ollama；失敗時回傳 fallback，避免服務中斷時整頁掛掉。"""
    try:
        return _ollama_chat(system_prompt, user_prompt)
    except Exception as exc:
        print(f"[ai] Ollama 呼叫失敗：{exc}")
        return fallback


def _ollama_chat_with_history(
    system_prompt: str,
    history: List[Dict[str, str]],
    user_message: str,
    fallback: str = "",
) -> str:
    """帶對話歷史呼叫 Ollama（最多保留最近 MAX_HISTORY 輪）。"""
    MAX_HISTORY = 10  # 5 輪 = user×5 + assistant×5
    trimmed = history[-MAX_HISTORY:] if len(history) > MAX_HISTORY else history

    messages: List[Dict[str, str]] = [{"role": "system", "content": system_prompt}]
    for turn in trimmed:
        role = turn.get("role", "")
        content = turn.get("content", "")
        if role in ("user", "assistant") and content:
            messages.append({"role": role, "content": content})
    messages.append({"role": "user", "content": user_message})

    try:
        response = ollama.chat(model=OLLAMA_MODEL, messages=messages)
        content = response["message"]["content"].strip()
        content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
        return content or fallback
    except Exception as exc:
        print(f"[ai] Ollama 呼叫失敗：{exc}")
        return fallback


# ── Data helpers ──────────────────────────────────────────────────────────────

_EMPTY: Dict[str, Any] = {"schema_version": 1, "items": []}


def _read_json(name: str) -> Dict[str, Any]:
    path = _DATA / name
    bak = Path(str(path) + ".bak")
    if not path.exists():
        _write_json(name, dict(_EMPTY))
        return dict(_EMPTY)
    for src in (path, bak):
        if not src.exists():
            continue
        try:
            with src.open("r", encoding="utf-8") as f:
                data = json.load(f)
            if isinstance(data, list):
                data = {"schema_version": 1, "items": data}
            data.setdefault("schema_version", 1)
            data.setdefault("items", [])
            return data
        except (json.JSONDecodeError, OSError):
            print(f"[ai] {src.name} 解析失敗，嘗試備份")
    return dict(_EMPTY)


def _write_json(name: str, data: Dict[str, Any]) -> None:
    _DATA.mkdir(exist_ok=True)
    path = _DATA / name
    bak = Path(str(path) + ".bak")
    payload = {"schema_version": data.get("schema_version", 1), "items": data.get("items", [])}
    tmp = str(path) + ".tmp"
    with open(tmp, "w", encoding="utf-8") as f:
        json.dump(payload, f, ensure_ascii=False, indent=2)
        f.write("\n")
    # 先備份現有檔案，再替換
    if path.exists():
        try:
            import shutil
            shutil.copy2(str(path), str(bak))
        except OSError:
            pass
    os.replace(tmp, str(path))


def _append_item(name: str, item: Dict[str, Any]) -> None:
    data = _read_json(name)
    data["items"].append(item)
    _write_json(name, data)


def _get_items(name: str) -> List[Dict[str, Any]]:
    return _read_json(name).get("items", [])


# ── Time helpers ──────────────────────────────────────────────────────────────

def _now() -> datetime:
    return datetime.now(TZ)


def _now_iso() -> str:
    return _now().isoformat(timespec="seconds")


def _parse_dt(value: str) -> Optional[datetime]:
    if not value:
        return None
    try:
        if value.endswith("Z"):
            value = value[:-1] + "+00:00"
        dt = datetime.fromisoformat(value)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=TZ)
        return dt.astimezone(TZ)
    except ValueError:
        return None


# ── Psych helpers ─────────────────────────────────────────────────────────────

def _user_items(items: List[Dict[str, Any]], user_id: str) -> List[Dict[str, Any]]:
    return [item for item in items if item.get("user_id") in (None, "", user_id)]


def _sort_recent(items: List[Dict[str, Any]], limit: int = 5) -> List[Dict[str, Any]]:
    def key(item: Dict[str, Any]) -> datetime:
        for field in ("created_at", "completed_at", "tested_at", "date"):
            dt = _parse_dt(str(item.get(field, "")))
            if dt:
                return dt
        return datetime.min.replace(tzinfo=TZ)
    return sorted(items, key=key, reverse=True)[:limit]


def _get_recent_psych_results(user_id: str, limit: int = 5) -> List[Dict[str, Any]]:
    items = _get_items("psych_results.json")
    matched = _user_items(items, user_id)
    if not matched and user_id != "system":
        matched = _user_items(items, "system")
    if not matched:
        matched = items
    return _sort_recent(matched, limit)


def _category_from_score(score: float) -> str:
    if score >= 75:
        return "高度壓力"
    if score >= 45:
        return "中度壓力"
    return "低度壓力"


def _build_psych_report(results: List[Dict[str, Any]]) -> Dict[str, Any]:
    if not results:
        return {
            "title": "目前沒有心理測驗資料",
            "summary": "系統尚未找到可分析的心理測驗資料。",
            "risk_level": "unknown",
            "recommendations": ["請先完成心理測驗，AI 助手將能提供更準確的輔導建議。"],
            "recent_results": [],
        }

    scores = [float(r.get("score_total", 0) or 0) for r in results]
    latest = results[0]
    avg_score = round(sum(scores) / len(scores), 1)
    latest_score = float(latest.get("score_total", avg_score) or avg_score)
    category = str(latest.get("category") or latest.get("stress_level") or _category_from_score(latest_score))

    if "高" in category:
        risk_level = "high"
    elif "中" in category:
        risk_level = "medium"
    elif "低" in category:
        risk_level = "low"
    elif latest_score >= 71:
        risk_level = "high"
    elif latest_score >= 41:
        risk_level = "medium"
    else:
        risk_level = "low"

    ai_summary = latest.get("ai_summary")
    ai_recommendations = latest.get("ai_recommendations")

    summary = str(ai_summary) if ai_summary else (
        f"最近一次測驗分數為 {latest_score:g} 分，分類為{category}；"
        f"最近 {len(results)} 筆平均分數為 {avg_score} 分。"
    )

    if isinstance(ai_recommendations, list) and ai_recommendations:
        recommendations = [str(item) for item in ai_recommendations]
    else:
        if risk_level == "high":
            recommendations = [
                "先把今天最急的事情拆成 20–30 分鐘可完成的小步驟。",
                "今天安排固定休息時間，避免連續熬夜或長時間硬撐。",
                "若壓力已影響睡眠或日常功能，建議聯絡學校輔導中心或專業心理師。",
            ]
        elif risk_level == "medium":
            recommendations = [
                "把任務依照急迫度排序，先完成最靠近期限的事項。",
                "每天保留一段不被打斷的休息或運動時間。",
                "睡前減少滑手機與咖啡因，優先穩定睡眠。",
            ]
        else:
            recommendations = [
                "維持規律運動與睡眠。",
                "每週做一次簡短自我檢查，觀察壓力是否累積。",
                "保留社交與休閒時間，避免壓力長期堆疊。",
            ]

    return {
        "title": "近期心理分析輔導報告",
        "summary": summary,
        "risk_level": risk_level,
        "latest_category": category,
        "average_score": avg_score,
        "latest_score": latest_score,
        "scale_scores": latest.get("scale_scores", {}),
        "confidence": latest.get("confidence"),
        "source_result_id": latest.get("result_id"),
        "recommendations": recommendations,
        "recent_results": results,
    }


# ── Schedule helpers ──────────────────────────────────────────────────────────

def _is_schedule_related_rule(text: str) -> bool:
    keywords = [
        "安排", "排程", "行程", "日程", "行事曆", "日曆", "會議", "開會", "活動",
        "提醒", "幫我排", "約", "上課", "讀書", "健身", "報告", "作業", "考試",
        "截止", "deadline", "明天", "後天", "今天", "下週", "下星期", "星期",
        "週", "點", "下午", "上午", "晚上", "早上",
    ]
    lowered = text.lower()
    return any(kw.lower() in lowered for kw in keywords)


def _is_schedule_related(text: str) -> bool:
    fallback = "SCHEDULE" if _is_schedule_related_rule(text) else "GENERAL"
    result = _ollama_chat_safe(
        "你要判斷使用者訊息是否需要新增、安排、建議行事曆或排程。只回答 SCHEDULE 或 GENERAL，不要解釋。",
        text,
        fallback=fallback,
    ).strip().upper()
    if "SCHEDULE" in result:
        return True
    if "GENERAL" in result:
        return False
    return fallback == "SCHEDULE"


def _extract_duration(text: str) -> int:
    for pattern, unit in [(r"(\d+(?:\.\d+)?)\s*(?:小時|hr|hour)", 60), (r"(\d+)\s*(?:分鐘|分|min)", 1)]:
        m = re.search(pattern, text, flags=re.IGNORECASE)
        if m:
            return max(15, int(float(m.group(1)) * unit))
    return 60


def _extract_date(text: str) -> datetime:
    base = _now()
    m = re.search(r"(20\d{2})[-/](\d{1,2})[-/](\d{1,2})", text)
    if m:
        return datetime(int(m.group(1)), int(m.group(2)), int(m.group(3)), tzinfo=TZ)
    m = re.search(r"(\d{1,2})[/-](\d{1,2})", text)
    if m:
        return datetime(base.year, int(m.group(1)), int(m.group(2)), tzinfo=TZ)
    if "後天" in text:
        return (base + timedelta(days=2)).replace(hour=0, minute=0, second=0, microsecond=0)
    if "明天" in text:
        return (base + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)
    if "今天" in text:
        return base.replace(hour=0, minute=0, second=0, microsecond=0)
    return (base + timedelta(days=1)).replace(hour=0, minute=0, second=0, microsecond=0)


def _extract_time(text: str) -> Tuple[int, int]:
    period = None
    if any(w in text for w in ["下午", "傍晚", "晚上"]):
        period = "pm"
    if any(w in text for w in ["早上", "上午"]):
        period = "am"

    # 支援 HH:MM、HH：MM、HH.MM（如「8.30」「14:30」）
    m = re.search(r"(\d{1,2})[:：.](\d{2})(?!\d)", text)
    if m:
        hour, minute = int(m.group(1)), int(m.group(2))
    else:
        # 支援「8點30分」「8點半」
        m = re.search(r"(\d{1,2})\s*點(?:\s*(\d{1,2})\s*分?)?", text)
        if m:
            raw_min = m.group(2) or "0"
            hour = int(m.group(1))
            minute = int(raw_min)
        else:
            hour, minute = (19, 0) if period == "pm" else (9, 0)

    if period == "pm" and 1 <= hour <= 11:
        hour += 12
    return min(hour, 23), min(minute, 59)


def _clean_title(text: str) -> str:
    title = text.strip()
    patterns = [
        r"20\d{2}[-/]\d{1,2}[-/]\d{1,2}", r"\d{1,2}[/-]\d{1,2}",
        r"今天|明天|後天|下週|下星期|這週|這星期",
        r"上午|下午|晚上|早上|傍晚", r"\d{1,2}[:：]\d{2}",
        r"\d{1,2}\s*點(?:\s*\d{1,2}\s*分?)?",
        r"\d+(?:\.\d+)?\s*(?:小時|hr|hour|分鐘|分|min)",
        r"請|可以|能不能|幫我|麻煩|想要|我要|我想|安排|排程|新增|加入|提醒|建立|排一下",
    ]
    for p in patterns:
        title = re.sub(p, " ", title, flags=re.IGNORECASE)
    title = re.sub(r"\s+", " ", title).strip(" ，,。.!！")
    return title[:40] or "AI 建議排程"


def _get_active_calendar_events() -> List[Dict[str, Any]]:
    items = _get_items("calendar_events.json")
    return [e for e in items if e.get("status") != "cancelled" and not e.get("is_archived")]


def _next_available_slot(start: datetime, duration_min: int) -> Tuple[datetime, datetime, List[Dict]]:
    events = _get_active_calendar_events()

    def conflicts(s: datetime, e: datetime) -> List[Dict]:
        result = []
        for ev in events:
            # 全天事件（假日、期末週等）不作為排程衝突
            if ev.get("all_day"):
                continue
            ev_s = _parse_dt(str(ev.get("start_at", "")))
            ev_e = _parse_dt(str(ev.get("end_at", "")))
            if not ev_s or not ev_e:
                continue
            if s < ev_e and e > ev_s:
                overlap = min(e, ev_e) - max(s, ev_s)
                result.append({
                    "event_id": ev.get("event_id"),
                    "title": ev.get("title", "未命名"),
                    "overlap_min": int(overlap.total_seconds() // 60),
                })
        return result

    candidate = start
    for _ in range(24):
        candidate_end = candidate + timedelta(minutes=duration_min)
        cs = conflicts(candidate, candidate_end)
        if not cs:
            return candidate, candidate_end, []
        latest = candidate + timedelta(minutes=30)
        for ev in events:
            ev_s = _parse_dt(str(ev.get("start_at", "")))
            ev_e = _parse_dt(str(ev.get("end_at", "")))
            if ev_s and ev_e and candidate < ev_e and candidate_end > ev_s:
                latest = max(latest, ev_e)
        candidate = latest.replace(second=0, microsecond=0)

    candidate_end = candidate + timedelta(minutes=duration_min)
    return candidate, candidate_end, conflicts(candidate, candidate_end)


def _extract_json_object(text: str) -> Optional[Dict[str, Any]]:
    if not text:
        return None
    text = text.strip()
    # 剝除 markdown code fence
    if text.startswith("```"):
        text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.IGNORECASE)
        text = re.sub(r"\s*```$", "", text)
    try:
        data = json.loads(text)
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        pass
    m = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if not m:
        return None
    try:
        data = json.loads(m.group(0))
        return data if isinstance(data, dict) else None
    except json.JSONDecodeError:
        return None


def _ai_extract_title(text: str) -> str:
    """讓 Ollama 只萃取事件名稱，不做日期時間解析（避免小模型算錯）。"""
    system_prompt = (
        "從使用者的文字中萃取要安排的事件名稱，"
        "回覆只需要名稱本身，3 到 10 個字，繁體中文，"
        "不要解釋，不要思考過程，不要標點符號。"
    )
    result = _ollama_chat_safe(system_prompt, text, fallback="").strip()
    # 結果合理（非空、無換行、不超長）才使用
    if result and len(result) <= 20 and "\n" not in result:
        return result[:40]
    return _clean_title(text)


def _build_schedule_suggestion(text: str, user_id: str) -> Dict[str, Any]:
    # 日期時間一律由規則引擎解析，避免 Ollama 小模型輸出錯誤
    date = _extract_date(text)
    hour, minute = _extract_time(text)
    duration = _extract_duration(text)
    preferred_start = date.replace(hour=hour, minute=minute, second=0, microsecond=0)
    # 只讓 Ollama 取標題（自然語言較簡單，不易出錯）
    title = _ai_extract_title(text)
    note = "由規則引擎依照日期、時間與文字內容解析排程。"

    start, end, cs = _next_available_slot(preferred_start, duration)
    suggestion_id = f"sug_{int(_now().timestamp())}"
    reason = note
    if start != preferred_start:
        reason += " 原本時段與既有活動衝突，因此改建議最近可用時段。"
    else:
        reason += " 目前沒有發現時間衝突。"

    return {
        "suggestion_id": suggestion_id,
        "user_id": user_id,
        "proposed_event": {
            "title": title,
            "start_at": start.isoformat(timespec="seconds"),
            "end_at": end.isoformat(timespec="seconds"),
            "is_archived": False,
            "source": "AI聊聊",
        },
        "conflicts": cs,
        "reason": reason,
        "created_at": _now_iso(),
    }


# ── Reply builders ────────────────────────────────────────────────────────────

def _normal_reply_fallback(text: str) -> str:
    if any(kw in text for kw in ["你好", "嗨", "hi", "哈囉"]):
        return "嗨！你可以直接跟我聊天；如果你提到日期、時間或想安排的事情，我也可以幫你整理成排程建議。"
    if any(kw in text for kw in ["謝謝", "感謝"]):
        return "不客氣！需要我幫你整理想法、改文字或討論下一步也可以直接說。"
    if any(kw in text for kw in ["怎麼辦", "很煩", "壓力", "焦慮"]):
        return "聽起來你現在有點卡住。你可以先把問題分成：現在最急、今天能做、可以晚點處理三類。先處理最小的一步，會比一次想完全部更容易開始。"
    return "我理解你的意思。這個問題目前看起來不需要排程，我會用一般 AI 助手的方式回覆。"


def _build_schedule_reply(
    text: str,
    suggestion: Dict[str, Any],
    history: List[Dict[str, str]] | None = None,
) -> str:
    """讓 AI 用自然語言描述剛產生的排程建議，而非硬編碼固定句。"""
    event = suggestion.get("proposed_event", {})
    title = event.get("title", "")
    start = event.get("start_at", "")
    end = event.get("end_at", "")
    conflicts = suggestion.get("conflicts", [])
    reason = suggestion.get("reason", "")

    conflict_info = ""
    if conflicts:
        names = "、".join(c.get("title", "") for c in conflicts)
        conflict_info = f"\n注意：此時段與「{names}」有時間衝突，系統已自動調整至最近可用時段。"

    system_prompt = (
        "你是「聊聊」，一個台灣繁體中文 AI 助手。"
        "系統已根據使用者的要求產生了一個排程建議，請你用自然、友善的語氣向使用者說明這個建議的內容，"
        "包含事件名稱、日期時間，並提醒他點擊「接受建議」按鈕才會正式加入行事曆。"
        "回覆 2 到 3 句即可，不要太長，不要輸出思考過程，用繁體中文。"
    )
    user_prompt = (
        f"使用者說：{text}\n"
        f"系統產生的排程建議：\n"
        f"  事件名稱：{title}\n"
        f"  開始時間：{start}\n"
        f"  結束時間：{end}\n"
        f"  備註：{reason}{conflict_info}\n"
        "請用自然友善的語氣說明這個排程，並請使用者確認。"
    )
    fallback = f"我幫你安排好了「{title}」，時間是 {start} 到 {end}。{conflict_info} 請確認後點擊「接受建議」加入行事曆。"

    if history:
        return _ollama_chat_with_history(system_prompt, history, user_prompt, fallback=fallback)
    return _ollama_chat_safe(system_prompt, user_prompt, fallback=fallback)


def _build_normal_reply(text: str, history: List[Dict[str, str]] | None = None) -> str:
    system_prompt = (
        "你是「聊聊」，一個台灣繁體中文 AI 助手。"
        "目前使用者的問題已被判斷為「非排程」問題，所以不要產生行事曆事件，也不要說已新增排程。"
        "請像一般 AI 一樣正常回應，語氣自然、清楚、實用。"
        "如果使用者要求改寫、整理、解釋或建議，請直接完成。"
        "回覆用繁體中文，不要輸出思考過程。"
    )
    if history:
        return _ollama_chat_with_history(system_prompt, history, text, fallback=_normal_reply_fallback(text))
    return _ollama_chat_safe(system_prompt, text, fallback=_normal_reply_fallback(text))


def _counselor_reply_fallback(text: str, report: Dict[str, Any]) -> str:
    risk = report.get("risk_level")
    summary = report.get("summary", "目前缺少近期心理測驗資料。")
    if any(kw in text for kw in ["睡", "失眠", "熬夜"]):
        return (f"從近期資料看，睡眠確實可能影響你的壓力狀態。{summary} "
                "建議你今晚先做一個小調整：睡前 30 分鐘停止處理作業或訊息，把明天第一件要做的事寫下來。")
    if any(kw in text for kw in ["報告", "作業", "考試", "忙", "時間"]):
        return (f"你現在比較需要把壓力轉成可執行的清單。{summary} "
                "建議先列出今天一定要完成的一件事，切成 25 分鐘一段，中間休息 5 分鐘。")
    if risk == "high":
        return (f"我會先把重點放在降低當下壓力。{summary} "
                "你可以先做 3 分鐘慢呼吸，接著只選一件最小任務開始。"
                "如果持續影響睡眠或日常功能，建議找輔導中心或心理師談談。")
    if risk == "medium":
        return (f"依照最近測驗，你的壓力偏中等，需要穩定調整而不是硬撐。{summary} "
                "你可以跟我說目前最困擾你的事情，我會幫你拆成可執行步驟。")
    return (f"目前資料看起來相對穩定。{summary} "
            "你可以持續觀察最近讓你心情變動最大的因素，我可以陪你一起整理。")


def _build_counselor_reply(
    text: str,
    report: Dict[str, Any],
    history: List[Dict[str, str]] | None = None,
) -> str:
    danger = ["自殺", "不想活", "傷害自己", "死掉", "輕生"]
    if any(kw in text for kw in danger):
        return ("我很在意你現在的安全。請先不要一個人承受，立刻聯絡身邊可信任的人、學校輔導中心，"
                "或撥打當地緊急求助資源。若有立即危險，請直接撥打 119 或前往急診。")

    context = json.dumps(report, ensure_ascii=False, indent=2)
    system_prompt = (
        "你是個心理輔導員，請用台灣繁體中文回覆，不要輸出思考過程。\n"
        "你會參考系統提供的最近五筆心理測驗資料與輔導報告，陪使用者整理壓力、情緒與可執行的下一步。\n"
        "回覆原則：1.語氣溫和、支持，不責備使用者。2.不要做醫療診斷。"
        "3.根據近期資料得出觀察或提供建議，幫助整理思緒和行動方案。"
        "4.若使用者透露自傷、輕生、立即危險，請建議立刻尋求身邊可信任的人或緊急醫療協助。"
        "5.回覆以 2 到 5 句為主，不要太長。\n"
        f"近期心理測驗資料與輔導報告如下：\n{context}"
    )
    fallback = _counselor_reply_fallback(text, report)
    if history:
        return _ollama_chat_with_history(system_prompt, history, text, fallback=fallback)
    return _ollama_chat_safe(system_prompt, text, fallback=fallback)


# ── Route handlers ────────────────────────────────────────────────────────────

def _get_param(params: dict, key: str, default: str = "") -> str:
    val = params.get(key, [default])
    return val[0] if isinstance(val, list) else str(val)


def _handle_chat(body: dict) -> Tuple[int, dict]:
    user_id = str(body.get("user_id") or DEFAULT_USER_ID)
    message = str(body.get("message") or body.get("prompt") or "").strip()
    if not message:
        return 400, {"ok": False, "error": "message required"}

    history: List[Dict[str, str]] = body.get("history") or []

    schedule_related = _is_schedule_related(message)

    if schedule_related:
        suggestion = _build_schedule_suggestion(message, user_id)
        _append_item("ai_schedule_suggestions.json", suggestion)
        reply = _build_schedule_reply(message, suggestion, history)
    else:
        suggestion = None
        reply = _build_normal_reply(message, history)

    _append_item("ai_prompt_log.json", {
        "prompt_id": f"ai_{int(_now().timestamp())}",
        "user_id": user_id,
        "purpose": "chat_schedule" if schedule_related else "chat_general",
        "prompt_text": message,
        "response_text": reply,
        "model": OLLAMA_MODEL,
        "created_at": _now_iso(),
    })

    return 200, {"ok": True, "reply": reply, "schedule_suggestion": suggestion}


def _handle_counselor_chat(body: dict) -> Tuple[int, dict]:
    user_id = str(body.get("user_id") or DEFAULT_USER_ID)
    message = str(body.get("message") or body.get("prompt") or "").strip()
    if not message:
        return 400, {"ok": False, "error": "message required"}

    history: List[Dict[str, str]] = body.get("history") or []

    results = _get_recent_psych_results(user_id, 5)
    report = _build_psych_report(results)
    reply = _build_counselor_reply(message, report, history)

    _append_item("ai_prompt_log.json", {
        "prompt_id": f"ai_{int(_now().timestamp())}",
        "user_id": user_id,
        "purpose": "counseling_chat",
        "prompt_text": message,
        "response_text": reply,
        "model": OLLAMA_MODEL,
        "created_at": _now_iso(),
    })

    return 200, {"ok": True, "reply": reply, "report": report}


def _handle_accept_schedule(body: dict) -> Tuple[int, dict]:
    user_id = str(body.get("user_id") or DEFAULT_USER_ID)
    suggestion = body.get("suggestion") or {}
    proposed = suggestion.get("proposed_event") or {}

    if not proposed.get("title") or not proposed.get("start_at") or not proposed.get("end_at"):
        return 400, {"ok": False, "error": "invalid suggestion"}

    event_id = f"e_{int(_now().timestamp())}"
    new_event = deepcopy(proposed)
    new_event.update({
        "event_id": event_id,
        "user_id": user_id,
        "status": "active",
        "is_archived": False,
        "source": "AI聊聊",
        "source_suggestion": suggestion.get("suggestion_id"),
        "created_at": _now_iso(),
    })

    _append_item("calendar_events.json", new_event)
    _append_item("ai_schedule_merge_log.json", {
        "log_id": f"add_{int(_now().timestamp())}",
        "user_id": user_id,
        "action": "add_only",
        "added_event_ids": [event_id],
        "overwritten_event_ids": [],
        "deleted_event_ids": [],
        "ts": _now_iso(),
    })

    return 200, {"ok": True, "event": new_event}


def _handle_psych_report(params: dict) -> Tuple[int, dict]:
    user_id = _get_param(params, "user_id", DEFAULT_USER_ID)
    results = _get_recent_psych_results(user_id, 5)
    return 200, {"ok": True, "report": _build_psych_report(results)}


def _handle_calendar_events() -> Tuple[int, dict]:
    return 200, {"ok": True, "items": _get_active_calendar_events()}


def _handle_bootstrap(params: dict) -> Tuple[int, dict]:
    user_id = _get_param(params, "user_id", DEFAULT_USER_ID)
    results = _get_recent_psych_results(user_id, 5)
    return 200, {
        "ok": True,
        "calendar_events": _get_active_calendar_events(),
        "psych_report": _build_psych_report(results),
    }


# ── Main dispatcher ───────────────────────────────────────────────────────────

def handle(method: str, path: str, body: dict | None, params: dict) -> Tuple[int, dict]:
    body = body or {}

    if path == "/api/ai/chat" and method == "POST":
        return _handle_chat(body)
    if path == "/api/ai/counselor_chat" and method == "POST":
        return _handle_counselor_chat(body)
    if path == "/api/ai/accept_schedule" and method == "POST":
        return _handle_accept_schedule(body)
    if path == "/api/ai/psych_report" and method == "GET":
        return _handle_psych_report(params)
    if path == "/api/ai/calendar_events" and method == "GET":
        return _handle_calendar_events()
    if path == "/api/ai/bootstrap" and method == "GET":
        return _handle_bootstrap(params)

    return 404, {"error": "Unknown AI route."}


# ── Init ──────────────────────────────────────────────────────────────────────

def _init():
    for name in ("ai_prompt_log.json", "ai_schedule_suggestions.json", "ai_schedule_merge_log.json"):
        path = _DATA / name
        if not path.exists():
            _write_json(name, dict(_EMPTY))


_init()
