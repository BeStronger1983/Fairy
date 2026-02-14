# Fairy

Fairy 是一個自主 AI Agent，使用 [GitHub Copilot CLI SDK](https://www.npmjs.com/package/@github/copilot-sdk) 作為 AI 核心，透過 Telegram Bot 與你溝通。你可以在 Telegram 上對 Fairy 下達指令，Fairy 會自動判斷如何完成任務並回覆結果。

**只有你（授權使用者）能與 Fairy 對話**，所有其他人的訊息會被靜默忽略。

## 支援平台

- **macOS** ✓
- **Linux** ✓
- **Windows** ✓

## 功能

- **Telegram 通訊** — 透過 Telegram Bot 接收指令、回覆結果
- **單一使用者存取控制** — 僅回應授權使用者，其他人的訊息完全忽略
- **自我修改** — 能修改自身程式碼並重新啟動
- **Subagent 管理** — 產生多個 subagent 並行處理工作
- **工具建立與重用** — 自動將新寫的工具存入 `tool/`，後續可重複使用
- **記憶持久化** — 重要事項存入 `memory/`，不會遺忘
- **日誌記錄** — 執行日誌與錯誤記錄寫入 `log/`
- **Skills 系統** — 模組化的知識包，整合 `.github/skills/` 與 `tool/`，支援智慧匹配
- **跨平台支援** — 可在 macOS、Linux、Windows 上執行


## 前置需求

- **Node.js** >= 18
- **npm**
- **GitHub Copilot CLI SDK** 的存取權限（**必須訂閱 [GitHub Copilot](https://github.com/features/copilot/plans)**，否則無法使用 Copilot CLI 與 SDK）
- 一個 **Telegram 帳號**

## 設定

### 第一步：建立 Telegram Bot

1. 開啟 Telegram，搜尋 **@BotFather** 並開始對話
2. 傳送 `/newbot`
3. 輸入 Bot 的**顯示名稱**，例如 `Fairy`
4. 輸入 Bot 的 **username**（必須以 `bot` 結尾），例如 `MyFairyBot`
5. BotFather 會回覆一組 **Bot Token**，格式如下：

   ```
   7123456789:AAH1234abcd5678efgh-XYZTOKEN
   ```

6. **複製並保存這組 Token**，這就是 `TELEGRAM_BOT_TOKEN`

> **安全提醒**：Bot Token 等同於 Bot 的密碼，請勿公開或提交到版本控制。

### 第二步：取得你的 Telegram User ID

你的 Telegram User ID 是一組純數字，用來限制只有你能與 Fairy 對話。

取得方式（擇一）：

- **方法 A**：在 Telegram 搜尋 **@userinfobot**，傳送任意訊息，它會回覆你的 User ID
- **方法 B**：在 Telegram 搜尋 **@RawDataBot**，傳送任意訊息，在回覆的 JSON 中找到 `"id"` 欄位

記下這組數字，這就是 `TELEGRAM_AUTHORIZED_USER_ID`。

### 第三步：安裝依賴

```bash
git clone <repo-url> Fairy
cd Fairy
npm install
```

### 第四步：設定環境變數

Fairy 需要兩個環境變數：

| 環境變數 | 說明 | 範例 |
|---|---|---|
| `TELEGRAM_BOT_TOKEN` | BotFather 給你的 Bot Token | `7123456789:AAH1234abcd...` |
| `TELEGRAM_AUTHORIZED_USER_ID` | 你的 Telegram User ID（純數字） | `123456789` |

設定方式依作業系統而異：

#### macOS / Linux

**方式 A：直接 export（暫時）**

```bash
export TELEGRAM_BOT_TOKEN="你的Bot Token"
export TELEGRAM_AUTHORIZED_USER_ID="你的User ID"
```

**方式 B：寫在 `.env` 檔案中搭配 direnv 或手動 source**

在專案根目錄建立 `.env` 檔案：

```env
TELEGRAM_BOT_TOKEN=7123456789:AAH1234abcd5678efgh-XYZTOKEN
TELEGRAM_AUTHORIZED_USER_ID=123456789
```

然後在啟動前 source：

```bash
source .env
```

**方式 C：寫在 shell profile（永久）**

將 export 語句加入 `~/.bashrc`、`~/.zshrc` 或其他 shell 設定檔：

```bash
echo 'export TELEGRAM_BOT_TOKEN="你的Bot Token"' >> ~/.zshrc
echo 'export TELEGRAM_AUTHORIZED_USER_ID="你的User ID"' >> ~/.zshrc
source ~/.zshrc
```

#### Windows

**方式 A：使用 PowerShell（暫時）**

```powershell
$env:TELEGRAM_BOT_TOKEN = "你的Bot Token"
$env:TELEGRAM_AUTHORIZED_USER_ID = "你的User ID"
```

**方式 B：使用 CMD（暫時）**

```cmd
set TELEGRAM_BOT_TOKEN=你的Bot Token
set TELEGRAM_AUTHORIZED_USER_ID=你的User ID
```

**方式 C：系統環境變數（永久）**

1. 按下 `Win + R`，輸入 `sysdm.cpl` 按 Enter
2. 選擇「進階」標籤，點擊「環境變數」
3. 在「使用者變數」區塊，點擊「新增」
4. 分別新增以下兩個變數：
   - 變數名稱：`TELEGRAM_BOT_TOKEN`，變數值：你的 Bot Token
   - 變數名稱：`TELEGRAM_AUTHORIZED_USER_ID`，變數值：你的 User ID
5. 點擊「確定」儲存，重新開啟終端機

**方式 D：使用 PowerShell 設定永久環境變數**

```powershell
[System.Environment]::SetEnvironmentVariable("TELEGRAM_BOT_TOKEN", "你的Bot Token", "User")
[System.Environment]::SetEnvironmentVariable("TELEGRAM_AUTHORIZED_USER_ID", "你的User ID", "User")
```

> 請確保 `.env` 已加入 `.gitignore`，避免敏感資訊被提交。

## 啟動

### 跨平台啟動（推薦）

所有平台都可使用：

```bash
npm start
```

這會執行 `start.js`，自動偵測作業系統並使用對應的方式啟動。

### 平台專屬啟動

#### macOS / Linux

```bash
# 方式 1：透過 npm
npm start

# 方式 2：直接執行 Bash 腳本
./start.sh
```

#### Windows

```cmd
REM 方式 1：透過 npm
npm start

REM 方式 2：直接執行批次檔
start.cmd
```

#### 開發模式（不自動重啟）

```bash
npm run start:dev
```

啟動後你會看到類似以下的輸出：

```
[Fairy] Initializing…
[Fairy] Session "fairy" created with model gpt-4.1
[Fairy] Boot confirmation: 我是 Fairy，已成功啟動。
[Fairy] Telegram Bot @MyFairyBot started
[Fairy] Authorized user ID: 123456789
[Fairy] Ready.
```

此時在 Telegram 打開你的 Bot 對話，傳送訊息即可開始與 Fairy 互動。

## 專案結構

```
Fairy/
├── src/
│   ├── index.ts         # 入口，啟動流程與優雅關閉
│   ├── config.ts        # 環境變數、常數、system prompt 載入
│   ├── logger.ts        # 日誌工具
│   ├── skills.ts        # Skills 系統（Progressive Disclosure + 智慧匹配）
│   ├── ai/
│   │   ├── session.ts   # AI 核心 session 建立與事件訂閱
│   │   ├── subagent.ts  # Subagent 管理
│   │   ├── skill-tools.ts  # Skill 管理工具
│   │   └── tool-tools.ts   # Tool 管理工具
│   └── telegram/
│       └── bot.ts       # Telegram Bot 建立、權限控制、訊息處理
├── .github/skills/   # Skills 定義（SKILL.md 格式）
├── start.js          # 跨平台啟動腳本（Node.js，推薦）
├── start.sh          # macOS/Linux 啟動腳本（Bash）
├── start.cmd         # Windows 啟動腳本（批次檔）
├── Fairy.md          # Fairy 的人設與行為設定
├── AGENTS.md         # Agent 開發指引
├── package.json      # 依賴管理
├── tool/             # Fairy 自動建立的可重複使用工具（自動整合到 Skills）
├── memory/           # 重要事項的持久化儲存
├── log/              # 執行日誌與錯誤記錄
├── subagent/         # Subagent 設定檔（每次啟動時清空，異動不觸發重啟）
└── work/             # 放置你的 git repo，供 Fairy 的 subagent 協助處理
```

## 存取控制機制

Fairy 的存取控制實作在 Telegram Bot 的 middleware 層：

1. 每則收到的訊息都會檢查發送者的 User ID
2. 若 User ID **不等於** `TELEGRAM_AUTHORIZED_USER_ID`，該訊息被**靜默丟棄**（不回覆、不處理）
3. 只有授權使用者的訊息會被轉發到 AI 核心處理

這代表即使有人找到你的 Bot 並傳送訊息，Fairy 也不會有任何反應。

## 原始碼模組化說明

自 2026/02/14 起，Fairy 採用 src/ 目錄下多檔案模組化設計：

- `src/index.ts`：主程式入口，負責啟動流程與優雅關閉
- `src/config.ts`：環境變數、常數、system prompt 載入
- `src/logger.ts`：日誌寫入工具
- `src/skills.ts`：Skills 系統，實作 Progressive Disclosure 三層載入與智慧匹配
- `src/file-snapshot.ts`：檔案快照與變更偵測，用於判斷是否需要重啟
- `src/ai/session.ts`：AI 核心 session 建立、事件訂閱、啟動驗證
- `src/ai/subagent.ts`：Subagent 管理模組，負責建立、儲存、查詢、銷毀 subagent
- `src/ai/skill-tools.ts`：Skill 管理工具，供 AI 查詢、載入、使用 skills
- `src/ai/tool-tools.ts`：Tool 管理工具，供 AI 儲存、執行工具
- `src/telegram/bot.ts`：Telegram Bot 建立、權限 middleware、訊息處理、問候

各模組職責分明，複雜邏輯皆有 zh-tw 註解，便於維護與擴充。

## 日誌

執行日誌寫入 `log/fairy.log`，包含：

- 啟動與關閉事件
- 收到的訊息與回覆摘要
- 被拒絕的未授權訊息紀錄
- 錯誤訊息

## 停止

在終端按 `Ctrl+C` 即可優雅關閉 Fairy（會自動清理 AI session 與 Bot 連線）。

## 文件維護

專案有任何修改時，若影響到架構、功能、行為規則或使用方式，必須同步更新以下文件：

- `AGENTS.md` — Agent 行為指引與開發規範
- `Fairy.md` — Fairy 的設定與行為說明
- `README.md` — 專案說明與使用文件

## 技術棧

- **Runtime**: Node.js + TypeScript（透過 [tsx](https://github.com/privatenumber/tsx) 直接執行）
- **AI Core**: [@github/copilot-sdk](https://www.npmjs.com/package/@github/copilot-sdk)（`CopilotClient.createSession`）
- **Telegram**: [grammY](https://grammy.dev/)（TypeScript-native Telegram Bot framework）
- **Model**: `gpt-4.1`
