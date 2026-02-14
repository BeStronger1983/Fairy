/**
 * Subagent 自訂工具
 *
 * 提供給 AI 使用的工具，讓 AI 可以建立、查詢、使用 subagent
 * 這些工具會被註冊到 CopilotSession，讓 AI 能夠透過 tool call 來操作 subagent
 */
import type { Tool, CopilotClient } from '@github/copilot-sdk';

import {
    createSubagent,
    loadSubagentConfigs,
    findSimilarSubagents,
    getOrCreateSubagent,
    destroySubagent,
    listActiveSubagents,
    type SubagentConfig
} from './subagent.js';
import { writeLog, writeRequestLog } from '../logger.js';
import { getModelMultiplier } from '../usage-tracker.js';

// ---------- 工具參數型別定義 ----------

interface CreateSubagentArgs {
    description: string;
    model: string;
    systemPrompt: string;
}

interface SendToSubagentArgs {
    subagentId: string;
    message: string;
    timeoutMs?: number;
}

interface FindSubagentsArgs {
    description: string;
}

interface DestroySubagentArgs {
    subagentId: string;
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
 * 建立 subagent 工具
 *
 * 讓 AI 可以建立新的 subagent，並自動儲存設定到 subagent 資料夾
 */
const createSubagentTool: Tool<CreateSubagentArgs> = {
    name: 'create_subagent',
    description: `建立一個新的 subagent。Subagent 是專門處理特定任務的 AI agent，擁有自己的 systemPrompt 和 model。
建立後的 subagent 設定會被儲存到 subagent 資料夾，之後可以重複使用。
回傳 subagent 的 ID，可用於後續的 send_to_subagent 或 destroy_subagent。`,
    parameters: {
        type: 'object',
        properties: {
            description: {
                type: 'string',
                description: '描述這個 subagent 的用途，例如「詩人」、「數學專家」、「程式碼審查員」'
            },
            model: {
                type: 'string',
                description: '使用的 AI model ID，例如 "gpt-4.1"、"claude-sonnet-4"'
            },
            systemPrompt: {
                type: 'string',
                description: '設定 subagent 的角色與行為的 system prompt'
            }
        },
        required: ['description', 'model', 'systemPrompt']
    },
    handler: async (args) => {
        if (!clientRef) {
            return { error: 'CopilotClient not initialized' };
        }

        try {
            const instance = await createSubagent(clientRef, {
                description: args.description,
                model: args.model,
                systemPrompt: args.systemPrompt
            });

            writeLog(`Tool create_subagent: created ${instance.config.id}`);

            return {
                success: true,
                subagentId: instance.config.id,
                description: instance.config.description,
                model: instance.config.model,
                createdAt: instance.config.createdAt
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool create_subagent error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 發送訊息給 subagent 工具
 *
 * 讓 AI 可以向指定的 subagent 發送訊息並取得回應
 * 同時追蹤 subagent 的 premium request 用量
 */
const sendToSubagentTool: Tool<SendToSubagentArgs> = {
    name: 'send_to_subagent',
    description: `向指定的 subagent 發送訊息並等待回應。
如果 subagent session 已失效，會自動根據儲存的設定重新建立。
用量會被追蹤並記錄到 request.log。`,
    parameters: {
        type: 'object',
        properties: {
            subagentId: {
                type: 'string',
                description: 'Subagent 的 ID（由 create_subagent 回傳）'
            },
            message: {
                type: 'string',
                description: '要發送給 subagent 的訊息'
            },
            timeoutMs: {
                type: 'number',
                description: '等待回應的超時時間（毫秒），預設 60000'
            }
        },
        required: ['subagentId', 'message']
    },
    handler: async (args) => {
        if (!clientRef) {
            return { error: 'CopilotClient not initialized' };
        }

        try {
            const instance = await getOrCreateSubagent(clientRef, args.subagentId);
            if (!instance) {
                return { error: `Subagent ${args.subagentId} not found` };
            }

            const timeout = args.timeoutMs ?? 60000;
            const startTime = Date.now();
            
            // 取得 subagent 的 model multiplier
            const subagentModel = instance.config.model;
            const multiplier = getModelMultiplier(subagentModel);
            
            const response = await instance.session.sendAndWait({ prompt: args.message }, timeout);

            const durationMs = Date.now() - startTime;
            const content = response?.data.content ?? '（無回應）';
            
            // 記錄 subagent 用量到 request.log
            writeRequestLog({
                timestamp: new Date().toISOString(),
                userMessage: `[Subagent ${args.subagentId}] ${args.message.slice(0, 100)}`,
                model: subagentModel,
                multiplier,
                subagentInfo: [{
                    id: args.subagentId,
                    model: subagentModel,
                    requests: 1,
                    premiumUsed: multiplier
                }],
                totalPremiumUsed: multiplier,
                durationMs
            });
            
            writeLog(`Tool send_to_subagent: ${args.subagentId} replied (${multiplier}x premium, ${durationMs}ms)`);

            return {
                success: true,
                subagentId: args.subagentId,
                response: content,
                usage: {
                    model: subagentModel,
                    multiplier,
                    premiumUsed: multiplier,
                    durationMs
                }
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool send_to_subagent error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 列出所有 subagent 工具
 *
 * 讓 AI 可以查詢目前已儲存的所有 subagent
 */
const listSubagentsTool: Tool = {
    name: 'list_subagents',
    description: '列出所有已儲存的 subagent 設定，包含 ID、描述、model 等資訊。可用於查找是否有適合重複使用的 subagent。',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },
    handler: async () => {
        try {
            const configs = loadSubagentConfigs();
            const activeIds = listActiveSubagents();

            const result = configs.map((config) => ({
                id: config.id,
                description: config.description,
                model: config.model,
                createdAt: config.createdAt,
                isActive: activeIds.includes(config.id)
            }));

            writeLog(`Tool list_subagents: found ${result.length} subagents`);

            return {
                success: true,
                count: result.length,
                subagents: result
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool list_subagents error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 搜尋相似 subagent 工具
 *
 * 讓 AI 可以根據描述關鍵字搜尋適合重複使用的 subagent
 */
const findSubagentsTool: Tool<FindSubagentsArgs> = {
    name: 'find_subagents',
    description: '根據描述關鍵字搜尋相似的 subagent。可用於找到之前建立過的、適合當前任務的 subagent。',
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
            const matches = findSimilarSubagents(args.description);

            writeLog(`Tool find_subagents: found ${matches.length} matches for "${args.description}"`);

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
            writeLog(`Tool find_subagents error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 銷毀 subagent 工具
 *
 * 讓 AI 可以銷毀不再需要的 subagent session
 */
const destroySubagentTool: Tool<DestroySubagentArgs> = {
    name: 'destroy_subagent',
    description: '銷毀指定的 subagent session。設定檔會保留在 subagent 資料夾，之後仍可透過 send_to_subagent 重新建立。',
    parameters: {
        type: 'object',
        properties: {
            subagentId: {
                type: 'string',
                description: 'Subagent 的 ID'
            }
        },
        required: ['subagentId']
    },
    handler: async (args) => {
        try {
            await destroySubagent(args.subagentId);

            writeLog(`Tool destroy_subagent: destroyed ${args.subagentId}`);

            return {
                success: true,
                subagentId: args.subagentId,
                message: 'Subagent session destroyed'
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool destroy_subagent error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 取得所有 subagent 相關工具
 */
export function getSubagentTools(): Tool<unknown>[] {
    return [
        createSubagentTool as Tool<unknown>,
        sendToSubagentTool as Tool<unknown>,
        listSubagentsTool,
        findSubagentsTool as Tool<unknown>,
        destroySubagentTool as Tool<unknown>
    ];
}
