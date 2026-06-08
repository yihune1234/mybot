const { loadJSON, saveJSON } = require("../utils/dataStore");
const logger = require("../utils/logger");
const path = require("path");

const DATA_DIR = path.resolve(__dirname, "..", "..", "data");
const BLOCK_FILE = path.join(DATA_DIR, "blockedUsers.json");

let blockedUsers = loadJSON(BLOCK_FILE, {});

function blockUser(userId, reason, blockedBy) {
  blockedUsers[userId] = {
    blockedAt: new Date().toISOString(),
    reason: reason || "No reason provided",
    blockedBy: blockedBy || "admin",
  };
  saveJSON(BLOCK_FILE, blockedUsers);
  logger.info(`🚫 User ${userId} blocked: ${reason}`);
  return blockedUsers[userId];
}

function unblockUser(userId) {
  if (!blockedUsers[userId]) return false;
  delete blockedUsers[userId];
  saveJSON(BLOCK_FILE, blockedUsers);
  logger.info(`✅ User ${userId} unblocked`);
  return true;
}

function isBlocked(userId) {
  return !!blockedUsers[userId];
}

function getBlockedUsers() {
  return blockedUsers;
}

function getBlockReason(userId) {
  return blockedUsers[userId]?.reason || null;
}

module.exports = {
  blockUser,
  unblockUser,
  isBlocked,
  getBlockedUsers,
  getBlockReason,
};
