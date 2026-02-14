---
name: tool-creator
description: 工具開發技能。用於建立可重複使用的腳本或程式。支援 TypeScript、Python、Bash。工具存放於 tool 資料夾，並記錄到 memory/tools.md。
---

# Tool Creator

建立可重複使用的工具程式，存放於 `tool/` 資料夾。

## 何時建立工具

1. **重複性任務** — 相同或類似的操作會多次執行
2. **複雜流程** — 多步驟的程序需要固定執行順序
3. **特定格式處理** — PDF、圖片、文件等特殊格式

## 工具設計原則

### 單一職責

每個工具只做一件事，做好做滿。

### 清楚介面

```typescript
// 好：參數明確
function convertPdf(inputPath: string, outputPath: string, options?: ConvertOptions): Promise<void>

// 不好：參數模糊
function process(data: any): any
```

### 錯誤處理

```typescript
try {
    // 主要邏輯
} catch (error) {
    console.error('[ToolName] Error:', error);
    throw error;
}
```

## 工具存放結構

```
tool/
├── convert-pdf.ts     # 範例：PDF 轉換工具
├── resize-image.py    # 範例：圖片縮放工具
└── backup-db.sh       # 範例：資料庫備份腳本
```

## 建立工具後必做

1. **測試工具** — 確保功能正常
2. **記錄到 memory/tools.md** — 寫下工具名稱、用途、使用方式
3. **Git commit** — 提交變更

## 範例：建立新工具

```bash
# 1. 建立工具檔案
cat > tool/my-tool.ts << 'EOF'
#!/usr/bin/env npx tsx
// My Tool - 工具描述
// 用法: npx tsx tool/my-tool.ts <arg1> <arg2>

const [arg1, arg2] = process.argv.slice(2);
// ... 工具邏輯
EOF

# 2. 測試
npx tsx tool/my-tool.ts test-arg

# 3. 記錄到 memory
# （更新 memory/tools.md）

# 4. 提交
git add tool/my-tool.ts memory/tools.md
git commit -m "feat(tool): 新增 my-tool 工具"
git push
```
