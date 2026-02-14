# OpenClaw 專案分析與 Fairy 整合建議

> 分析日期：2026-02-14
> 來源：reference/openclaw (git submodule)

## 專案概述

**OpenClaw** 是一個開源的個人 AI 助理專案，支援多頻道整合（WhatsApp、Telegram、Slack、Discord、Google Chat、Signal、iMessage、Microsoft Teams 等），具備語音互動、Canvas 視覺工作區等功能。核心架構為 Gateway 控制平面 + 多種 Channel Adapter。

### 技術堆疊
- **Runtime**: Node.js 22+
- **Language**: TypeScript (ESM)
- **Package Manager**: pnpm
- **主要依賴**:
  - `grammy` - Telegram Bot Framework
  - `@agentclientprotocol/sdk` - ACP SDK
  - `@whiskeysockets/baileys` - WhatsApp Web Client
  - `playwright-core` - Browser 自動化
  - `sharp` - 圖像處理
  - `sqlite-vec` - 向量搜尋

---

## 值得加入 Fairy 的功能

### 1. 🧠 Memory 系統 (高優先) ✅ 已實作

**來源**: `src/memory/`, `extensions/memory-core/`

OpenClaw 實作了完整的記憶系統，包含：
- **向量搜尋**: 使用 `sqlite-vec` 做 embedding 儲存與搜尋
- **Embedding 整合**: 支援 OpenAI、Gemini、Voyage 等多種 embedding provider
- **Memory Tools**: `memory_search`, `memory_get` 等工具

**Fairy 實作**:
參考 OpenClaw 設計，實作於 `src/memory/`：
- `types.ts` - 類型定義
- `embedding-openai.ts` - OpenAI Embedding Provider
- `store.ts` - SQLite 儲存 + 純 TypeScript 向量搜尋
- `manager.ts` - Memory Manager（同步、搜尋）
- `index.ts` - 公開 API

```typescript
// 使用範例
import { getMemoryManager } from './memory/index.js';

const manager = getMemoryManager();
await manager.sync();  // 同步 memory/, tool/ 資料夾

const results = await manager.search('如何使用 API');
// 返回語意最相關的記憶片段
```

**啟用條件**: 設定 `OPENAI_API_KEY` 環境變數

---

### 2. 🎯 Skills 系統 (高優先)

**來源**: `skills/`, `src/plugins/`, SKILL.md 格式

OpenClaw 的 Skills 系統設計精良：
- **SKILL.md 格式**: YAML frontmatter + Markdown 指令
- **Progressive Disclosure**: 三層載入（metadata → body → resources）
- **Bundled Resources**: scripts/, references/, assets/

**SKILL.md 範例**:
```yaml
---
name: coding-agent
description: Run Codex CLI, Claude Code, OpenCode, or Pi Coding Agent via background process
metadata:
  openclaw:
    emoji: "🧩"
    requires:
      anyBins: ["claude", "codex", "opencode", "pi"]
---

# Coding Agent

## Quick Start
...
```

**適合 Fairy 的實作方式**:
- 將 Fairy 的 tool 資料夾升級為 Skills 格式
- 每個 skill 有 SKILL.md 描述、scripts 資料夾
- Subagent 可根據 skill description 判斷何時使用

---

### 3. 🔀 Routing 系統 (中優先)

**來源**: `src/routing/`, `src/agents/agent-scope.ts`

OpenClaw 支援多 agent 路由：
- **Agent Bindings**: 不同 channel/account 路由到不同 agent
- **Session Key**: 統一的 session 識別格式
- **Route Resolution**: 根據 channel + peer 解析目標 agent

**適合 Fairy 的應用**:
- Fairy 可實作 workspace 路由：不同 work/ 資料夾對應不同 subagent 設定
- 根據訊息內容（如關鍵字）自動路由到合適的 subagent

---

### 4. 🪝 Hooks 系統 (中優先)

**來源**: `src/hooks/`

OpenClaw 支援多種 hook 時機：
- `before-tool-call` / `after-tool-call`
- `message` hooks
- `compaction` hooks
- Gmail/Webhook 整合

**適合 Fairy 的實作方式**:
```typescript
// hooks/types.ts 的設計模式
interface HookDefinition {
  name: string;
  trigger: 'message' | 'tool-call' | 'cron';
  handler: string; // script path
}
```

---

### 5. 🛠️ Subagent/Process 管理 (中優先)

**來源**: `src/agents/bash-process-registry.ts`, `src/agents/subagent-registry.ts`

OpenClaw 的 process 管理設計：
- **Background Mode**: 長時間任務用 background:true + sessionId
- **PTY Support**: 互動式終端支援
- **Process Actions**: list, poll, log, write, submit, send-keys, kill

**適合 Fairy 的應用**:
- 升級 Fairy 的 subagent 管理，加入 background process 追蹤
- 可讓 subagent 執行長時間任務，定期回報進度

---

### 6. 📝 Coding Agent 整合 (低優先)

**來源**: `skills/coding-agent/SKILL.md`

OpenClaw 整合多種 coding agent：
- Codex CLI (`codex exec`)
- Claude Code (`claude`)
- OpenCode (`opencode run`)
- Pi Coding Agent (`pi`)

**PTY 模式的關鍵**:
```bash
# 使用 PTY 執行 coding agent
bash pty:true workdir:~/project command:"codex exec 'Your prompt'"
```

**適合 Fairy 的應用**:
- Fairy 的 subagent 可整合外部 coding agent
- 特別是使用 GitHub Copilot CLI SDK，可與 Codex 協作

---

### 7. 🔐 安全策略 (參考)

**來源**: `SECURITY.md`, DM Pairing 機制

OpenClaw 的安全設計：
- **DM Pairing**: 未知發送者需通過配對碼驗證
- **Allowlist**: 明確的白名單控制
- **Sandbox**: 工具執行隔離

**適合 Fairy 的參考**:
- Fairy 已有「只接受我的指令」設計，可參考 allowlist 實作

---

### 8. 📊 使用追蹤與 Session 管理 (參考)

**來源**: `src/sessions/`, `src/agents/usage.ts`

OpenClaw 的 session 設計：
- Session 儲存在 `~/.openclaw/sessions/`
- 支援 session pruning（自動清理過舊的 session）
- Usage tracking（token 用量追蹤）

---

## 實作優先順序建議

| 優先級 | 功能 | 預估工作量 | 價值 | 狀態 |
|--------|------|-----------|------|------|
| 🔴 高 | Memory 系統升級 | 中 | 讓 Fairy 記住重要資訊 | ✅ 完成 |
| 🔴 高 | Skills 格式化 | 低 | 標準化 tool 管理 | ⏳ 待做 |
| 🟡 中 | Routing 系統 | 中 | 多工作區支援 | ⏳ 待做 |
| 🟡 中 | Hooks 系統 | 中 | 自動化觸發 | ⏳ 待做 |
| 🟡 中 | Process 管理 | 中 | 長任務支援 | ⏳ 待做 |
| 🟢 低 | Coding Agent 整合 | 高 | 外部工具協作 | ⏳ 待做 |

---

## 可直接參考的檔案

| 功能 | 檔案路徑 |
|------|---------|
| Memory 系統 | `src/memory/manager.ts` |
| Skills 載入 | `src/agents/skills.ts` |
| Telegram Bot | `src/telegram/bot.ts` |
| Subagent 管理 | `src/agents/subagent-registry.ts` |
| Process 管理 | `src/agents/bash-process-registry.ts` |
| Plugin SDK | `src/plugin-sdk/` |
| Hooks | `src/hooks/hooks.ts` |

---

## 備註

- OpenClaw 使用 MIT License，可自由參考實作
- 專案結構清晰，測試覆蓋完整（70%+ coverage）
- 文件位於 `docs/`，完整度高
