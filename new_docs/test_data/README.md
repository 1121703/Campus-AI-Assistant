# test_data — 乾淨初始資料

此資料夾內的 JSON 檔案是系統的**乾淨起始狀態**，可直接複製到 `Final/data/` 中使用。

## 使用方式

1. 將本資料夾內所有 `.json` 檔複製到 `Final/data/`
2. 啟動伺服器：`python main.py`
3. 以預設測試帳號登入

## 預設測試帳號

| 欄位 | 值 |
|---|---|
| Email | `test@example.com` |
| 密碼 | `test` |

> 密碼 `test` 的 SHA-256 雜湊為 `9f86d081884c7d659a2feaa0c55ad015a3bf4f1b2b0b822cd15d6c15b0f00a08`

## 各檔案初始狀態說明

| 檔案 | 初始內容 |
|---|---|
| `users.json` | 1 筆預設測試帳號（u_0001） |
| `login_sessions.json` | 空（無登入紀錄） |
| `calendar_tasks.json` | 1 筆範例待辦任務 |
| `calendar_events.json` | 2 筆範例事件（含 1 筆全天事件） |
| `calendar_audit_log.json` | 空 |
| `dashboard_state.json` | u_0001 的預設儀表板設定 |
| `dashboard_actions_log.json` | 空 |
| `dashboard_metrics_weekly.json` | 1 週全零指標 |
| `daily_suggestions.json` | 空（系統啟動後自動生成） |
| `ai_prompt_log.json` | 空 |
| `ai_schedule_suggestions.json` | 空 |
| `ai_schedule_merge_log.json` | 空 |
| `game_sessions.json` | 空 |
| `game_settings.json` | 預設難度 `normal` |
| `psych_question_bank.json` | 5 道基礎題目（人工撰寫，不需 Ollama） |
| `psych_test_sessions.json` | 空 |
| `psych_results.json` | 空 |
| `psych_scoring_rules.json` | 完整計分規則（低/中/高壓力三級） |
| `psych_ai_question_log.json` | 空 |

## 注意事項

- `psych_scoring_rules.json` **必須**有資料，否則心理測驗無法計分
- `psych_question_bank.json` 至少需要 **5 題**，否則測驗無法抽題
- `calendar_events.json` 中 `all_day: true` 的事件不會被 AI 排程衝突偵測擋住
- 若要使用自己的帳號，請透過 `/register` 頁面重新註冊，不要直接修改 `users.json` 的密碼明文
