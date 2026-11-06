const logger = require("../utils/logger");
const { getOperatingMode, setOperatingMode, getConfig } = require("./businessConfigService");
const { MODE_RULE_BASED, MODE_HYBRID, MODE_AI_ENHANCED } = require("../utils/constants");

function getCurrentMode() {
  return getOperatingMode();
}

function changeMode(mode) {
  return setOperatingMode(mode);
}

function isRuleBasedOnly() {
  return getCurrentMode() === MODE_RULE_BASED;
}

function isHybrid() {
  return getCurrentMode() === MODE_HYBRID;
}

function isAIEnhanced() {
  return getCurrentMode() === MODE_AI_ENHANCED;
}

function shouldAttemptAI() {
  const mode = getCurrentMode();
  if (mode === MODE_RULE_BASED) return false;
  const config = getConfig();
  return !!(config.aiConfig && config.aiConfig.enabled && config.aiConfig.apiKey);
}

function getModeDisplay(mode) {
  const current = mode || getCurrentMode();
  switch (current) {
    case MODE_RULE_BASED:
      return "🟢 Mode A: Rule-Based Only (100% Local & Fast)";
    case MODE_HYBRID:
      return "🟡 Mode B: Hybrid (AI with Local Fallback)";
    case MODE_AI_ENHANCED:
      return "🟣 Mode C: AI-Enhanced";
    default:
      return current;
  }
}

module.exports = {
  getCurrentMode,
  changeMode,
  isRuleBasedOnly,
  isHybrid,
  isAIEnhanced,
  shouldAttemptAI,
  getModeDisplay,
};
