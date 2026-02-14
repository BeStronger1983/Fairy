---
name: git-workflow
description: Git 版本控制工作流程。用於 commit、push、branch 管理、PR 操作。使用 Conventional Commits 格式與繁體中文 commit message。
---

# Git Workflow

處理 Git 版本控制相關任務的專業流程。

## Commit 規範

使用 **Conventional Commits 1.0.0** 格式，commit message 使用**繁體中文**。

### 格式

```
<type>(<scope>): <description>

[optional body]
```

### Type 類型

| Type | 說明 |
|------|------|
| `feat` | 新功能 |
| `fix` | 錯誤修復 |
| `docs` | 文件變更 |
| `style` | 格式調整（不影響程式邏輯） |
| `refactor` | 重構（不新增功能也不修復錯誤） |
| `perf` | 效能改進 |
| `test` | 測試相關 |
| `chore` | 雜項維護 |

### 範例

```bash
git commit -m "feat(skills): 新增 git-workflow 技能"
git commit -m "fix(session): 修復空訊息通知問題"
git commit -m "docs: 更新 README 使用說明"
```

## 工作流程

### 1. 提交變更

```bash
# 查看狀態
git status

# 加入所有變更
git add -A

# 或加入特定檔案
git add <file>

# 提交
git commit -m "<type>(<scope>): <description>"

# 推送
git push
```

### 2. 分支管理

```bash
# 建立新分支
git checkout -b feature/<name>

# 切換分支
git checkout <branch>

# 合併分支
git merge <branch>
```

## ⚠️ 重要提醒

**每次完成工作後，一定要 git commit 並 git push！**
