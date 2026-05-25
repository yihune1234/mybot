let replies;

function loadReplies(filePath) {
  try {
    replies = require(filePath);
  } catch (err) {
    console.error("Failed to load replies.json. Using fallback defaults.");
    replies = {
      hiReplies: ["Hey! How are you doing?", "Hi there!"],
      triggerReplies: {},
      identityReplies: ["I'm a friendly bot!"],
      aboutReplies: ["A Telegram bot that replies like a human."],
      encouragementReplies: ["Things will get better!"],
      fallbackReplies: ["That's interesting!", "I see!"],
      weatherFailReplies: ["Couldn't fetch weather data."],
    };
  }
}

function getReplies() {
  return replies;
}

function reloadReplies(filePath) {
  delete require.cache[require.resolve(filePath)];
  loadReplies(filePath);
  return replies;
}

module.exports = { loadReplies, getReplies, reloadReplies };
