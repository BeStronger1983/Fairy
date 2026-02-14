import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateSkillsSummary } from './skills.js';

// ---------- 路徑 ----------

/** 專案根目錄（package.json 所在處） */
export const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- AI 核心 ----------

export const SESSION_ID = 'fairy';

/** 用於觸發自動重啟的特殊 exit code（對應 start.sh） */
export const RESTART_EXIT_CODE = 42;

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
const baseSytemPrompt: string = readFileSync(resolve(PROJECT_ROOT, 'Fairy.md'), 'utf-8');

/**
 * 完整的 system prompt，包含：
 * - 基礎人格設定（Fairy.md）
 * - Skills 摘要（L1：名稱 + 描述）
 */
export const systemPrompt: string = [baseSytemPrompt, '', generateSkillsSummary()].filter(Boolean).join('\n');
