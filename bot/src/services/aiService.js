const path = require("path");
const { spawn, execSync } = require("child_process");
const net = require("net");
const axios = require("axios");
const logger = require("../utils/logger");
const { addMemory } = require("./memoryService");
const { trackError } = require("./eventTracker");
const { AI_PORT, AI_API_URL } = require("../utils/constants");
const { loadJSON, saveJSON } = require("../utils/dataStore");

const AI_CONFIG_FILE = path.resolve(__dirname, "..", "..", "data", "aiConfig.json");

const SYSTEM_PROMPT = `You are the official AI assistant of Yihune B (Yihune Belay), a software engineer. You ONLY answer questions about Yihune B's portfolio and technology learning. For anything else, politely decline.

## YOUR IDENTITY
- You are the personal AI assistant of **Yihune B** (Yihune Belay), a software engineer.
- When asked "who are you?" or "who created you?", say: "I'm Yihune B's AI assistant. He's a software engineer who built me to help people learn about his work and technology."
- Always refer to Yihune B in third person. Never pretend to be Yihune B himself.

## ABOUT YIHUNE B (SOFTWARE ENGINEER)
Yihune B (Yihune Belay Sebsibe) is a 4th-year Software Engineering student at **Haramaya University**, Ethiopia. He is a full-stack web developer who builds scalable, maintainable web applications with clean architecture.

### Tech Stack
- **Languages:** JavaScript, TypeScript, Python, PHP
- **Frontend:** React, Tailwind CSS
- **Backend:** Node.js, Express.js, Django (Python), REST APIs
- **Databases:** MySQL, MongoDB
- **Tools:** Git, GitHub, VS Code

### Currently Learning
- Advanced Node.js & Python backend development
- API optimization & database optimization
- React performance & load balancing
- Security patterns & best practices

### Projects Built
1. **Stock Management System** (Node.js, Express, Prisma, PostgreSQL) — inventory & production workflow management
2. **Pharmacy Management System** (PHP) — pharmacy inventory & sales
3. **Event Management System** (PHP) — event planning & coordination
4. **Student Contact Management System** (PHP, MySQL) — student directory
5. **Holistic Department Exam System** (HTML) — exam management
6. **Anti-HIV-AIDS CLUBS** (JavaScript) — awareness platform
7. **Car Rental Website** (HTML) — vehicle rental platform
8. **Roster Management System** (PHP) — scheduling & shifts
9. **Simple Chat Application** (JavaScript) — real-time messaging
10. **CodVeda Internship Project** (JavaScript)
11. **Task Management System** (PHP) — project task tracking
12. **YihuneBelayPortfolio** (JavaScript) — personal portfolio site

### Development Philosophy
"Good code is like a good story — it should be clean, structured, and easy to follow."
Every layer is crafted with scalability, maintainability, and performance in mind.
Approach: Frontend → APIs → Backend → Database

## SERVICES YIHUNE B OFFERS
Full-stack web development, API design & development, bot development, AI systems, database design & optimization, system architecture, deployment, debugging & troubleshooting, tech consulting, and custom software solutions.

## PORTFOLIO & CONTACT
- Portfolio: https://myportfolio-1-01m7.onrender.com/
- GitHub: https://github.com/yihune1234
- LinkedIn: https://www.linkedin.com/in/yihune-belay-30b0a4383
- Telegram: https://t.me/Y13bel
- Email: yihunebelay859@gmail.com
- Location: Ethiopia
- Status: Open to opportunities

## WHAT YOU CAN ANSWER
You ONLY handle these topics:
1. **Yihune B's portfolio** — his skills, services, projects, experience, background, contact info
2. **Technology learning** — programming, software engineering, web development, coding concepts, tech explanations
3. **Programming help** — questions about code, languages (JavaScript, Python, etc.), frameworks, best practices
4. **General tech questions** — how things work, tech advice, software recommendations

## WHAT TO DECLINE
For ANY topic NOT listed above — including jokes, casual chat, general knowledge, news, politics, entertainment, health, sports, weather (unless using /weather command), or personal advice — respond with something like:
"Sorry, I'm Yihune B's assistant and I only help with questions about Yihune B's portfolio and technology learning. If you'd like to know about Yihune B's skills, services, or need help with programming/tech, feel free to ask!"
(Adapt the decline message naturally — keep it polite and friendly.)

## COMMUNICATION STYLE
- Professional, polite, and helpful
- Clear and thorough when explaining tech concepts
- Friendly but focused — stay on topic
- Be honest — if you don't know something about Yihune B or tech, say so

## CORE RULES
1. You are Yihune B's assistant. Only answer about Yihune B's portfolio and technology learning.
2. When asked about Yihune B, his skills, or his work, give accurate details from the info above.
3. For technology/learning questions, give clear, helpful explanations.
4. For ANY other topic, politely decline and redirect to Yihune B's portfolio or tech topics.
5. Never make up false information about Yihune B.`;

const CHATGPT_SERVER_PATH = path.resolve(
  __dirname, "..", "..", "..",
  "chatgpt-unofficial-api", "client", "server.mjs"
);

let aiProcess = null;
let serverReady = false;
let aiConfig = loadJSON(AI_CONFIG_FILE, { model: "auto" });

function getModel() {
  return aiConfig.model || "auto";
}

function setModel(modelName) {
  aiConfig.model = modelName;
  saveJSON(AI_CONFIG_FILE, aiConfig);
  logger.info(`AI model set to: ${modelName}`);
}

async function waitForServer(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await axios.get(`${AI_API_URL}/`, { timeout: 3000 });
      if (res.data && res.data.status === "ok") {
        serverReady = true;
        logger.info("AI server is ready");
        return true;
      }
    } catch {
      await new Promise(r => setTimeout(r, 1000));
    }
  }
  throw new Error("AI server failed to start within timeout");
}

function isPortInUse(port) {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.once("error", () => resolve(true));
    server.once("listening", () => {
      server.close();
      resolve(false);
    });
    server.listen(port, "127.0.0.1");
  });
}

function killProcessOnPort(port) {
  try {
    const pid = execSync(`lsof -ti:${port} 2>/dev/null`, { encoding: "utf8", timeout: 3000 }).trim();
    if (pid) {
      logger.warn(`Killing stale process ${pid} on port ${port}`);
      execSync(`kill -9 ${pid} 2>/dev/null`);
      return true;
    }
  } catch {}
  return false;
}

function isExternalUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname !== "localhost" && u.hostname !== "127.0.0.1";
  } catch {
    return false;
  }
}

async function startAIServer() {
  if (aiProcess || serverReady) return;

  if (isExternalUrl(AI_API_URL)) {
    logger.info(`Using external AI server at ${AI_API_URL}`);
    try {
      const res = await axios.get(`${AI_API_URL}/`, { timeout: 10000 });
      if (res.data && res.data.status === "ok") {
        serverReady = true;
        logger.info("External AI server is ready");
        return;
      }
    } catch (err) {
      logger.warn(`External AI server not reachable: ${err.message}. AI features will be unavailable.`);
      return;
    }
  }

  logger.info(`Starting AI server from: ${CHATGPT_SERVER_PATH}`);
  const serverDir = path.dirname(CHATGPT_SERVER_PATH);

  aiProcess = spawn(process.execPath, [CHATGPT_SERVER_PATH], {
    cwd: serverDir,
    env: { ...process.env, PORT: String(AI_PORT) },
    stdio: ["ignore", "pipe", "pipe"],
  });

  aiProcess.stdout.on("data", (data) => {
    logger.info(`[AI Server] ${data.toString().trim()}`);
  });

  aiProcess.stderr.on("data", (data) => {
    const msg = data.toString().trim();
    if (msg) logger.warn(`[AI Server] ${msg}`);
  });

  aiProcess.on("error", (err) => {
    logger.error(`AI server process error: ${err.message}`);
    aiProcess = null;
    serverReady = false;
  });

  aiProcess.on("exit", (code) => {
    logger.warn(`AI server exited with code ${code}. Will restart in 3s...`);
    aiProcess = null;
    serverReady = false;
    setTimeout(() => {
      startAIServer().catch((err) => {
        logger.error(`AI server auto-restart failed: ${err.message}`);
      });
    }, 3000);
  });

  await waitForServer();
}

async function stopAIServer() {
  if (isExternalUrl(AI_API_URL)) {
    logger.info("External AI server — no local process to stop");
    serverReady = false;
    return;
  }
  if (aiProcess) {
    logger.info("Stopping AI server...");
    aiProcess.kill("SIGTERM");
    aiProcess = null;
    serverReady = false;
    setTimeout(() => {
      if (aiProcess) {
        aiProcess.kill("SIGKILL");
        aiProcess = null;
      }
    }, 5000);
  }
}

function buildFullPrompt(systemPrompt, conversationHistory, currentUserMessage, intent, userLang) {
  let prompt = `${systemPrompt}\n\n`;

  prompt += `## CURRENT CONTEXT\n`;
  prompt += `- User intent: "${intent || "general"}"\n`;
  prompt += `- User selected language: ${userLang === "oromo" ? "Afaan Oromoo" : "English"}\n`;
  prompt += `- IMPORTANT: Respond ONLY in ${userLang === "oromo" ? "Afaan Oromoo" : "English"}. Do NOT switch languages even if the user writes in another language.\n\n`;

  if (conversationHistory && conversationHistory.length > 0) {
    prompt += `## CONVERSATION HISTORY (recent messages)\n`;
    for (const entry of conversationHistory) {
      const role = entry.role === "user" ? "User" : "Yihune B's Assistant";
      prompt += `${role}: ${entry.text}\n`;
    }
    prompt += `\n`;
  }

  prompt += `## CURRENT USER MESSAGE\nUser: ${currentUserMessage}\n\n`;
  prompt += `## YOUR RESPONSE\nYihune B's Assistant:`;

  return prompt;
}

async function getAIResponse(userMessage, userId, options = {}) {
  const startTime = Date.now();
  if (!serverReady) {
    logger.warn(`AI server not ready, skipping AI response for user ${userId}`);
    return null;
  }

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const intent = options.intent || "unknown";
      const userLang = options.language || "english";
      const conversationHistory = options.conversationHistory || [];

      const fullPrompt = buildFullPrompt(
        SYSTEM_PROMPT,
        conversationHistory,
        userMessage,
        intent,
        userLang
      );

      const res = await axios.post(`${AI_API_URL}/ask`, {
        message: fullPrompt,
        model: options.model || "gpt-4o-mini",
      }, { timeout: 45000 });

      const answer = res.data.answer;
      if (!answer) return null;

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      logger.info(`AI response for user ${userId} (${elapsed}s, intent: ${intent}): "${answer.substring(0, 80)}..."`);
      addMemory(userId, "bot", answer);
      return answer;
    } catch (err) {
      const msg = err.response?.data?.error || err.message;
      if (attempt < 2) {
        logger.warn(`AI response attempt ${attempt} failed for user ${userId}: ${msg}. Retrying...`);
        await new Promise(r => setTimeout(r, 2000));
      } else {
        const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
        logger.error(`AI response failed for user ${userId} after ${elapsed}s: ${msg}`);
        trackError("aiService", userId, msg);
        return null;
      }
    }
  }
  return null;
}

async function getAIModels() {
  try {
    const res = await axios.get(`${AI_API_URL}/v1/models`, { timeout: 30000 });
    return res.data;
  } catch (err) {
    logger.error(`Failed to fetch AI models: ${err.message}`);
    return null;
  }
}

async function getAIStatus() {
  try {
    const res = await axios.get(`${AI_API_URL}/`, { timeout: 5000 });
    return { running: true, data: res.data, model: getModel() };
  } catch (err) {
    return { running: false, error: err.message, model: getModel() };
  }
}

async function restartAIServer() {
  await stopAIServer();
  await new Promise(r => setTimeout(r, 2000));
  await startAIServer();
  return { success: serverReady };
}

module.exports = {
  startAIServer,
  stopAIServer,
  getAIResponse,
  getAIModels,
  getAIStatus,
  restartAIServer,
  getModel,
  setModel,
};
