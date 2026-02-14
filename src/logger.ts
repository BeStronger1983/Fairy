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
