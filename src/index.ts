import { writeLog } from "./logger.js";
import { createAiCore, verifySession } from "./ai/session.js";
import { createBot, startBot } from "./telegram/bot.js";

// ---------- 啟動流程 ----------

async function main() {
  console.log("[Fairy] Initializing…");
  writeLog("Fairy initializing…");

  // 1. 建立 AI 核心（CopilotClient + Session）
  const { client, session } = await createAiCore();

  // 2. 發送測試訊息確認 session 正常運作
  await verifySession(session);

  // 3. 建立並啟動 Telegram Bot
  const bot = createBot(session);
  startBot(bot, session);

  console.log("[Fairy] Ready.");
  writeLog("Fairy is ready.");

  // 4. 優雅關閉：收到終止信號時依序釋放資源
  const shutdown = async () => {
    console.log("\n[Fairy] Shutting down…");
    writeLog("Shutting down…");
    bot.stop();
    await session.destroy();
    const errors = await client.stop();
    if (errors.length > 0) {
      console.error("[Fairy] Cleanup errors:", errors);
      writeLog(`Cleanup errors: ${JSON.stringify(errors)}`);
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[Fairy] Fatal error:", err);
  writeLog(`Fatal error: ${err}`);
  process.exit(1);
});
