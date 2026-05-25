const logger = require("../utils/logger");
const { REMINDER_MAX_MS } = require("../utils/constants");

let reminders = {};
let reminderCounter = 0;

function setReminder(userId, chatId, delayMs, text, bot) {
  if (delayMs > REMINDER_MAX_MS) return null;

  const id = ++reminderCounter;
  const timeout = setTimeout(async () => {
    try {
      await bot.sendMessage(chatId, `⏰ *Reminder!*\n${text}`, {
        parse_mode: "Markdown",
      });
      logger.info(`Reminder #${id} fired for user ${userId}: ${text}`);
    } catch (err) {
      logger.error(`Reminder #${id} send error: ${err.message}`);
    }
    delete reminders[id];
  }, delayMs);

  reminders[id] = {
    userId,
    chatId,
    text,
    timeout,
    createdAt: Date.now(),
  };
  return id;
}

function clearAllReminders() {
  for (const id of Object.keys(reminders)) {
    clearTimeout(reminders[id].timeout);
  }
  reminders = {};
}

function getActiveReminders(userId) {
  return Object.values(reminders).filter((r) => r.userId === userId);
}

module.exports = { setReminder, clearAllReminders, getActiveReminders };
