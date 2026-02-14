import { CopilotClient, type CopilotSession, type ModelInfo } from '@github/copilot-sdk';

import { SESSION_ID, systemPrompt, PROJECT_ROOT } from '../config.js';
import { notify, notifyError } from '../notify.js';
import { initUsageTracker, endConversationAndGetSummary } from '../usage-tracker.js';
import { getSubagentTools, setClientRef } from './subagent-tools.js';
import { getToolManagerTools } from './tool-tools.js';
import { getSkillTools } from './skill-tools.js';

export type { ModelInfo };

// 匯出 getModelMultiplier 以便 bot.ts 使用
export { getModelMultiplier } from '../usage-tracker.js';

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
    await notify('CopilotClient 已啟動');

    const models = await client.listModels();
    console.log(`[Fairy] Available models: ${models.map((m) => m.id).join(', ')}`);
    await notify(`可用 models：${models.map((m) => m.id).join(', ')}`);

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

    // 初始化 usage tracker
    const usageTracker = initUsageTracker(model);
    console.log(`[Fairy] UsageTracker initialized: ${model} (${usageTracker.multiplier}x)`);

    const session = await client.createSession({
        sessionId: SESSION_ID,
        model,
        systemMessage: {
            mode: 'replace',
            content: systemPrompt
        },
        workingDirectory: PROJECT_ROOT,
        onPermissionRequest: async () => ({ kind: 'approved' as const }),
        // 註冊自訂工具：subagent 管理 + tool 管理 + skill 管理
        tools: [...getSubagentTools(), ...getToolManagerTools(), ...getSkillTools()]
    });

    console.log(`[Fairy] Session "${SESSION_ID}" created with model ${model}`);
    await notify(`Session「${SESSION_ID}」已建立，使用 model: ${model} (${usageTracker.multiplier}x)`);

    // 訂閱 session 事件，方便監控與除錯
    session.on((event) => {
        switch (event.type) {
            case 'assistant.message':
                // 只在有內容時才輸出與通知
                if (event.data.content && event.data.content.trim()) {
                    console.log(`[Fairy] Assistant: ${event.data.content}`);
                    void notify(`🤖 ${event.data.content}`);
                }
                break;
            case 'session.error':
                console.error('[Fairy] Error:', event.data);
                void notifyError(`Session 錯誤：${JSON.stringify(event.data)}`);
                break;
            case 'session.idle':
                console.log('[Fairy] Session idle');
                // 結束對話並顯示用量摘要（不再顯示「💤 Session idle」）
                const usageSummary = endConversationAndGetSummary();
                if (usageSummary) {
                    void notify(usageSummary);
                }
                break;
        }
    });

    return session;
}
