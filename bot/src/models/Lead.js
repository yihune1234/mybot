const mongoose = require("mongoose");

const LeadSchema = new mongoose.Schema(
  {
    leadId: {
      type: String,
      unique: true,
      index: true
    },
    telegramId: {
      type: Number,
      required: true,
      index: true
    },
    customerName: {
      type: String,
      default: "Valued Client"
    },
    serviceType: {
      type: String,
      required: true
    },
    projectDescription: {
      type: String,
      default: ""
    },
    budgetTimeline: {
      type: String,
      default: ""
    },
    contactInfo: {
      type: String,
      default: ""
    },
    quoteEstimate: {
      type: Number,
      default: null
    },
    currency: {
      type: String,
      default: "USD"
    },
    status: {
      type: String,
      enum: ["new", "contacted", "qualified", "proposal", "won", "lost"],
      default: "new",
      index: true
    },
    notes: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true
  }
);

module.exports = mongoose.model("Lead", LeadSchema);
