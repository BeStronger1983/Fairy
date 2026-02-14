/**
 * Tool Manager
 *
 * 管理 tool 資料夾中的自訂工具程式
 * - 儲存新建立的工具程式
 * - 將工具資訊記錄到 memory，方便日後查詢使用
 * - 列出、搜尋可用工具
 */
import {
    readFileSync,
    writeFileSync,
    readdirSync,
    existsSync,
    mkdirSync,
    statSync
} from 'node:fs';
import { resolve, extname, basename } from 'node:path';
import { execSync } from 'node:child_process';

import { PROJECT_ROOT } from './config.js';
import { saveMemory, readMemory, getAllMemories } from './memory.js';
import { writeLog } from './logger.js';

// ---------- 常數 ----------

/** tool 資料夾路徑 */
const TOOL_DIR = resolve(PROJECT_ROOT, 'tool');

/** 記憶 key 前綴，用於識別 tool 相關記憶 */
const TOOL_MEMORY_PREFIX = 'tool:';

// ---------- 型別定義 ----------

/** 工具資訊介面 */
export interface ToolInfo {
    /** 工具名稱（不含副檔名） */
    name: string;
    /** 工具用途描述 */
    description: string;
    /** 使用方式說明 */
    usage: string;
    /** 程式語言 */
    language: 'typescript' | 'javascript' | 'python' | 'bash' | 'other';
    /** 檔案路徑（相對於 tool 資料夾） */
    filename: string;
    /** 建立時間 */
    createdAt: string;
    /** 更新時間 */
    updatedAt: string;
}

// ---------- 工具函式 ----------

/**
 * 確保 tool 目錄存在
 */
function ensureToolDir(): void {
    if (!existsSync(TOOL_DIR)) {
        mkdirSync(TOOL_DIR, { recursive: true });
    }
}

/**
 * 根據副檔名判斷程式語言
 */
function detectLanguage(filename: string): ToolInfo['language'] {
    const ext = extname(filename).toLowerCase();
    switch (ext) {
        case '.ts':
            return 'typescript';
        case '.js':
        case '.mjs':
        case '.cjs':
            return 'javascript';
        case '.py':
            return 'python';
        case '.sh':
        case '.bash':
            return 'bash';
        default:
            return 'other';
    }
}

/**
 * 取得工具的記憶 key
 */
function getToolMemoryKey(name: string): string {
    return `${TOOL_MEMORY_PREFIX}${name}`;
}

// ---------- 公開 API ----------

/**
 * 儲存新工具到 tool 資料夾，並記錄到 memory
 *
 * @param name - 工具名稱（會成為檔名的一部分）
 * @param code - 工具程式碼
 * @param description - 工具用途描述
 * @param usage - 使用方式說明
 * @param extension - 副檔名（預設 .ts）
 * @returns 完整的工具資訊
 */
export function saveTool(
    name: string,
    code: string,
    description: string,
    usage: string,
    extension: string = '.ts'
): ToolInfo {
    ensureToolDir();

    // 產生安全的檔名
    const safeName = name.replace(/[^a-zA-Z0-9\u4e00-\u9fff_-]/g, '_');
    const filename = `${safeName}${extension}`;
    const filepath = resolve(TOOL_DIR, filename);

    // 寫入程式碼檔案
    writeFileSync(filepath, code, 'utf-8');

    const now = new Date().toISOString();
    const language = detectLanguage(filename);

    // 建立工具資訊
    const toolInfo: ToolInfo = {
        name: safeName,
        description,
        usage,
        language,
        filename,
        createdAt: now,
        updatedAt: now
    };

    // 儲存到 memory
    saveMemory(getToolMemoryKey(safeName), JSON.stringify(toolInfo, null, 2));

    console.log(`[Fairy] Tool saved: ${filename}`);
    writeLog(`Tool saved: ${filename} - ${description}`);

    return toolInfo;
}

/**
 * 更新現有工具的程式碼
 *
 * @param name - 工具名稱
 * @param code - 新的程式碼
 * @returns 更新後的工具資訊，若工具不存在則回傳 null
 */
export function updateToolCode(name: string, code: string): ToolInfo | null {
    const memory = readMemory(getToolMemoryKey(name));
    if (!memory) {
        return null;
    }

    const toolInfo = JSON.parse(memory.content) as ToolInfo;
    const filepath = resolve(TOOL_DIR, toolInfo.filename);

    // 寫入新程式碼
    writeFileSync(filepath, code, 'utf-8');

    // 更新時間戳
    toolInfo.updatedAt = new Date().toISOString();

    // 更新 memory
    saveMemory(getToolMemoryKey(name), JSON.stringify(toolInfo, null, 2));

    console.log(`[Fairy] Tool updated: ${toolInfo.filename}`);
    writeLog(`Tool updated: ${toolInfo.filename}`);

    return toolInfo;
}

/**
 * 取得工具資訊
 *
 * @param name - 工具名稱
 * @returns 工具資訊，若不存在則回傳 null
 */
export function getToolInfo(name: string): ToolInfo | null {
    const memory = readMemory(getToolMemoryKey(name));
    if (!memory) {
        return null;
    }

    return JSON.parse(memory.content) as ToolInfo;
}

/**
 * 取得工具程式碼
 *
 * @param name - 工具名稱
 * @returns 程式碼內容，若不存在則回傳 null
 */
export function getToolCode(name: string): string | null {
    const toolInfo = getToolInfo(name);
    if (!toolInfo) {
        return null;
    }

    const filepath = resolve(TOOL_DIR, toolInfo.filename);
    if (!existsSync(filepath)) {
        return null;
    }

    return readFileSync(filepath, 'utf-8');
}

/**
 * 列出所有已記錄的工具
 *
 * @returns 工具資訊陣列
 */
export function listTools(): ToolInfo[] {
    const allMemories = getAllMemories();

    return allMemories
        .filter((m) => m.key.startsWith(TOOL_MEMORY_PREFIX))
        .map((m) => JSON.parse(m.content) as ToolInfo);
}

/**
 * 搜尋符合描述的工具
 *
 * @param keyword - 搜尋關鍵字
 * @returns 符合的工具資訊陣列
 */
export function searchTools(keyword: string): ToolInfo[] {
    const tools = listTools();
    const lowerKeyword = keyword.toLowerCase();

    return tools.filter((tool) => {
        const searchText = `${tool.name} ${tool.description} ${tool.usage}`.toLowerCase();
        return searchText.includes(lowerKeyword);
    });
}

/**
 * 執行工具（支援不同語言）
 *
 * @param name - 工具名稱
 * @param args - 傳給工具的參數
 * @returns 執行結果
 */
export function executeTool(
    name: string,
    args: string[] = []
): { success: boolean; output: string; error?: string } {
    const toolInfo = getToolInfo(name);
    if (!toolInfo) {
        return { success: false, output: '', error: `Tool "${name}" not found` };
    }

    const filepath = resolve(TOOL_DIR, toolInfo.filename);
    if (!existsSync(filepath)) {
        return { success: false, output: '', error: `Tool file "${toolInfo.filename}" not found` };
    }

    try {
        let command: string;
        const argsStr = args.map((a) => `"${a.replace(/"/g, '\\"')}"`).join(' ');

        switch (toolInfo.language) {
            case 'typescript':
                command = `npx tsx "${filepath}" ${argsStr}`;
                break;
            case 'javascript':
                command = `node "${filepath}" ${argsStr}`;
                break;
            case 'python':
                command = `python3 "${filepath}" ${argsStr}`;
                break;
            case 'bash':
                command = `bash "${filepath}" ${argsStr}`;
                break;
            default:
                return {
                    success: false,
                    output: '',
                    error: `Unsupported language: ${toolInfo.language}`
                };
        }

        const output = execSync(command, {
            cwd: PROJECT_ROOT,
            encoding: 'utf-8',
            timeout: 60000 // 60 秒超時
        });

        writeLog(`Tool executed: ${name} - success`);

        return { success: true, output };
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        writeLog(`Tool execution failed: ${name} - ${errMsg}`);
        return { success: false, output: '', error: errMsg };
    }
}

/**
 * 掃描 tool 資料夾，為尚未記錄的工具建立基本記憶
 *
 * 用於初始化或同步 tool 資料夾與 memory
 */
export function syncToolsWithMemory(): void {
    ensureToolDir();

    const files = readdirSync(TOOL_DIR).filter((f) => {
        const filepath = resolve(TOOL_DIR, f);
        return statSync(filepath).isFile();
    });

    for (const filename of files) {
        const name = basename(filename, extname(filename));
        const existing = getToolInfo(name);

        if (!existing) {
            // 建立基本記憶
            const language = detectLanguage(filename);
            const now = new Date().toISOString();

            const toolInfo: ToolInfo = {
                name,
                description: '（尚未設定描述）',
                usage: '（尚未設定使用方式）',
                language,
                filename,
                createdAt: now,
                updatedAt: now
            };

            saveMemory(getToolMemoryKey(name), JSON.stringify(toolInfo, null, 2));
            console.log(`[Fairy] Synced tool to memory: ${filename}`);
            writeLog(`Synced tool to memory: ${filename}`);
        }
    }
}
