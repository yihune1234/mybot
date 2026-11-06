const { loadJSON, saveJSON } = require("../utils/dataStore");
const logger = require("../utils/logger");
const {
  MEMORY_FILE,
  MEMORY_MAX_MESSAGES,
  MEMORY_SUMMARY_THRESHOLD,
  STATE_IDLE,
} = require("../utils/constants");

let memories = migrateData(loadJSON(MEMORY_FILE, {}));

function migrateData(raw) {
  for (const [userId, data] of Object.entries(raw)) {
    if (Array.isArray(data)) {
      raw[userId] = {
        messages: data,
        summary: null,
        session: { state: STATE_IDLE, stateData: {}, lastIntent: null, lastIntentTime: null, selectedService: null },
      };
    } else if (data && typeof data === "object") {
      if (!data.messages) data.messages = [];
      if (!data.session) {
        data.session = { state: STATE_IDLE, stateData: {}, lastIntent: null, lastIntentTime: null, selectedService: null };
      }
    }
  }
  return raw;
}

function ensureUserSession(userId) {
  if (!memories[userId]) {
    memories[userId] = {
      messages: [],
      summary: null,
      session: {
        state: STATE_IDLE,
        stateData: {},
        lastIntent: null,
        lastIntentTime: null,
        selectedService: null,
      },
    };
  } else if (!memories[userId].session) {
    memories[userId].session = {
      state: STATE_IDLE,
      stateData: {},
      lastIntent: null,
      lastIntentTime: null,
      selectedService: null,
    };
  }
}

function addMemory(userId, role, text) {
  ensureUserSession(userId);

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
    session: mem.session || {},
  };
}

// Conversation State & Context Management
function getUserState(userId) {
  ensureUserSession(userId);
  return {
    state: memories[userId].session.state || STATE_IDLE,
    data: memories[userId].session.stateData || {},
  };
}

function setUserState(userId, state, data = {}) {
  ensureUserSession(userId);
  memories[userId].session.state = state;
  memories[userId].session.stateData = {
    ...(memories[userId].session.stateData || {}),
    ...data,
  };
  saveJSON(MEMORY_FILE, memories);
}

function clearUserState(userId) {
  if (memories[userId] && memories[userId].session) {
    memories[userId].session.state = STATE_IDLE;
    memories[userId].session.stateData = {};
    saveJSON(MEMORY_FILE, memories);
  }
}

function getLastIntent(userId) {
  if (!memories[userId] || !memories[userId].session) return null;
  return memories[userId].session.lastIntent || null;
}

function setLastIntent(userId, intent) {
  ensureUserSession(userId);
  memories[userId].session.lastIntent = intent;
  memories[userId].session.lastIntentTime = Date.now();
  saveJSON(MEMORY_FILE, memories);
}

function getSelectedService(userId) {
  if (!memories[userId] || !memories[userId].session) return null;
  return memories[userId].session.selectedService || null;
}

function setSelectedService(userId, service) {
  ensureUserSession(userId);
  memories[userId].session.selectedService = service;
  saveJSON(MEMORY_FILE, memories);
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
  getUserState,
  setUserState,
  clearUserState,
  getLastIntent,
  setLastIntent,
  getSelectedService,
  setSelectedService,
};
