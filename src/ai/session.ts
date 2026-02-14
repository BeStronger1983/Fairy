import { CopilotClient, type CopilotSession, type ModelInfo } from '@github/copilot-sdk';

import { SESSION_ID, systemPrompt, PROJECT_ROOT } from '../config.js';
import { writeLog } from '../logger.js';
import { getSubagentTools, setClientRef } from './subagent-tools.js';
import { getToolManagerTools } from './tool-tools.js';

export type { ModelInfo };

export interface ClientWithModels {
    client: CopilotClient;
    models: ModelInfo[];
}

/**
 * 第一階段：啟動 CopilotClient 並取得可用 model 清單
 *
 * 尚不建立 session，等使用者透過 Telegram 選擇 model 後再建立
 */
export async function startClient(): Promise<ClientWithModels> {
    const client = new CopilotClient();
    await client.start();
    console.log('[Fairy] CopilotClient started');
    writeLog('CopilotClient started');

    const models = await client.listModels();
    console.log(`[Fairy] Available models: ${models.map((m) => m.id).join(', ')}`);
    writeLog(`Available models: ${models.map((m) => m.id).join(', ')}`);

    return { client, models };
}

/**
 * 第二階段：用使用者選定的 model 建立 CopilotSession
 *
 * - 使用 Fairy.md 作為 system prompt（完全取代預設提示）
 * - workingDirectory 設為專案根目錄，讓 AI 能操作檔案
 * - onPermissionRequest 自動核准所有操作（Fairy 是受信任的自主 Agent）
 * - 註冊 subagent 相關工具，讓 AI 可以建立、管理 subagent
 */
export async function createSession(client: CopilotClient, model: string): Promise<CopilotSession> {
    // 設定 client 參考，供 subagent 工具使用
    setClientRef(client);

    const session = await client.createSession({
        sessionId: SESSION_ID,
        model,
        systemMessage: {
            mode: 'replace',
            content: systemPrompt
        },
        workingDirectory: PROJECT_ROOT,
        onPermissionRequest: async () => ({ kind: 'approved' as const }),
        // 註冊自訂工具：subagent 管理 + tool 管理
        tools: [...getSubagentTools(), ...getToolManagerTools()]
    });

    console.log(`[Fairy] Session "${SESSION_ID}" created with model ${model}`);
    writeLog(`Session "${SESSION_ID}" created with model ${model}`);

    // 訂閱 session 事件，方便監控與除錯
    session.on((event) => {
        switch (event.type) {
            case 'assistant.message':
                console.log(`[Fairy] Assistant: ${event.data.content}`);
                break;
            case 'session.error':
                console.error('[Fairy] Error:', event.data);
                writeLog(`Error: ${JSON.stringify(event.data)}`);
                break;
            case 'session.idle':
                console.log('[Fairy] Session idle');
                break;
        }
    });

    return session;
}
