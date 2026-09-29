import os
import re
import json
import uuid
import random
import ollama
from datetime import datetime, timezone, timedelta

from api.utils import read_json, write_json, DATA_DIR

TW_TZ = timezone(timedelta(hours=8))

OLLAMA_MODEL = "qwen3:1.7b"


def _ollama_chat(system_prompt: str, user_prompt: str) -> str:
    """呼叫本地 Ollama，回傳去除思考標籤後的純文字 content。"""
    response = ollama.chat(
        model=OLLAMA_MODEL,
        messages=[
            {"role": "system", "content": system_prompt},
            {"role": "user",   "content": user_prompt},
        ],
    )
    content = response["message"]["content"].strip()
    # qwen3 思考模型會在 content 裡夾帶 <think>…</think>，需剝除
    content = re.sub(r"<think>.*?</think>", "", content, flags=re.DOTALL).strip()
    return content


def _parse_json_response(raw: str) -> dict:
    """解析 AI 回傳的 JSON，容忍直接回 list 的情況。"""
    if raw.startswith("```json"):
        raw = raw[7:]
    if raw.startswith("```"):
        raw = raw[3:]
    if raw.endswith("```"):
        raw = raw[:-3]
    raw = raw.strip()
    parsed = json.loads(raw)
    # 模型有時直接回 [{…}] 陣列而非 {"items": […]}
    if isinstance(parsed, list):
        return {"items": parsed}
    return parsed

RULES_FILEPATH = os.path.join(DATA_DIR, "psych_scoring_rules.json")
BANK_FILEPATH  = os.path.join(DATA_DIR, "psych_question_bank.json")
LOG_FILEPATH   = os.path.join(DATA_DIR, "psych_ai_question_log.json")
SESSIONS_FILEPATH = os.path.join(DATA_DIR, "psych_test_sessions.json")
RESULTS_FILEPATH  = os.path.join(DATA_DIR, "psych_results.json")


def handle(method: str, path: str, body: dict | None, params: dict) -> tuple[int, dict]:
    if path == "/api/psych/generate_questions":
        return _generate_questions()
    if path == "/api/psych/submit_answers" and method == "POST":
        return _submit_answers(body)
    return 404, {"error": "Unknown psych API route."}


def _generate_questions() -> tuple[int, dict]:
    tz = TW_TZ
    current_time = datetime.now(tz).isoformat(timespec="seconds")
    prompt_id = f"prompt_{uuid.uuid4().hex[:8]}"

    role_description = """
    你是一個心理諮商專家。請針對「大學生的學習壓力與心理健康」產生 5 題單選題。
    每題必須有且僅有 4 個選項，選項 id 依序為 A、B、C、D。
    請嚴格以 JSON 格式輸出，絕對不要包含任何 Markdown 標記 (例如 ```json) 或其他說明文字。
    """

    user_input = """
    請嚴格依照以下主題各產生 1 題，共 5 題，每題使用不同的情境與問法：
    題1主題：壓力來臨時的行為反應（例如面對作業截止、考試等）
    題2主題：人際關係與社交支持（例如與同學、家人的互動）
    題3主題：時間管理與學習習慣（例如安排讀書計畫的方式）
    題4主題：身體狀況與睡眠品質（例如熬夜、體力狀態）
    題5主題：情緒調節與自我認知（例如面對失敗或挫折的心態）

    每題必須有且僅有 4 個選項（A、B、C、D），選項內容要有明顯差異，不能全部都是「影響/不影響」的變體。

    以下是 JSON 輸出格式範例（注意：範例的題目是飲食偏好，與本次主題完全無關，請勿輸出此題目）：
    {
      "items": [
        {
          "text": "你最喜歡的食物是？",
          "type": "single",
          "options": [
            { "id": "A", "text": "拉麵", "weights": { "stress": 1, "energy": 3 } },
            { "id": "B", "text": "壽司", "weights": { "stress": 2, "energy": 2 } },
            { "id": "C", "text": "披薩", "weights": { "stress": 3, "energy": 2 } },
            { "id": "D", "text": "火鍋", "weights": { "stress": 1, "energy": 4 } }
          ],
          "tags": ["food"]
        }
      ]
    }
    請依照上述格式，輸出 5 題關於「大學生學習壓力與心理健康」的題目。
    weights 裡的 stress 和 energy 數值在 1 到 5 之間。
    """

    try:
        raw_content = _ollama_chat(role_description, user_input)
        print(f"[psych][DEBUG] raw_content =\n{raw_content}\n")
        questions_data = _parse_json_response(raw_content)
        raw_items = questions_data.get("items", [])
        if raw_items:
            print(f"[psych][DEBUG] 第1題 keys = {list(raw_items[0].keys())}")

        EXAMPLE_KEYWORDS = {"食物", "拉麵", "壽司", "披薩", "火鍋", "food"}
        new_items = []
        for index, item in enumerate(raw_items):
            # 過濾掉範例題目（tags 含 food 或題目文字含範例關鍵字）
            tags = item.get("tags", [])
            text = item.get("text", "")
            if any(k in tags for k in EXAMPLE_KEYWORDS) or any(k in text for k in EXAMPLE_KEYWORDS):
                print(f"[psych] 第 {index+1} 題疑似範例題目，跳過：{text[:20]}")
                continue
            # 容忍模型用 choices / answers 代替 options
            options = item.get("options") or item.get("choices") or item.get("answers") or []
            if len(options) != 4:
                print(f"[psych] 第 {index+1} 題選項數量為 {len(options)}，跳過（需要恰好 4 個）")
                continue
            processed_item = {
                "question_id": f"q_{uuid.uuid4().hex[:6]}_{index}",
                "text": item.get("text", ""),
                "type": item.get("type", "single"),
                "options": options,
                "tags": item.get("tags", ["stress"]),
                "source": "ai",
                "source_prompt_id": prompt_id,
                "created_at": current_time
            }
            new_items.append(processed_item)

        # 累積題庫
        bank_data = read_json(BANK_FILEPATH, default={"schema_version": 1, "items": []})
        bank_data["items"].extend(new_items)
        write_json(BANK_FILEPATH, bank_data)

        # 記錄出題 Log
        new_log = {
            "prompt_id": prompt_id,
            "user_id": "system",
            "prompt_text": "產生 5 題大學生學習壓力量表單選題",
            "model": OLLAMA_MODEL,
            "created_at": current_time
        }
        log_data = read_json(LOG_FILEPATH, default={"schema_version": 1, "items": []})
        log_data["items"].append(new_log)
        write_json(LOG_FILEPATH, log_data)

        return 200, {
            "status": "success",
            "message": "題目已由 AI 成功生成！",
            "data": {"schema_version": 1, "items": new_items}
        }

    except Exception as e:
        print(f"[psych] AI 呼叫失敗: {e}，啟動備用題庫機制...")

    # 備用：從歷史題庫隨機抽取
    bank_data = read_json(BANK_FILEPATH, default={"schema_version": 1, "items": []})
    historical_items = bank_data.get("items", [])
    if len(historical_items) >= 5:
        fallback_questions = random.sample(historical_items, 5)
        return 200, {
            "status": "success",
            "message": "AI 連線逾時，已為您從歷史題庫中隨機抽取測驗！",
            "data": {"schema_version": 1, "items": fallback_questions}
        }

    return 500, {"status": "error", "message": "AI 暫時無法連線，且尚無足夠的歷史題庫，請稍後再試。"}


def _submit_answers(body) -> tuple[int, dict]:
    if not body:
        return 400, {"error": "No data provided"}

    tz = TW_TZ
    current_time = datetime.now(tz).isoformat(timespec="seconds")

    user_answers = body.get("answers", [])
    if not user_answers:
        return 400, {"status": "error", "message": "未收到有效的作答紀錄"}

    total_stress = 0
    total_energy = 0
    for ans in user_answers:
        weights = ans.get("weights", {})
        total_stress += weights.get("stress", 0)
        total_energy += weights.get("energy", 0)

    raw_score_total = total_stress + total_energy
    stress_percentage = int((total_stress / 25) * 100)

    category = "未定義分類"
    current_rule_id = "rule_0001"
    fallback_summary_text = "【系統訊息】系統維護中，請多注意身心健康與休息。"
    fallback_rec_list = ["適度休息，保持充足睡眠。", "若有需要，請尋求校園諮商資源。"]

    try:
        rules_data = read_json(RULES_FILEPATH)
        if rules_data:
            rule = rules_data["items"][0]
            current_rule_id = rule.get("rule_id", "rule_0001")
            for t in rule.get("thresholds", []):
                if t["min"] <= stress_percentage <= t["max"]:
                    category = t["category"]
                    fallback_summary_text = t.get("fallback_summary", fallback_summary_text)
                    fallback_rec_list = t.get("fallback_recommendations", fallback_rec_list)
                    break
    except Exception as e:
        print(f"[psych] 讀取評分規則失敗: {e}")
        category = "系統錯誤無法分類"

    session_id = f"ps_{uuid.uuid4().hex[:8]}"
    result_id  = f"pr_{uuid.uuid4().hex[:8]}"

    # AI 諮商分析
    ai_analysis = None
    role_description = """
    你是一個專業的大學諮商心理師與生涯發展顧問。請根據學生的量化分數與作答明細，撰寫一段具有洞察力、溫暖且實用的心理健康評估。
    請嚴格以 JSON 格式回傳，絕對不要包含任何 Markdown 標記 (例如 ```json) 或額外說明文字。
    """
    user_input = f"""
    學生測驗數據如下：
    - 學習壓力維度得分：{stress_percentage} / 100 (分類判定為：{category})
    - 身心能量維度得分：{int((total_energy / 25) * 100)} / 100

    作答詳細資料：
    {json.dumps(user_answers, ensure_ascii=False)}

    請依據這些數據，產出以下 JSON 格式內容：
    {{
      "ai_summary": "請填入一段約 60-100 字的溫暖分析結語，點出他目前的心理狀態與學習壓力關聯。",
      "ai_recommendations": [
        "第一條具體的行動或調適建議",
        "第二條針對學習壓力的實用排解建議"
      ]
    }}
    """
    try:
        raw_content = _ollama_chat(role_description, user_input)
        ai_analysis = _parse_json_response(raw_content)
    except Exception as e:
        print(f"[psych] AI 諮商師分析失敗: {e}，啟動預設評估報告...")

    if ai_analysis is None:
        ai_analysis = {
            "ai_summary": fallback_summary_text,
            "ai_recommendations": fallback_rec_list
        }

    # 儲存 session 記錄
    new_session = {
        "session_id": session_id,
        "user_id": "system",
        "question_ids": [ans["question_id"] for ans in user_answers],
        "answers": user_answers,
        "raw_score_total": raw_score_total,
        "started_at": current_time,
        "finished_at": current_time
    }
    sessions_data = read_json(SESSIONS_FILEPATH, default={"schema_version": 1, "items": []})
    sessions_data["items"].append(new_session)
    write_json(SESSIONS_FILEPATH, sessions_data)

    # 儲存最終結果
    final_result_entry = {
        "result_id": result_id,
        "session_id": session_id,
        "user_id": "system",
        "rule_id": current_rule_id,
        "score_total": raw_score_total,
        "scale_scores": {"stress": total_stress, "energy": total_energy},
        "category": category,
        "ai_summary": ai_analysis.get("ai_summary", ""),
        "ai_recommendations": ai_analysis.get("ai_recommendations", []),
        "confidence": 0.85,
        "created_at": current_time
    }
    results_data = read_json(RESULTS_FILEPATH, default={"schema_version": 1, "items": []})
    results_data["items"].append(final_result_entry)
    write_json(RESULTS_FILEPATH, results_data)

    return 200, {"status": "success", "data": final_result_entry}
