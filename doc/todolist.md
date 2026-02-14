# Fairy 待辦功能清單

> 從 openclaw.md 與 THE PERSONAL PANOPTICON.md 整理出 Fairy 值得加上的功能

## 待實作功能

- **Skills 系統**：把 tool 資料夾升級為 Skills 格式（每個 skill 有 SKILL.md 描述 + scripts 資料夾），讓 Fairy 能更聰明地判斷何時使用哪個工具
- **Routing 路由系統**：不同 work/ 資料夾對應不同的 subagent 設定，或根據訊息關鍵字自動派工給合適的 subagent
- **Hooks 自動觸發**：支援在特定時機（如收到訊息前後、工具執行前後）自動執行腳本
- **Cron 排程任務**：讓 Fairy 能定時執行任務（例如每天早上抓取資料、整理報告）
- **背景長任務**：subagent 能執行長時間任務，定期回報進度，完成後通知我
- **多頻道整合**：除了 Telegram，也支援 Discord、Slack 等其他通訊軟體
- **桌面自動化**：當沒有 API 時，Fairy 能透過模擬滑鼠鍵盤操作桌面應用程式
- **外部 Coding Agent 整合**：整合 Codex CLI、Claude Code 等外部 coding agent 協作
- **平行 Agent 群集**：像 Personal Panopticon 那樣同時運行多個專門的 agent 實例（~/nox、~/email、~/trades 等）
- **自動財務追蹤**：自動抓取訂閱服務、發票、帳單，找出被遺忘的支出
- **Session 用量追蹤**：追蹤 token 使用量，了解每次對話消耗多少資源
- **思考軌跡記錄**：記錄 Fairy 的所有思考過程與決策，用於自我改進
