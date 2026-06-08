const natural = require("natural");
const Sentiment = require("sentiment");
const logger = require("../utils/logger");
const { INTENT_CONFIDENCE_MIN_THRESHOLD, INTENT_CONFIDENCE_RATIO } = require("../utils/constants");

const tokenizer = new natural.WordTokenizer();
const sentimentAnalyzer = new Sentiment();

let classifier = new natural.BayesClassifier();

const trainingData = {
  greeting: [
    "hello", "hi", "hey", "good morning", "good evening", "howdy", "what's up",
    "sup", "yo", "greetings", "how are you", "how do you do", "nice to meet you",
    "akkam", "akkam?", "asham", "nagaa", "baga", "bultii", "attam", "attam?",
    "nagaa?", "nagaa gaafachuu", "bultii gaarii", "haa", "tole", "akkam nagaa?",
    "akkam bulte", "akkam bultan", "attam jirta", "akkam jirtuu",
    "nagaa jirtuu", "hoo akkam", "oduu gaarii", "waan taa",
    "whats good", "how is it going", "how's it going", "was good",
  ],
  goodbye: [
    "bye", "goodbye", "see you", "later", "catch you", "talk to you later",
    "good night", "night", "have a good day", "take care", "cya",
    "see you later", "gotta go", "i'm out", "peace", "later gator",
    "nagaatti", "baga nagaan deeme", "hanga guyyaa biraa", "tuta",
    "tutaan wal agarra", "qabanna", "guyyaa gaarii", "olii",
  ],
  thanks: [
    "thanks", "thank you", "ty", "thx", "appreciate it", "thank you so much",
    "thanks a lot", "grateful", "much appreciated", "thanks a bunch",
    "thanks bro", "thanks man", "i appreciate that",
    "galatoomi", "galatooma", "galatoomi baay'ee", "galatoomaa",
    "baay'ee galatoomi", "waanan galateeffadhu", "beenyaa",
  ],
  joke: [
    "tell me a joke", "joke", "make me laugh", "funny", "tell me something funny",
    "crack a joke", "say something funny", "give me a joke", "joke around",
    "kolfa", "na kolfisi", "waan kolfaa", "waan qoosaa",
    "waan qoosaa naaf himi", "naaf kolfi",
  ],
  weather: [
    "weather", "what is the weather", "how is the weather", "temperature",
    "is it raining", "forecast", "weather in", "what's the temperature",
    "how cold is it", "how hot is it", "will it rain", "weather today",
    "haala qilleensaa", "qilleensa", "ho'ina", "rooba",
    "haala qilleensaa akkami", "qilleensi akkami",
  ],
  reminder: [
    "remind me", "set a reminder", "reminder", "don't forget", "remind",
    "set reminder", "remind me to", "set a timer", "wake me up",
    "yaadachiisa", "na yaadachiisi", "yaadachiisaa", "hin dagatin",
    "waan tokko na yaadachiisi",
  ],
  identity: [
    "who are you", "what is your name", "your name", "tell me about yourself",
    "about yourself", "what are you", "describe yourself", "introduce yourself",
    "who made you", "who created you", "what can you do", "your purpose",
    "what services do you offer", "services", "your services",
    "what technologies", "what tech stack", "skills", "technical skills",
    "atu eenyu", "maqaan kee eenyu", "waa'ee keeti himi",
    "maal akka taate himi", "eenyutu si hojjate",
    "maal gochuu dandetta", "tajaajila", "dandeettii",
    "teknoolojii", "maal teknoolojii fayyadamta",
  ],
  smalltalk: [
    "i like", "i love", "i hate", "what do you think", "how are you doing",
    "how old are you", "where are you from", "what are you doing",
    "what do you mean", "tell me more", "i think", "maybe", "really",
    "i feel", "i want", "i need", "i hope", "i wish", "i believe",
    "in my opinion", "what about", "how about", "why not",
    "ani nan beeku", "naaf hin galu", "maal jechuun kee",
    "waan tokko nan yaada", "sirrii", "dhuguma",
  ],
  time: [
    "what time is it", "current time", "what is the time", "tell me the time",
    "time now", "sa'aatii meeqa", "sa'aatii", "yoom sa'aa",
    "sa'aatii amma", "waqtii meeqa",
  ],
  help: [
    "help", "what can you do", "commands", "how do you work", "help me",
    "gargaarsa", "maal gochuu dandetta", "akkamitti hojjatta",
    "gargaarsi", "na gargaar",
  ],
  ai_intent: [
    "how does the ai work", "how does ai work", "how does the bot think",
    "how do you use ai", "do you use ai", "are you ai", "are you using ai",
    "is this ai", "is this chatgpt", "do you use chatgpt", "are you powered by ai",
    "how is ai integrated", "ai integration", "how is the ai set up",
    "what ai do you use", "what ai model", "what engine", "ai engine",
    "tell me about the ai", "explain the ai", "ai architecture", "ai system",
    "how are you intelligent", "how are you smart", "how do you answer",
    "chatgpt integration", "chatgpt connection", "how do you connect to chatgpt",
    "do you use openai", "openai integration", "chatgpt api", "unofficial api",
    "what port does the ai use", "port 3001", "ai server", "how is the server setup",
    "how does the ai server work", "spawn", "child process", "ai process",
    "do you remember conversations", "how does memory work", "how do you remember",
    "ai explanation", "ai how it works", "how the bot works",
    "what is your ai", "ai behind you", "what powers you", "brain of the bot",
    "how are you so smart", "how are you intelligent", "what makes you smart",
    "what technology do you use", "what tech are you built on",
    "akkaataa ai hojjetuu", "ai akkam hojjata", "ai akkaataa hojii",
    "chatgpt fayyadamaa", "chatgpt waliin hidhama", "ai fayyadamtaa",
    "ai sirna", "ai caasaa", "sirni ai akkami", "chatgpt waliin hidhama",
    "akkamitti deebii kennita", "sammuu kee akkam", "ai moo'ela",
    "port 3001 maal", "server ai akkamitti hojjata", "ai server maal",
    "sammuu kee akkamitti hojjata", "deebii ogeessa akkamitti kennita",
  ],
};

function trainClassifier() {
  classifier = new natural.BayesClassifier();
  for (const [intent, phrases] of Object.entries(trainingData)) {
    for (const phrase of phrases) {
      classifier.addDocument(phrase, intent);
    }
  }
  classifier.train();
  logger.info(`🧠 NLU classifier trained with ${Object.keys(trainingData).length} intents`);
}

trainClassifier();

function classifyIntent(text) {
  const lower = text.toLowerCase().trim();

  // First check ai_intent phrases explicitly (before generic intent matching)
  // This prevents phrases like "how are you so smart" from being caught by greeting
  for (const phrase of trainingData.ai_intent || []) {
    if (lower === phrase || lower.startsWith(phrase + " ") || lower.endsWith(" " + phrase) || lower.includes(" " + phrase + " ")) {
      return "ai_intent";
    }
  }

  for (const [intent, phrases] of Object.entries(trainingData)) {
    if (intent === "ai_intent") continue; // already checked above
    for (const phrase of phrases) {
      if (lower === phrase || lower.startsWith(phrase + " ") || lower.endsWith(" " + phrase) || lower.includes(" " + phrase + " ")) {
        return intent;
      }
    }
  }

  const classifications = classifier.getClassifications(lower);
  if (!classifications || classifications.length < 2) return "unknown";

  const top = classifications[0];
  const second = classifications[1];

  if (top.value > INTENT_CONFIDENCE_MIN_THRESHOLD && top.value / second.value >= INTENT_CONFIDENCE_RATIO) {
    return top.label;
  }
  return "unknown";
}

function analyzeSentiment(text) {
  const result = sentimentAnalyzer.analyze(text);
  return {
    score: result.score,
    comparative: result.comparative,
    negative: result.negative,
    positive: result.positive,
  };
}

function retrainClassifier() {
  trainClassifier();
}

module.exports = {
  classifyIntent,
  analyzeSentiment,
  retrainClassifier,
  trainingData,
};
