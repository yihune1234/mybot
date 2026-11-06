require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const http = require("http");
const logger = require("./src/utils/logger");
const { PORT, REPLIES_FILE } = require("./src/utils/constants");
const { loadReplies } = require("./src/services/replyService");
const { loadTranslations } = require("./src/services/i18nService");
const { handleMessage } = require("./src/handlers/messageHandler");
const { handleCallback } = require("./src/handlers/callbackHandler");
const { handleAdminCommand } = require("./src/handlers/adminCommandHandler");
const { clearAllReminders } = require("./src/services/reminderService");
const { saveJSON } = require("./src/utils/dataStore");
const { getAllMemories } = require("./src/services/memoryService");
const { getStats, getAllUsers } = require("./src/services/userService");
const { MEMORY_FILE, STATS_FILE, USER_LIST_FILE } = require("./src/utils/constants");
const { init: initNotifier } = require("./src/services/adminNotifier");
const { trackError, trackSystemEvent, getStats: getTrackerStats } = require("./src/services/eventTracker");
const { isBlocked } = require("./src/services/blockService");
const { connectDB } = require("./src/utils/db");

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error("❌ TELEGRAM_BOT_TOKEN is not set.");
  process.exit(1);
}

// Connect to MongoDB selectively (if MONGO_URI configured; otherwise graceful fallback)
connectDB();

loadReplies(REPLIES_FILE);
loadTranslations();

const PUBLIC_URL = process.env.PUBLIC_URL || null;
const useWebhook = !!PUBLIC_URL;
const bot = useWebhook ? new TelegramBot(TOKEN) : new TelegramBot(TOKEN, { polling: true });

bot.setMyCommands([
  { command: "start", description: "Start the bot" },
  { command: "help", description: "Show help menu" },
  { command: "language", description: "Change language" },
  { command: "weather", description: "Get weather for a city" },
  { command: "remind", description: "Set a reminder" },
  { command: "stats", description: "View your stats" },
  { command: "forget", description: "Clear my memory" },
  { command: "ping", description: "Check bot latency" },
  { command: "contact", description: "Contact Yihune B" },
]).catch((err) => logger.warn(`Failed to set bot commands: ${err.message}`));

initNotifier(bot);

bot.on("message", async (msg) => {
  if (msg.from && msg.from.is_bot) return;
  if (msg.from && isBlocked(msg.from.id)) return;

  try {
    await handleMessage(msg, bot, []);
  } catch (err) {
    logger.error(`Unhandled error in message handler: ${err.message}`);
    trackError("messageHandler", msg.from?.id, err.message);
  }
});

bot.on("callback_query", async (callbackQuery) => {
  if (callbackQuery.from && isBlocked(callbackQuery.from.id)) {
    await bot.answerCallbackQuery(callbackQuery.id, { text: "You are blocked." });
    return;
  }

  try {
    const { trackUser } = require("./src/services/userService");
    trackUser(callbackQuery);
    await handleCallback(callbackQuery, bot);
  } catch (err) {
    logger.error(`Unhandled error in callback handler: ${err.message}`);
    trackError("callbackHandler", callbackQuery.from?.id, err.message);
    try {
      await bot.answerCallbackQuery(callbackQuery.id, { text: "Something went wrong. Please try again." });
      if (callbackQuery.message) {
        await bot.sendMessage(callbackQuery.message.chat.id, "❌ Sorry, something went wrong. Please try again.");
      }
    } catch (_) {}
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
      trackError("polling", "system", msg);

      if (pollingRetries <= MAX_POLLING_RETRIES) {
        const delay = Math.min(pollingRetries * 5000, 30000);
        logger.info(`🔁 Restarting polling in ${delay / 1000}s...`);
        setTimeout(() => {
          bot.startPolling().catch((e) => {
            logger.error(`Polling restart failed: ${e.message}`);
          });
        }, delay);
      } else {
        logger.error(`❌ Max polling retries reached.`);
      }
      return;
    }

    logger.warn(`Polling warning: ${msg}`);
  });
}

async function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Saving data and shutting down gracefully...`);
  clearAllReminders();
  saveJSON(MEMORY_FILE, getAllMemories());
  saveJSON(STATS_FILE, getStats());
  saveJSON(USER_LIST_FILE, getAllUsers());
  trackSystemEvent("shutdown", `Bot shut down via ${signal}`);
  logger.info("All data saved. Goodbye!");
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  const message = reason instanceof Error ? reason.stack : String(reason);
  logger.error(`Unhandled rejection: ${message}`);
  trackError("unhandledRejection", "system", message);
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

server.on("error", (err) => {
  if (err.code === "EADDRINUSE") {
    const nextPort = Number(PORT) + 10;
    logger.warn(`Port ${PORT} in use for HTTP health server. Trying port ${nextPort}...`);
    server.listen(nextPort, "0.0.0.0");
  } else {
    logger.error(`HTTP server error: ${err.message}`);
  }
});

server.listen(PORT, "0.0.0.0", () => {
  logger.info(`🌐 HTTP server listening on port ${PORT}`);
  console.log(`🌐 HTTP server listening on port ${PORT}`);
  trackSystemEvent("server_start", `HTTP server listening on port ${PORT}`);
});

(async () => {
  if (useWebhook) {
    const webhookUrl = `${PUBLIC_URL.replace(/\/+$/, "")}/webhook`;
    try {
      await bot.setWebHook(webhookUrl);
      logger.info(`🔗 Webhook set to ${webhookUrl}`);
      console.log(`🔗 Webhook set to ${webhookUrl}`);
      trackSystemEvent("webhook_set", `Webhook set to ${webhookUrl}`);
    } catch (err) {
      logger.error(`Failed to set webhook: ${err.message}`);
      console.error(`❌ Failed to set webhook: ${err.message}`);
      trackError("webhook", "system", err.message);
      process.exit(1);
    }
  }
  logger.info("🤖 Bot is now running and listening for messages...");
  console.log(`🤖 Bot started – listening via ${useWebhook ? "webhook" : "long polling"}...`);
  trackSystemEvent("bot_start", `Bot started via ${useWebhook ? "webhook" : "polling"}`);
})();
