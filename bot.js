/**
 
 * Features:
 *   1. Conversation Memory (context awareness)
 *   2. User Profiles & Stats
 *   3. Inline Keyboards & Buttons (/help)
 *   4. Custom Commands (/ping, /echo, /remind, /weather)
 *   5. NLU (intent classification + sentiment analysis)
 *   6. Admin Controls (/broadcast, /getuser, /statsall)
 *   7. Error Resilience & Logging (winston, graceful shutdown)
 *   8. Configuration File (replies.json)
 *
 * ── How to run ──
 *   1. npm install
 *   2. Create a .env file with:
 *        TELEGRAM_BOT_TOKEN=your_token_here
 *        ADMIN_CHAT_ID=your_telegram_id (optional, for admin commands)
 *        WEATHER_API_KEY=your_key (optional, defaults to wttr.in)
 *   3. node bot.js
 */

// ─── Dependencies ───────────────────────────────────────────────────────────
require("dotenv").config();
const TelegramBot = require("node-telegram-bot-api");
const fs = require("fs");
const path = require("path");
const axios = require("axios");
const natural = require("natural");
const Sentiment = require("sentiment");
const winston = require("winston");
require("winston-daily-rotate-file");

// ─── Token & Config ─────────────────────────────────────────────────────────
const TOKEN = process.env.TELEGRAM_BOT_TOKEN;
if (!TOKEN) {
  console.error(
    "❌ TELEGRAM_BOT_TOKEN is not set.\n" +
      "   Create a .env file with: TELEGRAM_BOT_TOKEN=your_token_here\n" +
      "   Or export it: export TELEGRAM_BOT_TOKEN=your_token_here"
  );
  process.exit(1);
}

const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID
  ? parseInt(process.env.ADMIN_CHAT_ID, 10)
  : null;
const WEATHER_API_KEY = process.env.WEATHER_API_KEY || null;

const bot = new TelegramBot(TOKEN, { polling: true });

// ─── Logger (Winston with daily rotation) ───────────────────────────────────
const logDir = path.join(__dirname, "logs");
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true });

const logger = winston.createLogger({
  level: "info",
  format: winston.format.combine(
    winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
    winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level.toUpperCase()}: ${message}`)
  ),
  transports: [
    new winston.transports.DailyRotateFile({
      filename: path.join(logDir, "bot-%DATE%.log"),
      datePattern: "YYYY-MM-DD",
      maxFiles: "14d",
      zippedArchive: true,
    }),
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.printf(({ timestamp, level, message }) => `[${timestamp}] ${level}: ${message}`)
      ),
    }),
  ],
});

logger.info("🤖 Bot starting up...");

// ─── Data File Paths ────────────────────────────────────────────────────────
const DATA_DIR = path.join(__dirname, "data");
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

const MEMORY_FILE = path.join(DATA_DIR, "memories.json");
const STATS_FILE = path.join(DATA_DIR, "stats.json");
const USER_LIST_FILE = path.join(DATA_DIR, "users.json");

// ─── Load Data Helpers ──────────────────────────────────────────────────────
function loadJSON(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (err) {
    logger.error(`Failed to load ${filePath}: ${err.message}`);
  }
  return defaultValue;
}

function saveJSON(filePath, data) {
  try {
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    logger.error(`Failed to save ${filePath}: ${err.message}`);
  }
}

// ─── In-Memory Stores ───────────────────────────────────────────────────────
// memories[userId] = [{ role, text, timestamp }, ...] (max 10)
let memories = loadJSON(MEMORY_FILE, {});
// stats[userId] = { firstSeen, lastSeen, messageCount, language? }
let stats = loadJSON(STATS_FILE, {});
// userList = [ { id, firstName, username } ] — all known users
let userList = loadJSON(USER_LIST_FILE, []);

// Reminders: { reminderId: { userId, chatId, text, timeout } }
let reminders = {};
let reminderCounter = 0;

// ─── Load Replies from replies.json ─────────────────────────────────────────
let replies;
try {
  replies = require("./replies.json");
} catch (err) {
  logger.error("Failed to load replies.json. Using fallback defaults.");
  replies = {
    hiReplies: ["Hey! How are you doing?", "Hi there!"],
    triggerReplies: {},
    identityReplies: ["I'm a friendly bot!"],
    aboutReplies: ["A Telegram bot that replies like a human."],
    encouragementReplies: ["Things will get better!"],
    fallbackReplies: ["That's interesting!", "I see!"],
    weatherFailReplies: ["Couldn't fetch weather data."],
  };
}

// ─── Helpers ────────────────────────────────────────────────────────────────
function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHTML(text) {
  return String(text).replace(/&/g, "&").replace(/</g, "<").replace(/>/g, ">");
}

function formatTime(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  return `${(ms / 1000).toFixed(2)}s`;
}

// ─── User Stats Tracking ────────────────────────────────────────────────────
function trackUser(msg) {
  const uid = msg.from.id;
  const now = new Date().toISOString();

  if (!stats[uid]) {
    stats[uid] = { firstSeen: now, lastSeen: now, messageCount: 0, language: msg.from.language_code || "unknown" };
    // Add to user list
    if (!userList.find((u) => u.id === uid)) {
      userList.push({ id: uid, firstName: msg.from.first_name || "", username: msg.from.username || "" });
    }
  } else {
    stats[uid].lastSeen = now;
    if (msg.from.language_code) stats[uid].language = msg.from.language_code;
  }
  stats[uid].messageCount++;
  saveJSON(STATS_FILE, stats);
  saveJSON(USER_LIST_FILE, userList);
}

// ─── Conversation Memory ────────────────────────────────────────────────────
function addMemory(userId, role, text) {
  if (!memories[userId]) memories[userId] = [];
  memories[userId].push({ role, text, timestamp: Date.now() });
  // Keep last 10 messages
  if (memories[userId].length > 10) memories[userId].shift();
  saveJSON(MEMORY_FILE, memories);
}

function getMemoryString(userId) {
  if (!memories[userId] || memories[userId].length === 0) return null;
  return memories[userId]
    .slice(-5)
    .map((m) => `${m.role === "user" ? "You" : "Bot"}: ${m.text}`)
    .join("\n");
}

function clearMemory(userId) {
  delete memories[userId];
  saveJSON(MEMORY_FILE, memories);
}

// ─── NLU: Intent Classification ─────────────────────────────────────────────
const tokenizer = new natural.WordTokenizer();
const TfIdf = natural.TfIdf;
let classifier = new natural.BayesClassifier();

// Train the classifier with example phrases for each intent
const trainingData = {
  greeting: [
    "hello", "hi", "hey", "good morning", "good evening", "howdy", "what's up",
    "sup", "yo", "greetings", "how are you", "how do you do", "nice to meet you",
    "akkam", "akkam?", "asham", "nagaa", "baga", "bultii", "attam", "attam?",
    "nagaa?", "nagaa gaafachuu", "bultii gaarii", "haa", "tole", "akkam nagaa?",
  ],
  goodbye: [
    "bye", "goodbye", "see you", "later", "catch you", "talk to you later",
    "good night", "night", "have a good day", "take care", "cya",
  ],
  thanks: [
    "thanks", "thank you", "ty", "thx", "appreciate it", "thank you so much",
    "thanks a lot", "grateful",
  ],
  joke: [
    "tell me a joke", "joke", "make me laugh", "funny", "tell me something funny",
    "crack a joke", "say something funny",
  ],
  weather: [
    "weather", "what is the weather", "how is the weather", "temperature",
    "is it raining", "forecast", "weather in",
  ],
  reminder: [
    "remind me", "set a reminder", "reminder", "don't forget", "remind",
    "set reminder",
  ],
  identity: [
    "who are you", "what is your name", "your name", "tell me about yourself",
    "about yourself", "what are you", "describe yourself", "introduce yourself",
  ],
  smalltalk: [
    "i like", "i love", "i hate", "what do you think", "how are you doing",
    "how old are you", "where are you from", "what are you doing",
    "what do you mean", "tell me more", "i think", "maybe", "really",
  ],
};

for (const [intent, phrases] of Object.entries(trainingData)) {
  for (const phrase of phrases) {
    classifier.addDocument(phrase, intent);
  }
}
classifier.train();

function classifyIntent(text) {
  const lower = text.toLowerCase().trim();
  const intent = classifier.classify(lower);
  const classifications = classifier.getClassifications(lower);
  // Only use classifier if confidence is > 0.3
  const top = classifications[0];
  if (top && top.value > 0.3) return intent;
  return "unknown";
}

// ─── Sentiment Analysis ─────────────────────────────────────────────────────
const sentimentAnalyzer = new Sentiment();
function analyzeSentiment(text) {
  const result = sentimentAnalyzer.analyze(text);
  return { score: result.score, comparative: result.comparative, negative: result.negative, positive: result.positive };
}

// ─── Weather Function ───────────────────────────────────────────────────────
async function getWeather(city) {
  try {
    if (WEATHER_API_KEY) {
      // OpenWeatherMap
      const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(city)}&units=metric&appid=${WEATHER_API_KEY}`;
      const resp = await axios.get(url, { timeout: 10000 });
      const d = resp.data;
      return {
        city: d.name,
        country: d.sys.country,
        temp: d.main.temp,
        feelsLike: d.main.feels_like,
        description: d.weather[0].description,
        humidity: d.main.humidity,
        wind: d.wind.speed,
        icon: d.weather[0].icon,
      };
    } else {
      // Free fallback: wttr.in
      const url = `https://wttr.in/${encodeURIComponent(city)}?format=j1`;
      const resp = await axios.get(url, { timeout: 10000 });
      const d = resp.data;
      const curr = d.current_condition[0];
      return {
        city: d.nearest_area[0].areaName[0].value,
        country: d.nearest_area[0].country[0].value,
        temp: parseFloat(curr.temp_C),
        feelsLike: parseFloat(curr.FeelsLikeC),
        description: curr.weatherDesc[0].value,
        humidity: parseInt(curr.humidity, 10),
        wind: parseFloat(curr.windspeedKmph),
        icon: null,
      };
    }
  } catch (err) {
    logger.error(`Weather API error for "${city}": ${err.message}`);
    return null;
  }
}

function formatWeather(w) {
  return (
    `🌤 *Weather in ${w.city}, ${w.country}*\n` +
    `🌡 Temperature: ${w.temp}°C (feels like ${w.feelsLike}°C)\n` +
    `☁ ${w.description}\n` +
    `💧 Humidity: ${w.humidity}%\n` +
    `💨 Wind: ${w.wind} km/h`
  );
}

// ─── Reminder Function ──────────────────────────────────────────────────────
function setReminder(userId, chatId, delayMs, text) {
  const id = ++reminderCounter;
  const timeout = setTimeout(async () => {
    try {
      await bot.sendMessage(chatId, `⏰ *Reminder!*\n${text}`, { parse_mode: "Markdown" });
      logger.info(`Reminder #${id} fired for user ${userId}: ${text}`);
    } catch (err) {
      logger.error(`Reminder #${id} send error: ${err.message}`);
    }
    delete reminders[id];
  }, delayMs);
  reminders[id] = { userId, chatId, text, timeout, createdAt: Date.now() };
  return id;
}

// ─── Admin: Broadcast to all users ──────────────────────────────────────────
async function broadcastMessage(senderId, text) {
  let sent = 0;
  let failed = 0;
  for (const user of userList) {
    try {
      await bot.sendMessage(user.id, `📢 *Broadcast:*\n${text}`, { parse_mode: "Markdown" });
      sent++;
    } catch (err) {
      failed++;
      logger.warn(`Broadcast failed for user ${user.id}: ${err.message}`);
    }
    // Small delay to avoid rate limits
    await new Promise((r) => setTimeout(r, 100));
  }
  return { sent, failed };
}

// ─── Inline Keyboard Builder ────────────────────────────────────────────────
function helpKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "ℹ️ About", callback_data: "help_about" },
        { text: "📊 Stats", callback_data: "help_stats" },
      ],
      [
        { text: "😂 Joke", callback_data: "help_joke" },
        { text: "🧹 Clear Memory", callback_data: "help_forget" },
      ],
    ],
  };
}

function jokeKeyboard(page, totalJokes) {
  const totalPages = Math.ceil(totalJokes / 1);
  const keyboard = { inline_keyboard: [[]] };
  if (page < totalPages - 1) {
    keyboard.inline_keyboard[0].push({ text: "Next →", callback_data: `joke_${page + 1}` });
  }
  if (page > 0) {
    keyboard.inline_keyboard[0].push({ text: "← Prev", callback_data: `joke_${page - 1}` });
  }
  return keyboard;
}

// Get all jokes from replies
function getAllJokes() {
  const jokes = replies.triggerReplies?.["tell me a joke"] || replies.triggerReplies?.joke || [];
  return jokes;
}

// ─── Graceful Shutdown ──────────────────────────────────────────────────────
function gracefulShutdown(signal) {
  logger.info(`Received ${signal}. Saving data and shutting down gracefully...`);
  // Clear all pending reminders
  for (const id of Object.keys(reminders)) {
    clearTimeout(reminders[id].timeout);
  }
  saveJSON(MEMORY_FILE, memories);
  saveJSON(STATS_FILE, stats);
  saveJSON(USER_LIST_FILE, userList);
  logger.info("All data saved. Goodbye!");
  process.exit(0);
}

process.on("SIGINT", () => gracefulShutdown("SIGINT"));
process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
process.on("unhandledRejection", (reason) => {
  logger.error(`Unhandled rejection: ${reason}`);
});

// ============================================================================
// ─── MESSAGE HANDLER ─────────────────────────────────────────────────────────
// ============================================================================

bot.on("message", async (msg) => {
  if (msg.from && msg.from.is_bot) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = (msg.text || "").trim();
  const firstName = msg.from.first_name || "there";
  const username = msg.from.username || "no-username";

  // Track user stats
  trackUser(msg);

  // Log incoming message
  logger.info(`📩 ${firstName} (@${username}): ${text}`);

  // Add to memory
  if (text) addMemory(userId, "user", text);

  // Ignore non-text messages
  if (!text) return;

  // ─── COMMAND HANDLING ──────────────────────────────────────────────────

  // /start
  if (text === "/start") {
    try {
      await bot.sendMessage(
        chatId,
        "Hi! This bot replies as me – just talk normally.\n\nUse /help to see what I can do!"
      );
      addMemory(userId, "bot", "Hi! This bot replies as me – just talk normally.");
    } catch (err) {
      logger.error(`/start error: ${err.message}`);
    }
    return;
  }

  // /reload - refresh replies.json and retrain classifier without restart
  if (text === "/reload") {
    // Only admin can reload to prevent abuse
    if (ADMIN_CHAT_ID && userId !== ADMIN_CHAT_ID) {
      try { await bot.sendMessage(chatId, "⛔ Only the admin can reload the config."); } catch (e) {}
      return;
    }
    try {
      delete require.cache[require.resolve("./replies.json")];
      replies = require("./replies.json");
      // Retrain classifier with potentially updated training data
      classifier = new natural.BayesClassifier();
      for (const [intent, phrases] of Object.entries(trainingData)) {
        for (const phrase of phrases) {
          classifier.addDocument(phrase, intent);
        }
      }
      classifier.train();
      try {
        await bot.sendMessage(chatId, "🔄 Replies reloaded and classifier retrained successfully!");
        logger.info(`🔄 Admin ${userId} reloaded config and retrained classifier.`);
      } catch (e) {}
    } catch (err) {
      logger.error(`/reload error: ${err.message}`);
      try { await bot.sendMessage(chatId, `❌ Reload failed: ${err.message}`); } catch (e) {}
    }
    return;
  }

  // /forget - clear user memory
  if (text === "/forget") {
    clearMemory(userId);
    try {
      await bot.sendMessage(chatId, "🧹 Memory cleared! I've forgotten our previous conversation.");
      logger.info(`🧹 User ${userId} cleared their memory.`);
    } catch (err) {
      logger.error(`/forget error: ${err.message}`);
    }
    return;
  }

  // /stats - user statistics
  if (text === "/stats") {
    const userStat = stats[userId];
    if (!userStat) {
      try { await bot.sendMessage(chatId, "No stats found for you yet. Send a message first!"); } catch (e) {}
      return;
    }
    const firstDate = new Date(userStat.firstSeen).toLocaleDateString();
    const msgCount = userStat.messageCount;
    const lang = userStat.language || "unknown";
    const memoryCount = memories[userId] ? memories[userId].length : 0;
    const reply =
      `📊 *Your Stats*\n` +
      `📅 First seen: ${firstDate}\n` +
      `💬 Messages sent: ${msgCount}\n` +
      `🌐 Language: ${lang}\n` +
      `🧠 Conversation memory: ${memoryCount}/10 messages`;
    try {
      await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error(`/stats error: ${err.message}`);
    }
    return;
  }

  // /ping
  if (text === "/ping") {
    const start = Date.now();
    try {
      const sentMsg = await bot.sendMessage(chatId, "Pong!");
      const elapsed = Date.now() - start;
      await bot.editMessageText(`Pong! 🏓\n⏱ Response time: ${elapsed}ms`, {
        chat_id: chatId,
        message_id: sentMsg.message_id,
      });
    } catch (err) {
      logger.error(`/ping error: ${err.message}`);
    }
    return;
  }

  // /echo <message>
  if (text.startsWith("/echo ")) {
    const echoText = text.slice(6).trim();
    if (!echoText) {
      try { await bot.sendMessage(chatId, "Usage: /echo <message>"); } catch (e) {}
      return;
    }
    try {
      await bot.sendMessage(chatId, `🔊 ${echoText}`);
    } catch (err) {
      logger.error(`/echo error: ${err.message}`);
    }
    return;
  }

  // /help - show inline keyboard
  if (text === "/help") {
    try {
      await bot.sendMessage(chatId, "🤖 *Help Menu*\nSelect an option below:", {
        parse_mode: "Markdown",
        reply_markup: helpKeyboard(),
      });
    } catch (err) {
      logger.error(`/help error: ${err.message}`);
    }
    return;
  }

  // /remind <time> <text>
  if (text.startsWith("/remind ")) {
    const parts = text.slice(8).trim().split(/ (.+)/);
    if (parts.length < 2 || !parts[0] || !parts[1]) {
      try {
        await bot.sendMessage(chatId, "Usage: /remind <time> <text>\nExamples:\n/remind 10s buy milk\n/remind 5min call mom\n/remind 1h take a break");
      } catch (e) {}
      return;
    }
    const timeStr = parts[0].trim();
    const remindText = parts[1].trim();
    const match = timeStr.match(/^(\d+)(s|sec|seconds?|m|min|minutes?|h|hr|hours?)$/i);
    if (!match) {
      try {
        await bot.sendMessage(chatId, "Invalid time format. Use e.g. 10s, 5min, 1h");
      } catch (e) {}
      return;
    }
    const amount = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();
    let ms = 0;
    if (unit.startsWith("s")) ms = amount * 1000;
    else if (unit.startsWith("m")) ms = amount * 60000;
    else if (unit.startsWith("h")) ms = amount * 3600000;

    if (ms > 24 * 3600000) {
      try { await bot.sendMessage(chatId, "Reminder max is 24 hours."); } catch (e) {}
      return;
    }

    const id = setReminder(userId, chatId, ms, remindText);
    try {
      await bot.sendMessage(chatId, `✅ Reminder set! I'll remind you in ${timeStr}.\n📝 "${remindText}"`);
      logger.info(`Reminder #${id} set for user ${userId} in ${timeStr}: "${remindText}"`);
    } catch (err) {
      logger.error(`/remind error: ${err.message}`);
    }
    return;
  }

  // /weather <city>
  if (text.startsWith("/weather ")) {
    const city = text.slice(9).trim();
    if (!city) {
      try { await bot.sendMessage(chatId, "Usage: /weather <city name>"); } catch (e) {}
      return;
    }
    try {
      const weather = await getWeather(city);
      if (!weather) {
        const failReply = randomPick(replies.weatherFailReplies || ["Couldn't fetch weather."]);
        await bot.sendMessage(chatId, failReply);
        return;
      }
      await bot.sendMessage(chatId, formatWeather(weather), { parse_mode: "Markdown" });
    } catch (err) {
      logger.error(`/weather error: ${err.message}`);
      try { await bot.sendMessage(chatId, "Sorry, weather service is unavailable right now."); } catch (e) {}
    }
    return;
  }

  // ─── ADMIN COMMANDS ────────────────────────────────────────────────────
  if (text.startsWith("/") && ADMIN_CHAT_ID && userId === ADMIN_CHAT_ID) {
    // /broadcast <message>
    if (text.startsWith("/broadcast ")) {
      const bcText = text.slice(11).trim();
      if (!bcText) {
        try { await bot.sendMessage(chatId, "Usage: /broadcast <message>"); } catch (e) {}
        return;
      }
      try {
        await bot.sendMessage(chatId, `📤 Broadcasting to ${userList.length} users...`);
        const result = await broadcastMessage(userId, bcText);
        await bot.sendMessage(chatId, `✅ Broadcast complete!\n✓ Sent: ${result.sent}\n✗ Failed: ${result.failed}`);
        logger.info(`Admin broadcast: "${bcText}" -> sent ${result.sent}, failed ${result.failed}`);
      } catch (err) {
        logger.error(`/broadcast error: ${err.message}`);
      }
      return;
    }

    // /getuser <username or id>
    if (text.startsWith("/getuser ")) {
      const query = text.slice(9).trim().toLowerCase();
      let target = null;
      // Try by id
      const idNum = parseInt(query, 10);
      if (!isNaN(idNum) && stats[idNum]) {
        target = { id: idNum, ...stats[idNum] };
      } else {
        // Try by username
        const userEntry = userList.find((u) => u.username && u.username.toLowerCase() === query);
        if (userEntry && stats[userEntry.id]) {
          target = { id: userEntry.id, ...stats[userEntry.id] };
        }
      }
      if (!target) {
        try { await bot.sendMessage(chatId, "User not found."); } catch (e) {}
        return;
      }
      const firstDate = new Date(target.firstSeen).toLocaleDateString();
      const lastDate = new Date(target.lastSeen).toLocaleDateString();
      const reply =
        `👤 *User: ${target.id}*\n` +
        `📅 First seen: ${firstDate}\n` +
        `📅 Last seen: ${lastDate}\n` +
        `💬 Messages: ${target.messageCount}\n` +
        `🌐 Language: ${target.language || "unknown"}`;
      try {
        await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
      } catch (err) {
        logger.error(`/getuser error: ${err.message}`);
      }
      return;
    }

    // /statsall
    if (text === "/statsall") {
      const totalUsers = userList.length;
      const totalMessages = Object.values(stats).reduce((sum, s) => sum + (s.messageCount || 0), 0);
      const topUsers = Object.entries(stats)
        .sort((a, b) => (b[1].messageCount || 0) - (a[1].messageCount || 0))
        .slice(0, 5)
        .map(([id, s]) => `  • ${id}: ${s.messageCount} msgs`);
      const reply =
        `📊 *Global Stats*\n` +
        `👥 Total users: ${totalUsers}\n` +
        `💬 Total messages: ${totalMessages}\n` +
        `🏆 *Top 5 users:*\n${topUsers.join("\n")}`;
      try {
        await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
        logger.info("Admin requested /statsall");
      } catch (err) {
        logger.error(`/statsall error: ${err.message}`);
      }
      return;
    }
  }

  // ─── Ignore all other commands ─────────────────────────────────────────
  if (text.startsWith("/")) return;

  // ─── REGULAR MESSAGE HANDLING ──────────────────────────────────────────

  const lower = text.toLowerCase();

  // Intent classification
  const intent = classifyIntent(text);
  const sentiment = analyzeSentiment(text);

  // Log sentiment
  if (sentiment.comparative < -0.3) {
    logger.info(`😟 Negative sentiment detected from user ${userId} (score: ${sentiment.comparative})`);
  }

  // 1. Handle negative sentiment with encouragement
  if (sentiment.comparative < -0.4) {
    try {
      const encouragement = randomPick(replies.encouragementReplies);
      // Still try to respond to intent first, but with encouragement
      if (intent === "greeting") {
        const reply = randomPick(replies.hiReplies);
        await bot.sendMessage(chatId, reply + " " + encouragement);
        addMemory(userId, "bot", reply + " " + encouragement);
      } else {
        await bot.sendMessage(chatId, encouragement);
        addMemory(userId, "bot", encouragement);
      }
      logger.info(`🤖 Encouraged user ${userId} (sentiment: ${sentiment.comparative})`);
    } catch (err) {
      logger.error(`Encouragement error: ${err.message}`);
    }
    return;
  }

  // Personalize: occasionally use the user's first name (roughly 20% chance)
  const personalize = firstName !== "there" && Math.random() < 0.2;

  // 2. Intent-based responses
  let replyText = null;

  switch (intent) {
    case "greeting": {
      replyText = randomPick(replies.hiReplies);
      break;
    }
    case "goodbye": {
      replyText = randomPick(replies.triggerReplies?.bye || replies.fallbackReplies);
      break;
    }
    case "thanks": {
      replyText = randomPick(replies.triggerReplies?.thanks || ["You're welcome!"]);
      break;
    }
    case "joke": {
      const jokes = getAllJokes();
      if (jokes.length > 0) {
        replyText = jokes[0];
        // Send with next button if more than 1 joke
        if (jokes.length > 1) {
          try {
            await bot.sendMessage(chatId, replyText, {
              reply_markup: { inline_keyboard: [[{ text: "Next →", callback_data: "joke_1" }]] },
            });
            addMemory(userId, "bot", replyText);
            logger.info(`🤖 Told joke to ${userId}`);
          } catch (err) {
            logger.error(`Joke reply error: ${err.message}`);
          }
          return;
        }
      } else {
        replyText = "I don't know any jokes right now!";
      }
      break;
    }
    case "weather": {
      // Extract city name from message
      const cityMatch = lower.match(/(?:in|for|at)\s+([a-z\s]+?)(?:\s*\?|\s*$)/i) || lower.match(/weather\s+([a-z\s]+?)(?:\s*\?|\s*$)/i);
      const city = cityMatch ? cityMatch[1].trim() : null;
      if (city) {
        try {
          const weather = await getWeather(city);
          if (weather) {
            replyText = formatWeather(weather);
          } else {
            replyText = randomPick(replies.weatherFailReplies);
          }
        } catch (err) {
          replyText = randomPick(replies.weatherFailReplies);
        }
      } else {
        replyText = "Which city would you like the weather for? Try /weather <city>!";
      }
      break;
    }
    case "identity": {
      replyText = randomPick(replies.identityReplies);
      break;
    }
    case "smalltalk": {
      // Check trigger-based replies first
      const sortedKeys = Object.keys(replies.triggerReplies).sort((a, b) => b.length - a.length);
      for (const key of sortedKeys) {
        if (lower.includes(key)) {
          replyText = randomPick(replies.triggerReplies[key]);
          break;
        }
      }
      // If no trigger matched, check for memory recall requests
      if (!replyText) {
        const memStr = getMemoryString(userId);
        if (memStr && /\b(what did i|what did we|did i say|did i tell|repeat|what were we)\b/.test(lower)) {
          replyText = `Here's what I remember:\n${memStr}`;
        } else {
          replyText = randomPick(replies.fallbackReplies);
        }
      }
      break;
    }
    default: {
      // Unknown intent - use trigger-based matching for backward compatibility
      const sortedKeys = Object.keys(replies.triggerReplies).sort((a, b) => b.length - a.length);
      for (const key of sortedKeys) {
        if (lower.includes(key)) {
          replyText = randomPick(replies.triggerReplies[key]);
          break;
        }
      }
      if (!replyText) {
        // Check memory for context-aware fallback
        const memStr = getMemoryString(userId);
        if (memStr && /\b(what did i|what did we|did i say|did i tell|repeat|what were we)\b/.test(lower)) {
          replyText = `Here's what I remember:\n${memStr}`;
        } else {
          replyText = randomPick(replies.fallbackReplies);
        }
      }
      break;
    }
  }

  if (replyText) {
    // Occasionally use the user's first name for a personal touch
    const finalReply = personalize ? `${firstName}, ${replyText[0].toLowerCase() + replyText.slice(1)}` : replyText;
    try {
      await bot.sendMessage(chatId, finalReply, { parse_mode: "Markdown" });
      addMemory(userId, "bot", finalReply);
      logger.info(`🤖 Replied to ${userId}: "${finalReply.substring(0, 60)}..."`);
    } catch (err) {
      logger.error(`Send reply error: ${err.message}`);
    }
  }
});

// ─── CALLBACK QUERY HANDLER (inline buttons) ────────────────────────────────
bot.on("callback_query", async (callbackQuery) => {
  const msg = callbackQuery.message;
  const chatId = msg.chat.id;
  const userId = callbackQuery.from.id;
  const data = callbackQuery.data;

  // Answer callback query to remove the loading state
  await bot.answerCallbackQuery(callbackQuery.id);

  // Track user
  trackUser(callbackQuery.from);

  if (data === "help_about") {
    const about = randomPick(replies.aboutReplies);
    try {
      await bot.sendMessage(chatId, about);
      addMemory(userId, "bot", about);
      logger.info(`🤖 Showed About to user ${userId}`);
    } catch (err) {
      logger.error(`Callback about error: ${err.message}`);
    }
  } else if (data === "help_stats") {
    const userStat = stats[userId];
    if (!userStat) {
      try { await bot.sendMessage(chatId, "No stats yet. Start chatting!"); } catch (e) {}
      return;
    }
    const firstDate = new Date(userStat.firstSeen).toLocaleDateString();
    const reply =
      `📊 *Your Stats*\n` +
      `📅 First seen: ${firstDate}\n` +
      `💬 Messages: ${userStat.messageCount}\n` +
      `🌐 Language: ${userStat.language || "unknown"}\n` +
      `🧠 Memory: ${memories[userId] ? memories[userId].length : 0}/10`;
    try {
      await bot.sendMessage(chatId, reply, { parse_mode: "Markdown" });
    } catch (err) {
      logger.error(`Callback stats error: ${err.message}`);
    }
  } else if (data === "help_joke") {
    const jokes = getAllJokes();
    const joke = jokes.length > 0 ? jokes[0] : "No jokes available!";
    try {
      await bot.sendMessage(chatId, joke, {
        reply_markup: jokes.length > 1 ? { inline_keyboard: [[{ text: "Next →", callback_data: "joke_1" }]] } : undefined,
      });
      addMemory(userId, "bot", joke);
    } catch (err) {
      logger.error(`Callback joke error: ${err.message}`);
    }
  } else if (data === "help_forget") {
    clearMemory(userId);
    try {
      await bot.sendMessage(chatId, "🧹 Memory cleared!");
      logger.info(`🧹 User ${userId} cleared memory via /help button.`);
    } catch (err) {
      logger.error(`Callback forget error: ${err.message}`);
    }
  } else if (data.startsWith("joke_")) {
    const page = parseInt(data.split("_")[1], 10);
    const jokes = getAllJokes();
    if (page < 0 || page >= jokes.length) {
      try { await bot.sendMessage(chatId, "No more jokes on this page."); } catch (e) {}
      return;
    }
    const joke = jokes[page];
    try {
      await bot.sendMessage(chatId, joke, { reply_markup: jokeKeyboard(page, jokes.length) });
      addMemory(userId, "bot", joke);
    } catch (err) {
      logger.error(`Joke page callback error: ${err.message}`);
    }
  }
});

// ─── POLLING ERROR HANDLER ──────────────────────────────────────────────────
bot.on("polling_error", (err) => {
  if (err.message && err.message.includes("409")) {
    logger.warn("409 Conflict – another bot instance is running. Killing duplicate...");
    // This is just a warning, the bot continues
  } else {
    logger.error(`Polling error: ${err.message}`);
  }
});

logger.info("🤖 Bot is now running and listening for messages...");
console.log("🤖 Bot started – listening for messages via long polling...");