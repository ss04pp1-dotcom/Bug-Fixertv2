// Caller should set the base URL with no path. If a /v1 suffix is present
// (e.g. EXPO_PUBLIC_API_URL), strip only a trailing /v1 — never any other /v1.
const API_URL = (process.env.APP_URL
  || process.env.KEEP_ALIVE_URL
  || process.env.API_URL
  || process.env.EXPO_PUBLIC_API_URL
  || process.env.NEXT_PUBLIC_API_URL
  || 'https://bug-fixertv2.onrender.com'
).replace(/\/v1$/, '');

const PING_URL    = `${API_URL}/healthz`;
const SETTING_URL = `${API_URL}/v1/settings/public`;
const INTERVAL    = 8 * 60 * 1000;  // 8 min — well under Render's 15-min sleep
const TIMEOUT     = 45_000;          // 45s — Render cold start can take 30s+

let failStreak = 0;

async function isKeepAliveEnabled() {
  try {
    const res = await fetch(SETTING_URL, { signal: AbortSignal.timeout(8_000) });
    if (!res.ok) return true; // default ON if can't read
    const settings = await res.json();
    const found = Array.isArray(settings)
      ? settings.find(s => s.key === 'keep_alive_enabled')
      : null;
    if (!found) return true; // setting not set yet → default ON
    return found.value !== false && found.value !== 'false';
  } catch {
    return true; // Render sleeping or unreachable → default ON (must ping!)
  }
}

async function ping() {
  const now = new Date().toISOString();
  const enabled = await isKeepAliveEnabled();
  if (!enabled) {
    console.log(`[${now}] ⏸  Keep-alive DISABLED from admin — skipping ping`);
    return;
  }
  try {
    const res = await fetch(PING_URL, { signal: AbortSignal.timeout(TIMEOUT) });
    failStreak = 0;
    console.log(`[${now}] ✅ Render alive — HTTP ${res.status}`);
  } catch (err) {
    failStreak++;
    if (err.name === 'TimeoutError') {
      console.warn(`[${now}] ⚠️  Render waking up (cold start > ${TIMEOUT / 1000}s) streak=${failStreak}`);
    } else {
      console.error(`[${now}] ❌ Ping failed — ${err.message} streak=${failStreak}`);
    }
  }
}

// Prevent any uncaught error from killing the process
process.on('uncaughtException', (err) => { console.error(`[UNCAUGHT] ${err.message}`); });
process.on('unhandledRejection', (reason) => { console.error(`[UNHANDLED] ${reason}`); });

console.log(`Keep-alive started — pinging ${PING_URL} every ${INTERVAL / 60000} min`);
console.log(`Admin toggle: disable via Admin → Settings → App Settings → Server Keep-Alive`);
ping();
setInterval(ping, INTERVAL);
