const logger = require("../utils/logger");

let bot = null;

function init(botInstance) {
  bot = botInstance;
}

function isAdmin(userId) {
  return !!userId && parseInt(userId, 10) === parseInt(process.env.ADMIN_CHAT_ID, 10);
}

async function sendToAdmin(message, parseMode) {
  const adminId = process.env.ADMIN_CHAT_ID;
  if (!adminId || !bot) return;

  try {
    const opts = parseMode ? { parse_mode: parseMode } : {};
    await bot.sendMessage(parseInt(adminId, 10), message, opts);
  } catch (err) {
    logger.error(`Admin notification send error: ${err.message}`);
  }
}

async function notifyNewUser(userId, userName, username, language) {
  const msg =
    `🆕 *NEW USER JOINED*\n\n` +
    `👤 ID: \`${userId}\`\n` +
    `👤 Name: ${userName || "N/A"}\n` +
    `📛 Username: @${username || "N/A"}\n` +
    `🌐 Telegram Lang: ${language || "unknown"}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg, "Markdown");
}

async function notifyLanguageSelection(userId, userName, language) {
  const langDisplay = language === "oromo" ? "Afaan Oromoo 🇪🇹" : "English 🇺🇸";
  const msg =
    `🌐 *LANGUAGE SELECTED*\n\n` +
    `👤 ID: \`${userId}\`\n` +
    `👤 Name: ${userName || "N/A"}\n` +
    `🗣 Language: ${langDisplay}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg, "Markdown");
}

async function notifyUserAction(userId, userName, username, text, type, language) {
  const preview = text ? text.substring(0, 200) : "non-text action";
  const langDisplay = language || "unknown";

  const msg =
    `📡 *ACTION LOG*\n\n` +
    `👤 ID: \`${userId}\`\n` +
    `👤 Name: ${userName || "N/A"}\n` +
    `📛 Username: @${username || "N/A"}\n` +
    `💬 Message: "${preview}"\n` +
    `📍 Type: ${type}\n` +
    `🌐 Language: ${langDisplay}\n` +
    `⏰ Time: ${new Date().toLocaleString()}\n` +
    `━━━━━━━━━━━━━━`;
  await sendToAdmin(msg, "Markdown");
}

async function notifyCommand(userId, userName, username, command, args) {
  const msg =
    `⌨️ *COMMAND EXECUTED*\n\n` +
    `👤 ID: \`${userId}\`\n` +
    `👤 Name: ${userName || "N/A"}\n` +
    `📛 Username: @${username || "N/A"}\n` +
    `🔧 Command: ${command}\n` +
    `📝 Args: ${args || "none"}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg, "Markdown");
}

async function notifyError(source, userId, message) {
  const msg =
    `🚨 *ERROR*\n\n` +
    `📁 Source: ${source}\n` +
    `👤 User: \`${userId || "system"}\`\n` +
    `❌ Message: ${message || "unknown"}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg, "Markdown");
}

async function notifySecurity(userId, userName, reason) {
  const msg =
    `🔒 *SECURITY ALERT*\n\n` +
    `👤 ID: \`${userId}\`\n` +
    `👤 Name: ${userName || "N/A"}\n` +
    `⚠️ Reason: ${reason}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg, "Markdown");
}

async function notifySystem(event, details) {
  const msg =
    `⚙️ *SYSTEM EVENT*\n\n` +
    `📌 Event: ${event}\n` +
    `📋 Details: ${details || "N/A"}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg, "Markdown");
}

module.exports = {
  init,
  isAdmin,
  sendToAdmin,
  notifyNewUser,
  notifyLanguageSelection,
  notifyUserAction,
  notifyCommand,
  notifyError,
  notifySecurity,
  notifySystem,
};
