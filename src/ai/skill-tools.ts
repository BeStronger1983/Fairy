/**
 * Skill 相關的自訂工具
 *
 * 提供給 AI 使用的工具，讓 AI 可以查詢、載入、使用 skills
 * 這些工具會被註冊到 CopilotSession
 */
import type { Tool } from '@github/copilot-sdk';

import {
    loadSkillsMetadata,
    loadSkill,
    findRelevantSkills,
    suggestSkill,
    listSkillReferences,
    loadSkillReference,
    getSkillScriptPath,
    upgradeToolToSkill,
    type SkillMetadata,
    type Skill
} from '../skills.js';
import { writeLog } from '../logger.js';

// ---------- 工具參數型別定義 ----------

interface LoadSkillArgs {
    name: string;
}

interface FindSkillsArgs {
    query: string;
    threshold?: number;
}

interface LoadReferenceArgs {
    skillName: string;
    refName: string;
}

interface UpgradeToolArgs {
    toolName: string;
    description: string;
    body?: string;
}

/**
 * 列出所有可用的 skills
 */
const listSkillsTool: Tool = {
    name: 'list_skills',
    description: `列出所有可用的 skills（包含 .github/skills/ 和 tool/ 資料夾）。
每個 skill 包含名稱、描述、來源、關鍵字等資訊。
這是 Progressive Disclosure 的 L1 層級，只顯示 metadata。`,
    parameters: {
        type: 'object',
        properties: {},
        required: []
    },
    handler: async () => {
        try {
            const skills = loadSkillsMetadata();

            writeLog(`Tool list_skills: found ${skills.length} skills`);

            return {
                success: true,
                count: skills.length,
                skills: skills.map((s) => ({
                    name: s.name,
                    description: s.description,
                    source: s.source,
                    keywords: s.keywords
                }))
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool list_skills error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 載入完整的 skill 內容
 */
const loadSkillTool: Tool<LoadSkillArgs> = {
    name: 'load_skill',
    description: `載入指定 skill 的完整內容（L2 層級）。
包含 SKILL.md 的完整內容（對於 skills 來源）或工具程式碼（對於 tool 來源）。
適合在需要詳細了解某個 skill 如何使用時呼叫。`,
    parameters: {
        type: 'object',
        properties: {
            name: {
                type: 'string',
                description: 'Skill 名稱'
            }
        },
        required: ['name']
    },
    handler: async (args) => {
        try {
            const skill = loadSkill(args.name);

            if (!skill) {
                return { error: `Skill "${args.name}" not found` };
            }

            writeLog(`Tool load_skill: loaded ${args.name}`);

            return {
                success: true,
                skill: {
                    name: skill.name,
                    description: skill.description,
                    source: skill.source,
                    body: skill.body,
                    hasScripts: skill.hasScripts,
                    hasReferences: skill.hasReferences,
                    hasAssets: skill.hasAssets
                }
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool load_skill error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 根據用戶輸入找出相關的 skills
 */
const findSkillsTool: Tool<FindSkillsArgs> = {
    name: 'find_skills',
    description: `根據查詢字串找出相關的 skills。
使用關鍵字匹配計算相關度，回傳按相關度排序的 skills。
適合在不確定要用哪個 skill 時使用。`,
    parameters: {
        type: 'object',
        properties: {
            query: {
                type: 'string',
                description: '查詢字串，例如「git commit」、「記憶」、「程式碼」'
            },
            threshold: {
                type: 'number',
                description: '相關度閾值（0-1），預設 0.1'
            }
        },
        required: ['query']
    },
    handler: async (args) => {
        try {
            const skills = findRelevantSkills(args.query, args.threshold ?? 0.1);

            writeLog(`Tool find_skills: found ${skills.length} skills for "${args.query}"`);

            return {
                success: true,
                count: skills.length,
                skills: skills.map((s) => ({
                    name: s.name,
                    description: s.description,
                    source: s.source
                }))
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool find_skills error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 載入 skill 的參考文件
 */
const loadSkillReferenceTool: Tool<LoadReferenceArgs> = {
    name: 'load_skill_reference',
    description: `載入 skill 的參考文件（L3 層級）。
僅適用於 skills 來源（.github/skills/），tool 來源沒有參考文件。`,
    parameters: {
        type: 'object',
        properties: {
            skillName: {
                type: 'string',
                description: 'Skill 名稱'
            },
            refName: {
                type: 'string',
                description: '參考文件名稱'
            }
        },
        required: ['skillName', 'refName']
    },
    handler: async (args) => {
        try {
            const availableRefs = listSkillReferences(args.skillName);

            if (availableRefs.length === 0) {
                return {
                    error: `Skill "${args.skillName}" has no references or is a tool-based skill`
                };
            }

            const content = loadSkillReference(args.skillName, args.refName);

            if (!content) {
                return {
                    error: `Reference "${args.refName}" not found in skill "${args.skillName}". Available: ${availableRefs.join(', ')}`
                };
            }

            writeLog(`Tool load_skill_reference: loaded ${args.skillName}/${args.refName}`);

            return {
                success: true,
                skillName: args.skillName,
                refName: args.refName,
                content
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool load_skill_reference error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 將 tool 升級為完整的 skill
 */
const upgradeToolToSkillTool: Tool<UpgradeToolArgs> = {
    name: 'upgrade_tool_to_skill',
    description: `將 tool/ 資料夾中的單檔工具升級為完整的 skill。
會在 .github/skills/ 建立新的 skill 資料夾，包含 SKILL.md 和 scripts/。
升級後的 skill 可以有更完整的文件和參考資料。`,
    parameters: {
        type: 'object',
        properties: {
            toolName: {
                type: 'string',
                description: '工具名稱（不含副檔名）'
            },
            description: {
                type: 'string',
                description: 'Skill 的描述'
            },
            body: {
                type: 'string',
                description: 'SKILL.md 的主要內容（選填，會自動生成預設內容）'
            }
        },
        required: ['toolName', 'description']
    },
    handler: async (args) => {
        try {
            const success = upgradeToolToSkill(args.toolName, args.description, args.body);

            if (!success) {
                return { error: `Failed to upgrade tool "${args.toolName}" to skill` };
            }

            writeLog(`Tool upgrade_tool_to_skill: upgraded ${args.toolName}`);

            return {
                success: true,
                message: `Tool "${args.toolName}" has been upgraded to a full skill in .github/skills/${args.toolName}/`
            };
        } catch (error) {
            const errMsg = error instanceof Error ? error.message : String(error);
            writeLog(`Tool upgrade_tool_to_skill error: ${errMsg}`);
            return { error: errMsg };
        }
    }
};

/**
 * 取得所有 skill 相關工具
 */
export function getSkillTools(): Tool<unknown>[] {
    return [
        listSkillsTool,
        loadSkillTool as Tool<unknown>,
        findSkillsTool as Tool<unknown>,
        loadSkillReferenceTool as Tool<unknown>,
        upgradeToolToSkillTool as Tool<unknown>
    ];
}
