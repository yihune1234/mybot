const logger = require("../utils/logger");
const { randomPick, formatDate } = require("../utils/helpers");
const { getReplies, pickLocalizedReply } = require("../services/replyService");
const { getWeather, formatWeather } = require("../services/weatherService");
const { setReminder } = require("../services/reminderService");
const { getUserStats, findUser, getGlobalStats, getAllUsers, getStats } = require("../services/userService");
const { getContext, clearMemory } = require("../services/memoryService");
const { retrainClassifier } = require("../services/nluService");
const { REMINDER_MAX_MS } = require("../utils/constants");

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID
  ? parseInt(process.env.ADMIN_CHAT_ID, 10)
  : null;

function isAdmin(userId) {
  return ADMIN_CHAT_ID && userId === ADMIN_CHAT_ID;
}

async function handleCommand(text, chatId, userId, bot, userList, lang = "english") {
  const replies = getReplies();

  if (text === "/start") {
    try {
      const msg = lang === "oromo"
        ? "Akkam! Botiin kun akka Yihune deebisa — akkuma barbaaddetti haasa'i.\n\n/help fayyadami waan nan danda'u argachuuf!"
        : "Hi! This bot replies as me – just talk normally.\n\nUse /help to see what I can do!";
      await bot.sendMessage(chatId, msg);
    } catch (err) {
      logger.error(`/start error: ${err.message}`);
    }
    return true;
  }

  if (text === "/reload") {
    if (!isAdmin(userId)) {
      const msg = lang === "oromo" ? "⛔ Admin qofatu config saqachuu danda'a." : "⛔ Only the admin can reload the config.";
      try { await bot.sendMessage(chatId, msg); } catch (e) {}
      return true;
    }
    try {
      const { reloadReplies } = require("../services/replyService");
      const { REPLIES_FILE } = require("../utils/constants");
      reloadReplies(REPLIES_FILE);
      retrainClassifier();
      const msg = lang === "oromo"
        ? "🔄 Replies fooyya'ee fi classifier baruumsa godhame!"
        : "🔄 Replies reloaded and classifier retrained successfully!";
      try { await bot.sendMessage(chatId, msg); } catch (e) {}
      logger.info(`🔄 Admin ${userId} reloaded config and retrained classifier.`);
    } catch (err) {
      logger.error(`/reload error: ${err.message}`);
      try { await bot.sendMessage(chatId, `❌ Reload failed: ${err.message}`); } catch (e) {}
    }
    return true;
  }

  if (text === "/forget") {
    clearMemory(userId);
    try {
      const msg = lang === "oromo"
        ? "🧹 Yaadannoo qulqulleffame! Haasa'aa duraa irraanfadheera."
        : "🧹 Memory cleared! I've forgotten our previous conversation.";
      await bot.sendMessage(chatId, msg);
      logger.info(`🧹 User ${userId} cleared their memory.`);
    } catch (err) {
      logger.error(`/forget error: ${err.message}`);
    }
    return true;
  }

  if (text === "/stats") {
    const userStat = getUserStats(userId);
    if (!userStat) {
      const msg = lang === "oromo"
        ? "Amma sirr waa hin jiru. Jalqaba ergaa ergi!"
        : "No stats found for you yet. Send a message first!";
      try { await bot.sendMessage(chatId, msg); } catch (e) {}
      return true;
    }
    const ctx = getContext(userId);
    const memoryCount = ctx ? ctx.messageCount : 0;
    const reply = lang === "oromo"
      ? `📊 *Itti Gaafii kee*\n📅 Yeroo dura: ${formatDate(userStat.firstSeen)}\n💬 Ergaa: ${userStat.messageCount}\n🌐 Afaan: ${userStat.language || "unknown"}\n🧠 Yaadannoo: ${memoryCount}`

      : `📊 *Your Stats*\n📅 First seen: ${formatDate(userStat.firstSeen)}\n💬 Messages sent: ${userStat.messageCount}\n🌐 Language: ${userStat.language || "unknown"}\n🧠 Conversation memory: ${memoryCount} messages`;
    try { await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" }); } catch (err) {
      logger.error(`/stats error: ${err.message}`);
    }
    return true;
  }

  if (text === "/ping") {
    const start = Date.now();
    try {
      const sentMsg = await bot.sendMessage(chatId, "Pong!");
      const elapsed = Date.now() - start;
      await bot.editMessageText(
        lang === "oromo" ? `Pong! 🏓\n⏱ Yeroo deebii: ${elapsed}ms` : `Pong! 🏓\n⏱ Response time: ${elapsed}ms`,
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
      try { await bot.sendMessage(chatId, "Usage: /echo <message>"); } catch (e) {}
      return true;
    }
    try { await bot.sendMessage(chatId, `🔊 ${echoText}`); } catch (err) {
      logger.error(`/echo error: ${err.message}`);
    }
    return true;
  }

  if (text === "/help") {
    try {
      const msg = lang === "oromo"
        ? "🤖 *Gargaarsa*\nFilannoo gadii irraa filadhu:"
        : "🤖 *Help Menu*\nSelect an option below:";
      await bot.sendMessage(chatId, msg, {
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
      const msg = lang === "oromo"
        ? "Fayyadama: /remind <yeroo> <ergaa>\nFakkeenya:\n/remind 10s aannan biti\n/remind 5min haadha bilbil"
        : "Usage: /remind <time> <text>\nExamples:\n/remind 10s buy milk\n/remind 5min call mom\n/remind 1h take a break";
      try { await bot.sendMessage(chatId, msg); } catch (e) {}
      return true;
    }
    const timeStr = parts[0].trim();
    const remindText = parts[1].trim();
    const match = timeStr.match(/^(\d+)(s|sec|seconds?|m|min|minutes?|h|hr|hours?)$/i);
    if (!match) {
      const msg = lang === "oromo"
        ? "Yeroo sirrii miti. Fayyadami: 10s, 5min, 1h"
        : "Invalid time format. Use e.g. 10s, 5min, 1h";
      try { await bot.sendMessage(chatId, msg); } catch (e) {}
      return true;
    }
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    let ms = 0;
    if (unit.startsWith("s")) ms = amount * 1000;
    else if (unit.startsWith("m")) ms = amount * 60000;
    else if (unit.startsWith("h")) ms = amount * 3600000;

    if (ms > REMINDER_MAX_MS) {
      const msg = lang === "oromo" ? "Yaadachiisaan sa'aatii 24 ol hin ta'u." : "Reminder max is 24 hours.";
      try { await bot.sendMessage(chatId, msg); } catch (e) {}
      return true;
    }

    const id = setReminder(userId, chatId, ms, remindText, bot);
    try {
      const msg = lang === "oromo"
        ? `✅ Yaadachiisaa qindaa'e! Sa'aatii ${timeStr} keessatti nan si yaadachiisa.\n📝 "${remindText}"`
        : `✅ Reminder set! I'll remind you in ${timeStr}.\n📝 "${remindText}"`;
      await bot.sendMessage(chatId, msg);
      logger.info(`Reminder #${id} set for user ${userId} in ${timeStr}: "${remindText}"`);
    } catch (err) {
      logger.error(`/remind error: ${err.message}`);
    }
    return true;
  }

  if (text.startsWith("/weather ")) {
    const city = text.slice(9).trim();
    if (!city) {
      const msg = lang === "oromo"
        ? "Fayyadama: /weather <maqaa magaalaa>"
        : "Usage: /weather <city name>";
      try { await bot.sendMessage(chatId, msg); } catch (e) {}
      return true;
    }
    try {
      const weather = await getWeather(city);
      if (!weather) {
        const failReply = pickLocalizedReply("weatherFailReplies", lang) || "Couldn't fetch weather.";
        await bot.sendMessage(chatId, failReply);
        return true;
      }
      await bot.sendMessage(chatId, formatWeather(weather), { parse_mode: "Markdown" });
    } catch (err) {
      logger.error(`/weather error: ${err.message}`);
      const msg = lang === "oromo"
        ? "Dhiifama, tajaajilli qilleensaa amma hin jiru."
        : "Sorry, weather service is unavailable right now.";
      try { await bot.sendMessage(chatId, msg); } catch (e) {}
    }
    return true;
  }

  if (text.startsWith("/") && isAdmin(userId)) {
    return handleAdminCommand(text, chatId, userId, bot, lang);
  }

  return false;
}

async function handleAdminCommand(text, chatId, userId, bot, lang = "english") {
  const replies = getReplies();
  const userList = getAllUsers();
  const stats = getStats();

  if (text.startsWith("/broadcast ")) {
    const bcText = text.slice(11).trim();
    if (!bcText) {
      try { await bot.sendMessage(chatId, "Usage: /broadcast <message>"); } catch (e) {}
      return true;
    }
    try {
      const sending = lang === "oromo"
        ? `📤 ${userList.length} fayyadamtootatti ergaa...`
        : `📤 Broadcasting to ${userList.length} users...`;
      await bot.sendMessage(chatId, sending);
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
      const done = lang === "oromo"
        ? `✅ Broadcast xumurame!\n✓ Ergame: ${sent}\n✗ Dadhabe: ${failed}`
        : `✅ Broadcast complete!\n✓ Sent: ${sent}\n✗ Failed: ${failed}`;
      await bot.sendMessage(chatId, done);
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
      try { await bot.sendMessage(chatId, "User not found."); } catch (e) {}
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
    const title = lang === "oromo"
      ? `📊 *Itti Gaafii Guutuu*\n👥 Fayyadamtoota: ${globalStats.totalUsers}\n💬 Ergaa: ${globalStats.totalMessages}\n🏆 *5 firooma:*\n`
      : `📊 *Global Stats*\n👥 Total users: ${globalStats.totalUsers}\n💬 Total messages: ${globalStats.totalMessages}\n🏆 *Top 5 users:*\n`;
    const reply = title + globalStats.topUsers.join("\n");
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
  return {
    inline_keyboard: [
      [
        { text: "ℹ️ " + (lang === "oromo" ? "Waa'ee" : "About"), callback_data: "help_about" },
        { text: "📊 " + (lang === "oromo" ? "Itti Gaafii" : "Stats"), callback_data: "help_stats" },
      ],
      [
        { text: "😂 " + (lang === "oromo" ? "Kolfa" : "Joke"), callback_data: "help_joke" },
        { text: "🧹 " + (lang === "oromo" ? "Yaadannoo Qulqulleessi" : "Clear Memory"), callback_data: "help_forget" },
      ],
    ],
  };
}

function jokeKeyboard(page, totalJokes, lang = "english") {
  const keyboard = { inline_keyboard: [[]] };
  if (page < totalJokes - 1) {
    keyboard.inline_keyboard[0].push({
      text: lang === "oromo" ? "Kan itti aanu →" : "Next →",
      callback_data: `joke_${page + 1}`,
    });
  }
  if (page > 0) {
    keyboard.inline_keyboard[0].push({
      text: "← " + (lang === "oromo" ? "Kan duraa" : "Prev"),
      callback_data: `joke_${page - 1}`,
    });
  }
  return keyboard;
}

module.exports = {
  handleCommand,
  helpKeyboard,
  jokeKeyboard,
  isAdmin,
};
