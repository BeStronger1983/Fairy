# Fairy 待辦功能清單

> 從網路搜尋、GitHub 趨勢專案、openclaw.md、THE PERSONAL PANOPTICON.md 整理出 Fairy 值得加上的功能
> 目標：打造像 Jarvis 一樣強大的 AI Agent

---

## 🔴 高優先（核心能力增強）

### 語音互動
- **語音輸入**：支援語音訊息，Fairy 可以聽懂我說的話
- **語音輸出**：Fairy 可以用語音回覆，而不只是文字（TTS）
- **喚醒詞**：像「Hey Fairy」這樣的喚醒詞來啟動對話

### 進階記憶系統（參考 MIRIX）
- **多層記憶架構**：Core Memory（核心）、Episodic（情節）、Semantic（語義）、Procedural（程序）、Resource（資源）、Knowledge（知識）
- **記憶衰減**：長期未存取的記憶自動淡化，重要記憶保持鮮明
- **螢幕活動追蹤**：記錄我的螢幕活動，建立上下文記憶（像 Rewind.ai）

### 自主技能生成（參考 Leon AI）
- **自我編碼**：Fairy 能自己寫新的 Skills/Tools，不需要我手動寫
- **Skill Store**：建立技能市集，可以安裝社群開發的技能

---

## 🟡 中優先（自動化與整合）

### 排程與自動化
- **Cron 排程任務**：讓 Fairy 能定時執行任務（每天早上抓取資料、整理報告、發送提醒）
- **Hooks 自動觸發**：支援在特定時機（如收到訊息前後、工具執行前後）自動執行腳本
- **背景長任務**：Session 能執行長時間任務，定期回報進度，完成後通知我

### 通訊整合（參考 OpenClaw）
- **多平台支援**：除了 Telegram，也支援 Discord、Slack、LINE、WhatsApp
- **Email 整合**：讀取、撰寫、發送 Email
- **日曆整合**：讀取 Google Calendar / Apple Calendar，提醒行程

### 智慧路由
- **Routing 路由系統**：不同 work/ 資料夾對應不同的 Session 設定
- **意圖識別**：根據訊息內容自動派工給合適的 Session 或 Skill
- **多 Workspace 管理**：不同專案有不同的上下文和工具集

### 外部服務整合
- **GitHub 深度整合**：PR Review、Issue 管理、自動化 CI/CD
- **Notion/Obsidian 整合**：讀寫筆記，建立知識庫連結
- **財務追蹤**：自動抓取訂閱服務、發票、帳單，找出被遺忘的支出

---

## 🟢 低優先（進階功能）

### 電腦控制（Computer-Use，參考 CUA/Anthropic）
- **桌面自動化**：Fairy 能透過模擬滑鼠鍵盤操作桌面應用程式
- **螢幕理解**：Fairy 能看懂螢幕上的內容，進行 GUI 自動化
- **瀏覽器自動化**：自動填表單、爬取網頁資料

### 多 Agent 協作（參考 AutoGen）
- **平行 Agent 群集**：同時運行多個專門的 agent 實例（~/nox、~/email、~/trades 等）
- **Agent 間通訊**：不同 Agent 可以互相溝通、傳遞任務
- **分散式任務**：大任務自動拆解給多個 Agent 並行處理

### 學習與進化
- **思考軌跡記錄**：記錄 Fairy 的所有思考過程與決策
- **自我反思**：定期回顧過去的決策，學習改進
- **偏好學習**：從我的回饋中學習我的偏好和習慣

### 安全與隱私
- **本地優先**：敏感資料優先在本地處理，減少上傳到雲端
- **權限控制**：危險操作需要我確認才能執行
- **審計日誌**：所有操作都有完整的可追溯記錄

### MCP 支援（Model Context Protocol）
- **MCP Server**：讓 Fairy 支援 MCP 協議，可以被其他工具調用
- **MCP Client**：Fairy 可以調用其他 MCP Server 的功能

---

## 📚 參考資源

| 專案 | 亮點功能 | GitHub |
|------|----------|--------|
| **MIRIX** | 多層記憶系統、螢幕追蹤 | github.com/Mirix-AI/MIRIX |
| **Leon AI** | 自主技能生成、本地優先 | github.com/leon-ai/leon |
| **OpenClaw** | 多平台通訊、Skill Store | github.com/openclaw/openclaw |
| **CUA** | 電腦控制、桌面自動化 | github.com/trycua/cua |
| **AutoGen** | 多 Agent 協作 | github.com/microsoft/autogen |
| **Activepieces** | 工作流自動化、400+ MCP | github.com/activepieces/activepieces |
| **CowAgent** | 主動思考、任務規劃 | github.com/zhayujie/chatgpt-on-wechat |

---

## 💡 靈感來源

- **Jarvis (Iron Man)**：語音互動、主動建議、全方位助手
- **Personal Panopticon**：平行 Agent 群集、思考軌跡記錄
- **Rewind.ai**：螢幕活動記錄、上下文記憶
- **OpenClaw**：多平台整合、Skill 生態系統

---

*最後更新：2026-02-15*
