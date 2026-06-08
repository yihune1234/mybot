const logger = require("../utils/logger");
const { t, getLangCode } = require("../services/i18nService");
const { isAdmin } = require("../services/adminNotifier");
const { getRecentLogs, getLogsByCategory, getLogStats, clearLogs } = require("../services/actionLogService");
const { getStats: getTrackerStats, trackSystemEvent } = require("../services/eventTracker");
const { blockUser, unblockUser, isBlocked, getBlockedUsers, getBlockReason } = require("../services/blockService");
const { getAllUsers, getStats: getUserStatsData } = require("../services/userService");
const { execSync } = require("child_process");
const path = require("path");
const fs = require("fs");
const {
  getAIStatus,
  getAIModels,
  setModel,
  getModel,
  restartAIServer,
  startAIServer,
  stopAIServer,
} = require("../services/aiService");

async function handleAdminCommand(text, chatId, userId, bot, lang) {
  if (!isAdmin(userId)) return false;
  const lc = getLangCode(lang || "english");

  if (text === "/admin") return showAdminDashboard(chatId, bot, lc);
  if (text === "/logs" || text.startsWith("/logs ")) return showLogs(text, chatId, bot, lc);
  if (text === "/users") return showUsers(chatId, bot, lc);
  if (text.startsWith("/block ")) return handleBlock(text, chatId, userId, bot, lc);
  if (text.startsWith("/unblock ")) return handleUnblock(text, chatId, bot, lc);
  if (text === "/blocked") return showBlocked(chatId, bot, lc);
  if (text === "/clearlogs") { clearLogs(); await bot.sendMessage(chatId, "Action logs cleared."); return true; }
  if (text === "/ai" || text === "/ai_dashboard") return showAIDashboard(chatId, bot, lc);
  if (text === "/ai_models") return showAIModels(chatId, bot, lc);
  if (text.startsWith("/ai_model ")) return setAIModel(text, chatId, bot, lc);
  if (text === "/ai_restart") return restartAI(chatId, bot, lc);
  if (text === "/ai_start") return startAI(chatId, bot, lc);
  if (text === "/ai_stop") return stopAI(chatId, bot, lc);
  if (text === "/ai_diag") return diagnoseAI(chatId, bot, lc);
  if (text === "/ai_fixports") return fixPorts(chatId, bot, lc);
  if (text === "/ai_logs") return showAILogs(chatId, bot, lc);
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
  const msg = "*ADMIN DASHBOARD*\n\n*SYSTEM*\nUptime: " + hours + "h " + mins + "m " + secs + "s\nMessages: " + trackerStats.messageCount + "\nCommands: " + trackerStats.commandCount + "\nErrors: " + trackerStats.errorCount + "\n\n*USERS*\nTotal: " + userCount + "\nBlocked: " + blockedCount + "\n\n*COMMANDS*\n/logs - Recent activity\n/logs errors - Errors\n/users - List users\n/block <id> <reason> - Block\n/unblock <id> - Unblock\n/blocked - Blocked users\n/clearlogs - Clear logs\n/ai - AI management\n/ai_diag - AI diagnostics\n/ai_fixports - Fix ports\n/sys_info - System info\n/bot_restart - Restart bot";
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

async function showAIDashboard(chatId, bot, lc) {
  const status = await getAIStatus();
  const model = getModel();
  let msg = "*AI DASHBOARD*\n\n";
  msg += "Status: " + (status.running ? "Running" : "Offline") + "\n";
  msg += "Model: " + model + "\n";
  if (status.running) msg += "Server: " + (status.data.name || "ChatGPT API") + "\n";
  else msg += "Error: " + (status.error || "N/A") + "\n";
  msg += "\n*Commands*\n";
  msg += "/ai - Dashboard\n";
  msg += "/ai_models - List models\n";
  msg += "/ai_model <name> - Set model\n";
  msg += "/ai_start - Start AI\n";
  msg += "/ai_stop - Stop AI\n";
  msg += "/ai_restart - Restart AI\n";
  msg += "/ai_fixports - Fix port conflicts\n";
  msg += "/ai_diag - Run diagnostics\n";
  msg += "/ai_logs - View logs\n";
  msg += "/sys_info - Server info\n";
  msg += "/bot_restart - Restart bot\n";
  await send(chatId, bot, msg);
  return true;
}

async function showAIModels(chatId, bot, lc) {
  await send(chatId, bot, "Fetching available models...");
  const models = await getAIModels();
  if (!models) { await send(chatId, bot, "Failed to fetch models. AI server may be offline."); return true; }
  let msg = "*AVAILABLE MODELS*\n\n";
  if (models.models && Array.isArray(models.models)) {
    for (const m of models.models) msg += "- " + (m.slug || m.id || m) + "\n";
  } else if (Array.isArray(models)) {
    for (const m of models) msg += "- " + (m.slug || m.id || m) + "\n";
  } else if (models.model) { msg += "- " + models.model + "\n";
  } else { msg += "- auto\n"; try { msg += JSON.stringify(models).substring(0, 200) + "\n"; } catch (e) {} }
  msg += "\nCurrent: " + getModel();
  if (msg.length > 3900) msg = msg.substring(0, 3900) + "\n...(truncated)";
  await send(chatId, bot, msg);
  return true;
}

async function setAIModel(text, chatId, bot, lc) {
  const modelName = text.slice(10).trim();
  if (!modelName) { await send(chatId, bot, "Usage: /ai_model <model_name>"); return true; }
  setModel(modelName);
  await send(chatId, bot, "AI model set to: " + modelName);
  trackSystemEvent("ai_model_change", "AI model changed to: " + modelName);
  return true;
}

async function restartAI(chatId, bot, lc) {
  await send(chatId, bot, "Restarting AI server...");
  const result = await restartAIServer();
  if (result.success) {
    await send(chatId, bot, "AI server restarted successfully.");
    trackSystemEvent("ai_restart", "AI server restarted by admin");
  } else {
    await send(chatId, bot, "AI server restart failed. Check logs.");
  }
  return true;
}

async function startAI(chatId, bot, lc) {
  try {
    const status = await getAIStatus();
    if (status && status.running) { await send(chatId, bot, "AI server is already running on port 3001."); return true; }
    await send(chatId, bot, "Starting AI server...");
    await startAIServer();
    const newStatus = await getAIStatus();
    if (newStatus && newStatus.running) {
      await send(chatId, bot, "AI server started successfully on port 3001.");
      trackSystemEvent("ai_start", "AI server started by admin");
    } else {
      await send(chatId, bot, "AI server failed to start. Use /ai_diag to diagnose.");
    }
  } catch (err) {
    await send(chatId, bot, "AI server start error: " + err.message);
    logger.error("AI start error: " + err.message);
  }
  return true;
}

async function stopAI(chatId, bot, lc) {
  try {
    const status = await getAIStatus();
    if (!status || !status.running) { await send(chatId, bot, "AI server is not running."); return true; }
    await send(chatId, bot, "Stopping AI server...");
    await stopAIServer();
    await send(chatId, bot, "AI server stopped. Use /ai_start to start again.");
    trackSystemEvent("ai_stop", "AI server stopped by admin");
  } catch (err) {
    await send(chatId, bot, "AI server stop error: " + err.message);
    logger.error("AI stop error: " + err.message);
  }
  return true;
}

async function diagnoseAI(chatId, bot, lc) {
  await send(chatId, bot, "Running AI system diagnostics...");
  const issues = [];
  const ok = [];

  try {
    const nodePath = execSync("which node", { encoding: "utf8" }).trim();
    ok.push("Node.js: " + nodePath);
  } catch (e) { issues.push("Node.js not found in PATH"); }

  try {
    const nodeVer = execSync("node --version", { encoding: "utf8" }).trim();
    ok.push("Node version: " + nodeVer);
  } catch (e) { issues.push("Cannot get Node version"); }

  const aiServerPath = path.resolve(__dirname, "..", "..", "..", "chatgpt-unofficial-api", "client", "server.mjs");
  if (fs.existsSync(aiServerPath)) ok.push("AI script: found");
  else issues.push("AI script NOT found: " + aiServerPath);

  const cookiesPath = path.resolve(__dirname, "..", "..", "..", "chatgpt-unofficial-api", "client", "cookies.json");
  if (fs.existsSync(cookiesPath)) ok.push("Cookies: found");
  else issues.push("cookies.json not found - AI may not auth");

  try {
    const port3000 = execSync("ss -tlnp 'sport = :3000' 2>/dev/null", { encoding: "utf8" }).trim();
    ok.push(port3000.includes("LISTEN") ? "Port 3000: listening" : "Port 3000: free");
  } catch (e) { ok.push("Port 3000: check ok"); }

  try {
    const port3001 = execSync("ss -tlnp 'sport = :3001' 2>/dev/null", { encoding: "utf8" }).trim();
    ok.push(port3001.includes("LISTEN") ? "Port 3001: listening (AI)" : "Port 3001: free (AI NOT running)");
  } catch (e) { ok.push("Port 3001: check ok"); }

  try {
    const aiStatus = await getAIStatus();
    if (aiStatus && aiStatus.running) {
      ok.push("AI: HTTP health check OK");
      ok.push("Model: " + getModel());
    } else {
      issues.push("AI: not responding: " + (aiStatus?.error || "unknown"));
    }
  } catch (err) { issues.push("AI status check failed: " + err.message); }

  const trackerStats = getTrackerStats();
  const uptime = trackerStats?.uptime || 0;
  ok.push("Bot uptime: " + Math.floor(uptime / 3600) + "h " + Math.floor((uptime % 3600) / 60) + "m");

  let msg = "*AI DIAGNOSTIC RESULTS*\n\n*PASSED*\n" + ok.join("\n") + "\n\n";
  if (issues.length > 0) {
    msg += "*ISSUES FOUND*\n" + issues.join("\n") + "\n\n";
    if (issues.some(function(i) { return i.includes("cookies"); })) msg += "Fix: Place cookies.json in chatgpt-unofficial-api/client/\n";
    if (issues.some(function(i) { return i.includes("NOT") || i.includes("not"); })) msg += "Fix: /ai_fixports then /ai_start\n";
  } else {
    msg += "All systems operational!\n";
  }
  if (msg.length > 3900) msg = msg.substring(0, 3900) + "\n...(truncated)";
  await send(chatId, bot, msg);
  return true;
}

async function fixPorts(chatId, bot, lc) {
  await send(chatId, bot, "Attempting to fix port conflicts...");
  let fixed = false;
  try {
    try {
      const p3000 = execSync("lsof -ti:3000 2>/dev/null", { encoding: "utf8" }).trim();
      if (p3000) {
        const pid = p3000.split("\n")[0];
        execSync("kill -9 " + pid + " 2>/dev/null");
        await send(chatId, bot, "Killed stale process " + pid + " on port 3000");
        fixed = true;
      }
    } catch (e) {}
    try {
      const p3001 = execSync("lsof -ti:3001 2>/dev/null", { encoding: "utf8" }).trim();
      if (p3001) {
        const pid = p3001.split("\n")[0];
        execSync("kill -9 " + pid + " 2>/dev/null");
        await send(chatId, bot, "Killed stale process " + pid + " on port 3001");
        fixed = true;
      }
    } catch (e) {}
    if (fixed) {
      await send(chatId, bot, "Ports cleaned. Restarting AI...");
      try {
        await restartAIServer();
        const status = await getAIStatus();
        await send(chatId, bot, (status && status.running) ? "AI server running on port 3001." : "AI failed to start. Use /ai_start.");
      } catch (err) {
        await send(chatId, bot, "Ports freed but restart failed: " + err.message + ". Try /ai_start");
      }
    } else {
      await send(chatId, bot, "No stale processes found. Use /ai_start if server is down.");
    }
  } catch (err) {
    await send(chatId, bot, "Error fixing ports: " + err.message);
    logger.error("fixPorts error: " + err.message);
  }
  return true;
}

async function showAILogs(chatId, bot, lc) {
  const logDir = path.resolve(__dirname, "..", "..", "logs");
  if (!fs.existsSync(logDir)) { await send(chatId, bot, "No log directory found."); return true; }
  const logFiles = fs.readdirSync(logDir).filter(function(f) { return f.endsWith(".log") || f.endsWith(".txt"); }).sort().reverse().slice(0, 5);
  if (logFiles.length === 0) { await send(chatId, bot, "No log files found."); return true; }
  let msg = "*RECENT LOG FILES*\n\n";
  for (const file of logFiles) {
    const stat = fs.statSync(path.join(logDir, file));
    msg += file + " (" + (stat.size / 1024).toFixed(1) + "KB)\n";
  }
  msg += "\nLast lines:\n";
  try {
    const content = fs.readFileSync(path.join(logDir, logFiles[0]), "utf8");
    const lines = content.trim().split("\n").slice(-3);
    msg += "```\n" + lines.join("\n").substring(0, 500) + "\n```";
  } catch (err) { msg += "(unable to read)"; }
  if (msg.length > 3900) msg = msg.substring(0, 3900) + "\n...";
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