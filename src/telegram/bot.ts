import { Bot } from "grammy";
import type { CopilotSession } from "@github/copilot-sdk";
import { botToken, authorizedUserId } from "../config.js";
import { writeLog } from "../logger.js";

/** Telegram 單則訊息字數上限 */
const TELEGRAM_MSG_LIMIT = 4096;

/**
 * 建立 Telegram Bot 並掛載所有 middleware 與 handler
 *
 * @param session - AI 核心 session，用來處理使用者訊息
 * @returns 設定完成的 Bot 實例（尚未啟動）
 */
export function createBot(session: CopilotSession): Bot {
  const bot = new Bot(botToken);

  // -------- 權限控制 middleware --------
  // 只允許授權使用者，其他人的訊息完全忽略、不回應
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (userId !== authorizedUserId) {
      console.log(`[Fairy] Ignored message from unauthorized user: ${userId}`);
      writeLog(`Ignored message from unauthorized user: ${userId}`);
      return;
    }
    await next();
  });

  // -------- 文字訊息處理 --------
  bot.on("message:text", async (ctx) => {
    const userMessage = ctx.message.text;
    console.log(`[Fairy] Received from authorized user: ${userMessage}`);
    writeLog(`Received message: ${userMessage}`);

    try {
      const aiResponse = await session.sendAndWait(
        { prompt: userMessage },
        120_000,
      );

      if (aiResponse) {
        const replyText = aiResponse.data.content;
        await sendLongMessage(bot, authorizedUserId, replyText);
        writeLog(`Replied: ${replyText.slice(0, 200)}…`);
      } else {
        await ctx.reply("（無回應）");
        writeLog("No response from AI core");
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Fairy] Error processing message:`, errMsg);
      writeLog(`Error processing message: ${errMsg}`);
      await ctx.reply(`處理時發生錯誤：${errMsg}`);
    }
  });

  return bot;
}

/**
 * 啟動 Bot 的 long polling，並在連線成功後向主人發送問候
 *
 * 這裡把「啟動 + 問候」封裝在一起，
 * 是因為問候需要等 bot.start 的 onStart callback 確認連線成功後才能發送
 */
export function startBot(bot: Bot, session: CopilotSession): void {
  bot.start({
    onStart: async (botInfo) => {
      console.log(`[Fairy] Telegram Bot @${botInfo.username} started`);
      console.log(`[Fairy] Authorized user ID: ${authorizedUserId}`);
      writeLog(
        `Telegram Bot @${botInfo.username} started. Authorized user: ${authorizedUserId}`,
      );

      // 啟動後主動跟主人打招呼
      await sendGreeting(bot, session);
    },
  });
}

// ---------- Internal helpers ----------

/**
 * 處理超過 Telegram 字數上限的訊息，自動切割後依序送出
 */
async function sendLongMessage(
  bot: Bot,
  chatId: number,
  text: string,
): Promise<void> {
  if (text.length <= TELEGRAM_MSG_LIMIT) {
    await bot.api.sendMessage(chatId, text);
    return;
  }

  for (let i = 0; i < text.length; i += TELEGRAM_MSG_LIMIT) {
    await bot.api.sendMessage(chatId, text.slice(i, i + TELEGRAM_MSG_LIMIT));
  }
}

/**
 * 讓 AI 產生問候語並傳送給主人；若失敗則發送靜態備用訊息
 */
async function sendGreeting(bot: Bot, session: CopilotSession): Promise<void> {
  try {
    const greeting = await session.sendAndWait(
      { prompt: "你剛剛啟動完成，請用簡短的方式跟主人打招呼。" },
      30_000,
    );
    const greetingText = greeting?.data.content ?? "Fairy 已啟動！";
    await bot.api.sendMessage(authorizedUserId, greetingText);
    console.log(`[Fairy] Greeting sent: ${greetingText}`);
    writeLog(`Greeting sent: ${greetingText}`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    console.error(`[Fairy] Failed to send greeting:`, errMsg);
    writeLog(`Failed to send greeting: ${errMsg}`);
    await bot.api
      .sendMessage(authorizedUserId, "Fairy 已啟動！")
      .catch(() => {});
  }
}
