const mongoose = require("mongoose");
const logger = require("./logger");

let isDbConnected = false;
let reconnectTimer = null;

async function connectDB() {
  const uri = process.env.MONGO_URI;
  if (!uri) {
    logger.warn("MONGO_URI not defined in environment. Running in resilient local JSON storage mode.");
    isDbConnected = false;
    return false;
  }

  try {
    mongoose.set("strictQuery", false);
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 30000,
      connectTimeoutMS: 30000,
      socketTimeoutMS: 45000,
    });
    isDbConnected = true;
    logger.info("✅ MongoDB connected successfully for client leads & user persistence.");

    // Sync any pending leads and load business contacts from MongoDB
    try {
      const { syncPendingLeadsToDB } = require("../services/leadService");
      syncPendingLeadsToDB();
      const { syncConfigWithDB } = require("../services/businessConfigService");
      syncConfigWithDB();
    } catch (_) {}

    return true;
  } catch (err) {
    isDbConnected = false;
    logger.warn(`⚠️ MongoDB initial connect: ${err.message}. Operating in resilient local JSON fallback mode.`);

    // Schedule automatic background reconnect retry
    if (!reconnectTimer) {
      reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        logger.info("Retrying MongoDB connection...");
        connectDB();
      }, 10000);
    }

    return false;
  }
}

mongoose.connection.on("disconnected", () => {
  isDbConnected = false;
  logger.warn("MongoDB disconnected. Falling back to local storage.");
  if (!reconnectTimer) {
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null;
      connectDB();
    }, 10000);
  }
});

mongoose.connection.on("reconnected", () => {
  isDbConnected = true;
  logger.info("MongoDB reconnected.");
  try {
    const { syncPendingLeadsToDB } = require("../services/leadService");
    syncPendingLeadsToDB();
    const { syncConfigWithDB } = require("../services/businessConfigService");
    syncConfigWithDB();
  } catch (_) {}
});

function isConnected() {
  return isDbConnected && mongoose.connection.readyState === 1;
}

async function disconnectDB() {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (isDbConnected) {
    await mongoose.disconnect();
    isDbConnected = false;
  }
}

module.exports = {
  connectDB,
  disconnectDB,
  isConnected,
  mongoose
};
