const logger = require("../utils/logger");
const { randomPick, extractCity } = require("../utils/helpers");
const {
  getReplies,
  pickLocalizedReply,
  pickLocalizedTriggerReply,
  getAllJokes,
  getDisambiguationPrompt,
} = require("../services/replyService");
const { parseIntent, analyzeSentiment } = require("../services/nluService");
const {
  addMemory,
  getMemoryString,
  getContext,
  getUserState,
  setUserState,
  clearUserState,
  getLastIntent,
  setLastIntent,
  getSelectedService,
  setSelectedService,
} = require("../services/memoryService");
const { getWeather, formatWeather } = require("../services/weatherService");
const { trackUser, getUserLanguage, hasSelectedLanguage } = require("../services/userService");
const { detectLanguage } = require("../services/languageService");
const { t, getLangCode } = require("../services/i18nService");
const { handleCommand } = require("./commandHandler");
const { handleAdminCommand } = require("./adminCommandHandler");
const { trackMessage, trackBotReply } = require("../services/eventTracker");
const { notifyQuoteRequest } = require("../services/adminNotifier");
const { isAdmin } = require("../services/rbacService");
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
} = require("../utils/uiComponents");
const {
  SENTIMENT_ENCOURAGE_THRESHOLD,
  SENTIMENT_LOG_THRESHOLD,
  STATE_IDLE,
  STATE_QUOTE_SERVICE,
  STATE_QUOTE_DESC,
  STATE_QUOTE_BUDGET,
  STATE_QUOTE_CONTACT,
  STATE_VERIFY_MEDIA,
  INTENT_SERVICES,
  INTENT_PORTFOLIO,
  INTENT_QUOTE,
  INTENT_CONTACT,
  INTENT_GREETING,
  INTENT_HELP,
  INTENT_GOODBYE,
  INTENT_THANKS,
  INTENT_JOKE,
  INTENT_WEATHER,
  INTENT_TIME,
  INTENT_IDENTITY,
} = require("../utils/constants");

function languageSelectionKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "English 🇺🇸", callback_data: "lang_en" },
        { text: "Afaan Oromoo 🇪🇹", callback_data: "lang_om" },
      ],
      [
        { text: "🌐 Portfolio", url: "https://myportfolio-1-01m7.onrender.com/" },
        { text: "💻 GitHub", url: "https://github.com/yihune1234" },
      ],
      [
        { text: "🔗 LinkedIn", url: "https://www.linkedin.com/in/yihune-belay-30b0a4383" },
        { text: "📱 Telegram", url: "https://t.me/Y13bel" },
      ],
      [
        { text: "✉️ Email", callback_data: "show_email" },
      ],
    ],
  };
}

function serviceKeyboard(lang = "english") {
  return {
    inline_keyboard: [
      [
        { text: lang === "oromo" ? "📝 Gatii Gaafadhu" : "📝 Request a Quote", callback_data: "start_quote" },
        { text: lang === "oromo" ? "💼 Poortfolioo" : "💼 View Portfolio", callback_data: "view_portfolio" },
      ],
      [
        { text: "🌐 Live Portfolio", url: "https://myportfolio-1-01m7.onrender.com/" },
        { text: "📱 Telegram", url: "https://t.me/Y13bel" },
      ],
    ],
  };
}

function portfolioKeyboard(lang = "english") {
  return {
    inline_keyboard: [
      [
        { text: "💻 GitHub Profile", url: "https://github.com/yihune1234" },
        { text: "🌐 Live Demos", url: "https://myportfolio-1-01m7.onrender.com/" },
      ],
      [
        { text: lang === "oromo" ? "📝 Gatii Gaafadhu" : "📝 Request a Quote", callback_data: "start_quote" },
        { text: lang === "oromo" ? "🛠 Tajaajiloota" : "🛠 Explore Services", callback_data: "view_services" },
      ],
    ],
  };
}

function quoteKeyboard(lang = "english") {
  return {
    inline_keyboard: [
      [
        { text: lang === "oromo" ? "📝 Qajeelfama Gatii Jalqabi" : "📝 Start Quote Wizard", callback_data: "start_quote" },
      ],
      [
        { text: lang === "oromo" ? "💬 Yihune Waliin Haasa'i" : "💬 Message Yihune", url: "https://t.me/Y13bel" },
        { text: lang === "oromo" ? "💼 Hojiilee Ilaali" : "💼 View Past Work", callback_data: "view_portfolio" },
      ],
    ],
  };
}

function contactKeyboard(lang = "english") {
  return {
    inline_keyboard: [
      [
        { text: "📱 Telegram: @Y13bel", url: "https://t.me/Y13bel" },
        { text: "✉️ Copy Email", callback_data: "show_email" },
      ],
      [
        { text: "🔗 LinkedIn Profile", url: "https://www.linkedin.com/in/yihune-belay-30b0a4383" },
        { text: "💻 GitHub", url: "https://github.com/yihune1234" },
      ],
      [
        { text: lang === "oromo" ? "📝 Gatii Gaafadhu" : "📝 Request a Quote", callback_data: "start_quote" },
      ],
    ],
  };
}

function quoteWizardServicePickerKeyboard(lang = "english") {
  const { getActiveServices } = require("../services/serviceCatalogService");
  const active = getActiveServices();
  const rows = [];
  let currentRow = [];

  for (const s of active) {
    currentRow.push({
      text: `${s.name} ($${s.startingPrice})`,
      callback_data: `quote_service_${s.id}`,
    });
    if (currentRow.length === 2) {
      rows.push(currentRow);
      currentRow = [];
    }
  }
  if (currentRow.length > 0) rows.push(currentRow);
  rows.push([{ text: "💡 Other Consultation", callback_data: "quote_service_other" }]);
  rows.push([{ text: lang === "oromo" ? "❌ Dhiisi" : "❌ Cancel Quote", callback_data: "quote_cancel" }]);
  return { inline_keyboard: rows };
}

function cancelOnlyKeyboard(lang = "english") {
  return {
    inline_keyboard: [
      [
        { text: lang === "oromo" ? "❌ Dhiisi" : "❌ Cancel", callback_data: "quote_cancel" },
      ],
    ],
  };
}

function disambiguationKeyboard(intent, lang = "english") {
  return {
    inline_keyboard: [
      [
        { text: lang === "oromo" ? "✅ Eeyyee, caalaatti ibsi" : "✅ Yes, tell me more", callback_data: `disambig_yes_${intent}` },
        { text: lang === "oromo" ? "📝 Gatii Gaafadhu" : "📝 Get a Quote", callback_data: "start_quote" },
      ],
      [
        { text: lang === "oromo" ? "🏠 Fuula Duraa" : "🏠 Main Menu", callback_data: "main_menu" },
      ],
    ],
  };
}

function fallbackKeyboard(lang = "english") {
  return {
    inline_keyboard: [
      [
        { text: lang === "oromo" ? "🛠 Tajaajiloota" : "🛠 Services", callback_data: "view_services" },
        { text: lang === "oromo" ? "💼 Poortfolioo" : "💼 Portfolio", callback_data: "view_portfolio" },
      ],
      [
        { text: lang === "oromo" ? "📝 Gatii Gaafadhu" : "📝 Request a Quote", callback_data: "start_quote" },
        { text: lang === "oromo" ? "📬 Quunnamtii" : "📬 Contact", callback_data: "view_contact" },
      ],
    ],
  };
}

function getHumanTopicName(intent, lang = "english") {
  const map = {
    [INTENT_SERVICES]: lang === "oromo" ? "Tajaajila Teeknoolojii (Web, App, Bot)" : "Engineering Services (Web, Apps, Bots)",
    [INTENT_PORTFOLIO]: lang === "oromo" ? "Pirojektiiwwan fi Poortfolioo" : "Projects & Portfolio Showcase",
    [INTENT_QUOTE]: lang === "oromo" ? "Tilmaama Gatii fi Baasii Pirojektii" : "Project Pricing & Quote Estimates",
    [INTENT_CONTACT]: lang === "oromo" ? "Quunnamtii fi Teessoo Yihune" : "Contact & Direct Channels",
    [INTENT_JOKE]: lang === "oromo" ? "Qoosaa fi Kolfa" : "Jokes & Fun",
    [INTENT_WEATHER]: lang === "oromo" ? "Haala Qilleensaa" : "Weather Forecast",
  };
  return map[intent] || (lang === "oromo" ? "Pirojektiiwwan Yihune B" : "Yihune B's Software Services");
}

/**
 * Media Verification Handler (C2PA & Google SynthID Provenance)
 */
async function processMediaVerification(mediaMsg, chatId, userId, bot, lang = "english") {
  const isOr = lang === "oromo";

  // Check for multiple files (Telegram media group)
  if (mediaMsg.media_group_id) {
    const multiMsg = isOr
      ? "⚠️ *Maaloo mirkaneessa sirriif faayila tokko qofa yeroo tokkotti ergaa.*"
      : "⚠️ *Please send only one media file at a time* for accurate provenance and metadata verification.";
    await bot.sendMessage(chatId, multiMsg, { parse_mode: "Markdown" });
    return;
  }

  let fileId = null;
  let fileName = "media_image.jpg";
  let mimeType = "image/jpeg";
  let isDoc = false;
  let fileSize = 0;

  if (Array.isArray(mediaMsg.photo) && mediaMsg.photo.length > 0) {
    const highestRes = mediaMsg.photo[mediaMsg.photo.length - 1];
    fileId = highestRes.file_id;
    fileSize = highestRes.file_size || 0;
    fileName = `photo_${highestRes.file_unique_id || Date.now()}.jpg`;
    mimeType = "image/jpeg";
    isDoc = false;
  } else if (mediaMsg.document) {
    fileId = mediaMsg.document.file_id;
    fileSize = mediaMsg.document.file_size || 0;
    fileName = mediaMsg.document.file_name || "document_media";
    mimeType = mediaMsg.document.mime_type || "application/octet-stream";
    isDoc = true;
  }

  if (!fileId) {
    const noMediaMsg = isOr
      ? "❌ Suuraa ykn faayila mirkaneeffamu hin arganne. Maaloo suuraa ergaa."
      : "❌ No valid image or media file detected. Please send a photo or document.";
    await bot.sendMessage(chatId, noMediaMsg);
    return;
  }

  // Oversized file check
  if (fileSize > 20 * 1024 * 1024) {
    const overMsg = isOr
      ? "❌ *Hangi faayilii baay'ee guddaadha.* Hangi heyyamame 20 MB qofa."
      : "❌ *File exceeds size limit.* Maximum allowed size is 20 MB.";
    await bot.sendMessage(chatId, overMsg, { parse_mode: "Markdown" });
    return;
  }

  // Send analyzing progress indicator
  const statusPrompt = isOr
    ? "⏳ *Madda miidiyaa qorachaa jira...*\nMallattoolee dijitaalaa C2PA, SynthID fi metadata sakatta'aa jira..."
    : "⏳ *Analyzing media provenance...*\nChecking C2PA digital credentials, Google SynthID markers, and metadata...";
  const statusMsg = await bot.sendMessage(chatId, statusPrompt, { parse_mode: "Markdown" });

  try {
    const axios = require("axios");
    const fileLink = await bot.getFileLink(fileId);
    const response = await axios.get(fileLink, { responseType: "arraybuffer", timeout: 30000 });
    const buffer = Buffer.from(response.data);

    const { verifyMediaBuffer } = require("../services/verifyService");
    const result = await verifyMediaBuffer(buffer, {
      fileName,
      mimeType,
      isDocument: isDoc,
      lang,
    });

    const reportKb = {
      inline_keyboard: [
        [{ text: isOr ? "🔍 Miidiyaa Biroo Mirkaneessi" : "🔍 Verify Another Media", callback_data: "verify_media_prompt" }],
        [{ text: isOr ? "⬅️ Fuula Duraa" : "⬅️ Back to Main Menu", callback_data: "main_menu" }],
      ],
    };

    try {
      await bot.deleteMessage(chatId, statusMsg.message_id);
    } catch (_) {}

    await bot.sendMessage(chatId, result.report, {
      parse_mode: "Markdown",
      reply_markup: reportKb,
      disable_web_page_preview: true,
    });

    clearUserState(userId);
  } catch (err) {
    logger.error(`Media verification error for user ${userId}: ${err.message}`);
    try {
      await bot.deleteMessage(chatId, statusMsg.message_id);
    } catch (_) {}
    const failMsg = isOr
      ? `❌ *Dogoggora mirkaneessa miidiyaa:* ${err.message}`
      : `❌ *Media verification failed:* Could not process file (${err.message}).`;
    await bot.sendMessage(chatId, failMsg, { parse_mode: "Markdown" });
  }
}

async function handleMessage(msg, bot, userList) {
  if (msg.from && msg.from.is_bot) return;

  const chatId = msg.chat.id;
  const userId = msg.from.id;
  const caption = (msg.caption || "").trim();
  const text = (msg.text || "").trim();
  const rawText = text || caption;
  const firstName = msg.from.first_name || "there";
  const username = msg.from.username || "no-username";
  const isPhoto = Array.isArray(msg.photo) && msg.photo.length > 0;
  const isDocument = !!msg.document;
  const isMedia = isPhoto || isDocument;

  trackUser(msg);
  logger.info(`📩 ${firstName} (@${username}): ${rawText || (isPhoto ? "[Photo]" : isDocument ? "[Document]" : "[Empty]")}`);

  if (rawText) addMemory(userId, "user", rawText);
  if (!rawText && !isMedia) return;

  // Admin Slash Commands
  if (rawText.startsWith("/")) {
    const adminHandled = await handleAdminCommand(rawText, chatId, userId, bot);
    if (adminHandled) return;
  }

  // Fast-track /start command
  if (rawText === "/start") {
    const handled = await handleCommand(rawText, chatId, userId, bot, userList, "english");
    if (handled) return;
  }

  // Onboarding Language Check
  if (!hasSelectedLanguage(userId)) {
    const en =
      `🏢 *WELCOME TO ARIITI TECH*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `We engineer high-performance web systems, cross-platform mobile apps, enterprise Telegram bots, and resilient cloud architectures.\n\n` +
      `🌐 *Please select your language / Afaan kee filadhu:*`;

    const om =
      `🏢 *BAGA GARA ARIITI TECH NAGAYAN DHUFTAN*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Sirna dijitaalaa ammayyaa, web saffisaa, app moobaayilii, fi botiiwwan Telegram daldalaa ijaarra.\n\n` +
      `🌐 *Afaan kee filadhu / Please select your language:*`;

    const userLang = detectLanguage(text);
    const intro = userLang === "oromo" ? om : en;

    try {
      await bot.sendMessage(chatId, intro, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "English 🇺🇸", callback_data: "lang_en" },
              { text: "Afaan Oromoo 🇪🇹", callback_data: "lang_om" },
            ],
            [
              { text: "🛠 Explore Services", callback_data: "view_services" },
              { text: "💼 Portfolio", callback_data: "view_portfolio" },
            ],
          ],
        },
      });
    } catch (err) {
      logger.error(`Language prompt error: ${err.message}`);
    }
    return;
  }

  const lang = getUserLanguage(userId) || "english";
  const lc = getLangCode(lang);
  const langForReplies = lang === "oromo" ? "oromo" : "english";

  trackMessage(msg, langForReplies);

  // ----------------------------------------------------
  // AI MEDIA VERIFICATION (C2PA & Google SynthID check)
  // ----------------------------------------------------
  if (rawText.startsWith("/verify")) {
    const repliedMsg = msg.reply_to_message;
    if (repliedMsg && (repliedMsg.photo || repliedMsg.document)) {
      await processMediaVerification(repliedMsg, chatId, userId, bot, langForReplies);
      return;
    }

    if (isMedia) {
      await processMediaVerification(msg, chatId, userId, bot, langForReplies);
      return;
    }

    // Set state and prompt user
    setUserState(userId, STATE_VERIFY_MEDIA, {});
    const verifyHelp = langForReplies === "oromo"
      ? `🔍 *Mirkaneessa Miidiyaa AI (C2PA & SynthID)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Maaloo suuraa irratti *reply* gochuun \`/verify\` jedhaa, ykn suuraa/faayila qabdu \`/verify\` barreesitanii ergaa.\n\n` +
        `• *C2PA Content Credentials:* Madda, seenaa gulaallii, fi mallattoo dijitaalaa ni qorata\n` +
        `• *Google SynthID:* Watermark suuraa AI Google'n uumame ni sakatta'a\n` +
        `• *Meeshaalee AI:* EXIF fi meeshaalee AI (DALL-E, Firefly, Midjourney) ni adda baasa\n\n` +
        `💡 _Qulqullina guutuuf faayilicha akka uncompressed 'File / Document' tti ergaa._`
      : `🔍 *AI Media Verification (C2PA & SynthID)*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `Please reply to an image or send a photo with the caption \`/verify\` to check its origin and content credentials.\n\n` +
        `• *C2PA Content Credentials:* Extracts origin history, editing steps, and digital signatures.\n` +
        `• *Google SynthID:* Detects imperceptible watermarks and Google generative AI provenance.\n` +
        `• *AI Tool Signatures:* Detects DALL-E, Adobe Firefly, Midjourney, and Stable Diffusion markers.\n\n` +
        `💡 _Standard Telegram photo compression strips metadata. For full cryptographic C2PA verification, send as an uncompressed 'File / Document'._`;

    const cancelKb = {
      inline_keyboard: [
        [{ text: langForReplies === "oromo" ? "❌ Dhiisi" : "❌ Cancel", callback_data: "main_menu" }],
      ],
    };
    await bot.sendMessage(chatId, verifyHelp, { parse_mode: "Markdown", reply_markup: cancelKb });
    return;
  }

  // Active STATE_VERIFY_MEDIA handling
  const userSession = getUserState(userId);
  const activeState = userSession.state;

  if (activeState === STATE_VERIFY_MEDIA) {
    if (rawText === "/cancel" || rawText.toLowerCase() === "cancel" || rawText.toLowerCase() === "dhiisi") {
      clearUserState(userId);
      const cancelMsg = langForReplies === "oromo"
        ? "❌ Mirkaneessi miidiyaa haqameera. Fuula duraatti deebi'eera."
        : "❌ Media verification canceled. Returned to main menu.";
      const { getMainMenuKeyboard } = require("../utils/uiComponents");
      await bot.sendMessage(chatId, cancelMsg, { reply_markup: getMainMenuKeyboard(langForReplies, isAdmin(userId)) });
      return;
    }

    if (isMedia) {
      await processMediaVerification(msg, chatId, userId, bot, langForReplies);
      return;
    }

    const reminder = langForReplies === "oromo"
      ? "📸 Maaloo suuraa ykn faayila mirkaneeffachuu barbaaddan ergaa, ykn haquuf /cancel jedhaa."
      : "📸 Please send the photo or file you wish to verify, or type /cancel to return.";
    await bot.sendMessage(chatId, reminder);
    return;
  }

  // If user sends media directly with "verify" in caption
  if (isMedia && /verify/i.test(caption)) {
    await processMediaVerification(msg, chatId, userId, bot, langForReplies);
    return;
  }

  // General Slash Commands (/start, /help, /weather, etc.)
  const handled = await handleCommand(text, chatId, userId, bot, userList, langForReplies);
  if (handled) return;

  // ==========================================
  // STEP 1: CHECK ACTIVE CONVERSATION STATE
  // ==========================================
  if (activeState && activeState !== STATE_IDLE) {
    if (text === "/cancel" || text.toLowerCase() === "cancel" || text.toLowerCase() === "dhiisi") {
      clearUserState(userId);
      const cancelMsg = langForReplies === "oromo"
        ? "❌ Gaaffiin gatii haqameera. Waan biraa maal si gargaaruu danda'a?"
        : "❌ Quote request canceled. How else can I assist you today?";
      await bot.sendMessage(chatId, cancelMsg, { reply_markup: fallbackKeyboard(langForReplies) });
      return;
    }

    // Admin Contact & Profile Editing State Handlers
    if (activeState.startsWith("STATE_ADMIN_EDIT_") && isAdmin(userId)) {
      const { updateCompanyProfile } = require("../services/businessConfigService");
      const backProfileKb = {
        inline_keyboard: [[{ text: "🏢 Return to Business Profile", callback_data: "admin_nav_profile" }]],
      };

      if (activeState === "STATE_ADMIN_EDIT_PHONE") {
        clearUserState(userId);
        await updateCompanyProfile({ phone: text.trim() });
        await bot.sendMessage(chatId, `✅ <b>Business phone updated to:</b> <code>${text.trim()}</code>\n💾 Saved directly to MongoDB Atlas & local configuration!`, { parse_mode: "HTML", reply_markup: backProfileKb });
        return;
      }
      if (activeState === "STATE_ADMIN_EDIT_EMAIL") {
        clearUserState(userId);
        await updateCompanyProfile({ email: text.trim() });
        await bot.sendMessage(chatId, `✅ <b>Business email updated to:</b> <code>${text.trim()}</code>\n💾 Saved directly to MongoDB Atlas & local configuration!`, { parse_mode: "HTML", reply_markup: backProfileKb });
        return;
      }
      if (activeState === "STATE_ADMIN_EDIT_TELEGRAM") {
        clearUserState(userId);
        await updateCompanyProfile({ telegram: text.trim() });
        await bot.sendMessage(chatId, `✅ <b>Business Telegram updated to:</b> <code>${text.trim()}</code>\n💾 Saved directly to MongoDB Atlas & local configuration!`, { parse_mode: "HTML", reply_markup: backProfileKb });
        return;
      }
      if (activeState === "STATE_ADMIN_EDIT_LOCATION") {
        clearUserState(userId);
        await updateCompanyProfile({ location: text.trim() });
        await bot.sendMessage(chatId, `✅ <b>Business location updated to:</b> <code>${text.trim()}</code>\n💾 Saved directly to MongoDB Atlas & local configuration!`, { parse_mode: "HTML", reply_markup: backProfileKb });
        return;
      }
      if (activeState === "STATE_ADMIN_EDIT_HOURS") {
        clearUserState(userId);
        await updateCompanyProfile({ operatingHours: text.trim() });
        await bot.sendMessage(chatId, `✅ <b>Operating hours updated to:</b> <code>${text.trim()}</code>\n💾 Saved directly to MongoDB Atlas & local configuration!`, { parse_mode: "HTML", reply_markup: backProfileKb });
        return;
      }
      if (activeState === "STATE_ADMIN_EDIT_ABOUT") {
        clearUserState(userId);
        await updateCompanyProfile({ about: text.trim() });
        await bot.sendMessage(chatId, `✅ <b>About / Bio updated to:</b>\n<i>${text.trim()}</i>\n\n💾 Saved directly to MongoDB Atlas & local configuration!`, { parse_mode: "HTML", reply_markup: backProfileKb });
        return;
      }
    }

    if (activeState === STATE_QUOTE_SERVICE) {
      setUserState(userId, STATE_QUOTE_DESC, { service: text });
      setSelectedService(userId, text);
      const prompt = langForReplies === "oromo"
        ? `✅ Tajaajila: *${text}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n2️⃣ Maaloo galma fi qabiyyee ijoo pirojektii keessanii gabaabinaan naaf ibsaa:`
        : `✅ Service: *${text}*\n━━━━━━━━━━━━━━━━━━━━━━━━━━\n2️⃣ Please briefly describe your project goals and key features.`;
      await bot.sendMessage(chatId, prompt, { parse_mode: "Markdown", reply_markup: cancelOnlyKeyboard(langForReplies) });
      return;
    }

    if (activeState === STATE_QUOTE_DESC) {
      setUserState(userId, STATE_QUOTE_BUDGET, { description: text });
      const prompt = langForReplies === "oromo"
        ? `3️⃣ Yeroon xumuraa ykn tilmaamni baasii (budget) keessan akkami?`
        : `3️⃣ What is your expected timeline or budget range?`;
      await bot.sendMessage(chatId, prompt, { parse_mode: "Markdown", reply_markup: cancelOnlyKeyboard(langForReplies) });
      return;
    }

    if (activeState === STATE_QUOTE_BUDGET) {
      setUserState(userId, STATE_QUOTE_CONTACT, { budget: text });
      const prompt = langForReplies === "oromo"
        ? `4️⃣ Gareen keenya akka isin quunnamuuf lakkoofsa bilbilaa, imeelii, ykn Telegram handle keessan nuuf ergaa:`
        : `4️⃣ Please share your phone number, email, or Telegram handle so our team can reach you.`;
      await bot.sendMessage(chatId, prompt, { parse_mode: "Markdown", reply_markup: cancelOnlyKeyboard(langForReplies) });
      return;
    }

    if (activeState === STATE_QUOTE_CONTACT) {
      const stateData = userSession.data || {};
      const finalQuote = {
        service: stateData.service || "Custom Software",
        description: stateData.description || "N/A",
        budget: stateData.budget || "Flexible",
        contact: text,
      };

      clearUserState(userId);

      // Save complete lead details to MongoDB (if connected) & data/leads.json
      const { createLead } = require("../services/leadService");
      try {
        await createLead({
          telegramId: userId,
          customerName: firstName || username || "Client",
          username: username,
          serviceType: finalQuote.service,
          serviceId: stateData.serviceId || null,
          projectDescription: finalQuote.description,
          budgetTimeline: finalQuote.budget,
          contactInfo: finalQuote.contact,
          quoteEstimate: stateData.quoteEstimate || null,
        });
      } catch (err) {
        logger.error(`Failed to persist lead: ${err.message}`);
      }

      // Notify Admin
      try {
        await notifyQuoteRequest(userId, firstName, username, finalQuote);
      } catch (err) {
        logger.error(`Failed to notify admin of quote: ${err.message}`);
      }

      const confirmMsg = langForReplies === "oromo"
        ? `🎉 *Gaaffiin Gatii Keessan Milkaa'inaan Qaqqabeera!*\n\nGalatoomaa, *${firstName}*! Gareen Aritii Tech odeeffannoo pirojektii keessanii argateera:\n\n💻 *Tajaajila:* ${finalQuote.service}\n📋 *Galma Pirojektii:* ${finalQuote.description}\n💰 *Yeroo / Baasii:* ${finalQuote.budget}\n📞 *Quunnamtii:* ${finalQuote.contact}\n\nGareen teeknikaa keenya hatattamaan isin quunnama!`
        : `🎉 *Project Quote Request Received!*\n\nThank you, *${firstName}*! The Aritii Tech team has received your project details:\n\n💻 *Service:* ${finalQuote.service}\n📋 *Project Goals:* ${finalQuote.description}\n💰 *Timeline / Budget:* ${finalQuote.budget}\n📞 *Contact Info:* ${finalQuote.contact}\n\nOur engineering team will review your specifications and reach out promptly!`;

      await bot.sendMessage(chatId, confirmMsg, {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [
              { text: "🚀 Our Portfolio", callback_data: "view_portfolio" },
              { text: "⬅️ Back to Main Menu", callback_data: "main_menu" },
            ],
          ],
        },
      });
      addMemory(userId, "bot", confirmMsg);
      trackBotReply(userId, firstName, text, "Quote Completed");
      logger.info(`📝 User ${userId} submitted quote request for "${finalQuote.service}"`);
      return;
    }
  }

  // ==========================================
  // STEP 2: NLU PARSING & CONTEXT AWARENESS
  // ==========================================
  bot.sendChatAction(chatId, "typing").catch(() => {});

  const nluResult = parseIntent(text);
  let intent = nluResult.intent;
  let confidence = nluResult.confidence;
  const sentiment = nluResult.sentiment;

  // Sentiment check
  if (sentiment.comparative < SENTIMENT_LOG_THRESHOLD) {
    logger.info(`😟 Negative sentiment from user ${userId} (score: ${sentiment.comparative})`);
  }

  if (sentiment.comparative < SENTIMENT_ENCOURAGE_THRESHOLD) {
    const encouragement = pickLocalizedReply("encouragementReplies", langForReplies);
    if (intent === INTENT_GREETING) {
      const reply = pickLocalizedReply("hiReplies", langForReplies);
      await bot.sendMessage(chatId, reply + " " + encouragement);
      addMemory(userId, "bot", reply + " " + encouragement);
    } else {
      await bot.sendMessage(chatId, encouragement);
      addMemory(userId, "bot", encouragement);
    }
    logger.info(`🤖 Encouraged user ${userId} (sentiment: ${sentiment.comparative})`);
    return;
  }

  // Multi-turn context resolution:
  // e.g. User asked about mobile apps earlier, and now asks "How much does it cost?"
  const lastIntent = getLastIntent(userId);
  const rememberedService = getSelectedService(userId);

  if (intent === INTENT_QUOTE && (lastIntent === INTENT_SERVICES || rememberedService)) {
    confidence = Math.max(confidence, 0.88);
  } else if (intent === INTENT_SERVICES) {
    const matched = nluResult.matchedKeywords || [];
    if (matched.includes("bot") || matched.includes("telegram")) setSelectedService(userId, "Telegram Bot");
    else if (matched.includes("app") || matched.includes("mobile")) setSelectedService(userId, "Mobile App");
    else if (matched.includes("web") || matched.includes("website")) setSelectedService(userId, "Web Development");
  }

  // Update session intent
  setLastIntent(userId, intent);

  // ==========================================
  // STEP 3: INTELLIGENT RESPONSE ROUTING
  // ==========================================
  const replies = getReplies();
  const lower = text.toLowerCase();

  // HIGH CONFIDENCE (>= 0.7)
  if (confidence >= 0.7) {
    let replyText = null;
    let replyMarkup = null;

    switch (intent) {
      case INTENT_SERVICES:
        replyText = getServicesText(langForReplies);
        replyMarkup = getServicesKeyboard(langForReplies);
        break;

      case INTENT_PORTFOLIO:
        replyText = getPortfolioText(langForReplies);
        replyMarkup = getPortfolioKeyboard(langForReplies);
        break;

      case INTENT_QUOTE:
        setUserState(userId, STATE_QUOTE_SERVICE, {});
        replyText = getQuoteWizardStep1Text(langForReplies);
        replyMarkup = getQuoteWizardKeyboard(langForReplies);
        break;

      case INTENT_CONTACT:
        replyText = getContactText(langForReplies);
        replyMarkup = getContactKeyboard(langForReplies);
        break;

      case INTENT_GREETING:
        replyText = getWelcomeText(langForReplies, firstName);
        replyMarkup = getMainMenuKeyboard(langForReplies, isAdmin(userId));
        break;
        break;

      case INTENT_HELP:
        replyText = t("help_response", lc);
        replyMarkup = fallbackKeyboard(langForReplies);
        break;

      case INTENT_JOKE:
        replyText = handleJokeIntent(chatId, userId, bot, replies, langForReplies);
        if (replyText && replyText._sent) return;
        break;

      case INTENT_WEATHER:
        replyText = await handleWeatherIntent(text, replies, langForReplies);
        break;

      case INTENT_TIME:
        replyText = t("time.current", lc, { time: new Date().toLocaleTimeString() });
        break;

      case INTENT_IDENTITY:
        replyText = pickLocalizedReply("identityReplies", langForReplies) ||
          pickLocalizedTriggerReply("what are you", langForReplies);
        replyMarkup = serviceKeyboard(langForReplies);
        break;

      case INTENT_GOODBYE:
        replyText = pickLocalizedTriggerReply("bye", langForReplies) || "Goodbye! Have a productive day!";
        break;

      case INTENT_THANKS:
        replyText = pickLocalizedTriggerReply("thanks", langForReplies) || "You're very welcome!";
        break;

      default:
        replyText = handleFallbackIntent(lower, userId, replies, langForReplies);
        replyMarkup = fallbackKeyboard(langForReplies);
        break;
    }

    if (replyText && !replyText._sent) {
      await sendBotReply(bot, chatId, userId, firstName, text, replyText, replyMarkup, langForReplies);
    }
    return;
  }

  // MEDIUM CONFIDENCE (0.4 <= confidence < 0.7): SMART DISAMBIGUATION
  if (confidence >= 0.4 && intent !== "unknown") {
    const topicLabel = getHumanTopicName(intent, langForReplies);
    const disambigPrompt = getDisambiguationPrompt(topicLabel, langForReplies);
    const markup = disambiguationKeyboard(intent, langForReplies);

    await sendBotReply(bot, chatId, userId, firstName, text, disambigPrompt, markup, langForReplies);
    return;
  }

  // LOW CONFIDENCE (< 0.4): SMART FALLBACK
  // First check trigger replies for direct phrase matches
  const triggerMatch = matchTrigger(lower, replies, langForReplies);
  if (triggerMatch) {
    await sendBotReply(bot, chatId, userId, firstName, text, triggerMatch, fallbackKeyboard(langForReplies), langForReplies);
    return;
  }

  // ==========================================
  // STEP 3: THE INVISIBLE GEMINI AI ASSISTANT
  // ==========================================
  const { generateAIResponse, isHighValueInquiry, isAIEnabled } = require("../services/aiService");
  const { notifyAIHandledInquiry } = require("../services/adminNotifier");

  if (isAIEnabled()) {
    try {
      const history = getContext(userId)?.recentMessages || [];
      const aiReply = await generateAIResponse(text, history, langForReplies);

      if (aiReply) {
        const quoteButtonMarkup = {
          inline_keyboard: [
            [
              { text: langForReplies === "oromo" ? "📝 Gatii Gaafadhu" : "📝 Request a Quote", callback_data: "start_quote" },
              { text: langForReplies === "oromo" ? "🏠 Fuula Duraa" : "🏠 Main Menu", callback_data: "main_menu" },
            ],
          ],
        };

        await sendBotReply(bot, chatId, userId, firstName, text, aiReply, quoteButtonMarkup, langForReplies);

        // High-value inquiry detection: alert admin
        const highValue = isHighValueInquiry(text);
        if (highValue) {
          notifyAIHandledInquiry(userId, firstName, username, text, aiReply, true).catch(() => {});
        }

        return;
      }
    } catch (err) {
      logger.warn(`AI generation error: ${err.message}. Gracefully falling back to menu.`);
    }
  }

  // Contextual fallback check
  const memStr = getMemoryString(userId);
  if (memStr && /\b(what did i|what did we|did i say|repeat|what were we)\b/.test(lower)) {
    const memReply = `Here's what I remember from our conversation:\n\n${memStr}`;
    await sendBotReply(bot, chatId, userId, firstName, text, memReply, getMainMenuKeyboard(langForReplies, isAdmin(userId)), langForReplies);
    return;
  }

  const smartFallback = langForReplies === "oromo"
    ? "Aritii Tech quunnamuu keessaniif galatoomaa! Tajaajiloota keenya /services fayyadamuun ilaaluu ykn waa'ee pirojektii keessanii /quote fayyadamuun nuuf ibsuu dandeessu."
    : "Thanks for reaching out to Aritii Tech! You can explore our services using /services or tell us about your project using /quote.";

  await sendBotReply(bot, chatId, userId, firstName, text, smartFallback, getMainMenuKeyboard(langForReplies, isAdmin(userId)), langForReplies);
}

async function sendBotReply(bot, chatId, userId, firstName, userText, replyText, replyMarkup, lang) {
  const finalReply = firstName !== "there" && lang === "english" && !replyText.startsWith("Hello") && !replyText.startsWith("Hey")
    ? `${firstName}, ${replyText[0].toLowerCase() + replyText.slice(1)}`
    : replyText;

  const options = { parse_mode: "Markdown" };
  if (replyMarkup) options.reply_markup = replyMarkup;

  try {
    await bot.sendMessage(chatId, finalReply, options);
  } catch {
    delete options.parse_mode;
    await bot.sendMessage(chatId, finalReply, options);
  }

  addMemory(userId, "bot", finalReply);
  trackBotReply(userId, firstName, userText, finalReply);
  logger.info(`🤖 Replied to ${userId}: "${finalReply.substring(0, 60)}..."`);
}

function matchTrigger(lower, replies, lang) {
  if (!replies || !replies.triggerReplies) return null;
  const sortedKeys = Object.keys(replies.triggerReplies).sort((a, b) => b.length - a.length);
  for (const key of sortedKeys) {
    if (lower === key || lower.includes(key)) {
      return pickLocalizedTriggerReply(key, lang);
    }
  }
  return null;
}

function handleJokeIntent(chatId, userId, bot, replies, lang) {
  const jokes = getAllJokes(lang);
  if (jokes.length > 0) {
    const jokeText = jokes[0];
    if (jokes.length > 1) {
      bot.sendMessage(chatId, jokeText, {
        reply_markup: {
          inline_keyboard: [[{ text: lang === "oromo" ? "Kan itti aanu →" : "Next →", callback_data: "joke_1" }]],
        },
      });
      addMemory(userId, "bot", jokeText);
      logger.info(`🤖 Told joke to ${userId}`);
      return { _sent: true };
    }
    return jokeText;
  }
  return t("joke.no_jokes", getLangCode(lang));
}

async function handleWeatherIntent(text, replies, lang) {
  const city = extractCity(text);
  if (city) {
    try {
      const weather = await getWeather(city);
      if (weather) return formatWeather(weather);
    } catch (err) {}
    return pickLocalizedReply("weatherFailReplies", lang);
  }
  return t("commands.weather_ask_city", getLangCode(lang));
}

function handleFallbackIntent(lower, userId, replies, lang) {
  const triggerMatch = matchTrigger(lower, replies, lang);
  if (triggerMatch) return triggerMatch;
  return pickLocalizedReply("fallbackReplies", lang);
}

module.exports = {
  handleMessage,
  languageSelectionKeyboard,
  serviceKeyboard,
  portfolioKeyboard,
  quoteKeyboard,
  contactKeyboard,
  quoteWizardServicePickerKeyboard,
  fallbackKeyboard,
};
