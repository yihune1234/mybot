const { randomPick } = require("../utils/helpers");

let replies;

function loadReplies(filePath) {
  try {
    replies = require(filePath);
  } catch (err) {
    console.error("Failed to load replies.json. Using fallback defaults.");
    replies = {
      hiReplies: { english: ["Hey! How are you doing?"], oromo: ["Akkam! Nagaa jirtuu?"] },
      triggerReplies: {},
      identityReplies: { english: ["I'm a friendly bot!"], oromo: ["Botii nama fakkaatu dha!"] },
      aboutReplies: { english: ["A Telegram bot."], oromo: ["Botii Telegram."] },
      encouragementReplies: { english: ["Things will get better!"], oromo: ["Wanni waan gaarii dhufa!"] },
      fallbackReplies: { english: ["That's interesting!"], oromo: ["Dinqisiisaa!"] },
      weatherFailReplies: { english: ["Couldn't fetch weather."], oromo: ["Haala qilleensaa argachuu hin dandeenye."] },
    };
  }
}

function getReplies() {
  return replies;
}

function getLocalizedReplies(category, lang = "english") {
  const data = replies[category];
  if (!data) return null;

  if (typeof data === "object" && !Array.isArray(data)) {
    return data[lang] || data["english"] || null;
  }

  if (Array.isArray(data)) {
    return data;
  }

  return null;
}

function getLocalizedTriggerReply(key, lang = "english") {
  const trigger = replies.triggerReplies?.[key];
  if (!trigger) return null;

  if (typeof trigger === "object" && !Array.isArray(trigger)) {
    return trigger[lang] || trigger["english"] || null;
  }

  if (Array.isArray(trigger)) {
    return trigger;
  }

  return null;
}

function pickLocalizedReply(category, lang = "english") {
  const localized = getLocalizedReplies(category, lang);
  if (localized && localized.length > 0) return randomPick(localized);

  const english = getLocalizedReplies(category, "english");
  if (english && english.length > 0) return randomPick(english);

  return null;
}

function pickLocalizedTriggerReply(key, lang = "english") {
  const localized = getLocalizedTriggerReply(key, lang);
  if (localized && localized.length > 0) return randomPick(localized);

  const english = getLocalizedTriggerReply(key, "english");
  if (english && english.length > 0) return randomPick(english);

  return null;
}

function reloadReplies(filePath) {
  delete require.cache[require.resolve(filePath)];
  loadReplies(filePath);
  return replies;
}

function getAllJokes(lang = "english") {
  const jokeReplies = getLocalizedTriggerReply("tell me a joke", lang) || getLocalizedTriggerReply("joke", lang);
  return jokeReplies || [];
}

module.exports = {
  loadReplies,
  getReplies,
  getLocalizedReplies,
  getLocalizedTriggerReply,
  pickLocalizedReply,
  pickLocalizedTriggerReply,
  reloadReplies,
  getAllJokes,
};
