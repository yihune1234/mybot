const natural = require("natural");
const Sentiment = require("sentiment");
const logger = require("../utils/logger");
const {
  INTENT_SERVICES,
  INTENT_PORTFOLIO,
  INTENT_QUOTE,
  INTENT_CONTACT,
  INTENT_GREETING,
  INTENT_HELP,
  INTENT_GOODBYE,
  INTENT_THANKS,
  INTENT_JOKE,
  INTENT_WEATHER,
  INTENT_TIME,
  INTENT_IDENTITY,
} = require("../utils/constants");

const sentimentAnalyzer = new Sentiment();
let classifier = new natural.BayesClassifier();

// Comprehensive Intent Definitions with Multilingual Triggers (English, Afaan Oromoo, Amharic)
const INTENT_DEFINITIONS = {
  [INTENT_SERVICES]: {
    name: INTENT_SERVICES,
    phrases: [
      "what services do you offer", "your services", "services list", "what can you build",
      "web development", "website design", "mobile app", "telegram bot", "backend development",
      "system architecture", "database design", "rest api development", "full stack developer",
      "tajaajila maal qabda", "tajaajiloota kee", "sirna ijaaruu", "appii hojjechuu", "weebsaayitii",
      "የምትሰጣቸው አገልግሎቶች", "የስራ ዘርፎች", "ድህረ ገጽ መስራት", "ድህረ ገጽ ማሰራት እፈልጋለሁ", "የሞባይል መተግበሪያ", "ቴሌግራም ቦት"
    ],
    keywords: [
      "service", "services", "web", "website", "websites", "app", "apps", "mobile",
      "application", "applications", "bot", "bots", "telegram", "telegram bot",
      "backend", "frontend", "fullstack", "full-stack", "system", "systems", "architecture",
      "database", "databases", "api", "apis", "rest", "restful", "node", "nodejs",
      "react", "django", "python", "php", "coding", "software", "dev", "developer",
      "tajaajila", "tajaajiloota", "ijaarsa", "sirna", "dandeettii", "weebsaayitii",
      "appii", "moobaayilii", "koodii",
      "አገልግሎት", "አገልግሎቶች", "ድህረ ገጽ", "ዌብሳይት", "መተግበሪያ", "አፕሊኬሽን", "ሞባይል",
      "ቦት", "ቴሌግራም", "ሲስተም", "ዳታቤዝ", "ሶፍትዌር"
    ],
  },

  [INTENT_PORTFOLIO]: {
    name: INTENT_PORTFOLIO,
    phrases: [
      "show me your portfolio", "past work", "previous projects", "github repo", "code samples",
      "what have you built", "live demo", "examples of work", "case studies", "show portfolio",
      "hojiilee kee na agarsiisi", "pirojektii duraanii", "fakkeenya hojii", "muuxannoo hojii",
      "ስራዎችህን አሳየኝ", "የሰራሃቸው ፕሮጀክቶች", "ፖርትፎሊዮ", "ያለፉ ስራዎች", "ምሳሌዎች"
    ],
    keywords: [
      "portfolio", "project", "projects", "work", "works", "past work", "previous work",
      "demo", "demos", "github", "sample", "samples", "example", "examples", "showcase",
      "repo", "repos", "repository", "repositories", "experience", "built", "showcase",
      "hojii", "hojiilee", "pirojektii", "pirojektiiwwan", "muuxannoo", "agarsiisa",
      "ፖርትፎሊዮ", "ስራዎች", "ሥራዎች", "ፕሮጀክት", "ፕሮጀክቶች", "ጊትሃብ", "ማሳያ", "ምሳሌ"
    ],
  },

  [INTENT_QUOTE]: {
    name: INTENT_QUOTE,
    phrases: [
      "how much does it cost", "request a quote", "price estimate", "hire you", "build a project for me",
      "what is your price", "how much for a website", "how much for a bot", "project budget",
      "how much is the price", "how much for website", "price for website", "cost for website",
      "gatiin meeqa", "baasii meeqa", "tilmaama gatii", "si qacaruu barbaada", "kaffaltiin akkam",
      "ዋጋው ስንት ነው", "ዋጋ ማወቅ ፈልጌ ነበር", "ማሰራት እፈልጋለሁ", "የክፍያ ሁኔታ", "ግምት"
    ],
    keywords: [
      "quote", "price", "prices", "pricing", "cost", "costs", "budget", "estimate",
      "estimation", "hire", "hiring", "build", "order", "consultation", "charge",
      "rate", "rates", "fee", "fees", "contract", "proposal", "how much", "cheap", "expensive",
      "gatii", "kaffaltii", "baasii", "tilmaama", "qacaruu", "meeqa", "hojjisiisuu",
      "ዋጋ", "ክፍያ", "ስንት ነው", "ማሰራት", "የዋጋ ዝርዝር", "ግምት", "ቀጥር"
    ],
  },

  [INTENT_CONTACT]: {
    name: INTENT_CONTACT,
    phrases: [
      "contact yihune", "how can i reach you", "give me your email", "phone number",
      "telegram username", "talk to human", "speak with developer", "reach out", "send a message",
      "yihune quunnamuu", "akkamiin si quunnama", "bilbila kee", "imeelii kee",
      "አድራሻህን ስጠኝ", "ስልክ ቁጥር", "ኢሜይል", "እንዴት ላግኝህ", "ቀጥታ መገናኘት"
    ],
    keywords: [
      "contact", "reach", "email", "mail", "phone", "call", "telephone", "telegram",
      "handle", "support", "human", "talk", "speak", "person", "message", "chat",
      "linkedin", "inquiry", "connect",
      "quunnamuu", "qunnamtii", "bilbila", "teessoo", "ergaa", "quunnamaa",
      "አግኝ", "መገናኘት", "አድራሻ", "ስልክ", "ኢሜይል", "ደውል"
    ],
  },

  [INTENT_GREETING]: {
    name: INTENT_GREETING,
    phrases: [
      "hello", "hi", "hey", "good morning", "good afternoon", "good evening",
      "what's up", "howdy", "sup", "yo", "nice to meet you",
      "akkam", "akkam jirtu", "asham", "nagaa", "baga nagaan dhufte",
      "ሰላም", "ጤና ይስጥልኝ", "እንደምን አለህ", "ሰላም ጤና"
    ],
    keywords: [
      "hello", "hi", "hey", "start", "salam", "selam", "akkam", "asham", "nagaa",
      "morning", "evening", "afternoon", "howdy", "yo", "sup", "greetings",
      "ሰላም", "ሰላምታ", "ሃይ", "ጤና"
    ],
  },

  [INTENT_HELP]: {
    name: INTENT_HELP,
    phrases: [
      "help me", "what can you do", "show menu", "commands", "options", "how do you work",
      "na gargaari", "maal goota", "ajajoota", "qajeelfama",
      "እርዳኝ", "ምን ትሰራለህ", "ዝርዝር", "አማራጮች"
    ],
    keywords: [
      "help", "commands", "menu", "options", "features", "guide", "info", "capabilities",
      "instructions", "assist", "gargaarsa", "gargaari", "ajajoota", "qajeelfama",
      "እርዳታ", "እርዳኝ", "ምን", "ዝርዝር"
    ],
  },

  [INTENT_GOODBYE]: {
    name: INTENT_GOODBYE,
    phrases: [
      "bye", "goodbye", "see you later", "catch you later", "take care", "good night", "cya",
      "nagaatti", "baga nagaan deemi", "wal agarra",
      "ደህና ሁን", "ቻው", "ደህና እደር"
    ],
    keywords: [
      "bye", "goodbye", "cya", "night", "later", "peace", "nagaatti", "wal agarra", "ቻው", "ደህና"
    ],
  },

  [INTENT_THANKS]: {
    name: INTENT_THANKS,
    phrases: [
      "thank you", "thanks", "thx", "appreciate it", "thank you so much", "thanks bro",
      "galatoomi", "galatoomaa", "baay'ee galatoomi",
      "አመሰግናለሁ", "እግዜር ይስጥልኝ", "ተመስገን"
    ],
    keywords: [
      "thanks", "thank", "thx", "ty", "appreciate", "grateful", "galatoomi", "galatoomaa", "አመሰግናለሁ"
    ],
  },

  [INTENT_JOKE]: {
    name: INTENT_JOKE,
    phrases: [
      "tell me a joke", "make me laugh", "say something funny", "give me a joke", "crack a joke",
      "waan kolfaa naaf himi", "na kolfisi", "kolfa",
      "ቀልድ ንገረኝ", "አስቀኝ", "ቀልድ"
    ],
    keywords: [
      "joke", "jokes", "funny", "laugh", "humor", "comedy", "crack", "kolfa", "qoosaa", "ቀልድ"
    ],
  },

  [INTENT_WEATHER]: {
    name: INTENT_WEATHER,
    phrases: [
      "weather today", "what is the weather", "temperature", "is it raining", "weather forecast",
      "haala qilleensaa", "qilleensi akkami", "roobaa jiraa",
      "የአየር ሁኔታ", "ዝናብ አለ", "ሙቀት"
    ],
    keywords: [
      "weather", "forecast", "temperature", "rain", "raining", "sunny", "cold", "hot", "climate",
      "qilleensa", "rooba", "ho'ina", "የአየር", "ሁኔታ", "ዝናብ", "ሙቀት"
    ],
  },

  [INTENT_TIME]: {
    name: INTENT_TIME,
    phrases: [
      "what time is it", "current time", "tell me the time", "time now",
      "sa'aatiin meeqa", "sa'aatii amma",
      "ሰዓቱ ስንት ነው", "አሁን ስንት ሰዓት ነው"
    ],
    keywords: [
      "time", "clock", "sa'aatii", "ሰዓት"
    ],
  },

  [INTENT_IDENTITY]: {
    name: INTENT_IDENTITY,
    phrases: [
      "who are you", "who made you", "what are you", "who created you", "tell me about yihune",
      "atu eenyu", "eenyutu si hojjate", "waa'ee kee",
      "ማነህ", "ማን ሰራህ", "ስለ አንተ"
    ],
    keywords: [
      "identity", "creator", "created", "built", "who", "yihune", "eenyu", "ማነህ", "ሰሪ"
    ],
  },
};

// Train initial Bayes classifier as a secondary ensemble signal
function trainClassifier() {
  classifier = new natural.BayesClassifier();
  for (const [intentName, def] of Object.entries(INTENT_DEFINITIONS)) {
    for (const phrase of def.phrases) {
      classifier.addDocument(phrase, intentName);
    }
    for (const kw of def.keywords) {
      classifier.addDocument(kw, intentName);
    }
  }
  classifier.train();
  logger.info(`🧠 NLU classifier trained with ${Object.keys(INTENT_DEFINITIONS).length} intents`);
}

trainClassifier();

function normalizeText(text) {
  if (!text) return "";
  return text
    .toLowerCase()
    .replace(/[?!.,;:"'()[\]{}#@$%&*+=/\\<>~`^|_-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(text) {
  const norm = normalizeText(text);
  if (!norm) return [];
  return norm.split(" ").filter((w) => w.length > 0);
}

/**
 * Intelligent Local Intent Parser
 * Performs fuzzy keyword scoring, phrase matching, and Bayes ensemble voting.
 */
function parseIntent(rawText) {
  if (!rawText || typeof rawText !== "string") {
    return {
      intent: "unknown",
      confidence: 0,
      rawScore: 0,
      matchedKeywords: [],
      sentiment: { score: 0, comparative: 0 },
    };
  }

  const clean = normalizeText(rawText);
  const tokens = tokenize(rawText);
  const sentiment = analyzeSentiment(rawText);

  if (tokens.length === 0) {
    return {
      intent: "unknown",
      confidence: 0,
      rawScore: 0,
      matchedKeywords: [],
      sentiment,
    };
  }

  const scores = {};
  const matchedWords = {};

  for (const intentName of Object.keys(INTENT_DEFINITIONS)) {
    scores[intentName] = 0;
    matchedWords[intentName] = new Set();
  }

  // 1. Check exact phrase matches (high weight)
  for (const [intentName, def] of Object.entries(INTENT_DEFINITIONS)) {
    for (const phrase of def.phrases) {
      const normPhrase = normalizeText(phrase);
      if (clean === normPhrase) {
        scores[intentName] += 3.5;
        matchedWords[intentName].add(phrase);
      } else if (clean.includes(normPhrase)) {
        scores[intentName] += 2.5;
        matchedWords[intentName].add(phrase);
      }
    }
  }

  // Explicit pricing question booster
  if (/\b(how much|cost of|pricing|price of|price for|how much is|gatiin meeqa|gatii meeqa|baasii meeqa|ዋጋው ስንት|ስንት ነው)\b/i.test(clean)) {
    scores[INTENT_QUOTE] += 2.5;
    matchedWords[INTENT_QUOTE].add("pricing inquiry");
  }

  // 2. Token-level keyword matching & fuzzy matching
  for (const token of tokens) {
    for (const [intentName, def] of Object.entries(INTENT_DEFINITIONS)) {
      for (const kw of def.keywords) {
        const normKw = normalizeText(kw);

        // Exact token match
        if (token === normKw) {
          scores[intentName] += 1.2;
          matchedWords[intentName].add(kw);
          continue;
        }

        // Substring match for longer words
        if (normKw.length > 4 && token.length > 4) {
          if (token.includes(normKw) || normKw.includes(token)) {
            scores[intentName] += 0.8;
            matchedWords[intentName].add(kw);
            continue;
          }
        }

        // Fuzzy match via Jaro-Winkler Distance (tolerance for typos)
        if (normKw.length >= 4 && token.length >= 4) {
          try {
            const dist = natural.JaroWinklerDistance(token, normKw);
            if (dist >= 0.86) {
              scores[intentName] += 0.9 * dist;
              matchedWords[intentName].add(kw);
            }
          } catch (_) {}
        }
      }
    }
  }

  // 3. Bayes Ensemble Signal
  let bayesTop = null;
  let bayesConfidence = 0;
  try {
    const classifications = classifier.getClassifications(clean);
    if (classifications && classifications.length > 0) {
      bayesTop = classifications[0].label;
      const topVal = classifications[0].value;
      const secVal = classifications[1]?.value || 0.0001;
      bayesConfidence = Math.min(topVal / (topVal + secVal || 1), 1.0);
      if (scores[bayesTop] !== undefined && bayesConfidence > 0.55) {
        scores[bayesTop] += 1.0 * bayesConfidence;
      }
    }
  } catch (_) {}

  // 4. Find highest scoring intent
  let topIntent = "unknown";
  let topScore = 0;
  let secondScore = 0;

  for (const [intentName, score] of Object.entries(scores)) {
    if (score > topScore) {
      secondScore = topScore;
      topScore = score;
      topIntent = intentName;
    } else if (score > secondScore) {
      secondScore = score;
    }
  }

  // 5. Calculate calibrated confidence (0.0 to 1.0)
  let confidence = 0;
  if (topScore > 0) {
    const matchCount = matchedWords[topIntent] ? matchedWords[topIntent].size : 0;
    
    // Base confidence from topScore and token density
    const densityRatio = Math.min(topScore / (tokens.length * 1.2 || 1), 1.0);
    const scoreMargin = topScore - secondScore;
    const uniqueness = topScore > 0 ? Math.min(scoreMargin / topScore, 1.0) : 0;

    confidence = 0.35 * densityRatio + 0.35 * Math.min(topScore / 2.5, 1.0) + 0.3 * uniqueness;

    // Boost if multiple distinct keywords or an exact phrase matched
    if (matchCount >= 2) confidence = Math.min(confidence + 0.2, 0.98);
    if (matchCount >= 3) confidence = Math.min(confidence + 0.1, 1.0);

    // If Bayes and keyword scoring strongly agree on a significant score
    if (bayesTop === topIntent && topScore >= 1.5) {
      confidence = Math.max(confidence, 0.78);
    }

    confidence = parseFloat(Math.min(confidence, 1.0).toFixed(2));
  }

  return {
    intent: topScore > 0 ? topIntent : "unknown",
    confidence,
    rawScore: parseFloat(topScore.toFixed(2)),
    matchedKeywords: matchedWords[topIntent] ? Array.from(matchedWords[topIntent]) : [],
    sentiment,
  };
}

/**
 * Backward-compatible helper that returns top intent name or "unknown"
 */
function classifyIntent(text) {
  const result = parseIntent(text);
  if (result.confidence >= 0.4) {
    return result.intent;
  }
  return "unknown";
}

function analyzeSentiment(text) {
  try {
    const result = sentimentAnalyzer.analyze(text);
    return {
      score: result.score,
      comparative: result.comparative,
      negative: result.negative,
      positive: result.positive,
    };
  } catch (err) {
    return { score: 0, comparative: 0, negative: [], positive: [] };
  }
}

function retrainClassifier() {
  trainClassifier();
}

module.exports = {
  parseIntent,
  classifyIntent,
  analyzeSentiment,
  retrainClassifier,
  INTENT_DEFINITIONS,
};
