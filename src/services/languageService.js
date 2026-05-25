const logger = require("../utils/logger");

const OROMO_INDICATORS = [
  "akkam", "akkam?", "akkamitti", "akkamuma", "asham", "attam", "attam?",
  "nagaa", "nagaatti", "nagaan", "baga", "bultii", "bultii gaarii",
  "guyyaa", "guyyaa gaarii", "qabanna", "wal agarra", "tuta", "tuta gaarii",
  "galatoomi", "galatooma", "beenyaa", "galateeffadhu",
  "jirta", "jirtuu", "jira", "jirtu", "jirani",
  "maali", "maal", "maaliif", "maalif", "maalfakkata",
  "eenyu", "eenyutu", "eessa", "eessaa", "yoom",
  "dhugaa", "dhuguma", "dhugumatti", "sirrii", "sirriitti",
  "tole", "tola", "bayye", "bayyeen", "baay'ee", "hedduu",
  "waan", "waantokko", "waantota", "waa'ee", "waaee",
  "kana", "sana", "kanarra", "sanarra", "kanaaf", "sanaaf",
  "hojii", "hojjetta", "hojjachuu", "hojjadhu",
  "odeeffannoo", "oduu", "oduu gaarii",
  "yaada", "yaaduu", "yaadni", "yaadee",
  "gaafii", "gaafannaa", "gaafadhu", "gaafatte",
  "deebii", "deebisi", "deebisee",
  "beekta", "beeku", "beekumsa", "beekuu",
  "fedha", "fedhii", "fedhuu",
  "dandeessa", "dandeessaa", "danda'uu",
  "qaba", "qabdu", "qabna", "qabnu",
  "turuu", "turee", "turani",
  "dhufuu", "dhuftee", "dhufne", "dhufani",
  "deemuu", "deemta", "deemne", "deemani",
  "jechuu", "jettee", "jedhe", "jedhan",
  "fakkata", "fakkaata", "fakkaatti",
  "namni", "namicha", "namoota",
  "gara", "gadhi", "ol", "jala", "irra",
  "keessa", "keessatti", "irratti", "irrattis",
  "ammoo", "immoo", "garuu", "hata'u malee",
  "kanaafuu", "sanaafuu", "kanaan",
  "waa", "waan", "waantokko",
  "hin", "nan", "si", "isin", "nu", "keenya", "keessan",
  "kophe", "kophee", "kophaa",
  "gammadaa", "gammadee", "gammachuu",
  "gadda", "gaddaa", "gaddisee",
  "sodaataa", "sodaa", "sodaadhu",
  "jaalala", "jaaladhaa", "jaaladhu",
  "jibba", "jibbita", "jibbuu",
  "nyaata", "nyaachuu", "nyaadhu",
];

const ENGLISH_INDICATORS = [
  "the", "a", "an", "is", "are", "was", "were",
  "do", "does", "did", "has", "have", "had",
  "i", "you", "he", "she", "it", "we", "they",
  "me", "him", "her", "us", "them", "my", "your",
  "this", "that", "these", "those",
  "in", "on", "at", "for", "to", "with", "by", "from", "of", "about",
  "and", "or", "but", "so", "because", "if", "when", "while",
  "what", "why", "how", "where", "which", "who", "whom",
  "please", "thanks", "thank", "yes", "no", "okay", "ok",
  "can", "could", "will", "would", "shall", "should", "may", "might",
  "not", "don't", "can't", "won't", "wouldn't", "couldn't",
  "just", "very", "really", "quite", "too", "also", "even",
  "tell", "ask", "know", "think", "want", "need", "like", "love",
  "going", "doing", "saying", "making", "taking", "coming",
  "actually", "basically", "honestly", "literally", "seriously",
  "hello", "hey", "hi", "bye", "goodbye", "thanks", "sorry",
  "please", "yes", "no", "maybe", "sure", "right", "cool", "nice",
];

function detectLanguage(text) {
  if (!text || text.trim().length === 0) return "unknown";

  const lower = text.toLowerCase().trim();
  const words = lower.split(/\s+/).filter(Boolean);

  if (words.length === 0) return "unknown";

  let oromoScore = 0;
  let englishScore = 0;

  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, "");
    if (OROMO_INDICATORS.includes(clean)) oromoScore += 3;
    if (ENGLISH_INDICATORS.includes(clean)) englishScore += 1;
  }

  for (const indicator of OROMO_INDICATORS) {
    if (lower.includes(indicator)) oromoScore += 2;
  }

  const oromoCharScore = countOromoCharPatterns(lower, words);
  oromoScore += oromoCharScore;

  if (/,?|\.|!|\?/.test(lower)) englishScore += 0.5;

  if (oromoScore > englishScore && oromoScore >= 2) return "oromo";
  if (englishScore > oromoScore && englishScore >= 2) return "english";

  if (oromoScore > 0 && englishScore > 0) return "mixed";
  return "english";
}

function countOromoCharPatterns(text, words) {
  let score = 0;

  const xCount = (text.match(/x/g) || []).length;
  if (xCount > 1) score += Math.min(xCount, 4);

  const qCount = (text.match(/q/g) || []).length;
  if (qCount > 1) score += Math.min(qCount, 3);

  const dhCount = (text.match(/dh/g) || []).length;
  if (dhCount > 0) score += dhCount * 2;

  const chCount = (text.match(/ch/g) || []).length;
  if (chCount > 0) score += chCount;

  const shCount = (text.match(/sh/g) || []).length;
  if (shCount > 0) score += shCount;

  const nyCount = (text.match(/ny/g) || []).length;
  if (nyCount > 0) score += nyCount * 2;

  const phCount = (text.match(/ph/g) || []).length;
  if (phCount > 0) score += phCount;

  let vowelEndCount = 0;
  for (const word of words) {
    const clean = word.replace(/[^a-z]/g, "");
    if (clean.length > 2 && /[aeiou]$/i.test(clean)) {
      const lastTwo = clean.slice(-2);
      if (["aa", "ii", "uu", "ee", "oo"].includes(lastTwo)) {
        vowelEndCount++;
      }
    }
  }
  if (vowelEndCount > words.length * 0.3) score += Math.min(vowelEndCount, 5);

  return score;
}

function needsOromoResponse(text) {
  const lang = detectLanguage(text);
  return lang === "oromo" || lang === "mixed";
}

module.exports = { detectLanguage, needsOromoResponse };
