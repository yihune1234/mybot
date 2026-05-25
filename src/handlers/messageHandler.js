const logger = require("../utils/logger");
const { randomPick, extractCity } = require("../utils/helpers");
const { getReplies } = require("../services/replyService");
const { classifyIntent, analyzeSentiment } = require("../services/nluService");
const { addMemory, getMemoryString } = require("../services/memoryService");
const { getWeather, formatWeather } = require("../services/weatherService");
const { trackUser } = require("../services/userService");
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

  const handled = await handleCommand(text, chatId, userId, bot, userList);
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
      const encouragement = randomPick(replies.encouragementReplies);
      if (intent === "greeting") {
        const reply = randomPick(replies.hiReplies);
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
      replyText = randomPick(replies.hiReplies);
      break;

    case "goodbye":
      replyText = randomPick(replies.triggerReplies?.bye || replies.fallbackReplies);
      break;

    case "thanks":
      replyText = randomPick(replies.triggerReplies?.thanks || ["You're welcome!"]);
      break;

    case "joke":
      replyText = handleJokeIntent(chatId, userId, bot, replies);
      if (replyText && replyText._sent) return;
      break;

    case "weather":
      replyText = await handleWeatherIntent(text, replies);
      break;

    case "identity":
      replyText = randomPick(replies.identityReplies);
      break;

    case "time":
      replyText = `🕐 The current time is ${new Date().toLocaleTimeString()}.`;
      break;

    case "help":
      replyText =
        "I can chat, tell jokes, check weather, set reminders, and more! Try /help to see the menu.";
      break;

    case "smalltalk":
    case "unknown":
    default:
      replyText = handleFallbackIntent(lower, userId, replies);
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

function handleJokeIntent(chatId, userId, bot, replies) {
  const jokes =
    replies.triggerReplies?.["tell me a joke"] || replies.triggerReplies?.joke || [];
  if (jokes.length > 0) {
    const jokeText = jokes[0];
    if (jokes.length > 1) {
      bot.sendMessage(chatId, jokeText, {
        reply_markup: {
          inline_keyboard: [
            [{ text: "Next →", callback_data: "joke_1" }],
          ],
        },
      });
      addMemory(userId, "bot", jokeText);
      logger.info(`🤖 Told joke to ${userId}`);
      return { _sent: true };
    }
    return jokeText;
  }
  return "I don't know any jokes right now!";
}

async function handleWeatherIntent(text, replies) {
  const city = extractCity(text);
  if (city) {
    try {
      const weather = await getWeather(city);
      if (weather) return formatWeather(weather);
    } catch (err) {
      // fall through
    }
    return randomPick(replies.weatherFailReplies);
  }
  return "Which city would you like the weather for? Try /weather <city>!";
}

function handleFallbackIntent(lower, userId, replies) {
  const sortedKeys = Object.keys(replies.triggerReplies).sort(
    (a, b) => b.length - a.length
  );
  for (const key of sortedKeys) {
    if (lower.includes(key)) {
      return randomPick(replies.triggerReplies[key]);
    }
  }

  const memStr = getMemoryString(userId);
  if (
    memStr &&
    /\b(what did i|what did we|did i say|did i tell|repeat|what were we)\b/.test(lower)
  ) {
    return `Here's what I remember:\n${memStr}`;
  }

  return randomPick(replies.fallbackReplies);
}

module.exports = { handleMessage };
