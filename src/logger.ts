import { appendFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
import { PROJECT_ROOT } from "./config.js";

const LOG_DIR = resolve(PROJECT_ROOT, "log");
const LOG_FILE = resolve(LOG_DIR, "fairy.log");

// 確保 log 目錄存在
mkdirSync(LOG_DIR, { recursive: true });

/**
 * 寫入一行帶時間戳的日誌到 log/fairy.log
 */
export function writeLog(message: string): void {
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  appendFileSync(LOG_FILE, logLine);
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
