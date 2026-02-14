import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync, unlinkSync } from 'node:fs';
import { resolve } from 'node:path';
import { PROJECT_ROOT } from './config.js';

const MEMORY_DIR = resolve(PROJECT_ROOT, 'memory');

// 確保 memory 目錄存在
mkdirSync(MEMORY_DIR, { recursive: true });

/**
 * 記憶項目的介面
 */
export interface MemoryItem {
    key: string;
    content: string;
    createdAt: string;
    updatedAt: string;
}

/**
 * 取得記憶檔案的完整路徑
 */
function getMemoryPath(key: string): string {
    // 將 key 轉為安全的檔名（移除不安全字元）
    const safeKey = key.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
    return resolve(MEMORY_DIR, `${safeKey}.json`);
}

/**
 * 儲存一項重要記憶
 * @param key 記憶的識別鍵（會成為檔名）
 * @param content 記憶內容
 */
export function saveMemory(key: string, content: string): void {
    const memoryPath = getMemoryPath(key);
    const now = new Date().toISOString();

    let item: MemoryItem;

    if (existsSync(memoryPath)) {
        // 更新現有記憶
        const existing = JSON.parse(readFileSync(memoryPath, 'utf-8')) as MemoryItem;
        item = {
            key,
            content,
            createdAt: existing.createdAt,
            updatedAt: now,
        };
    } else {
        // 建立新記憶
        item = {
            key,
            content,
            createdAt: now,
            updatedAt: now,
        };
    }

    writeFileSync(memoryPath, JSON.stringify(item, null, 2), 'utf-8');
}

/**
 * 讀取一項記憶
 * @param key 記憶的識別鍵
 * @returns 記憶內容，若不存在則返回 null
 */
export function readMemory(key: string): MemoryItem | null {
    const memoryPath = getMemoryPath(key);

    if (!existsSync(memoryPath)) {
        return null;
    }

    return JSON.parse(readFileSync(memoryPath, 'utf-8')) as MemoryItem;
}

/**
 * 刪除一項記憶
 * @param key 記憶的識別鍵
 * @returns 是否成功刪除
 */
export function deleteMemory(key: string): boolean {
    const memoryPath = getMemoryPath(key);

    if (!existsSync(memoryPath)) {
        return false;
    }

    unlinkSync(memoryPath);
    return true;
}

/**
 * 列出所有記憶的鍵
 * @returns 所有記憶的識別鍵陣列
 */
export function listMemories(): string[] {
    if (!existsSync(MEMORY_DIR)) {
        return [];
    }

    return readdirSync(MEMORY_DIR)
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
            const memoryPath = resolve(MEMORY_DIR, file);
            const item = JSON.parse(readFileSync(memoryPath, 'utf-8')) as MemoryItem;
            return item.key;
        });
}

/**
 * 取得所有記憶的摘要（用於快速瀏覽）
 * @returns 所有記憶項目的陣列
 */
export function getAllMemories(): MemoryItem[] {
    if (!existsSync(MEMORY_DIR)) {
        return [];
    }

    return readdirSync(MEMORY_DIR)
        .filter((file) => file.endsWith('.json'))
        .map((file) => {
            const memoryPath = resolve(MEMORY_DIR, file);
            return JSON.parse(readFileSync(memoryPath, 'utf-8')) as MemoryItem;
        });
}
