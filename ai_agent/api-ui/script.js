// ============================================
// STATE
// ============================================
let abortController = null;
let isStreaming = false;

// ============================================
// DOM REFS
// ============================================
const messagesContainer = document.getElementById('messagesContainer');
const welcomeMessage = document.getElementById('welcomeMessage');
const messageInput = document.getElementById('messageInput');
const sendBtn = document.getElementById('sendBtn');
const modelSelect = document.getElementById('modelSelect');
const apiUrlInput = document.getElementById('apiUrl');
const statusDot = document.querySelector('.status-dot');
const statusText = document.querySelector('.status-text');
const modelDisplay = document.getElementById('modelDisplay');

// ============================================
// INIT
// ============================================
document.addEventListener('DOMContentLoaded', () => {
    // Auto-resize textarea
    messageInput.addEventListener('input', autoResize);

    // Enter to send, Shift+Enter for newline
    messageInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Update model display
    modelSelect.addEventListener('change', () => {
        modelDisplay.textContent = modelSelect.value;
    });

    // Responsive sidebar toggle
    const sidebar = document.querySelector('.sidebar');
    document.querySelector('.sidebar-header').addEventListener('click', () => {
        if (window.innerWidth <= 768) {
            sidebar.classList.toggle('expanded');
        }
    });

    // Check server on load
    setTimeout(checkHealth, 500);
});

function autoResize() {
    messageInput.style.height = 'auto';
    messageInput.style.height = Math.min(messageInput.scrollHeight, 150) + 'px';
}

// ============================================
// API HELPERS
// ============================================
function getApiUrl() {
    return apiUrlInput.value.replace(/\/+$/, '');
}

async function apiFetch(endpoint, options = {}) {
    const url = `${getApiUrl()}${endpoint}`;
    const config = {
        ...options,
        headers: {
            'Content-Type': 'application/json',
            ...options.headers,
        },
    };
    return fetch(url, config);
}

// ============================================
// CHECK SERVER HEALTH
// ============================================
async function checkHealth() {
    statusDot.className = 'status-dot checking';
    statusText.textContent = 'Checking...';

    try {
        const res = await apiFetch('/');
        if (res.ok) {
            statusDot.className = 'status-dot online';
            statusText.textContent = 'Online';
        } else {
            statusDot.className = 'status-dot offline';
            statusText.textContent = 'Error';
        }
    } catch {
        statusDot.className = 'status-dot offline';
        statusText.textContent = 'Offline';
    }
}

// ============================================
// ADD MESSAGE
// ============================================
function addMessage(role, content) {
    // Remove welcome message on first message
    if (welcomeMessage && !welcomeMessage.classList.contains('hidden')) {
        welcomeMessage.classList.add('hidden');
        welcomeMessage.style.display = 'none';
    }

    const div = document.createElement('div');
    div.className = `message ${role === 'user' ? 'user' : 'ai'}`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = role === 'user' ? '👤' : '🤖';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    // Format content: preserve code blocks
    const formatted = formatMessage(content);
    contentDiv.innerHTML = formatted;

    // Add timestamp
    const time = document.createElement('div');
    time.className = 'message-time';
    const now = new Date();
    time.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    contentDiv.appendChild(time);

    div.appendChild(avatar);
    div.appendChild(contentDiv);
    messagesContainer.appendChild(div);

    // Scroll to bottom
    scrollToBottom();
    return contentDiv;
}

function formatMessage(text) {
    if (!text) return '';
    // Escape HTML first
    const escaped = escapeHtml(text);
    // Convert triple backtick code blocks
    let formatted = escaped.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
        return `<pre><code>${code.trim()}</code></pre>`;
    });
    // Convert inline code
    formatted = formatted.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Convert newlines to <br>
    formatted = formatted.replace(/\n/g, '<br>');
    return formatted;
}

function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function addThinkingIndicator() {
    // Remove welcome message
    if (welcomeMessage && !welcomeMessage.classList.contains('hidden')) {
        welcomeMessage.classList.add('hidden');
        welcomeMessage.style.display = 'none';
    }

    // Remove existing thinking indicator
    removeThinkingIndicator();

    const div = document.createElement('div');
    div.className = 'thinking';
    div.id = 'thinkingIndicator';

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';
    avatar.textContent = '🤖';

    const contentDiv = document.createElement('div');
    contentDiv.className = 'message-content';

    const dots = document.createElement('div');
    dots.className = 'thinking-dots';
    dots.innerHTML = '<span></span><span></span><span></span>';

    contentDiv.appendChild(dots);
    div.appendChild(avatar);
    div.appendChild(contentDiv);
    messagesContainer.appendChild(div);

    scrollToBottom();
}

function removeThinkingIndicator() {
    const el = document.getElementById('thinkingIndicator');
    if (el) el.remove();
}

function scrollToBottom() {
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// ============================================
// SEND MESSAGE (STREAMING)
// ============================================
async function sendMessage() {
    const message = messageInput.value.trim();
    if (!message) return;

    const model = modelSelect.value;

    // Add user message
    addMessage('user', message);

    // Clear input
    messageInput.value = '';
    messageInput.style.height = 'auto';

    // Show thinking indicator
    addThinkingIndicator();

    // Disable send
    sendBtn.disabled = true;
    isStreaming = true;
    abortController = new AbortController();

    try {
        const res = await apiFetch('/v1/chat/completions', {
            method: 'POST',
            body: JSON.stringify({
                model,
                messages: [{ role: 'user', content: message }],
                stream: true,
            }),
            signal: abortController.signal,
        });

        // Remove thinking indicator
        removeThinkingIndicator();

        if (!res.ok) {
            let errorMsg = `Error ${res.status}`;
            try {
                const data = await res.json();
                errorMsg = data.error || errorMsg;
            } catch {}
            addMessage('ai', `⚠️ ${errorMsg}`);
            isStreaming = false;
            sendBtn.disabled = false;
            return;
        }

        // Create AI message bubble
        const aiContentDiv = addMessage('ai', '');
        aiContentDiv.innerHTML = '';
        const cursorSpan = document.createElement('span');
        cursorSpan.id = 'streamCursor';
        cursorSpan.style.cssText = 'display:inline-block;width:2px;height:16px;background:var(--accent);animation:blink 0.8s infinite;vertical-align:text-bottom;margin-left:2px;';
        aiContentDiv.appendChild(cursorSpan);

        // Read stream
        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let fullContent = '';
        let hasContent = false;

        // Add cursor style if not exists
        if (!document.getElementById('streamAnimStyle')) {
            const style = document.createElement('style');
            style.id = 'streamAnimStyle';
            style.textContent = '@keyframes blink { 0%,50% { opacity: 1; } 51%,100% { opacity: 0; } }';
            document.head.appendChild(style);
        }

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const line of lines) {
                const trimmed = line.trim();
                if (!trimmed || trimmed === 'data: [DONE]') continue;
                if (!trimmed.startsWith('data: ')) continue;

                try {
                    const jsonStr = trimmed.slice(6);
                    const parsed = JSON.parse(jsonStr);
                    const content = parsed.choices?.[0]?.delta?.content || '';
                    if (content) {
                        hasContent = true;
                        fullContent += content;
                        // Update display - remove cursor, add content, re-add cursor
                        cursorSpan.remove();
                        aiContentDiv.innerHTML = formatMessage(fullContent);
                        aiContentDiv.appendChild(cursorSpan);
                        scrollToBottom();
                    }
                } catch {}
            }
        }

        // Remove cursor, finalize
        cursorSpan.remove();
        if (hasContent) {
            aiContentDiv.innerHTML = formatMessage(fullContent);
            // Add time
            const time = document.createElement('div');
            time.className = 'message-time';
            const now = new Date();
            time.textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            aiContentDiv.appendChild(time);
        } else {
            aiContentDiv.innerHTML = '🤔 No response content received.';
        }

        scrollToBottom();

    } catch (err) {
        removeThinkingIndicator();
        if (err.name !== 'AbortError') {
            addMessage('ai', `⚠️ Error: ${err.message}`);
        }
    } finally {
        isStreaming = false;
        sendBtn.disabled = false;
        abortController = null;
        messageInput.focus();
    }
}

// ============================================
// CLEAR CHAT
// ============================================
function clearChat() {
    // Remove all messages except welcome
    const messages = messagesContainer.querySelectorAll('.message, .thinking');
    messages.forEach(m => m.remove());

    // Show welcome again
    welcomeMessage.style.display = 'block';
    welcomeMessage.classList.remove('hidden');

    // Reset input
    messageInput.value = '';
    messageInput.style.height = 'auto';
    messageInput.focus();
}

// ============================================
// API URL CHANGE - recheck server
// ============================================
let urlChangeTimeout;
apiUrlInput.addEventListener('input', () => {
    clearTimeout(urlChangeTimeout);
    urlChangeTimeout = setTimeout(checkHealth, 800);
});