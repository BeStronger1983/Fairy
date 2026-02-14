import { appendFileSync, mkdirSync, readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { PROJECT_ROOT } from "./config.js";

const LOG_DIR = resolve(PROJECT_ROOT, "log");
const LOG_FILE = resolve(LOG_DIR, "fairy.log");
const REQUEST_LOG_FILE = resolve(LOG_DIR, "request.log");

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
  durationMs?: number;
}

/** request.log 的整體結構 */
interface RequestLogFile {
  entries: RequestLogEntry[];
  lastUpdated: string;
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
 * 讀取 request.log JSON 檔案
 */
function readRequestLogFile(): RequestLogFile {
  if (!existsSync(REQUEST_LOG_FILE)) {
    return { entries: [], lastUpdated: new Date().toISOString() };
  }

  try {
    const content = readFileSync(REQUEST_LOG_FILE, 'utf-8');
    return JSON.parse(content) as RequestLogFile;
  } catch (error) {
    // 檔案損壞或格式錯誤，重新建立
    console.warn('[Logger] request.log 格式錯誤，重新建立');
    return { entries: [], lastUpdated: new Date().toISOString() };
  }
}

/**
 * 寫入請求記錄到 log/request.log（JSON 格式）
 */
export function writeRequestLog(entry: RequestLogEntry): void {
  const logFile = readRequestLogFile();
  logFile.entries.push(entry);
  logFile.lastUpdated = new Date().toISOString();

  // 只保留最近 100 筆記錄，避免檔案過大
  if (logFile.entries.length > 100) {
    logFile.entries = logFile.entries.slice(-100);
  }

  writeFileSync(REQUEST_LOG_FILE, JSON.stringify(logFile, null, 2));
}

/**
 * 讀取最後一次請求的用量記錄
 * @returns 最後一次請求的用量，或 null（找不到記錄）
 */
export function getLastRequestUsage(): RequestLogEntry | null {
  const logFile = readRequestLogFile();

  if (logFile.entries.length === 0) {
    return null;
  }

  return logFile.entries[logFile.entries.length - 1];
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
