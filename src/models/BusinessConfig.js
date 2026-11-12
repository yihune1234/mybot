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
      name: { type: String, default: "Ariiti Tech" },
      legalName: { type: String, default: "Ariiti Technologies PLC" },
      positioning: { type: String, default: "Business Technology Partner & Digital Solutions Provider" },
      brandMessage: { type: String, default: "Building digital solutions for better businesses." },
      description: {
        type: String,
        default: "Ariiti Tech provides software development, digital products, e-commerce solutions, and business automation systems to help businesses and individuals improve their operations through technology."
      },
      tagline: { type: String, default: "Building digital solutions for better businesses." },
      about: {
        type: String,
        default: "Ariiti Tech is a premier business technology partner and digital solutions provider. We deliver enterprise-grade software development, innovative digital products, robust e-commerce solutions, and high-impact business automation systems."
      },
      email: { type: String, default: "contact@ariititech.com" },
      phone: { type: String, default: "+251987414282" },
      telegram: { type: String, default: "@AriitiTech" },
      telegramContact: { type: String, default: "@Yihun2bel" },
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
