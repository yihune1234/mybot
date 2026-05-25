const logger = require("../utils/logger");
const { randomPick, formatDate } = require("../utils/helpers");
const { getReplies, pickLocalizedReply, pickLocalizedTriggerReply, getAllJokes } = require("../services/replyService");
const { getUserStats, getUserLanguage, setUserLanguage, hasSelectedLanguage } = require("../services/userService");
const { addMemory, clearMemory, getContext } = require("../services/memoryService");
const { t, getLangCode } = require("../services/i18nService");
const { helpKeyboard, jokeKeyboard } = require("./commandHandler");
const { languageSelectionKeyboard } = require("./messageHandler");
const { trackLanguageSelection, trackError, trackBotReply } = require("../services/eventTracker");

async function handleCallback(callbackQuery, bot) {
  if (!callbackQuery || !callbackQuery.from) {
    logger.error(`Invalid callback query: ${JSON.stringify(callbackQuery)}`);
    return;
  }

  const msg = callbackQuery.message;
  if (!msg) {
    logger.error(`Callback ${callbackQuery.id} has no message`);
    try {
      await bot.answerCallbackQuery(callbackQuery.id, { text: "Something went wrong. Please try again." });
    } catch (_) {}
    return;
  }

  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data || "";

  await bot.answerCallbackQuery(callbackQuery.id);

  if (data === "lang_en") {
    setUserLanguage(userId, "english");
    const userName = callbackQuery.from.first_name || "unknown";
    trackLanguageSelection(userId, userName, "english");
    try {
      await bot.editMessageText(
        "✅ Language set to English 🇺🇸\n\nHello! How can I help you today?",
        {
          chat_id: chatId,
          message_id: msg.message_id,
          parse_mode: "Markdown",
        }
      );
      trackBotReply(userId, callbackQuery.from.first_name || "unknown", "/language", "Language set to English");
      logger.info(`🌐 User ${userId} selected English`);
    } catch (err) {
      logger.error(`Language selection error: ${err.message}`);
    }
    return;
  }

  if (data === "lang_om") {
    setUserLanguage(userId, "oromo");
    const userName = callbackQuery.from.first_name || "unknown";
    trackLanguageSelection(userId, userName, "oromo");
    try {
      await bot.editMessageText(
        "✅ Afaan Oromoo filatamee! 🇪🇹\n\nAkkam jirtu! Har'a maal keessatti si gargaaruu danda'a?",
        {
          chat_id: chatId,
          message_id: msg.message_id,
          parse_mode: "Markdown",
        }
      );
      trackBotReply(userId, callbackQuery.from.first_name || "unknown", "/language", "Language set to Afaan Oromoo");
      logger.info(`🌐 User ${userId} selected Afaan Oromoo`);
    } catch (err) {
      logger.error(`Language selection error: ${err.message}`);
    }
    return;
  }

  if (!hasSelectedLanguage(userId)) {
    try {
      await bot.sendMessage(
        chatId,
        "🌐 *Language Selection / Filannoo Afaanii*\n\nPlease select your preferred language to continue.\n\nAfaan kee filadhuu itti fufuuf.",
        {
          parse_mode: "Markdown",
          reply_markup: languageSelectionKeyboard(),
        }
      );
    } catch (err) {
      logger.error(`Language prompt error: ${err.message}`);
    }
    return;
  }

  const userLang = getUserLanguage(userId) || "english";
  const lang = userLang === "oromo" ? "oromo" : "english";
  const lc = getLangCode(userLang);
  const replies = getReplies();

  if (data === "help_about") {
    const about = pickLocalizedReply("aboutReplies", lang) || "About this bot.";
    try {
      await bot.sendMessage(chatId, about);
      addMemory(userId, "bot", about);
      trackBotReply(userId, callbackQuery.from.first_name || "unknown", "help_about", about);
      logger.info(`🤖 Showed About to user ${userId}`);
    } catch (err) {
      logger.error(`Callback about error: ${err.message}`);
    }
    return;
  }

  if (data === "help_stats") {
    const userStat = getUserStats(userId);
    if (!userStat) {
      try { await bot.sendMessage(chatId, t("commands.stats_no_data", lc)); } catch (e) {}
      return;
    }
    const ctx = getContext(userId);
    const memoryCount = ctx ? ctx.messageCount : 0;
    const reply = lang === "oromo"
      ? `📊 *Itti Gaafii kee*\n📅 Yeroo dura: ${formatDate(userStat.firstSeen)}\n💬 Ergaa: ${userStat.messageCount}\n🌐 Afaan: ${userStat.language || "unknown"}\n🧠 Yaadannoo: ${memoryCount}`
      : `📊 *Your Stats*\n📅 First seen: ${formatDate(userStat.firstSeen)}\n💬 Messages: ${userStat.messageCount}\n🌐 Language: ${userStat.language || "unknown"}\n🧠 Memory: ${memoryCount}`;
    try {
      await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
      trackBotReply(userId, callbackQuery.from.first_name || "unknown", "help_stats", reply);
    } catch (err) {
      logger.error(`Callback stats error: ${err.message}`);
    }
    return;
  }

  if (data === "help_joke") {
    const jokes = getAllJokes(lang);
    const joke = jokes.length > 0 ? jokes[0] : t("joke.no_jokes", lc);
    try {
      await bot.sendMessage(chatId, joke, {
        reply_markup: jokes.length > 1
          ? { inline_keyboard: [[{ text: lang === "oromo" ? "Kan itti aanu →" : "Next →", callback_data: "joke_1" }]] }
          : undefined,
      });
      addMemory(userId, "bot", joke);
      trackBotReply(userId, callbackQuery.from.first_name || "unknown", "help_joke", joke);
    } catch (err) {
      logger.error(`Callback joke error: ${err.message}`);
    }
    return;
  }

  if (data === "help_forget") {
    clearMemory(userId);
    try {
      const msg = lang === "oromo"
        ? "🧹 Yaadannoo qulqulleffame!"
        : "🧹 Memory cleared!";
      await bot.sendMessage(chatId, msg);
      trackBotReply(userId, callbackQuery.from.first_name || "unknown", "help_forget", msg);
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
      try { await bot.sendMessage(chatId, t("joke.no_more", lc)); } catch (e) {}
      return;
    }
    const joke = jokes[page];
    try {
      await bot.sendMessage(chatId, joke, {
        reply_markup: jokeKeyboard(page, jokes.length, lang),
      });
      addMemory(userId, "bot", joke);
      trackBotReply(userId, callbackQuery.from.first_name || "unknown", `joke_page_${page}`, joke);
    } catch (err) {
      logger.error(`Joke page callback error: ${err.message}`);
    }
    return;
  }

  if (data.startsWith("lang_switch_")) {
    const newLang = data.replace("lang_switch_", "");
    setUserLanguage(userId, newLang);
    const userName = callbackQuery.from.first_name || "unknown";
    trackLanguageSelection(userId, userName, newLang);
    const displayLang = newLang === "oromo" ? "Afaan Oromoo 🇪🇹" : "English 🇺🇸";
    const confirmMsg = newLang === "oromo"
      ? `✅ Afaan Oromoo 🇪🇹 ti jijjirame!\n\nAmmaa kaasee haasa'awwan hunduu afaan Oromoo ta'u.`
      : `✅ Language switched to English 🇺🇸\n\nFrom now on, all conversations will be in English.`;
    try {
      await bot.editMessageText(confirmMsg, {
        chat_id: chatId,
        message_id: msg.message_id,
        parse_mode: "Markdown",
      });
      trackBotReply(userId, callbackQuery.from.first_name || "unknown", "lang_switch", confirmMsg);
      logger.info(`🌐 User ${userId} switched language to ${newLang}`);
    } catch (err) {
      logger.error(`Language switch error: ${err.message}`);
    }
    return;
  }
}

module.exports = { handleCallback };
