const { loadJSON, saveJSON } = require("../utils/dataStore");
const logger = require("../utils/logger");
const { PRODUCTS_FILE } = require("../utils/constants");

let productCache = null;

function loadProducts() {
  productCache = loadJSON(PRODUCTS_FILE, []);
  return productCache;
}

function getAllProducts() {
  if (!productCache) loadProducts();
  return productCache;
}

function getActiveProducts() {
  return getAllProducts().filter((p) => p.isActive !== false);
}

function getProductById(productId) {
  return getAllProducts().find((p) => p.id === productId) || null;
}

function saveProducts(products) {
  productCache = products;
  saveJSON(PRODUCTS_FILE, productCache);
  logger.info("Products catalog saved.");
  return productCache;
}

function updateProduct(productId, updates) {
  const products = getAllProducts();
  const index = products.findIndex((p) => p.id === productId);
  if (index === -1) return null;

  products[index] = { ...products[index], ...updates };
  saveProducts(products);
  return products[index];
}

function toggleProductStatus(productId) {
  const product = getProductById(productId);
  if (!product) return null;
  return updateProduct(productId, { isActive: !product.isActive });
}

function addProduct(productData) {
  const products = getAllProducts();
  const newProduct = {
    id: productData.id || `prod_${Date.now()}`,
    name: productData.name || "New Product",
    category: productData.category || "Digital Solutions",
    description: productData.description || "",
    features: productData.features || [],
    pricing: productData.pricing || "Contact for pricing",
    demoUrl: productData.demoUrl || "",
    isActive: true,
  };
  products.push(newProduct);
  saveProducts(products);
  return newProduct;
}

function deleteProduct(productId) {
  const products = getAllProducts();
  const index = products.findIndex((p) => p.id === productId);
  if (index === -1) return false;

  products.splice(index, 1);
  saveProducts(products);
  logger.info(`Product ${productId} deleted.`);
  return true;
}

module.exports = {
  getAllProducts,
  getActiveProducts,
  getProductById,
  updateProduct,
  toggleProductStatus,
  addProduct,
  deleteProduct,
};
