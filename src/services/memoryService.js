const { loadJSON, saveJSON } = require("../utils/dataStore");
const logger = require("../utils/logger");
const {
  MEMORY_FILE,
  MEMORY_MAX_MESSAGES,
  MEMORY_SUMMARY_THRESHOLD,
} = require("../utils/constants");

let memories = loadJSON(MEMORY_FILE, {});

function addMemory(userId, role, text) {
  if (!memories[userId]) {
    memories[userId] = { messages: [], summary: null };
  }

  const entry = { role, text, timestamp: Date.now() };
  memories[userId].messages.push(entry);

  if (memories[userId].messages.length > MEMORY_SUMMARY_THRESHOLD) {
    const old = memories[userId].messages.slice(
      0,
      memories[userId].messages.length - MEMORY_MAX_MESSAGES
    );
    memories[userId].summary = generateSummary(old, memories[userId].summary);
    memories[userId].messages = memories[userId].messages.slice(-MEMORY_MAX_MESSAGES);
  } else if (memories[userId].messages.length > MEMORY_MAX_MESSAGES) {
    memories[userId].messages = memories[userId].messages.slice(-MEMORY_MAX_MESSAGES);
  }

  saveJSON(MEMORY_FILE, memories);
}

function generateSummary(messages, previousSummary) {
  const topics = new Set();
  const userMessages = messages.filter((m) => m.role === "user").map((m) => m.text);
  for (const msg of userMessages) {
    const words = msg.toLowerCase().split(/\s+/);
    words.forEach((w) => {
      if (w.length > 3) topics.add(w);
    });
  }
  const topicList = [...topics].slice(0, 10).join(", ");
  const count = userMessages.length;
  return `💬 ${count} previous messages | Topics: ${topicList || "general"}`;
}

function getMemoryString(userId) {
  if (!memories[userId] || memories[userId].messages.length === 0) return null;
  const msgs = memories[userId].messages.slice(-5);
  let output = msgs
    .map((m) => `${m.role === "user" ? "You" : "Bot"}: ${m.text}`)
    .join("\n");
  if (memories[userId].summary) {
    output = `${memories[userId].summary}\n\n${output}`;
  }
  return output;
}

function getContext(userId) {
  const mem = memories[userId];
  if (!mem) return null;
  return {
    recentMessages: mem.messages.slice(-5),
    summary: mem.summary,
    messageCount: mem.messages.length,
  };
}

function clearMemory(userId) {
  delete memories[userId];
  saveJSON(MEMORY_FILE, memories);
}

function getAllMemories() {
  return memories;
}

module.exports = {
  addMemory,
  getMemoryString,
  getContext,
  clearMemory,
  getAllMemories,
};
