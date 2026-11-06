const { loadJSON, saveJSON } = require("../utils/dataStore");
const logger = require("../utils/logger");
const { SERVICES_FILE } = require("../utils/constants");

let serviceCache = null;

function loadServices() {
  serviceCache = loadJSON(SERVICES_FILE, []);
  return serviceCache;
}

function getAllServices() {
  if (!serviceCache) loadServices();
  return serviceCache;
}

function getActiveServices() {
  return getAllServices().filter((s) => s.isActive !== false);
}

function getServiceById(serviceId) {
  return getAllServices().find((s) => s.id === serviceId) || null;
}

function saveServices(services) {
  serviceCache = services;
  saveJSON(SERVICES_FILE, serviceCache);
  logger.info("Services catalog saved.");
  return serviceCache;
}

function updateService(serviceId, updates) {
  const services = getAllServices();
  const index = services.findIndex((s) => s.id === serviceId);
  if (index === -1) return null;

  services[index] = { ...services[index], ...updates };
  saveServices(services);
  return services[index];
}

function toggleServiceStatus(serviceId) {
  const service = getServiceById(serviceId);
  if (!service) return null;
  return updateService(serviceId, { isActive: !service.isActive });
}

function updateServicePrice(serviceId, newPrice) {
  const price = parseFloat(newPrice);
  if (isNaN(price) || price < 0) return null;
  return updateService(serviceId, { startingPrice: price });
}

function addService(serviceData) {
  const services = getAllServices();
  const newService = {
    id: serviceData.id || `srv_${Date.now()}`,
    name: serviceData.name || "New Service",
    category: serviceData.category || "General",
    description: serviceData.description || "",
    features: serviceData.features || [],
    pricingModel: serviceData.pricingModel || "fixed",
    startingPrice: parseFloat(serviceData.startingPrice) || 0,
    currency: serviceData.currency || "USD",
    estimatedDays: parseInt(serviceData.estimatedDays, 10) || 7,
    isActive: true,
    isFeatured: false,
  };
  services.push(newService);
  saveServices(services);
  return newService;
}

module.exports = {
  getAllServices,
  getActiveServices,
  getServiceById,
  updateService,
  toggleServiceStatus,
  updateServicePrice,
  addService,
};
