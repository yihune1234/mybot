const { GoogleGenAI } = require("@google/genai");
const logger = require("../utils/logger");

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];

const SYSTEM_INSTRUCTION = `You are a senior technical representative of Ariiti Tech (Ariiti Technologies PLC).
Positioning: Business Technology Partner & Digital Solutions Provider.
Brand Message: Building digital solutions for better businesses.
Description: Ariiti Tech provides software development, digital products, e-commerce solutions, and business automation systems to help businesses and individuals improve their operations through technology.

ARIITI TECH COMMUNICATION STANDARDS:

1. STRUCTURE & READABILITY:
   - Keep answers strictly under 4 sentences or concise bullet points. Mobile readers need scannable, punchy information.
   - Use bold markdown (**...**) to highlight core technical terms or services.
   - Zero Jargon Overload: Explain technical concepts simply and clearly.

2. PROFESSIONAL PERSONA:
   - NEVER mention that you are an AI model, artificial intelligence, language model, chatbot, or Gemini.
   - Always speak as an authentic representative of the Ariiti Tech team ("We engineer...", "Our team delivers...", "At Ariiti Tech...").
   - Naturally respond in the language the user writes in (English, Afaan Oromoo, or Amharic).

3. CALL TO ACTION:
   - Every response discussing technical solutions or services should end with:
     "Would you like to discuss your project scope? Click **📝 Request a Service** or type /quote."

4. SERVICES SCOPE:
   - **Software Development** (Website development, Web applications, Mobile apps, Custom software systems)
   - **E-commerce Solutions** (Online stores, Marketplace platforms, Digital commerce)
   - **Business Automation** (POS systems, Inventory management, Billing and management, Business process automation)
   - **Digital Innovation** (System integrations, Digital transformation, Custom digital solutions)`;

const HIGH_VALUE_KEYWORDS = [
  "budget",
  "enterprise",
  "custom system",
  "price",
  "cost",
  "hire",
  "quote",
  "estimate",
  "ecommerce",
  "e-commerce",
  "payment",
  "mvp",
  "app",
  "mobile",
  "database",
  "architecture",
  "scale"
];

function isAIEnabled() {
  const enabled = process.env.AI_ENABLED !== "false";
  const hasKey = !!(process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY);
  return enabled && hasKey;
}

function isHighValueInquiry(text) {
  if (!text || typeof text !== "string") return false;
  const lower = text.toLowerCase();
  return HIGH_VALUE_KEYWORDS.some((kw) => lower.includes(kw));
}

let genAIClient = null;

function getClient() {
  if (!genAIClient) {
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY;
    if (!apiKey) return null;
    genAIClient = new GoogleGenAI({ apiKey });
  }
  return genAIClient;
}

async function generateAIResponse(userMessage, history = [], lang = "english") {
  if (!isAIEnabled()) {
    logger.debug("AI is disabled or API key missing.");
    return null;
  }

  const ai = getClient();
  if (!ai) return null;

  // Build conversational context
  let contents = [];
  if (Array.isArray(history) && history.length > 0) {
    for (const item of history.slice(-4)) {
      if (item.sender === "user" || item.role === "user") {
        contents.push({ role: "user", parts: [{ text: item.text || item.content || "" }] });
      } else if (item.sender === "bot" || item.role === "model") {
        contents.push({ role: "model", parts: [{ text: item.text || item.content || "" }] });
      }
    }
  }

  // Add the latest user message
  contents.push({ role: "user", parts: [{ text: userMessage }] });

  // Dynamically load live business details (location, contacts, about) from MongoDB / cache
  let dynamicInstruction = SYSTEM_INSTRUCTION;
  try {
    const { getConfig } = require("./businessConfigService");
    const cfg = getConfig();
    const c = cfg?.company || {};
    dynamicInstruction += `\n\nCURRENT COMPANY DETAILS (Use when asked about location, contact, or hours):
- Location / Headquarters: ${c.location || "Addis Ababa, Ethiopia"}
- Operating Hours: ${c.operatingHours || "Mon-Fri 8:30 AM - 5:30 PM EAT"}
- Telegram Contact: ${c.telegramContact || c.telegram || "@Yihun2bel"}
- Email: ${c.email || "contact@arititech.com"}
- Phone: ${c.phone || "+251911000000"}
- Website: ${c.website || "https://ariti.com"}
- About: ${c.about || "Ariiti Technologies PLC delivers elite software engineering tailored to your business goals."}`;
  } catch (e) {
    // Graceful fallback to static SYSTEM_INSTRUCTION
  }

  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: dynamicInstruction,
          temperature: 0.35,
          maxOutputTokens: 250,
        },
      });

      const reply = response?.text;
      if (reply && typeof reply === "string" && reply.trim().length > 0) {
        return reply.trim();
      }
    } catch (err) {
      logger.debug(`Gemini model ${model} attempt failed: ${err.message}`);
      // Continue to fallback model
    }
  }

  logger.warn("All Gemini model attempts exhausted or unavailable. Returning polite standard response.");
  if (lang === "oromo") {
    return "Ariiti Tech quunnamuu keessaniif galatoomaa! Tajaajiloota keenya /services fayyadamuun ilaaluu ykn waa'ee pirojektii keessanii /quote fayyadamuun nuuf ibsuu dandeessu.";
  }
  if (lang === "amharic") {
    return "አሪቲ ቴክን ስላነጋገሩ እናመሰግናለን! አገልግሎቶቻችንን በ /services መመልከት ወይም የፕሮጀክትዎን ፍላጎት በ /quote ማቅረብ ይችላሉ።";
  }
  return "Thanks for reaching out to Ariiti Tech! You can explore our services using /services or tell us about your project using /quote.";
}

module.exports = {
  isAIEnabled,
  isHighValueInquiry,
  generateAIResponse,
};
