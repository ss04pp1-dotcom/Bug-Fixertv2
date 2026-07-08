/**
import { openExternalUrl } from '@/lib/safeLink';
 * AdBanner — Global Config-Aware Banner Component
 *
 * Priority for banner HTML:
 *   1. `htmlCode` prop (passed directly by caller, e.g. channel-grid)
 *   2. Global ad config's `banner.htmlCode` (Adsterra / Monetag global script)
 *   3. House ad fetched from API (image or HTML)
 *
 * After the primary unit, two optional secondary units may appear:
 *   A. `banner.secondHtmlCode` — second WebView ad (HilTop, another network, etc.)
 *   B. `banner.vastUrl` — inline VAST video player rendered in a WebView
 *
 * Visibility rules (all must pass):
 *   a. User is NOT premium
 *   b. globalConfig.isEnabled === true
 *   c. globalConfig.banner.enabled === true
 *   d. If placement maps to a position key → that position is enabled in global config
 *
 * Fix — banner height auto-sizing:
 *   WebViews inject JS to measure their content height and post it back via
 *   postMessage. The container height adjusts to fit (capped at maxHeight).
 *   This prevents ad content from being clipped when the creative is taller
 *   than the configured `banner.height`.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  TouchableOpacity,
  StyleSheet,
  Linking,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { WebView } from 'react-native-webview';
import { Config } from '@/constants/config';
import { useAuthStore } from '@/lib/auth-store';
import { useGlobalAdConfig } from '@/hooks/useGlobalAdConfig';
import { getNextVastUrlForPosition } from '@/lib/global-ad-engine';

// ─── Base URL for WebView ads ─────────────────────────────────────────────────
// Ad network scripts (Adsterra, Monetag, HilTop, etc.) need a real HTTP origin
// in the WebView's baseUrl — without it the XHR/fetch calls inside the script
// hit `null` origin and are blocked, leaving the banner black.
const AD_BASE_URL = (() => {
  try {
    return new URL(Config.API_BASE).origin;
  } catch (e) {
    if (__DEV__) console.warn('[AdBanner] Could not parse Config.API_BASE for baseUrl:', e);
    return undefined;
  }
})();

// ─── Max height cap to prevent a runaway ad from taking over the screen ───────
const MAX_AD_HEIGHT = 400;

// ─── JS injected into every ad WebView to auto-measure content height ─────────
// Posts { type: 'adHeight', h: <pixels> } at 0 / 600 / 1800 / 3500 ms so the
// container can grow to fit the creative instead of clipping it.
const AUTO_HEIGHT_JS = `
(function(){
  function send(){
    var h=Math.max(
      document.body.scrollHeight,document.body.offsetHeight,
      document.documentElement.scrollHeight,document.documentElement.offsetHeight
    );
    if(h>0 && window.ReactNativeWebView)
      window.ReactNativeWebView.postMessage(JSON.stringify({type:'adHeight',h:h}));
  }
  send();
  [600,1800,3500].forEach(function(t){setTimeout(send,t);});
})(); true;
`;

// ─── Placement → banner position key mapping ──────────────────────────────────

const PLACEMENT_TO_POSITION: Record<string, string> = {
  'home-banner':            'home',
  'home_banner':            'home',
  'browse-banner':          'categories',
  'browse_banner':          'categories',
  'channel-grid-banner':    'channelGrid',
  'channel_grid_banner':    'channelGrid',
  'player_banner':          'player',
  'channel_banner':         'player',
  'movies_banner':          'movies',
  'movies-banner':          'movies',
  'live_banner':            'sports',
  'sports-banner':          'sports',
  'sports_banner':          'sports',
  'search_banner':          'search',
  'search-banner':          'search',
  'series_episodes_banner': 'movies',
  'series-banner':          'movies',
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface AdItem {
  id: string;
  name: string;
  imageUrl?: string;
  clickUrl?: string;
  htmlCode?: string;
  type: string;
}

interface AdBannerProps {
  placement: string;
  /** Override HTML — if provided, skips global config check for HTML (but still applies enabled/position checks). */
  htmlCode?: string;
  /** Override banner height. Falls back to global config's `banner.height` or 90px. */
  bannerHeight?: number;
  style?: object;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function wrapHtml(script: string): string {
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box;max-width:100% !important;}
html,body{width:100%;height:100%;min-height:100%;overflow:hidden;background:transparent;-webkit-user-select:none;user-select:none;}
body{display:flex;align-items:center;justify-content:center;}
img{max-width:100% !important;max-height:100% !important;width:auto !important;height:auto !important;object-fit:contain;}
iframe,video,object,embed{max-width:100% !important;width:100% !important;height:100% !important;border:0;}
a{display:block;width:100%;height:100%;}
</style>
</head>
<body>${script}</body>
</html>`;
}

/**
 * Generates a self-contained HTML page that fetches a VAST tag, parses it for
 * the best MediaFile URL, and plays the video inline. Posts { type:'vastDone' }
 * via postMessage when the video ends, is skipped, or errors.
 */
function makeVastHtml(vastUrl: string, skipSec: number): string {
  // Escape the URL for safe embedding in a JS string literal
  const escapedUrl = vastUrl.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;background:#000;overflow:hidden;}
video{width:100%;height:100%;object-fit:contain;display:block;}
#adlabel{position:fixed;top:8px;left:8px;background:rgba(0,0,0,0.6);
  color:#9CA3AF;font-size:9px;font-weight:700;letter-spacing:.8px;
  padding:2px 6px;border-radius:4px;font-family:sans-serif;}
#skipwrap{position:fixed;bottom:10px;right:10px;font-family:sans-serif;}
#countdown{background:rgba(0,0,0,0.65);color:#aaa;font-size:12px;
  padding:5px 12px;border-radius:5px;}
#skipbtn{background:rgba(0,0,0,0.75);color:#fff;font-size:13px;font-weight:600;
  padding:7px 16px;border-radius:5px;border:1px solid rgba(255,255,255,.3);
  cursor:pointer;display:none;}
</style>
</head>
<body>
<span id="adlabel">AD</span>
<video id="v" autoplay playsinline></video>
<div id="skipwrap">
  <span id="countdown">Skip in ${skipSec}s</span>
  <button id="skipbtn" onclick="done()">Skip Ad ›</button>
</div>
<script>
var skipSec=${skipSec},elapsed=0,timer=null,finished=false;

// Idempotent: once called, never fires again
function done(){
  if(finished)return;
  finished=true;
  if(timer){clearInterval(timer);timer=null;}
  if(window.ReactNativeWebView)
    window.ReactNativeWebView.postMessage(JSON.stringify({type:'vastDone'}));
}

function startTimer(){
  timer=setInterval(function(){
    elapsed++;
    var rem=skipSec-elapsed;
    if(rem>0){
      document.getElementById('countdown').textContent='Skip in '+rem+'s';
    } else {
      // Stop interval — no more work to do in the countdown path
      if(timer){clearInterval(timer);timer=null;}
      document.getElementById('countdown').style.display='none';
      document.getElementById('skipbtn').style.display='block';
    }
  },1000);
}

// Decode XML entities in a string (covers the 5 predefined + numeric refs)
function decodeXml(s){
  return s
    .replace(/&amp;/g,'&')
    .replace(/&lt;/g,'<')
    .replace(/&gt;/g,'>')
    .replace(/&quot;/g,'"')
    .replace(/&#39;/g,"'")
    .replace(/&#x([0-9a-fA-F]+);/g,function(_,h){return String.fromCharCode(parseInt(h,16));})
    .replace(/&#([0-9]+);/g,function(_,d){return String.fromCharCode(parseInt(d,10));});
}
// Unwrap CDATA or plain text from a tag's text content, tolerating whitespace,
// then decode XML entities so query-string params (&amp; etc.) survive correctly.
function unwrap(s){return decodeXml(s.replace(/<!\\[CDATA\\[([\\s\\S]*?)\\]\\]>/g,'$1').trim());}

// Extract the best (preferably MP4/progressive) MediaFile URL from VAST XML
function extractMedia(xml){
  var re=/<MediaFile(\\s[^>]*)?>([\\s\\S]*?)<\\/MediaFile>/gi;
  var best=null, bestScore=-1, m;
  while((m=re.exec(xml))!==null){
    var attrs=m[1]||'';
    var url=unwrap(m[2]);
    if(!url)continue;
    // Score: MP4/progressive delivery wins over everything else
    var isMp4=/video\\/mp4/i.test(attrs)||/\\.mp4(\\?|$)/i.test(url);
    var isProg=/delivery="progressive"/i.test(attrs);
    var score=(isMp4?2:0)+(isProg?1:0);
    if(score>bestScore){bestScore=score;best=url;}
  }
  return best;
}

// fetch with a hard timeout via Promise.race — works even without AbortController.
// Uses AbortController when available for proper resource cleanup; falls back to
// a pure-promise race so the request never hangs indefinitely.
function fetchTimeout(url,ms){
  var timeoutP=new Promise(function(_,rej){setTimeout(function(){rej(new Error('timeout'));},ms);});
  var fetchP;
  try{
    var ctrl=new AbortController();
    var t=setTimeout(function(){ctrl.abort();},ms);
    fetchP=fetch(url,{signal:ctrl.signal}).finally(function(){clearTimeout(t);});
  }catch(e){
    fetchP=fetch(url);
  }
  return Promise.race([fetchP,timeoutP]);
}

async function loadVast(url,depth){
  if(depth>3||finished){done();return;}
  try{
    var r=await fetchTimeout(url,12000);
    if(!r.ok){done();return;}
    var xml=await r.text();
    // Handle VAST wrapper redirect — whitespace-tolerant
    var wrapRe=/<VASTAdTagURI[\\s\\S]*?>([\\s\\S]*?)<\\/VASTAdTagURI>/i;
    var wrapM=xml.match(wrapRe);
    if(wrapM){var wrapUrl=unwrap(wrapM[1]);if(wrapUrl){loadVast(wrapUrl,depth+1);return;}}
    var mediaUrl=extractMedia(xml);
    if(!mediaUrl){done();return;}
    var v=document.getElementById('v');
    v.src=mediaUrl;
    v.onended=done;
    v.onerror=function(){done();};
    v.play().catch(function(){done();});
    startTimer();
  }catch(e){done();}
}
loadVast('${escapedUrl}',0);
</script>
</body>
</html>`;
}

async function fetchHouseAd(placement: string): Promise<AdItem | null> {
  try {
    const res = await fetch(
      `${Config.API_BASE}/advertisements/placements/public?slug=${encodeURIComponent(placement)}`,
      { signal: AbortSignal.timeout(5000) },
    );
    if (!res.ok) return null;
    const data = await res.json();
    const items: any[] = Array.isArray(data) ? data : data?.data ?? [];
    const placementItem = items.find((p: any) => p.slug === placement || p.name === placement) ?? items[0];
    if (!placementItem) return null;
    const ads: any[] = Array.isArray(placementItem.advertisements) ? placementItem.advertisements : [];
    const active = ads.filter((a: any) => a.isActive !== false);
    if (active.length === 0) return null;
    const pick = active[Math.floor(Math.random() * active.length)];
    return {
      id:       pick.id,
      name:     pick.title || pick.name || '',
      imageUrl: pick.imageUrl || pick.bannerUrl || '',
      clickUrl: pick.targetUrl || pick.clickUrl || pick.destinationUrl || '',
      htmlCode: pick.htmlCode || '',
      type:     pick.type || 'house_ad',
    };
  } catch {
    return null;
  }
}

async function trackEvent(adId: string, event: 'impression' | 'click', placement: string) {
  try {
    await fetch(`${Config.API_BASE}/advertisements/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ adId, eventType: event, placement }),
    });
  } catch {}
}

// ─── Single WebView ad unit (reusable) ────────────────────────────────────────

interface WebAdUnitProps {
  html: string;
  fallbackHeight: number;
  onDismiss?: () => void;
  showDismiss?: boolean;
  containerStyle?: object;
}

function WebAdUnit({ html, fallbackHeight, onDismiss, showDismiss = true, containerStyle }: WebAdUnitProps) {
  const [height, setHeight] = useState(fallbackHeight);

  const handleMessage = useCallback((e: { nativeEvent: { data: string } }) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === 'adHeight' && typeof d.h === 'number' && d.h > 10) {
        setHeight(Math.min(d.h, MAX_AD_HEIGHT));
      }
    } catch {}
  }, []);

  return (
    <View style={[styles.container, { height, width: '100%', alignSelf: 'stretch' }, containerStyle]}>
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>AD</Text>
      </View>
      <WebView
        source={{ html: wrapHtml(html), baseUrl: AD_BASE_URL }}
        style={{ flex: 1, width: '100%', backgroundColor: 'transparent' }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        thirdPartyCookiesEnabled
        cacheEnabled={false}
        originWhitelist={['https://*', 'http://*']} // Restrict to HTTP(S); blocks javascript:/file:/data: scheme injection
        injectedJavaScript={AUTO_HEIGHT_JS}
        onMessage={handleMessage}
      />
      {showDismiss && onDismiss && (
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={14} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Inline VAST video unit ───────────────────────────────────────────────────

interface VastAdUnitProps {
  vastUrl: string;
  vastHeight: number;
  skipSec: number;
  onDismiss?: () => void;
}

function VastAdUnit({ vastUrl, vastHeight, skipSec, onDismiss }: VastAdUnitProps) {
  // VAST always plays at the banner's configured size (no auto-grow to the
  // video's native resolution) — the video letterboxes via object-fit:contain
  // inside the fixed-height container so it never overflows or resizes the slot.
  const [done, setDone] = useState(false);

  const handleMessage = useCallback((e: { nativeEvent: { data: string } }) => {
    try {
      const d = JSON.parse(e.nativeEvent.data);
      if (d.type === 'vastDone') {
        setDone(true);
      }
    } catch {}
  }, []);

  if (done) return null;

  return (
    <View style={[styles.container, { height: vastHeight, width: '100%', alignSelf: 'stretch' }]}>
      <WebView
        source={{ html: makeVastHtml(vastUrl, skipSec) }}
        style={{ flex: 1, width: '100%', backgroundColor: '#000' }}
        scrollEnabled={false}
        javaScriptEnabled
        domStorageEnabled
        mediaPlaybackRequiresUserAction={false}
        allowsInlineMediaPlayback
        originWhitelist={['https://*', 'http://*']} // Restrict to HTTP(S); blocks javascript:/file:/data: scheme injection
        onMessage={handleMessage}
      />
      {onDismiss && (
        <TouchableOpacity style={styles.dismissBtn} onPress={onDismiss} hitSlop={8}>
          <Ionicons name="close" size={14} color="#9CA3AF" />
        </TouchableOpacity>
      )}
    </View>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function AdBanner({ placement, htmlCode: propHtmlCode, bannerHeight, style }: AdBannerProps) {
  const [houseAd, setHouseAd]     = useState<AdItem | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const [imgError, setImgError]   = useState(false);
  const impressionTracked         = useRef(false);

  const { user }     = useAuthStore();
  const rawIsPremium = !!user?.plan && user.plan.toLowerCase() !== 'free';
  const globalConfig = useGlobalAdConfig();

  // Test Mode: bypass premium check so admins can verify ads work on real devices.
  const isPremium = rawIsPremium && !globalConfig.testMode;

  // ── Visibility checks ──────────────────────────────────────────────────────
  const isGlobalEnabled = globalConfig.isEnabled && globalConfig.banner.enabled;
  const posKey = PLACEMENT_TO_POSITION[placement];
  const isPositionEnabled = posKey
    ? !!(globalConfig.banner.positions as any)[posKey]
    : true; // Unknown placement → allow by default

  // Effective height: prop → per-placement override → global default → 90
  // Use `|| undefined` so a stored 0 (or missing key) safely falls through.
  const perPlacementHeight: number | undefined = posKey
    ? (globalConfig.banner.heights?.[posKey] || undefined)
    : undefined;
  const effectiveHeight = bannerHeight ?? perPlacementHeight ?? globalConfig.banner.height ?? 90;

  // Resolved HTML source: prop → per-placement override → global → house ad
  const perPlacementHtml = posKey
    ? (globalConfig.banner.htmlCodes?.[posKey]?.trim() || '')
    : '';
  const globalHtml  = globalConfig.banner.htmlCode?.trim() || '';
  const houseHtml   = houseAd?.htmlCode?.trim() || '';
  const activeHtml  = propHtmlCode?.trim() || perPlacementHtml || globalHtml || houseHtml || '';

  // Secondary units (only shown when primary HTML is present)
  const secondHtml  = (globalConfig.banner as any).secondHtmlCode?.trim() || '';
  const globalVastUrl = (globalConfig.banner as any).vastUrl?.trim() || '';
  const vastSkipSec = (globalConfig.banner as any).vastSkipSec ?? 5;

  // Per-placement VAST rotation: if this position has 2+ tags configured, cycle
  // through them one after another (persisted across restarts). Falls back to
  // the single global vastUrl when no per-position list is set.
  const vastUrlsForPosition: string[] = posKey
    ? (globalConfig.banner.vastUrlsByPosition?.[posKey] ?? [])
    : [];
  const [rotatedVastUrl, setRotatedVastUrl] = useState<string | null>(null);
  useEffect(() => {
    if (!posKey || vastUrlsForPosition.length === 0) { setRotatedVastUrl(null); return; }
    let cancelled = false;
    getNextVastUrlForPosition(posKey, vastUrlsForPosition).then((url) => {
      if (!cancelled) setRotatedVastUrl(url);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [posKey, vastUrlsForPosition.join('|')]);
  const vastUrl = rotatedVastUrl ?? (vastUrlsForPosition.length === 0 ? globalVastUrl : '');

  // ── Fetch house ad only when needed ───────────────────────────────────────
  useEffect(() => {
    if (isPremium || !isGlobalEnabled || !isPositionEnabled || dismissed) return;
    if (propHtmlCode || globalHtml) return; // Global/prop HTML takes priority — skip fetch

    let cancelled = false;
    fetchHouseAd(placement)
      .then((ad) => { if (!cancelled) setHouseAd(ad); })
      .catch((e: any) => { console.warn('[AdBanner] fetchHouseAd failed:', e?.message ?? e); });
    return () => { cancelled = true; };
  }, [placement, isPremium, isGlobalEnabled, isPositionEnabled, dismissed, propHtmlCode, globalHtml]);

  // ── Impression tracking ───────────────────────────────────────────────────
  useEffect(() => { impressionTracked.current = false; }, [houseAd?.id]);
  useEffect(() => {
    if (houseAd && !impressionTracked.current) {
      impressionTracked.current = true;
      trackEvent(houseAd.id, 'impression', placement);
    }
  }, [houseAd, placement]);

  // ── Debug log ─────────────────────────────────────────────────────────────
  if (__DEV__) console.log(
    `[AdBanner][${placement}]`,
    'isPremium:', isPremium,
    '| isGlobalEnabled:', isGlobalEnabled,
    '| isPositionEnabled:', isPositionEnabled,
    '| dismissed:', dismissed,
    '| activeHtml len:', activeHtml.length,
    '| secondHtml len:', secondHtml.length,
    '| vastUrl:', vastUrl || 'none',
    '| houseAd:', houseAd?.id ?? 'null',
  );

  // ── Gate checks ───────────────────────────────────────────────────────────
  if (isPremium || dismissed) return null;
  if (!isGlobalEnabled || !isPositionEnabled) return null;

  const dismiss = () => setDismissed(true);

  // ── Render WebView banner(s) ──────────────────────────────────────────────
  if (activeHtml) {
    // Wrap all units in a single View so callers always get a stable root node —
    // React Native list/scroll layouts can break with Fragment returns.
    return (
      <View style={style}>
        {/* Primary ad unit */}
        <WebAdUnit
          html={activeHtml}
          fallbackHeight={effectiveHeight}
          onDismiss={dismiss}
        />

        {/* Secondary HTML unit (e.g. HilTop, second network) */}
        {!!secondHtml && (
          <WebAdUnit
            html={secondHtml}
            fallbackHeight={effectiveHeight}
            onDismiss={dismiss}
          />
        )}

        {/* Inline VAST video unit — uses same effectiveHeight as the banner slot */}
        {!!vastUrl && (
          <VastAdUnit
            vastUrl={vastUrl}
            vastHeight={effectiveHeight}
            skipSec={vastSkipSec}
            onDismiss={dismiss}
          />
        )}
      </View>
    );
  }

  // ── Render image banner (house ad) ────────────────────────────────────────
  if (!houseAd || (houseAd.imageUrl && imgError)) return null;

  const handlePress = () => {
    trackEvent(houseAd.id, 'click', placement);
    if (houseAd.clickUrl) openExternalUrl(houseAd.clickUrl);
  };

  return (
    <View style={[styles.container, style]}>
      <View style={styles.adLabel}>
        <Text style={styles.adLabelText}>AD</Text>
      </View>
      <TouchableOpacity activeOpacity={0.85} onPress={handlePress} style={styles.bannerTouch}>
        {houseAd.imageUrl ? (
          <Image
            source={{ uri: Config.imageUrl(houseAd.imageUrl) }}
            style={[styles.bannerImage, { height: effectiveHeight }]}
            resizeMode="contain"
            onError={() => setImgError(true)}
          />
        ) : (
          <View style={[styles.fallbackBanner, { height: effectiveHeight }]}>
            <Ionicons name="megaphone-outline" size={24} color="#6B7280" />
            <Text style={styles.fallbackText}>{houseAd.name}</Text>
          </View>
        )}
      </TouchableOpacity>
      <TouchableOpacity style={styles.dismissBtn} onPress={dismiss} hitSlop={8}>
        <Ionicons name="close" size={14} color="#9CA3AF" />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 24,
    marginVertical: 12,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#13131C',
    position: 'relative',
  },
  adLabel: {
    position: 'absolute',
    top: 8,
    left: 8,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  adLabelText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 0.8,
  },
  bannerTouch: {
    width: '100%',
  },
  bannerImage: {
    width: '100%',
    height: 90,
  },
  fallbackBanner: {
    width: '100%',
    height: 90,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    backgroundColor: '#1C1C2A',
  },
  fallbackText: {
    fontSize: 14,
    color: '#9CA3AF',
    fontWeight: '500',
  },
  dismissBtn: {
    position: 'absolute',
    top: 8,
    right: 8,
    zIndex: 10,
    backgroundColor: 'rgba(0,0,0,0.55)',
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
