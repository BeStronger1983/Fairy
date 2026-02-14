/**
 * Fairy Memory System - Public API
 * 
 * 匯出所有 Memory 相關的公開介面
 */

// Types
export type { 
    MemorySource, 
    MemorySearchResult, 
    MemoryChunk, 
    IndexedFile, 
    EmbeddingProvider,
    MemoryStatus,
} from './types.js';

// Manager
export { 
    MemoryManager, 
    getMemoryManager, 
    closeMemoryManager,
} from './manager.js';

// Embedding Providers
export { createOpenAIEmbeddingProvider } from './embedding-openai.js';

// Store (advanced usage)
export { MemoryStore } from './store.js';
