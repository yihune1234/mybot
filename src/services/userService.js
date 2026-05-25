const { loadJSON, saveJSON } = require("../utils/dataStore");
const logger = require("../utils/logger");
const { STATS_FILE, USER_LIST_FILE } = require("../utils/constants");

let stats = loadJSON(STATS_FILE, {});
let userList = loadJSON(USER_LIST_FILE, []);

function trackUser(msg) {
  const uid = msg.from.id;
  const now = new Date().toISOString();

  if (!stats[uid]) {
    stats[uid] = {
      firstSeen: now,
      lastSeen: now,
      messageCount: 0,
      language: msg.from.language_code || "unknown",
    };
    if (!userList.find((u) => u.id === uid)) {
      userList.push({
        id: uid,
        firstName: msg.from.first_name || "",
        username: msg.from.username || "",
      });
    }
  } else {
    stats[uid].lastSeen = now;
    if (msg.from.language_code) stats[uid].language = msg.from.language_code;
  }
  stats[uid].messageCount++;
  saveJSON(STATS_FILE, stats);
  saveJSON(USER_LIST_FILE, userList);
}

function getUserStats(userId) {
  return stats[userId] || null;
}

function getUserById(userId) {
  return userList.find((u) => u.id === userId) || null;
}

function findUser(query) {
  const idNum = parseInt(query, 10);
  if (!isNaN(idNum) && stats[idNum]) {
    return { id: idNum, ...stats[idNum] };
  }
  const userEntry = userList.find(
    (u) => u.username && u.username.toLowerCase() === query.toLowerCase()
  );
  if (userEntry && stats[userEntry.id]) {
    return { id: userEntry.id, ...stats[userEntry.id] };
  }
  return null;
}

function getGlobalStats() {
  const totalUsers = userList.length;
  const totalMessages = Object.values(stats).reduce(
    (sum, s) => sum + (s.messageCount || 0),
    0
  );
  const topUsers = Object.entries(stats)
    .sort((a, b) => (b[1].messageCount || 0) - (a[1].messageCount || 0))
    .slice(0, 5)
    .map(([id, s]) => `  • ${id}: ${s.messageCount} msgs`);
  return { totalUsers, totalMessages, topUsers };
}

function setUserLanguage(userId, lang) {
  if (!stats[userId]) {
    stats[userId] = {
      firstSeen: new Date().toISOString(),
      lastSeen: new Date().toISOString(),
      messageCount: 0,
      language: "unknown",
    };
  }
  stats[userId].preferredLanguage = lang;
  saveJSON(STATS_FILE, stats);
}

function getUserLanguage(userId) {
  const s = stats[userId];
  return s?.preferredLanguage || null;
}

function getAllUsers() {
  return userList;
}

function getStats() {
  return stats;
}

module.exports = {
  trackUser,
  getUserStats,
  getUserById,
  findUser,
  getGlobalStats,
  getAllUsers,
  getStats,
  setUserLanguage,
  getUserLanguage,
};
