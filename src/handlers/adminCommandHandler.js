const logger = require("../utils/logger");
const { t, getLangCode } = require("../services/i18nService");
const { isAdmin } = require("../services/rbacService");
const { showAdminPanel } = require("./businessAdminHandler");
const { getRecentLogs, getLogsByCategory, getLogStats, clearLogs, logAction } = require("../services/actionLogService");
const { getStats: getTrackerStats, trackSystemEvent } = require("../services/eventTracker");
const { blockUser, unblockUser, isBlocked, getBlockedUsers, getBlockReason } = require("../services/blockService");
const { getAllUsers, getStats: getUserStatsData } = require("../services/userService");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");

async function handleAdminCommand(text, chatId, userId, bot, lang) {
  if (!isAdmin(userId)) return false;
  const lc = getLangCode(lang || "english");

  if (text === "/admin") {
    await showAdminPanel(chatId, bot);
    return true;
  }
  if (text === "/logs" || text.startsWith("/logs ")) return showLogs(text, chatId, bot, lc);
  if (text === "/users") return showUsers(chatId, bot, lc);
  if (text.startsWith("/block ")) return handleBlock(text, chatId, userId, bot, lc);
  if (text.startsWith("/unblock ")) return handleUnblock(text, chatId, bot, lc);
  if (text === "/blocked") return showBlocked(chatId, bot, lc);
  if (text === "/clearlogs") {
    clearLogs();
    logAction({ category: "security", message: `Logs cleared via /clearlogs by Admin ${userId}`, userId });
    await bot.sendMessage(chatId, "✅ *Action and message logs have been cleared successfully.*", { parse_mode: "Markdown" });
    return true;
  }
  if (text === "/sys_info") return showSysInfo(chatId, bot, lc);
  if (text === "/bot_restart") return restartBot(chatId, bot, lc);
  return false;
}

async function send(chatId, bot, text) {
  try {
    await bot.sendMessage(chatId, text, { parse_mode: "Markdown" });
  } catch (e) {
    try { await bot.sendMessage(chatId, text); } catch (e2) {}
  }
}

async function showAdminDashboard(chatId, bot, lc) {
  const trackerStats = getTrackerStats();
  const logStats = getLogStats();
  const userCount = getAllUsers().length;
  const blockedCount = Object.keys(getBlockedUsers()).length;
  const uptime = trackerStats.uptime;
  const hours = Math.floor(uptime / 3600);
  const mins = Math.floor((uptime % 3600) / 60);
  const secs = uptime % 60;
  const msg = "*ADMIN DASHBOARD*\n\n*SYSTEM*\nUptime: " + hours + "h " + mins + "m " + secs + "s\nMessages: " + trackerStats.messageCount + "\nCommands: " + trackerStats.commandCount + "\nErrors: " + trackerStats.errorCount + "\n\n*USERS*\nTotal: " + userCount + "\nBlocked: " + blockedCount + "\n\n*COMMANDS*\n/logs - Recent activity\n/logs errors - Errors\n/users - List users\n/block <id> <reason> - Block\n/unblock <id> - Unblock\n/blocked - Blocked users\n/clearlogs - Clear logs\n/sys_info - System info\n/bot_restart - Restart bot";
  await send(chatId, bot, msg);
  return true;
}

async function showLogs(text, chatId, bot, lc) {
  const parts = text.split(" ");
  let logs;
  if (parts.length > 1 && parts[1]) {
    const filter = parts[1].toLowerCase();
    if (["user", "system", "error", "security"].includes(filter)) {
      logs = getLogsByCategory(filter, 20);
    } else {
      await send(chatId, bot, "Unknown log category: " + filter + "\nAvailable: user, system, error, security");
      return true;
    }
  } else {
    logs = getRecentLogs(20);
  }
  if (logs.length === 0) { await send(chatId, bot, "No log entries found."); return true; }
  let msg = "*RECENT LOGS*\n";
  for (const entry of logs) {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const user = entry.userName || entry.userId || "system";
    const entryText = entry.text || entry.message || entry.event || "";
    const icon = entry.category === "error" ? "X" : entry.category === "security" ? "L" : entry.category === "system" ? "S" : "U";
    msg += icon + " [" + time + "] " + user + ": " + entryText.substring(0, 80) + "\n";
    if (msg.length > 3900) { msg += "... (truncated)"; break; }
  }
  await send(chatId, bot, msg);
  return true;
}

async function showUsers(chatId, bot, lc) {
  const userList = getAllUsers();
  if (userList.length === 0) { await send(chatId, bot, "No users yet."); return true; }
  let msg = "*ALL USERS*\nTotal: " + userList.length + "\n\n";
  for (const u of userList) {
    const blocked = isBlocked(u.id) ? "BLOCKED" : "OK";
    msg += "[" + blocked + "] " + u.id + " - " + (u.firstName || "N/A") + "\n";
    if (msg.length > 3900) { msg += "... (truncated)"; break; }
  }
  await send(chatId, bot, msg);
  return true;
}

async function handleBlock(text, chatId, adminUserId, bot, lc) {
  const parts = text.slice(7).trim().split(/ (.+)/);
  const targetId = parseInt(parts[0], 10);
  if (isNaN(targetId)) { await send(chatId, bot, "Usage: /block <userId> <reason>"); return true; }
  if (isAdmin(targetId)) { await send(chatId, bot, "Cannot block the admin."); return true; }
  const reason = parts[1] || "No reason given";
  blockUser(targetId, reason, adminUserId);
  await send(chatId, bot, "User " + targetId + " blocked.\nReason: " + reason);
  trackSystemEvent("user_blocked", "User " + targetId + " blocked by admin. Reason: " + reason);
  return true;
}

async function handleUnblock(text, chatId, bot, lc) {
  const targetId = parseInt(text.slice(9).trim(), 10);
  if (isNaN(targetId)) { await send(chatId, bot, "Usage: /unblock <userId>"); return true; }
  const result = unblockUser(targetId);
  await send(chatId, bot, result ? "User " + targetId + " unblocked." : "User " + targetId + " is not blocked.");
  if (result) trackSystemEvent("user_unblocked", "User " + targetId + " unblocked by admin.");
  return true;
}

async function showBlocked(chatId, bot, lc) {
  const blocked = getBlockedUsers();
  const ids = Object.keys(blocked);
  if (ids.length === 0) { await send(chatId, bot, "No blocked users."); return true; }
  let msg = "*BLOCKED USERS*\nTotal: " + ids.length + "\n\n";
  for (const id of ids) {
    msg += id + " - " + blocked[id].reason + "\n";
    if (msg.length > 3900) break;
  }
  await send(chatId, bot, msg);
  return true;
}

async function showSysInfo(chatId, bot, lc) {
  let msg = "*SYSTEM INFORMATION*\n\n";
  try {
    const os = require("os");
    msg += "OS: " + os.type() + " " + os.release() + "\n";
    msg += "Hostname: " + os.hostname() + "\n";
    msg += "CPU: " + os.cpus().length + " cores\n";
    msg += "RAM: " + (os.totalmem() / 1024 / 1024 / 1024).toFixed(1) + "GB total\n";
    msg += "Free RAM: " + (os.freemem() / 1024 / 1024 / 1024).toFixed(1) + "GB free\n\n";
  } catch (e) { msg += "OS Info: " + e.message + "\n\n"; }
  msg += "Node.js: " + process.execPath + "\n";
  msg += "Node version: " + process.version + "\n";
  msg += "Process PID: " + process.pid + "\n";
  msg += "CWD: " + process.cwd() + "\n";
  const rootDir = path.resolve(__dirname, "..", "..");
  try {
    const pkg = require(path.join(rootDir, "package.json"));
    msg += "Bot version: " + (pkg.version || "N/A") + "\n";
  } catch (e) {}
  if (msg.length > 3900) msg = msg.substring(0, 3900) + "\n...";
  await send(chatId, bot, msg);
  return true;
}

async function restartBot(chatId, bot, lc) {
  await send(chatId, bot, "Restarting bot process...");
  trackSystemEvent("bot_restart", "Bot restart initiated by admin");
  logger.info("Bot restart initiated by admin. Exiting for nodemon to respawn...");
  setTimeout(function() { process.exit(0); }, 1000);
  return true;
}

module.exports = { handleAdminCommand };