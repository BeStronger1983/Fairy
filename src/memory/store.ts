/**
 * Fairy Memory System - Vector Search
 * 
 * 使用 SQLite + 純 TypeScript 實作向量搜尋
 * 
 * ## 設計說明
 * 
 * OpenClaw 使用 sqlite-vec 擴展做向量搜尋，但該擴展需要編譯 native code。
 * Fairy 採用更簡單的方式：
 * 1. 將向量存為 JSON 字串在 SQLite
 * 2. 搜尋時載入所有向量到記憶體計算餘弦相似度
 * 
 * 這對於個人助理的記憶量（通常 < 10,000 chunks）完全夠用。
 */

import Database from 'better-sqlite3';
import { resolve } from 'node:path';
import { PROJECT_ROOT } from '../config.js';
import { log } from '../logger.js';
import type { MemoryChunk, IndexedFile, MemorySource, MemorySearchResult, MemoryStatus } from './types.js';

const DB_PATH = resolve(PROJECT_ROOT, '.fairy-memory.db');

/**
 * 計算兩個向量的餘弦相似度
 */
function cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
        return 0;
    }
    
    let dotProduct = 0;
    let normA = 0;
    let normB = 0;
    
    for (let i = 0; i < a.length; i++) {
        dotProduct += a[i] * b[i];
        normA += a[i] * a[i];
        normB += b[i] * b[i];
    }
    
    const magnitude = Math.sqrt(normA) * Math.sqrt(normB);
    if (magnitude < 1e-10) {
        return 0;
    }
    
    return dotProduct / magnitude;
}

/**
 * Memory Store - SQLite 資料庫操作
 */
export class MemoryStore {
    private db: Database.Database;
    
    constructor(dbPath: string = DB_PATH) {
        this.db = new Database(dbPath);
        this.initSchema();
    }
    
    /**
     * 初始化資料庫 schema
     */
    private initSchema(): void {
        this.db.exec(`
            -- 已索引的檔案
            CREATE TABLE IF NOT EXISTS files (
                path TEXT PRIMARY KEY,
                hash TEXT NOT NULL,
                source TEXT NOT NULL,
                indexed_at TEXT NOT NULL
            );
            
            -- 文字區塊和向量
            CREATE TABLE IF NOT EXISTS chunks (
                id TEXT PRIMARY KEY,
                path TEXT NOT NULL,
                content TEXT NOT NULL,
                embedding TEXT NOT NULL,  -- JSON array of numbers
                source TEXT NOT NULL,
                start_line INTEGER NOT NULL,
                end_line INTEGER NOT NULL,
                created_at TEXT NOT NULL,
                FOREIGN KEY (path) REFERENCES files(path) ON DELETE CASCADE
            );
            
            -- 索引
            CREATE INDEX IF NOT EXISTS idx_chunks_path ON chunks(path);
            CREATE INDEX IF NOT EXISTS idx_chunks_source ON chunks(source);
        `);
    }
    
    /**
     * 儲存檔案索引資訊
     */
    saveFile(file: IndexedFile): void {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO files (path, hash, source, indexed_at)
            VALUES (?, ?, ?, ?)
        `);
        stmt.run(file.path, file.hash, file.source, file.indexedAt);
    }
    
    /**
     * 取得檔案資訊
     */
    getFile(path: string): IndexedFile | null {
        const stmt = this.db.prepare('SELECT * FROM files WHERE path = ?');
        const row = stmt.get(path) as { path: string; hash: string; source: string; indexed_at: string } | undefined;
        
        if (!row) return null;
        
        return {
            path: row.path,
            hash: row.hash,
            source: row.source as MemorySource,
            indexedAt: row.indexed_at,
        };
    }
    
    /**
     * 刪除檔案及其所有 chunks
     */
    deleteFile(path: string): void {
        const deleteChunks = this.db.prepare('DELETE FROM chunks WHERE path = ?');
        const deleteFile = this.db.prepare('DELETE FROM files WHERE path = ?');
        
        this.db.transaction(() => {
            deleteChunks.run(path);
            deleteFile.run(path);
        })();
    }
    
    /**
     * 儲存 chunk
     */
    saveChunk(chunk: MemoryChunk): void {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO chunks (id, path, content, embedding, source, start_line, end_line, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        stmt.run(
            chunk.id,
            chunk.path,
            chunk.content,
            JSON.stringify(chunk.embedding),
            chunk.source,
            chunk.startLine,
            chunk.endLine,
            chunk.createdAt
        );
    }
    
    /**
     * 批次儲存 chunks
     */
    saveChunks(chunks: MemoryChunk[]): void {
        const stmt = this.db.prepare(`
            INSERT OR REPLACE INTO chunks (id, path, content, embedding, source, start_line, end_line, created_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        
        const insertMany = this.db.transaction((items: MemoryChunk[]) => {
            for (const chunk of items) {
                stmt.run(
                    chunk.id,
                    chunk.path,
                    chunk.content,
                    JSON.stringify(chunk.embedding),
                    chunk.source,
                    chunk.startLine,
                    chunk.endLine,
                    chunk.createdAt
                );
            }
        });
        
        insertMany(chunks);
    }
    
    /**
     * 向量搜尋
     */
    searchVector(queryEmbedding: number[], options: {
        maxResults?: number;
        minScore?: number;
        sources?: MemorySource[];
    } = {}): MemorySearchResult[] {
        const { maxResults = 10, minScore = 0.3, sources } = options;
        
        // 取得所有 chunks（可選過濾來源）
        let query = 'SELECT * FROM chunks';
        const params: string[] = [];
        
        if (sources && sources.length > 0) {
            const placeholders = sources.map(() => '?').join(', ');
            query += ` WHERE source IN (${placeholders})`;
            params.push(...sources);
        }
        
        const stmt = this.db.prepare(query);
        const rows = stmt.all(...params) as Array<{
            id: string;
            path: string;
            content: string;
            embedding: string;
            source: string;
            start_line: number;
            end_line: number;
        }>;
        
        // 計算每個 chunk 的相似度
        const results: Array<MemorySearchResult & { id: string }> = [];
        
        for (const row of rows) {
            const embedding = JSON.parse(row.embedding) as number[];
            const score = cosineSimilarity(queryEmbedding, embedding);
            
            if (score >= minScore) {
                results.push({
                    path: row.path,
                    snippet: row.content.slice(0, 500),  // 限制長度
                    score,
                    source: row.source as MemorySource,
                    startLine: row.start_line,
                    endLine: row.end_line,
                    id: row.id,
                });
            }
        }
        
        // 按分數排序並限制數量
        results.sort((a, b) => b.score - a.score);
        return results.slice(0, maxResults);
    }
    
    /**
     * 關鍵字搜尋（簡單的 LIKE 搜尋）
     */
    searchKeyword(query: string, options: {
        maxResults?: number;
        sources?: MemorySource[];
    } = {}): MemorySearchResult[] {
        const { maxResults = 10, sources } = options;
        
        let sql = 'SELECT * FROM chunks WHERE content LIKE ?';
        const params: (string | number)[] = [`%${query}%`];
        
        if (sources && sources.length > 0) {
            const placeholders = sources.map(() => '?').join(', ');
            sql += ` AND source IN (${placeholders})`;
            params.push(...sources);
        }
        
        sql += ` LIMIT ?`;
        params.push(maxResults);
        
        const stmt = this.db.prepare(sql);
        const rows = stmt.all(...params) as Array<{
            id: string;
            path: string;
            content: string;
            source: string;
            start_line: number;
            end_line: number;
        }>;
        
        return rows.map((row) => ({
            path: row.path,
            snippet: row.content.slice(0, 500),
            score: 0.5,  // 關鍵字匹配給固定分數
            source: row.source as MemorySource,
            startLine: row.start_line,
            endLine: row.end_line,
        }));
    }
    
    /**
     * 取得狀態
     */
    getStatus(): { filesCount: number; chunksCount: number } {
        const filesCount = (this.db.prepare('SELECT COUNT(*) as count FROM files').get() as { count: number }).count;
        const chunksCount = (this.db.prepare('SELECT COUNT(*) as count FROM chunks').get() as { count: number }).count;
        
        return { filesCount, chunksCount };
    }
    
    /**
     * 取得所有已索引的檔案路徑
     */
    getAllFilePaths(): string[] {
        const stmt = this.db.prepare('SELECT path FROM files');
        const rows = stmt.all() as Array<{ path: string }>;
        return rows.map((r) => r.path);
    }
    
    /**
     * 關閉資料庫
     */
    close(): void {
        this.db.close();
    }
}
