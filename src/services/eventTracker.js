const logger = require("../utils/logger");
const { logUserMessage, logSystemEvent, logError } = require("./actionLogService");
const {
  notifyNewUser,
  notifyLanguageSelection,
  notifyUserAction,
  notifyCommand,
  notifyError,
  notifySystem,
} = require("./adminNotifier");
const { isAdmin } = require("./adminNotifier");
const { isNewUser } = require("./userService");

let startupTime = Date.now();
let messageCount = 0;
let commandCount = 0;
let errorCount = 0;

function trackMessage(msg, language) {
  const userId = msg.from?.id;
  const userName = msg.from?.first_name || "unknown";
  const username = msg.from?.username || "";
  const text = msg.text || "non-text";
  const isCmd = text.startsWith("/");

  messageCount++;
  const type = isCmd ? "command" : "message";

  logUserMessage(userId, userName, username, text, type, language);

  if (isNewUser(userId)) {
    notifyNewUser(userId, userName, username, msg.from?.language_code);
  }

  if (isCmd) {
    commandCount++;
    const parts = text.split(" ");
    notifyCommand(userId, userName, username, parts[0], parts.slice(1).join(" ") || "none");
  }

  if (!isAdmin(userId)) {
    notifyUserAction(userId, userName, username, text, type, language);
  }
}

function trackLanguageSelection(userId, userName, language) {
  notifyLanguageSelection(userId, userName, language);
}

function trackBotReply(userId, userName, userText, botReply) {
  notifyBotReply(userId, userName, userText, botReply);
}

function trackError(source, userId, errMessage) {
  errorCount++;
  logError(source, errMessage, null);
  notifyError(source, userId, errMessage);
}

function trackSystemEvent(event, details) {
  logSystemEvent(event, details);
  notifySystem(event, details);
}

function getStats() {
  const uptime = Math.floor((Date.now() - startupTime) / 1000);
  return {
    uptime,
    messageCount,
    commandCount,
    errorCount,
    startupTime: new Date(startupTime).toISOString(),
  };
}

module.exports = {
  trackMessage,
  trackLanguageSelection,
  trackBotReply,
  trackError,
  trackSystemEvent,
  getStats,
};
