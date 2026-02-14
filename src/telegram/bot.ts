import { Bot, InlineKeyboard } from 'grammy';
import type { CopilotClient, CopilotSession } from '@github/copilot-sdk';

import type { ModelInfo } from '../ai/session.js';
import { createSession, verifySession } from '../ai/session.js';
import { botToken, authorizedUserId } from '../config.js';
import { writeLog } from '../logger.js';

/** Telegram 單則訊息字數上限 */
const TELEGRAM_MSG_LIMIT = 4096;

/** model 選擇 callback data 前綴 */
const MODEL_CALLBACK_PREFIX = 'model:';

/**
 * 建立 Telegram Bot，掛載權限 middleware 與 model 選擇流程
 *
 * 啟動時先顯示可用 model 按鈕讓使用者選擇，
 * 選定後才建立 AI session 並進入正常訊息處理模式
 *
 * @returns bot 實例與一個 Promise，resolve 時附帶建立完成的 session
 */
export function createBot(client: CopilotClient, models: ModelInfo[]): {
    bot: Bot;
    sessionReady: Promise<CopilotSession>;
} {
    const bot = new Bot(botToken);

    // 用 Promise 讓外部能等待 session 建立完成
    let resolveSession!: (session: CopilotSession) => void;
    const sessionReady = new Promise<CopilotSession>((resolve) => {
        resolveSession = resolve;
    });

    // 保存 session 參考，建立前為 null
    let activeSession: CopilotSession | null = null;

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

    // -------- Model 選擇 callback 處理 --------
    bot.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;
        if (!data.startsWith(MODEL_CALLBACK_PREFIX)) return;

        const selectedModel = data.slice(MODEL_CALLBACK_PREFIX.length);
        console.log(`[Fairy] User selected model: ${selectedModel}`);
        writeLog(`User selected model: ${selectedModel}`);

        await ctx.answerCallbackQuery({ text: `已選擇 ${selectedModel}，正在建立 session…` });
        await ctx.editMessageText(`已選擇模型：${selectedModel}\n正在建立 AI session…`);

        try {
            const session = await createSession(client, selectedModel);
            activeSession = session;

            await verifySession(session);
            await sendGreeting(bot, session);

            resolveSession(session);
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error('[Fairy] Failed to create session:', errMsg);
            writeLog(`Failed to create session: ${errMsg}`);
            await bot.api.sendMessage(authorizedUserId, `建立 session 失敗：${errMsg}`);
        }
    });

    // -------- 文字訊息處理 --------
    bot.on('message:text', async (ctx) => {
        if (!activeSession) {
            await ctx.reply('請先從上方按鈕選擇一個 model，我才能開始工作喔！');
            return;
        }

        const userMessage = ctx.message.text;
        console.log(`[Fairy] Received from authorized user: ${userMessage}`);
        writeLog(`Received message: ${userMessage}`);

        try {
            const aiResponse = await activeSession.sendAndWait({ prompt: userMessage }, 120_000);

            if (aiResponse) {
                const replyText = aiResponse.data.content;
                await sendLongMessage(bot, authorizedUserId, replyText);
                writeLog(`Replied: ${replyText.slice(0, 200)}…`);
            } else {
                await ctx.reply('（無回應）');
                writeLog('No response from AI core');
            }
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error('[Fairy] Error processing message:', errMsg);
            writeLog(`Error processing message: ${errMsg}`);
            await ctx.reply(`處理時發生錯誤：${errMsg}`);
        }
    });

    return { bot, sessionReady };
}

/**
 * 啟動 Bot 的 long polling，連線成功後發送 model 選擇按鈕
 */
export function startBot(bot: Bot, models: ModelInfo[]): void {
    bot.start({
        onStart: async (botInfo) => {
            console.log(`[Fairy] Telegram Bot @${botInfo.username} started`);
            writeLog(`Telegram Bot @${botInfo.username} started. Authorized user: ${authorizedUserId}`);

            await sendModelSelection(bot, models);
        }
    });
}

// ---------- Internal helpers ----------

/**
 * 發送 model 選擇的 inline keyboard 按鈕給授權使用者
 */
async function sendModelSelection(bot: Bot, models: ModelInfo[]): Promise<void> {
    const keyboard = new InlineKeyboard();

    // 每個 model 一行一個按鈕
    for (const model of models) {
        keyboard.text(model.name, `${MODEL_CALLBACK_PREFIX}${model.id}`).row();
    }

    const modelList = models.map((m) => `• ${m.name} (${m.id})`).join('\n');

    await bot.api.sendMessage(authorizedUserId, `Fairy 已啟動！請選擇要使用的 AI model：\n\n${modelList}`, {
        reply_markup: keyboard
    });

    console.log('[Fairy] Model selection sent to user');
    writeLog('Model selection sent to user');
}

/**
 * 處理超過 Telegram 字數上限的訊息，自動切割後依序送出
 */
async function sendLongMessage(bot: Bot, chatId: number, text: string): Promise<void> {
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
            { prompt: '你剛剛啟動完成，請用簡短的方式跟主人打招呼。' },
            30_000
        );
        const greetingText = greeting?.data.content ?? 'Fairy 已啟動！';
        await bot.api.sendMessage(authorizedUserId, greetingText);
        console.log(`[Fairy] Greeting sent: ${greetingText}`);
        writeLog(`Greeting sent: ${greetingText}`);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        console.error('[Fairy] Failed to send greeting:', errMsg);
        writeLog(`Failed to send greeting: ${errMsg}`);
        await bot.api.sendMessage(authorizedUserId, 'Fairy 已啟動！').catch(() => {});
    }
}
