/**
 * Multi-Session 管理模組
 *
 * 此模組實作 Fairy 的 Multiple Sessions 功能，讓 Fairy 可以建立多個獨立的 CopilotSession
 * 來並行處理不同的任務。
 *
 * ⚠️ 注意：這是 Fairy 自訂的功能，使用 Copilot SDK 的 createSession API
 * 不要與 Copilot CLI 內建的 subagent 功能（create_subagent, send_to_subagent）混淆！
 *
 * 術語說明：
 * - 「Multi-Session」：Fairy 自訂的 Multiple Sessions 功能（本模組）
 * - 「Subagent」：Copilot CLI 內建的 subagent 功能（不在此模組）
 */
import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CopilotClient, CopilotSession } from '@github/copilot-sdk';

import { PROJECT_ROOT } from '../config.js';
import { writeLog } from '../logger.js';
import { notify, notifyError } from '../notify.js';

// ---------- 常數 ----------

/** Session 設定檔存放資料夾 */
const SESSION_DIR = resolve(PROJECT_ROOT, 'session');

// ---------- 型別定義 ----------

/** Session 設定檔介面 */
export interface SessionConfig {
    /** Session 的唯一識別 ID（同時作為 sessionId） */
    id: string;
    /** 用途描述，方便日後判斷是否可重複使用 */
    description: string;
    /** 使用的 model ID */
    model: string;
    /** system prompt 內容 */
    systemPrompt: string;
    /** 建立時間 */
    createdAt: string;
}

/** 記憶體中的 Session 實例（設定 + 活躍 CopilotSession） */
interface SessionInstance {
    config: SessionConfig;
    session: CopilotSession;
}

// ---------- 模組狀態 ----------

/** 目前活躍的 Session 實例對照表（id -> instance） */
const activeSessions = new Map<string, SessionInstance>();

// ---------- 工具函式 ----------

/**
 * 取得 Session 設定檔路徑
 */
function getConfigPath(id: string): string {
    return resolve(SESSION_DIR, `${id}.json`);
}

/**
 * 為 CopilotSession 訂閱錯誤事件
 */
function subscribeSessionErrors(session: CopilotSession, id: string): void {
    session.on((event) => {
        if (event.type === 'session.error') {
            console.error(`[Fairy] Session ${id} error:`, event.data);
            void notifyError(`Session ${id} 錯誤：${JSON.stringify(event.data)}`);
        }
    });
}

/**
 * 建立 CopilotSession 的共用邏輯
 */
async function buildCopilotSession(client: CopilotClient, config: SessionConfig): Promise<CopilotSession> {
    const session = await client.createSession({
        sessionId: config.id,
        model: config.model,
        systemMessage: {
            mode: 'replace',
            content: config.systemPrompt
        },
        workingDirectory: PROJECT_ROOT,
        onPermissionRequest: async () => ({ kind: 'approved' as const })
    });

    subscribeSessionErrors(session, config.id);
    return session;
}

/**
 * 啟動時清空 session 資料夾
 *
 * 每次 Fairy 程式開啟時呼叫，確保不會殘留舊的 session 設定
 */
export function clearSessionFolder(): void {
    if (existsSync(SESSION_DIR)) {
        rmSync(SESSION_DIR, { recursive: true, force: true });
    }
    mkdirSync(SESSION_DIR, { recursive: true });
    activeSessions.clear();
    console.log('[Fairy] Session folder cleared');
    writeLog('Session folder cleared');
}

/**
 * 儲存 Session 設定至檔案
 */
export function saveSessionConfig(config: SessionConfig): void {
    const configPath = getConfigPath(config.id);
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`[Fairy] Session config saved: ${config.id}`);
    writeLog(`Session config saved: ${config.id}`);
}

/**
 * 讀取所有已儲存的 Session 設定
 */
export function loadSessionConfigs(): SessionConfig[] {
    if (!existsSync(SESSION_DIR)) {
        return [];
    }

    const files = readdirSync(SESSION_DIR).filter((f) => f.endsWith('.json'));
    const configs: SessionConfig[] = [];

    for (const file of files) {
        try {
            const content = readFileSync(resolve(SESSION_DIR, file), 'utf-8');
            configs.push(JSON.parse(content) as SessionConfig);
        } catch (error) {
            console.error(`[Fairy] Failed to load session config ${file}:`, error);
            notifyError(`載入 session 設定失敗 ${file}: ${error}`).catch(() => {});
        }
    }

    return configs;
}

/**
 * 根據 ID 讀取單一 Session 設定
 */
export function getSessionConfig(id: string): SessionConfig | null {
    const configPath = getConfigPath(id);
    if (!existsSync(configPath)) {
        return null;
    }

    try {
        const content = readFileSync(configPath, 'utf-8');
        return JSON.parse(content) as SessionConfig;
    } catch {
        return null;
    }
}

/**
 * 建立新的 Session
 *
 * @param client - CopilotClient 實例
 * @param config - Session 設定（不含 id 和 createdAt，會自動產生）
 * @returns 建立完成的 Session 實例
 */
export async function createMultiSession(
    client: CopilotClient,
    config: Omit<SessionConfig, 'id' | 'createdAt'>
): Promise<SessionInstance> {
    // 產生唯一 ID（使用時間戳 + 隨機字串）
    const id = `session-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const fullConfig: SessionConfig = {
        ...config,
        id,
        createdAt: new Date().toISOString()
    };

    const session = await buildCopilotSession(client, fullConfig);

    // 儲存設定與快取實例
    saveSessionConfig(fullConfig);
    const instance: SessionInstance = { config: fullConfig, session };
    activeSessions.set(id, instance);

    console.log(`[Fairy] Session created: ${id} (model: ${config.model})`);
    writeLog(`Session created: ${id} (model: ${config.model}, desc: ${config.description})`);
    await notify(`Session 已建立：${config.description}（model: ${config.model}）`);

    return instance;
}

/**
 * 取得現有的 Session，若不存在或已失效則重新建立
 *
 * @param client - CopilotClient 實例
 * @param id - Session ID
 * @returns Session 實例，若找不到設定檔則回傳 null
 */
export async function getOrCreateSession(
    client: CopilotClient,
    id: string
): Promise<SessionInstance | null> {
    // 檢查記憶體快取
    const cached = activeSessions.get(id);
    if (cached) {
        return cached;
    }

    // 從檔案讀取設定
    const config = getSessionConfig(id);
    if (!config) {
        return null;
    }

    // 重新建立 session
    const session = await buildCopilotSession(client, config);

    const instance: SessionInstance = { config, session };
    activeSessions.set(id, instance);

    console.log(`[Fairy] Session restored: ${id}`);
    writeLog(`Session restored: ${id}`);

    return instance;
}

/**
 * 根據描述尋找可重複使用的 Session
 *
 * 透過簡單的關鍵字比對，找出描述相似的 Session
 *
 * @param description - 目標描述
 * @returns 符合的 Session 設定列表
 */
export function findSimilarSessions(description: string): SessionConfig[] {
    const configs = loadSessionConfigs();
    const keywords = description.toLowerCase().split(/\s+/);

    return configs.filter((config) => {
        const configDesc = config.description.toLowerCase();
        return keywords.some((keyword) => configDesc.includes(keyword));
    });
}

/**
 * 列出所有活躍的 Session ID
 */
export function listActiveSessions(): string[] {
    return Array.from(activeSessions.keys());
}

/**
 * 銷毀指定的 Session
 */
export async function destroySession(id: string): Promise<void> {
    const instance = activeSessions.get(id);
    if (instance) {
        await instance.session.destroy();
        activeSessions.delete(id);
        console.log(`[Fairy] Session destroyed: ${id}`);
        await notify(`Session 已銷毀：${id}`);
    }
}

/**
 * 銷毀所有活躍的 Session
 */
export async function destroyAllSessions(): Promise<void> {
    const ids = listActiveSessions();
    for (const id of ids) {
        await destroySession(id);
    }
    console.log('[Fairy] All sessions destroyed');
    await notify('所有 session 已銷毀');
}
