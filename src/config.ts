import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- 路徑 ----------

/** 專案根目錄（package.json 所在處） */
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- AI 核心 ----------

export const SESSION_ID = 'fairy';

// ---------- Telegram ----------

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_AUTHORIZED_USER_ID = process.env.TELEGRAM_AUTHORIZED_USER_ID;

if (!TELEGRAM_BOT_TOKEN) {
    console.error('[Fairy] TELEGRAM_BOT_TOKEN is not set. Exiting.');
    process.exit(1);
}

if (!TELEGRAM_AUTHORIZED_USER_ID) {
    console.error('[Fairy] TELEGRAM_AUTHORIZED_USER_ID is not set. Exiting.');
    process.exit(1);
}

export const botToken: string = TELEGRAM_BOT_TOKEN;
export const authorizedUserId = Number(TELEGRAM_AUTHORIZED_USER_ID);

// ---------- System Prompt ----------

/**
 * 從 Fairy.md 載入系統提示詞
 * 這個檔案定義了 Fairy 的人格與行為準則
 */
export const systemPrompt: string = readFileSync(resolve(PROJECT_ROOT, 'Fairy.md'), 'utf-8');
