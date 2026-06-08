const fs = require("fs");
const logger = require("./logger");

function loadJSON(filePath, defaultValue) {
  try {
    if (fs.existsSync(filePath)) {
      return JSON.parse(fs.readFileSync(filePath, "utf-8"));
    }
  } catch (err) {
    logger.error(`Failed to load ${filePath}: ${err.message}`);
  }
  return defaultValue;
}

function saveJSON(filePath, data) {
  try {
    const dir = require("path").dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2), "utf-8");
  } catch (err) {
    logger.error(`Failed to save ${filePath}: ${err.message}`);
  }
}

module.exports = { loadJSON, saveJSON };
