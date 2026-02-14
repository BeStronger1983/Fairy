/**
 * Premium Request Usage Tracker
 *
 * 追蹤 GitHub Copilot Premium Request 使用量
 * 根據不同 model 的 multiplier 計算實際消耗
 */

import { writeLog } from './logger.js';

// ---------- Model Multiplier 定義 ----------

/**
 * Model 到 Premium Request Multiplier 的對應表
 *
 * 來源：https://docs.github.com/en/copilot/managing-copilot/monitoring-usage-and-entitlements/about-premium-requests
 *
 * - 包含模型（GPT-5 mini, GPT-4.1, GPT-4o）：付費計劃免費，Free 計劃 1x
 * - 其他模型根據複雜度有不同倍率
 *
 * 注意：此表格需要定期更新以反映 GitHub 的最新定價
 * 最後更新：2026-02-14
 */
const MODEL_MULTIPLIERS: Record<string, number> = {
    // 包含模型（付費計劃 0x，Free 計劃 1x）
    'gpt-5-mini': 0,
    'gpt-4.1': 0,
    'gpt-4o': 0,

    // Claude 系列
    'claude-opus-4.5': 3,
    'claude-opus-4.6': 9, // fast mode preview
    'claude-sonnet-4.5': 1,
    'claude-sonnet-4': 1,
    'claude-haiku-4.5': 0.25,

    // GPT 系列（非包含）
    'gpt-5': 1,
    'gpt-5.1': 1,
    'gpt-5.1-codex': 1,
    'gpt-5.1-codex-mini': 0.5,
    'gpt-5.1-codex-max': 2,
    'gpt-5.2': 1,
    'gpt-5.2-codex': 1,

    // Gemini 系列
    'gemini-3-pro-preview': 1,

    // 其他（預設）
    'o1': 3,
    'o1-mini': 1,
    'o3-mini': 1
};

/**
 * 取得 model 的 premium request multiplier
 * @param modelId Model ID
 * @returns Multiplier（未知 model 預設為 1）
 */
export function getModelMultiplier(modelId: string): number {
    // 先嘗試完全匹配
    if (modelId in MODEL_MULTIPLIERS) {
        return MODEL_MULTIPLIERS[modelId];
    }

    // 嘗試部分匹配（處理版本號等變體）
    const lowerModelId = modelId.toLowerCase();
    for (const [key, value] of Object.entries(MODEL_MULTIPLIERS)) {
        if (lowerModelId.includes(key.toLowerCase()) || key.toLowerCase().includes(lowerModelId)) {
            return value;
        }
    }

    // 未知 model 預設為 1
    console.warn(`[UsageTracker] Unknown model "${modelId}", using default multiplier 1`);
    return 1;
}

// ---------- Usage Tracker 類別 ----------

/** 單次對話的用量記錄 */
interface ConversationUsage {
    /** 開始時間 */
    startTime: Date;
    /** 結束時間（idle 時設定） */
    endTime?: Date;
    /** 使用的 model */
    model: string;
    /** 請求次數 */
    requestCount: number;
    /** 總 premium request 消耗 */
    premiumRequestsUsed: number;
}

/** 累計用量統計 */
interface UsageStats {
    /** 本次 session 總 premium requests */
    sessionTotal: number;
    /** 本次 session 總請求次數 */
    sessionRequests: number;
    /** 各對話的用量記錄 */
    conversations: ConversationUsage[];
}

/**
 * Premium Request Usage Tracker
 *
 * 追蹤單一 session 的 premium request 使用量
 */
export class UsageTracker {
    private _model: string;
    private _multiplier: number;
    private _currentConversation: ConversationUsage | null = null;
    private _stats: UsageStats = {
        sessionTotal: 0,
        sessionRequests: 0,
        conversations: []
    };

    constructor(model: string) {
        this._model = model;
        this._multiplier = getModelMultiplier(model);
        writeLog(`UsageTracker initialized: model=${model}, multiplier=${this._multiplier}x`);
    }

    /** 取得當前使用的 model */
    get model(): string {
        return this._model;
    }

    /** 取得當前 model 的 multiplier */
    get multiplier(): number {
        return this._multiplier;
    }

    /** 取得 session 總用量 */
    get sessionTotal(): number {
        return this._stats.sessionTotal;
    }

    /** 取得 session 總請求次數 */
    get sessionRequests(): number {
        return this._stats.sessionRequests;
    }

    /**
     * 記錄一次請求
     * 每次發送訊息給 AI 時呼叫
     */
    recordRequest(): void {
        // 如果沒有進行中的對話，開始新對話
        if (!this._currentConversation) {
            this._currentConversation = {
                startTime: new Date(),
                model: this._model,
                requestCount: 0,
                premiumRequestsUsed: 0
            };
        }

        // 增加計數
        this._currentConversation.requestCount++;
        this._currentConversation.premiumRequestsUsed += this._multiplier;
        this._stats.sessionRequests++;
        this._stats.sessionTotal += this._multiplier;

        writeLog(
            `Request recorded: +${this._multiplier} premium requests ` +
                `(conversation: ${this._currentConversation.premiumRequestsUsed}, ` +
                `session: ${this._stats.sessionTotal})`
        );
    }

    /**
     * 結束當前對話（session idle 時呼叫）
     * @returns 本次對話的用量摘要
     */
    endConversation(): ConversationUsage | null {
        if (!this._currentConversation) {
            return null;
        }

        // 設定結束時間
        this._currentConversation.endTime = new Date();

        // 保存到歷史記錄
        const completed = { ...this._currentConversation };
        this._stats.conversations.push(completed);

        // 清除當前對話
        this._currentConversation = null;

        writeLog(
            `Conversation ended: ${completed.requestCount} requests, ` +
                `${completed.premiumRequestsUsed} premium requests`
        );

        return completed;
    }

    /**
     * 取得當前對話的用量（如果有）
     */
    getCurrentUsage(): ConversationUsage | null {
        return this._currentConversation ? { ...this._currentConversation } : null;
    }

    /**
     * 取得完整的用量統計
     */
    getStats(): UsageStats {
        return {
            ...this._stats,
            conversations: [...this._stats.conversations]
        };
    }

    /**
     * 產生用量摘要訊息
     * @param conversation 對話用量（可選，預設使用當前對話）
     * @returns 格式化的摘要訊息
     */
    formatUsageSummary(conversation?: ConversationUsage | null): string {
        const usage = conversation ?? this._currentConversation;

        if (!usage) {
            return '（無用量記錄）';
        }

        const duration = usage.endTime
            ? Math.round((usage.endTime.getTime() - usage.startTime.getTime()) / 1000)
            : Math.round((Date.now() - usage.startTime.getTime()) / 1000);

        const lines = [
            `📊 Premium Request 用量：`,
            `• Model: ${usage.model} (${this._multiplier}x)`,
            `• 請求次數: ${usage.requestCount}`,
            `• 消耗: ${usage.premiumRequestsUsed} premium requests`,
            `• 時長: ${formatDuration(duration)}`
        ];

        // 如果有累計資料，加入 session 總計
        if (this._stats.sessionRequests > usage.requestCount) {
            lines.push(`• Session 累計: ${this._stats.sessionTotal} premium requests`);
        }

        return lines.join('\n');
    }
}

// ---------- 輔助函式 ----------

/**
 * 格式化時間長度
 * @param seconds 秒數
 * @returns 格式化字串（如 "2m 30s"）
 */
function formatDuration(seconds: number): string {
    if (seconds < 60) {
        return `${seconds}s`;
    }

    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;

    if (minutes < 60) {
        return remainingSeconds > 0 ? `${minutes}m ${remainingSeconds}s` : `${minutes}m`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    return `${hours}h ${remainingMinutes}m`;
}

// ---------- 全域 Tracker 實例 ----------

/** 全域 tracker 實例（在 session 建立時初始化） */
let _globalTracker: UsageTracker | null = null;

/**
 * 初始化全域 usage tracker
 * @param model 使用的 model
 * @returns UsageTracker 實例
 */
export function initUsageTracker(model: string): UsageTracker {
    _globalTracker = new UsageTracker(model);
    return _globalTracker;
}

/**
 * 取得全域 usage tracker
 * @returns UsageTracker 實例，或 null（尚未初始化）
 */
export function getUsageTracker(): UsageTracker | null {
    return _globalTracker;
}

/**
 * 記錄一次請求（便捷函式）
 */
export function recordRequest(): void {
    _globalTracker?.recordRequest();
}

/**
 * 結束當前對話並取得用量摘要（便捷函式）
 * @returns 格式化的用量摘要，或 null
 */
export function endConversationAndGetSummary(): string | null {
    if (!_globalTracker) {
        return null;
    }

    const usage = _globalTracker.endConversation();
    if (!usage) {
        return null;
    }

    return _globalTracker.formatUsageSummary(usage);
}
