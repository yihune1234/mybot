const logger = require("../utils/logger");
const { randomPick, formatDate } = require("../utils/helpers");
const { getReplies, pickLocalizedReply, pickLocalizedTriggerReply, getAllJokes } = require("../services/replyService");
const { getUserStats, getUserLanguage } = require("../services/userService");
const { addMemory, clearMemory, getContext } = require("../services/memoryService");
const { helpKeyboard, jokeKeyboard } = require("./commandHandler");

async function handleCallback(callbackQuery, bot) {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;
  const userLang = getUserLanguage(userId) || "english";
  const lang = userLang;

  await bot.answerCallbackQuery(callbackQuery.id);

  const replies = getReplies();

  if (data === "help_about") {
    const about = pickLocalizedReply("aboutReplies", lang) || "About this bot.";
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
      const msg = lang === "oromo" ? "Amma itti gaafii hin jiru. Jalqaba haasa'i!" : "No stats yet. Start chatting!";
      try { await bot.sendMessage(chatId, msg); } catch (e) {}
      return;
    }
    const ctx = getContext(userId);
    const memoryCount = ctx ? ctx.messageCount : 0;
    const reply = lang === "oromo"
      ? `📊 *Itti Gaafii kee*\n📅 Yeroo dura: ${formatDate(userStat.firstSeen)}\n💬 Ergaa: ${userStat.messageCount}\n🌐 Afaan: ${userStat.language || "unknown"}\n🧠 Yaadannoo: ${memoryCount}`
      : `📊 *Your Stats*\n📅 First seen: ${formatDate(userStat.firstSeen)}\n💬 Messages: ${userStat.messageCount}\n🌐 Language: ${userStat.language || "unknown"}\n🧠 Memory: ${memoryCount}`;
    try {
      await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error(`Callback stats error: ${err.message}`);
    }
    return;
  }

  if (data === "help_joke") {
    const jokes = getAllJokes(lang);
    const joke = jokes.length > 0 ? jokes[0] : (lang === "oromo" ? "Kolfaan hin jiru!" : "No jokes available!");
    try {
      await bot.sendMessage(chatId, joke, {
        reply_markup: jokes.length > 1
          ? { inline_keyboard: [[{ text: lang === "oromo" ? "Kan itti aanu →" : "Next →", callback_data: "joke_1" }]] }
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
      const msg = lang === "oromo" ? "🧹 Yaadannoo qulqulleffame!" : "🧹 Memory cleared!";
      await bot.sendMessage(chatId, msg);
      logger.info(`🧹 User ${userId} cleared memory via /help button.`);
    } catch (err) {
      logger.error(`Callback forget error: ${err.message}`);
    }
    return;
  }

  if (data.startsWith("joke_")) {
    const page = parseInt(data.split("_")[1], 10);
    const jokes = getAllJokes(lang);
    if (page < 0 || page >= jokes.length) {
      try { await bot.sendMessage(chatId, lang === "oromo" ? "Kolfaan baay'e miti." : "No more jokes on this page."); } catch (e) {}
      return;
    }
    const joke = jokes[page];
    try {
      await bot.sendMessage(chatId, joke, {
        reply_markup: jokeKeyboard(page, jokes.length, lang),
      });
      addMemory(userId, "bot", joke);
    } catch (err) {
      logger.error(`Joke page callback error: ${err.message}`);
    }
    return;
  }
}

module.exports = { handleCallback };
