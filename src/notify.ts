/**
 * 通知模組
 *
 * 集中處理「寫 log + 發送 Telegram 通知」的邏輯
 * 讓使用者能即時掌握程式的重要執行狀況
 *
 * 在 Bot 尚未就緒時僅寫 log，不會報錯
 */
import type { Bot } from 'grammy';

import { authorizedUserId } from './config.js';
import { writeLog } from './logger.js';

// ---------- 模組狀態 ----------

/** Telegram Bot 實例參考，由 bot.ts 在建立後設定 */
let botRef: Bot | null = null;

/** Bot 是否已啟動（long polling 連線成功） */
let botStarted = false;

// ---------- 初始化 ----------

/**
 * 設定 Bot 參考，供 notify 使用
 *
 * 應在建立 Bot 後立即呼叫
 */
export function setBotRef(bot: Bot): void {
    botRef = bot;
}

/**
 * 標記 Bot 已啟動，開始發送 Telegram 通知
 *
 * 應在 bot.start 的 onStart callback 中呼叫
 */
export function markBotStarted(): void {
    botStarted = true;
}

// ---------- 通知函式 ----------

/**
 * 發送重要執行通知
 *
 * 同時寫入 log 與發送 Telegram 訊息給授權使用者
 * 若 Bot 尚未就緒，僅寫 log
 */
export async function notify(message: string): Promise<void> {
    writeLog(message);

    if (!botRef || !botStarted) return;

    try {
        await botRef.api.sendMessage(authorizedUserId, `📋 ${message}`);
    } catch (error) {
        // 發送失敗僅記錄，不中斷程式
        const errMsg = error instanceof Error ? error.message : String(error);
        writeLog(`Failed to send notification: ${errMsg}`);
    }
}

/**
 * 發送錯誤通知
 *
 * 用於較嚴重的異常狀況，訊息帶有醒目前綴
 */
export async function notifyError(message: string): Promise<void> {
    writeLog(`ERROR: ${message}`);

    if (!botRef || !botStarted) return;

    try {
        await botRef.api.sendMessage(authorizedUserId, `⚠️ ${message}`);
    } catch (error) {
        const errMsg = error instanceof Error ? error.message : String(error);
        writeLog(`Failed to send error notification: ${errMsg}`);
    }
}
