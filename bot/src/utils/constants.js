const path = require("path");

const ROOT_DIR = path.resolve(__dirname, "..", "..");
const DATA_DIR = path.join(ROOT_DIR, "data");
const LOG_DIR = path.join(ROOT_DIR, "logs");

const MEMORY_FILE = path.join(DATA_DIR, "memories.json");
const STATS_FILE = path.join(DATA_DIR, "stats.json");
const USER_LIST_FILE = path.join(DATA_DIR, "users.json");
const REPLIES_FILE = path.join(ROOT_DIR, "replies.json");

const MEMORY_MAX_MESSAGES = 10;
const MEMORY_SUMMARY_THRESHOLD = 15;
const MEMORY_RECENT_COUNT = 5;

const RATE_LIMIT_WINDOW_MS = 1000;
const RATE_LIMIT_MAX_MESSAGES = 5;

const REMINDER_MAX_MS = 24 * 3600000;

const INTENT_CONFIDENCE_MIN_THRESHOLD = 0.001;
const INTENT_CONFIDENCE_RATIO = 1.3;
const SENTIMENT_ENCOURAGE_THRESHOLD = -0.4;
const SENTIMENT_LOG_THRESHOLD = -0.3;
const PERSONALIZE_CHANCE = 0.2;

const PORT = process.env.PORT || 3000;
const AI_PORT = parseInt(process.env.AI_PORT, 10) || 3001;
const AI_API_URL = process.env.AI_API_URL || `http://localhost:${AI_PORT}`;

module.exports = {
  ROOT_DIR,
  DATA_DIR,
  LOG_DIR,
  MEMORY_FILE,
  STATS_FILE,
  USER_LIST_FILE,
  REPLIES_FILE,
  MEMORY_MAX_MESSAGES,
  MEMORY_SUMMARY_THRESHOLD,
  MEMORY_RECENT_COUNT,
  RATE_LIMIT_WINDOW_MS,
  RATE_LIMIT_MAX_MESSAGES,
  REMINDER_MAX_MS,
  INTENT_CONFIDENCE_MIN_THRESHOLD,
  INTENT_CONFIDENCE_RATIO,
  SENTIMENT_ENCOURAGE_THRESHOLD,
  SENTIMENT_LOG_THRESHOLD,
  PERSONALIZE_CHANCE,
  PORT,
  AI_PORT,
  AI_API_URL,
};
