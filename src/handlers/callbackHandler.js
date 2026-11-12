const logger = require("../utils/logger");
const { formatDate } = require("../utils/helpers");
const { getAllJokes } = require("../services/replyService");
const { getUserStats, getUserLanguage, setUserLanguage } = require("../services/userService");
const {
  clearMemory,
  getContext,
  setUserState,
  clearUserState,
  setSelectedService,
} = require("../services/memoryService");
const { t, getLangCode } = require("../services/i18nService");
const { jokeKeyboard } = require("./commandHandler");
const { trackLanguageSelection, trackBotReply } = require("../services/eventTracker");
const { isAdmin } = require("../services/rbacService");
const {
  getServiceById,
  getActiveServices,
} = require("../services/serviceCatalogService");
const {
  getProductById,
  getActiveProducts,
} = require("../services/productCatalogService");
const {
  STATE_QUOTE_SERVICE,
  STATE_QUOTE_DESC,
} = require("../utils/constants");
const {
  getWelcomeText,
  getMainMenuKeyboard,
  getServicesText,
  getServicesKeyboard,
  getProductsText,
  getProductsKeyboard,
  getPortfolioText,
  getPortfolioKeyboard,
  getAboutText,
  getAboutKeyboard,
  getContactText,
  getContactKeyboard,
  getChannelsText,
  getChannelsKeyboard,
  getLanguagesKeyboard,
  getQuoteWizardStep1Text,
  getQuoteWizardKeyboard,
  safeEditOrSend,
} = require("../utils/uiComponents");

async function handleCallback(callbackQuery, bot) {
  if (!callbackQuery || !callbackQuery.from) {
    logger.error(`Invalid callback query: ${JSON.stringify(callbackQuery)}`);
    return;
  }

  const msg = callbackQuery.message;
  if (!msg) {
    logger.error(`Callback ${callbackQuery.id} has no message`);
    try {
      await bot.answerCallbackQuery(callbackQuery.id, { text: "Something went wrong. Please try again." });
    } catch (_) {}
    return;
  }

  const chatId = msg.chat.id;
  const messageId = msg.message_id;
  const userId = callbackQuery.from.id;
  const userName = callbackQuery.from.first_name || "Valued Client";
  const data = callbackQuery.data || "";

  // 1. Admin Module Callbacks
  if (data.startsWith("admin_")) {
    const { handleAdminCallback } = require("./businessAdminHandler");
    const handled = await handleAdminCallback(data, callbackQuery, bot);
    if (handled) return;
  }

  await bot.answerCallbackQuery(callbackQuery.id);

  // 2. Language Selection Callbacks (Onboarding)
  if (data === "lang_en" || data === "lang_om" || data === "lang_am") {
    let selectedLang = "english";
    if (data === "lang_om") selectedLang = "oromo";
    if (data === "lang_am") selectedLang = "amharic";

    setUserLanguage(userId, selectedLang);
    trackLanguageSelection(userId, userName, selectedLang);

    const welcomeMsg = getWelcomeText(selectedLang, userName);
    const keyboard = getMainMenuKeyboard(selectedLang, isAdmin(userId));
    await safeEditOrSend(bot, chatId, messageId, welcomeMsg, keyboard);
    trackBotReply(userId, userName, data, "Welcome Screen");
    return;
  }

  const userLang = getUserLanguage(userId) || "english";
  const lang = (userLang === "oromo" || userLang === "om") ? "oromo" : (userLang === "amharic" || userLang === "am") ? "amharic" : "english";
  const isOr = lang === "oromo";
  const isAm = lang === "amharic";

  // 3. Main Menu
  if (data === "main_menu") {
    const welcomeMsg = getWelcomeText(lang, userName);
    const keyboard = getMainMenuKeyboard(lang, isAdmin(userId));
    await safeEditOrSend(bot, chatId, messageId, welcomeMsg, keyboard);
    return;
  }

  // 4. Services Menu & Categories
  if (data === "view_services" || data === "disambig_yes_services") {
    const text = getServicesText(lang);
    const keyboard = getServicesKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  const catMap = {
    srv_cat_software: "Software Development",
    srv_cat_ecommerce: "E-commerce Solutions",
    srv_cat_automation: "Business Automation",
    srv_cat_innovation: "Digital Innovation",
  };
  if (catMap[data]) {
    const category = catMap[data];
    const text = getServicesText(lang, category);
    const keyboard = getServicesKeyboard(lang, category);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  if (data.startsWith("srv_view_")) {
    const serviceId = data.replace("srv_view_", "");
    const s = getServiceById(serviceId);
    if (!s) {
      await safeEditOrSend(bot, chatId, messageId, "Service not found.", getServicesKeyboard(lang));
      return;
    }

    let detail = `💻 *${s.name.toUpperCase()}*\n\n`;
    detail += `📁 *Category:* ${s.category}\n`;
    detail += `📝 *Overview:* ${s.description}\n\n`;
    if (s.features && s.features.length > 0) {
      detail += `✨ *Key Deliverables:*\n${s.features.map((f) => `• ${f}`).join("\n")}\n\n`;
    }
    detail += `💰 *Starting Price:* $${s.startingPrice} ${s.currency} (${s.pricingModel || "milestone"})\n`;
    detail += `⏱ *Estimated Timeline:* ~${s.estimatedDays || 14} business days\n\n`;
    detail += isOr
      ? `_Pirojektii kana mari'achuuf ykn ajajuuf qabduu armaan gadii tuqaa:_`
      : isAm
      ? `_ይህንን አገልግሎት ለመጠየቅ ከታች ያለውን ይጫኑ፦_`
      : `_Ready to bring this solution to life? Tap below to request a project quotation:_`;

    const kb = {
      inline_keyboard: [
        [
          { text: isOr ? "📝 Tajaajila Kana Ajaji" : isAm ? "📝 ይህን አገልግሎት እዘዝ" : "📝 Request This Service", callback_data: `quote_service_${s.id}` },
        ],
        [
          { text: isOr ? "⬅️ Tajaajiloota" : isAm ? "⬅️ አገልግሎቶች" : "⬅️ All Services", callback_data: "view_services" },
          { text: isOr ? "🏠 Fuula Duraa" : isAm ? "🏠 ዋና ማውጫ" : "🏠 Main Menu", callback_data: "main_menu" },
        ],
      ],
    };
    await safeEditOrSend(bot, chatId, messageId, detail, kb);
    return;
  }

  // 5. Products Menu
  if (data === "view_products") {
    const text = getProductsText(lang);
    const keyboard = getProductsKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  if (data.startsWith("prod_view_")) {
    const prodId = data.replace("prod_view_", "");
    const p = getProductById(prodId);
    if (!p) {
      await safeEditOrSend(bot, chatId, messageId, "Product not found.", getProductsKeyboard(lang));
      return;
    }

    let detail = `📦 *${p.name.toUpperCase()}*\n\n`;
    detail += `📁 *Category:* ${p.category}\n`;
    detail += `📝 *Description:* ${p.description}\n\n`;
    if (p.features && p.features.length > 0) {
      detail += `✨ *Highlights:*\n${p.features.map((f) => `• ${f}`).join("\n")}\n\n`;
    }
    detail += `🏷 *Pricing:* ${p.pricing}\n\n`;
    detail += isOr
      ? `_Oomisha kana bitachuuf ykn mari'achuuf qabduu armaan gadii fayyadamaa:_`
      : isAm
      ? `_ይህንን ምርት ለመግዛት ወይም ለማዘዝ ከታች ያለውን ይጫኑ፦_`
      : `_Select an action below to deploy this product for your operations:_`;

    const rows = [];
    if (p.demoUrl && /^https?:\/\//i.test(p.demoUrl)) {
      rows.push([{ text: "🌐 Live Demo / Overview", url: p.demoUrl }]);
    }
    rows.push([
      { text: isOr ? "📝 Oomisha Kana Ajaji" : isAm ? "📝 ይህን ምርት እዘዝ" : "📝 Order This Product", callback_data: `quote_service_${p.id}` },
    ]);
    rows.push([
      { text: isOr ? "⬅️ Oomishaalee" : isAm ? "⬅️ ምርቶች" : "⬅️ All Products", callback_data: "view_products" },
      { text: isOr ? "🏠 Fuula Duraa" : isAm ? "🏠 ዋና ማውጫ" : "🏠 Main Menu", callback_data: "main_menu" },
    ]);

    await safeEditOrSend(bot, chatId, messageId, detail, { inline_keyboard: rows });
    return;
  }

  // 6. Portfolio
  if (data === "view_portfolio" || data === "disambig_yes_portfolio") {
    const text = getPortfolioText(lang);
    const keyboard = getPortfolioKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  // 7. About Ariiti Tech
  if (data === "view_about") {
    const text = getAboutText(lang);
    const keyboard = getAboutKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  // 8. Contact Us
  if (data === "view_contact" || data === "disambig_yes_contact") {
    const text = getContactText(lang);
    const keyboard = getContactKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  // 9. Follow Our Channels
  if (data === "view_channels") {
    const text = getChannelsText(lang);
    const keyboard = getChannelsKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  // 10. Language Switch Menu
  if (data === "switch_lang") {
    const prompt = isOr
      ? "🌐 *Afaan filadhaa / Select your preferred language / እባክዎ ቋንቋ ይምረጡ:*"
      : isAm
      ? "🌐 *እባክዎ የሚመርጡትን ቋንቋ ይምረጡ / Select your preferred language / Afaan filadhaa:*"
      : "🌐 *Select your preferred language / Afaan filadhaa / እባክዎ ቋንቋ ይምረጡ:*";
    const keyboard = getLanguagesKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, prompt, keyboard);
    return;
  }

  if (data.startsWith("lang_switch_")) {
    const newLang = data.replace("lang_switch_", "");
    setUserLanguage(userId, newLang);
    trackLanguageSelection(userId, userName, newLang);

    const welcomeMsg = getWelcomeText(newLang, userName);
    const keyboard = getMainMenuKeyboard(newLang, isAdmin(userId));
    await safeEditOrSend(bot, chatId, messageId, welcomeMsg, keyboard);
    return;
  }

  // 11. Interactive Quote / Request a Service
  if (data === "start_quote" || data === "disambig_yes_quote") {
    setUserState(userId, STATE_QUOTE_SERVICE, {});
    const text = getQuoteWizardStep1Text(lang);
    const keyboard = getQuoteWizardKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  if (data.startsWith("quote_service_")) {
    const serviceKey = data.replace("quote_service_", "");
    const catalogItem = getServiceById(serviceKey);
    const productItem = getProductById(serviceKey);

    const categoryNames = {
      software: "Software Development",
      ecommerce: "E-commerce Solutions",
      automation: "Business Automation",
      innovation: "Digital Innovation",
      web: "Web Application Development",
      mobile: "Mobile App Development",
      bot: "Telegram Bot Development",
    };

    let chosenService = "Custom Software System";
    let estimate = null;
    let serviceId = null;

    if (catalogItem) {
      chosenService = catalogItem.name;
      estimate = catalogItem.startingPrice;
      serviceId = catalogItem.id;
    } else if (productItem) {
      chosenService = productItem.name;
      serviceId = productItem.id;
    } else if (categoryNames[serviceKey]) {
      chosenService = categoryNames[serviceKey];
    }

    setUserState(userId, STATE_QUOTE_DESC, {
      service: chosenService,
      serviceId: serviceId,
      quoteEstimate: estimate,
    });
    setSelectedService(userId, chosenService);

    const prompt = isOr
      ? `✅ Tajaajila Filatame: *${chosenService}*\n\n2️⃣ Maaloo galma fi qabiyyee ijoo pirojektii keessanii gabaabinaan naaf ibsaa:`
      : isAm
      ? `✅ የተመረጠ አገልግሎት፦ *${chosenService}*\n\n2️⃣ እባክዎ የፕሮጀክትዎን ዋና አላማ እና ባህሪያት በአጭሩ ይግለጹልን፦`
      : `✅ Selected Service: *${chosenService}*\n\n2️⃣ Please briefly describe your project goals, scope, and key features:`;

    const cancelKeyboard = {
      inline_keyboard: [
        [{ text: isOr ? "❌ Dhiisi (Cancel)" : isAm ? "❌ ሰርዝ (Cancel)" : "❌ Cancel Request", callback_data: "quote_cancel" }],
      ],
    };

    await safeEditOrSend(bot, chatId, messageId, prompt, cancelKeyboard);
    return;
  }

  if (data === "quote_cancel") {
    clearUserState(userId);
    const cancelMsg = isOr
      ? "❌ *Gaaffiin tajaajilaa haqameera.* Waan biraa maal si gargaaruu danda'a?"
      : isAm
      ? "❌ *የአገልግሎት ጥያቄው ተሰርዟል።* ሌላ በምን ልንረዳዎ እንችላለን?"
      : "❌ *Request canceled.* How else can Ariiti Tech assist your business today?";

    const keyboard = getMainMenuKeyboard(lang, isAdmin(userId));
    await safeEditOrSend(bot, chatId, messageId, cancelMsg, keyboard);
    return;
  }

  // 12. Verification Prompt
  if (data === "verify_media_prompt") {
    const { STATE_VERIFY_MEDIA } = require("../utils/constants");
    setUserState(userId, STATE_VERIFY_MEDIA, {});
    const prompt = isOr
      ? `🔍 *Mirkaneessa Miidiyaa AI (C2PA & SynthID)*\n\n` +
        `Maaloo suuraa ykn faayila mirkaneeffachuu barbaaddan asitti ergaa ykn forward godhaa.\n\n` +
        `• C2PA Content Credentials fi mallattoolee dijitaalaa ni qoranna\n` +
        `• Google SynthID watermark fi madda AI ni sakatta'a\n` +
        `• Qulqullina olaanaaf faayilicha akka *File / Document* tti ergaa.`
      : isAm
      ? `🔍 *የAI ሚዲያ ትክክለኛነት ማረጋገጫ (C2PA & SynthID)*\n\n` +
        `እባክዎ ምስል ወይም ፋይል ይላኩ፦\n\n` +
        `• የC2PA ዲጂታል ምስክርነቶችን ይመረምራል\n` +
        `• የGoogle SynthID ምልክት እና የAI አመጣጥን ይፈትሻል\n` +
        `• ለተሟላ ምርመራ ፋይሉን እንደ *Document / File* ይላኩ።`
      : `🔍 *AI Media Verification (C2PA & SynthID)*\n\n` +
        `Please send or forward an image or document file to inspect its provenance:\n\n` +
        `• Extracts C2PA Content Credentials & digital signatures\n` +
        `• Checks for Google SynthID imperceptible watermarks\n` +
        `• Detects generative AI tool signatures (DALL-E, Firefly, Midjourney)\n` +
        `• For maximum accuracy, send the uncompressed *File / Document*.`;

    const keyboard = {
      inline_keyboard: [
        [{ text: isOr ? "⬅️ Duubatti" : isAm ? "⬅️ ተመለስ" : "⬅️ Back to Main Menu", callback_data: "main_menu" }],
      ],
    };
    await safeEditOrSend(bot, chatId, messageId, prompt, keyboard);
    return;
  }

  // 13. Help & Utility Callbacks
  if (data === "help_stats") {
    const userStat = getUserStats(userId);
    if (!userStat) {
      await safeEditOrSend(bot, chatId, messageId, "No stats available yet.", getMainMenuKeyboard(lang, isAdmin(userId)));
      return;
    }
    const ctx = getContext(userId);
    const memoryCount = ctx ? ctx.messageCount : 0;
    const reply = isOr
      ? `📊 *Istaatistiksii Keessan*\n📅 Guyyaa jalqabaa: ${formatDate(userStat.firstSeen)}\n💬 Ergaawwan: ${userStat.messageCount}\n🌐 Afaan: ${userLang}\n🧠 Yaadannoo: ${memoryCount}`
      : isAm
      ? `📊 *የእርስዎ መረጃ*\n📅 የመጀመሪያ ቀን፦ ${formatDate(userStat.firstSeen)}\n💬 የተላኩ መልእክቶች፦ ${userStat.messageCount}\n🌐 ቋንቋ፦ ${userLang}\n🧠 ማህደረ ትውስታ፦ ${memoryCount}`
      : `📊 *Your Activity Stats*\n📅 First seen: ${formatDate(userStat.firstSeen)}\n💬 Messages sent: ${userStat.messageCount}\n🌐 Language: ${userLang}\n🧠 Session memory: ${memoryCount}`;

    const kb = {
      inline_keyboard: [
        [{ text: isOr ? "⬅️ Fuula Duraa" : isAm ? "⬅️ ወደ ዋና ማውጫ" : "⬅️ Back to Main Menu", callback_data: "main_menu" }],
      ],
    };
    await safeEditOrSend(bot, chatId, messageId, reply, kb);
    return;
  }

  if (data === "help_forget") {
    clearMemory(userId);
    clearUserState(userId);
    const msgText = isOr
      ? "🧹 *Yaadannoo qulqulleeffameera!*"
      : isAm
      ? "🧹 *ማህደረ ትውስታ ጸድቷል!*"
      : "🧹 *Session memory cleared successfully!*";
    await safeEditOrSend(bot, chatId, messageId, msgText, getMainMenuKeyboard(lang, isAdmin(userId)));
    return;
  }
}

module.exports = { handleCallback };
