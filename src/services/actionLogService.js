const { loadJSON, saveJSON } = require("../utils/dataStore");
const logger = require("../utils/logger");
const path = require("path");

const LOG_DIR = path.resolve(__dirname, "..", "..", "data");
const LOG_FILE = path.join(LOG_DIR, "actionLog.json");
const MAX_LOG_ENTRIES = 500;

let actionLog = loadJSON(LOG_FILE, []);

function logAction(entry) {
  const logEntry = {
    id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    timestamp: new Date().toISOString(),
    ...entry,
  };

  actionLog.push(logEntry);
  if (actionLog.length > MAX_LOG_ENTRIES) {
    actionLog = actionLog.slice(-MAX_LOG_ENTRIES);
  }
  saveJSON(LOG_FILE, actionLog);
  return logEntry;
}

function logUserMessage(userId, userName, username, text, type, language, details) {
  return logAction({
    category: "user",
    userId,
    userName,
    username,
    text,
    type,
    language,
    details,
  });
}

function logSystemEvent(event, message, details) {
  return logAction({
    category: "system",
    event,
    message,
    details,
  });
}

function logError(source, message, stack, details) {
  return logAction({
    category: "error",
    source,
    message,
    stack,
    details,
  });
}

function logSecurity(event, userId, userName, reason, details) {
  return logAction({
    category: "security",
    event,
    userId,
    userName,
    reason,
    details,
  });
}

function getRecentLogs(count = 100) {
  return actionLog.slice(-count).reverse();
}

function getLogsByCategory(category, count = 50) {
  return actionLog.filter((e) => e.category === category).slice(-count).reverse();
}

function getLogsByUser(userId, count = 50) {
  return actionLog.filter((e) => e.userId === userId).slice(-count).reverse();
}

function clearLogs() {
  actionLog = [];
  saveJSON(LOG_FILE, actionLog);
}

function getLogStats() {
  const total = actionLog.length;
  const categories = {};
  for (const entry of actionLog) {
    categories[entry.category] = (categories[entry.category] || 0) + 1;
  }
  return { total, categories };
}

module.exports = {
  logAction,
  logUserMessage,
  logSystemEvent,
  logError,
  logSecurity,
  getRecentLogs,
  getLogsByCategory,
  getLogsByUser,
  clearLogs,
  getLogStats,
};
