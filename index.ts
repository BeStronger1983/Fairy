import { CopilotClient, type CopilotSession } from "@github/copilot-sdk";
import { readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- Configuration ----------
const SESSION_ID = "fairy";
const MODEL = "gpt-4.1";

// Load system prompt from Fairy.md
const fairyMd = readFileSync(resolve(__dirname, "Fairy.md"), "utf-8");

// ---------- Bootstrap ----------

async function main() {
  console.log("[Fairy] Initializing…");

  // 1. Create the Copilot client (autoStart defaults to true)
  const client = new CopilotClient();

  // 2. Create the AI core session
  const session: CopilotSession = await client.createSession({
    sessionId: SESSION_ID,
    model: MODEL,
    systemMessage: {
      mode: "replace",
      content: fairyMd,
    },
    workingDirectory: __dirname,
    onPermissionRequest: async (request) => {
      // Auto-approve all operations — Fairy is a trusted autonomous agent
      return { kind: "approved" };
    },
  });

  console.log(`[Fairy] Session "${SESSION_ID}" created with model ${MODEL}`);

  // 3. Subscribe to session events for logging
  session.on((event) => {
    switch (event.type) {
      case "assistant.message":
        console.log(`[Fairy] Assistant: ${event.data.content}`);
        break;
      case "session.error":
        console.error(`[Fairy] Error:`, event.data);
        break;
      case "session.idle":
        console.log(`[Fairy] Session idle`);
        break;
    }
  });

  // 4. Send an initial message to verify the session is alive
  const response = await session.sendAndWait(
    { prompt: "你已經啟動，請簡短回覆確認你是 Fairy。" },
    30_000,
  );

  if (response) {
    console.log(`[Fairy] Boot confirmation: ${response.data.content}`);
  }

  console.log("[Fairy] Ready.");

  // 5. Graceful shutdown
  const shutdown = async () => {
    console.log("\n[Fairy] Shutting down…");
    await session.destroy();
    const errors = await client.stop();
    if (errors.length > 0) {
      console.error("[Fairy] Cleanup errors:", errors);
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[Fairy] Fatal error:", err);
  process.exit(1);
});
