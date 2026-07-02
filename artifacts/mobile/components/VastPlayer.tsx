/**
 * VastPlayer — Lightweight, Expo-compatible VAST pre-roll ad player.
 *
 * Approach:
 *  - All VAST XML fetching and video playback happens inside a react-native-webview
 *    HTML page. No native ad SDK is required.
 *  - Fetches the VAST XML from within the WebView JS context, parses it to
 *    extract the best MediaFile URL (prefers MP4) and skipoffset.
 *  - Plays the ad video using an HTML5 <video> element.
 *  - Shows an "AD" label, skip countdown, and skip button.
 *  - Posts messages to React Native on impression / skip / complete / error.
 *  - Fail-safe: any error (CORS, parse, playback) fires onComplete so the
 *    main stream is never permanently blocked by a broken ad URL.
 */

import React, { useCallback } from 'react';
import {
  Modal,
  View,
  StyleSheet,
  StatusBar,
  SafeAreaView,
} from 'react-native';
import { WebView, type WebViewMessageEvent } from 'react-native-webview';

// ─── VAST player HTML ────────────────────────────────────────────────────────
// Inlined so there is no file-loading dependency. Template tokens:
//   __VAST_URL__   → replaced at runtime with the actual VAST tag URL
//   __SKIP_SEC__   → default skip delay in seconds (overridden by VAST skipoffset)

function buildVastHtml(vastUrl: string, defaultSkipSec: number): string {
  const safeUrl = vastUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  return `<!DOCTYPE html>
<html>
<head>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1">
<style>
*{margin:0;padding:0;box-sizing:border-box;}
html,body{width:100%;height:100%;background:#000;font-family:-apple-system,sans-serif;overflow:hidden;}
video{width:100%;height:100%;object-fit:contain;display:block;}
#wrap{position:relative;width:100%;height:100%;}
#adlbl{position:absolute;top:12px;left:12px;background:rgba(0,0,0,.65);color:#9ca3af;font-size:10px;font-weight:700;padding:3px 8px;border-radius:4px;letter-spacing:1px;z-index:10;}
#skip-area{position:absolute;bottom:20px;right:14px;z-index:10;}
.cd-txt{background:rgba(0,0,0,.65);color:#aaa;font-size:13px;padding:8px 14px;border-radius:6px;display:inline-block;}
.skip-btn{background:rgba(0,0,0,.75);color:#fff;border:1px solid rgba(255,255,255,.35);padding:9px 18px;border-radius:6px;font-size:13px;font-weight:600;cursor:pointer;}
#loader{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#9ca3af;font-size:13px;text-align:center;}
#err-msg{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);color:#9ca3af;font-size:13px;text-align:center;display:none;}
</style>
</head>
<body>
<div id="wrap">
  <video id="v" playsinline webkit-playsinline></video>
  <div id="adlbl">AD</div>
  <div id="skip-area"><span class="cd-txt">Loading…</span></div>
  <div id="loader">Loading ad…</div>
  <div id="err-msg">Ad unavailable</div>
</div>
<script>
var VAST_URL="${safeUrl}";
var DEFAULT_SKIP=${defaultSkipSec};
var skipSec=DEFAULT_SKIP;
var done=false;

function rn(type,extra){
  try{window.ReactNativeWebView.postMessage(JSON.stringify(Object.assign({type:type},extra||{})));}catch(e){}
}

function parseSkipOffset(s){
  if(!s)return DEFAULT_SKIP;
  var p=s.split(':');
  if(p.length===3)return Math.round(parseInt(p[0]||'0',10)*3600+parseInt(p[1]||'0',10)*60+parseFloat(p[2]||'0'));
  return parseFloat(s)||DEFAULT_SKIP;
}

function extractCdata(s){
  var m=s.match(/<!\[CDATA\[([\s\S]*?)\]\]>/);
  return m?m[1].trim():s.trim();
}

function showError(){
  document.getElementById('loader').style.display='none';
  document.getElementById('err-msg').style.display='block';
  setTimeout(function(){rn('error');},1800);
}

function doSkip(){
  if(done)return;
  done=true;
  rn('skip');
}

function startVideo(url){
  document.getElementById('loader').style.display='none';
  var v=document.getElementById('v');
  var skipArea=document.getElementById('skip-area');

  function updateSkipUI(){
    if(done)return;
    var rem=Math.ceil(Math.max(0,skipSec-v.currentTime));
    if(rem>0){
      skipArea.innerHTML='<span class="cd-txt">Skip in '+rem+'s</span>';
    }else{
      skipArea.innerHTML='<button class="skip-btn" onclick="doSkip()">Skip Ad \u203a</button>';
    }
  }

  v.src=url;
  v.addEventListener('timeupdate',updateSkipUI);
  v.addEventListener('ended',function(){if(done)return;done=true;rn('complete');});
  v.addEventListener('error',function(){if(!done)showError();});

  var playP=v.play();
  if(playP){
    playP.catch(function(){
      v.muted=true;
      v.play().catch(function(){showError();});
    });
  }

  rn('impression');
}

fetch(VAST_URL,{signal:AbortSignal.timeout?AbortSignal.timeout(10000):undefined})
  .then(function(r){
    if(!r.ok)throw new Error('HTTP '+r.status);
    return r.text();
  })
  .then(function(xml){
    var skipM=xml.match(/skipoffset="([^"]+)"/i);
    if(skipM)skipSec=parseSkipOffset(skipM[1]);

    var best=null;
    var re=/<MediaFile[^>]*>([\s\S]*?)<\/MediaFile>/gi;
    var m;
    while((m=re.exec(xml))!==null){
      var u=extractCdata(m[1]);
      if(!u)continue;
      if(!best)best=u;
      var tm=m[0].match(/type="([^"]+)"/i);
      if(tm&&tm[1].toLowerCase().indexOf('mp4')!==-1){best=u;break;}
    }
    if(!best){showError();return;}
    startVideo(best);
  })
  .catch(function(){showError();});
</script>
</body>
</html>`;
}

// ─── Component ────────────────────────────────────────────────────────────────

interface VastPlayerProps {
  /** VAST tag URL — if empty/null the component renders nothing */
  vastUrl: string | null | undefined;
  /** Called when the ad finishes playing or is skipped — always fires eventually */
  onComplete: () => void;
  /** Seconds before the skip button appears. Overridden by VAST skipoffset. Default: 5 */
  defaultSkipSec?: number;
}

export function VastPlayer({ vastUrl, onComplete, defaultSkipSec = 5 }: VastPlayerProps) {
  const handleMessage = useCallback(
    (event: WebViewMessageEvent) => {
      try {
        const msg = JSON.parse(event.nativeEvent.data) as { type: string };
        if (msg.type === 'skip' || msg.type === 'complete' || msg.type === 'error') {
          onComplete();
        }
      } catch {
        // malformed message — ignore
      }
    },
    [onComplete],
  );

  if (!vastUrl) return null;

  const html = buildVastHtml(vastUrl, defaultSkipSec);

  return (
    <Modal
      visible
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onComplete}
    >
      <SafeAreaView style={styles.root}>
        <StatusBar hidden />
        <WebView
          source={{ html }}
          style={styles.webview}
          onMessage={handleMessage}
          // Allow any origin so VAST media URLs work regardless of domain
          originWhitelist={['*']}
          // Android: allow mixed content (HTTP media from HTTPS VAST)
          mixedContentMode="always"
          // Allow inline media playback on iOS without requiring fullscreen
          allowsInlineMediaPlayback
          // Do not require user gesture — the ad must autoplay
          mediaPlaybackRequiresUserAction={false}
          // Disable scrolling — the video should fill the screen
          scrollEnabled={false}
          // No bouncing on iOS
          bounces={false}
          // Show a loading indicator while the WebView initialises
          startInLoadingState
          // Transparent so the black video background shows correctly
          backgroundColor="#000000"
          // Allow JS (required for VAST parsing)
          javaScriptEnabled
          domStorageEnabled
        />
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: '#000',
  },
  webview: {
    flex: 1,
    backgroundColor: '#000',
  },
});
