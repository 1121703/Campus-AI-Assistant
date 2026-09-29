# JSON 資料檔完整說明

所有檔案位於 `Final/data/`，統一格式：

```json
{ "schema_version": 1, "items": [ ... ] }
```

---

## 1. users.json — 使用者帳號

**用途**：儲存所有已註冊使用者，登入時比對密碼雜湊。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `user_id` | string | 唯一識別碼，格式 `u_XXXX`（遞增） |
| `name` | string | 使用者顯示名稱 |
| `email` | string | 登入用 Email（唯一） |
| `password_hash` | string | 格式 `sha256:<hex>`，SHA-256 雜湊 |
| `created_at` | ISO 8601 | 帳號建立時間 |

**寫入時機**：`POST /api/auth/register`

---

## 2. login_sessions.json — 登入 Session

**用途**：記錄每次登入/登出，用於計算「當週登入分鐘數」週報指標。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `session_id` | string | 格式 `s_XXXX`（遞增） |
| `user_id` | string | 對應 `users.json` 的 `user_id` |
| `login_at` | ISO 8601 | 登入時間 |
| `logout_at` | ISO 8601 \| null | 登出時間；尚未登出為 `null` |
| `duration_sec` | number \| null | 本次登入秒數；登出時才計算填入 |
| `active` | boolean | `true` = 目前登入中，`false` = 已登出 |

**寫入時機**：登入時 append（`active: true`）；登出時更新最後一筆（`active: false`）

---

## 3. calendar_tasks.json — 任務清單

**用途**：待辦任務（作業、考試準備等），行事曆頁主要資料來源之一。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `task_id` | string | 格式 `t_XXXX`（遞增） |
| `user_id` | string | 所屬使用者 |
| `title` | string | 任務名稱 |
| `course` | string | 對應課程；不屬於課程時為空字串 |
| `due_at` | ISO 8601 | 截止時間 |
| `status` | string | `pending` / `completed` / `archived` |
| `completed_at` | ISO 8601 \| null | 完成時間；未完成為 `null` |
| `source` | string | `manual`（手動新增）或未來擴充來源 |
| `note` | string | 備註說明 |
| `created_at` | ISO 8601 | 建立時間 |
| `updated_at` | ISO 8601 | 最後更新時間 |

**寫入時機**：
- 新增任務：`POST /api/calendar/tasks`
- 更新/完成：`PUT /api/calendar/tasks/{id}`
- 完成：`POST /api/calendar/tasks/{id}/complete`
- 刪除（軟刪）：`DELETE /api/calendar/tasks/{id}` → 設 `status: archived`

---

## 4. calendar_events.json — 行事曆事件

**用途**：固定日程事件（考試、假期、會議等），含 AI 建議後被接受的排程。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `event_id` | string | 格式 `e_XXXX`；AI 新增為 `e_{timestamp}` |
| `user_id` | string | 所屬使用者 |
| `title` | string | 事件名稱 |
| `start_at` | ISO 8601 | 開始時間 |
| `end_at` | ISO 8601 | 結束時間 |
| `all_day` | boolean | `true` = 全天事件（假日、期末週等）；**不計入排程衝突** |
| `location` | string | 地點（選填） |
| `note` | string | 備註 |
| `source` | string | `manual`（手動）或 `AI聊聊`（AI 排程） |
| `linked_suggestion_id` | string \| null | AI 排程時對應的 `ai_schedule_suggestions` 之 `suggestion_id` |
| `status` | string | `active` / `cancelled` |
| `is_archived` | boolean | AI 新增事件用，`false` = 有效 |
| `source_suggestion` | string | AI 排程時記錄來源 suggestion_id |
| `created_at` | ISO 8601 | 建立時間 |

**重要規則**：`all_day: true` 的事件（如假日、期末週）在 AI 排程衝突偵測時會被**跳過**，不會導致新排程被推走。

**寫入時機**：
- 手動：`POST /api/calendar/events`
- AI 接受建議：`POST /api/ai/accept_schedule`

---

## 5. calendar_audit_log.json — 行事曆操作紀錄

**用途**：記錄所有任務/事件的新增、修改、刪除，用於除錯與稽核。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `log_id` | string | 格式 `log_{timestamp}` |
| `user_id` | string | 操作者 |
| `action` | string | `create_task` / `update_task` / `delete_task` / `create_event` / `delete_event` / `complete_task` |
| `target_id` | string | 被操作的任務/事件 ID |
| `detail` | object | 操作前後的變更細節 |
| `created_at` | ISO 8601 | 操作時間 |

---

## 6. dashboard_state.json — 儀表板 UI 狀態

**用途**：儲存每位使用者的儀表板個人化設定（選中的週、已摺疊的卡片等）。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `user_id` | string | 所屬使用者 |
| `selected_week_start` | string | 選中的週一日期，格式 `YYYY-MM-DD` |
| `show_completed_tasks` | boolean | 是否顯示已完成任務 |
| `collapsed_cards` | array | 已摺疊的卡片名稱清單 |
| `updated_at` | ISO 8601 | 最後更新時間 |

---

## 7. dashboard_actions_log.json — 儀表板操作紀錄

**用途**：記錄使用者在儀表板上的互動行為。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `log_id` | string | 格式 `act_{timestamp}` |
| `user_id` | string | 操作者 |
| `action` | string | `toggle_card` / `suggest-done` / `suggest-skip` / `complete_task` |
| `target` | string | 操作對象（卡片名稱、建議 ID 等） |
| `created_at` | ISO 8601 | 操作時間 |

---

## 8. dashboard_metrics_weekly.json — 每週統計指標

**用途**：提供儀表板「本週學習概況」圖表的資料來源。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `week_start` | string | 該週週一日期，格式 `YYYY-MM-DD` |
| `user_id` | string | 所屬使用者 |
| `daily_login_minutes` | object | 鍵為日期字串，值為當天登入分鐘數 |
| `tasks_due` | object | 鍵為日期字串，值為當天到期任務數 |
| `tasks_done` | object | 鍵為日期字串，值為當天完成任務數 |
| `updated_at` | ISO 8601 | 最後更新時間 |

---

## 9. daily_suggestions.json — 每日任務建議

**用途**：儀表板「今日建議」區塊，由規則引擎或 AI 自動生成待辦建議。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `suggestion_id` | string | 格式 `ds_{date}_{n}` |
| `user_id` | string | 所屬使用者 |
| `date` | string | 建議適用日期，格式 `YYYY-MM-DD` |
| `title` | string | 建議標題 |
| `description` | string | 建議說明 |
| `priority` | string | `high` / `medium` / `low` |
| `category` | string | `study` / `rest` / `health` 等 |
| `status` | string | `pending` / `done` / `skipped` |
| `source` | string | `rule_engine` 或 AI 模型名稱 |
| `created_at` | ISO 8601 | 建立時間 |

---

## 10. ai_prompt_log.json — AI 對話紀錄

**用途**：記錄所有 AI 對話（聊聊 + 心理分析），包含使用者輸入與 AI 回覆，供審核與分析。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `prompt_id` | string | 格式 `ai_{timestamp}` |
| `user_id` | string | 所屬使用者 |
| `purpose` | string | `chat_general` / `chat_schedule` / `counseling_chat` |
| `prompt_text` | string | 使用者輸入的原始訊息 |
| `response_text` | string | AI 回覆內容 |
| `model` | string | 使用的 AI 模型，如 `qwen3:1.7b` |
| `created_at` | ISO 8601 | 對話時間 |

---

## 11. ai_schedule_suggestions.json — AI 排程建議

**用途**：儲存 AI 聊天產生的排程建議（尚未被使用者接受）。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `suggestion_id` | string | 格式 `sug_{timestamp}` |
| `user_id` | string | 所屬使用者 |
| `proposed_event` | object | 建議的事件物件（含 `title`, `start_at`, `end_at`, `source`, `is_archived`） |
| `proposed_event.title` | string | 事件名稱 |
| `proposed_event.start_at` | ISO 8601 | 建議開始時間（台灣時間 `+08:00`） |
| `proposed_event.end_at` | ISO 8601 | 建議結束時間 |
| `proposed_event.source` | string | 固定為 `AI聊聊` |
| `conflicts` | array | 衝突事件清單（空陣列表示無衝突） |
| `conflicts[].event_id` | string | 衝突事件的 ID |
| `conflicts[].title` | string | 衝突事件名稱 |
| `conflicts[].overlap_min` | number | 重疊分鐘數 |
| `reason` | string | 建議說明與衝突調整說明 |
| `created_at` | ISO 8601 | 建立時間 |

---

## 12. ai_schedule_merge_log.json — AI 排程接受紀錄

**用途**：記錄使用者點「接受建議」後的操作，確認哪些 AI 排程已被正式加入行事曆。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `log_id` | string | 格式 `add_{timestamp}` |
| `user_id` | string | 所屬使用者 |
| `action` | string | 固定為 `add_only` |
| `added_event_ids` | array | 新增的 `event_id` 清單 |
| `source_suggestion_id` | string | 對應的 `suggestion_id` |
| `created_at` | ISO 8601 | 操作時間 |

---

## 13. game_sessions.json — 遊戲場次紀錄

**用途**：每次遊戲結束後寫入成績，供遊戲頁歷史紀錄顯示。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `session_id` | string | 格式 `g_{randomhex}` |
| `user_id` | string | 所屬使用者 |
| `difficulty` | string | `easy` / `normal` / `hard` |
| `score` | number | 本場得分（整數） |
| `duration_sec` | number | 遊戲持續秒數 |
| `ended_at` | ISO 8601 | 遊戲結束時間 |

---

## 14. game_settings.json — 遊戲難度設定

**用途**：儲存使用者最後選擇的遊戲難度，下次進入時作為預設值。每次設定都 append 一筆，取最新一筆為當前設定。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `user_id` | string | 所屬使用者 |
| `difficulty_default` | string | `easy` / `normal` / `hard` |
| `updated_at` | ISO 8601 | 設定時間 |

---

## 15. psych_question_bank.json — 心理測驗題庫

**用途**：儲存所有可用的心理測驗題目，測驗時隨機抽取 5 題。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `question_id` | string | 格式 `q_{hex}` |
| `text` | string | 題目文字 |
| `options` | array | 選項清單，每個選項為 `{ text, stress_weight, energy_weight }` |
| `options[].text` | string | 選項顯示文字 |
| `options[].stress_weight` | number | 選此選項對壓力分數的貢獻值（整數） |
| `options[].energy_weight` | number | 選此選項對能量分數的貢獻值（整數） |
| `tags` | array | 題目分類標籤，如 `["stress", "sleep", "social_pressure"]` |
| `source` | string | 題目來源，如 `gemini-2.5-flash` / `qwen3:1.7b` |
| `created_at` | ISO 8601 | 建立時間 |

---

## 16. psych_test_sessions.json — 心理測驗場次

**用途**：記錄每次測驗的題目與作答，與 `psych_results.json` 以 `session_id` 關聯。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `session_id` | string | 格式 `ps_{hex}` |
| `user_id` | string | 所屬使用者 |
| `questions` | array | 本次抽到的題目 ID 清單 |
| `answers` | array | 使用者的作答，每筆為 `{ question_id, option_index, stress_weight, energy_weight }` |
| `score_total` | number | 各選項 `stress_weight` 總和 |
| `started_at` | ISO 8601 | 開始時間 |
| `completed_at` | ISO 8601 | 完成時間 |

---

## 17. psych_results.json — 心理測驗結果

**用途**：儲存每次測驗的計分結果與 AI 諮詢摘要，心理分析頁面讀取最近 5 筆。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `result_id` | string | 格式 `pr_{hex}` |
| `session_id` | string | 對應 `psych_test_sessions.json` 的 `session_id` |
| `user_id` | string | 所屬使用者 |
| `rule_id` | string | 使用的計分規則，對應 `psych_scoring_rules.json` |
| `score_total` | number | 總分（各選項 `stress_weight` 加總） |
| `scale_scores` | object | 分項分數 `{ stress: number, energy: number }` |
| `scale_scores.stress` | number | 壓力指數（0–100 標準化後） |
| `scale_scores.energy` | number | 能量指數（0–100 標準化後） |
| `category` | string | `低壓力` / `中度壓力` / `高壓力` |
| `ai_summary` | string | AI 生成的個人化摘要文字 |
| `ai_recommendations` | array | AI 生成的建議清單（string[]） |
| `confidence` | number | AI 回覆信心分數（0.0–1.0），目前固定 `0.85` |
| `created_at` | ISO 8601 | 結果建立時間 |

---

## 18. psych_scoring_rules.json — 計分規則

**用途**：定義壓力等級的閾值範圍與 AI 離線時的 fallback 回覆，目前只有 `rule_0001`。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `rule_id` | string | 規則識別碼，格式 `rule_XXXX` |
| `name` | string | 規則名稱，目前為 `stress_v1` |
| `scales` | array | 使用的計分維度，`["stress", "energy"]` |
| `thresholds` | array | 等級定義清單 |
| `thresholds[].category` | string | 等級名稱（`低壓力` / `中度壓力` / `高壓力`） |
| `thresholds[].min` | number | 分數下界（包含） |
| `thresholds[].max` | number | 分數上界（包含） |
| `thresholds[].fallback_summary` | string | AI 離線時顯示的備用摘要 |
| `thresholds[].fallback_recommendations` | array | AI 離線時顯示的備用建議 |
| `created_at` | ISO 8601 | 規則建立時間 |

---

## 19. psych_ai_question_log.json — AI 出題紀錄

**用途**：記錄每次呼叫 AI 生成心理測驗題目的過程。

| 欄位 | 型態 | 說明 |
|---|---|---|
| `log_id` | string | 格式 `qgen_{timestamp}` |
| `model` | string | 使用的 AI 模型 |
| `prompt` | string | 送給 AI 的 prompt |
| `generated_questions` | array | AI 回傳的題目清單 |
| `created_at` | ISO 8601 | 生成時間 |
