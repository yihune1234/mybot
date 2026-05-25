require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const http = require("http");
const logger = require("./src/utils/logger");
const { PORT, REPLIES_FILE } = require("./src/utils/constants");
const { loadReplies } = require("./src/services/replyService");
const { handleMessage } = require("./src/handlers/messageHandler");
const { handleCallback } = require("./src/handlers/callbackHandler");
const { clearAllReminders } = require("./src/services/reminderService");
const { saveJSON } = require("./src/utils/dataStore");
const { getAllMemories } = require("./src/services/memoryService");
const { getStats, getAllUsers } = require("./src/services/userService");
const { MEMORY_FILE, STATS_FILE, USER_LIST_FILE } = require("./src/utils/constants");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error(
    "❌ TELEGRAM_BOT_TOKEN is not set.\n" +
      "   Create a .env file with: TELEGRAM_BOT_TOKEN=your_token_here"
  );
  process.exit(1);
}

loadReplies(REPLIES_FILE);

const PUBLIC_URL = process.env.PUBLIC_URL || null;
const useWebhook = !!PUBLIC_URL;
const bot = useWebhook ? new TelegramBot(TOKEN) : new TelegramBot(TOKEN, { polling: true });

bot.on("message", async (msg) => {
  try {
    await handleMessage(msg, bot, []);
  } catch (err) {
    logger.error(`Unhandled error in message handler: ${err.message}`);
  }
});

bot.on("callback_query", async (callbackQuery) => {
  try {
    const { trackUser } = require("./src/services/userService");
    trackUser(callbackQuery.from);
    await handleCallback(callbackQuery, bot);
  } catch (err) {
    logger.error(`Unhandled error in callback handler: ${err.message}`);
  }
});

if (!useWebhook) {
  let pollingRetries = 0;
  const MAX_POLLING_RETRIES = 5;

  bot.on("polling_error", (err) => {
    const msg = typeof err.message === "string" ? err.message : String(err.message);

    if (msg.includes("409")) {
      logger.warn("409 Conflict – another bot instance is running.");
      return;
    }

    if (msg.includes("EFATAL")) {
      pollingRetries++;
      logger.error(`Polling EFATAL (attempt ${pollingRetries}/${MAX_POLLING_RETRIES}): ${msg}`);

      if (pollingRetries <= MAX_POLLING_RETRIES) {
        const delay = Math.min(pollingRetries * 5000, 30000);
        logger.info(`🔁 Restarting polling in ${delay / 1000}s...`);
        setTimeout(() => {
          bot.startPolling().catch((e) => {
            logger.error(`Polling restart failed: ${e.message}`);
          });
        }, delay);
      } else {
        logger.error(`❌ Max polling retries reached. Falling back to webhook mode if PUBLIC_URL is set.`);
      }
      return;
    }

    logger.warn(`Polling warning: ${msg}`);
  });
}

function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Saving data and shutting down gracefully...`);
  clearAllReminders();
  saveJSON(MEMORY_FILE, getAllMemories());
  saveJSON(STATS_FILE, getStats());
  saveJSON(USER_LIST_FILE, getAllUsers());
  logger.info("All data saved. Goodbye!");
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.stack : String(reason);
  logger.error(`Unhandled rejection: ${message}`);
});

const server = http.createServer((req, res) => {
  if (useWebhook && req.method === "POST" && req.url === "/webhook") {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      try {
        bot.processUpdate(JSON.parse(body));
        res.writeHead(200);
        res.end();
      } catch (err) {
        logger.error(`Webhook processing error: ${err.message}`);
        res.writeHead(400);
        res.end("invalid update");
      }
    });
    return;
  }
  res.writeHead(200, { "Content-Type": "application/json" });
  res.end(JSON.stringify({ status: "ok", uptime: process.uptime() }));
});

server.listen(PORT, "0.0.0.0", () => {
  logger.info(`🌐 HTTP server listening on port ${PORT}`);
  console.log(`🌐 HTTP server listening on port ${PORT}`);
});

(async () => {
  if (useWebhook) {
    const webhookUrl = `${PUBLIC_URL.replace(/\/+$/, "")}/webhook`;
    try {
      await bot.setWebHook(webhookUrl);
      logger.info(`🔗 Webhook set to ${webhookUrl}`);
      console.log(`🔗 Webhook set to ${webhookUrl}`);
    } catch (err) {
      logger.error(`Failed to set webhook: ${err.message}`);
      console.error(`❌ Failed to set webhook: ${err.message}`);
      process.exit(1);
    }
  }
  logger.info("🤖 Bot is now running and listening for messages...");
  console.log(`🤖 Bot started – listening via ${useWebhook ? "webhook" : "long polling"}...`);
})();
