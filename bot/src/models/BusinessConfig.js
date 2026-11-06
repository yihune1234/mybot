const mongoose = require("mongoose");

const BusinessConfigSchema = new mongoose.Schema(
  {
    key: {
      type: String,
      default: "ariiti_tech_config",
      unique: true,
      index: true
    },
    company: {
      name: { type: String, default: "Aritii Tech" },
      legalName: { type: String, default: "Aritii Technologies PLC" },
      tagline: { type: String, default: "Engineering Digital Excellence" },
      email: { type: String, default: "contact@ariititech.com" },
      phone: { type: String, default: "+251911000000" },
      telegram: { type: String, default: "@Y13bel" },
      website: { type: String, default: "https://ariiti.com" },
      location: { type: String, default: "Addis Ababa, Ethiopia" },
      operatingHours: { type: String, default: "Mon-Fri 8:30 AM - 5:30 PM EAT" }
    },
    operatingMode: {
      type: String,
      default: "rule_based"
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("BusinessConfig", BusinessConfigSchema);
