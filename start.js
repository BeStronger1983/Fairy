#!/usr/bin/env node
/**
 * Fairy 跨平台自動重啟包裝腳本
 * 
 * 當 Fairy 以 exit code 42 結束時，自動執行 npm install 並重新啟動
 * 支援 Mac、Linux、Windows
 */

import { spawn } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const RESTART_CODE = 42;

/**
 * 執行指令並回傳 Promise
 * @param {string} command - 指令
 * @param {string[]} args - 參數
 * @returns {Promise<number>} exit code
 */
function runCommand(command, args) {
    return new Promise((resolve) => {
        // Windows 需要使用 shell: true 來執行 npm
        const isWindows = process.platform === 'win32';
        const child = spawn(command, args, {
            stdio: 'inherit',
            cwd: __dirname,
            shell: isWindows
        });

        child.on('close', (code) => {
            resolve(code ?? 0);
        });

        child.on('error', (err) => {
            console.error(`[Fairy] Failed to start: ${err.message}`);
            resolve(1);
        });
    });
}

/**
 * 執行 npm install（靜默模式）
 */
async function runNpmInstall() {
    const isWindows = process.platform === 'win32';
    const npm = isWindows ? 'npm.cmd' : 'npm';
    await runCommand(npm, ['install', '--silent']);
}

/**
 * 主程式：執行 Fairy，監控 exit code 並自動重啟
 */
async function main() {
    while (true) {
        // 使用 npx tsx 執行 TypeScript
        const isWindows = process.platform === 'win32';
        const npx = isWindows ? 'npx.cmd' : 'npx';
        
        const exitCode = await runCommand(npx, ['tsx', 'src/index.ts']);

        if (exitCode === RESTART_CODE) {
            console.log('[Fairy] 偵測到程式碼變更，正在重新啟動…');
            await runNpmInstall();
            await sleep(1000);
            continue;
        }

        console.log(`[Fairy] 結束，exit code: ${exitCode}`);
        process.exit(exitCode);
    }
}

/**
 * 等待指定毫秒數
 * @param {number} ms
 */
function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// 啟動主程式
main().catch((err) => {
    console.error('[Fairy] Fatal error:', err);
    process.exit(1);
});
