import { notify, notifyError } from './notify.js';
import { startClient } from './ai/session.js';
import { createBot, startBot } from './telegram/bot.js';
import { clearSubagentFolder, destroyAllSubagents } from './ai/subagent.js';
import { syncToolsWithMemory } from './tool-manager.js';
import { getMemoryManager, closeMemoryManager } from './memory/index.js';
import { log, getLastRequestUsage } from './logger.js';

// ---------- 啟動流程 ----------

async function main(): Promise<void> {
    console.log('[Fairy] Initializing…');
    await notify('Fairy 初始化中…');

    // 0. 讀取上次請求的用量並通知
    const lastUsage = getLastRequestUsage();
    if (lastUsage) {
        const usageMsg = `📊 上次請求用量：${lastUsage.totalPremiumUsed} premium requests\n` +
            `• Model: ${lastUsage.model} (${lastUsage.multiplier}x)\n` +
            `• 訊息: ${lastUsage.userMessage.slice(0, 50)}${lastUsage.userMessage.length > 50 ? '…' : ''}`;
        await notify(usageMsg);
    }

    // 1. 清空 subagent 資料夾（每次啟動時重置）
    clearSubagentFolder();

    // 2. 同步 tool 資料夾與 memory（確保工具都有記錄）
    syncToolsWithMemory();

    // 3. 初始化向量記憶系統（有 OPENAI_API_KEY 時啟用）
    if (process.env.OPENAI_API_KEY) {
        try {
            const memoryManager = getMemoryManager();
            const syncResult = await memoryManager.sync();
            log.info(`Memory system initialized: +${syncResult.added} ~${syncResult.updated} -${syncResult.removed}`);
        } catch (err) {
            log.warn(`Memory system init failed (will use legacy): ${err}`);
        }
    } else {
        log.info('Memory system disabled (no OPENAI_API_KEY)');
    }

    // 4. 啟動 CopilotClient 並取得可用 model 清單
    const { client, models } = await startClient();

    // 5. 建立 Telegram Bot，掛載 model 選擇流程
    const { bot, sessionReady } = createBot(client, models);

    // 6. 啟動 Bot long polling，連線後自動發送 model 選擇按鈕
    startBot(bot, models);

    // 7. session 會在使用者第一次發訊息時 lazy 建立（節省 premium request）
    // 這裡不再等待 sessionReady，讓程式保持運行

    console.log('[Fairy] Ready. Waiting for user to select model and send first message…');

    // 通知使用者程式已就緒（會在 Bot 連線成功後才實際發送）
    await notify('Fairy 啟動完成，等待選擇 model 與第一則訊息');

    // 8. 優雅關閉：收到終止信號時依序釋放資源
    const shutdown = async (): Promise<void> => {
        console.log('\n[Fairy] Shutting down…');
        await notify('Fairy 正在關閉…');
        bot.stop();
        await destroyAllSubagents();
        closeMemoryManager();  // 關閉記憶系統

        // session 可能尚未建立（lazy initialization），需要檢查
        try {
            // 使用 Promise.race 避免永久等待尚未建立的 session
            const session = await Promise.race([
                sessionReady,
                new Promise<null>((resolve) => setTimeout(() => resolve(null), 100))
            ]);
            if (session) {
                await session.destroy();
            }
        } catch {
            // session 尚未建立，忽略
        }

        const errors = await client.stop();
        if (errors.length > 0) {
            console.error('[Fairy] Cleanup errors:', errors);
            await notifyError(`清理資源時發生錯誤：${JSON.stringify(errors)}`);
        }
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch(async (err) => {
    console.error('[Fairy] Fatal error:', err);
    await notifyError(`致命錯誤：${err}`);
    process.exit(1);
});
