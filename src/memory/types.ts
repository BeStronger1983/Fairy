/**
 * Fairy Memory System - Types
 * 參考 OpenClaw 的 Memory 系統設計
 */

/**
 * 記憶來源
 */
export type MemorySource = 'memory' | 'tool' | 'work';

/**
 * 記憶搜尋結果
 */
export interface MemorySearchResult {
    /** 檔案路徑 */
    path: string;
    /** 相關文字片段 */
    snippet: string;
    /** 相似度分數 (0-1) */
    score: number;
    /** 來源類型 */
    source: MemorySource;
    /** 開始行號 */
    startLine: number;
    /** 結束行號 */
    endLine: number;
}

/**
 * 記憶項目（向量化後的 chunk）
 */
export interface MemoryChunk {
    /** 唯一 ID */
    id: string;
    /** 檔案路徑 */
    path: string;
    /** 文字內容 */
    content: string;
    /** 向量嵌入 */
    embedding: number[];
    /** 來源類型 */
    source: MemorySource;
    /** 開始行號 */
    startLine: number;
    /** 結束行號 */
    endLine: number;
    /** 建立時間 */
    createdAt: string;
}

/**
 * 索引的檔案資訊
 */
export interface IndexedFile {
    /** 檔案路徑 */
    path: string;
    /** 檔案內容的 hash（用於偵測變更） */
    hash: string;
    /** 來源類型 */
    source: MemorySource;
    /** 最後索引時間 */
    indexedAt: string;
}

/**
 * Embedding Provider 介面
 */
export interface EmbeddingProvider {
    /** Provider ID */
    id: string;
    /** 模型名稱 */
    model: string;
    /** 向量維度 */
    dimensions: number;
    /** 將文字轉為向量 */
    embed(text: string): Promise<number[]>;
    /** 批次將文字轉為向量 */
    embedBatch(texts: string[]): Promise<number[][]>;
}

/**
 * Memory Manager 狀態
 */
export interface MemoryStatus {
    /** 已索引的檔案數 */
    filesCount: number;
    /** 已索引的 chunk 數 */
    chunksCount: number;
    /** Embedding provider */
    provider: string;
    /** 模型 */
    model: string;
    /** 資料庫路徑 */
    dbPath: string;
    /** 是否有待同步的變更 */
    dirty: boolean;
}
