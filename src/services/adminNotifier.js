const logger = require("../utils/logger");

let bot = null;

function init(botInstance) {
  bot = botInstance;
}

function isAdmin(userId) {
  return !!userId && parseInt(userId, 10) === parseInt(process.env.ADMIN_CHAT_ID, 10);
}

function esc(text) {
  return String(text).replace(/_/g, "\\_").replace(/\*/g, "\\*").replace(/`/g, "\\`").replace(/\[/g, "\\[").replace(/~/g, "\\~");
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
    `👤 Name: ${esc(userName)}\n` +
    `📛 Username: @${esc(username)}\n` +
    `🌐 Telegram Lang: ${esc(language)}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg, "Markdown");
}

async function notifyLanguageSelection(userId, userName, language) {
  const langDisplay = language === "oromo" ? "Afaan Oromoo 🇪🇹" : "English 🇺🇸";
  const msg =
    `🌐 *LANGUAGE SELECTED*\n\n` +
    `👤 ID: \`${userId}\`\n` +
    `👤 Name: ${esc(userName)}\n` +
    `🗣 Language: ${langDisplay}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg, "Markdown");
}

async function notifyUserAction(userId, userName, username, text, type, language) {
  const preview = text ? esc(text).substring(0, 200) : "non-text action";
  const langDisplay = language || "unknown";

  const msg =
    `📡 *ACTION LOG*\n\n` +
    `👤 ID: \`${userId}\`\n` +
    `👤 Name: ${esc(userName)}\n` +
    `📛 Username: @${esc(username)}\n` +
    `💬 Message: "${preview}"\n` +
    `📍 Type: ${type}\n` +
    `🌐 Language: ${esc(langDisplay)}\n` +
    `⏰ Time: ${new Date().toLocaleString()}\n` +
    `━━━━━━━━━━━━━━`;
  await sendToAdmin(msg, "Markdown");
}

async function notifyCommand(userId, userName, username, command, args) {
  const msg =
    `⌨️ *COMMAND EXECUTED*\n\n` +
    `👤 ID: \`${userId}\`\n` +
    `👤 Name: ${esc(userName)}\n` +
    `📛 Username: @${esc(username)}\n` +
    `🔧 Command: ${command}\n` +
    `📝 Args: ${esc(args)}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg, "Markdown");
}

async function notifyError(source, userId, message) {
  const msg =
    `🚨 *ERROR*\n\n` +
    `📁 Source: ${source}\n` +
    `👤 User: \`${userId || "system"}\`\n` +
    `❌ Message: ${esc(message)}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg, "Markdown");
}

async function notifySecurity(userId, userName, reason) {
  const msg =
    `🔒 *SECURITY ALERT*\n\n` +
    `👤 ID: \`${userId}\`\n` +
    `👤 Name: ${esc(userName)}\n` +
    `⚠️ Reason: ${esc(reason)}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg, "Markdown");
}

async function notifyBotReply(userId, userName, userText, botReply) {
  const msg =
    `💬 *BOT REPLY*\n\n` +
    `👤 ID: \`${userId}\`\n` +
    `👤 Name: ${esc(userName)}\n` +
    `📝 User said: "${esc(userText).substring(0, 200)}"\n` +
    `🤖 Bot replied: "${esc(botReply).substring(0, 500)}"\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg, "Markdown");
}

async function notifySystem(event, details) {
  const msg =
    `⚙️ *SYSTEM EVENT*\n\n` +
    `📌 Event: ${event}\n` +
    `📋 Details: ${esc(details)}\n` +
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
  notifyBotReply,
  notifyError,
  notifySecurity,
  notifySystem,
};
