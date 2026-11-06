const { loadJSON, saveJSON } = require("../utils/dataStore");
const logger = require("../utils/logger");
const { ROLES_FILE, ROLE_ADMIN, ROLE_CUSTOMER } = require("../utils/constants");

const DEFAULT_ROLES = {
  adminIds: [7458921957],
  primaryAdminId: 7458921957,
  permissions: {
    admin: [
      "manage_services",
      "view_reports",
      "view_leads",
      "edit_pricing",
      "config_ai",
      "manage_admins",
      "view_audit_logs",
      "configure_business"
    ],
    "customer": [
      "view_services",
      "request_quote",
      "submit_inquiry",
      "change_language"
    ]
  }
};

let rolesCache = null;

function getRolesData() {
  if (!rolesCache) {
    rolesCache = loadJSON(ROLES_FILE, DEFAULT_ROLES);
  }
  return rolesCache;
}

function saveRolesData(data) {
  rolesCache = data;
  saveJSON(ROLES_FILE, rolesCache);
  return rolesCache;
}

function getAdminIds() {
  const data = getRolesData();
  const ids = new Set((data.adminIds || []).map(Number));
  if (process.env.ADMIN_CHAT_ID) {
    ids.add(Number(process.env.ADMIN_CHAT_ID));
  }
  return Array.from(ids);
}

function isAdmin(userId) {
  if (!userId) return false;
  const numId = Number(userId);
  return getAdminIds().includes(numId);
}

function isCustomer(userId) {
  return !isAdmin(userId);
}

function getUserRole(userId) {
  return isAdmin(userId) ? ROLE_ADMIN : ROLE_CUSTOMER;
}

function hasPermission(userId, permission) {
  const role = getUserRole(userId);
  const data = getRolesData();
  const allowed = data.permissions?.[role] || [];
  return allowed.includes(permission) || allowed.includes("*");
}

function addAdmin(newAdminId, actorId) {
  if (!isAdmin(actorId)) {
    throw new Error("Only existing administrators can promote other users.");
  }
  const numId = Number(newAdminId);
  if (!numId || isNaN(numId)) {
    throw new Error("Invalid Telegram User ID.");
  }

  const data = getRolesData();
  const currentAdmins = new Set(data.adminIds || []);
  currentAdmins.add(numId);
  data.adminIds = Array.from(currentAdmins);
  saveRolesData(data);
  logger.info(`User ${numId} added to administrators by ${actorId}`);
  return true;
}

function removeAdmin(adminIdToRemove, actorId) {
  if (!isAdmin(actorId)) {
    throw new Error("Unauthorized.");
  }
  const numId = Number(adminIdToRemove);
  const data = getRolesData();

  if (numId === Number(data.primaryAdminId) || String(numId) === String(process.env.ADMIN_CHAT_ID)) {
    throw new Error("The primary administrator account cannot be removed.");
  }

  data.adminIds = (data.adminIds || []).filter((id) => Number(id) !== numId);
  saveRolesData(data);
  logger.info(`Administrator ${numId} removed by ${actorId}`);
  return true;
}

module.exports = {
  getAdminIds,
  isAdmin,
  isCustomer,
  getUserRole,
  hasPermission,
  addAdmin,
  removeAdmin
};
