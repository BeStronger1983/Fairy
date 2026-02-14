/**
 * Tool 管理相關的自訂工具
 *
 * 提供給 AI 使用的工具，讓 AI 可以儲存、查詢、執行自訂工具程式
 * 這些工具會被註冊到 CopilotSession
 */
import type { Tool } from '@github/copilot-sdk';

import {
    saveTool,
    updateToolCode,
    getToolInfo,
    getToolCode,
    listTools,
    searchTools,
    executeTool,
    type ToolInfo
} from '../tool-manager.js';
import { writeLog } from '../logger.js';

// ---------- 工具參數型別定義 ----------

interface SaveToolArgs {
    name: string;
    code: string;
    description: string;
    usage: string;
    extension?: string;
}

interface UpdateToolArgs {
    name: string;
    code: string;
}

interface SearchToolsArgs {
    keyword: string;
}

interface GetToolCodeArgs {
    name: string;
}

interface ExecuteToolArgs {
    name: string;
    args?: string[];
}

/**
 * 儲存新工具
 *
 * 讓 AI 可以將寫好的程式存到 tool 資料夾，並記錄到 memory
 */
const saveToolTool: Tool<SaveToolArgs> = {
    name: 'save_tool',
    description: `儲存一個新的工具程式到 tool 資料夾，並自動記錄到 memory。
之後處理類似的工作時可以重複使用這個工具。
支援 TypeScript (.ts)、JavaScript (.js)、Python (.py)、Bash (.sh) 等語言。`,
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: '工具名稱（會成為檔名，建議用英文）'
            },
            code: {
                type: 'string',
                description: '工具的程式碼內容'
            },
            description: {
                type: 'string',
                description: '工具的用途描述，說明這個工具能做什麼'
            },
            usage: {
                type: 'string',
                description: '使用方式說明，包含參數、範例等'
            },
            extension: {
                type: 'string',
                description: '副檔名，例如 ".ts"、".py"、".sh"，預設為 ".ts"'
            }
        },
        required: ['name', 'code', 'description', 'usage']
    },
    handler: async (args) => {
        try {
            const toolInfo = saveTool(
                args.name,
                args.code,
                args.description,
                args.usage,
                args.extension ?? '.ts'
            );

            writeLog(`Tool save_tool: saved ${toolInfo.filename}`);

            return {
                success: true,
                tool: toolInfo
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool save_tool error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 更新工具程式碼
 */
const updateToolTool: Tool<UpdateToolArgs> = {
    name: 'update_tool',
    description: '更新現有工具的程式碼內容。',
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: '工具名稱'
            },
            code: {
                type: 'string',
                description: '新的程式碼內容'
            }
        },
        required: ['name', 'code']
    },
    handler: async (args) => {
        try {
            const toolInfo = updateToolCode(args.name, args.code);

            if (!toolInfo) {
                return { error: `Tool "${args.name}" not found` };
            }

            writeLog(`Tool update_tool: updated ${toolInfo.filename}`);

            return {
                success: true,
                tool: toolInfo
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool update_tool error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 列出所有工具
 */
const listToolsTool: Tool = {
    name: 'list_tools',
    description: '列出所有已儲存的工具，包含名稱、描述、使用方式等資訊。用於查找可重複使用的工具。',
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },
    handler: async () => {
        try {
            const tools = listTools();

            writeLog(`Tool list_tools: found ${tools.length} tools`);

            return {
                success: true,
                count: tools.length,
                tools: tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    usage: t.usage,
                    language: t.language,
                    filename: t.filename
                }))
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool list_tools error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 搜尋工具
 */
const searchToolsTool: Tool<SearchToolsArgs> = {
    name: 'search_tools',
    description: '根據關鍵字搜尋適合的工具。會搜尋工具名稱、描述、使用方式。',
    parameters: {
        type: 'object',
        properties: {
            keyword: {
                type: 'string',
                description: '搜尋關鍵字'
            }
        },
        required: ['keyword']
    },
    handler: async (args) => {
        try {
            const tools = searchTools(args.keyword);

            writeLog(`Tool search_tools: found ${tools.length} matches for "${args.keyword}"`);

            return {
                success: true,
                count: tools.length,
                tools: tools.map((t) => ({
                    name: t.name,
                    description: t.description,
                    usage: t.usage,
                    language: t.language,
                    filename: t.filename
                }))
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool search_tools error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 取得工具程式碼
 */
const getToolCodeTool: Tool<GetToolCodeArgs> = {
    name: 'get_tool_code',
    description: '取得指定工具的程式碼內容。',
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: '工具名稱'
            }
        },
        required: ['name']
    },
    handler: async (args) => {
        try {
            const info = getToolInfo(args.name);
            const code = getToolCode(args.name);

            if (!info || !code) {
                return { error: `Tool "${args.name}" not found` };
            }

            writeLog(`Tool get_tool_code: retrieved ${args.name}`);

            return {
                success: true,
                name: info.name,
                description: info.description,
                usage: info.usage,
                language: info.language,
                code
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool get_tool_code error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 執行工具
 */
const executeToolTool: Tool<ExecuteToolArgs> = {
    name: 'execute_tool',
    description: `執行指定的工具程式。
支援 TypeScript、JavaScript、Python、Bash 等語言。
會自動根據工具的語言選擇執行方式。`,
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: '工具名稱'
            },
            args: {
                type: 'array',
                items: { type: 'string' },
                description: '傳給工具的命令列參數'
            }
        },
        required: ['name']
    },
    handler: async (args) => {
        try {
            const result = executeTool(args.name, args.args ?? []);

            if (result.success) {
                writeLog(`Tool execute_tool: ${args.name} succeeded`);
            } else {
                writeLog(`Tool execute_tool: ${args.name} failed - ${result.error}`);
            }

            return result;
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool execute_tool error: ${errMsg}`);
            return { success: false, output: '', error: errMsg };
        }
    }
};

/**
 * 取得所有 tool 管理相關工具
 */
export function getToolManagerTools(): Tool<unknown>[] {
    return [
        saveToolTool as Tool<unknown>,
        updateToolTool as Tool<unknown>,
        listToolsTool,
        searchToolsTool as Tool<unknown>,
        getToolCodeTool as Tool<unknown>,
        executeToolTool as Tool<unknown>
    ];
}
