const logger = require("../utils/logger");
const { t, getLangCode } = require("../services/i18nService");
const { isAdmin } = require("../services/adminNotifier");
const { getRecentLogs, getLogsByCategory, getLogStats, clearLogs } = require("../services/actionLogService");
const { getStats: getTrackerStats, trackSystemEvent } = require("../services/eventTracker");
const { blockUser, unblockUser, isBlocked, getBlockedUsers, getBlockReason } = require("../services/blockService");
const { getAllUsers, getStats: getUserStatsData } = require("../services/userService");

async function handleAdminCommand(text, chatId, userId, bot, lang = "english") {
  if (!isAdmin(userId)) return false;

  const lc = getLangCode(lang);

  if (text === "/admin") {
    return showAdminDashboard(chatId, bot, lc);
  }

  if (text.startsWith("/logs")) {
    return showLogs(text, chatId, bot, lc);
  }

  if (text === "/users") {
    return showUsers(chatId, bot, lc);
  }

  if (text.startsWith("/block ")) {
    return handleBlock(text, chatId, userId, bot, lc);
  }

  if (text.startsWith("/unblock ")) {
    return handleUnblock(text, chatId, bot, lc);
  }

  if (text === "/blocked") {
    return showBlocked(chatId, bot, lc);
  }

  if (text === "/clearlogs") {
    clearLogs();
    await bot.sendMessage(chatId, "🗑️ Action logs cleared.");
    return true;
  }

  return false;
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
  const uptimeStr = `${hours}h ${mins}m ${secs}s`;

  const msg =
    `👑 *ADMIN DASHBOARD*\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `*📊 SYSTEM*\n` +
    `⏱ Uptime: ${uptimeStr}\n` +
    `💬 Messages: ${trackerStats.messageCount}\n` +
    `⌨️ Commands: ${trackerStats.commandCount}\n` +
    `🚨 Errors: ${trackerStats.errorCount}\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `*👥 USERS*\n` +
    `👤 Total: ${userCount}\n` +
    `🚫 Blocked: ${blockedCount}\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `*📋 LOGS*\n` +
    `📝 Total entries: ${logStats.total}\n` +
    `📂 Categories: ${Object.entries(logStats.categories).map(([k, v]) => `${k}=${v}`).join(", ")}\n\n` +
    `━━━━━━━━━━━━━━━━\n` +
    `*🔧 COMMANDS*\n` +
    `📋 /logs — View recent activity\n` +
    `📋 /logs errors — View errors only\n` +
    `📋 /logs security — View security events\n` +
    `👥 /users — List all users\n` +
    `🚫 /block <id> <reason> — Block user\n` +
    `✅ /unblock <id> — Unblock user\n` +
    `📋 /blocked — List blocked users\n` +
    `🗑️ /clearlogs — Clear all logs\n` +
    `━`;

  await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
  return true;
}

async function showLogs(text, chatId, bot, lc) {
  const parts = text.split(" ");
  let logs;

  if (parts.length > 1) {
    const filter = parts[1].toLowerCase();
    if (["user", "system", "error", "security"].includes(filter)) {
      logs = getLogsByCategory(filter, 20);
    } else {
      await bot.sendMessage(chatId, `❌ Unknown log category: ${filter}\nAvailable: user, system, error, security`);
      return true;
    }
  } else {
    logs = getRecentLogs(20);
  }

  if (logs.length === 0) {
    await bot.sendMessage(chatId, "📋 No log entries found.");
    return true;
  }

  const lines = logs.map((entry) => {
    const time = new Date(entry.timestamp).toLocaleTimeString();
    const user = entry.userName || entry.userId || "system";
    const text = entry.text || entry.message || entry.event || "";
    const icon =
      entry.category === "error" ? "🚨" :
      entry.category === "security" ? "🔒" :
      entry.category === "system" ? "⚙️" : "👤";
    return `${icon} [${time}] ${user}: ${text.substring(0, 80)}`;
  });

  const header =
    `📋 *RECENT LOGS*\n` +
    `━━━━━━━━━━━━━━\n`;
  const footer = `\n━━━━━━━━━━━━━━\nTotal shown: ${logs.length}`;

  const msg = header + lines.join("\n") + footer;

  if (msg.length > 4000) {
    const chunks = [];
    let current = header;
    for (const line of lines) {
      if (current.length + line.length + 50 > 4000) {
        chunks.push(current + "\n━━━━━━━━━━━━━━");
        current = header;
      }
      current += "\n" + line;
    }
    chunks.push(current + footer);
    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk, { parse_mode: "Markdown" });
    }
  } else {
    await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
  }

  return true;
}

async function showUsers(chatId, bot, lc) {
  const userList = getAllUsers();
  const usersData = getUserStatsData();

  if (userList.length === 0) {
    await bot.sendMessage(chatId, "👥 No users yet.");
    return true;
  }

  const lines = userList.map((u) => {
    const data = usersData[u.id];
    const msgCount = data?.messageCount || 0;
    const lang = data?.preferredLanguage || data?.language || "?";
    const blocked = isBlocked(u.id) ? "🚫" : "✅";
    return `${blocked} \`${u.id}\` — ${u.firstName || "N/A"} (@${u.username || "N/A"}) — ${msgCount} msgs — ${lang}`;
  });

  const header =
    `👥 *ALL USERS*\n` +
    `Total: ${userList.length}\n` +
    `━━━━━━━━━━━━━━\n`;

  const msg = header + lines.join("\n");

  if (msg.length > 4000) {
    const chunks = [];
    let current = header;
    for (const line of lines) {
      if (current.length + line.length + 20 > 4000) {
        chunks.push(current);
        current = header;
      }
      current += "\n" + line;
    }
    chunks.push(current);
    for (const chunk of chunks) {
      await bot.sendMessage(chatId, chunk, { parse_mode: "Markdown" });
    }
  } else {
    await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
  }

  return true;
}

async function handleBlock(text, chatId, adminUserId, bot, lc) {
  const parts = text.slice(7).trim().split(/ (.+)/);
  const targetId = parseInt(parts[0], 10);
  if (isNaN(targetId)) {
    await bot.sendMessage(chatId, "Usage: /block <userId> <reason>");
    return true;
  }

  if (isAdmin(targetId)) {
    await bot.sendMessage(chatId, "⛔ Cannot block the admin.");
    return true;
  }

  const reason = parts[1] || "No reason given";
  blockUser(targetId, reason, adminUserId);
  await bot.sendMessage(chatId, `🚫 User \`${targetId}\` blocked.\nReason: ${reason}`, { parse_mode: "Markdown" });
  trackSystemEvent("user_blocked", `User ${targetId} blocked by admin. Reason: ${reason}`);
  return true;
}

async function handleUnblock(text, chatId, bot, lc) {
  const targetId = parseInt(text.slice(9).trim(), 10);
  if (isNaN(targetId)) {
    await bot.sendMessage(chatId, "Usage: /unblock <userId>");
    return true;
  }

  const result = unblockUser(targetId);
  if (result) {
    await bot.sendMessage(chatId, `✅ User \`${targetId}\` unblocked.`, { parse_mode: "Markdown" });
    trackSystemEvent("user_unblocked", `User ${targetId} unblocked by admin.`);
  } else {
    await bot.sendMessage(chatId, `User \`${targetId}\` is not blocked.`, { parse_mode: "Markdown" });
  }
  return true;
}

async function showBlocked(chatId, bot, lc) {
  const blocked = getBlockedUsers();
  const ids = Object.keys(blocked);

  if (ids.length === 0) {
    await bot.sendMessage(chatId, "✅ No blocked users.");
    return true;
  }

  const lines = ids.map((id) => {
    const info = blocked[id];
    return `🚫 \`${id}\` — ${info.reason} (${new Date(info.blockedAt).toLocaleDateString()})`;
  });

  const msg =
    `🚫 *BLOCKED USERS*\n` +
    `Total: ${ids.length}\n` +
    `━━━━━━━━━━━━━━\n` +
    lines.join("\n");

  await bot.sendMessage(chatId, msg, { parse_mode: "Markdown" });
  return true;
}

module.exports = { handleAdminCommand };
