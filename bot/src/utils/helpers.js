function randomPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function escapeHTML(text) {
  return String(text).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function formatTime(ms) {
  if (ms < 1000) return `${ms.toFixed(0)}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}min`;
}

function formatDate(isoString) {
  return new Date(isoString).toLocaleDateString();
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function extractCity(text) {
  const patterns = [
    /weather\s+(?:in|for|at)\s+([a-z\s]+?)(?:\s*\?|\s*$)/i,
    /(?:in|for|at)\s+([a-z\s]+?)(?:\s*\?|\s*$)/i,
    /weather\s+([a-z\s]+?)(?:\s*\?|\s*$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match) return match[1].trim();
  }
  return null;
}

function truncate(str, maxLen = 60) {
  return str.length > maxLen ? str.substring(0, maxLen) + "..." : str;
}

module.exports = {
  randomPick,
  escapeHTML,
  formatTime,
  formatDate,
  sleep,
  extractCity,
  truncate,
};
