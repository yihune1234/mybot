const logger = require("../utils/logger");
const { randomPick, extractCity } = require("../utils/helpers");
const { getReplies, pickLocalizedReply, pickLocalizedTriggerReply, getAllJokes } = require("../services/replyService");
const { classifyIntent, analyzeSentiment } = require("../services/nluService");
const { addMemory, getMemoryString } = require("../services/memoryService");
const { getWeather, formatWeather } = require("../services/weatherService");
const { trackUser, setUserLanguage, getUserLanguage, hasSelectedLanguage } = require("../services/userService");
const { detectLanguage } = require("../services/languageService");
const { t, getLangCode } = require("../services/i18nService");
const { handleCommand } = require("./commandHandler");
const { handleAdminCommand } = require("./adminCommandHandler");
const { trackMessage, trackLanguageSelection, trackError, trackBotReply } = require("../services/eventTracker");
const { SENTIMENT_ENCOURAGE_THRESHOLD, SENTIMENT_LOG_THRESHOLD, PERSONALIZE_CHANCE } = require("../utils/constants");

function languageSelectionKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "English 🇺🇸", callback_data: "lang_en" },
        { text: "Afaan Oromoo 🇪🇹", callback_data: "lang_om" },
      ],
    ],
  };
}

async function handleMessage(msg, bot, userList) {
  if (msg.from && msg.from.is_bot) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const text = (msg.text || "").trim();
  const firstName = msg.from.first_name || "there";
  const username = msg.from.username || "no-username";

  trackUser(msg);
  logger.info(`📩 ${firstName} (@${username}): ${text}`);

  if (text) addMemory(userId, "user", text);
  if (!text) return;

  if (text.startsWith("/")) {
    const adminHandled = await handleAdminCommand(text, chatId, userId, bot);
    if (adminHandled) return;
  }

  if (!hasSelectedLanguage(userId)) {
    const userLang = detectLanguage(text);
    const engFirst = userLang === "english" || userLang === "unknown";
    const en = "Hello 👋 I am *Yihune B* — a software developer, system builder, and innovation-focused creator.\n\nYihune B builds intelligent, secure, scalable, and impactful digital systems for the future.\nSpecialties: AI, Cybersecurity, Digital Identity, Full-stack, Backend, Cloud.";
    const om = "Akkam jirtu 👋 Ani *Yihune B* ti — developer software, ijaarsa sirnaa, fi uumaa irratti xiyyeeffate.\n\nYihune B sirna ogeessa, nageenya qabu, babal'achuu danda'u, fi bu'aa qabu ijaara.\nKan xiyyeeffatu: AI, Cybersecurity, Digital Identity, Full-stack, Backend, Cloud.";
    const intro = engFirst ? en + "\n\n━━━━━━━━━━━━━━\n\n" + om : om + "\n\n━━━━━━━━━━━━━━\n\n" + en;
    const full = intro + "\n\n━━━━━━━━━━━━━━\n\n🌐 *Please select your language / Afaan kee filadhu:*";

    try {
      await bot.sendMessage(chatId, full, {
        parse_mode: "Markdown",
        reply_markup: languageSelectionKeyboard(),
      });
    } catch (err) {
      logger.error(`Language prompt error: ${err.message}`);
    }
    return;
  }

  const lang = getUserLanguage(userId) || "english";
  const lc = getLangCode(lang);
  const langForReplies = lang === "oromo" ? "oromo" : "english";

  trackMessage(msg, langForReplies);

  const handled = await handleCommand(text, chatId, userId, bot, userList, langForReplies);
  if (handled) return;

  const replies = getReplies();
  const lower = text.toLowerCase();
  const intent = classifyIntent(text);
  const sentiment = analyzeSentiment(text);

  if (sentiment.comparative < SENTIMENT_LOG_THRESHOLD) {
    logger.info(`😟 Negative sentiment from user ${userId} (score: ${sentiment.comparative})`);
  }

  if (sentiment.comparative < SENTIMENT_ENCOURAGE_THRESHOLD) {
    try {
      const encouragement = pickLocalizedReply("encouragementReplies", langForReplies);
      if (intent === "greeting") {
        const reply = pickLocalizedReply("hiReplies", langForReplies);
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

  const personalize = firstName !== "there" && Math.random() < PERSONALIZE_CHANCE;

  let replyText = null;

  switch (intent) {
    case "greeting":
      replyText = pickLocalizedReply("hiReplies", langForReplies);
      break;

    case "goodbye":
      replyText = pickLocalizedTriggerReply("bye", langForReplies) || pickLocalizedReply("fallbackReplies", langForReplies);
      break;

    case "thanks":
      replyText = pickLocalizedTriggerReply("thanks", langForReplies) || "You're welcome!";
      break;

    case "joke":
      replyText = handleJokeIntent(chatId, userId, bot, replies, langForReplies);
      if (replyText && replyText._sent) return;
      break;

    case "weather":
      replyText = await handleWeatherIntent(text, replies, langForReplies);
      break;

    case "identity":
      replyText = pickLocalizedReply("identityReplies", langForReplies);
      break;

    case "time":
      replyText = t("time.current", lc, { time: new Date().toLocaleTimeString() });
      break;

    case "help":
      replyText = t("help_response", lc);
      break;

    case "smalltalk":
    case "unknown":
    default:
      replyText = handleFallbackIntent(lower, userId, replies, langForReplies);
      break;
  }

  if (replyText && !replyText._sent) {
    const finalReply = personalize && langForReplies === "english"
      ? `${firstName}, ${replyText[0].toLowerCase() + replyText.slice(1)}`
      : replyText;
    try {
      await bot.sendMessage(chatId, finalReply, { parse_mode: "Markdown" });
      addMemory(userId, "bot", finalReply);
      trackBotReply(userId, firstName, text, finalReply);
      logger.info(`🤖 Replied to ${userId}: "${finalReply.substring(0, 60)}..."`);
    } catch (err) {
      logger.error(`Send reply error: ${err.message}`);
    }
  }
}

function handleJokeIntent(chatId, userId, bot, replies, lang) {
  const jokes = getAllJokes(lang);
  if (jokes.length > 0) {
    const jokeText = jokes[0];
    if (jokes.length > 1) {
      bot.sendMessage(chatId, jokeText, {
        reply_markup: {
          inline_keyboard: [[{ text: lang === "oromo" ? "Kan itti aanu →" : "Next →", callback_data: "joke_1" }]],
        },
      });
      addMemory(userId, "bot", jokeText);
      logger.info(`🤖 Told joke to ${userId}`);
      return { _sent: true };
    }
    return jokeText;
  }
  return t("joke.no_jokes", getLangCode(lang));
}

async function handleWeatherIntent(text, replies, lang) {
  const city = extractCity(text);
  if (city) {
    try {
      const weather = await getWeather(city);
      if (weather) return formatWeather(weather);
    } catch (err) {
      // fall through
    }
    return pickLocalizedReply("weatherFailReplies", lang);
  }
  return t("commands.weather_ask_city", getLangCode(lang));
}

function handleFallbackIntent(lower, userId, replies, lang) {
  const sortedKeys = Object.keys(replies.triggerReplies).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower.includes(key)) {
      return pickLocalizedTriggerReply(key, lang) || randomPick(replies.fallbackReplies?.english || []);
    }
  }

  const memStr = getMemoryString(userId);
  if (memStr && /\b(what did i|what did we|did i say|did i tell|repeat|what were we)\b/.test(lower)) {
    return `Here's what I remember:\n${memStr}`;
  }

  return pickLocalizedReply("fallbackReplies", lang);
}

module.exports = { handleMessage, languageSelectionKeyboard };
