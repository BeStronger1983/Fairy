/**
 * Skills 系統
 *
 * 實作 OpenClaw 風格的 Skills 系統，支援：
 * - SKILL.md 格式的技能定義
 * - Progressive Disclosure（漸進式揭露）
 * - 三層載入：metadata → body → resources
 * - 整合 tool 資料夾（單檔工具自動轉為簡易 skill）
 * - 智慧判斷：根據用戶輸入推薦相關 skills
 */

import { readFileSync, readdirSync, existsSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve, join, dirname, basename, extname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- 路徑 ----------

/** 專案根目錄 */
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- 型別定義 ----------

/** Skill 來源 */
export type SkillSource = 'skills' | 'tool';

/** Skill 的 metadata（L1：永遠在 context） */
export interface SkillMetadata {
    /** Skill 名稱 */
    name: string;
    /** 描述，用於判斷何時觸發此 Skill */
    description: string;
    /** Skill 資料夾或檔案路徑 */
    path: string;
    /** 來源類型 */
    source: SkillSource;
    /** 關鍵字（用於智慧匹配） */
    keywords?: string[];
}

/** 完整的 Skill（L2：觸發後載入） */
export interface Skill extends SkillMetadata {
    /** SKILL.md 的完整內容（或 tool 程式碼） */
    body: string;
    /** 是否有 scripts 資料夾 */
    hasScripts: boolean;
    /** 是否有 references 資料夾 */
    hasReferences: boolean;
    /** 是否有 assets 資料夾 */
    hasAssets: boolean;
}

// ---------- Skills 資料夾路徑 ----------

/** Skills 資料夾位置（標準 skills） */
const SKILLS_DIR = resolve(PROJECT_ROOT, '.github', 'skills');

/** Tool 資料夾位置（單檔工具） */
const TOOL_DIR = resolve(PROJECT_ROOT, 'tool');

// ---------- YAML Frontmatter 解析 ----------

/**
 * 解析 SKILL.md 的 YAML frontmatter
 * @param content SKILL.md 的完整內容
 * @returns { frontmatter, body } frontmatter 物件與 body 內容
 */
function parseFrontmatter(content: string): { frontmatter: Record<string, string>; body: string } {
    const frontmatterRegex = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]*)$/;
    const match = content.match(frontmatterRegex);

    if (!match) {
        return { frontmatter: {}, body: content };
    }

    const frontmatterStr = match[1];
    const body = match[2];

    // 簡易 YAML 解析（只支援 key: value 格式）
    const frontmatter: Record<string, string> = {};
    for (const line of frontmatterStr.split('\n')) {
        const colonIndex = line.indexOf(':');
        if (colonIndex > 0) {
            const key = line.slice(0, colonIndex).trim();
            let value = line.slice(colonIndex + 1).trim();
            // 移除引號
            if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
                value = value.slice(1, -1);
            }
            frontmatter[key] = value;
        }
    }

    return { frontmatter, body };
}

// ---------- Skills 管理 ----------

/** 快取的 Skills metadata */
let _skillsCache: SkillMetadata[] | null = null;

/**
 * 從名稱和描述中提取關鍵字
 * @param name 名稱
 * @param description 描述
 * @returns 關鍵字陣列
 */
function extractKeywords(name: string, description: string): string[] {
    const text = `${name} ${description}`.toLowerCase();
    // 提取有意義的詞（英文、中文、數字）
    const words = text.match(/[\u4e00-\u9fff]+|[a-z0-9]+/g) ?? [];
    // 過濾太短的詞
    return [...new Set(words.filter((w) => w.length >= 2))];
}

/**
 * 載入 .github/skills/ 資料夾中的 skills
 * @returns SkillMetadata 陣列
 */
function loadSkillsFromSkillsDir(): SkillMetadata[] {
    const skills: SkillMetadata[] = [];

    if (!existsSync(SKILLS_DIR)) {
        return skills;
    }

    const entries = readdirSync(SKILLS_DIR, { withFileTypes: true });

    for (const entry of entries) {
        if (!entry.isDirectory()) continue;

        const skillPath = join(SKILLS_DIR, entry.name);
        const skillMdPath = join(skillPath, 'SKILL.md');

        if (!existsSync(skillMdPath)) continue;

        try {
            const content = readFileSync(skillMdPath, 'utf-8');
            const { frontmatter } = parseFrontmatter(content);

            if (frontmatter.name && frontmatter.description) {
                skills.push({
                    name: frontmatter.name,
                    description: frontmatter.description,
                    path: skillPath,
                    source: 'skills',
                    keywords: extractKeywords(frontmatter.name, frontmatter.description)
                });
            }
        } catch (error) {
            console.error(`[Skills] Failed to load skill from ${skillPath}:`, error);
        }
    }

    return skills;
}

/**
 * 從 tool 資料夾載入單檔工具作為 skills
 * 讀取 tool 的 metadata（從 memory 或檔案頭部註解）
 * @returns SkillMetadata 陣列
 */
function loadSkillsFromToolDir(): SkillMetadata[] {
    const skills: SkillMetadata[] = [];

    if (!existsSync(TOOL_DIR)) {
        return skills;
    }

    const files = readdirSync(TOOL_DIR).filter((f) => {
        const filepath = join(TOOL_DIR, f);
        return statSync(filepath).isFile();
    });

    for (const filename of files) {
        const filepath = join(TOOL_DIR, filename);
        const name = basename(filename, extname(filename));

        try {
            const content = readFileSync(filepath, 'utf-8');
            // 嘗試從檔案頭部註解提取描述
            // 支援格式：// Description: ... 或 # Description: ... 或 """..."""
            let description = `Tool: ${name}`;

            const descMatch = content.match(/^(?:\/\/|#)\s*(?:Description|描述):\s*(.+)$/im);
            if (descMatch) {
                description = descMatch[1].trim();
            }

            skills.push({
                name: `tool:${name}`,
                description,
                path: filepath,
                source: 'tool',
                keywords: extractKeywords(name, description)
            });
        } catch (error) {
            console.error(`[Skills] Failed to load tool ${filename}:`, error);
        }
    }

    return skills;
}

/**
 * 載入所有 Skills 的 metadata（L1）
 * 這是 Progressive Disclosure 的第一層，只載入名稱和描述
 * 整合 .github/skills/ 和 tool/ 兩個來源
 * @returns SkillMetadata 陣列
 */
export function loadSkillsMetadata(): SkillMetadata[] {
    if (_skillsCache) {
        return _skillsCache;
    }

    const skillsFromSkillsDir = loadSkillsFromSkillsDir();
    const skillsFromToolDir = loadSkillsFromToolDir();

    _skillsCache = [...skillsFromSkillsDir, ...skillsFromToolDir];
    return _skillsCache;
}

/**
 * 載入完整的 Skill（L2）
 * 這是 Progressive Disclosure 的第二層，載入完整 SKILL.md 內容
 * 支援 skills 資料夾和 tool 資料夾兩種來源
 * @param name Skill 名稱
 * @returns 完整的 Skill 物件，或 null（找不到時）
 */
export function loadSkill(name: string): Skill | null {
    const metadata = loadSkillsMetadata().find((s) => s.name === name);
    if (!metadata) {
        return null;
    }

    // 根據來源不同，載入方式不同
    if (metadata.source === 'tool') {
        // Tool 來源：直接讀取檔案內容
        const content = readFileSync(metadata.path, 'utf-8');
        return {
            ...metadata,
            body: content,
            hasScripts: false,
            hasReferences: false,
            hasAssets: false
        };
    }

    // Skills 來源：讀取 SKILL.md
    const skillMdPath = join(metadata.path, 'SKILL.md');
    const content = readFileSync(skillMdPath, 'utf-8');
    const { body } = parseFrontmatter(content);

    return {
        ...metadata,
        body,
        hasScripts: existsSync(join(metadata.path, 'scripts')) && statSync(join(metadata.path, 'scripts')).isDirectory(),
        hasReferences:
            existsSync(join(metadata.path, 'references')) && statSync(join(metadata.path, 'references')).isDirectory(),
        hasAssets: existsSync(join(metadata.path, 'assets')) && statSync(join(metadata.path, 'assets')).isDirectory()
    };
}

/**
 * 載入 Skill 的參考文件（L3）
 * 這是 Progressive Disclosure 的第三層，按需載入
 * 僅適用於 skills 來源（tool 來源沒有 references）
 * @param skillName Skill 名稱
 * @param refName 參考文件名稱（不含路徑）
 * @returns 文件內容，或 null（找不到時）
 */
export function loadSkillReference(skillName: string, refName: string): string | null {
    const metadata = loadSkillsMetadata().find((s) => s.name === skillName);
    if (!metadata || metadata.source === 'tool') {
        return null;
    }

    const refPath = join(metadata.path, 'references', refName);
    if (!existsSync(refPath)) {
        return null;
    }

    return readFileSync(refPath, 'utf-8');
}

/**
 * 列出 Skill 的所有參考文件
 * 僅適用於 skills 來源
 * @param skillName Skill 名稱
 * @returns 參考文件名稱陣列
 */
export function listSkillReferences(skillName: string): string[] {
    const metadata = loadSkillsMetadata().find((s) => s.name === skillName);
    if (!metadata || metadata.source === 'tool') {
        return [];
    }

    const refsPath = join(metadata.path, 'references');
    if (!existsSync(refsPath)) {
        return [];
    }

    return readdirSync(refsPath).filter((f) => !f.startsWith('.'));
}

/**
 * 取得 Skill 腳本的路徑
 * 僅適用於 skills 來源
 * @param skillName Skill 名稱
 * @param scriptName 腳本名稱
 * @returns 腳本完整路徑，或 null（找不到時）
 */
export function getSkillScriptPath(skillName: string, scriptName: string): string | null {
    const metadata = loadSkillsMetadata().find((s) => s.name === skillName);
    if (!metadata || metadata.source === 'tool') {
        return null;
    }

    const scriptPath = join(metadata.path, 'scripts', scriptName);
    if (!existsSync(scriptPath)) {
        return null;
    }

    return scriptPath;
}

/**
 * 產生 Skills 摘要，用於加入 system prompt（L1）
 * 這是給 AI 看的，讓它知道有哪些 Skills 可用
 * @param includeTools 是否包含 tool 來源的 skills（預設 false，因為有專門的 tool 工具）
 * @returns 摘要字串
 */
export function generateSkillsSummary(includeTools = false): string {
    const skills = loadSkillsMetadata().filter((s) => includeTools || s.source === 'skills');

    if (skills.length === 0) {
        return '';
    }

    const lines = ['## Available Skills', ''];

    for (const skill of skills) {
        lines.push(`- **${skill.name}**: ${skill.description}`);
    }

    lines.push('');
    lines.push('To use a skill, mention its name in your request.');

    return lines.join('\n');
}

// ---------- 智慧匹配功能 ----------

/**
 * 根據用戶輸入找出相關的 skills
 * 使用關鍵字匹配計算相關度
 * @param userInput 用戶輸入
 * @param threshold 相關度閾值（0-1），預設 0.1
 * @returns 相關的 skills，按相關度排序
 */
export function findRelevantSkills(userInput: string, threshold = 0.1): SkillMetadata[] {
    const skills = loadSkillsMetadata();
    const inputLower = userInput.toLowerCase();
    const inputWords = inputLower.match(/[\u4e00-\u9fff]+|[a-z0-9]+/g) ?? [];

    const scored = skills.map((skill) => {
        let score = 0;
        const keywords = skill.keywords ?? [];

        // 完全匹配 skill 名稱
        if (inputLower.includes(skill.name.toLowerCase())) {
            score += 1.0;
        }

        // 關鍵字匹配
        for (const keyword of keywords) {
            if (inputLower.includes(keyword)) {
                score += 0.3;
            }
            // 輸入的詞與關鍵字匹配
            for (const inputWord of inputWords) {
                if (keyword.includes(inputWord) || inputWord.includes(keyword)) {
                    score += 0.1;
                }
            }
        }

        // 描述匹配
        const descLower = skill.description.toLowerCase();
        for (const inputWord of inputWords) {
            if (descLower.includes(inputWord)) {
                score += 0.05;
            }
        }

        return { skill, score };
    });

    return scored
        .filter((s) => s.score >= threshold)
        .sort((a, b) => b.score - a.score)
        .map((s) => s.skill);
}

/**
 * 根據用戶輸入推薦最相關的 skill
 * @param userInput 用戶輸入
 * @returns 最相關的 skill，或 null（沒有相關的）
 */
export function suggestSkill(userInput: string): SkillMetadata | null {
    const relevant = findRelevantSkills(userInput, 0.3);
    return relevant.length > 0 ? relevant[0] : null;
}

// ---------- 將 tool 升級為 skill ----------

/**
 * 將單檔工具升級為完整的 skill（在 .github/skills/ 建立資料夾）
 * @param toolName tool 名稱（不含 tool: 前綴）
 * @param description 描述
 * @param body SKILL.md 的內容（可選，預設會從工具檔案生成）
 * @returns 是否成功
 */
export function upgradeToolToSkill(toolName: string, description: string, body?: string): boolean {
    const toolPath = join(TOOL_DIR, toolName);

    // 找到工具檔案（可能有不同副檔名）
    let actualToolPath: string | null = null;
    const extensions = ['.ts', '.js', '.py', '.sh', ''];

    for (const ext of extensions) {
        const tryPath = toolPath + ext;
        if (existsSync(tryPath) && statSync(tryPath).isFile()) {
            actualToolPath = tryPath;
            break;
        }
    }

    if (!actualToolPath) {
        console.error(`[Skills] Tool not found: ${toolName}`);
        return false;
    }

    // 建立 skill 資料夾
    const skillDir = join(SKILLS_DIR, toolName);
    const scriptsDir = join(skillDir, 'scripts');

    if (!existsSync(skillDir)) {
        mkdirSync(skillDir, { recursive: true });
    }

    if (!existsSync(scriptsDir)) {
        mkdirSync(scriptsDir, { recursive: true });
    }

    // 讀取工具內容
    const toolContent = readFileSync(actualToolPath, 'utf-8');

    // 產生 SKILL.md
    const defaultBody = `# ${toolName}

${description}

## 使用方式

這個 skill 包含一個腳本：\`${basename(actualToolPath)}\`

執行方式請參考 scripts 資料夾中的腳本。

## 原始工具內容

\`\`\`
${toolContent.slice(0, 500)}${toolContent.length > 500 ? '\n...(truncated)' : ''}
\`\`\`
`;

    const skillMd = `---
name: ${toolName}
description: ${description}
---

${body ?? defaultBody}
`;

    // 寫入 SKILL.md
    writeFileSync(join(skillDir, 'SKILL.md'), skillMd, 'utf-8');

    // 複製工具到 scripts 資料夾
    writeFileSync(join(scriptsDir, basename(actualToolPath)), toolContent, 'utf-8');

    // 清除快取
    clearSkillsCache();

    console.log(`[Skills] Upgraded tool "${toolName}" to skill`);
    return true;
}

/**
 * 清除 Skills 快取（用於熱重載）
 */
export function clearSkillsCache(): void {
    _skillsCache = null;
}
