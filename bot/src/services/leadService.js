const { loadJSON, saveJSON } = require("../utils/dataStore");
const logger = require("../utils/logger");
const { LEADS_FILE, QUOTES_FILE } = require("../utils/constants");
const { isConnected } = require("../utils/db");
const Lead = require("../models/Lead");
const { getServiceById } = require("./serviceCatalogService");

let leadsCache = null;
let quotesCache = null;

function loadLeads() {
  leadsCache = loadJSON(LEADS_FILE, []);
  return leadsCache;
}

function loadQuotes() {
  quotesCache = loadJSON(QUOTES_FILE, []);
  return quotesCache;
}

function getAllLeads() {
  if (!leadsCache) loadLeads();
  return leadsCache;
}

function getAllQuotes() {
  if (!quotesCache) loadQuotes();
  return quotesCache;
}

function saveLeads(leads) {
  leadsCache = leads;
  saveJSON(LEADS_FILE, leadsCache);
  return leadsCache;
}

function saveQuotes(quotes) {
  quotesCache = quotes;
  saveJSON(QUOTES_FILE, quotesCache);
  return quotesCache;
}

async function createLead(data) {
  const leads = getAllLeads();
  const leadId = `lead_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

  const newLead = {
    leadId,
    telegramId: Number(data.telegramId),
    customerName: data.customerName || "Valued Client",
    username: data.username || null,
    serviceType: data.serviceType || "General Consultation",
    serviceId: data.serviceId || null,
    projectDescription: data.projectDescription || "",
    budgetTimeline: data.budgetTimeline || data.budget || "Flexible",
    contactInfo: data.contactInfo || data.contact || "N/A",
    quoteEstimate: data.quoteEstimate || null,
    currency: data.currency || "USD",
    status: "new",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  // 1. Always save in resilient local JSON
  leads.unshift(newLead);
  saveLeads(leads);
  logger.info(`New lead created locally: ${leadId} for user ${data.telegramId}`);

  // 2. Selectively persist in MongoDB if connected
  if (isConnected()) {
    try {
      await Lead.create({
        leadId: newLead.leadId,
        telegramId: newLead.telegramId,
        customerName: newLead.customerName,
        serviceType: newLead.serviceType,
        projectDescription: newLead.projectDescription,
        budgetTimeline: newLead.budgetTimeline,
        contactInfo: newLead.contactInfo,
        quoteEstimate: newLead.quoteEstimate,
        currency: newLead.currency,
        status: newLead.status,
      });
      logger.info(`Lead ${leadId} successfully written to MongoDB.`);
    } catch (err) {
      logger.warn(`Failed to write lead ${leadId} to MongoDB: ${err.message}`);
    }
  }

  // Also create a linked quotation record if service is known
  if (data.serviceId || data.quoteEstimate) {
    createQuoteRecord(newLead);
  }

  return newLead;
}

function createQuoteRecord(lead) {
  const quotes = getAllQuotes();
  const quoteId = `quote_${Date.now()}`;
  const service = lead.serviceId ? getServiceById(lead.serviceId) : null;
  const basePrice = service ? service.startingPrice : (lead.quoteEstimate || 0);

  const newQuote = {
    quoteId,
    leadId: lead.leadId,
    telegramId: lead.telegramId,
    customerName: lead.customerName,
    serviceId: lead.serviceId,
    serviceName: service ? service.name : lead.serviceType,
    estimatedPrice: basePrice,
    currency: service ? service.currency : (lead.currency || "USD"),
    status: "draft",
    createdAt: new Date().toISOString(),
  };

  quotes.unshift(newQuote);
  saveQuotes(quotes);
  return newQuote;
}

function getLeadById(leadId) {
  return getAllLeads().find((l) => l.leadId === leadId) || null;
}

async function updateLeadStatus(leadId, newStatus) {
  const allowed = ["new", "contacted", "qualified", "proposal", "won", "lost"];
  if (!allowed.includes(newStatus)) return null;

  const leads = getAllLeads();
  const lead = leads.find((l) => l.leadId === leadId);
  if (!lead) return null;

  lead.status = newStatus;
  lead.updatedAt = new Date().toISOString();
  saveLeads(leads);

  if (isConnected()) {
    Lead.updateOne({ leadId }, { $set: { status: newStatus, updatedAt: new Date() } })
      .catch((err) => logger.warn(`Failed to update lead status in MongoDB: ${err.message}`));
  }

  return lead;
}

function getLeadSummary() {
  const leads = getAllLeads();
  const summary = {
    total: leads.length,
    new: 0,
    contacted: 0,
    qualified: 0,
    proposal: 0,
    won: 0,
    lost: 0,
  };

  for (const l of leads) {
    const st = l.status || "new";
    if (summary[st] !== undefined) {
      summary[st]++;
    } else {
      summary.new++;
    }
  }

  return summary;
}

async function syncPendingLeadsToDB() {
  if (!isConnected()) return;
  const localLeads = getAllLeads();
  for (const l of localLeads) {
    try {
      const exists = await Lead.findOne({ leadId: l.leadId });
      if (!exists) {
        await Lead.create({
          leadId: l.leadId,
          telegramId: l.telegramId,
          customerName: l.customerName,
          serviceType: l.serviceType,
          projectDescription: l.projectDescription,
          budgetTimeline: l.budgetTimeline,
          contactInfo: l.contactInfo,
          quoteEstimate: l.quoteEstimate,
          currency: l.currency,
          status: l.status,
        });
        logger.info(`Synced pending local lead ${l.leadId} to MongoDB Atlas.`);
      }
    } catch (err) {
      logger.warn(`Failed to sync lead ${l.leadId} to DB: ${err.message}`);
    }
  }
}

module.exports = {
  createLead,
  getAllLeads,
  getLeadById,
  updateLeadStatus,
  getLeadSummary,
  getAllQuotes,
  syncPendingLeadsToDB,
};
