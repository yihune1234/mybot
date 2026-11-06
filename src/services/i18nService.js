const path = require("path");
const logger = require("../utils/logger");

const translations = {};
let loaded = false;

function loadTranslations() {
  const i18nDir = path.resolve(__dirname, "..", "i18n");
  try {
    translations.en = require(path.join(i18nDir, "en.json"));
    translations.om = require(path.join(i18nDir, "om.json"));
    loaded = true;
    logger.info(`🌐 i18n loaded: English (${Object.keys(translations.en).length} sections), Afaan Oromoo (${Object.keys(translations.om).length} sections)`);
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
  if (lang === "oromo" || lang === "om") return "om";
  return "en";
}

function isTranslationLoaded() {
  return loaded;
}

module.exports = { loadTranslations, t, getLangCode, isTranslationLoaded };
