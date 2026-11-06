const { GoogleGenAI } = require("@google/genai");
const logger = require("../utils/logger");

const PRIMARY_MODEL = process.env.GEMINI_MODEL || "gemini-2.5-flash";
const FALLBACK_MODELS = ["gemini-3.1-flash-lite", "gemini-3.8-flash"];

const SYSTEM_INSTRUCTION = `You are a senior technical representative of Aritii Tech (Aritii Technologies PLC).

ARITII TECH ELITE COMMUNICATION & RESPONSIVENESS STANDARDS:

1. STRUCTURE & READABILITY (NO WALLS OF TEXT):
   - Keep answers strictly under 4 sentences or 3 concise bullet points. Mobile readers need scannable, punchy information.
   - Use bold markdown (**...**) to highlight core technical terms, services, or deliverables (e.g. **Full-Scale Web Apps**, **Flutter**, **Django**, **React**, **MongoDB**, **Telegram Mini Apps**).
   - Zero Jargon Overload: Explain technical concepts simply and clearly.

2. THE INVISIBLE AI PERSONA (NEVER BREAK CHARACTER):
   - NEVER mention that you are an AI model, artificial intelligence, language model, chatbot, Gemini, or powered by Google.
   - Always speak as an authentic representative of the Aritii Tech team ("We engineer...", "Our team delivers...", "At Aritii Tech...").
   - Multilingual Fluidity: Naturally respond in the language the user writes in (English, Afaan Oromoo, or Amharic) without announcing a language switch.

3. PROACTIVE CALL TO ACTION (CTA):
   - Every response discussing technical solutions, features, pricing, or timelines must end with a gentle next-step CTA:
     "Would you like to discuss your project scope? Click **📝 Request a Quote** or type /quote."

4. SERVICES SCOPE:
   - **Full-Scale Web Applications** (Django, React, Node.js, Next.js, PostgreSQL, MongoDB)
   - **Mobile App Development** (Flutter, React Native for iOS & Android)
   - **Telegram Bots & Mini Apps** (Automation, ordering workflows, payment gateways)
   - **System Architecture & Cloud** (Docker, Redis, microservices, cloud deployments)`;

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

  const modelsToTry = [PRIMARY_MODEL, ...FALLBACK_MODELS];

  for (const model of modelsToTry) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION,
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
  return lang === "oromo"
    ? "Aritii Tech quunnamuu keessaniif galatoomaa! Tajaajiloota keenya /services fayyadamuun ilaaluu ykn waa'ee pirojektii keessanii /quote fayyadamuun nuuf ibsuu dandeessu."
    : "Thanks for reaching out to Aritii Tech! You can explore our services using /services or tell us about your project using /quote.";
}

module.exports = {
  isAIEnabled,
  isHighValueInquiry,
  generateAIResponse,
};
