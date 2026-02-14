import { readdirSync, readFileSync, writeFileSync, rmSync, mkdirSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CopilotClient, CopilotSession } from '@github/copilot-sdk';

import { PROJECT_ROOT } from '../config.js';
import { writeLog } from '../logger.js';

// ---------- 常數 ----------

/** subagent 設定檔存放資料夾 */
const SUBAGENT_DIR = resolve(PROJECT_ROOT, 'subagent');

// ---------- 型別定義 ----------

/** Subagent 設定檔介面 */
export interface SubagentConfig {
    /** subagent 的唯一識別 ID（同時作為 sessionId） */
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

/** 記憶體中的 subagent 實例（設定 + 活躍 session） */
interface SubagentInstance {
    config: SubagentConfig;
    session: CopilotSession;
}

// ---------- 模組狀態 ----------

/** 目前活躍的 subagent 實例對照表（id -> instance） */
const activeSubagents = new Map<string, SubagentInstance>();

// ---------- 工具函式 ----------

/**
 * 取得 subagent 設定檔路徑
 */
function getConfigPath(id: string): string {
    return resolve(SUBAGENT_DIR, `${id}.json`);
}

/**
 * 為 session 訂閱錯誤事件
 */
function subscribeSessionErrors(session: CopilotSession, id: string): void {
    session.on((event) => {
        if (event.type === 'session.error') {
            console.error(`[Fairy] Subagent ${id} error:`, event.data);
            writeLog(`Subagent ${id} error: ${JSON.stringify(event.data)}`);
        }
    });
}

/**
 * 建立 subagent session 的共用邏輯
 */
async function buildSession(client: CopilotClient, config: SubagentConfig): Promise<CopilotSession> {
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
 * 啟動時清空 subagent 資料夾
 *
 * 每次 Fairy 程式開啟時呼叫，確保不會殘留舊的 subagent 設定
 */
export function clearSubagentFolder(): void {
    if (existsSync(SUBAGENT_DIR)) {
        rmSync(SUBAGENT_DIR, { recursive: true, force: true });
    }
    mkdirSync(SUBAGENT_DIR, { recursive: true });
    activeSubagents.clear();
    console.log('[Fairy] Subagent folder cleared');
    writeLog('Subagent folder cleared');
}

/**
 * 儲存 subagent 設定至檔案
 */
export function saveSubagentConfig(config: SubagentConfig): void {
    const configPath = getConfigPath(config.id);
    writeFileSync(configPath, JSON.stringify(config, null, 2), 'utf-8');
    console.log(`[Fairy] Subagent config saved: ${config.id}`);
    writeLog(`Subagent config saved: ${config.id}`);
}

/**
 * 讀取所有已儲存的 subagent 設定
 */
export function loadSubagentConfigs(): SubagentConfig[] {
    if (!existsSync(SUBAGENT_DIR)) {
        return [];
    }

    const files = readdirSync(SUBAGENT_DIR).filter((f) => f.endsWith('.json'));
    const configs: SubagentConfig[] = [];

    for (const file of files) {
        try {
            const content = readFileSync(resolve(SUBAGENT_DIR, file), 'utf-8');
            configs.push(JSON.parse(content) as SubagentConfig);
        } catch (error) {
            console.error(`[Fairy] Failed to load subagent config ${file}:`, error);
            writeLog(`Failed to load subagent config ${file}: ${error}`);
        }
    }

    return configs;
}

/**
 * 根據 ID 讀取單一 subagent 設定
 */
export function getSubagentConfig(id: string): SubagentConfig | null {
    const configPath = getConfigPath(id);
    if (!existsSync(configPath)) {
        return null;
    }

    try {
        const content = readFileSync(configPath, 'utf-8');
        return JSON.parse(content) as SubagentConfig;
    } catch {
        return null;
    }
}

/**
 * 建立新的 subagent session
 *
 * @param client - CopilotClient 實例
 * @param config - subagent 設定（不含 id 和 createdAt，會自動產生）
 * @returns 建立完成的 subagent 實例
 */
export async function createSubagent(
    client: CopilotClient,
    config: Omit<SubagentConfig, 'id' | 'createdAt'>
): Promise<SubagentInstance> {
    // 產生唯一 ID（使用時間戳 + 隨機字串）
    const id = `subagent-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

    const fullConfig: SubagentConfig = {
        ...config,
        id,
        createdAt: new Date().toISOString()
    };

    const session = await buildSession(client, fullConfig);

    // 儲存設定與快取實例
    saveSubagentConfig(fullConfig);
    const instance: SubagentInstance = { config: fullConfig, session };
    activeSubagents.set(id, instance);

    console.log(`[Fairy] Subagent created: ${id} (model: ${config.model})`);
    writeLog(`Subagent created: ${id} (model: ${config.model}, desc: ${config.description})`);

    return instance;
}

/**
 * 取得現有的 subagent，若不存在或 session 已失效則重新建立
 *
 * @param client - CopilotClient 實例
 * @param id - subagent ID
 * @returns subagent 實例，若找不到設定檔則回傳 null
 */
export async function getOrCreateSubagent(
    client: CopilotClient,
    id: string
): Promise<SubagentInstance | null> {
    // 檢查記憶體快取
    const cached = activeSubagents.get(id);
    if (cached) {
        return cached;
    }

    // 從檔案讀取設定
    const config = getSubagentConfig(id);
    if (!config) {
        return null;
    }

    // 重新建立 session
    const session = await buildSession(client, config);

    const instance: SubagentInstance = { config, session };
    activeSubagents.set(id, instance);

    console.log(`[Fairy] Subagent session restored: ${id}`);
    writeLog(`Subagent session restored: ${id}`);

    return instance;
}

/**
 * 根據描述尋找可重複使用的 subagent
 *
 * 透過簡單的關鍵字比對，找出描述相似的 subagent
 *
 * @param description - 目標描述
 * @returns 符合的 subagent 設定列表
 */
export function findSimilarSubagents(description: string): SubagentConfig[] {
    const configs = loadSubagentConfigs();
    const keywords = description.toLowerCase().split(/\s+/);

    return configs.filter((config) => {
        const configDesc = config.description.toLowerCase();
        return keywords.some((keyword) => configDesc.includes(keyword));
    });
}

/**
 * 列出所有活躍的 subagent ID
 */
export function listActiveSubagents(): string[] {
    return Array.from(activeSubagents.keys());
}

/**
 * 銷毀指定的 subagent session
 */
export async function destroySubagent(id: string): Promise<void> {
    const instance = activeSubagents.get(id);
    if (instance) {
        await instance.session.destroy();
        activeSubagents.delete(id);
        console.log(`[Fairy] Subagent destroyed: ${id}`);
        writeLog(`Subagent destroyed: ${id}`);
    }
}

/**
 * 銷毀所有活躍的 subagent session
 */
export async function destroyAllSubagents(): Promise<void> {
    const ids = listActiveSubagents();
    for (const id of ids) {
        await destroySubagent(id);
    }
    console.log('[Fairy] All subagents destroyed');
    writeLog('All subagents destroyed');
}
