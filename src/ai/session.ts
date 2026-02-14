import { CopilotClient, type CopilotSession } from "@github/copilot-sdk";
import { SESSION_ID, MODEL, systemPrompt, PROJECT_ROOT } from "../config.js";
import { writeLog } from "../logger.js";

export interface AiCore {
  client: CopilotClient;
  session: CopilotSession;
}

/**
 * 建立 AI 核心：CopilotClient + CopilotSession
 *
 * - 使用 Fairy.md 作為 system prompt（完全取代預設提示）
 * - workingDirectory 設為專案根目錄，讓 AI 能操作檔案
 * - onPermissionRequest 自動核准所有操作（Fairy 是受信任的自主 Agent）
 */
export async function createAiCore(): Promise<AiCore> {
  const client = new CopilotClient();

  const session = await client.createSession({
    sessionId: SESSION_ID,
    model: MODEL,
    systemMessage: {
      mode: "replace",
      content: systemPrompt,
    },
    workingDirectory: PROJECT_ROOT,
    onPermissionRequest: async () => ({ kind: "approved" as const }),
  });

  console.log(`[Fairy] Session "${SESSION_ID}" created with model ${MODEL}`);
  writeLog(`Session "${SESSION_ID}" created with model ${MODEL}`);

  // 訂閱 session 事件，方便監控與除錯
  session.on((event) => {
    switch (event.type) {
      case "assistant.message":
        console.log(`[Fairy] Assistant: ${event.data.content}`);
        break;
      case "session.error":
        console.error(`[Fairy] Error:`, event.data);
        writeLog(`Error: ${JSON.stringify(event.data)}`);
        break;
      case "session.idle":
        console.log(`[Fairy] Session idle`);
        break;
    }
  });

  return { client, session };
}

/**
 * 發送啟動確認訊息，驗證 session 是否正常運作
 */
export async function verifySession(session: CopilotSession): Promise<void> {
  const response = await session.sendAndWait(
    { prompt: "你已經啟動，請簡短回覆確認你是 Fairy。" },
    30_000,
  );

  if (response) {
    console.log(`[Fairy] Boot confirmation: ${response.data.content}`);
  }
}
