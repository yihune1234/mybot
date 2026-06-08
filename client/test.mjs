import { ChatGPT } from './index.mjs';

async function askWithRetry(client, question, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await client.ask(question, { timeout: 60000 });
    } catch (err) {
      const isLast = attempt === retries;
      if (err.message.includes('429')) {
        console.log(`⏳ Rate limited. Waiting 5s before retry ${attempt + 1}/${retries}...`);
        await new Promise(r => setTimeout(r, 5000));
      } else if (err.message.includes('Unauthorized') || err.message.includes('Conduit')) {
        if (!isLast) {
          console.log(`🔄 Conduit rejected. Retrying ${attempt + 1}/${retries}...`);
          // Reset conversation state to start fresh
          client.conversationId = null;
          client.parentMessageId = null;
          await new Promise(r => setTimeout(r, 2000));
        }
      } else {
        throw err; // Non-retryable error
      }
      if (isLast) throw err;
    }
  }
}

async function run() {
  try {
    console.log('🔧 Starting ChatGPT test (anonymous mode)...');
    console.log('(If this fails, see instructions at the bottom)\n');
    
    const client = new ChatGPT();
    await client.init();
    
    // Basic question (works anonymously)
    const answer = await askWithRetry(client, 'say just the word kiwi');
    console.log('Answer:', answer);
    
  } catch (err) {
    console.error('\n❌ Error:', err.message);
    
    if (err.message.includes('fetch') || err.message.includes('network') || err.message.includes('ERR_NAME_NOT_RESOLVED')) {
      console.log('\n💡 Fix #1: Check your internet connection or try a VPN.');
      console.log('💡 Fix #2: Add a cookies.json file from your logged-in ChatGPT session.');
    } else if (err.message.includes('429') || err.message.includes('rate')) {
      console.log('\n💡 Fix: Too many requests. Wait 30–60 seconds and run again.');
    } else if (err.message.includes('Unauthorized') || err.message.includes('Conduit')) {
      console.log('\n💡 Fix: ChatGPT anonymous endpoint is rate-limiting this IP.');
      console.log('   - Wait 1 minute and retry, OR');
      console.log('   - Add a cookies.json file (see cookies.json.example) for authenticated access.');
    } else if (err.message.includes('Blocked by Cloudflare')) {
      console.log('\n💡 Fix: Cloudflare is blocking the request.');
      console.log('   - Add cookies.json with cf_clearance from your browser, OR');
      console.log('   - Try a different network / VPN.');
    } else if (err.message.includes('PoW') || err.message.includes('proof')) {
      console.log('\n💡 Fix: Proof-of-work requirement failed. Retry — this is usually transient.');
    } else {
      console.log('\n💡 Try: Add a cookies.json file from your logged-in ChatGPT session.');
    }
    
    console.log('\n📖 How to get cookies.json:');
    console.log('   1. Log into https://chat.openai.com in your browser');
    console.log('   2. Open DevTools (F12) → Application → Cookies → chat.openai.com');
    console.log('   3. Export cookies as JSON and save to client/cookies.json');
    console.log('   (See client/cookies.json.example for the format)');
    
    process.exit(1);
  }
}

run();
