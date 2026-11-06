const { randomPick } = require("../utils/helpers");
const { REPLIES_FILE } = require("../utils/constants");

let replies;
const lastPickedIndices = new Map();

function ensureRepliesLoaded() {
  if (!replies) {
    loadReplies(REPLIES_FILE);
  }
}

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
      fallbackReplies: { english: ["That's interesting! Let me know what you'd like to explore."], oromo: ["Dinqisiisaa! Maal ilaaluu akka feetan natti himaa."] },
      weatherFailReplies: { english: ["Couldn't fetch weather."], oromo: ["Haala qilleensaa argachuu hin dandeenye."] },
    };
  }
}

function getReplies() {
  ensureRepliesLoaded();
  return replies;
}

function getLocalizedReplies(category, lang = "english") {
  ensureRepliesLoaded();
  if (!replies) return null;
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
  ensureRepliesLoaded();
  if (!replies) return null;
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

/**
 * Picks a reply variation dynamically while avoiding repeating the exact same variation consecutively.
 */
function pickDynamicVariation(list, cacheKey) {
  if (!list || list.length === 0) return null;
  if (list.length === 1) return list[0];

  const lastIdx = lastPickedIndices.has(cacheKey) ? lastPickedIndices.get(cacheKey) : -1;
  let newIdx;
  let attempts = 0;
  do {
    newIdx = Math.floor(Math.random() * list.length);
    attempts++;
  } while (newIdx === lastIdx && attempts < 5);

  lastPickedIndices.set(cacheKey, newIdx);
  return list[newIdx];
}

function pickLocalizedReply(category, lang = "english") {
  const localized = getLocalizedReplies(category, lang);
  const cacheKey = `${category}_${lang}`;
  if (localized && localized.length > 0) return pickDynamicVariation(localized, cacheKey);

  const english = getLocalizedReplies(category, "english");
  if (english && english.length > 0) return pickDynamicVariation(english, `${category}_en`);

  return null;
}

function pickLocalizedTriggerReply(key, lang = "english") {
  const localized = getLocalizedTriggerReply(key, lang);
  const cacheKey = `trigger_${key}_${lang}`;
  if (localized && localized.length > 0) return pickDynamicVariation(localized, cacheKey);

  const english = getLocalizedTriggerReply(key, "english");
  if (english && english.length > 0) return pickDynamicVariation(english, `trigger_${key}_en`);

  return null;
}

function getDisambiguationPrompt(topicName, lang = "english") {
  const template = pickLocalizedReply("disambiguationReplies", lang) ||
    "It sounds like you're interested in {{topic}}! Would you like to explore that or request a quote?";
  return template.replace(/\{\{topic\}\}/g, topicName);
}

function reloadReplies(filePath) {
  delete require.cache[require.resolve(filePath)];
  loadReplies(filePath);
  lastPickedIndices.clear();
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
  getDisambiguationPrompt,
  reloadReplies,
  getAllJokes,
};
