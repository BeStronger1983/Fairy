/**
 * Fairy Memory System - OpenAI Embedding Provider
 * 
 * 使用 OpenAI 的 text-embedding-3-small 模型
 * 將文字轉換為向量，用於語意搜尋
 */

import OpenAI from 'openai';
import type { EmbeddingProvider } from './types.js';
import { log } from '../logger.js';

// 預設使用 text-embedding-3-small（便宜、快速、1536 維）
const DEFAULT_MODEL = 'text-embedding-3-small';
const DEFAULT_DIMENSIONS = 1536;

/**
 * 將向量正規化（單位向量）
 * 這確保餘弦相似度計算的一致性
 */
function normalizeVector(vec: number[]): number[] {
    const magnitude = Math.sqrt(vec.reduce((sum, v) => sum + v * v, 0));
    if (magnitude < 1e-10) {
        return vec;
    }
    return vec.map((v) => v / magnitude);
}

/**
 * 建立 OpenAI Embedding Provider
 */
export function createOpenAIEmbeddingProvider(apiKey?: string): EmbeddingProvider {
    const key = apiKey || process.env.OPENAI_API_KEY;
    
    if (!key) {
        throw new Error('OpenAI API key is required. Set OPENAI_API_KEY environment variable.');
    }

    const client = new OpenAI({ apiKey: key });
    const model = DEFAULT_MODEL;
    const dimensions = DEFAULT_DIMENSIONS;

    return {
        id: 'openai',
        model,
        dimensions,

        async embed(text: string): Promise<number[]> {
            const cleaned = text.trim();
            if (!cleaned) {
                return new Array(dimensions).fill(0);
            }

            try {
                const response = await client.embeddings.create({
                    model,
                    input: cleaned,
                    dimensions,
                });

                const embedding = response.data[0]?.embedding;
                if (!embedding) {
                    throw new Error('No embedding returned from OpenAI');
                }

                return normalizeVector(embedding);
            } catch (error) {
                log.error(`Embedding failed: ${error}`);
                throw error;
            }
        },

        async embedBatch(texts: string[]): Promise<number[][]> {
            const cleaned = texts.map((t) => t.trim()).filter(Boolean);
            if (cleaned.length === 0) {
                return [];
            }

            try {
                const response = await client.embeddings.create({
                    model,
                    input: cleaned,
                    dimensions,
                });

                return response.data.map((item) => normalizeVector(item.embedding));
            } catch (error) {
                log.error(`Batch embedding failed: ${error}`);
                throw error;
            }
        },
    };
}
