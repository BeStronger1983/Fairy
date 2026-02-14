/**
 * Skills 系統
 *
 * 實作 OpenClaw 風格的 Skills 系統，支援：
 * - SKILL.md 格式的技能定義
 * - Progressive Disclosure（漸進式揭露）
 * - 三層載入：metadata → body → resources
 */

import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// ---------- 路徑 ----------

/** 專案根目錄 */
const PROJECT_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');

// ---------- 型別定義 ----------

/** Skill 的 metadata（L1：永遠在 context） */
export interface SkillMetadata {
    /** Skill 名稱 */
    name: string;
    /** 描述，用於判斷何時觸發此 Skill */
    description: string;
    /** Skill 資料夾路徑 */
    path: string;
}

/** 完整的 Skill（L2：觸發後載入） */
export interface Skill extends SkillMetadata {
    /** SKILL.md 的完整內容 */
    body: string;
    /** 是否有 scripts 資料夾 */
    hasScripts: boolean;
    /** 是否有 references 資料夾 */
    hasReferences: boolean;
    /** 是否有 assets 資料夾 */
    hasAssets: boolean;
}

// ---------- Skills 資料夾路徑 ----------

/** Skills 資料夾位置 */
const SKILLS_DIR = resolve(PROJECT_ROOT, '.github', 'skills');

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
 * 載入所有 Skills 的 metadata（L1）
 * 這是 Progressive Disclosure 的第一層，只載入名稱和描述
 * @returns SkillMetadata 陣列
 */
export function loadSkillsMetadata(): SkillMetadata[] {
    if (_skillsCache) {
        return _skillsCache;
    }

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
                    path: skillPath
                });
            }
        } catch (error) {
            console.error(`[Skills] Failed to load skill from ${skillPath}:`, error);
        }
    }

    _skillsCache = skills;
    return skills;
}

/**
 * 載入完整的 Skill（L2）
 * 這是 Progressive Disclosure 的第二層，載入完整 SKILL.md 內容
 * @param name Skill 名稱
 * @returns 完整的 Skill 物件，或 null（找不到時）
 */
export function loadSkill(name: string): Skill | null {
    const metadata = loadSkillsMetadata().find((s) => s.name === name);
    if (!metadata) {
        return null;
    }

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
 * @param skillName Skill 名稱
 * @param refName 參考文件名稱（不含路徑）
 * @returns 文件內容，或 null（找不到時）
 */
export function loadSkillReference(skillName: string, refName: string): string | null {
    const metadata = loadSkillsMetadata().find((s) => s.name === skillName);
    if (!metadata) {
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
 * @param skillName Skill 名稱
 * @returns 參考文件名稱陣列
 */
export function listSkillReferences(skillName: string): string[] {
    const metadata = loadSkillsMetadata().find((s) => s.name === skillName);
    if (!metadata) {
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
 * @param skillName Skill 名稱
 * @param scriptName 腳本名稱
 * @returns 腳本完整路徑，或 null（找不到時）
 */
export function getSkillScriptPath(skillName: string, scriptName: string): string | null {
    const metadata = loadSkillsMetadata().find((s) => s.name === skillName);
    if (!metadata) {
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
 * @returns 摘要字串
 */
export function generateSkillsSummary(): string {
    const skills = loadSkillsMetadata();

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

/**
 * 清除 Skills 快取（用於熱重載）
 */
export function clearSkillsCache(): void {
    _skillsCache = null;
}
