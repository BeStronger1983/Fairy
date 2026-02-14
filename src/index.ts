import { writeLog } from './logger.js';
import { startClient } from './ai/session.js';
import { createBot, startBot } from './telegram/bot.js';
import { clearSubagentFolder, destroyAllSubagents } from './ai/subagent.js';
import { syncToolsWithMemory } from './tool-manager.js';

// ---------- 啟動流程 ----------

async function main(): Promise<void> {
    console.log('[Fairy] Initializing…');
    writeLog('Fairy initializing…');

    // 0. 清空 subagent 資料夾（每次啟動時重置）
    clearSubagentFolder();

    // 0.5. 同步 tool 資料夾與 memory（確保工具都有記錄）
    syncToolsWithMemory();

    // 1. 啟動 CopilotClient 並取得可用 model 清單
    const { client, models } = await startClient();

    // 2. 建立 Telegram Bot，掛載 model 選擇流程
    const { bot, sessionReady } = createBot(client, models);

    // 3. 啟動 Bot long polling，連線後自動發送 model 選擇按鈕
    startBot(bot, models);

    // 4. session 會在使用者第一次發訊息時 lazy 建立（節省 premium request）
    // 這裡不再等待 sessionReady，讓程式保持運行

    console.log('[Fairy] Ready. Waiting for user to select model and send first message…');
    writeLog('Fairy is ready. Session will be created on first message (lazy initialization).');

    // 5. 優雅關閉：收到終止信號時依序釋放資源
    const shutdown = async (): Promise<void> => {
        console.log('\n[Fairy] Shutting down…');
        writeLog('Shutting down…');
        bot.stop();
        await destroyAllSubagents();

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
            writeLog(`Cleanup errors: ${JSON.stringify(errors)}`);
        }
        process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
}

main().catch((err) => {
    console.error('[Fairy] Fatal error:', err);
    writeLog(`Fatal error: ${err}`);
    process.exit(1);
});
