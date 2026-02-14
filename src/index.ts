import { writeLog } from './logger.js';
import { startClient } from './ai/session.js';
import { createBot, startBot } from './telegram/bot.js';

// ---------- 啟動流程 ----------

async function main(): Promise<void> {
    console.log('[Fairy] Initializing…');
    writeLog('Fairy initializing…');

    // 1. 啟動 CopilotClient 並取得可用 model 清單
    const { client, models } = await startClient();

    // 2. 建立 Telegram Bot，掛載 model 選擇流程
    const { bot, sessionReady } = createBot(client, models);

    // 3. 啟動 Bot long polling，連線後自動發送 model 選擇按鈕
    startBot(bot, models);

    // 4. 等待使用者透過 Telegram 選擇 model 並建立 session
    const session = await sessionReady;

    console.log('[Fairy] Ready.');
    writeLog('Fairy is ready.');

    // 5. 優雅關閉：收到終止信號時依序釋放資源
    const shutdown = async (): Promise<void> => {
        console.log('\n[Fairy] Shutting down…');
        writeLog('Shutting down…');
        bot.stop();
        await session.destroy();
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
