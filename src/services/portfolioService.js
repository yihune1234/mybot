const { loadJSON, saveJSON } = require("../utils/dataStore");
const logger = require("../utils/logger");
const { PORTFOLIO_FILE } = require("../utils/constants");

let portfolioCache = null;

function loadPortfolio() {
  portfolioCache = loadJSON(PORTFOLIO_FILE, []);
  return portfolioCache;
}

function getAllPortfolio() {
  if (!portfolioCache) loadPortfolio();
  return portfolioCache;
}

function getActivePortfolio() {
  return getAllPortfolio().filter((p) => p.isActive !== false);
}

function getPortfolioById(id) {
  return getAllPortfolio().find((p) => p.id === id) || null;
}

function savePortfolio(portfolio) {
  portfolioCache = portfolio;
  saveJSON(PORTFOLIO_FILE, portfolioCache);
  logger.info("Portfolio catalog saved.");
  return portfolioCache;
}

function updatePortfolioProject(id, updates) {
  const list = getAllPortfolio();
  const index = list.findIndex((p) => p.id === id);
  if (index === -1) return null;

  list[index] = { ...list[index], ...updates };
  savePortfolio(list);
  return list[index];
}

function togglePortfolioStatus(id) {
  const item = getPortfolioById(id);
  if (!item) return null;
  return updatePortfolioProject(id, { isActive: !item.isActive });
}

function addPortfolioProject(data) {
  const list = getAllPortfolio();
  const newItem = {
    id: data.id || `port_${Date.now()}`,
    title: data.title || "New Showcase Project",
    category: data.category || "Digital Solutions",
    description: data.description || "",
    techStack: data.techStack || "Modern Tech Stack",
    liveUrl: data.liveUrl || "",
    githubUrl: data.githubUrl || "",
    isActive: true,
  };
  list.push(newItem);
  savePortfolio(list);
  return newItem;
}

function deletePortfolioProject(id) {
  const list = getAllPortfolio();
  const index = list.findIndex((p) => p.id === id);
  if (index === -1) return false;

  list.splice(index, 1);
  savePortfolio(list);
  logger.info(`Portfolio project ${id} deleted.`);
  return true;
}

module.exports = {
  getAllPortfolio,
  getActivePortfolio,
  getPortfolioById,
  updatePortfolioProject,
  togglePortfolioStatus,
  addPortfolioProject,
  deletePortfolioProject,
};
