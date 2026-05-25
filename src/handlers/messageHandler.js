const logger = require("../utils/logger");
const { randomPick, extractCity } = require("../utils/helpers");
const { getReplies, pickLocalizedReply, pickLocalizedTriggerReply, getAllJokes } = require("../services/replyService");
const { classifyIntent, analyzeSentiment } = require("../services/nluService");
const { addMemory, getMemoryString } = require("../services/memoryService");
const { getWeather, formatWeather } = require("../services/weatherService");
const { trackUser, setUserLanguage, getUserLanguage } = require("../services/userService");
const { detectLanguage } = require("../services/languageService");
const { handleCommand } = require("./commandHandler");
const { SENTIMENT_ENCOURAGE_THRESHOLD, SENTIMENT_LOG_THRESHOLD, PERSONALIZE_CHANCE } = require("../utils/constants");

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

  const lang = detectLanguage(text);
  setUserLanguage(userId, lang);
  logger.info(`🌐 Lang: ${lang} for user ${userId}`);

  const handled = await handleCommand(text, chatId, userId, bot, userList, lang);
  if (handled) return;

  const replies = getReplies();
  const lower = text.toLowerCase();
  const intent = classifyIntent(text);
  const sentiment = analyzeSentiment(text);

  if (sentiment.comparative < SENTIMENT_LOG_THRESHOLD) {
    logger.info(
      `😟 Negative sentiment from user ${userId} (score: ${sentiment.comparative})`
    );
  }

  if (sentiment.comparative < SENTIMENT_ENCOURAGE_THRESHOLD) {
    try {
      const encouragement = pickLocalizedReply("encouragementReplies", lang);
      if (intent === "greeting") {
        const reply = pickLocalizedReply("hiReplies", lang);
        await bot.sendMessage(chatId, reply + " " + encouragement);
        addMemory(userId, "bot", reply + " " + encouragement);
      } else {
        await bot.sendMessage(chatId, encouragement);
        addMemory(userId, "bot", encouragement);
      }
      logger.info(
        `🤖 Encouraged user ${userId} (sentiment: ${sentiment.comparative})`
      );
    } catch (err) {
      logger.error(`Encouragement error: ${err.message}`);
    }
    return;
  }

  const personalize = firstName !== "there" && Math.random() < PERSONALIZE_CHANCE;

  let replyText = null;

  switch (intent) {
    case "greeting":
      replyText = pickLocalizedReply("hiReplies", lang);
      break;

    case "goodbye":
      replyText = pickLocalizedTriggerReply("bye", lang) || pickLocalizedReply("fallbackReplies", lang);
      break;

    case "thanks":
      replyText = pickLocalizedTriggerReply("thanks", lang) || "You're welcome!";
      break;

    case "joke":
      replyText = handleJokeIntent(chatId, userId, bot, replies, lang);
      if (replyText && replyText._sent) return;
      break;

    case "weather":
      replyText = await handleWeatherIntent(text, replies, lang);
      break;

    case "identity":
      replyText = pickLocalizedReply("identityReplies", lang);
      break;

    case "time":
      replyText = lang === "oromo"
        ? `🕐 Sa'aatii ammaa ${new Date().toLocaleTimeString()} dha.`
        : `🕐 The current time is ${new Date().toLocaleTimeString()}.`;
      break;

    case "help":
      replyText = lang === "oromo"
        ? "Ani hasaasa, kolfa, haala qilleensaa, fi yaadachiisaa nan danda'a! /help naaf himi."
        : "I can chat, tell jokes, check weather, set reminders, and more! Try /help to see the menu.";
      break;

    case "smalltalk":
    case "unknown":
    default:
      replyText = handleFallbackIntent(lower, userId, replies, lang);
      break;
  }

  if (replyText && !replyText._sent) {
    const finalReply = personalize
      ? `${firstName}, ${replyText[0].toLowerCase() + replyText.slice(1)}`
      : replyText;
    try {
      await bot.sendMessage(chatId, finalReply, { parse_mode: "Markdown" });
      addMemory(userId, "bot", finalReply);
      logger.info(
        `🤖 Replied to ${userId}: "${finalReply.substring(0, 60)}..."`
      );
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
          inline_keyboard: [
            [{ text: lang === "oromo" ? "Kan itti aanu →" : "Next →", callback_data: "joke_1" }],
          ],
        },
      });
      addMemory(userId, "bot", jokeText);
      logger.info(`🤖 Told joke to ${userId}`);
      return { _sent: true };
    }
    return jokeText;
  }
  return lang === "oromo" ? "Waan kolfaa amma hin beeku!" : "I don't know any jokes right now!";
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
  return lang === "oromo"
    ? "Magaalaa kam haala qilleensaa isaa barbaadda? /weather <city> yaali!"
    : "Which city would you like the weather for? Try /weather <city>!";
}

function handleFallbackIntent(lower, userId, replies, lang) {
  const sortedKeys = Object.keys(replies.triggerReplies).sort(
    (a, b) => b.length - a.length
  );
  for (const key of sortedKeys) {
    if (lower.includes(key)) {
      return pickLocalizedTriggerReply(key, lang) || randomPick(replies.fallbackReplies?.english || []);
    }
  }

  const memStr = getMemoryString(userId);
  if (
    memStr &&
    /\b(what did i|what did we|did i say|did i tell|repeat|what were we)\b/.test(lower)
  ) {
    return `Here's what I remember:\n${memStr}`;
  }

  return pickLocalizedReply("fallbackReplies", lang);
}

module.exports = { handleMessage };
