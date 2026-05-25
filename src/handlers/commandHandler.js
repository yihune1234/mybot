const logger = require("../utils/logger");
const { randomPick, formatDate } = require("../utils/helpers");
const { getReplies, pickLocalizedReply } = require("../services/replyService");
const { getWeather, formatWeather } = require("../services/weatherService");
const { setReminder } = require("../services/reminderService");
const { getUserStats, findUser, getGlobalStats, getAllUsers, getStats, getUserLanguage, setUserLanguage, hasSelectedLanguage } = require("../services/userService");
const { getContext, clearMemory } = require("../services/memoryService");
const { retrainClassifier } = require("../services/nluService");
const { t, getLangCode } = require("../services/i18nService");
const { REMINDER_MAX_MS } = require("../utils/constants");

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID
  ? parseInt(process.env.ADMIN_CHAT_ID, 10)
  : null;

function isAdmin(userId) {
  return ADMIN_CHAT_ID && userId === ADMIN_CHAT_ID;
}

async function handleCommand(text, chatId, userId, bot, userList, lang = "english") {
  if (text === "/language" || text === "/language@mybot_bot") {
    return handleLanguageCommand(chatId, userId, bot, lang);
  }

  const handled = await handleRegularCommand(text, chatId, userId, bot, userList, lang);
  if (handled) return true;

  return false;
}

async function handleLanguageCommand(chatId, userId, bot, lang) {
  const userLang = getUserLanguage(userId) || "english";
  const lc = getLangCode(userLang);
  const langName = userLang === "oromo" ? "Afaan Oromoo" : "English";
  const emoji = userLang === "oromo" ? "🇪🇹" : "🇺🇸";

  try {
    await bot.sendMessage(
      chatId,
      t("language_command.title", lc, { language: langName, emoji }),
      {
        parse_mode: "Markdown",
        reply_markup: languageSwitchKeyboard(lang),
      }
    );
  } catch (err) {
    logger.error(`/language error: ${err.message}`);
  }
  return true;
}

function languageSwitchKeyboard(lang = "english") {
  return {
    inline_keyboard: [
      [
        { text: "English 🇺🇸", callback_data: "lang_switch_english" },
        { text: "Afaan Oromoo 🇪🇹", callback_data: "lang_switch_oromo" },
      ],
    ],
  };
}

async function handleRegularCommand(text, chatId, userId, bot, userList, lang = "english") {
  const lc = getLangCode(lang);

  if (text === "/start") {
    try {
      await bot.sendMessage(chatId, t("commands.start", lc));
    } catch (err) {
      logger.error(`/start error: ${err.message}`);
    }
    return true;
  }

  if (text === "/reload") {
    if (!isAdmin(userId)) {
      try { await bot.sendMessage(chatId, t("admin.not_admin", lc)); } catch (e) {}
      return true;
    }
    try {
      const { reloadReplies } = require("../services/replyService");
      const { REPLIES_FILE } = require("../utils/constants");
      reloadReplies(REPLIES_FILE);
      retrainClassifier();
      try { await bot.sendMessage(chatId, t("admin.reload_ok", lc)); } catch (e) {}
      logger.info(`🔄 Admin ${userId} reloaded config and retrained classifier.`);
    } catch (err) {
      logger.error(`/reload error: ${err.message}`);
      try { await bot.sendMessage(chatId, `${t("admin.reload_fail", lc)}: ${err.message}`); } catch (e) {}
    }
    return true;
  }

  if (text === "/forget") {
    clearMemory(userId);
    try {
      await bot.sendMessage(chatId, t("commands.forget_done", lc));
      logger.info(`🧹 User ${userId} cleared their memory.`);
    } catch (err) {
      logger.error(`/forget error: ${err.message}`);
    }
    return true;
  }

  if (text === "/stats") {
    const userStat = getUserStats(userId);
    if (!userStat) {
      try { await bot.sendMessage(chatId, t("commands.stats_no_data", lc)); } catch (e) {}
      return true;
    }
    const ctx = getContext(userId);
    const memoryCount = ctx ? ctx.messageCount : 0;
    const label = t("commands.stats_title", lc);
    const firstSeenLabel = t("commands.stats_first_seen", lc);
    const msgsLabel = t("commands.stats_messages", lc);
    const langLabel = t("commands.stats_language", lc);
    const memLabel = t("commands.stats_memory", lc);
    const reply =
      `${label}\n` +
      `${firstSeenLabel}: ${formatDate(userStat.firstSeen)}\n` +
      `${msgsLabel}: ${userStat.messageCount}\n` +
      `${langLabel}: ${userStat.language || "unknown"}\n` +
      `${memLabel}: ${memoryCount} ${lang === "oromo" ? "ergaa" : "messages"}`;
    try { await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" }); } catch (err) {
      logger.error(`/stats error: ${err.message}`);
    }
    return true;
  }

  if (text === "/ping") {
    const start = Date.now();
    try {
      const sentMsg = await bot.sendMessage(chatId, t("commands.ping_response", lc));
      const elapsed = Date.now() - start;
      await bot.editMessageText(
        `${t("commands.ping_response", lc)}\n⏱ ${t("commands.ping_time", lc)}: ${elapsed}ms`,
        { chat_id: chatId, message_id: sentMsg.message_id }
      );
    } catch (err) {
      logger.error(`/ping error: ${err.message}`);
    }
    return true;
  }

  if (text.startsWith("/echo ")) {
    const echoText = text.slice(6).trim();
    if (!echoText) {
      try { await bot.sendMessage(chatId, t("commands.echo_usage", lc)); } catch (e) {}
      return true;
    }
    try { await bot.sendMessage(chatId, `🔊 ${echoText}`); } catch (err) {
      logger.error(`/echo error: ${err.message}`);
    }
    return true;
  }

  if (text === "/help") {
    try {
      await bot.sendMessage(chatId, t("commands.help", lc), {
        parse_mode: "Markdown",
        reply_markup: helpKeyboard(lang),
      });
    } catch (err) {
      logger.error(`/help error: ${err.message}`);
    }
    return true;
  }

  if (text.startsWith("/remind ")) {
    const parts = text.slice(8).trim().split(/ (.+)/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      try { await bot.sendMessage(chatId, t("commands.remind_usage", lc)); } catch (e) {}
      return true;
    }
    const timeStr = parts[0].trim();
    const remindText = parts[1].trim();
    const match = timeStr.match(/^(\d+)(s|sec|seconds?|m|min|minutes?|h|hr|hours?)$/i);
    if (!match) {
      try { await bot.sendMessage(chatId, t("commands.remind_invalid", lc)); } catch (e) {}
      return true;
    }
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    let ms = 0;
    if (unit.startsWith("s")) ms = amount * 1000;
    else if (unit.startsWith("m")) ms = amount * 60000;
    else if (unit.startsWith("h")) ms = amount * 3600000;

    if (ms > REMINDER_MAX_MS) {
      try { await bot.sendMessage(chatId, t("commands.remind_max", lc)); } catch (e) {}
      return true;
    }

    const id = setReminder(userId, chatId, ms, remindText, bot);
    try {
      const msg = t("commands.remind_set", lc, { time: timeStr });
      await bot.sendMessage(chatId, `${msg}\n📝 "${remindText}"`);
      logger.info(`Reminder #${id} set for user ${userId} in ${timeStr}: "${remindText}"`);
    } catch (err) {
      logger.error(`/remind error: ${err.message}`);
    }
    return true;
  }

  if (text.startsWith("/weather ")) {
    const city = text.slice(9).trim();
    if (!city) {
      try { await bot.sendMessage(chatId, t("commands.weather_usage", lc)); } catch (e) {}
      return true;
    }
    try {
      const weather = await getWeather(city);
      if (!weather) {
        const failReply = pickLocalizedReply("weatherFailReplies", lang) || t("errors.weather_fetch", lc);
        await bot.sendMessage(chatId, failReply);
        return true;
      }
      await bot.sendMessage(chatId, formatWeather(weather), { parse_mode: "Markdown" });
    } catch (err) {
      logger.error(`/weather error: ${err.message}`);
      try { await bot.sendMessage(chatId, t("commands.weather_unavailable", lc)); } catch (e) {}
    }
    return true;
  }

  if (text.startsWith("/") && isAdmin(userId)) {
    return handleAdminCommand(text, chatId, userId, bot, lang);
  }

  return false;
}

async function handleAdminCommand(text, chatId, userId, bot, lang = "english") {
  const lc = getLangCode(lang);
  const userList = getAllUsers();

  if (text.startsWith("/broadcast ")) {
    const bcText = text.slice(11).trim();
    if (!bcText) {
      try { await bot.sendMessage(chatId, t("admin.broadcast_usage", lc)); } catch (e) {}
      return true;
    }
    try {
      await bot.sendMessage(chatId, t("admin.broadcast_sending", lc, { count: userList.length }));
      let sent = 0;
      let failed = 0;
      for (const user of userList) {
        try {
          await bot.sendMessage(user.id, `📢 *Broadcast:*\n${bcText}`, { parse_mode: "Markdown" });
          sent++;
        } catch (err) {
          failed++;
          logger.warn(`Broadcast failed for user ${user.id}: ${err.message}`);
        }
        await new Promise((r) => setTimeout(r, 100));
      }
      await bot.sendMessage(chatId, t("admin.broadcast_done", lc, { sent, failed }));
      logger.info(`Admin broadcast: "${bcText}" -> sent ${sent}, failed ${failed}`);
    } catch (err) {
      logger.error(`/broadcast error: ${err.message}`);
    }
    return true;
  }

  if (text.startsWith("/getuser ")) {
    const query = text.slice(9).trim().toLowerCase();
    const target = findUser(query);
    if (!target) {
      try { await bot.sendMessage(chatId, t("admin.getuser_not_found", lc)); } catch (e) {}
      return true;
    }
    const reply =
      `👤 *User: ${target.id}*\n` +
      `📅 First seen: ${formatDate(target.firstSeen)}\n` +
      `📅 Last seen: ${formatDate(target.lastSeen)}\n` +
      `💬 Messages: ${target.messageCount}\n` +
      `🌐 Language: ${target.language || "unknown"}`;
    try { await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" }); } catch (err) {
      logger.error(`/getuser error: ${err.message}`);
    }
    return true;
  }

  if (text === "/statsall") {
    const globalStats = getGlobalStats();
    const title = t("admin.statsall_title", lc);
    const usersLine = `${t("admin.statsall_users", lc)}: ${globalStats.totalUsers}`;
    const msgsLine = `${t("admin.statsall_messages", lc)}: ${globalStats.totalMessages}`;
    const topLine = `${t("admin.statsall_top", lc)}`;
    const reply = `${title}\n${usersLine}\n${msgsLine}\n${topLine}\n${globalStats.topUsers.join("\n")}`;
    try {
      await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
      logger.info("Admin requested /statsall");
    } catch (err) {
      logger.error(`/statsall error: ${err.message}`);
    }
    return true;
  }

  return false;
}

function helpKeyboard(lang = "english") {
  const lc = getLangCode(lang);
  return {
    inline_keyboard: [
      [
        { text: `ℹ️ ${t("commands.help_about", lc)}`, callback_data: "help_about" },
        { text: `📊 ${t("commands.help_stats", lc)}`, callback_data: "help_stats" },
      ],
      [
        { text: `😂 ${t("commands.help_joke", lc)}`, callback_data: "help_joke" },
        { text: `🧹 ${t("commands.help_forget", lc)}`, callback_data: "help_forget" },
      ],
    ],
  };
}

function jokeKeyboard(page, totalJokes, lang = "english") {
  const lc = getLangCode(lang);
  const keyboard = { inline_keyboard: [[]] };
  if (page < totalJokes - 1) {
    keyboard.inline_keyboard[0].push({
      text: t("joke.next", lc),
      callback_data: `joke_${page + 1}`,
    });
  }
  if (page > 0) {
    keyboard.inline_keyboard[0].push({
      text: t("joke.prev", lc),
      callback_data: `joke_${page - 1}`,
    });
  }
  return keyboard;
}

module.exports = {
  handleCommand,
  helpKeyboard,
  jokeKeyboard,
  languageSwitchKeyboard,
  isAdmin,
};
