const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/v1', '') ||
                process.env.NEXT_PUBLIC_API_URL ||
                'https://bug-fixertv2.onrender.com';

const PING_URL  = `${API_URL}/health`;
const INTERVAL  = 10 * 60 * 1000; // 10 minutes
const TIMEOUT   = 45_000;          // 45s — Render cold start can take 30s+

async function ping() {
  const now = new Date().toISOString();
  try {
    const res = await fetch(PING_URL, { signal: AbortSignal.timeout(TIMEOUT) });
    console.log(`[${now}] ✅ Render alive — HTTP ${res.status}`);
  } catch (err) {
    if (err.name === 'TimeoutError') {
      console.warn(`[${now}] ⚠️  Render waking up (cold start > ${TIMEOUT/1000}s) — will retry next cycle`);
    } else {
      console.error(`[${now}] ❌ Ping failed — ${err.message}`);
    }
  }
}

console.log(`Keep-alive started — pinging ${PING_URL} every 10 min`);
ping();
setInterval(ping, INTERVAL);
