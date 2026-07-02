import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, ActivityIndicator,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons, MaterialIcons, MaterialCommunityIcons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { GestureDetector, type GestureType, type ComposedGesture } from 'react-native-gesture-handler';
import type { SharedValue } from 'react-native-reanimated';
import { C } from './constants';
import { g } from './playerStyles';
import { ASPECT_CYCLE, type AspectMode, type SheetType } from './SettingsSheet';
import { SeekFeedback, SwipeIndicator } from './SwipeOverlays';
import { SeekBar } from './SeekBar';
import type { PlayerSource } from '@/lib/player-store';

/**
 * TOP MODE OVERLAY — controls rendered on top of the always-mounted video
 * surface (the video surface itself lives in the parent, as a sibling
 * Animated.View, so it never unmounts on mode change).
 */
export interface TopOverlayProps {
  insetsTop: number;
  topH: number;
  brightness: number;
  buffering: boolean;
  isReady: boolean;
  playerError: string | null;
  hasSource: boolean;
  isLive: boolean;
  src: PlayerSource | undefined;
  sources: PlayerSource[];
  srcIdx: number;
  onSwitchSource: (i: number) => void;
  onRefresh: () => void;
  onShowDebug: () => void;
  pipActive: boolean;
  fsGesture: GestureType | ComposedGesture;
  showCtrl: boolean;
  ctrlStyle: any;
  isLocked: boolean;
  onGoBack: () => void;
  title: string;
  streamFormat: string;
  pip: boolean;
  onTogglePip: () => void;
  selectedVidIdx: number;
  videoTracks: any[];
  onSeek: (delta: number) => void;
  onSeekSide: (v: { side: 'left' | 'right'; secs: number } | null) => void;
  seekSide: { side: 'left' | 'right'; secs: number } | null;
  isPlaying: boolean;
  onSetPlaying: (playing: boolean) => void;
  duration: number;
  currentTime: number;
  progressSV: SharedValue<number>;
  trackWidthRef: React.MutableRefObject<number>;
  onSeekFrac: (frac: number) => void;
  speed: number;
  onOpenSheet: (type: SheetType) => void;
  selectedAudIdx: number;
  selectedSubIdx: number;
  aspect: AspectMode;
  onSetAspect: (a: AspectMode) => void;
  onToggleLandscape: () => void;
  onSetLocked: (locked: boolean) => void;
  onForceShowCtrl: () => void;
  swipeType: 'volume' | 'brightness' | null;
  swipeValue: number;
  bumpCtrl: () => void;
}

export function TopOverlay(props: TopOverlayProps) {
  const {
    insetsTop, topH, brightness, buffering, isReady, playerError, hasSource,
    isLive, src, sources, srcIdx, onSwitchSource, onRefresh, onShowDebug,
    pipActive, fsGesture, showCtrl, ctrlStyle, isLocked, onGoBack, title,
    streamFormat, pip, onTogglePip, selectedVidIdx, videoTracks, onSeek,
    onSeekSide, seekSide, isPlaying, onSetPlaying, duration, currentTime,
    progressSV, trackWidthRef, onSeekFrac, speed, onOpenSheet, selectedAudIdx,
    selectedSubIdx, aspect, onSetAspect, onToggleLandscape, onSetLocked,
    onForceShowCtrl, swipeType, swipeValue, bumpCtrl,
  } = props;

  return (
    <View style={[g.topRoot, { top: insetsTop, height: topH }]} pointerEvents="box-none">

      {/* Brightness overlay */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, { opacity: (1 - brightness) * 0.85 }]}
      />

      {/* Buffering */}
      {(buffering || !isReady) && !playerError && hasSource && (
        <View style={g.overlayCenter} pointerEvents="none">
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={g.bufferingTxt}>
            {isLive ? 'Buffering live stream…' : 'Buffering…'}
          </Text>
        </View>
      )}

      {/* Error */}
      {playerError && (
        <View style={g.overlayCenter}>
          <Ionicons name="alert-circle-outline" size={32} color={C.live} />
          <Text style={[g.errorTxt, { fontSize: 13 }]}>Playback Failed</Text>
          {src?.cookieExpired && (
            <Text style={[g.errorSub, { fontSize: 11, color: '#f59e0b', marginTop: 4, textAlign: 'center' }]}>
              🍪 Cookie expired — admin needs to update stream credentials
            </Text>
          )}
          <View style={[g.errorActions, { marginTop: 10 }]}>
            {sources.length > 1 && srcIdx < sources.length - 1 && (
              <TouchableOpacity onPress={() => onSwitchSource(srcIdx + 1)} style={[g.altBtn, { paddingHorizontal: 14, paddingVertical: 7 }]}>
                <Text style={[g.retryTxt, { fontSize: 12 }]}>Try Server {srcIdx + 2}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onRefresh} style={[g.retryBtn, { paddingHorizontal: 16, paddingVertical: 8 }]}>
              <Ionicons name="refresh" size={14} color="#fff" />
              <Text style={[g.retryTxt, { fontSize: 12 }]}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onShowDebug} style={[g.altBtn, { paddingHorizontal: 14, paddingVertical: 7 }]}>
              <Text style={[g.retryTxt, { fontSize: 12 }]}>Debug</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Swipe-down hint — pill handle at bottom edge (YouTube-style) */}
      {!pipActive && !playerError && (
        <View style={g.swipeHandle} pointerEvents="none">
          <View style={g.swipeHandlePill} />
        </View>
      )}

      {/* Gesture layer — disabled on error so Debug/Retry buttons are tappable */}
      {!pipActive && !playerError && (
        <GestureDetector gesture={fsGesture}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      )}

      {/* Full controls overlay */}
      {showCtrl && !pipActive && !playerError && (
        <Animated.View style={[StyleSheet.absoluteFill, ctrlStyle]} pointerEvents="box-none">
          {/* Gradient — transparent at top, very subtle dark only at bottom for controls readability */}
          <LinearGradient
            colors={['transparent', 'transparent', 'transparent', 'rgba(0,0,0,0.30)']}
            locations={[0, 0.55, 0.78, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Top bar */}
          {!isLocked && (
            <View style={[g.topBar, { paddingTop: 10 }]}>
              <TouchableOpacity style={g.iconBtn} onPress={onGoBack}>
                <Ionicons name="arrow-back" size={22} color="#fff" />
              </TouchableOpacity>
              <View style={{ flex: 1, marginHorizontal: 8 }}>
                <Text style={g.titleTxt} numberOfLines={1}>{title}</Text>
                {streamFormat !== 'UNKNOWN' && (
                  <Text style={g.formatBadge}>{streamFormat}</Text>
                )}
              </View>
              <View style={g.topRight}>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity style={g.iconBtn} onPress={onTogglePip}>
                    <MaterialIcons name="picture-in-picture-alt" size={20} color={pip ? C.primary : '#fff'} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity style={g.iconBtn} onPress={onRefresh}>
                  <Ionicons name="refresh-outline" size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Server pills */}
          {!isLocked && sources.length > 1 && (
            <View style={g.pillRow}>
              {sources.map((s, i) => (
                <TouchableOpacity
                  key={i}
                  onPress={() => onSwitchSource(i)}
                  style={[g.pill, i === srcIdx && g.pillActive]}
                >
                  <Text style={[g.pillTxt, i === srcIdx && g.pillActiveTxt]}>
                    {i === srcIdx ? '● ' : ''}{s.label || `Server ${i + 1}`}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* LIVE badge */}
          {isLive && !isLocked && (
            <View style={g.liveRow}>
              <View style={g.liveBadge}>
                <View style={g.liveDot} />
                <Text style={g.liveTxt}>LIVE</Text>
              </View>
              {isReady && !buffering && (
                <View style={g.livePing}>
                  <Ionicons name="wifi" size={11} color={C.green} />
                  <Text style={g.livePingTxt}>
                    {selectedVidIdx >= 0 && videoTracks[selectedVidIdx]?.height
                      ? `${videoTracks[selectedVidIdx].height}p`
                      : 'HD'}
                  </Text>
                </View>
              )}
            </View>
          )}

          {/* Center controls */}
          {!isLocked && (
            <View style={g.centerPanel} pointerEvents="box-none">
              <View style={g.glassRow}>
                <TouchableOpacity onPress={() => { onSeek(-10); onSeekSide({ side: 'left', secs: 10 }); }} style={g.ctrlBtn}>
                  <Ionicons name="play-back" size={22} color="#fff" />
                  <Text style={g.seekLabel}>10s</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onSetPlaying(!isPlaying); bumpCtrl(); }} style={g.playBtn}>
                  {buffering && isReady
                    ? <ActivityIndicator size="small" color="#fff" />
                    : <Ionicons name={isPlaying ? 'pause' : 'play'} size={30} color="#fff" style={isPlaying ? {} : { marginLeft: 3 }} />
                  }
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onSeek(10); onSeekSide({ side: 'right', secs: 10 }); }} style={g.ctrlBtn}>
                  <Ionicons name="play-forward" size={22} color="#fff" />
                  <Text style={g.seekLabel}>10s</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Bottom tool row */}
          {!isLocked && (
            <View style={[g.bottomBar, { paddingBottom: 10 }]}>
              {!isLive && duration > 0 && (
                <SeekBar
                  progressSV={progressSV}
                  currentTime={currentTime}
                  duration={duration}
                  trackWidthRef={trackWidthRef}
                  onSeekFrac={onSeekFrac}
                />
              )}
              <View style={g.toolRow}>
                <TouchableOpacity onPress={() => { onOpenSheet('speed'); bumpCtrl(); }} style={g.toolBtn}>
                  <Text style={g.speedTxt}>{speed}×</Text>
                </TouchableOpacity>
                {Platform.OS !== 'web' && (
                  <TouchableOpacity onPress={() => { onOpenSheet('quality'); bumpCtrl(); }} style={g.toolBtn}>
                    <MaterialIcons name="hd" size={22} color={selectedVidIdx !== -1 ? C.primary : '#fff'} />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { onOpenSheet('audio'); bumpCtrl(); }} style={g.toolBtn}>
                  <Ionicons name="musical-note-outline" size={20} color={selectedAudIdx !== -1 ? C.primary : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onOpenSheet('subtitle'); bumpCtrl(); }} style={g.toolBtn}>
                  <MaterialCommunityIcons name="subtitles-outline" size={20} color={selectedSubIdx !== -1 ? C.primary : '#fff'} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onSetAspect(ASPECT_CYCLE[(ASPECT_CYCLE.indexOf(aspect) + 1) % ASPECT_CYCLE.length]); bumpCtrl(); }} style={g.toolBtn}>
                  <MaterialIcons name="aspect-ratio" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={onToggleLandscape} style={g.toolBtn} hitSlop={8}>
                  <MaterialIcons name="screen-rotation" size={20} color="#fff" />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { onSetLocked(!isLocked); bumpCtrl(); }} style={g.toolBtn}>
                  <Ionicons name={isLocked ? 'lock-closed' : 'lock-open-outline'} size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      )}

      {/* Lock badge — OUTSIDE showCtrl so it stays visible after auto-hide */}
      {isLocked && !pipActive && !playerError && (
        <TouchableOpacity
          onPress={() => { onSetLocked(false); onForceShowCtrl(); }}
          style={g.lockBadge}
        >
          <Ionicons name="lock-closed" size={18} color="#fff" />
          <Text style={g.lockTxt}>Tap to unlock</Text>
        </TouchableOpacity>
      )}

      {/* Seek feedback + swipe indicator */}
      {!pipActive && seekSide && (
        <SeekFeedback
          key={seekSide.side + Date.now()}
          side={seekSide.side}
          seconds={seekSide.secs}
          onDone={() => onSeekSide(null)}
        />
      )}
      {!pipActive && swipeType && <SwipeIndicator type={swipeType} value={swipeValue} />}
    </View>
  );
}
