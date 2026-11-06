const logger = require("../utils/logger");
const { loadJSON, saveJSON } = require("../utils/dataStore");
const { BUSINESS_CONFIG_FILE, MODE_RULE_BASED, MODE_HYBRID, MODE_AI_ENHANCED } = require("../utils/constants");
const { isConnected } = require("../utils/db");
const BusinessConfig = require("../models/BusinessConfig");

const DEFAULT_CONFIG = {
  company: {
    name: "Aritii Tech",
    legalName: "Aritii Technologies PLC",
    tagline: "Engineering Digital Excellence",
    about: "Aritii Technologies PLC delivers elite software engineering tailored to your business goals. We transform complex ideas into high-performing, scalable software solutions.",
    email: "contact@ariititech.com",
    phone: "+251911000000",
    telegram: "@Y13bel",
    website: "https://ariiti.com",
    location: "Addis Ababa, Ethiopia",
    operatingHours: "Mon-Fri 8:30 AM - 5:30 PM EAT"
  },
  operatingMode: MODE_RULE_BASED,
  aiConfig: {
    provider: "gemini",
    model: "gemini-1.5-flash",
    enabled: false,
    temperature: 0.3,
    timeoutMs: 8000
  },
  leadScoring: {
    hasBudget: 30,
    hasTimeline: 20,
    verifiedContact: 25,
    detailedDescription: 25
  },
  notificationPreferences: {
    notifyAdminOnNewLead: true,
    notifyAdminOnQuote: true
  }
};

let configCache = null;

function getConfig() {
  if (!configCache) {
    configCache = loadJSON(BUSINESS_CONFIG_FILE, DEFAULT_CONFIG);
  }
  return configCache;
}

function saveConfig(newConfig) {
  configCache = newConfig;
  saveJSON(BUSINESS_CONFIG_FILE, configCache);
  logger.info("Business configuration successfully saved locally.");

  if (isConnected()) {
    BusinessConfig.findOneAndUpdate(
      { key: "ariiti_tech_config" },
      {
        $set: {
          company: configCache.company,
          operatingMode: configCache.operatingMode,
        },
      },
      { upsert: true, returnDocument: "after" }
    )
      .then(() => logger.info("Business config & contacts synced to MongoDB Atlas."))
      .catch((err) => logger.warn(`Failed to sync config to MongoDB: ${err.message}`));
  }

  return configCache;
}

async function updateCompanyProfile(updates) {
  const current = getConfig();
  current.company = { ...current.company, ...updates };
  saveConfig(current);

  if (isConnected()) {
    try {
      await BusinessConfig.findOneAndUpdate(
        { key: "ariiti_tech_config" },
        { $set: { company: current.company } },
        { upsert: true, returnDocument: "after" }
      );
      logger.info("Company profile updated directly in MongoDB Atlas.");
    } catch (err) {
      logger.warn(`Failed to update company profile in MongoDB: ${err.message}`);
    }
  }

  return current;
}

async function syncConfigWithDB() {
  if (!isConnected()) return;

  try {
    const doc = await BusinessConfig.findOne({ key: "ariiti_tech_config" });
    if (doc && doc.company) {
      const current = getConfig();
      current.company = { ...current.company, ...doc.company.toObject() };
      if (doc.operatingMode) current.operatingMode = doc.operatingMode;
      saveJSON(BUSINESS_CONFIG_FILE, current);
      configCache = current;
      logger.info("Loaded latest business contacts from MongoDB Atlas into memory.");
    } else {
      // Seed default config into MongoDB Atlas
      const current = getConfig();
      await BusinessConfig.findOneAndUpdate(
        { key: "ariiti_tech_config" },
        {
          $setOnInsert: {
            company: current.company,
            operatingMode: current.operatingMode,
          },
        },
        { upsert: true }
      );
      logger.info("Seeded initial business config to MongoDB Atlas.");
    }
  } catch (err) {
    logger.warn(`Failed to sync business config with DB: ${err.message}`);
  }
}

function getOperatingMode() {
  const current = getConfig();
  return current.operatingMode || MODE_RULE_BASED;
}

function setOperatingMode(mode) {
  const allowed = [MODE_RULE_BASED, MODE_HYBRID, MODE_AI_ENHANCED];
  if (!allowed.includes(mode)) {
    throw new Error(`Invalid operating mode: ${mode}. Allowed: ${allowed.join(", ")}`);
  }
  const current = getConfig();
  current.operatingMode = mode;
  if (current.aiConfig) {
    current.aiConfig.enabled = (mode !== MODE_RULE_BASED);
  }
  saveConfig(current);
  logger.info(`Operating mode set to: ${mode}`);
  return current;
}

function updateAIConfig(aiUpdates) {
  const current = getConfig();
  current.aiConfig = { ...current.aiConfig, ...aiUpdates };
  return saveConfig(current);
}

module.exports = {
  getConfig,
  saveConfig,
  updateCompanyProfile,
  syncConfigWithDB,
  getOperatingMode,
  setOperatingMode,
  updateAIConfig,
};
