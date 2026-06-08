import http from "http";
import net from "net";
import { ChatGPT } from "./index.mjs";

const BASE_PORT = parseInt(process.env.PORT, 10) || 3001;
const client = new ChatGPT();
let ACTIVE_PORT = BASE_PORT;

async function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      try {
        resolve(JSON.parse(body));
      } catch {
        resolve({});
      }
    });
  });
}

function sendJSON(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" });
  res.end(JSON.stringify(data));
}

function resetClient() {
  client.conversationId = null;
  client.parentMessageId = null;
}

const server = http.createServer(async (req, res) => {
  // CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    res.writeHead(204);
    return res.end();
  }

  const url = new URL(req.url, `http://localhost:${ACTIVE_PORT}`);
  const path = url.pathname;

  // GET / — Health check
  if (req.method === "GET" && path === "/") {
    return sendJSON(res, 200, { status: "ok", name: "chatgpt-unofficial-api", anonymous: true });
  }

  // GET /v1/models — List available models
  if (req.method === "GET" && path === "/v1/models") {
    try {
      await client.init();
      const models = await client.getModels();
      return sendJSON(res, 200, models);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // POST /v1/chat/completions — OpenAI-compatible chat endpoint
  if (req.method === "POST" && path === "/v1/chat/completions") {
    try {
      const body = await parseBody(req);
      const messages = body.messages || [];
      const model = body.model || "auto";
      const stream = body.stream === true;

      // Extract the last user message
      const lastUserMsg = [...messages].reverse().find((m) => m.role === "user");
      if (!lastUserMsg) {
        return sendJSON(res, 400, { error: "No user message found" });
      }

      resetClient();
      await client.init();

      const options = { model };
      if (body.max_tokens) options.maxTokens = body.max_tokens;
      if (body.temperature) options.temperature = body.temperature;

      if (stream) {
        // Streaming response
        try {
          res.writeHead(200, {
            "Content-Type": "text/event-stream",
            "Cache-Control": "no-cache",
            Connection: "keep-alive",
            "Access-Control-Allow-Origin": "*",
          });

          for await (const chunk of client.streamAsk(lastUserMsg.content, options)) {
            if (chunk.text) {
              const payload = {
                choices: [{ delta: { content: chunk.text }, index: 0 }],
              };
              res.write(`data: ${JSON.stringify(payload)}\n\n`);
            }
          }

          res.write(`data: [DONE]\n\n`);
        } catch (streamErr) {
          const errPayload = { choices: [{ delta: { content: `\n\n[Error: ${streamErr.message}]` }, index: 0 }] };
          res.write(`data: ${JSON.stringify(errPayload)}\n\n`);
          res.write(`data: [DONE]\n\n`);
        }
        return res.end();
      }

      // Non-streaming response
      const answer = await client.ask(lastUserMsg.content, options);
      const response = {
        id: `chatcmpl-${Date.now()}`,
        object: "chat.completion",
        created: Math.floor(Date.now() / 1000),
        model: model,
        choices: [
          {
            index: 0,
            message: { role: "assistant", content: answer },
            finish_reason: "stop",
          },
        ],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 },
      };

      return sendJSON(res, 200, response);
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // POST /ask — Simple ask endpoint
  if (req.method === "POST" && path === "/ask") {
    try {
      const body = await parseBody(req);
      const message = body.message || body.prompt;
      if (!message) {
        return sendJSON(res, 400, { error: "Missing 'message' or 'prompt' field" });
      }

      resetClient();
      await client.init();
      const answer = await client.ask(message, { model: body.model || "auto" });

      return sendJSON(res, 200, { answer, model: body.model || "auto" });
    } catch (err) {
      return sendJSON(res, 500, { error: err.message });
    }
  }

  // 404
  return sendJSON(res, 404, { error: "Not found" });
});

async function findFreePort(start, maxAttempts) {
  for (let port = start; port < start + maxAttempts; port++) {
    try {
      await new Promise((resolve, reject) => {
        const tester = net.createServer();
        tester.once("error", reject);
        tester.once("listening", () => {
          tester.close();
          resolve(port);
        });
        tester.listen(port, "127.0.0.1");
      });
      return port;
    } catch {}
  }
  throw new Error(`No free port found in range ${start}-${start + maxAttempts - 1}`);
}

findFreePort(BASE_PORT, 10).then((port) => {
  ACTIVE_PORT = port;
  server.listen(port, () => {
    console.log(`🚀 ChatGPT API server running at http://localhost:${port}`);
    console.log(`   Endpoints:`);
    console.log(`   GET  /                       → health check`);
    console.log(`   POST /ask                    → simple chat`);
    console.log(`   POST /v1/chat/completions    → OpenAI-compatible`);
    console.log(`   GET  /v1/models              → list models`);
    console.log(`\n   Example:`);
    console.log(`   curl http://localhost:${port}/ask -H "Content-Type: application/json" -d '{"message":"hello"}'`);
  });
}).catch((err) => {
  console.error(err.message);
  process.exit(1);
});