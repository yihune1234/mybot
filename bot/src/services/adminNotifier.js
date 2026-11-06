const logger = require("../utils/logger");
const { isAdmin, getAdminIds } = require("./rbacService");

let bot = null;

function init(botInstance) {
  bot = botInstance;
}

function esc(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

async function sendToAdmin(message) {
  if (!bot) return;
  const adminIds = getAdminIds();
  if (!adminIds || adminIds.length === 0) return;

  for (const adminId of adminIds) {
    try {
      await bot.sendMessage(Number(adminId), message, { parse_mode: "HTML" });
    } catch (err) {
      logger.debug(`Admin notification to ${adminId} skipped: ${err.message}`);
    }
  }
}

async function notifyNewUser(userId, userName, username, language) {
  const msg =
    `<b>🆕 NEW USER JOINED</b>\n\n` +
    `👤 ID: <code>${userId}</code>\n` +
    `👤 Name: ${esc(userName)}\n` +
    `📛 Username: @${esc(username)}\n` +
    `🌐 Telegram Lang: ${esc(language)}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg);
}

async function notifyLanguageSelection(userId, userName, language) {
  const langDisplay = language === "oromo" ? "Afaan Oromoo 🇪🇹" : "English 🇺🇸";
  const msg =
    `<b>🌐 LANGUAGE SELECTED</b>\n\n` +
    `👤 ID: <code>${userId}</code>\n` +
    `👤 Name: ${esc(userName)}\n` +
    `🗣 Language: ${langDisplay}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg);
}

async function notifyUserAction(userId, userName, username, text, type, language) {
  const preview = text ? esc(text).substring(0, 200) : "non-text action";
  const langDisplay = language || "unknown";

  const msg =
    `<b>📡 ACTION LOG</b>\n\n` +
    `👤 ID: <code>${userId}</code>\n` +
    `👤 Name: ${esc(userName)}\n` +
    `📛 Username: @${esc(username)}\n` +
    `💬 Message: "${preview}"\n` +
    `📍 Type: ${type}\n` +
    `🌐 Language: ${esc(langDisplay)}\n` +
    `⏰ Time: ${new Date().toLocaleString()}\n` +
    `━━━━━━━━━━━━━━`;
  await sendToAdmin(msg);
}

async function notifyCommand(userId, userName, username, command, args) {
  const msg =
    `<b>⌨️ COMMAND EXECUTED</b>\n\n` +
    `👤 ID: <code>${userId}</code>\n` +
    `👤 Name: ${esc(userName)}\n` +
    `📛 Username: @${esc(username)}\n` +
    `🔧 Command: ${command}\n` +
    `📝 Args: ${esc(args)}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg);
}

async function notifyError(source, userId, message) {
  const msg =
    `<b>🚨 ERROR</b>\n\n` +
    `📁 Source: ${source}\n` +
    `👤 User: <code>${userId || "system"}</code>\n` +
    `❌ Message: ${esc(message)}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg);
}

async function notifySecurity(userId, userName, reason) {
  const msg =
    `<b>🔒 SECURITY ALERT</b>\n\n` +
    `👤 ID: <code>${userId}</code>\n` +
    `👤 Name: ${esc(userName)}\n` +
    `⚠️ Reason: ${esc(reason)}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg);
}

async function notifyBotReply(userId, userName, userText, botReply) {
  const msg =
    `<b>💬 BOT REPLY</b>\n\n` +
    `👤 ID: <code>${userId}</code>\n` +
    `👤 Name: ${esc(userName)}\n` +
    `📝 User said: "${esc(userText).substring(0, 200)}"\n` +
    `🤖 Bot replied: "${esc(botReply).substring(0, 500)}"\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg);
}

async function notifySystem(event, details) {
  const msg =
    `<b>⚙️ SYSTEM EVENT</b>\n\n` +
    `📌 Event: ${event}\n` +
    `📋 Details: ${esc(details)}\n` +
    `⏰ Time: ${new Date().toLocaleString()}`;
  await sendToAdmin(msg);
}

async function notifyQuoteRequest(userId, userName, username, quote) {
  const msg =
    `<b>🌟 NEW ARITII TECH CLIENT INQUIRY</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Client:</b> ${esc(userName)} (@${esc(username || "none")})\n` +
    `🆔 <b>Telegram ID:</b> <code>${userId}</code>\n` +
    `💻 <b>Service:</b> ${esc(quote.service || "Unspecified")}\n` +
    `📋 <b>Project Goals:</b> ${esc(quote.description || "N/A")}\n` +
    `💰 <b>Timeline / Budget:</b> ${esc(quote.budget || "Flexible")}\n` +
    `📞 <b>Contact:</b> ${esc(quote.contact || "N/A")}\n` +
    `⏰ <b>Received:</b> ${new Date().toLocaleString()}`;
  await sendToAdmin(msg);
}

async function notifyAIHandledInquiry(userId, userName, username, question, answer, isHighValue) {
  const badge = isHighValue ? "🔥 HIGH-VALUE INQUIRY" : "💡 AI HANDLED INQUIRY";
  const userHandle = username ? `@${esc(username)}` : `<code>${userId}</code>`;
  const msg =
    `<b>${badge}</b>\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `👤 <b>Client:</b> ${esc(userName)} (${userHandle})\n` +
    `❓ <b>Question:</b> "${esc(question.substring(0, 250))}"\n` +
    `💬 <b>Assistant Reply:</b> "${esc(answer.substring(0, 300))}"\n` +
    `⏰ <b>Time:</b> ${new Date().toLocaleTimeString()}\n` +
    (isHighValue ? `<i>⚡ Jump in live if needed!</i>` : "");
  await sendToAdmin(msg);
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
  notifyQuoteRequest,
  notifyAIHandledInquiry,
};
