const logger = require("../utils/logger");
const { randomPick, formatDate } = require("../utils/helpers");
const { getReplies } = require("../services/replyService");
const { getUserStats } = require("../services/userService");
const { addMemory, clearMemory, getContext } = require("../services/memoryService");
const { helpKeyboard, jokeKeyboard } = require("./commandHandler");

async function handleCallback(callbackQuery, bot) {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  await bot.answerCallbackQuery(callbackQuery.id);

  const replies = getReplies();

  if (data === "help_about") {
    const about = randomPick(replies.aboutReplies);
    try {
      await bot.sendMessage(chatId, about);
      addMemory(userId, "bot", about);
      logger.info(`🤖 Showed About to user ${userId}`);
    } catch (err) {
      logger.error(`Callback about error: ${err.message}`);
    }
    return;
  }

  if (data === "help_stats") {
    const userStat = getUserStats(userId);
    if (!userStat) {
      try { await bot.sendMessage(chatId, "No stats yet. Start chatting!"); } catch (e) {}
      return;
    }
    const ctx = getContext(userId);
    const memoryCount = ctx ? ctx.messageCount : 0;
    const reply =
      `📊 *Your Stats*\n` +
      `📅 First seen: ${formatDate(userStat.firstSeen)}\n` +
      `💬 Messages: ${userStat.messageCount}\n` +
      `🌐 Language: ${userStat.language || "unknown"}\n` +
      `🧠 Memory: ${memoryCount} messages`;
    try {
      await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error(`Callback stats error: ${err.message}`);
    }
    return;
  }

  if (data === "help_joke") {
    const jokes = getAllJokes(replies);
    const joke = jokes.length > 0 ? jokes[0] : "No jokes available!";
    try {
      await bot.sendMessage(chatId, joke, {
        reply_markup:
          jokes.length > 1
            ? {
                inline_keyboard: [
                  [{ text: "Next →", callback_data: "joke_1" }],
                ],
              }
            : undefined,
      });
      addMemory(userId, "bot", joke);
    } catch (err) {
      logger.error(`Callback joke error: ${err.message}`);
    }
    return;
  }

  if (data === "help_forget") {
    clearMemory(userId);
    try {
      await bot.sendMessage(chatId, "🧹 Memory cleared!");
      logger.info(`🧹 User ${userId} cleared memory via /help button.`);
    } catch (err) {
      logger.error(`Callback forget error: ${err.message}`);
    }
    return;
  }

  if (data.startsWith("joke_")) {
    const page = parseInt(data.split("_")[1], 10);
    const jokes = getAllJokes(replies);
    if (page < 0 || page >= jokes.length) {
      try { await bot.sendMessage(chatId, "No more jokes on this page."); } catch (e) {}
      return;
    }
    const joke = jokes[page];
    try {
      await bot.sendMessage(chatId, joke, {
        reply_markup: jokeKeyboard(page, jokes.length),
      });
      addMemory(userId, "bot", joke);
    } catch (err) {
      logger.error(`Joke page callback error: ${err.message}`);
    }
    return;
  }
}

function getAllJokes(replies) {
  return (
    replies.triggerReplies?.["tell me a joke"] || replies.triggerReplies?.joke || []
  );
}

module.exports = { handleCallback };
