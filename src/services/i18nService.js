const path = require("path");
const logger = require("../utils/logger");

const translations = {};
let loaded = false;

function loadTranslations() {
  const i18nDir = path.resolve(__dirname, "..", "i18n");
  try {
    translations.en = require(path.join(i18nDir, "en.json"));
    translations.om = require(path.join(i18nDir, "om.json"));
    try {
      translations.am = require(path.join(i18nDir, "am.json"));
    } catch (_) {
      translations.am = translations.en;
    }
    loaded = true;
    logger.info(`🌐 i18n loaded: English (${Object.keys(translations.en).length} sections), Afaan Oromoo (${Object.keys(translations.om).length} sections), Amharic (${Object.keys(translations.am).length} sections)`);
  } catch (err) {
    logger.error(`Failed to load i18n files: ${err.message}`);
    throw err;
  }
}

function t(key, lang = "en", params = {}) {
  if (!loaded) loadTranslations();

  const locale = translations[lang] || translations.en;
  const keys = key.split(".");
  let value = locale;

  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      value = translations.en;
      for (const k2 of keys) {
        if (value && typeof value === "object" && k2 in value) {
          value = value[k2];
        } else {
          return key;
        }
      }
      break;
    }
  }

  if (typeof value !== "string") return key;

  return value.replace(/\{\{(\w+)\}\}/g, (_, name) => {
    return params[name] !== undefined ? String(params[name]) : `{{${name}}}`;
  });
}

function getLangCode(lang) {
  if (!lang) return "en";
  const normalized = String(lang).toLowerCase();
  if (normalized === "oromo" || normalized === "om") return "om";
  if (normalized === "amharic" || normalized === "am") return "am";
  return "en";
}

function isTranslationLoaded() {
  return loaded;
}

module.exports = { loadTranslations, t, getLangCode, isTranslationLoaded };
