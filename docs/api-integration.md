# API Integration Guide

## Server Setup

```bash
cd /home/yihunebelay/chatgpt-unofficial-api/client
node server.mjs
# Server starts at http://localhost:3000
```

---

## 1️⃣ POST /ask — Simple Chat

### Request
```json
{
  "message": "What is the capital of France?",
  "model": "auto"
}
```

### Response (200 OK)
```json
{
  "answer": "The capital of France is Paris.",
  "model": "auto"
}
```

### cURL
```bash
curl http://localhost:3000/ask \
  -H "Content-Type: application/json" \
  -d '{"message":"What is the capital of France?"}'
```

---

## 2️⃣ POST /v1/chat/completions — OpenAI-Compatible

### Request (Non-Streaming)
```json
{
  "model": "auto",
  "messages": [
    {"role": "system", "content": "You are a helpful assistant."},
    {"role": "user", "content": "What is 2+2?"}
  ],
  "max_tokens": 200,
  "temperature": 0.7
}
```

### Response (200 OK — Non-Streaming)
```json
{
  "id": "chatcmpl-1780903472000",
  "object": "chat.completion",
  "created": 1780903472,
  "model": "auto",
  "choices": [
    {
      "index": 0,
      "message": {
        "role": "assistant",
        "content": "2+2 = 4"
      },
      "finish_reason": "stop"
    }
  ],
  "usage": {
    "prompt_tokens": 0,
    "completion_tokens": 0,
    "total_tokens": 0
  }
}
```

### cURL
```bash
curl http://localhost:3000/v1/chat/completions \
  -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hello"}],"model":"auto"}'
```

### Request (Streaming — add `"stream": true`)
```json
{
  "model": "auto",
  "stream": true,
  "messages": [
    {"role": "user", "content": "Tell me a short story"}
  ]
}
```

### Response (SSE Stream)
```
data: {"choices":[{"delta":{"content":"Once"},"index":0}]}

data: {"choices":[{"delta":{"content":" upon"},"index":0}]}

data: {"choices":[{"delta":{"content":" a"},"index":0}]}

data: {"choices":[{"delta":{"content":" time..."},"index":0}]}

data: [DONE]
```

---

## 3️⃣ GET / — Health Check

### Response (200 OK)
```json
{
  "status": "ok",
  "name": "chatgpt-unofficial-api",
  "anonymous": true
}
```

---

## 4️⃣ GET /v1/models — List Models

### Response (200 OK)
```json
{
  "models": [
    {"slug": "auto", "title": "Auto", "description": "Default model"},
    {"slug": "gpt-4o", "title": "GPT-4o", "description": "GPT-4 Optimized"},
    {"slug": "gpt-4o-mini", "title": "GPT-4o Mini", "description": "Smaller GPT-4"},
    {"slug": "o1", "title": "o1", "description": "OpenAI o1 reasoning"}
  ]
}
```

---

## 5️⃣ Error Responses

### 400 Bad Request
```json
{
  "error": "Missing 'message' or 'prompt' field"
}
```

```json
{
  "error": "No user message found"
}
```

### 500 Internal Server Error
```json
{
  "error": "Rate limited. Try again later."
}
```
```json
{
  "error": "Blocked by Cloudflare"
}
```
```json
{
  "error": "Conduit failed: {\"detail\":\"Unauthorized\"}"
}
```

---

## 🐍 Integration Examples

### Python (using requests)
```python
import requests

API_URL = "http://localhost:3000"

# Simple ask
res = requests.post(f"{API_URL}/ask", json={"message": "Hello"})
print(res.json()["answer"])

# OpenAI-compatible
res = requests.post(f"{API_URL}/v1/chat/completions", json={
    "messages": [{"role": "user", "content": "Hi"}],
    "model": "auto"
})
print(res.json()["choices"][0]["message"]["content"])
```

### JavaScript / Node.js
```javascript
const API_URL = "http://localhost:3000";

// Simple ask
const res = await fetch(`${API_URL}/ask`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ message: "Hello" })
});
const data = await res.json();
console.log(data.answer);

// Streaming (Node.js)
const streamRes = await fetch(`${API_URL}/v1/chat/completions`, {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    messages: [{ role: "user", content: "Tell me a story" }],
    stream: true
  })
});
const reader = streamRes.body.getReader();
// ... read stream chunks
```

### cURL quick reference
```bash
# Health check
curl http://localhost:3000/

# Simple chat
curl http://localhost:3000/ask -H "Content-Type: application/json" -d '{"message":"hi"}'

# OpenAI compatible
curl http://localhost:3000/v1/chat/completions -H "Content-Type: application/json" \
  -d '{"messages":[{"role":"user","content":"hi"}],"model":"auto"}'

# Get models
curl http://localhost:3000/v1/models
```

### HTML / JavaScript (browser fetch)
```javascript
async function askChatGPT(message) {
  const res = await fetch("http://localhost:3000/ask", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ message })
  });
  const data = await res.json();
  return data.answer;
}

// Usage
askChatGPT("What is the weather?").then(console.log);