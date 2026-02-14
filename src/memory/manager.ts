/**
 * Fairy Memory System - Memory Manager
 * 
 * 核心管理器：負責同步檔案、建立索引、執行搜尋
 * 
 * ## 功能
 * 1. 監控 memory/, tool/ 資料夾的 .md 和 .json 檔案
 * 2. 將檔案內容分割成 chunks
 * 3. 使用 Embedding API 將 chunks 向量化
 * 4. 提供語意搜尋 API
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, relative, extname } from 'node:path';
import { createHash } from 'node:crypto';
import { PROJECT_ROOT } from '../config.js';
import { log } from '../logger.js';
import { MemoryStore } from './store.js';
import { createOpenAIEmbeddingProvider } from './embedding-openai.js';
import type { 
    EmbeddingProvider, 
    MemorySource, 
    MemorySearchResult, 
    MemoryChunk, 
    IndexedFile,
    MemoryStatus 
} from './types.js';

// 設定
const MEMORY_DIR = resolve(PROJECT_ROOT, 'memory');
const TOOL_DIR = resolve(PROJECT_ROOT, 'tool');
const CHUNK_SIZE = 1000;  // 每個 chunk 最大字元數
const CHUNK_OVERLAP = 200;  // chunk 重疊字元數

/**
 * 計算檔案內容的 hash
 */
function hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex').slice(0, 16);
}

/**
 * 將文字分割成 chunks
 */
function splitIntoChunks(content: string, filePath: string, source: MemorySource): Array<{
    content: string;
    startLine: number;
    endLine: number;
}> {
    const lines = content.split('\n');
    const chunks: Array<{ content: string; startLine: number; endLine: number }> = [];
    
    let currentChunk = '';
    let currentStartLine = 1;
    let currentLine = 1;
    
    for (const line of lines) {
        const potentialChunk = currentChunk + (currentChunk ? '\n' : '') + line;
        
        // 如果加上這行會超過限制，先儲存當前 chunk
        if (potentialChunk.length > CHUNK_SIZE && currentChunk.length > 0) {
            chunks.push({
                content: currentChunk,
                startLine: currentStartLine,
                endLine: currentLine - 1,
            });
            
            // 開始新 chunk，包含一些重疊
            const overlapLines = currentChunk.split('\n').slice(-3);  // 取最後 3 行作為重疊
            currentChunk = overlapLines.join('\n') + '\n' + line;
            currentStartLine = Math.max(1, currentLine - overlapLines.length);
        } else {
            currentChunk = potentialChunk;
        }
        
        currentLine++;
    }
    
    // 儲存最後一個 chunk
    if (currentChunk.trim()) {
        chunks.push({
            content: currentChunk,
            startLine: currentStartLine,
            endLine: currentLine - 1,
        });
    }
    
    return chunks;
}

/**
 * 掃描資料夾中的檔案
 */
function scanDirectory(dir: string, source: MemorySource): Array<{ path: string; source: MemorySource }> {
    if (!existsSync(dir)) {
        return [];
    }
    
    const files: Array<{ path: string; source: MemorySource }> = [];
    const entries = readdirSync(dir, { withFileTypes: true });
    
    for (const entry of entries) {
        const fullPath = resolve(dir, entry.name);
        
        if (entry.isDirectory()) {
            // 遞迴掃描子資料夾
            files.push(...scanDirectory(fullPath, source));
        } else if (entry.isFile()) {
            const ext = extname(entry.name).toLowerCase();
            // 只索引 .md 和 .json 檔案
            if (ext === '.md' || ext === '.json') {
                files.push({ path: fullPath, source });
            }
        }
    }
    
    return files;
}

/**
 * Memory Manager - 記憶系統主管理器
 */
export class MemoryManager {
    private store: MemoryStore;
    private provider: EmbeddingProvider;
    private dirty: boolean = true;
    
    constructor(embeddingProvider?: EmbeddingProvider) {
        this.store = new MemoryStore();
        this.provider = embeddingProvider || createOpenAIEmbeddingProvider();
    }
    
    /**
     * 同步所有記憶檔案到向量資料庫
     */
    async sync(options: { force?: boolean } = {}): Promise<{ added: number; updated: number; removed: number }> {
        const { force = false } = options;
        const stats = { added: 0, updated: 0, removed: 0 };
        
        log.info('📚 Starting memory sync...');
        
        // 掃描所有來源資料夾
        const allFiles: Array<{ path: string; source: MemorySource }> = [
            ...scanDirectory(MEMORY_DIR, 'memory'),
            ...scanDirectory(TOOL_DIR, 'tool'),
        ];
        
        const currentPaths = new Set(allFiles.map((f) => f.path));
        
        // 1. 移除已刪除的檔案
        const indexedPaths = this.store.getAllFilePaths();
        for (const path of indexedPaths) {
            if (!currentPaths.has(path)) {
                this.store.deleteFile(path);
                stats.removed++;
                log.info(`🗑️ Removed: ${relative(PROJECT_ROOT, path)}`);
            }
        }
        
        // 2. 索引新增或更新的檔案
        for (const { path, source } of allFiles) {
            try {
                const content = readFileSync(path, 'utf-8');
                const hash = hashContent(content);
                const existing = this.store.getFile(path);
                
                // 如果檔案沒變且不是強制更新，跳過
                if (!force && existing && existing.hash === hash) {
                    continue;
                }
                
                // 分割成 chunks
                const rawChunks = splitIntoChunks(content, path, source);
                
                if (rawChunks.length === 0) {
                    continue;
                }
                
                // 批次產生 embeddings
                const texts = rawChunks.map((c) => c.content);
                const embeddings = await this.provider.embedBatch(texts);
                
                // 建立 MemoryChunk 物件
                const now = new Date().toISOString();
                const chunks: MemoryChunk[] = rawChunks.map((raw, i) => ({
                    id: `${hashContent(path)}-${i}`,
                    path,
                    content: raw.content,
                    embedding: embeddings[i],
                    source,
                    startLine: raw.startLine,
                    endLine: raw.endLine,
                    createdAt: now,
                }));
                
                // 刪除舊的 chunks 並儲存新的
                this.store.deleteFile(path);
                this.store.saveFile({
                    path,
                    hash,
                    source,
                    indexedAt: now,
                });
                this.store.saveChunks(chunks);
                
                if (existing) {
                    stats.updated++;
                    log.info(`🔄 Updated: ${relative(PROJECT_ROOT, path)} (${chunks.length} chunks)`);
                } else {
                    stats.added++;
                    log.info(`✨ Added: ${relative(PROJECT_ROOT, path)} (${chunks.length} chunks)`);
                }
            } catch (error) {
                log.error(`Failed to index ${path}: ${error}`);
            }
        }
        
        this.dirty = false;
        log.info(`📚 Memory sync complete: +${stats.added} ~${stats.updated} -${stats.removed}`);
        
        return stats;
    }
    
    /**
     * 搜尋記憶
     * 
     * @param query 搜尋查詢
     * @param options 搜尋選項
     * @returns 搜尋結果
     */
    async search(query: string, options: {
        maxResults?: number;
        minScore?: number;
        sources?: MemorySource[];
        hybrid?: boolean;  // 是否使用混合搜尋
    } = {}): Promise<MemorySearchResult[]> {
        const { maxResults = 5, minScore = 0.3, sources, hybrid = true } = options;
        
        // 如果有未同步的變更，先同步
        if (this.dirty) {
            await this.sync();
        }
        
        // 向量搜尋
        const queryEmbedding = await this.provider.embed(query);
        const vectorResults = this.store.searchVector(queryEmbedding, {
            maxResults: maxResults * 2,  // 取更多候選
            minScore,
            sources,
        });
        
        if (!hybrid) {
            return vectorResults.slice(0, maxResults);
        }
        
        // 混合搜尋：加入關鍵字結果
        const keywordResults = this.store.searchKeyword(query, {
            maxResults: maxResults,
            sources,
        });
        
        // 合併結果（去重）
        const seen = new Set<string>();
        const merged: MemorySearchResult[] = [];
        
        // 先加入向量搜尋結果（優先）
        for (const result of vectorResults) {
            const key = `${result.path}:${result.startLine}`;
            if (!seen.has(key)) {
                seen.add(key);
                merged.push(result);
            }
        }
        
        // 加入關鍵字結果
        for (const result of keywordResults) {
            const key = `${result.path}:${result.startLine}`;
            if (!seen.has(key)) {
                seen.add(key);
                // 如果也出現在向量結果中，提升分數
                const existingIndex = merged.findIndex(
                    (r) => r.path === result.path && r.startLine === result.startLine
                );
                if (existingIndex >= 0) {
                    merged[existingIndex].score = Math.min(1, merged[existingIndex].score + 0.1);
                } else {
                    merged.push(result);
                }
            }
        }
        
        // 重新排序
        merged.sort((a, b) => b.score - a.score);
        
        return merged.slice(0, maxResults);
    }
    
    /**
     * 取得狀態
     */
    status(): MemoryStatus {
        const { filesCount, chunksCount } = this.store.getStatus();
        
        return {
            filesCount,
            chunksCount,
            provider: this.provider.id,
            model: this.provider.model,
            dbPath: resolve(PROJECT_ROOT, '.fairy-memory.db'),
            dirty: this.dirty,
        };
    }
    
    /**
     * 標記需要重新同步
     */
    markDirty(): void {
        this.dirty = true;
    }
    
    /**
     * 關閉資源
     */
    close(): void {
        this.store.close();
    }
}

// 單例
let instance: MemoryManager | null = null;

/**
 * 取得 Memory Manager 單例
 */
export function getMemoryManager(): MemoryManager {
    if (!instance) {
        instance = new MemoryManager();
    }
    return instance;
}

/**
 * 關閉 Memory Manager
 */
export function closeMemoryManager(): void {
    if (instance) {
        instance.close();
        instance = null;
    }
}
