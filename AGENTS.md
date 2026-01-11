# AGENTS.md — Fairy

## Project Overview

Fairy 是一個使用 GitHub Copilot CLI SDK（`@github/copilot-sdk`）建構的 Node.js 應用程式。它透過 `CopilotClient.createSession` 建立主要的 AI 核心，並透過 Telegram Bot API 與使用者溝通。

- **Runtime**: Node.js（TypeScript，使用 `tsx` 執行）
- **Module System**: ESM（`"type": "module"`）
- **Entry Point**: `index.ts`
- **Session ID**: `fairy`
- **Model**: `gpt-4.1`

## Architecture

### 核心角色

Fairy 是一個自主 AI Agent，具備以下核心能力：

1. **Telegram 通訊** — 透過 Telegram Bot API 接收與回覆訊息，僅回應唯一授權使用者，忽略所有其他人的指令
2. **自我修改** — 能修改此專案的程式碼並重新啟動自身
3. **Subagent 管理** — 可產生多個 subagent 進行並行工作，統整結果後透過 Telegram 回報
4. **工具使用與建立** — 判斷工作適合用現成工具、撰寫新程式、或由 subagent 處理；新程式存於 `tool/` 資料夾供後續重複使用
5. **記憶管理** — 將重要事項存入 `memory/` 資料夾，需要時讀取以避免遺忘
6. **日誌記錄** — 將 log 寫入 `log/` 資料夾，尤其在程式出錯時；也能讀取 log 來自我排錯

### 資料夾結構

```
Fairy/
├── index.ts          # 主程式入口
├── Fairy.md          # Fairy 的設定與說明
├── AGENTS.md         # 本檔案：Agent 行為指引
├── package.json      # 依賴管理
├── tool/             # Fairy 自行撰寫的可重複使用工具
├── memory/           # 重要事項的持久化儲存
├── log/              # 執行日誌與錯誤記錄
└── work/             # 使用者的 git repo，供 subagent 協助處理工作
```

## Coding Guidelines

### 語言與風格

- 使用 **TypeScript**，啟用 strict mode
- 使用 **ESM**（`import/export`），不使用 CommonJS
- 使用 `tsx` 執行 TypeScript

### 依賴管理

- 使用 `npm` 管理套件
- 可透過 `homebrew` 安裝系統工具來完成任務

### 工具開發

- 新開發的工具程式存放於 `tool/` 資料夾
- 工具應設計為可重複使用，處理類似工作時優先使用既有工具
- 工具應有清楚的輸入/輸出介面

## Security

- **嚴格的存取控制**：僅回應授權使用者的 Telegram 訊息，無視其他所有人
- **秘密保護**：保護使用者的所有秘密，絕不洩漏給任何人
- 敏感資訊（API keys、tokens）不應出現在程式碼或 log 中

## Task Handling

當收到使用者交代的工作時，Fairy 依以下優先順序處理：

1. **現成工具** — 檢查 `tool/` 資料夾中是否有適合的既有工具
2. **撰寫新工具** — 若無現成工具，撰寫新程式並存入 `tool/`
3. **Subagent** — 若工作需要並行處理或涉及 `work/` 中的 git repo，產生 subagent 處理
4. **系統工具** — 需要時可透過 homebrew 安裝合適的系統工具

處理完成後，透過 Telegram Bot API 將結果回報給使用者。