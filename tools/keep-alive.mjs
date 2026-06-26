const API_URL = process.env.EXPO_PUBLIC_API_URL?.replace('/v1', '') ||
                process.env.NEXT_PUBLIC_API_URL ||
                'https://bug-fixertv2.onrender.com';

const PING_URL  = `${API_URL}/health`;
const INTERVAL  = 8 * 60 * 1000;  // 8 min — well under Render's 15-min sleep
const TIMEOUT   = 45_000;          // 45s — Render cold start can take 30s+

let failStreak = 0;

async function ping() {
  const now = new Date().toISOString();
  try {
    const res = await fetch(PING_URL, { signal: AbortSignal.timeout(TIMEOUT) });
    failStreak = 0;
    console.log(`[${now}] ✅ Render alive — HTTP ${res.status}`);
  } catch (err) {
    failStreak++;
    if (err.name === 'TimeoutError') {
      console.warn(`[${now}] ⚠️  Render waking up (cold start > ${TIMEOUT/1000}s) streak=${failStreak}`);
    } else {
      console.error(`[${now}] ❌ Ping failed — ${err.message} streak=${failStreak}`);
    }
  }
}

// Prevent any uncaught error from killing the process
process.on('uncaughtException', (err) => {
  console.error(`[UNCAUGHT] ${err.message}`);
});
process.on('unhandledRejection', (reason) => {
  console.error(`[UNHANDLED] ${reason}`);
});

console.log(`Keep-alive started — pinging ${PING_URL} every ${INTERVAL/60000} min`);
ping();
setInterval(ping, INTERVAL);
