const logger = require("../utils/logger");
const { isAdmin, getAdminIds } = require("../services/rbacService");
const {
  getConfig,
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
} = require("../services/businessConfigService");
const {
  getAllServices,
  getActiveServices,
  getServiceById,
  toggleServiceStatus,
  updateServicePrice,
  deleteService,
} = require("../services/serviceCatalogService");
const {
  getAllProducts,
  getActiveProducts,
  getProductById,
  toggleProductStatus,
  deleteProduct,
} = require("../services/productCatalogService");
const {
  getAllPortfolio,
  getActivePortfolio,
  getPortfolioById,
  togglePortfolioStatus,
  deletePortfolioProject,
} = require("../services/portfolioService");
const { getAllLeads, getLeadSummary } = require("../services/leadService");
const { getCurrentMode, changeMode, getModeDisplay } = require("../services/aiModeService");
const { getAllUsers } = require("../services/userService");
const { getRecentLogs, logAction, clearLogs } = require("../services/actionLogService");
const { isConnected: isDbConnected } = require("../utils/db");
const { MODE_RULE_BASED, MODE_HYBRID, MODE_AI_ENHANCED } = require("../utils/constants");

// ----------------------------------------------------
// 1. MAIN ADMIN DASHBOARD
// ----------------------------------------------------
async function showAdminPanel(chatId, bot, messageId = null) {
  const config = getConfig();
  const c = config.company || {};
  const services = getAllServices();
  const activeServices = getActiveServices();
  const products = getAllProducts();
  const portfolio = getAllPortfolio();
  const leadSummary = getLeadSummary();
  const userCount = getAllUsers().length;
  const currentMode = getCurrentMode();
  const dbStatus = isDbConnected() ? "🟢 MongoDB Connected" : "📁 Local JSON (Resilient)";

  const text =
    `<b>🏢 ARIITI TECH — BUSINESS ADMIN DASHBOARD</b>\n\n` +
    `🏢 <b>Company:</b> ${c.name || "Ariiti Tech"}\n` +
    `💡 <b>Brand Message:</b> <i>"${c.brandMessage || "Building digital solutions for better businesses."}"</i>\n` +
    `⚡ <b>Operating Mode:</b> ${getModeDisplay(currentMode)}\n` +
    `💾 <b>Database:</b> ${dbStatus}\n\n` +
    `<b>📊 BUSINESS METRICS</b>\n` +
    `• <b>Services:</b> ${activeServices.length} Active / ${services.length} Total\n` +
    `• <b>Products:</b> ${products.length} Products\n` +
    `• <b>Portfolio:</b> ${portfolio.length} Projects\n` +
    `• <b>Customer Leads:</b> ${leadSummary.total} (🆕 New: ${leadSummary.new}, 🤝 Won: ${leadSummary.won})\n` +
    `• <b>Registered Users:</b> ${userCount}\n` +
    `• <b>Admin Accounts:</b> ${getAdminIds().length}\n\n` +
    `<i>Select an administrative management module:</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🛠 Manage Services", callback_data: "admin_nav_services" },
        { text: "📦 Manage Products", callback_data: "admin_nav_products" },
      ],
      [
        { text: "🚀 Manage Portfolio", callback_data: "admin_nav_portfolio" },
        { text: "📈 Customer Leads & CRM", callback_data: "admin_nav_leads" },
      ],
      [
        { text: "🏢 Business Profile & Contacts", callback_data: "admin_nav_profile" },
        { text: "👋 Welcome Messages", callback_data: "admin_nav_welcome" },
      ],
      [
        { text: "🎛 Menu Visibility", callback_data: "admin_nav_menu" },
        { text: "⚡ Operating Mode", callback_data: "admin_nav_mode" },
      ],
      [
        { text: "👥 Admins", callback_data: "admin_nav_admins" },
        { text: "📜 Audit Logs", callback_data: "admin_nav_logs" },
      ],
      [
        { text: "🔄 Refresh Dashboard", callback_data: "admin_nav_main" },
      ],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// ----------------------------------------------------
// 2. SERVICES MANAGEMENT
// ----------------------------------------------------
async function showServicesMenu(chatId, bot, messageId = null) {
  const services = getAllServices();

  let text =
    `<b>🛠 SERVICES MANAGEMENT</b>\n\n` +
    `Total Services: ${services.length}\n` +
    `Tap any service to toggle active status, adjust price, or delete:\n\n`;

  const rows = [];
  for (const s of services) {
    const statusIcon = s.isActive ? "✅" : "⏸";
    text += `${statusIcon} <b>${s.name}</b> ($${s.startingPrice})\n   📁 ${s.category}\n\n`;
    rows.push([
      {
        text: `${statusIcon} ${s.name} ($${s.startingPrice})`,
        callback_data: `admin_srv_detail_${s.id}`,
      },
    ]);
  }

  rows.push([
    { text: "➕ Add New Service", callback_data: "admin_srv_add_prompt" },
  ]);
  rows.push([
    { text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" },
  ]);

  await renderMessage(bot, chatId, messageId, text, { inline_keyboard: rows });
}

async function showServiceDetail(chatId, bot, serviceId, messageId = null) {
  const s = getServiceById(serviceId);
  if (!s) return showServicesMenu(chatId, bot, messageId);

  const statusText = s.isActive ? "✅ ACTIVE (Visible to customers)" : "⏸ PAUSED (Hidden from customers)";
  const toggleBtnText = s.isActive ? "⏸ Pause Service" : "▶️ Activate Service";

  const text =
    `<b>🛠 SERVICE DETAILS: ${s.name}</b>\n\n` +
    `📌 <b>ID:</b> <code>${s.id}</code>\n` +
    `📁 <b>Category:</b> ${s.category}\n` +
    `📊 <b>Status:</b> ${statusText}\n` +
    `💰 <b>Starting Price:</b> $${s.startingPrice} ${s.currency} (${s.pricingModel || "milestone"})\n` +
    `⏱ <b>Estimated Timeline:</b> ${s.estimatedDays || 14} days\n\n` +
    `📝 <b>Description:</b>\n${s.description}\n\n` +
    `✨ <b>Features:</b>\n${(s.features || []).map((f) => `• ${f}`).join("\n")}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: toggleBtnText, callback_data: `admin_srv_toggle_${s.id}` },
        { text: "💵 Price +/-", callback_data: `admin_srv_price_${s.id}` },
      ],
      [
        { text: "🗑 Delete Service", callback_data: `admin_srv_del_${s.id}` },
      ],
      [
        { text: "🔙 Back to Services", callback_data: "admin_nav_services" },
        { text: "🏠 Dashboard", callback_data: "admin_nav_main" },
      ],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

async function showPriceModifier(chatId, bot, serviceId, messageId = null) {
  const s = getServiceById(serviceId);
  if (!s) return showServicesMenu(chatId, bot, messageId);

  const text =
    `<b>💵 ADJUST STARTING PRICE: ${s.name}</b>\n\n` +
    `Current Price: <b>$${s.startingPrice} ${s.currency}</b>\n\n` +
    `Tap an increment or decrement:`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "-$100", callback_data: `admin_srv_adj_${s.id}_-100` },
        { text: "-$50", callback_data: `admin_srv_adj_${s.id}_-50` },
        { text: "+$50", callback_data: `admin_srv_adj_${s.id}_50` },
        { text: "+$100", callback_data: `admin_srv_adj_${s.id}_100` },
      ],
      [
        { text: "🔙 Back to Service", callback_data: `admin_srv_detail_${s.id}` },
      ],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// ----------------------------------------------------
// 3. PRODUCTS MANAGEMENT
// ----------------------------------------------------
async function showProductsMenu(chatId, bot, messageId = null) {
  const products = getAllProducts();

  let text =
    `<b>📦 PRODUCTS MANAGEMENT</b>\n\n` +
    `Total Products: ${products.length}\n` +
    `Tap any product to view details, toggle status, or delete:\n\n`;

  const rows = [];
  for (const p of products) {
    const statusIcon = p.isActive ? "✅" : "⏸";
    text += `${statusIcon} <b>${p.name}</b> (${p.category})\n   🏷 ${p.pricing}\n\n`;
    rows.push([
      {
        text: `${statusIcon} ${p.name}`,
        callback_data: `admin_prod_detail_${p.id}`,
      },
    ]);
  }

  rows.push([
    { text: "➕ Add New Product", callback_data: "admin_prod_add_prompt" },
  ]);
  rows.push([
    { text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" },
  ]);

  await renderMessage(bot, chatId, messageId, text, { inline_keyboard: rows });
}

async function showProductDetail(chatId, bot, productId, messageId = null) {
  const p = getProductById(productId);
  if (!p) return showProductsMenu(chatId, bot, messageId);

  const statusText = p.isActive ? "✅ ACTIVE (Visible to customers)" : "⏸ PAUSED (Hidden from customers)";
  const toggleBtnText = p.isActive ? "⏸ Pause Product" : "▶️ Activate Product";

  const text =
    `<b>📦 PRODUCT DETAILS: ${p.name}</b>\n\n` +
    `📌 <b>ID:</b> <code>${p.id}</code>\n` +
    `📁 <b>Category:</b> ${p.category}\n` +
    `📊 <b>Status:</b> ${statusText}\n` +
    `🏷 <b>Pricing:</b> ${p.pricing}\n` +
    `🌐 <b>Demo URL:</b> ${p.demoUrl || "None"}\n\n` +
    `📝 <b>Description:</b>\n${p.description}\n\n` +
    `✨ <b>Key Features:</b>\n${(p.features || []).map((f) => `• ${f}`).join("\n")}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: toggleBtnText, callback_data: `admin_prod_toggle_${p.id}` },
        { text: "🗑 Delete Product", callback_data: `admin_prod_del_${p.id}` },
      ],
      [
        { text: "🔙 Back to Products", callback_data: "admin_nav_products" },
        { text: "🏠 Dashboard", callback_data: "admin_nav_main" },
      ],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// ----------------------------------------------------
// 4. PORTFOLIO MANAGEMENT
// ----------------------------------------------------
async function showPortfolioMenu(chatId, bot, messageId = null) {
  const portfolio = getAllPortfolio();

  let text =
    `<b>🚀 PORTFOLIO MANAGEMENT</b>\n\n` +
    `Total Showcase Projects: ${portfolio.length}\n` +
    `Tap any project to view or manage:\n\n`;

  const rows = [];
  for (const item of portfolio) {
    const statusIcon = item.isActive ? "✅" : "⏸";
    text += `${statusIcon} <b>${item.title}</b>\n   📁 ${item.category} | Tech: \`${item.techStack}\`\n\n`;
    rows.push([
      {
        text: `${statusIcon} ${item.title.substring(0, 32)}...`,
        callback_data: `admin_port_detail_${item.id}`,
      },
    ]);
  }

  rows.push([
    { text: "➕ Add Portfolio Project", callback_data: "admin_port_add_prompt" },
  ]);
  rows.push([
    { text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" },
  ]);

  await renderMessage(bot, chatId, messageId, text, { inline_keyboard: rows });
}

async function showPortfolioDetail(chatId, bot, portfolioId, messageId = null) {
  const item = getPortfolioById(portfolioId);
  if (!item) return showPortfolioMenu(chatId, bot, messageId);

  const statusText = item.isActive ? "✅ ACTIVE (Visible)" : "⏸ PAUSED (Hidden)";
  const toggleBtnText = item.isActive ? "⏸ Pause Project" : "▶️ Activate Project";

  const text =
    `<b>🚀 PORTFOLIO DETAILS: ${item.title}</b>\n\n` +
    `📌 <b>ID:</b> <code>${item.id}</code>\n` +
    `📁 <b>Category:</b> ${item.category}\n` +
    `📊 <b>Status:</b> ${statusText}\n` +
    `🛠 <b>Tech Stack:</b> \`${item.techStack}\`\n` +
    `🌐 <b>Live URL:</b> ${item.liveUrl || "None"}\n` +
    `💻 <b>GitHub:</b> ${item.githubUrl || "None"}\n\n` +
    `📝 <b>Description:</b>\n${item.description}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: toggleBtnText, callback_data: `admin_port_toggle_${item.id}` },
        { text: "🗑 Delete Project", callback_data: `admin_port_del_${item.id}` },
      ],
      [
        { text: "🔙 Back to Portfolio", callback_data: "admin_nav_portfolio" },
        { text: "🏠 Dashboard", callback_data: "admin_nav_main" },
      ],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// ----------------------------------------------------
// 5. WELCOME MESSAGES MANAGEMENT
// ----------------------------------------------------
async function showWelcomeMenu(chatId, bot, messageId = null) {
  const en = getWelcomeMessage("english");
  const om = getWelcomeMessage("oromo");
  const am = getWelcomeMessage("amharic");

  const text =
    `<b>👋 CUSTOMER WELCOME MESSAGES</b>\n\n` +
    `<b>🇺🇸 English Welcome:</b>\n<i>${en.substring(0, 140)}...</i>\n\n` +
    `<b>🇪🇹 Afaan Oromoo Welcome:</b>\n<i>${om.substring(0, 140)}...</i>\n\n` +
    `<b>🇪🇹 Amharic Welcome:</b>\n<i>${am.substring(0, 140)}...</i>\n\n` +
    `<i>Tap a button below to update any language greeting:</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "✏️ Edit English Welcome", callback_data: "admin_edit_welcome_en" },
      ],
      [
        { text: "✏️ Edit Oromo Welcome", callback_data: "admin_edit_welcome_om" },
      ],
      [
        { text: "✏️ Edit Amharic Welcome", callback_data: "admin_edit_welcome_am" },
      ],
      [
        { text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" },
      ],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// ----------------------------------------------------
// 6. MENU VISIBILITY MANAGEMENT
// ----------------------------------------------------
async function showMenuVisibilityMenu(chatId, bot, messageId = null) {
  const vis = getMenuVisibility();

  const text =
    `<b>🎛 CUSTOMER MAIN MENU VISIBILITY</b>\n\n` +
    `Tap any section to toggle customer visibility on or off:\n\n` +
    `• Our Services: ${vis.services !== false ? "✅ Visible" : "⏸ Hidden"}\n` +
    `• Our Products: ${vis.products !== false ? "✅ Visible" : "⏸ Hidden"}\n` +
    `• Our Portfolio: ${vis.portfolio !== false ? "✅ Visible" : "⏸ Hidden"}\n` +
    `• About Ariiti Tech: ${vis.about !== false ? "✅ Visible" : "⏸ Hidden"}\n` +
    `• Request a Service: ${vis.request_service !== false ? "✅ Visible" : "⏸ Hidden"}\n` +
    `• Contact Us: ${vis.contact !== false ? "✅ Visible" : "⏸ Hidden"}\n` +
    `• Follow Channels: ${vis.channels !== false ? "✅ Visible" : "⏸ Hidden"}\n` +
    `• Language Settings: ${vis.languages !== false ? "✅ Visible" : "⏸ Hidden"}\n` +
    `• Media Verification: ${vis.verify_media !== false ? "✅ Visible" : "⏸ Hidden"}\n`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: `${vis.services !== false ? "✅" : "⏸"} Services`, callback_data: "admin_toggle_menu_services" },
        { text: `${vis.products !== false ? "✅" : "⏸"} Products`, callback_data: "admin_toggle_menu_products" },
      ],
      [
        { text: `${vis.portfolio !== false ? "✅" : "⏸"} Portfolio`, callback_data: "admin_toggle_menu_portfolio" },
        { text: `${vis.about !== false ? "✅" : "⏸"} About`, callback_data: "admin_toggle_menu_about" },
      ],
      [
        { text: `${vis.request_service !== false ? "✅" : "⏸"} Request Srv`, callback_data: "admin_toggle_menu_request_service" },
        { text: `${vis.contact !== false ? "✅" : "⏸"} Contact`, callback_data: "admin_toggle_menu_contact" },
      ],
      [
        { text: `${vis.channels !== false ? "✅" : "⏸"} Channels`, callback_data: "admin_toggle_menu_channels" },
        { text: `${vis.languages !== false ? "✅" : "⏸"} Languages`, callback_data: "admin_toggle_menu_languages" },
      ],
      [
        { text: `${vis.verify_media !== false ? "✅" : "⏸"} Media Verification (C2PA)`, callback_data: "admin_toggle_menu_verify_media" },
      ],
      [
        { text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" },
      ],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// ----------------------------------------------------
// 7. BUSINESS PROFILE & CONTACTS MANAGEMENT
// ----------------------------------------------------
async function showProfileMenu(chatId, bot, messageId = null) {
  const config = getConfig();
  const c = config.company || {};
  const dbStatus = isDbConnected() ? "🟢 Synced with MongoDB Atlas" : "📁 Local JSON (Resilient)";
  const socials = getSocialLinks();
  const channels = getChannelLinks();

  const text =
    `<b>🏢 BUSINESS PROFILE & CONTACT CHANNELS</b>\n\n` +
    `💾 <b>Database:</b> ${dbStatus}\n\n` +
    `🏷 <b>Company:</b> ${c.name} (${c.legalName})\n` +
    `💡 <b>Brand Message:</b> ${c.brandMessage || c.tagline}\n` +
    `📌 <b>Positioning:</b> ${c.positioning}\n` +
    `📍 <b>Location:</b> ${c.location}\n` +
    `⏰ <b>Operating Hours:</b> ${c.operatingHours}\n` +
    `✉️ <b>Email:</b> ${c.email}\n` +
    `📞 <b>Phone:</b> ${c.phone}\n` +
    `📱 <b>Telegram:</b> ${c.telegramContact || c.telegram}\n` +
    `🌐 <b>Website:</b> ${c.website}\n\n` +
    `<b>Social Links (${socials.length}):</b>\n${socials.map((s) => `• ${s.name}: ${s.url}`).join("\n") || "None"}\n\n` +
    `<b>Channel Links (${channels.length}):</b>\n${channels.map((ch) => `• ${ch.name}: ${ch.url}`).join("\n") || "None"}\n\n` +
    `<i>Tap a button below to update any business detail:</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "📞 Edit Phone", callback_data: "admin_edit_phone" },
        { text: "✉️ Edit Email", callback_data: "admin_edit_email" },
      ],
      [
        { text: "📱 Edit Telegram", callback_data: "admin_edit_telegram" },
        { text: "📍 Edit Location", callback_data: "admin_edit_location" },
      ],
      [
        { text: "⏰ Edit Hours", callback_data: "admin_edit_hours" },
        { text: "📝 Edit About Bio", callback_data: "admin_edit_about" },
      ],
      [
        { text: "🔗 Add Social Link", callback_data: "admin_add_social_prompt" },
        { text: "📢 Add Channel Link", callback_data: "admin_add_channel_prompt" },
      ],
      [{ text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" }],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// ----------------------------------------------------
// 8. LEADS & CRM PIPELINE VIEW
// ----------------------------------------------------
async function showLeadsMenu(chatId, bot, messageId = null) {
  const leads = getAllLeads();
  const summary = getLeadSummary();

  let text =
    `<b>📈 CLIENT LEADS & CRM PIPELINE</b>\n\n` +
    `📊 <b>Pipeline Summary:</b>\n` +
    `• 🆕 New: ${summary.new}\n` +
    `• 📞 Contacted: ${summary.contacted}\n` +
    `• 🎯 Qualified: ${summary.qualified}\n` +
    `• 📝 Proposal: ${summary.proposal}\n` +
    `• 🏆 Won: ${summary.won}\n\n` +
    `<b>Recent Customer Inquiries:</b>\n`;

  if (leads.length === 0) {
    text += `<i>No client inquiries submitted yet.</i>\n`;
  } else {
    const recent = leads.slice(0, 6);
    for (const l of recent) {
      const timeStr = new Date(l.createdAt).toLocaleDateString();
      text +=
        `\n• <b>${l.customerName}</b> (<code>${l.telegramId}</code>)\n` +
        `  🛠 ${l.serviceType} | 💰 ${l.budgetTimeline}\n` +
        `  📞 ${l.contactInfo} | 🏷 [${(l.status || "NEW").toUpperCase()}] (${timeStr})\n`;
    }
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔄 Refresh Leads", callback_data: "admin_nav_leads" }],
      [{ text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" }],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// ----------------------------------------------------
// 9. OPERATING MODE SELECTOR
// ----------------------------------------------------
async function showModeSelector(chatId, bot, messageId = null) {
  const current = getCurrentMode();

  const text =
    `<b>⚡ ARIITI TECH OPERATING MODE</b>\n\n` +
    `Current Mode: <b>${getModeDisplay(current)}</b>\n\n` +
    `<b>Available Modes:</b>\n\n` +
    `🟢 <b>Mode A (Rule-Based Only):</b>\n` +
    `Zero external API dependencies. 100% fast, private, and offline resilient using local NLU & rule engine.\n\n` +
    `🟡 <b>Mode B (Hybrid - Recommended):</b>\n` +
    `Attempts optional AI enhancement for conversational flexibility, and automatically falls back to local NLU on any timeout, error, or quota limit.\n\n` +
    `🟣 <b>Mode C (AI-Enhanced):</b>\n` +
    `Prioritizes advanced generative responses when AI providers are configured.\n\n` +
    `<i>Tap a button below to switch operating mode instantly:</i>`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🟢 Mode A (Rule-Based Only)", callback_data: `admin_set_mode_${MODE_RULE_BASED}` }],
      [{ text: "🟡 Mode B (Hybrid)", callback_data: `admin_set_mode_${MODE_HYBRID}` }],
      [{ text: "🟣 Mode C (AI-Enhanced)", callback_data: `admin_set_mode_${MODE_AI_ENHANCED}` }],
      [{ text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" }],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// ----------------------------------------------------
// 10. ADMIN ACCOUNTS & LOGS
// ----------------------------------------------------
async function showAdminsMenu(chatId, bot, messageId = null) {
  const adminIds = getAdminIds();

  let text =
    `<b>👥 ADMINISTRATOR ACCOUNTS</b>\n\n` +
    `Only authorized administrators can access this menu and configure services.\n\n` +
    `<b>Authorized Admins:</b>\n`;

  for (const id of adminIds) {
    const isPrimary = String(id) === "7458921957" ? " (Primary Owner)" : "";
    text += `• <code>${id}</code>${isPrimary}\n`;
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" }],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

async function showLogsMenu(chatId, bot, messageId = null) {
  const logs = getRecentLogs(10);

  let text = `<b>📜 RECENT SECURITY & AUDIT LOGS</b>\n\n`;

  if (logs.length === 0) {
    text += `<i>No recent activity logs recorded.</i>\n`;
  } else {
    for (const entry of logs) {
      const time = new Date(entry.timestamp).toLocaleTimeString();
      const user = entry.userName || entry.userId || "System";
      const cat = entry.category ? `[${entry.category.toUpperCase()}]` : "";
      const msg = entry.text || entry.message || entry.event || "";
      text += `• ${cat} <b>${time}</b> (${user}): ${msg.substring(0, 50)}\n`;
    }
  }

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🔄 Refresh Logs", callback_data: "admin_nav_logs" },
        { text: "🗑 Clear Logs", callback_data: "admin_clear_logs_confirm" },
      ],
      [{ text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" }],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// ----------------------------------------------------
// ROUTING ADMIN CALLBACKS
// ----------------------------------------------------
async function handleAdminCallback(action, callbackQuery, bot) {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const userId = callbackQuery.from?.id;

  if (!isAdmin(userId)) {
    await bot.answerCallbackQuery(callbackQuery.id, { text: "⛔ Access Denied: Admin authorization required.", show_alert: true });
    return true;
  }

  // Navigation
  if (action === "admin_nav_main") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showAdminPanel(chatId, bot, messageId);
    return true;
  }
  if (action === "admin_nav_services") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showServicesMenu(chatId, bot, messageId);
    return true;
  }
  if (action === "admin_nav_products") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showProductsMenu(chatId, bot, messageId);
    return true;
  }
  if (action === "admin_nav_portfolio") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showPortfolioMenu(chatId, bot, messageId);
    return true;
  }
  if (action === "admin_nav_welcome") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showWelcomeMenu(chatId, bot, messageId);
    return true;
  }
  if (action === "admin_nav_menu") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showMenuVisibilityMenu(chatId, bot, messageId);
    return true;
  }
  if (action === "admin_nav_profile") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showProfileMenu(chatId, bot, messageId);
    return true;
  }
  if (action === "admin_nav_leads") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showLeadsMenu(chatId, bot, messageId);
    return true;
  }
  if (action === "admin_nav_mode") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showModeSelector(chatId, bot, messageId);
    return true;
  }
  if (action === "admin_nav_admins") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showAdminsMenu(chatId, bot, messageId);
    return true;
  }
  if (action === "admin_nav_logs") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showLogsMenu(chatId, bot, messageId);
    return true;
  }

  // Services actions
  if (action.startsWith("admin_srv_detail_")) {
    const id = action.replace("admin_srv_detail_", "");
    await bot.answerCallbackQuery(callbackQuery.id);
    await showServiceDetail(chatId, bot, id, messageId);
    return true;
  }
  if (action.startsWith("admin_srv_toggle_")) {
    const id = action.replace("admin_srv_toggle_", "");
    const updated = toggleServiceStatus(id);
    const word = updated?.isActive ? "activated" : "paused";
    logAction("security", `Service ${id} ${word} by Admin ${userId}`, { userId });
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Service ${word} successfully!` });
    await showServiceDetail(chatId, bot, id, messageId);
    return true;
  }
  if (action.startsWith("admin_srv_del_")) {
    const id = action.replace("admin_srv_del_", "");
    deleteService(id);
    logAction("security", `Service ${id} deleted by Admin ${userId}`, { userId });
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Service deleted successfully!" });
    await showServicesMenu(chatId, bot, messageId);
    return true;
  }
  if (action.startsWith("admin_srv_price_")) {
    const id = action.replace("admin_srv_price_", "");
    await bot.answerCallbackQuery(callbackQuery.id);
    await showPriceModifier(chatId, bot, id, messageId);
    return true;
  }
  if (action.startsWith("admin_srv_adj_")) {
    const parts = action.replace("admin_srv_adj_", "").split("_");
    const id = parts[0];
    const delta = parseFloat(parts[1]) || 0;
    const s = getServiceById(id);
    if (s) {
      const newPrice = Math.max(0, s.startingPrice + delta);
      updateServicePrice(id, newPrice);
      logAction("security", `Service ${id} price updated to $${newPrice} by Admin ${userId}`, { userId });
      await bot.answerCallbackQuery(callbackQuery.id, { text: `Price set to $${newPrice}` });
      await showServiceDetail(chatId, bot, id, messageId);
    }
    return true;
  }
  if (action === "admin_srv_add_prompt") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_ADD_SERVICE", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const text =
      `➕ <b>ADD NEW SERVICE</b>\n\n` +
      `Please send service details in the following format:\n\n` +
      `<code>Name | Category | Starting Price | Description</code>\n\n` +
      `<i>Example:</i>\n<code>Custom CRM System | Business Automation | 1200 | Tailored CRM platform for client pipeline management</code>`;
    const kb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_services" }]] };
    await renderMessage(bot, chatId, messageId, text, kb);
    return true;
  }

  // Products actions
  if (action.startsWith("admin_prod_detail_")) {
    const id = action.replace("admin_prod_detail_", "");
    await bot.answerCallbackQuery(callbackQuery.id);
    await showProductDetail(chatId, bot, id, messageId);
    return true;
  }
  if (action.startsWith("admin_prod_toggle_")) {
    const id = action.replace("admin_prod_toggle_", "");
    const updated = toggleProductStatus(id);
    const word = updated?.isActive ? "activated" : "paused";
    logAction("security", `Product ${id} ${word} by Admin ${userId}`, { userId });
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Product ${word} successfully!` });
    await showProductDetail(chatId, bot, id, messageId);
    return true;
  }
  if (action.startsWith("admin_prod_del_")) {
    const id = action.replace("admin_prod_del_", "");
    deleteProduct(id);
    logAction("security", `Product ${id} deleted by Admin ${userId}`, { userId });
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Product deleted successfully!" });
    await showProductsMenu(chatId, bot, messageId);
    return true;
  }
  if (action === "admin_prod_add_prompt") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_ADD_PRODUCT", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const text =
      `➕ <b>ADD NEW PRODUCT</b>\n\n` +
      `Please send product details in the following format:\n\n` +
      `<code>Name | Category | Pricing | Description</code>\n\n` +
      `<i>Example:</i>\n<code>Ariiti Billing Engine | Business Automation | Starting from $400 | Automated invoicing and client accounting software</code>`;
    const kb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_products" }]] };
    await renderMessage(bot, chatId, messageId, text, kb);
    return true;
  }

  // Portfolio actions
  if (action.startsWith("admin_port_detail_")) {
    const id = action.replace("admin_port_detail_", "");
    await bot.answerCallbackQuery(callbackQuery.id);
    await showPortfolioDetail(chatId, bot, id, messageId);
    return true;
  }
  if (action.startsWith("admin_port_toggle_")) {
    const id = action.replace("admin_port_toggle_", "");
    const updated = togglePortfolioStatus(id);
    const word = updated?.isActive ? "activated" : "paused";
    logAction("security", `Portfolio project ${id} ${word} by Admin ${userId}`, { userId });
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Project ${word}!` });
    await showPortfolioDetail(chatId, bot, id, messageId);
    return true;
  }
  if (action.startsWith("admin_port_del_")) {
    const id = action.replace("admin_port_del_", "");
    deletePortfolioProject(id);
    logAction("security", `Portfolio project ${id} deleted by Admin ${userId}`, { userId });
    await bot.answerCallbackQuery(callbackQuery.id, { text: "Portfolio project deleted!" });
    await showPortfolioMenu(chatId, bot, messageId);
    return true;
  }
  if (action === "admin_port_add_prompt") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_ADD_PORTFOLIO", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const text =
      `➕ <b>ADD PORTFOLIO PROJECT</b>\n\n` +
      `Please send project details in the following format:\n\n` +
      `<code>Title | Category | Tech Stack | Description</code>\n\n` +
      `<i>Example:</i>\n<code>Healthcare Patient Portal | Web & Cloud | React, Node.js, MongoDB | Secure clinic appointment and record system</code>`;
    const kb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_portfolio" }]] };
    await renderMessage(bot, chatId, messageId, text, kb);
    return true;
  }

  // Welcome Messages actions
  if (action === "admin_edit_welcome_en") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_WELCOME", { targetLang: "english" });
    await bot.answerCallbackQuery(callbackQuery.id);
    const kb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_welcome" }]] };
    await renderMessage(bot, chatId, messageId, "🇺🇸 <b>Please type the new English Welcome Message in chat:</b>", kb);
    return true;
  }
  if (action === "admin_edit_welcome_om") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_WELCOME", { targetLang: "oromo" });
    await bot.answerCallbackQuery(callbackQuery.id);
    const kb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_welcome" }]] };
    await renderMessage(bot, chatId, messageId, "🇪🇹 <b>Please type the new Afaan Oromoo Welcome Message in chat:</b>", kb);
    return true;
  }
  if (action === "admin_edit_welcome_am") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_WELCOME", { targetLang: "amharic" });
    await bot.answerCallbackQuery(callbackQuery.id);
    const kb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_welcome" }]] };
    await renderMessage(bot, chatId, messageId, "🇪🇹 <b>Please type the new Amharic Welcome Message in chat:</b>", kb);
    return true;
  }

  // Menu Visibility actions
  if (action.startsWith("admin_toggle_menu_")) {
    const section = action.replace("admin_toggle_menu_", "");
    const newState = toggleMenuSection(section);
    logAction("security", `Menu section '${section}' toggled to ${newState ? "Visible" : "Hidden"} by Admin ${userId}`, { userId });
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Section '${section}' is now ${newState ? "Visible" : "Hidden"}!` });
    await showMenuVisibilityMenu(chatId, bot, messageId);
    return true;
  }

  // Profile contacts actions
  if (action === "admin_edit_phone") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_PHONE", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "📞 <b>Please type the new Business Phone Number:</b>", cancelKb);
    return true;
  }
  if (action === "admin_edit_email") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_EMAIL", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "✉️ <b>Please type the new Business Email address:</b>", cancelKb);
    return true;
  }
  if (action === "admin_edit_telegram") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_TELEGRAM", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "📱 <b>Please type the new Telegram contact handle:</b>", cancelKb);
    return true;
  }
  if (action === "admin_edit_location") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_LOCATION", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "📍 <b>Please type the new Headquarters Location:</b>", cancelKb);
    return true;
  }
  if (action === "admin_edit_hours") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_HOURS", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "⏰ <b>Please type the new Operating Hours:</b>", cancelKb);
    return true;
  }
  if (action === "admin_edit_about") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_ABOUT", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "📝 <b>Please type the new About Bio for Ariiti Tech:</b>", cancelKb);
    return true;
  }
  if (action === "admin_add_social_prompt") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_ADD_SOCIAL", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "🔗 <b>Please send social link in format:</b> <code>Name | URL</code> (e.g. <code>LinkedIn | https://linkedin.com/...</code>)", cancelKb);
    return true;
  }
  if (action === "admin_add_channel_prompt") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_ADD_CHANNEL", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "📢 <b>Please send channel link in format:</b> <code>Channel Name | Telegram URL</code> (e.g. <code>Ariiti News | https://t.me/AriitiNews</code>)", cancelKb);
    return true;
  }

  // Operating Mode
  if (action.startsWith("admin_set_mode_")) {
    const newMode = action.replace("admin_set_mode_", "");
    changeMode(newMode);
    logAction("security", `Operating mode changed to ${newMode} by Admin ${userId}`, { userId });
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Mode updated to ${newMode}!`, show_alert: true });
    await showModeSelector(chatId, bot, messageId);
    return true;
  }

  // Clear Logs
  if (action === "admin_clear_logs_confirm") {
    await bot.answerCallbackQuery(callbackQuery.id);
    const text =
      `<b>⚠️ CONFIRM CLEARING LOGS</b>\n\n` +
      `Are you sure you want to permanently clear all stored action and security logs?`;
    const kb = {
      inline_keyboard: [
        [
          { text: "🗑 Yes, Clear All Logs", callback_data: "admin_clear_logs_execute" },
          { text: "❌ Cancel", callback_data: "admin_nav_logs" },
        ],
      ],
    };
    await renderMessage(bot, chatId, messageId, text, kb);
    return true;
  }
  if (action === "admin_clear_logs_execute") {
    clearLogs();
    logAction({ category: "security", message: `Logs cleared via Telegram Admin UI by Admin ${userId}`, userId });
    await bot.answerCallbackQuery(callbackQuery.id, { text: "✅ Logs cleared successfully!", show_alert: true });
    await showLogsMenu(chatId, bot, messageId);
    return true;
  }

  return false;
}

async function renderMessage(bot, chatId, messageId, text, keyboard) {
  try {
    if (messageId) {
      await bot.editMessageText(text, {
        chat_id: chatId,
        message_id: messageId,
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } else {
      await bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    }
  } catch (err) {
    if (err.message && err.message.includes("message is not modified")) {
      return;
    }
    try {
      await bot.sendMessage(chatId, text, {
        parse_mode: "HTML",
        reply_markup: keyboard,
      });
    } catch (e2) {
      logger.error(`Failed to send admin message: ${e2.message}`);
    }
  }
}

module.exports = {
  showAdminPanel,
  showServicesMenu,
  showServiceDetail,
  showProductsMenu,
  showProductDetail,
  showPortfolioMenu,
  showPortfolioDetail,
  showWelcomeMenu,
  showMenuVisibilityMenu,
  showProfileMenu,
  showLeadsMenu,
  showModeSelector,
  showAdminsMenu,
  showLogsMenu,
  handleAdminCallback,
};
