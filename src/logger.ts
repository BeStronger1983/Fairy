import { appendFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PROJECT_ROOT } from "./config.js";

const LOG_DIR = resolve(PROJECT_ROOT, "log");
const LOG_FILE = resolve(LOG_DIR, "fairy.log");

// 確保 log 目錄存在
mkdirSync(LOG_DIR, { recursive: true });

/** 請求記錄的結構 */
export interface RequestLogEntry {
  timestamp: string;
  userMessage: string;
  model: string;
  multiplier: number;
  subagentInfo?: { id: string; model: string; requests: number; premiumUsed: number }[];
  totalPremiumUsed: number;
}

/**
 * 寫入一行帶時間戳的日誌到 log/fairy.log
 */
export function writeLog(message: string): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  appendFileSync(LOG_FILE, logLine);
}

/**
 * 寫入請求記錄到 log（結構化格式，方便解析）
 */
export function writeRequestLog(entry: RequestLogEntry): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] [REQUEST_LOG] ${JSON.stringify(entry)}\n`;
  appendFileSync(LOG_FILE, logLine);
}

/**
 * 讀取最後一次請求的用量記錄
 * @returns 最後一次請求的用量，或 null（找不到記錄）
 */
export function getLastRequestUsage(): RequestLogEntry | null {
  if (!existsSync(LOG_FILE)) {
    return null;
  }

  try {
    const content = readFileSync(LOG_FILE, 'utf-8');
    const lines = content.split('\n').reverse();

    for (const line of lines) {
      if (line.includes('[REQUEST_LOG]')) {
        const jsonStart = line.indexOf('[REQUEST_LOG]') + '[REQUEST_LOG] '.length;
        const jsonStr = line.slice(jsonStart);
        return JSON.parse(jsonStr) as RequestLogEntry;
      }
    }
  } catch (error) {
    console.error('[Logger] Failed to read last request usage:', error);
  }

  return null;
}

/**
 * 結構化 Logger
 */
export const log = {
  info(message: string): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [INFO] ${message}\n`;
    console.log(`[INFO] ${message}`);
    appendFileSync(LOG_FILE, logLine);
  },
  
  warn(message: string): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [WARN] ${message}\n`;
    console.warn(`[WARN] ${message}`);
    appendFileSync(LOG_FILE, logLine);
  },
  
  error(message: string): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [ERROR] ${message}\n`;
    console.error(`[ERROR] ${message}`);
    appendFileSync(LOG_FILE, logLine);
  },
  
  debug(message: string): void {
    const timestamp = new Date().toISOString();
    const logLine = `[${timestamp}] [DEBUG] ${message}\n`;
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`);
    }
    appendFileSync(LOG_FILE, logLine);
  },
};
