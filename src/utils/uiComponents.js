const logger = require("./logger");
const { getActiveServices } = require("../services/serviceCatalogService");
const { getConfig } = require("../services/businessConfigService");

function getWelcomeText(lang = "english", firstName = "Valued Client") {
  if (lang === "oromo") {
    return (
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `  🌟 *ARITII TECH* 🌟\n` +
      `  _Ogeessa Ijaarsa Dijitaalaa_\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Baga nagaan dhuftan! Yaada keessan gara furmaata software saffisaa, amansiisaa fi babal'achuu danda'utti jijjiirra.\n\n` +
      `Platform web dhuunfaa, app moobaayilii, bot Telegram daldalaa, ykn arkiteekcharii sirnaa barbaaddu, Aritii Tech tajaajila teeknoolojii olaanaa galma daldala keessaniif kan ta'u ni dhiheessa.\n\n` +
      `💡 *Har'a maal ilaaluu barbaaddu?* Qabduuwwan armaan gadii fayyadamaa:`
    );
  }

  return (
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `  🌟 *ARITII TECH* 🌟\n` +
    `  _Engineering Digital Excellence_\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Welcome! We transform complex ideas into high-performing, scalable software solutions.\n\n` +
    `Whether you need a custom web platform, a mobile application, a smart Telegram bot, or robust system architecture, Aritii Tech delivers elite engineering tailored to your business goals.\n\n` +
    `💡 *What would you like to explore today?* Use the interactive menu below:`
  );
}

function getMainMenuKeyboard(lang = "english", isAdminUser = false) {
  const isOr = lang === "oromo";
  const rows = [
    [
      { text: isOr ? "💻 Tajaajila Software" : "💻 Software Services", callback_data: "view_services" },
      { text: isOr ? "🚀 Poortfolioo Keenya" : "🚀 Our Portfolio", callback_data: "view_portfolio" },
    ],
    [
      { text: isOr ? "📝 Gatii Gaafadhu" : "📝 Request a Quote", callback_data: "start_quote" },
      { text: isOr ? "🏢 Waa'ee Aritii Tech" : "🏢 About Aritii Tech", callback_data: "view_about" },
    ],
    [
      { text: isOr ? "📞 Nu Quunnamaa" : "📞 Contact Us", callback_data: "view_contact" },
      { text: isOr ? "🌐 Afaan (EN / OM)" : "🌐 Language (EN / OM)", callback_data: "switch_lang" },
    ],
  ];

  if (isAdminUser) {
    rows.push([
      { text: "⚙️ Admin Control Panel", callback_data: "admin_nav_main" },
    ]);
  }

  return { inline_keyboard: rows };
}

function getServicesText(lang = "english") {
  const isOr = lang === "oromo";

  if (isOr) {
    return (
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `  💻 *TAJAAJILOOTA ARITII TECH*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Odeeffannoo dabalataaf ykn pirojektii ajajuuf tajaajila armaan gadii filadhaa:\n\n` +
      `• *Full-Scale Web Applications*\n` +
      `  Custom web apps, platformiiwwan e-commerce, dashboards, fi APIs nageenya qaban. _(Tech: Django, Node.js, React, PostgreSQL, MongoDB)_\n\n` +
      `• *Mobile App Development*\n` +
      `  App moobaayilii iOS fi Android kan UI qulqulluu fi hojii toora intarneetaa malee hojjetu qabu. _(Tech: Flutter, React Native)_\n\n` +
      `• *Telegram Bots & Mini Apps*\n` +
      `  Botiiwwan daldalaa ofiin hojjetan, ajaja/ergaa dhiheessuu, fi Telegram WebApps.\n\n` +
      `• *System Architecture & Cloud*\n` +
      `  Ijaarsa database schema, cloud deployment babal'atu, fi bu'uura API cimaa.\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `💡 *Gatii Waliigaltee fi Mijataa:*\n` +
      `Gatiin akkaataa fedhii fi baasii keessaniitti kan mari'atamuudha. Bilisa ta'aatii nu quunnamaa — mari'annee gatii isiniif ta'u irratti waliigalla!`
    );
  }

  return (
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `  💻 *ARITII TECH SERVICES*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Select a service below to learn more or request a project:\n\n` +
    `• *Full-Scale Web Applications*\n` +
    `  Custom web apps, e-commerce platforms, dashboards, and secure APIs. _(Tech: Django, Node.js, React, PostgreSQL, MongoDB)_\n\n` +
    `• *Mobile App Development*\n` +
    `  Cross-platform iOS and Android applications with clean UI and offline capabilities. _(Tech: Flutter, React Native)_\n\n` +
    `• *Telegram Bots & Mini Apps*\n` +
    `  Automated business bots, ordering/delivery workflows, and Telegram WebApps.\n\n` +
    `• *System Architecture & Cloud*\n` +
    `  Database schema design, scalable cloud deployment, and secure API infrastructure.\n\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💡 *Flexible & Collaborative Pricing:*\n` +
    `Pricing is customized to your unique project scope and requirements. Feel free to contact us — we discuss your vision openly and agree on pricing that works best for your budget!`
  );
}

function getServicesKeyboard(lang = "english") {
  const isOr = lang === "oromo";
  return {
    inline_keyboard: [
      [
        { text: isOr ? "📝 Tajaajila Kana Ajaji" : "📝 Order This Service", callback_data: "start_quote" },
        { text: isOr ? "⬅️ Fuula Duraa" : "⬅️ Back to Main Menu", callback_data: "main_menu" },
      ],
    ],
  };
}

function getPortfolioText(lang = "english") {
  if (lang === "oromo") {
    return (
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `  🚀 *POORTFOLIOO ARITII TECH*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Hojiilee fi sirna dijitaalaa dhiheenya kana ijaarre:\n\n` +
      `• 🌐 *Full-Scale Web Platforms:* React, Django fi Node.js irratti kan ijaarame.\n` +
      `• 📱 *Mobile Apps:* Flutter & React Native fayyadamuun kan qophaa'e.\n` +
      `• 🤖 *Smart Telegram Bots:* Tajaajila maamilaa fi kaffaltii ofiisaa.\n` +
      `• ⚙️ *Cloud & APIs:* PostgreSQL, MongoDB, Docker fi Microservices.\n\n` +
      `_Demos kallattiin daawwachuuf hidhata armaan gadii fayyadamaa:_`
    );
  }

  return (
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `  🚀 *OUR PORTFOLIO & PROVEN WORK*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Explore our recent enterprise systems, web platforms, and mobile solutions:\n\n` +
    `• 🌐 *Full-Scale Web Applications:* Enterprise SaaS platforms, responsive React frontends, and robust Django / Node.js backends.\n` +
    `• 📱 *Mobile Applications:* Native-quality iOS & Android mobile applications built with Flutter and React Native.\n` +
    `• 🤖 *Smart Telegram Bots & Mini Apps:* 24/7 automated business assistance, payment integrations, and CRM syncing.\n` +
    `• ⚙️ *Cloud Architectures:* High-throughput MongoDB and PostgreSQL microservices with Docker deployment.\n\n` +
    `_Select a showcase link below or request an estimate for your custom build:_`
  );
}

function getPortfolioKeyboard(lang = "english") {
  const isOr = lang === "oromo";
  return {
    inline_keyboard: [
      [
        { text: "🌐 Live Web Showcase", url: "https://myportfolio-1-01m7.onrender.com/" },
        { text: "💻 GitHub Repositories", url: "https://github.com/yihune1234" },
      ],
      [
        { text: isOr ? "📝 Gatii Gaafadhu" : "📝 Request a Quote", callback_data: "start_quote" },
        { text: isOr ? "⬅️ Fuula Duraa" : "⬅️ Back to Main Menu", callback_data: "main_menu" },
      ],
    ],
  };
}

function getAboutText(lang = "english") {
  const config = getConfig();
  const c = config.company || {};
  const isOr = lang === "oromo";

  if (isOr) {
    const aboutOr = c.aboutOr || "*Aritii Technologies PLC* dhaabbata ogeeyyii software fi teeknoolojii dijitaalaa ammayyaati.";
    return (
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `  🏢 *WAA'EE ARITII TECH*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `${aboutOr}\n\n` +
      `📍 *Bakka:* ${c.location || "Addis Ababa, Ethiopia"}\n` +
      `⏰ *Sa'aatii Hojii:* ${c.operatingHours || "Mon-Fri 8:30 AM - 5:30 PM EAT"}\n` +
      `💡 *Kaayyoo:* Yaada keessan gara furmaata teeknoolojii olaanaatti jijjiiruu.\n\n` +
      `✨ *Teeknoolojiiwwan:* Django, Node.js, React, Flutter, PostgreSQL, MongoDB & Cloud.`
    );
  }

  const aboutEn = c.about || "*Aritii Technologies PLC* delivers elite software engineering tailored to your business goals. We transform complex ideas into high-performing, scalable software solutions.";

  return (
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `  🏢 *ABOUT ARITII TECH*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `${aboutEn}\n\n` +
    `📍 *Headquarters:* ${c.location || "Addis Ababa, Ethiopia"}\n` +
    `⏰ *Operating Hours:* ${c.operatingHours || "Mon-Fri 8:30 AM - 5:30 PM EAT"}\n` +
    `💡 *Core Focus:* Full-Scale Web Applications, Mobile App Development, Telegram Bots, and System Architecture.\n\n` +
    `✨ *Tech Stack:* Django • Node.js • React • Flutter • PostgreSQL • MongoDB • Cloud Infrastructure.`
  );
}

function getAboutKeyboard(lang = "english") {
  const isOr = lang === "oromo";
  return {
    inline_keyboard: [
      [
        { text: isOr ? "💻 Tajaajila Software" : "💻 Software Services", callback_data: "view_services" },
        { text: isOr ? "📞 Nu Quunnamaa" : "📞 Contact Us", callback_data: "view_contact" },
      ],
      [
        { text: isOr ? "📝 Gatii Gaafadhu" : "📝 Request a Quote", callback_data: "start_quote" },
        { text: isOr ? "⬅️ Fuula Duraa" : "⬅️ Back to Main Menu", callback_data: "main_menu" },
      ],
    ],
  };
}

function getContactText(lang = "english") {
  const config = getConfig();
  const c = config.company || {};
  const isOr = lang === "oromo";

  if (isOr) {
    return (
      `━━━━━━━━━━━━━━━━━━━━━━\n` +
      `  📞 *NU QUUNNAMAA — ARITII TECH*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `Gatii pirojektii mari'achuuf ykn yaada qabdaniif bilisa ta'aatii nu quunnamaa! Mari'annee gatii isiniif ta'u irratti waliigalla:\n\n` +
      `📱 *Telegram:* ${c.telegram || "@Y13bel"}\n` +
      `✉️ *Email:* ${c.email || "contact@ariititech.com"}\n` +
      `📞 *Phone:* ${c.phone || "+251911000000"}\n` +
      `🌐 *Website:* ${c.website || "https://ariiti.com"}\n` +
      `📍 *Location:* ${c.location || "Addis Ababa, Ethiopia"}\n` +
      `⏰ *Operating Hours:* ${c.operatingHours || "Mon-Fri 8:30 AM - 5:30 PM EAT"}\n\n` +
      `_Kallattiin mari'achuuf ykn gatii tilmaamaa gaafachuuf filadhaa:_`
    );
  }

  return (
    `━━━━━━━━━━━━━━━━━━━━━━\n` +
    `  📞 *CONTACT US — ARITII TECH*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `Have a project in mind? Feel free to reach out to discuss your ideas openly and agree on a budget that fits your goals:\n\n` +
    `📱 *Telegram:* ${c.telegram || "@Y13bel"}\n` +
    `✉️ *Email:* ${c.email || "contact@ariititech.com"}\n` +
    `📞 *Phone:* ${c.phone || "+251911000000"}\n` +
    `🌐 *Website:* ${c.website || "https://ariiti.com"}\n` +
    `📍 *Headquarters:* ${c.location || "Addis Ababa, Ethiopia"}\n` +
    `⏰ *Operating Hours:* ${c.operatingHours || "Mon-Fri 8:30 AM - 5:30 PM EAT"}\n\n` +
    `_Feel free to message us on Telegram or start a project inquiry below:_`
  );
}

function getContactKeyboard(lang = "english") {
  const config = getConfig();
  const c = config.company || {};
  const isOr = lang === "oromo";
  const tgHandle = (c.telegram || "@Y13bel").replace(/^@/, "");
  const tgUrl = `https://t.me/${tgHandle}`;

  return {
    inline_keyboard: [
      [
        { text: `💬 Telegram: ${c.telegram || "@Y13bel"}`, url: tgUrl },
        { text: "🌐 Website", url: c.website || "https://ariiti.com" },
      ],
      [
        { text: isOr ? "📝 Gatii Gaafadhu" : "📝 Request a Quote", callback_data: "start_quote" },
        { text: isOr ? "⬅️ Fuula Duraa" : "⬅️ Back to Main Menu", callback_data: "main_menu" },
      ],
    ],
  };
}

function getQuoteWizardStep1Text(lang = "english") {
  const isOr = lang === "oromo";
  if (isOr) {
    return (
      `📝 *Interactive Project Quote Wizard (Tarkaanfii 1/4)*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `Gosa tajaajila software kam barbaaddu?\n` +
      `_(Web App, Mobile App, Telegram Bot, Custom System)_\n\n` +
      `Qabduuwwan armaan gadii filadhaa ykn kallattiin barreessaa:`
    );
  }
  return (
    `📝 *Interactive Project Quote Wizard (Step 1 of 4)*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `What type of software service do you need?\n` +
    `_(Web App, Mobile App, Telegram Bot, Custom System)_\n\n` +
    `Tap an option below or type your requirement:`
  );
}

function getQuoteWizardKeyboard(lang = "english") {
  const isOr = lang === "oromo";
  return {
    inline_keyboard: [
      [
        { text: "🌐 Web App", callback_data: "quote_service_web" },
        { text: "📱 Mobile App", callback_data: "quote_service_mobile" },
      ],
      [
        { text: "🤖 Telegram Bot", callback_data: "quote_service_bot" },
        { text: "⚙️ Custom System", callback_data: "quote_service_arch" },
      ],
      [
        { text: isOr ? "❌ Dhiisi (Cancel)" : "❌ Cancel Quote", callback_data: "quote_cancel" },
      ],
    ],
  };
}

async function safeEditOrSend(bot, chatId, messageId, text, replyMarkup, parseMode = "Markdown") {
  if (messageId) {
    try {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: parseMode,
        reply_markup: replyMarkup,
      });
      return true;
    } catch (err) {
      if (err.message && err.message.includes("message is not modified")) {
        return true;
      }
      logger.debug(`editMessageText fallback: ${err.message}`);
    }
  }

  try {
    await bot.sendMessage(chatId, text, {
      parse_mode: parseMode,
      reply_markup: replyMarkup,
    });
    return true;
  } catch (err2) {
    logger.error(`sendMessage failed in safeEditOrSend: ${err2.message}`);
    return false;
  }
}

module.exports = {
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
};
