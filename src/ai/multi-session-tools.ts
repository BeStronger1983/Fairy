/**
 * Multi-Session 自訂工具
 *
 * 提供給 AI 使用的工具，讓 AI 可以建立、查詢、使用多個獨立的 Session
 * 這些工具會被註冊到 CopilotSession，讓 AI 能夠透過 tool call 來操作 Multiple Sessions
 *
 * ⚠️ 注意：這是 Fairy 自訂的功能，不要與 Copilot CLI 內建的 subagent 功能混淆！
 * - create_session / send_to_session / destroy_session：Fairy 自訂的 Multiple Sessions 工具
 * - create_subagent / send_to_subagent / destroy_subagent：Copilot CLI 內建的 subagent 工具
 */
import type { Tool, CopilotClient } from '@github/copilot-sdk';

import {
    createMultiSession,
    loadSessionConfigs,
    findSimilarSessions,
    getOrCreateSession,
    destroySession,
    listActiveSessions,
    type SessionConfig
} from './multi-session.js';
import { writeLog, writeRequestLog } from '../logger.js';
import { getModelMultiplier } from '../usage-tracker.js';

// ---------- 工具參數型別定義 ----------

interface CreateSessionArgs {
    description: string;
    model: string;
    systemPrompt: string;
}

interface SendToSessionArgs {
    sessionId: string;
    message: string;
    timeoutMs?: number;
}

interface FindSessionsArgs {
    description: string;
}

interface DestroySessionArgs {
    sessionId: string;
}

/** 儲存 client 參考，供工具使用 */
let clientRef: CopilotClient | null = null;

/**
 * 設定 CopilotClient 參考
 * 必須在建立 session 前呼叫
 */
export function setClientRef(client: CopilotClient): void {
    clientRef = client;
}

/**
 * 建立 Session 工具
 *
 * 讓 AI 可以建立新的 Session，並自動儲存設定到 session 資料夾
 */
const createSessionTool: Tool<CreateSessionArgs> = {
    name: 'create_session',
    description: `建立一個新的 Session。Session 是 Fairy 自訂的 Multiple Sessions 功能，可建立多個獨立的 CopilotSession 來處理不同任務。
建立後的 Session 設定會被儲存到 session 資料夾，之後可以重複使用。
回傳 Session 的 ID，可用於後續的 send_to_session 或 destroy_session。

⚠️ 注意：這是 Fairy 自訂的工具，不是 Copilot CLI 內建的 create_subagent。`,
    parameters: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                description: '描述這個 Session 的用途，例如「詩人」、「數學專家」、「程式碼審查員」'
            },
            model: {
                type: 'string',
                description: '使用的 AI model ID，例如 "gpt-4.1"、"claude-sonnet-4"'
            },
            systemPrompt: {
                type: 'string',
                description: '設定 Session 的角色與行為的 system prompt'
            }
        },
        required: ['description', 'model', 'systemPrompt']
    },
    handler: async (args) => {
        if (!clientRef) {
            return { error: 'CopilotClient not initialized' };
        }

        try {
            const instance = await createMultiSession(clientRef, {
                description: args.description,
                model: args.model,
                systemPrompt: args.systemPrompt
            });

            writeLog(`Tool create_session: created ${instance.config.id}`);

            return {
                success: true,
                sessionId: instance.config.id,
                description: instance.config.description,
                model: instance.config.model,
                createdAt: instance.config.createdAt
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool create_session error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 發送訊息給 Session 工具
 *
 * 讓 AI 可以向指定的 Session 發送訊息並取得回應
 * 同時追蹤 Session 的 premium request 用量
 */
const sendToSessionTool: Tool<SendToSessionArgs> = {
    name: 'send_to_session',
    description: `向指定的 Session 發送訊息並等待回應。
如果 Session 已失效，會自動根據儲存的設定重新建立。
用量會被追蹤並記錄到 request.log。

⚠️ 注意：這是 Fairy 自訂的工具，不是 Copilot CLI 內建的 send_to_subagent。`,
    parameters: {
        type: 'object',
        properties: {
            sessionId: {
                type: 'string',
                description: 'Session 的 ID（由 create_session 回傳）'
            },
            message: {
                type: 'string',
                description: '要發送給 Session 的訊息'
            },
            timeoutMs: {
                type: 'number',
                description: '等待回應的超時時間（毫秒），預設 60000'
            }
        },
        required: ['sessionId', 'message']
    },
    handler: async (args) => {
        if (!clientRef) {
            return { error: 'CopilotClient not initialized' };
        }

        try {
            const instance = await getOrCreateSession(clientRef, args.sessionId);
            if (!instance) {
                return { error: `Session ${args.sessionId} not found` };
            }

            const timeout = args.timeoutMs ?? 60000;
            const startTime = Date.now();
            
            // 取得 Session 的 model multiplier
            const sessionModel = instance.config.model;
            const multiplier = getModelMultiplier(sessionModel);
            
            const response = await instance.session.sendAndWait({ prompt: args.message }, timeout);

            const durationMs = Date.now() - startTime;
            const content = response?.data.content ?? '（無回應）';
            
            // 記錄 Session 用量到 request.log
            writeRequestLog({
                timestamp: new Date().toISOString(),
                userMessage: `[Session ${args.sessionId}] ${args.message.slice(0, 100)}`,
                model: sessionModel,
                multiplier,
                sessionInfo: [{
                    id: args.sessionId,
                    model: sessionModel,
                    requests: 1,
                    premiumUsed: multiplier
                }],
                totalPremiumUsed: multiplier,
                durationMs
            });
            
            writeLog(`Tool send_to_session: ${args.sessionId} replied (${multiplier}x premium, ${durationMs}ms)`);

            return {
                success: true,
                sessionId: args.sessionId,
                response: content,
                usage: {
                    model: sessionModel,
                    multiplier,
                    premiumUsed: multiplier,
                    durationMs
                }
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool send_to_session error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 列出所有 Session 工具
 *
 * 讓 AI 可以查詢目前已儲存的所有 Session
 */
const listSessionsTool: Tool = {
    name: 'list_sessions',
    description: '列出所有已儲存的 Session 設定，包含 ID、描述、model 等資訊。可用於查找是否有適合重複使用的 Session。',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },
    handler: async () => {
        try {
            const configs = loadSessionConfigs();
            const activeIds = listActiveSessions();

            const result = configs.map((config) => ({
                id: config.id,
                description: config.description,
                model: config.model,
                createdAt: config.createdAt,
                isActive: activeIds.includes(config.id)
            }));

            writeLog(`Tool list_sessions: found ${result.length} sessions`);

            return {
                success: true,
                count: result.length,
                sessions: result
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool list_sessions error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 搜尋相似 Session 工具
 *
 * 讓 AI 可以根據描述關鍵字搜尋適合重複使用的 Session
 */
const findSessionsTool: Tool<FindSessionsArgs> = {
    name: 'find_sessions',
    description: '根據描述關鍵字搜尋相似的 Session。可用於找到之前建立過的、適合當前任務的 Session。',
    parameters: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                description: '搜尋關鍵字，例如「詩人」、「數學」'
            }
        },
        required: ['description']
    },
    handler: async (args) => {
        try {
            const matches = findSimilarSessions(args.description);

            writeLog(`Tool find_sessions: found ${matches.length} matches for "${args.description}"`);

            return {
                success: true,
                count: matches.length,
                matches: matches.map((config) => ({
                    id: config.id,
                    description: config.description,
                    model: config.model,
                    createdAt: config.createdAt
                }))
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool find_sessions error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 銷毀 Session 工具
 *
 * 讓 AI 可以銷毀不再需要的 Session
 */
const destroySessionTool: Tool<DestroySessionArgs> = {
    name: 'destroy_session',
    description: `銷毀指定的 Session。設定檔會保留在 session 資料夾，之後仍可透過 send_to_session 重新建立。

⚠️ 注意：這是 Fairy 自訂的工具，不是 Copilot CLI 內建的 destroy_subagent。`,
    parameters: {
        type: 'object',
        properties: {
            sessionId: {
                type: 'string',
                description: 'Session 的 ID'
            }
        },
        required: ['sessionId']
    },
    handler: async (args) => {
        try {
            await destroySession(args.sessionId);

            writeLog(`Tool destroy_session: destroyed ${args.sessionId}`);

            return {
                success: true,
                sessionId: args.sessionId,
                message: 'Session destroyed'
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool destroy_session error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 取得所有 Multi-Session 相關工具
 */
export function getMultiSessionTools(): Tool<unknown>[] {
    return [
        createSessionTool as Tool<unknown>,
        sendToSessionTool as Tool<unknown>,
        listSessionsTool,
        findSessionsTool as Tool<unknown>,
        destroySessionTool as Tool<unknown>
    ];
}
