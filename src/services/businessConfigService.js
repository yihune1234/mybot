const logger = require("../utils/logger");
const { loadJSON, saveJSON } = require("../utils/dataStore");
const { BUSINESS_CONFIG_FILE, MODE_RULE_BASED, MODE_HYBRID, MODE_AI_ENHANCED } = require("../utils/constants");
const { isConnected } = require("../utils/db");
const BusinessConfig = require("../models/BusinessConfig");

const DEFAULT_CONFIG = {
  company: {
    name: "Ariiti Tech",
    legalName: "Ariiti Technologies PLC",
    positioning: "Business Technology Partner & Digital Solutions Provider",
    brandMessage: "Building digital solutions for better businesses.",
    description: "Ariiti Tech provides software development, digital products, e-commerce solutions, and business automation systems to help businesses and individuals improve their operations through technology.",
    tagline: "Building digital solutions for better businesses.",
    about: "Ariiti Tech is a premier business technology partner and digital solutions provider. We deliver enterprise-grade software development, innovative digital products, robust e-commerce solutions, and high-impact business automation systems that empower modern enterprises.",
    aboutOr: "Ariiti Tech hiriyaa teeknoolojii daldalaa fi dhiheessaa furmaata dijitaalaati. Misoonsa software qulqullina olaanaa, oomishaalee dijitaalaa, e-commerce, fi sirnaalee automation daldalaa ammayyeessan ni dhiheessa.",
    aboutAm: "አሪቲ ቴክ (Ariiti Tech) አስተማማኝ የቢዝነስ ቴክኖሎጂ አጋር እና የዲጂታል መፍትሄዎች አቅራቢ ድርጅት ነው። ዘመናዊ የሶፍትዌር ልማት፣ የዲጂታል ምርቶች፣ የኢ-ኮሜርስ መድረኮች እና የቢዝነስ አውቶሜሽን ሲስተሞችን በማቅረብ ድርጅቶች በቴክኖሎጂ ስራቸውን እንዲያሳድጉ ይረዳል።",
    email: "contact@ariititech.com",
    phone: "+251987414282",
    telegram: "@AriitiTech",
    telegramContact: "@Yihun2bel",
    website: "https://ariiti.com",
    location: "Addis Ababa, Ethiopia",
    operatingHours: "Mon-Fri 8:30 AM - 5:30 PM EAT",
    branding: {
      primaryColor: "#093053",
      secondaryColor: "#FFFFFF"
    }
  },
  welcomeMessages: {
    english: "Welcome to *Ariiti Tech* — Your Business Technology Partner & Digital Solutions Provider.\n\n_Building digital solutions for better businesses._\n\nAriiti Tech provides software development, digital products, e-commerce solutions, and business automation systems to help businesses and individuals improve their operations through technology.\n\n💡 *How can we empower your business today?* Explore our interactive options below:",
    oromo: "Baga gara *Ariiti Tech* nagaan dhuftan — Hiriyaa Teeknoolojii Daldalaa fi Furmaata Dijitaalaa.\n\n_Daldala fooyya'aaf furmaata dijitaalaa ijaarra._\n\nAriiti Tech misoonsa software, oomishaalee dijitaalaa, e-commerce, fi sirnaalee automation daldalaa dhiheessuun hojii keessan ammayyeessa.\n\n💡 *Har'a maal keessatti isin gargaarru?* Qabduuwwan armaan gadii fayyadamaa:",
    amharic: "እንኳን ወደ *አሪቲ ቴክ (Ariiti Tech)* በደህና መጡ — የቢዝነስ ቴክኖሎጂ አጋርዎ እና የዲጂታል መፍትሄዎች አቅራቢ።\n\n_ለተሻለ ንግድ ዘመናዊ ዲጂታል መፍትሄዎችን መገንባት።_\n\nአሪቲ ቴክ የሶፍትዌር ልማት፣ የዲጂታል ምርቶች፣ የኢ-ኮሜርስ እና የቢዝነስ አውቶሜሽን ሲስተሞችን በማቅረብ ድርጅቶች ስራቸውን በቴክኖሎጂ እንዲያሳድጉ ይረዳል።\n\n💡 *ዛሬ በምን ልንረዳዎ እንችላለን?* ከታች ያሉትን አማራጮች ይጠቀሙ፦"
  },
  socialLinks: [
    { name: "LinkedIn", url: "https://www.linkedin.com/company/ariiti-tech", icon: "🔗" },
    { name: "GitHub", url: "https://github.com/yihune1234", icon: "💻" },
    { name: "Twitter / X", url: "https://twitter.com/AriitiTech", icon: "🐦" },
    { name: "Facebook", url: "https://facebook.com/AriitiTech", icon: "👥" }
  ],
  channelLinks: [
    { name: "Ariiti Tech Official Channel", url: "https://t.me/AriitiTech", icon: "📢" },
    { name: "Tech Updates & Releases", url: "https://t.me/AriitiTechUpdates", icon: "🚀" }
  ],
  menuVisibility: {
    services: true,
    products: true,
    portfolio: true,
    about: true,
    request_service: true,
    contact: true,
    channels: true,
    languages: true
  },
  menuOrder: [
    "services",
    "products",
    "portfolio",
    "about",
    "request_service",
    "contact",
    "channels",
    "languages"
  ],
  availableLanguages: [
    { code: "en", name: "English", emoji: "🇺🇸" },
    { code: "om", name: "Afaan Oromoo", emoji: "🇪🇹" },
    { code: "am", name: "አማርኛ (Amharic)", emoji: "🇪🇹" }
  ],
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

function getWelcomeMessage(lang = "english") {
  const cfg = getConfig();
  const msgs = cfg.welcomeMessages || DEFAULT_CONFIG.welcomeMessages;
  const normalized = (lang || "english").toLowerCase();
  if (normalized === "oromo" || normalized === "om") return msgs.oromo || msgs.english;
  if (normalized === "amharic" || normalized === "am") return msgs.amharic || msgs.english;
  return msgs.english || DEFAULT_CONFIG.welcomeMessages.english;
}

function updateWelcomeMessage(lang, text) {
  const current = getConfig();
  if (!current.welcomeMessages) current.welcomeMessages = { ...DEFAULT_CONFIG.welcomeMessages };
  const normalized = (lang || "english").toLowerCase();
  if (normalized.startsWith("or")) current.welcomeMessages.oromo = text;
  else if (normalized.startsWith("am")) current.welcomeMessages.amharic = text;
  else current.welcomeMessages.english = text;
  saveConfig(current);
  return current.welcomeMessages;
}

function getSocialLinks() {
  const cfg = getConfig();
  return cfg.socialLinks || DEFAULT_CONFIG.socialLinks;
}

function addSocialLink(name, url, icon = "🔗") {
  const current = getConfig();
  if (!current.socialLinks) current.socialLinks = [];
  current.socialLinks = current.socialLinks.filter((s) => s.name.toLowerCase() !== name.toLowerCase());
  current.socialLinks.push({ name, url, icon });
  saveConfig(current);
  return current.socialLinks;
}

function removeSocialLink(name) {
  const current = getConfig();
  if (!current.socialLinks) return [];
  current.socialLinks = current.socialLinks.filter((s) => s.name.toLowerCase() !== name.toLowerCase());
  saveConfig(current);
  return current.socialLinks;
}

function getChannelLinks() {
  const cfg = getConfig();
  return cfg.channelLinks || DEFAULT_CONFIG.channelLinks;
}

function addChannelLink(name, url, icon = "📢") {
  const current = getConfig();
  if (!current.channelLinks) current.channelLinks = [];
  current.channelLinks = current.channelLinks.filter((c) => c.name.toLowerCase() !== name.toLowerCase());
  current.channelLinks.push({ name, url, icon });
  saveConfig(current);
  return current.channelLinks;
}

function removeChannelLink(name) {
  const current = getConfig();
  if (!current.channelLinks) return [];
  current.channelLinks = current.channelLinks.filter((c) => c.name.toLowerCase() !== name.toLowerCase());
  saveConfig(current);
  return current.channelLinks;
}

function getMenuVisibility() {
  const cfg = getConfig();
  return cfg.menuVisibility || DEFAULT_CONFIG.menuVisibility;
}

function toggleMenuSection(sectionKey) {
  const current = getConfig();
  if (!current.menuVisibility) current.menuVisibility = { ...DEFAULT_CONFIG.menuVisibility };
  current.menuVisibility[sectionKey] = !current.menuVisibility[sectionKey];
  saveConfig(current);
  return current.menuVisibility[sectionKey];
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
  getWelcomeMessage,
  updateWelcomeMessage,
  getSocialLinks,
  addSocialLink,
  removeSocialLink,
  getChannelLinks,
  addChannelLink,
  removeChannelLink,
  getMenuVisibility,
  toggleMenuSection,
  syncConfigWithDB,
  getOperatingMode,
  setOperatingMode,
  updateAIConfig,
};
