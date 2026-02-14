import { CopilotClient, type CopilotSession } from "@github/copilot-sdk";
import { readFileSync, appendFileSync, mkdirSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { Bot } from "grammy";

const __dirname = dirname(fileURLToPath(import.meta.url));

// ---------- Configuration ----------
const SESSION_ID = "fairy";
const MODEL = "gpt-4.1";

// Telegram Bot configuration
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const AUTHORIZED_USER_ID = process.env.TELEGRAM_AUTHORIZED_USER_ID;

if (!TELEGRAM_BOT_TOKEN) {
  console.error("[Fairy] TELEGRAM_BOT_TOKEN is not set. Exiting.");
  process.exit(1);
}

if (!AUTHORIZED_USER_ID) {
  console.error("[Fairy] TELEGRAM_AUTHORIZED_USER_ID is not set. Exiting.");
  process.exit(1);
}

const authorizedUserId = Number(AUTHORIZED_USER_ID);

// Load system prompt from Fairy.md
const fairyMd = readFileSync(resolve(__dirname, "Fairy.md"), "utf-8");

// ---------- Logging ----------

function writeLog(message: string) {
  const logDir = resolve(__dirname, "log");
  mkdirSync(logDir, { recursive: true });
  const timestamp = new Date().toISOString();
  const logLine = `[${timestamp}] ${message}\n`;
  appendFileSync(resolve(logDir, "fairy.log"), logLine);
}

// ---------- Bootstrap ----------

async function main() {
  console.log("[Fairy] Initializing…");
  writeLog("Fairy initializing…");

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
  writeLog(`Session "${SESSION_ID}" created with model ${MODEL}`);

  // 3. Subscribe to session events for logging
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

  // 4. Send an initial message to verify the session is alive
  const response = await session.sendAndWait(
    { prompt: "你已經啟動，請簡短回覆確認你是 Fairy。" },
    30_000,
  );

  if (response) {
    console.log(`[Fairy] Boot confirmation: ${response.data.content}`);
  }

  // 5. Initialize Telegram Bot
  const bot = new Bot(TELEGRAM_BOT_TOKEN!);

  // Access control middleware — ignore all messages from unauthorized users
  bot.use(async (ctx, next) => {
    const userId = ctx.from?.id;
    if (userId !== authorizedUserId) {
      console.log(`[Fairy] Ignored message from unauthorized user: ${userId}`);
      writeLog(`Ignored message from unauthorized user: ${userId}`);
      return; // Silently ignore — do not respond
    }
    await next();
  });

  // Handle text messages from authorized user
  bot.on("message:text", async (ctx) => {
    const userMessage = ctx.message.text;
    console.log(`[Fairy] Received from authorized user: ${userMessage}`);
    writeLog(`Received message: ${userMessage}`);

    try {
      // Send the message to the AI core and wait for a response
      const aiResponse = await session.sendAndWait(
        { prompt: userMessage },
        120_000,
      );

      if (aiResponse) {
        const replyText = aiResponse.data.content;
        // Telegram has a 4096-character limit per message
        if (replyText.length <= 4096) {
          await ctx.reply(replyText);
        } else {
          // Split long messages
          for (let i = 0; i < replyText.length; i += 4096) {
            await ctx.reply(replyText.slice(i, i + 4096));
          }
        }
        writeLog(`Replied: ${replyText.slice(0, 200)}…`);
      } else {
        await ctx.reply("（無回應）");
        writeLog("No response from AI core");
      }
    } catch (error) {
      const errMsg = error instanceof Error ? error.message : String(error);
      console.error(`[Fairy] Error processing message:`, errMsg);
      writeLog(`Error processing message: ${errMsg}`);
      await ctx.reply(`處理時發生錯誤：${errMsg}`);
    }
  });

  // Start the bot with long polling
  bot.start({
    onStart: (botInfo) => {
      console.log(`[Fairy] Telegram Bot @${botInfo.username} started`);
      console.log(`[Fairy] Authorized user ID: ${authorizedUserId}`);
      writeLog(`Telegram Bot @${botInfo.username} started. Authorized user: ${authorizedUserId}`);
    },
  });

  console.log("[Fairy] Ready.");
  writeLog("Fairy is ready.");

  // 6. Graceful shutdown
  const shutdown = async () => {
    console.log("\n[Fairy] Shutting down…");
    writeLog("Shutting down…");
    bot.stop();
    await session.destroy();
    const errors = await client.stop();
    if (errors.length > 0) {
      console.error("[Fairy] Cleanup errors:", errors);
      writeLog(`Cleanup errors: ${JSON.stringify(errors)}`);
    }
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

main().catch((err) => {
  console.error("[Fairy] Fatal error:", err);
  writeLog(`Fatal error: ${err}`);
  process.exit(1);
});
