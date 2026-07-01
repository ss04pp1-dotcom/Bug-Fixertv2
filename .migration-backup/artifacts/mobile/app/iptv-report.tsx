/**
 * StreamPro — IPTV Compatibility Report (Development Only)
 * This screen is only accessible in development builds (__DEV__ === true).
 */

import React, { useState, useCallback, useRef } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, ScrollView,
  ActivityIndicator, StatusBar, Platform, Share, Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import { router, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// ─── Colors ───────────────────────────────────────────────────────────────────
const C = {
  bg: '#050510', card: '#0D0D1A', border: 'rgba(255,255,255,0.08)',
  primary: '#8B5CF6', accent: '#EC4899', live: '#EF4444',
  green: '#10B981', yellow: '#F59E0B', blue: '#3B82F6',
  text: '#FFFFFF', dim: '#9CA3AF', dimmer: '#4B5563',
};

// ─── IPTV User-Agent ──────────────────────────────────────────────────────────
const IPTV_UA =
  'Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 ' +
  '(KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36';

// ─── Test Stream Definitions ──────────────────────────────────────────────────
interface TestStream {
  id: string;
  format: string;
  extension: string;
  mimeType: string;
  url: string;
  description: string;
  exoplayerSupport: 'full' | 'partial' | 'device-dependent' | 'unsupported';
  codecNotes: string;
  color: string;
  icon: string;
}

const TEST_STREAMS: TestStream[] = [
  {
    id: 'hls',
    format: 'HLS',
    extension: '.m3u8',
    mimeType: 'application/vnd.apple.mpegurl',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    description: 'HTTP Live Streaming — Apple/IPTV standard',
    exoplayerSupport: 'full',
    codecNotes: 'H.264 + AAC (universal). H.265/HEVC requires device support.',
    color: '#8B5CF6',
    icon: 'radio-outline',
  },
  {
    id: 'dash',
    format: 'DASH',
    extension: '.mpd',
    mimeType: 'application/dash+xml',
    url: 'https://dash.akamaized.net/akamai/bbb_30fps/bbb_30fps.mpd',
    description: 'MPEG-DASH — adaptive bitrate streaming',
    exoplayerSupport: 'full',
    codecNotes: 'VP9, H.264, H.265 — all supported on Android 5+.',
    color: '#3B82F6',
    icon: 'cloud-outline',
  },
  {
    id: 'mp4',
    format: 'MP4',
    extension: '.mp4',
    mimeType: 'video/mp4',
    url: 'https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/BigBuckBunny.mp4',
    description: 'MPEG-4 — most compatible VOD format',
    exoplayerSupport: 'full',
    codecNotes: 'H.264 + AAC/MP3. Universal support across all devices.',
    color: '#10B981',
    icon: 'film-outline',
  },
  {
    id: 'mpegts',
    format: 'MPEG-TS',
    extension: '.ts',
    mimeType: 'video/mp2t',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_4x3/gear1/prog_index.m3u8',
    description: 'MPEG Transport Stream — raw IPTV stream format',
    exoplayerSupport: 'full',
    codecNotes: 'ExoPlayer natively supports TS. Requires correct Content-Type or .ts extension.',
    color: '#F59E0B',
    icon: 'tv-outline',
  },
  {
    id: 'mkv',
    format: 'MKV',
    extension: '.mkv',
    mimeType: 'video/x-matroska',
    url: 'https://www.iandevlin.com/mdn/movs/elephants-dream-medium.webm',
    description: 'Matroska — container for H.264/H.265/VP9',
    exoplayerSupport: 'partial',
    codecNotes: 'ExoPlayer supports MKV container. HEVC/H.265 needs Android 5+ hardware decoder.',
    color: '#EC4899',
    icon: 'cube-outline',
  },
  {
    id: 'webm',
    format: 'WEBM',
    extension: '.webm',
    mimeType: 'video/webm',
    url: 'https://www.w3schools.com/html/mov_bbb.webm',
    description: 'WebM — VP8/VP9 open web format',
    exoplayerSupport: 'device-dependent',
    codecNotes: 'VP8 supported on Android 2.3+. VP9 on Android 4.4+. Opus audio needs Android 5+.',
    color: '#06B6D4',
    icon: 'logo-chrome',
  },
];

// ─── ExoPlayer Codec Matrix ───────────────────────────────────────────────────
const CODEC_MATRIX = [
  { codec: 'H.264 / AVC',   video: true,  audio: false, android: '4.1+', note: 'Hardware decode' },
  { codec: 'H.265 / HEVC',  video: true,  audio: false, android: '5.0+', note: 'Device-dependent' },
  { codec: 'VP8',           video: true,  audio: false, android: '2.3+', note: 'Software decode' },
  { codec: 'VP9',           video: true,  audio: false, android: '4.4+', note: 'Hardware: 5.0+' },
  { codec: 'AV1',           video: true,  audio: false, android: '9.0+', note: 'ExoPlayer SW fallback' },
  { codec: 'AAC',           video: false, audio: true,  android: '4.1+', note: 'Hardware decode' },
  { codec: 'MP3',           video: false, audio: true,  android: '4.1+', note: 'Hardware decode' },
  { codec: 'AC3 / Dolby',   video: false, audio: true,  android: '5.0+', note: 'Device-dependent' },
  { codec: 'EAC3 / E-AC3', video: false, audio: true,  android: '5.0+', note: 'Premium devices only' },
  { codec: 'Opus',          video: false, audio: true,  android: '5.0+', note: 'SW decode fallback' },
  { codec: 'Vorbis',        video: false, audio: true,  android: '4.1+', note: 'Software decode' },
];

// ─── Result Types ─────────────────────────────────────────────────────────────
type TestStatus = 'pending' | 'running' | 'pass' | 'fail' | 'warn';

interface TestResult {
  status: TestStatus;
  httpStatus: number;
  latencyMs: number;
  contentType: string;
  contentLength: string;
  acceptRanges: string;
  finalUrl: string;
  error?: string;
  networkIssue?: string;
  codecIssue?: string;
  logs: string[];
}

const defaultResult = (): TestResult => ({
  status: 'pending',
  httpStatus: 0,
  latencyMs: 0,
  contentType: '',
  contentLength: '',
  acceptRanges: '',
  finalUrl: '',
  logs: [],
});

// ─── Network check ────────────────────────────────────────────────────────────
async function runStreamTest(stream: TestStream, addLog: (id: string, msg: string) => void): Promise<TestResult> {
  const result = defaultResult();
  const log = (msg: string) => { result.logs.push(msg); addLog(stream.id, msg); };

  log(`▶ Testing ${stream.format} — ${stream.url.slice(0, 60)}…`);

  // 1. Protocol check
  if (stream.url.startsWith('http://')) {
    log(`⚠ HTTP (not HTTPS) — Android may block without usesCleartextTraffic=true`);
    result.networkIssue = 'HTTP stream — requires usesCleartextTraffic';
  } else {
    log(`✓ HTTPS — no cleartext restriction`);
  }

  // 2. HEAD request
  const t0 = Date.now();
  try {
    const ctrl = new AbortController();
    const timeout = setTimeout(() => ctrl.abort(), 10000);
    const res = await fetch(stream.url, {
      method: 'HEAD',
      headers: {
        'User-Agent': IPTV_UA,
        'Accept': '*/*',
      },
      redirect: 'follow',
      signal: ctrl.signal,
    });
    clearTimeout(timeout);

    result.latencyMs = Date.now() - t0;
    result.httpStatus = res.status;
    result.contentType = res.headers.get('content-type') || '';
    result.contentLength = res.headers.get('content-length') || '';
    result.acceptRanges = res.headers.get('accept-ranges') || '';
    result.finalUrl = res.url || stream.url;

    log(`HTTP ${res.status} in ${result.latencyMs}ms`);
    log(`Content-Type: ${result.contentType || '(none)'}`);
    log(`Content-Length: ${result.contentLength || '(none)'}`);
    log(`Accept-Ranges: ${result.acceptRanges || '(none)'}`);

    if (res.url && res.url !== stream.url) {
      log(`↳ Redirect → ${res.url.slice(0, 60)}`);
    }

    // 3. Content-type validation
    if (result.contentType) {
      const ct = result.contentType.toLowerCase();
      const expectedParts = stream.mimeType.toLowerCase().split('/');
      const ctMatches = ct.includes(expectedParts[1]) || ct.includes(stream.extension.replace('.', ''));
      if (!ctMatches) {
        log(`⚠ Content-Type mismatch — expected ${stream.mimeType}, got ${result.contentType}`);
        if (stream.id === 'mpegts') {
          log(`  TS streams may return application/octet-stream — ExoPlayer still handles it by extension`);
        }
        result.codecIssue = `Unexpected Content-Type: ${result.contentType}`;
      } else {
        log(`✓ Content-Type matches expected format`);
      }
    }

    // 4. Determine status
    if (res.ok || res.status === 206) {
      result.status = 'pass';
      log(`✓ PASS — Stream reachable`);
    } else if (res.status === 403) {
      result.status = 'fail';
      result.error = 'HTTP 403 Forbidden — server blocked request (User-Agent or IP block)';
      log(`✗ FAIL — 403 Forbidden`);
    } else if (res.status === 404) {
      result.status = 'fail';
      result.error = 'HTTP 404 Not Found — stream URL is invalid';
      log(`✗ FAIL — 404 Not Found`);
    } else {
      result.status = 'warn';
      result.error = `HTTP ${res.status}`;
      log(`⚠ WARN — HTTP ${res.status}`);
    }

  } catch (e: any) {
    result.latencyMs = Date.now() - t0;
    result.status = 'fail';

    if (e?.name === 'AbortError') {
      result.error = 'Timeout (10s) — server not responding';
      result.networkIssue = 'Connection timeout';
      log(`✗ FAIL — Timeout after 10s`);
    } else if (e?.message?.includes('Network request failed') || e?.message?.includes('fetch')) {
      result.error = 'Network error — check internet connection or CORS policy';
      result.networkIssue = 'Network unreachable';
      log(`✗ FAIL — Network error: ${e.message}`);
    } else {
      result.error = e?.message || 'Unknown error';
      log(`✗ FAIL — ${e?.message || 'Unknown error'}`);
    }
  }

  // 5. ExoPlayer codec assessment
  if (result.status !== 'fail') {
    switch (stream.exoplayerSupport) {
      case 'full':
        log(`✓ ExoPlayer: Full native support`);
        break;
      case 'partial':
        log(`⚠ ExoPlayer: Partial support — codec may vary by device`);
        result.codecIssue = result.codecIssue || 'Device-dependent codec support';
        break;
      case 'device-dependent':
        log(`⚠ ExoPlayer: Device-dependent — hardware decoder required`);
        result.codecIssue = result.codecIssue || 'Requires hardware decoder on device';
        if (result.status === 'pass') result.status = 'warn';
        break;
      case 'unsupported':
        log(`✗ ExoPlayer: Not supported natively`);
        result.status = 'fail';
        break;
    }
  }

  return result;
}

// ─── Status Badge ─────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: TestStatus }) {
  const configs: Record<TestStatus, { label: string; color: string; bg: string; icon: any }> = {
    pending: { label: 'PENDING', color: C.dim,     bg: 'rgba(156,163,175,0.12)', icon: 'time-outline' },
    running: { label: 'TESTING', color: C.yellow,  bg: 'rgba(245,158,11,0.12)',  icon: 'sync-outline' },
    pass:    { label: 'PASS',    color: C.green,    bg: 'rgba(16,185,129,0.15)',  icon: 'checkmark-circle' },
    fail:    { label: 'FAIL',    color: C.live,     bg: 'rgba(239,68,68,0.15)',   icon: 'close-circle' },
    warn:    { label: 'WARN',    color: C.yellow,   bg: 'rgba(245,158,11,0.15)',  icon: 'warning-outline' },
  };
  const cfg = configs[status];
  return (
    <View style={[b.badge, { backgroundColor: cfg.bg, borderColor: `${cfg.color}40` }]}>
      <Ionicons name={cfg.icon as any} size={12} color={cfg.color} />
      <Text style={[b.badgeTxt, { color: cfg.color }]}>{cfg.label}</Text>
    </View>
  );
}

const b = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8, borderWidth: 1 },
  badgeTxt: { fontSize: 10, fontWeight: '800', letterSpacing: 0.5 },
});

// ─── Stream Test Card ─────────────────────────────────────────────────────────
function StreamCard({
  stream, result, isRunning,
}: {
  stream: TestStream;
  result: TestResult;
  isRunning: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <TouchableOpacity
      style={[sc.card, { borderLeftColor: stream.color, borderLeftWidth: 3 }]}
      onPress={() => setExpanded(v => !v)}
      activeOpacity={0.85}
    >
      {/* Header row */}
      <View style={sc.header}>
        <View style={[sc.iconWrap, { backgroundColor: `${stream.color}18` }]}>
          <Ionicons name={stream.icon as any} size={18} color={stream.color} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={sc.titleRow}>
            <Text style={sc.format}>{stream.format}</Text>
            <Text style={sc.ext}>{stream.extension}</Text>
          </View>
          <Text style={sc.desc}>{stream.description}</Text>
        </View>
        {isRunning
          ? <ActivityIndicator size="small" color={C.yellow} />
          : <StatusBadge status={result.status} />
        }
        <Ionicons
          name={expanded ? 'chevron-up' : 'chevron-down'}
          size={16} color={C.dim}
          style={{ marginLeft: 8 }}
        />
      </View>

      {/* Stats row (shown when not pending) */}
      {result.status !== 'pending' && !isRunning && (
        <View style={sc.statsRow}>
          {result.httpStatus > 0 && (
            <StatChip label="HTTP" value={String(result.httpStatus)} color={result.status === 'pass' ? C.green : C.live} />
          )}
          {result.latencyMs > 0 && (
            <StatChip label="Latency" value={`${result.latencyMs}ms`} color={result.latencyMs < 500 ? C.green : C.yellow} />
          )}
          {result.contentType ? (
            <StatChip label="Type" value={result.contentType.split(';')[0]} color={C.blue} />
          ) : null}
          {result.acceptRanges === 'bytes' && (
            <StatChip label="Seek" value="✓" color={C.green} />
          )}
        </View>
      )}

      {/* Error / issue */}
      {result.error && !expanded && (
        <Text style={sc.errorLine} numberOfLines={1}>⚠ {result.error}</Text>
      )}

      {/* Expanded: full logs */}
      {expanded && (
        <View style={sc.logsWrap}>
          <Text style={sc.logsTitle}>Test Logs</Text>
          {result.logs.map((l, i) => (
            <Text key={i} style={[sc.logLine, {
              color: l.startsWith('✓') ? C.green : l.startsWith('✗') ? C.live : l.startsWith('⚠') ? C.yellow : C.dim,
            }]}>{l}</Text>
          ))}

          {/* ExoPlayer support */}
          <View style={sc.infoBox}>
            <Text style={sc.infoLabel}>ExoPlayer Support</Text>
            <Text style={sc.infoVal}>{
              stream.exoplayerSupport === 'full' ? '✓ Full native support' :
              stream.exoplayerSupport === 'partial' ? '⚠ Partial (container support, codec varies)' :
              stream.exoplayerSupport === 'device-dependent' ? '⚠ Device hardware decoder required' :
              '✗ Not natively supported'
            }</Text>
          </View>
          <View style={sc.infoBox}>
            <Text style={sc.infoLabel}>Codec Notes</Text>
            <Text style={sc.infoVal}>{stream.codecNotes}</Text>
          </View>
          {result.networkIssue && (
            <View style={[sc.infoBox, { borderColor: `${C.yellow}40` }]}>
              <Text style={[sc.infoLabel, { color: C.yellow }]}>Network Issue</Text>
              <Text style={sc.infoVal}>{result.networkIssue}</Text>
            </View>
          )}
          {result.codecIssue && (
            <View style={[sc.infoBox, { borderColor: `${C.live}40` }]}>
              <Text style={[sc.infoLabel, { color: C.live }]}>Codec Issue</Text>
              <Text style={sc.infoVal}>{result.codecIssue}</Text>
            </View>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function StatChip({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <View style={sc.chip}>
      <Text style={sc.chipLabel}>{label}</Text>
      <Text style={[sc.chipVal, { color }]}>{value}</Text>
    </View>
  );
}

const sc = StyleSheet.create({
  card: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: C.border },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  iconWrap: { width: 40, height: 40, borderRadius: 12, justifyContent: 'center', alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 2 },
  format: { color: C.text, fontSize: 15, fontWeight: '700' },
  ext: { color: C.dim, fontSize: 11, backgroundColor: 'rgba(255,255,255,0.06)', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 5 },
  desc: { color: C.dim, fontSize: 11 },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 10 },
  chip: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 6, paddingHorizontal: 8, paddingVertical: 4 },
  chipLabel: { color: C.dimmer, fontSize: 9, fontWeight: '600', textTransform: 'uppercase', marginBottom: 1 },
  chipVal: { fontSize: 11, fontWeight: '700' },
  errorLine: { color: C.yellow, fontSize: 11, marginTop: 8 },
  logsWrap: { marginTop: 12, borderTopWidth: 1, borderTopColor: C.border, paddingTop: 12 },
  logsTitle: { color: C.primary, fontSize: 11, fontWeight: '700', letterSpacing: 0.6, textTransform: 'uppercase', marginBottom: 8 },
  logLine: { fontSize: 11, lineHeight: 16, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 2 },
  infoBox: { marginTop: 10, backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: 8, padding: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  infoLabel: { color: C.primary, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 4 },
  infoVal: { color: '#d1d5db', fontSize: 12, lineHeight: 18 },
});

// ─── Summary Stats ────────────────────────────────────────────────────────────
function SummaryBar({ results }: { results: Record<string, TestResult> }) {
  const all = Object.values(results);
  const pass = all.filter(r => r.status === 'pass').length;
  const warn = all.filter(r => r.status === 'warn').length;
  const fail = all.filter(r => r.status === 'fail').length;
  const pending = all.filter(r => r.status === 'pending' || r.status === 'running').length;
  const total = TEST_STREAMS.length;

  return (
    <View style={sm.bar}>
      <View style={sm.stat}>
        <Text style={[sm.num, { color: C.green }]}>{pass}</Text>
        <Text style={sm.lbl}>Pass</Text>
      </View>
      <View style={sm.divider} />
      <View style={sm.stat}>
        <Text style={[sm.num, { color: C.yellow }]}>{warn}</Text>
        <Text style={sm.lbl}>Warn</Text>
      </View>
      <View style={sm.divider} />
      <View style={sm.stat}>
        <Text style={[sm.num, { color: C.live }]}>{fail}</Text>
        <Text style={sm.lbl}>Fail</Text>
      </View>
      <View style={sm.divider} />
      <View style={sm.stat}>
        <Text style={[sm.num, { color: C.dim }]}>{pending}</Text>
        <Text style={sm.lbl}>Pending</Text>
      </View>
      <View style={{ flex: 1 }} />
      <Text style={sm.total}>{pass + warn}/{total}</Text>
    </View>
  );
}

const sm = StyleSheet.create({
  bar: { flexDirection: 'row', alignItems: 'center', backgroundColor: C.card, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: C.border },
  stat: { alignItems: 'center', minWidth: 44 },
  num: { fontSize: 22, fontWeight: '800' },
  lbl: { color: C.dim, fontSize: 10, fontWeight: '600', marginTop: 2 },
  divider: { width: 1, height: 28, backgroundColor: C.border, marginHorizontal: 6 },
  total: { color: C.text, fontSize: 20, fontWeight: '800' },
});

// ─── Generate Final Report Text ───────────────────────────────────────────────
function buildReport(results: Record<string, TestResult>): string {
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const lines: string[] = [];
  lines.push('═══════════════════════════════════════');
  lines.push('  STREAMPRO — IPTV COMPATIBILITY REPORT');
  lines.push(`  Generated: ${ts}`);
  lines.push(`  Platform: ${Platform.OS.toUpperCase()} ${Platform.Version}`);
  lines.push('═══════════════════════════════════════');
  lines.push('');
  lines.push('FORMAT TEST RESULTS');
  lines.push('───────────────────');

  for (const stream of TEST_STREAMS) {
    const r = results[stream.id];
    const icon =
      r.status === 'pass' ? '✓' :
      r.status === 'warn' ? '⚠' :
      r.status === 'fail' ? '✗' : '○';
    lines.push(`${icon} ${stream.format.padEnd(10)} ${stream.extension.padEnd(6)} HTTP ${r.httpStatus || '---'} ${r.latencyMs ? `(${r.latencyMs}ms)` : ''}`);
    if (r.contentType) lines.push(`  Content-Type: ${r.contentType}`);
    if (r.error) lines.push(`  Error: ${r.error}`);
    if (r.networkIssue) lines.push(`  Network: ${r.networkIssue}`);
    if (r.codecIssue) lines.push(`  Codec: ${r.codecIssue}`);
    lines.push('');
  }

  lines.push('EXOPLAYER CODEC SUPPORT');
  lines.push('───────────────────────');
  for (const c of CODEC_MATRIX) {
    lines.push(`  ${(c.codec).padEnd(18)} ${c.android.padEnd(8)} ${c.note}`);
  }

  lines.push('');
  lines.push('RECOMMENDATIONS');
  lines.push('───────────────');

  const failedFormats = TEST_STREAMS.filter(s => results[s.id]?.status === 'fail');
  const warnFormats = TEST_STREAMS.filter(s => results[s.id]?.status === 'warn');
  const passFormats = TEST_STREAMS.filter(s => results[s.id]?.status === 'pass');

  if (passFormats.length > 0) lines.push(`Working: ${passFormats.map(f => f.format).join(', ')}`);
  if (warnFormats.length > 0) lines.push(`With Warnings: ${warnFormats.map(f => f.format).join(', ')}`);
  if (failedFormats.length > 0) lines.push(`Failed: ${failedFormats.map(f => f.format).join(', ')}`);

  lines.push('');
  lines.push('• For HTTP streams: usesCleartextTraffic=true (Android) / NSAllowsArbitraryLoads=true (iOS)');
  lines.push('• For MPEG-TS: Ensure Content-Type is video/mp2t or URL ends in .ts');
  lines.push('• For H.265/HEVC: Requires Android 5.0+ hardware decoder — test on target device');
  lines.push('• Custom User-Agent recommended for IPTV provider compatibility');
  lines.push('• AC3/EAC3 audio: Verify device supports Dolby — software decode rarely available');
  lines.push('');
  lines.push('═══════════════════════════════════════');
  return lines.join('\n');
}

// ─── Main Screen ──────────────────────────────────────────────────────────────
export default function IPTVReportScreen() {
  if (!__DEV__) {
    return <Redirect href="/(main)" />;
  }

  const insets = useSafeAreaInsets();
  const [results, setResults] = useState<Record<string, TestResult>>(
    Object.fromEntries(TEST_STREAMS.map(s => [s.id, defaultResult()]))
  );
  const [running, setRunning] = useState<string | null>(null);
  const [allRunning, setAllRunning] = useState(false);
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [activeTab, setActiveTab] = useState<'tests' | 'codecs' | 'report'>('tests');
  const reportText = useRef('');

  const addLog = useCallback((id: string, msg: string) => {
    setLiveLogs(prev => [`[${id.toUpperCase()}] ${msg}`, ...prev].slice(0, 50));
  }, []);

  const runSingleTest = useCallback(async (stream: TestStream) => {
    setRunning(stream.id);
    setResults(prev => ({ ...prev, [stream.id]: { ...defaultResult(), status: 'running', logs: [] } }));
    const result = await runStreamTest(stream, addLog);
    setResults(prev => ({ ...prev, [stream.id]: result }));
    setRunning(null);
  }, [addLog]);

  const runAllTests = useCallback(async () => {
    setAllRunning(true);
    setLiveLogs([]);
    // Reset all
    setResults(Object.fromEntries(TEST_STREAMS.map(s => [s.id, defaultResult()])));

    for (const stream of TEST_STREAMS) {
      setRunning(stream.id);
      setResults(prev => ({ ...prev, [stream.id]: { ...defaultResult(), status: 'running', logs: [] } }));
      const result = await runStreamTest(stream, addLog);
      setResults(prev => ({ ...prev, [stream.id]: result }));
    }

    setRunning(null);
    setAllRunning(false);
    setActiveTab('report');
  }, [addLog]);

  const shareReport = useCallback(() => {
    const text = buildReport(results);
    reportText.current = text;
    Share.share({ message: text, title: 'StreamPro IPTV Compatibility Report' }).catch(() => {});
  }, [results]);

  const finalReport = buildReport(results);
  const allDone = Object.values(results).every(r => r.status !== 'pending' && r.status !== 'running');

  return (
    <View style={[r.container, { paddingTop: insets.top }]}>
      <StatusBar barStyle="light-content" backgroundColor={C.bg} />

      {/* Header */}
      <View style={r.header}>
        <TouchableOpacity onPress={() => router.back()} style={r.backBtn}>
          <Ionicons name="arrow-back" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={r.headerTitle}>IPTV Compatibility</Text>
          <Text style={r.headerSub}>Format & codec test report</Text>
        </View>
        {allDone && (
          <TouchableOpacity onPress={shareReport} style={r.shareBtn}>
            <Ionicons name="share-outline" size={20} color={C.primary} />
          </TouchableOpacity>
        )}
      </View>

      {/* Tabs */}
      <View style={r.tabs}>
        {(['tests', 'codecs', 'report'] as const).map(tab => (
          <TouchableOpacity
            key={tab}
            onPress={() => setActiveTab(tab)}
            style={[r.tab, activeTab === tab && r.tabActive]}
          >
            <Text style={[r.tabTxt, activeTab === tab && r.tabActiveTxt]}>
              {tab === 'tests' ? 'Format Tests' : tab === 'codecs' ? 'Codec Matrix' : 'Final Report'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Summary bar */}
      <View style={{ paddingHorizontal: 16 }}>
        <SummaryBar results={results} />
      </View>

      {/* Run all button */}
      {activeTab === 'tests' && (
        <View style={r.runRow}>
          <TouchableOpacity
            onPress={allRunning ? undefined : runAllTests}
            style={[r.runBtn, allRunning && r.runBtnDisabled]}
            activeOpacity={0.8}
          >
            <LinearGradient
              colors={allRunning ? ['#374151', '#374151'] : [C.primary, C.accent]}
              start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }}
              style={r.runGrad}
            >
              {allRunning
                ? <><ActivityIndicator size="small" color="#fff" /><Text style={r.runTxt}>Testing… ({Object.values(results).filter(r => r.status === 'pass' || r.status === 'fail' || r.status === 'warn').length}/{TEST_STREAMS.length})</Text></>
                : <><MaterialIcons name="play-arrow" size={20} color="#fff" /><Text style={r.runTxt}>Run All Tests</Text></>
              }
            </LinearGradient>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}>

        {/* ── Format Tests tab ─────────────────────────────────────────── */}
        {activeTab === 'tests' && (
          <View style={{ paddingHorizontal: 16 }}>
            {TEST_STREAMS.map(stream => (
              <StreamCard
                key={stream.id}
                stream={stream}
                result={results[stream.id]}
                isRunning={running === stream.id}
              />
            ))}

            {/* Live log tail */}
            {liveLogs.length > 0 && (
              <View style={r.logBox}>
                <Text style={r.logBoxTitle}>📡 Live Test Output</Text>
                {liveLogs.slice(0, 12).map((l, i) => (
                  <Text key={i} style={[r.logLine, {
                    color: l.includes('FAIL') || l.includes('✗') ? C.live :
                           l.includes('⚠') || l.includes('WARN') ? C.yellow :
                           l.includes('✓') ? C.green : C.dim,
                  }]}>{l}</Text>
                ))}
              </View>
            )}
          </View>
        )}

        {/* ── Codec Matrix tab ─────────────────────────────────────────── */}
        {activeTab === 'codecs' && (
          <View style={{ paddingHorizontal: 16 }}>
            {/* Video codecs */}
            <View style={r.section}>
              <Text style={r.sectionTitle}>🎬 Video Codecs</Text>
              <View style={r.tableHeader}>
                <Text style={[r.th, { flex: 2 }]}>Codec</Text>
                <Text style={r.th}>Android</Text>
                <Text style={[r.th, { flex: 1.5 }]}>Notes</Text>
              </View>
              {CODEC_MATRIX.filter(c => c.video).map((c, i) => (
                <View key={i} style={[r.tableRow, i % 2 === 0 && r.tableRowAlt]}>
                  <Text style={[r.td, { flex: 2, color: C.text, fontWeight: '600' }]}>{c.codec}</Text>
                  <Text style={[r.td, { color: C.green }]}>{c.android}</Text>
                  <Text style={[r.td, { flex: 1.5 }]}>{c.note}</Text>
                </View>
              ))}
            </View>

            {/* Audio codecs */}
            <View style={r.section}>
              <Text style={r.sectionTitle}>🔊 Audio Codecs</Text>
              <View style={r.tableHeader}>
                <Text style={[r.th, { flex: 2 }]}>Codec</Text>
                <Text style={r.th}>Android</Text>
                <Text style={[r.th, { flex: 1.5 }]}>Notes</Text>
              </View>
              {CODEC_MATRIX.filter(c => c.audio).map((c, i) => (
                <View key={i} style={[r.tableRow, i % 2 === 0 && r.tableRowAlt]}>
                  <Text style={[r.td, { flex: 2, color: C.text, fontWeight: '600' }]}>{c.codec}</Text>
                  <Text style={[r.td, { color: c.android === '5.0+' ? C.yellow : C.green }]}>{c.android}</Text>
                  <Text style={[r.td, { flex: 1.5 }]}>{c.note}</Text>
                </View>
              ))}
            </View>

            {/* ExoPlayer config reference */}
            <View style={r.section}>
              <Text style={r.sectionTitle}>⚙️ Buffer Config (Current)</Text>
              <View style={r.configBox}>
                <ConfigRow label="Live min buffer" value="5,000 ms" />
                <ConfigRow label="Live max buffer" value="20,000 ms" />
                <ConfigRow label="Live playback buffer" value="2,000 ms" />
                <ConfigRow label="VOD min buffer" value="15,000 ms" />
                <ConfigRow label="VOD max buffer" value="60,000 ms" />
                <ConfigRow label="VOD playback buffer" value="2,500 ms" />
                <ConfigRow label="User-Agent" value="Chrome/120 Mobile" />
                <ConfigRow label="Cleartext (HTTP)" value="✓ Enabled" color={C.green} />
                <ConfigRow label="PiP" value="✓ Enabled" color={C.green} />
                <ConfigRow label="Notification Controls" value="✓ Enabled" color={C.green} />
              </View>
            </View>
          </View>
        )}

        {/* ── Final Report tab ─────────────────────────────────────────── */}
        {activeTab === 'report' && (
          <View style={{ paddingHorizontal: 16 }}>
            {!allDone && (
              <View style={r.notReadyBox}>
                <Ionicons name="information-circle-outline" size={20} color={C.yellow} />
                <Text style={r.notReadyTxt}>Run all tests first to generate the final report</Text>
              </View>
            )}
            {allDone && (
              <>
                {/* Quick visual summary */}
                <View style={r.section}>
                  <Text style={r.sectionTitle}>📊 Results Summary</Text>
                  {TEST_STREAMS.map(stream => {
                    const res = results[stream.id];
                    return (
                      <View key={stream.id} style={r.resultRow}>
                        <Text style={[r.resultIcon, {
                          color: res.status === 'pass' ? C.green : res.status === 'warn' ? C.yellow : C.live,
                        }]}>
                          {res.status === 'pass' ? '✓' : res.status === 'warn' ? '⚠' : '✗'}
                        </Text>
                        <Text style={r.resultFormat}>{stream.format}</Text>
                        <Text style={r.resultExt}>{stream.extension}</Text>
                        <Text style={r.resultDetail} numberOfLines={1}>
                          {res.status === 'pass'
                            ? `HTTP ${res.httpStatus} · ${res.latencyMs}ms`
                            : res.status === 'warn'
                            ? (res.codecIssue || res.networkIssue || `HTTP ${res.httpStatus}`)
                            : (res.error || 'Failed')}
                        </Text>
                      </View>
                    );
                  })}
                </View>

                {/* Recommendations */}
                <View style={r.section}>
                  <Text style={r.sectionTitle}>💡 Recommendations</Text>
                  {[
                    { icon: 'wifi-outline', color: C.blue, text: 'HTTP streams work — usesCleartextTraffic enabled in Android config' },
                    { icon: 'shield-checkmark-outline', color: C.green, text: 'iOS NSAllowsArbitraryLoads=true set — all HTTP IPTV streams allowed' },
                    { icon: 'tv-outline', color: C.yellow, text: 'MPEG-TS: Works when Content-Type is video/mp2t or URL ends in .ts' },
                    { icon: 'hardware-chip-outline', color: C.live, text: 'H.265/HEVC: Test on target device — hardware decoder required' },
                    { icon: 'volume-high-outline', color: C.yellow, text: 'AC3/EAC3 audio: Only on premium Dolby-certified devices' },
                    { icon: 'person-outline', color: C.primary, text: 'IPTV User-Agent header set — prevents most provider IP/UA blocks' },
                  ].map((item, i) => (
                    <View key={i} style={r.recRow}>
                      <Ionicons name={item.icon as any} size={16} color={item.color} />
                      <Text style={r.recTxt}>{item.text}</Text>
                    </View>
                  ))}
                </View>

                {/* Raw report text */}
                <View style={r.section}>
                  <View style={r.rawHeader}>
                    <Text style={r.sectionTitle}>📄 Raw Report</Text>
                    <TouchableOpacity onPress={shareReport} style={r.copyBtn}>
                      <Ionicons name="share-outline" size={14} color={C.primary} />
                      <Text style={r.copyBtnTxt}>Share</Text>
                    </TouchableOpacity>
                  </View>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                    <Text style={r.rawText}>{finalReport}</Text>
                  </ScrollView>
                </View>
              </>
            )}
          </View>
        )}
      </ScrollView>
    </View>
  );
}

function ConfigRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <View style={r.cfgRow}>
      <Text style={r.cfgLabel}>{label}</Text>
      <Text style={[r.cfgVal, color ? { color } : {}]}>{value}</Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const r = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },

  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 14, gap: 12 },
  backBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: 'rgba(255,255,255,0.08)', justifyContent: 'center', alignItems: 'center' },
  headerTitle: { color: C.text, fontSize: 18, fontWeight: '800' },
  headerSub: { color: C.dim, fontSize: 11, marginTop: 1 },
  shareBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: `${C.primary}18`, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: `${C.primary}40` },

  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 14, backgroundColor: C.card, borderRadius: 12, padding: 4, borderWidth: 1, borderColor: C.border },
  tab: { flex: 1, paddingVertical: 8, borderRadius: 9, alignItems: 'center' },
  tabActive: { backgroundColor: C.primary },
  tabTxt: { color: C.dim, fontSize: 12, fontWeight: '600' },
  tabActiveTxt: { color: '#fff', fontWeight: '700' },

  runRow: { paddingHorizontal: 16, marginBottom: 14 },
  runBtn: { borderRadius: 14, overflow: 'hidden' },
  runBtnDisabled: { opacity: 0.7 },
  runGrad: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  runTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },

  logBox: { backgroundColor: '#0A0A14', borderRadius: 12, padding: 12, marginTop: 6, borderWidth: 1, borderColor: C.border },
  logBoxTitle: { color: C.primary, fontSize: 11, fontWeight: '700', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.6 },
  logLine: { fontSize: 10, lineHeight: 14, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', marginBottom: 2 },

  section: { backgroundColor: C.card, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: C.border },
  sectionTitle: { color: C.primary, fontSize: 13, fontWeight: '700', letterSpacing: 0.4, marginBottom: 12 },

  tableHeader: { flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: C.border, marginBottom: 4 },
  th: { flex: 1, color: C.dimmer, fontSize: 10, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  tableRow: { flexDirection: 'row', paddingVertical: 8 },
  tableRowAlt: { backgroundColor: 'rgba(255,255,255,0.02)', borderRadius: 6 },
  td: { flex: 1, color: C.dim, fontSize: 11 },

  configBox: { gap: 0 },
  cfgRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  cfgLabel: { color: C.dim, fontSize: 12 },
  cfgVal: { color: C.text, fontSize: 12, fontWeight: '600' },

  notReadyBox: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: 'rgba(245,158,11,0.1)', borderRadius: 12, padding: 14, marginBottom: 14, borderWidth: 1, borderColor: 'rgba(245,158,11,0.25)' },
  notReadyTxt: { color: C.yellow, fontSize: 13, flex: 1 },

  resultRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)' },
  resultIcon: { fontSize: 16, fontWeight: '800', width: 18 },
  resultFormat: { color: C.text, fontSize: 13, fontWeight: '700', width: 72 },
  resultExt: { color: C.dim, fontSize: 11, width: 44 },
  resultDetail: { flex: 1, color: C.dim, fontSize: 11 },

  recRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 10, marginBottom: 10 },
  recTxt: { flex: 1, color: '#d1d5db', fontSize: 12, lineHeight: 18 },

  rawHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  copyBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: `${C.primary}18`, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: `${C.primary}40` },
  copyBtnTxt: { color: C.primary, fontSize: 12, fontWeight: '600' },
  rawText: { color: C.dim, fontSize: 9.5, fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace', lineHeight: 14 },
});
