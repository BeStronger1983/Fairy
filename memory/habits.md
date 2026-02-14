# 重要工作習慣

## Subagent vs Multiple Sessions 區分

⚠️ **這兩個是不同的系統，要根據用戶用語來選擇：**

| 用戶說的 | 使用的系統 | 工具/方法 |
|----------|------------|-----------|
| **「subagent」** | Copilot CLI 內建 | `create_subagent`, `send_to_subagent`, `destroy_subagent` |
| **「Multiple Sessions」** | Fairy 程式功能 | `src/ai/subagent.ts` 的自訂工具 |
| **沒有明說** | 自行判斷 | 根據任務特性選擇適合的系統 |

### 兩者差異

- **Copilot CLI subagent**：CLI 環境下的 agent，追蹤由 GitHub 管理
- **Fairy Multiple Sessions**：Fairy Bot 內部的多 session 管理，有 `request.log` 追蹤

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
最後更新：2026-02-14
