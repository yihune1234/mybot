const logger = require("../utils/logger");
const { formatDate } = require("../utils/helpers");
const { getAllJokes } = require("../services/replyService");
const { getUserStats, getUserLanguage, setUserLanguage, hasSelectedLanguage } = require("../services/userService");
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
  STATE_QUOTE_SERVICE,
  STATE_QUOTE_DESC,
} = require("../utils/constants");
const {
  getWelcomeText,
  getMainMenuKeyboard,
  getServicesText,
  getServicesKeyboard,
  getPortfolioText,
  getPortfolioKeyboard,
  getAboutText,
  getAboutKeyboard,
  getContactText,
  getContactKeyboard,
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
  if (data === "lang_en" || data === "lang_om") {
    const selectedLang = data === "lang_om" ? "oromo" : "english";
    setUserLanguage(userId, selectedLang);
    trackLanguageSelection(userId, userName, selectedLang);

    const welcomeMsg = getWelcomeText(selectedLang, userName);
    const keyboard = getMainMenuKeyboard(selectedLang, isAdmin(userId));
    await safeEditOrSend(bot, chatId, messageId, welcomeMsg, keyboard);
    trackBotReply(userId, userName, data, "Welcome Screen");
    return;
  }

  const userLang = getUserLanguage(userId) || "english";
  const lang = userLang === "oromo" ? "oromo" : "english";
  const lc = getLangCode(userLang);

  // 3. Navigation & Main Menu Callbacks
  if (data === "main_menu") {
    const welcomeMsg = getWelcomeText(lang, userName);
    const keyboard = getMainMenuKeyboard(lang, isAdmin(userId));
    await safeEditOrSend(bot, chatId, messageId, welcomeMsg, keyboard);
    return;
  }

  if (data === "view_services" || data === "disambig_yes_services") {
    const text = getServicesText(lang);
    const keyboard = getServicesKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  if (data === "view_portfolio" || data === "disambig_yes_portfolio") {
    const text = getPortfolioText(lang);
    const keyboard = getPortfolioKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  if (data === "view_about") {
    const text = getAboutText(lang);
    const keyboard = getAboutKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  if (data === "view_contact" || data === "disambig_yes_contact") {
    const text = getContactText(lang);
    const keyboard = getContactKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  if (data === "switch_lang") {
    const prompt = lang === "oromo"
      ? "🌐 *Afaan filadhaa / Select your preferred language:*"
      : "🌐 *Select your preferred language / Afaan filadhaa:*";
    const keyboard = {
      inline_keyboard: [
        [
          { text: "English 🇺🇸", callback_data: "lang_switch_english" },
          { text: "Afaan Oromoo 🇪🇹", callback_data: "lang_switch_oromo" },
        ],
        [
          { text: lang === "oromo" ? "⬅️ Duubatti" : "⬅️ Back", callback_data: "main_menu" },
        ],
      ],
    };
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

  // 4. Interactive Quotation Flow Callbacks
  if (data === "start_quote" || data === "disambig_yes_quote") {
    setUserState(userId, STATE_QUOTE_SERVICE, {});
    const text = getQuoteWizardStep1Text(lang);
    const keyboard = getQuoteWizardKeyboard(lang);
    await safeEditOrSend(bot, chatId, messageId, text, keyboard);
    return;
  }

  if (data.startsWith("quote_service_")) {
    const serviceKey = data.replace("quote_service_", "");
    const { getServiceById } = require("../services/serviceCatalogService");
    const catalogItem = getServiceById(serviceKey);
    const serviceMap = {
      web: "Full-Stack Web Development",
      mobile: "Mobile App Development",
      bot: "Telegram Bot Development",
      backend: "Backend & REST API",
      arch: "System Architecture & Database",
      other: "Custom Software Consultation",
    };
    const chosenService = catalogItem ? catalogItem.name : (serviceMap[serviceKey] || "Custom Software Development");
    const estimate = catalogItem ? catalogItem.startingPrice : null;

    setUserState(userId, STATE_QUOTE_DESC, {
      service: chosenService,
      serviceId: catalogItem ? catalogItem.id : null,
      quoteEstimate: estimate,
    });
    setSelectedService(userId, chosenService);

    const prompt = lang === "oromo"
      ? `✅ Tajaajila Filatame: *${chosenService}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n2️⃣ Maaloo galma fi qabiyyee ijoo pirojektii keessanii gabaabinaan naaf ibsaa:`
      : `✅ Selected Service: *${chosenService}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n2️⃣ Please briefly describe your project goals and key features.`;

    const cancelKeyboard = {
      inline_keyboard: [
        [{ text: lang === "oromo" ? "❌ Dhiisi (Cancel)" : "❌ Cancel Quote", callback_data: "quote_cancel" }],
      ],
    };

    await safeEditOrSend(bot, chatId, messageId, prompt, cancelKeyboard);
    return;
  }

  if (data === "quote_cancel") {
    clearUserState(userId);
    const cancelMsg = lang === "oromo"
      ? "❌ *Gaaffiin gatii haqameera.* Waan biraa maal si gargaaruu danda'a?"
      : "❌ *Quote request canceled.* How else can I assist you today?";

    const keyboard = getMainMenuKeyboard(lang, isAdmin(userId));
    await safeEditOrSend(bot, chatId, messageId, cancelMsg, keyboard);
    return;
  }

  // 5. Utility & Help Callbacks
  if (data === "help_stats") {
    const userStat = getUserStats(userId);
    if (!userStat) {
      await safeEditOrSend(bot, chatId, messageId, "No stats available yet.", getMainMenuKeyboard(lang, isAdmin(userId)));
      return;
    }
    const ctx = getContext(userId);
    const memoryCount = ctx ? ctx.messageCount : 0;
    const reply = lang === "oromo"
      ? `📊 *Istaatistiksii Keessan*\n📅 Guyyaa jalqabaa: ${formatDate(userStat.firstSeen)}\n💬 Ergaawwan: ${userStat.messageCount}\n🌐 Afaan: ${userLang}\n🧠 Yaadannoo: ${memoryCount}`
      : `📊 *Your Activity Stats*\n📅 First seen: ${formatDate(userStat.firstSeen)}\n💬 Messages sent: ${userStat.messageCount}\n🌐 Language: ${userLang}\n🧠 Session memory: ${memoryCount}`;

    const kb = {
      inline_keyboard: [
        [{ text: lang === "oromo" ? "⬅️ Fuula Duraa" : "⬅️ Back to Main Menu", callback_data: "main_menu" }],
      ],
    };
    await safeEditOrSend(bot, chatId, messageId, reply, kb);
    return;
  }

  if (data === "help_joke") {
    const jokes = getAllJokes(lang);
    const joke = jokes.length > 0 ? jokes[0] : t("joke.no_jokes", lc);
    const kb = {
      inline_keyboard: [
        jokes.length > 1 ? [{ text: "Next Joke →", callback_data: "joke_1" }] : [],
        [{ text: "⬅️ Main Menu", callback_data: "main_menu" }],
      ].filter((r) => r.length > 0),
    };
    await safeEditOrSend(bot, chatId, messageId, joke, kb);
    return;
  }

  if (data === "help_forget") {
    clearMemory(userId);
    clearUserState(userId);
    const msgText = lang === "oromo"
      ? "🧹 *Yaadannoo qulqulleeffameera!*"
      : "🧹 *Session memory cleared successfully!*";
    await safeEditOrSend(bot, chatId, messageId, msgText, getMainMenuKeyboard(lang, isAdmin(userId)));
    return;
  }

  if (data.startsWith("joke_")) {
    const page = parseInt(data.split("_")[1], 10);
    const jokes = getAllJokes(lang);
    if (page < 0 || page >= jokes.length) {
      return;
    }
    const joke = jokes[page];
    await safeEditOrSend(bot, chatId, messageId, joke, jokeKeyboard(page, jokes.length, lang));
    return;
  }

  if (data === "show_email") {
    const email = "contact@ariititech.com";
    await safeEditOrSend(bot, chatId, messageId, `✉️ *Email:* \`${email}\`\n\n(Tap above to copy)`, getMainMenuKeyboard(lang, isAdmin(userId)));
    return;
  }
}

module.exports = { handleCallback };
