# 重要工作習慣

## Multiple Sessions vs Subagent 區分

⚠️ **這兩個是不同的系統，不要混淆：**

| 術語 | 類型 | 工具/方法 | 程式碼位置 |
|------|------|-----------|-----------|
| **Multiple Sessions** | Fairy 自訂功能 | `create_session`, `send_to_session`, `destroy_session` | `src/ai/multi-session.ts` |
| **Subagent** | Copilot CLI 內建 | `create_subagent`, `send_to_subagent`, `destroy_subagent` | Copilot CLI 內建 |

### 兩者差異

- **Fairy Multiple Sessions**：Fairy 自訂功能，透過 Copilot SDK 的 `createSession` 建立多個獨立的 CopilotSession。Session 設定存於 `session/` 資料夾，有 `request.log` 追蹤用量
- **Copilot CLI Subagent**：Copilot CLI 內建功能，可在 Session 內使用

### ✅ 用量追蹤（已實作）

Fairy Multiple Sessions 的 `send_to_session` 工具會：
1. 追蹤每次 Session 請求的用量
2. 根據 Session 的 model 計算正確的 multiplier
3. 寫入 `request.log`（包含 sessionInfo）
4. 回傳用量資訊給呼叫者

## Git 版本控制
- ⚠️ **每次完成工作後，一定要 git commit 並 git push**
- 使用 Conventional Commits 1.0.0 格式
- Commit message 使用繁體中文

## Memory 使用
- 把重要的事寫進 memory 資料夾
- 有需要時讀取記憶
- tool 資料夾的工具要記錄到 memory

## 文件同步
- 修改程式時，若影響架構或行為，要同步更新：
  - AGENTS.md
  - Fairy.md
  - README.md

## Skills 系統
- Skills 存放於 `.github/skills/` 資料夾
- 採用 Progressive Disclosure：L1(metadata) → L2(body) → L3(resources)
- 新增 Skill 時，要更新 Fairy.md 的「目前可用 Skills」清單

---
建立日期：2026-02-14
最後更新：2026-02-15
