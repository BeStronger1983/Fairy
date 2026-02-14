import { readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

/** 檔案路徑 → 最後修改時間（毫秒） */
export type FileSnapshot = Map<string, number>;

/**
 * 遞迴掃描目錄，收集所有檔案的 mtime
 * 跳過隱藏目錄（.git 等）
 */
function walkDir(dir: string, result: FileSnapshot): void {
    if (!existsSync(dir)) return;

    for (const entry of readdirSync(dir, { withFileTypes: true })) {
        const fullPath = join(dir, entry.name);

        if (entry.isDirectory()) {
            if (entry.name.startsWith('.')) continue;
            walkDir(fullPath, result);
        } else {
            result.set(fullPath, statSync(fullPath).mtimeMs);
        }
    }
}

/**
 * 對 src 目錄建立檔案快照（記錄每個檔案的 mtime）
 * 只監控 src 資料夾，其他資料夾變更不觸發重啟
 */
export function takeSnapshot(projectRoot: string): FileSnapshot {
    const snapshot: FileSnapshot = new Map();
    const srcDir = join(projectRoot, 'src');
    walkDir(srcDir, snapshot);
    return snapshot;
}

/**
 * 比對兩個快照，回傳變更的檔案清單（相對於專案根目錄）
 * 包含新增、修改、刪除的檔案
 */
export function detectChanges(projectRoot: string, before: FileSnapshot, after: FileSnapshot): string[] {
    const changed: string[] = [];

    // 新增或修改的檔案
    for (const [file, mtime] of after) {
        if (!before.has(file) || before.get(file) !== mtime) {
            changed.push(relative(projectRoot, file));
        }
    }

    // 被刪除的檔案
    for (const file of before.keys()) {
        if (!after.has(file)) {
            changed.push(`${relative(projectRoot, file)} (deleted)`);
        }
    }

    return changed;
}
