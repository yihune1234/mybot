const logger = require("../utils/logger");
const { isAdmin, getAdminIds } = require("../services/rbacService");
const { getConfig, updateCompanyProfile } = require("../services/businessConfigService");
const { getAllServices, getActiveServices, getServiceById, toggleServiceStatus, updateServicePrice } = require("../services/serviceCatalogService");
const { getAllLeads, getLeadSummary } = require("../services/leadService");
const { getCurrentMode, changeMode, getModeDisplay } = require("../services/aiModeService");
const { getAllUsers } = require("../services/userService");
const { getRecentLogs, logAction, clearLogs } = require("../services/actionLogService");
const { isConnected: isDbConnected } = require("../utils/db");
const { MODE_RULE_BASED, MODE_HYBRID, MODE_AI_ENHANCED } = require("../utils/constants");

// Main Admin Dashboard
async function showAdminPanel(chatId, bot, messageId = null) {
  const config = getConfig();
  const services = getAllServices();
  const activeServices = getActiveServices();
  const leadSummary = getLeadSummary();
  const userCount = getAllUsers().length;
  const currentMode = getCurrentMode();
  const dbStatus = isDbConnected() ? "🟢 MongoDB Connected" : "📁 Local JSON (Resilient)";

  const text =
    `<b>🏢 ARIITI TECH — BUSINESS ADMIN DASHBOARD</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `🏢 <b>Company:</b> ${config.company.name}\n` +
    `⚡ <b>Operating Mode:</b> ${getModeDisplay(currentMode)}\n` +
    `💾 <b>Database:</b> ${dbStatus}\n\n` +
    `<b>📊 BUSINESS METRICS</b>\n` +
    `• <b>Active Services:</b> ${activeServices.length} / ${services.length}\n` +
    `• <b>Total Leads:</b> ${leadSummary.total} (🆕 New: ${leadSummary.new}, 🤝 Won: ${leadSummary.won})\n` +
    `• <b>Registered Users:</b> ${userCount}\n` +
    `• <b>Admins:</b> ${getAdminIds().length}\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `<i>Select an administrative module below:</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🛠 Services & Pricing", callback_data: "admin_nav_services" },
        { text: "📈 Leads & CRM", callback_data: "admin_nav_leads" },
      ],
      [
        { text: "⚡ Operating Mode", callback_data: "admin_nav_mode" },
        { text: "🏢 Business Profile", callback_data: "admin_nav_profile" },
      ],
      [
        { text: "👥 Admin Accounts", callback_data: "admin_nav_admins" },
        { text: "📜 Security & Logs", callback_data: "admin_nav_logs" },
      ],
      [
        { text: "🔄 Refresh Dashboard", callback_data: "admin_nav_main" },
      ],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// Services Management View
async function showServicesMenu(chatId, bot, messageId = null) {
  const services = getAllServices();

  let text =
    `<b>🛠 SERVICES & PRICING MANAGEMENT</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Select a service below to edit its status or starting price:\n\n`;

  const rows = [];
  for (const s of services) {
    const statusIcon = s.isActive ? "✅" : "⏸";
    text += `${statusIcon} <b>${s.name}</b>\n   💰 From $${s.startingPrice} ${s.currency} | ${s.category}\n\n`;
    rows.push([
      {
        text: `${statusIcon} ${s.name} ($${s.startingPrice})`,
        callback_data: `admin_srv_detail_${s.id}`,
      },
    ]);
  }

  rows.push([{ text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" }]);

  await renderMessage(bot, chatId, messageId, text, { inline_keyboard: rows });
}

// Service Detail View
async function showServiceDetail(chatId, bot, serviceId, messageId = null) {
  const s = getServiceById(serviceId);
  if (!s) {
    return showServicesMenu(chatId, bot, messageId);
  }

  const statusText = s.isActive ? "✅ ACTIVE (Visible to customers)" : "⏸ PAUSED (Hidden from customers)";
  const toggleBtnText = s.isActive ? "⏸ Pause Service" : "▶️ Activate Service";

  const text =
    `<b>🛠 SERVICE DETAILS: ${s.name}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📌 <b>ID:</b> <code>${s.id}</code>\n` +
    `📁 <b>Category:</b> ${s.category}\n` +
    `📊 <b>Status:</b> ${statusText}\n` +
    `💰 <b>Starting Price:</b> $${s.startingPrice} ${s.currency} (${s.pricingModel})\n` +
    `⏱ <b>Estimated Delivery:</b> ${s.estimatedDays} days\n\n` +
    `📝 <b>Description:</b>\n${s.description}\n\n` +
    `✨ <b>Key Features:</b>\n${(s.features || []).map((f) => `• ${f}`).join("\n")}`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: toggleBtnText, callback_data: `admin_srv_toggle_${s.id}` },
        { text: "💵 Quick Price +/-", callback_data: `admin_srv_price_${s.id}` },
      ],
      [
        { text: "🔙 Back to Services", callback_data: "admin_nav_services" },
        { text: "🏠 Dashboard", callback_data: "admin_nav_main" },
      ],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// Quick Price Modifier View
async function showPriceModifier(chatId, bot, serviceId, messageId = null) {
  const s = getServiceById(serviceId);
  if (!s) return showServicesMenu(chatId, bot, messageId);

  const text =
    `<b>💵 ADJUST STARTING PRICE: ${s.name}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Current Price: <b>$${s.startingPrice} ${s.currency}</b>\n\n` +
    `Choose a quick increment or decrement:`;

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

// Operating Mode Selector View
async function showModeSelector(chatId, bot, messageId = null) {
  const current = getCurrentMode();

  const text =
    `<b>⚡ ARIITI TECH OPERATING MODE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
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
      [{ text: "🟢 Switch to Mode A (Rule-Based Only)", callback_data: `admin_set_mode_${MODE_RULE_BASED}` }],
      [{ text: "🟡 Switch to Mode B (Hybrid)", callback_data: `admin_set_mode_${MODE_HYBRID}` }],
      [{ text: "🟣 Switch to Mode C (AI-Enhanced)", callback_data: `admin_set_mode_${MODE_AI_ENHANCED}` }],
      [{ text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" }],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// Leads & CRM Pipeline View
async function showLeadsMenu(chatId, bot, messageId = null) {
  const leads = getAllLeads();
  const summary = getLeadSummary();

  let text =
    `<b>📈 CLIENT LEADS & CRM PIPELINE</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📊 <b>Pipeline Summary:</b>\n` +
    `• 🆕 New: ${summary.new}\n` +
    `• 📞 Contacted: ${summary.contacted}\n` +
    `• 🎯 Qualified: ${summary.qualified}\n` +
    `• 📝 Proposal: ${summary.proposal}\n` +
    `• 🏆 Won: ${summary.won}\n\n` +
    `<b>Recent Client Inquiries:</b>\n`;

  if (leads.length === 0) {
    text += `<i>No client inquiries submitted yet.</i>\n`;
  } else {
    const recent = leads.slice(0, 5);
    for (const l of recent) {
      const timeStr = new Date(l.createdAt).toLocaleDateString();
      text +=
        `\n• <b>${l.customerName}</b> (<code>${l.telegramId}</code>)\n` +
        `  🛠 ${l.serviceType} | 💰 ${l.budgetTimeline}\n` +
        `  📞 ${l.contactInfo} | 🏷 [${l.status.toUpperCase()}] (${timeStr})\n`;
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

// Business Profile & Contact Settings View
async function showProfileMenu(chatId, bot, messageId = null) {
  const config = getConfig();
  const c = config.company;
  const dbStatus = isDbConnected() ? "🟢 Synced with MongoDB Atlas" : "📁 Local JSON (Resilient)";

  const text =
    `<b>🏢 BUSINESS PROFILE & CONTACT CHANNELS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `💾 <b>Database Status:</b> ${dbStatus}\n\n` +
    `🏷 <b>Company:</b> ${c.name} (${c.legalName})\n` +
    `💡 <b>Tagline:</b> ${c.tagline}\n` +
    `📍 <b>Location:</b> ${c.location}\n` +
    `⏰ <b>Operating Hours:</b> ${c.operatingHours}\n` +
    `✉️ <b>Email:</b> ${c.email}\n` +
    `📞 <b>Phone:</b> ${c.phone}\n` +
    `📱 <b>Telegram:</b> ${c.telegram}\n` +
    `🌐 <b>Website:</b> ${c.website}\n\n` +
    `<i>Tap a button below to update any contact channel directly in the database:</i>`;

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
      ],
      [{ text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" }],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// Admin Accounts View
async function showAdminsMenu(chatId, bot, messageId = null) {
  const adminIds = getAdminIds();

  let text =
    `<b>👥 ADMINISTRATOR ACCOUNTS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Only authorized administrators can access this menu and configure services.\n\n` +
    `<b>Configured Admins:</b>\n`;

  for (const id of adminIds) {
    const isPrimary = String(id) === "7458921957" ? " (Primary)" : "";
    text += `• <code>${id}</code>${isPrimary}\n`;
  }

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔙 Back to Dashboard", callback_data: "admin_nav_main" }],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// Security & Logs View
async function showLogsMenu(chatId, bot, messageId = null) {
  const logs = getRecentLogs(10);

  let text =
    `<b>📜 RECENT SECURITY & AUDIT LOGS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n`;

  if (logs.length === 0) {
    text += `<i>No recent activity logs recorded (Log is clean).</i>\n`;
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

// Clear Logs Confirmation View
async function showClearLogsConfirm(chatId, bot, messageId = null) {
  const text =
    `<b>⚠️ CONFIRM CLEARING LOGS</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `Are you sure you want to permanently delete all message, user activity, and security audit logs?\n\n` +
    `<i>This action will clear all stored action entries immediately.</i>`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: "🗑 Yes, Clear All Logs", callback_data: "admin_clear_logs_execute" },
        { text: "❌ Cancel", callback_data: "admin_nav_logs" },
      ],
    ],
  };

  await renderMessage(bot, chatId, messageId, text, keyboard);
}

// Handle Admin Callback Routing
async function handleAdminCallback(action, callbackQuery, bot) {
  const chatId = callbackQuery.message?.chat?.id;
  const messageId = callbackQuery.message?.message_id;
  const userId = callbackQuery.from?.id;

  if (!isAdmin(userId)) {
    await bot.answerCallbackQuery(callbackQuery.id, { text: "⛔ Access Denied.", show_alert: true });
    return true;
  }

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

  if (action.startsWith("admin_srv_detail_")) {
    const serviceId = action.replace("admin_srv_detail_", "");
    await bot.answerCallbackQuery(callbackQuery.id);
    await showServiceDetail(chatId, bot, serviceId, messageId);
    return true;
  }

  if (action.startsWith("admin_srv_toggle_")) {
    const serviceId = action.replace("admin_srv_toggle_", "");
    const updated = toggleServiceStatus(serviceId);
    const statusWord = updated?.isActive ? "activated" : "paused";
    logAction("security", `Service ${serviceId} ${statusWord} by Admin ${userId}`, { userId });
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Service ${statusWord} successfully!` });
    await showServiceDetail(chatId, bot, serviceId, messageId);
    return true;
  }

  if (action.startsWith("admin_srv_price_")) {
    const serviceId = action.replace("admin_srv_price_", "");
    await bot.answerCallbackQuery(callbackQuery.id);
    await showPriceModifier(chatId, bot, serviceId, messageId);
    return true;
  }

  if (action.startsWith("admin_srv_adj_")) {
    const parts = action.replace("admin_srv_adj_", "").split("_");
    const serviceId = parts[0];
    const delta = parseFloat(parts[1]) || 0;
    const s = getServiceById(serviceId);
    if (s) {
      const newPrice = Math.max(0, s.startingPrice + delta);
      updateServicePrice(serviceId, newPrice);
      logAction("security", `Service ${serviceId} price adjusted to $${newPrice} by Admin ${userId}`, { userId });
      await bot.answerCallbackQuery(callbackQuery.id, { text: `Price updated to $${newPrice}` });
      await showServiceDetail(chatId, bot, serviceId, messageId);
    }
    return true;
  }

  if (action === "admin_nav_mode") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showModeSelector(chatId, bot, messageId);
    return true;
  }

  if (action.startsWith("admin_set_mode_")) {
    const newMode = action.replace("admin_set_mode_", "");
    changeMode(newMode);
    logAction("security", `Operating mode switched to ${newMode} by Admin ${userId}`, { userId });
    await bot.answerCallbackQuery(callbackQuery.id, { text: `Mode updated to ${newMode}!`, show_alert: true });
    await showModeSelector(chatId, bot, messageId);
    return true;
  }

  if (action === "admin_nav_leads") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showLeadsMenu(chatId, bot, messageId);
    return true;
  }

  if (action === "admin_nav_profile") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showProfileMenu(chatId, bot, messageId);
    return true;
  }

  if (action === "admin_edit_phone") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_PHONE", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "📞 <b>Please type the new Business Phone Number in chat</b>\n<i>(e.g. +251 911 000000)</i>:", cancelKb);
    return true;
  }

  if (action === "admin_edit_email") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_EMAIL", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "✉️ <b>Please type the new Business Email address in chat</b>\n<i>(e.g. contact@ariititech.com)</i>:", cancelKb);
    return true;
  }

  if (action === "admin_edit_telegram") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_TELEGRAM", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "📱 <b>Please type the new Telegram handle or channel in chat</b>\n<i>(e.g. @AriitiTech or @Y13bel)</i>:", cancelKb);
    return true;
  }

  if (action === "admin_edit_location") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_LOCATION", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "📍 <b>Please type the new Business Location in chat</b>\n<i>(e.g. Addis Ababa, Ethiopia)</i>:", cancelKb);
    return true;
  }

  if (action === "admin_edit_hours") {
    const { setUserState } = require("../services/memoryService");
    setUserState(userId, "STATE_ADMIN_EDIT_HOURS", {});
    await bot.answerCallbackQuery(callbackQuery.id);
    const cancelKb = { inline_keyboard: [[{ text: "❌ Cancel", callback_data: "admin_nav_profile" }]] };
    await renderMessage(bot, chatId, messageId, "⏰ <b>Please type the new Operating Hours in chat</b>\n<i>(e.g. Mon-Fri 8:30 AM - 5:30 PM EAT)</i>:", cancelKb);
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

  if (action === "admin_clear_logs_confirm") {
    await bot.answerCallbackQuery(callbackQuery.id);
    await showClearLogsConfirm(chatId, bot, messageId);
    return true;
  }

  if (action === "admin_clear_logs_execute") {
    clearLogs();
    logAction({
      category: "security",
      message: `Logs cleared via Telegram Admin UI by Admin ${userId}`,
      userId,
    });
    await bot.answerCallbackQuery(callbackQuery.id, {
      text: "✅ All message and action logs have been cleared!",
      show_alert: true,
    });
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
  showModeSelector,
  showLeadsMenu,
  showProfileMenu,
  showAdminsMenu,
  showLogsMenu,
  handleAdminCallback,
};
