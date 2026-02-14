import { Bot, InlineKeyboard } from 'grammy';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import type { CopilotClient, CopilotSession } from '@github/copilot-sdk';

import type { ModelInfo } from '../ai/session.js';
import { createSession } from '../ai/session.js';
import { botToken, authorizedUserId, PROJECT_ROOT, RESTART_EXIT_CODE } from '../config.js';
import { takeSnapshot, detectChanges } from '../file-snapshot.js';
import { writeLog } from '../logger.js';
import { notify, notifyError, setBotRef, markBotStarted } from '../notify.js';

/** Telegram 單則訊息字數上限 */
const TELEGRAM_MSG_LIMIT = 4096;

/** model 選擇 callback data 前綴 */
const MODEL_CALLBACK_PREFIX = 'model:';

/** todolist 檔案路徑 */
const TODOLIST_PATH = resolve(PROJECT_ROOT, 'doc/todolist.md');

/**
 * 建立 Telegram Bot，掛載權限 middleware 與 model 選擇流程
 *
 * 啟動時先顯示可用 model 按鈕讓使用者選擇，
 * 選定 model 後不立即建立 session（節省 premium request），
 * 等到第一次收到使用者訊息時才建立 session
 *
 * @returns bot 實例與一個 Promise，resolve 時附帶建立完成的 session
 */
export function createBot(client: CopilotClient, models: ModelInfo[]): {
    bot: Bot;
    sessionReady: Promise<CopilotSession>;
} {
    const bot = new Bot(botToken);

    // 設定 Bot 參考，供 notify 模組使用
    setBotRef(bot);

    // 用 Promise 讓外部能等待 session 建立完成
    let resolveSession!: (session: CopilotSession) => void;
    const sessionReady = new Promise<CopilotSession>((resolve) => {
        resolveSession = resolve;
    });

    // 保存 session 參考，建立前為 null
    let activeSession: CopilotSession | null = null;

    // 保存選定的 model，選定後為字串，未選定為 null
    let selectedModel: string | null = null;

    // 標記是否正在建立 session（避免重複建立）
    let isCreatingSession = false;

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

    // -------- 全域錯誤處理 --------
    bot.catch((err) => {
        console.error('[Fairy] Bot error:', err.message);
        writeLog(`Bot error: ${err.message}`);
    });

    // -------- Model 選擇 callback 處理 --------
    // 選定 model 後只記錄，不立即建立 session（節省 premium request）
    bot.on('callback_query:data', async (ctx) => {
        const data = ctx.callbackQuery.data;
        if (!data.startsWith(MODEL_CALLBACK_PREFIX)) return;

        selectedModel = data.slice(MODEL_CALLBACK_PREFIX.length);
        console.log(`[Fairy] User selected model: ${selectedModel}`);
        await notify(`使用者選擇了 model：${selectedModel}`);

        // answerCallbackQuery 可能因 query 過期而失敗（例如啟動時撿到舊 update），需容錯
        try {
            await ctx.answerCallbackQuery({ text: `已選擇 ${selectedModel}` });
        } catch {
            // callback query 過期，忽略
        }

        try {
            await ctx.editMessageText(
                `已選擇模型：${selectedModel} ✓\n\n` +
                `Session 將在你第一次傳訊息時建立（節省 premium request）。\n` +
                `現在可以開始對話了！`
            );
        } catch {
            // 訊息已被編輯或刪除，改用直接發送
            await bot.api.sendMessage(authorizedUserId, `已選擇模型：${selectedModel} ✓\n現在可以開始對話了！`);
        }
    });

    // -------- 文字訊息處理 --------
    bot.on('message:text', async (ctx) => {
        // 尚未選擇 model
        if (!selectedModel) {
            await ctx.reply('請先從上方按鈕選擇一個 model，我才能開始工作喔！');
            return;
        }

        // Lazy session 初始化：第一次收到訊息時才建立 session
        if (!activeSession && !isCreatingSession) {
            isCreatingSession = true;
            try {
                await ctx.reply(`正在建立 AI session（使用 ${selectedModel}）…`);
                const session = await createSession(client, selectedModel);
                activeSession = session;
                resolveSession(session);
                console.log('[Fairy] Session created on first message');
                await notify(`AI Session 已建立（model: ${selectedModel}）`);
            } catch (error) {
                const errMsg = error instanceof Error ? error.message : String(error);
                console.error('[Fairy] Failed to create session:', errMsg);
                await notifyError(`建立 session 失敗：${errMsg}`);
                await ctx.reply(`建立 session 失敗：${errMsg}`);
                isCreatingSession = false;
                return;
            }
        }

        // 等待 session 建立完成（處理並發情況）
        if (!activeSession) {
            await ctx.reply('Session 正在建立中，請稍候…');
            return;
        }

        const userMessage = ctx.message.text;
        console.log(`[Fairy] Received from authorized user: ${userMessage}`);

        // 手動重啟指令
        if (userMessage === '重啟' || userMessage === 'restart') {
            await ctx.reply('收到！正在重新啟動…');
            await notify('使用者要求手動重啟');
            process.exit(RESTART_EXIT_CODE);
        }

        try {
            // 在 AI 處理前建立檔案快照，用於事後比對變更
            const snapshotBefore = takeSnapshot(PROJECT_ROOT);

            const aiResponse = await activeSession.sendAndWait({ prompt: userMessage }, 300_000);

            if (aiResponse) {
                const replyText = aiResponse.data.content;
                await sendLongMessage(bot, authorizedUserId, replyText);
                writeLog(`Replied: ${replyText.slice(0, 200)}…`);
            } else {
                await ctx.reply('（無回應）');
                writeLog('No response from AI core');
            }

            // AI 處理完畢後比對快照，偵測原始碼是否被修改
            const snapshotAfter = takeSnapshot(PROJECT_ROOT);
            const changedFiles = detectChanges(PROJECT_ROOT, snapshotBefore, snapshotAfter);

            if (changedFiles.length > 0) {
                const fileList = changedFiles.join('\n');
                await bot.api.sendMessage(
                    authorizedUserId,
                    `偵測到以下檔案變更：\n${fileList}\n\n正在重新啟動…`
                );
                writeLog(`Files changed, restarting: ${changedFiles.join(', ')}`);
                process.exit(RESTART_EXIT_CODE);
            }
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            console.error('[Fairy] Error processing message:', errMsg);
            await notifyError(`處理訊息時發生錯誤：${errMsg}`);
        }
    });

    return { bot, sessionReady };
}

/**
 * 啟動 Bot 的 long polling，連線成功後先發送 todolist，再發送 model 選擇按鈕
 */
export function startBot(bot: Bot, models: ModelInfo[]): void {
    bot.start({
        drop_pending_updates: true,
        onStart: async (botInfo) => {
            console.log(`[Fairy] Telegram Bot @${botInfo.username} started`);
            writeLog(`Telegram Bot @${botInfo.username} started. Authorized user: ${authorizedUserId}`);

            // 標記 Bot 已啟動，開始發送 Telegram 通知
            markBotStarted();

            // 先發送 todolist 待辦功能清單
            await sendTodolist(bot);

            // 再發送 model 選擇按鈕
            await sendModelSelection(bot, models);
        }
    });
}

// ---------- Internal helpers ----------

/**
 * 讀取並發送 todolist.md 給授權使用者
 * 在選擇 model 前顯示待辦功能清單
 */
async function sendTodolist(bot: Bot): Promise<void> {
    if (!existsSync(TODOLIST_PATH)) {
        console.log('[Fairy] todolist.md not found, skipping');
        return;
    }

    try {
        const content = readFileSync(TODOLIST_PATH, 'utf-8');
        
        // 如果內容太長，只發送摘要
        if (content.length > TELEGRAM_MSG_LIMIT - 100) {
            await sendLongMessage(bot, authorizedUserId, `📋 **待辦功能清單**\n\n${content}`);
        } else {
            await bot.api.sendMessage(authorizedUserId, `📋 **待辦功能清單**\n\n${content}`, {
                parse_mode: 'Markdown'
            });
        }
        
        console.log('[Fairy] Todolist sent to user');
        writeLog('Todolist sent to user');
    } catch (error) {
        console.error('[Fairy] Failed to read todolist:', error);
        // 不影響啟動流程，繼續執行
    }
}

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
