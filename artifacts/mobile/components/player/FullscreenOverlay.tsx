import React from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Platform, StatusBar, ActivityIndicator,
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
 * FULLSCREEN MODE OVERLAY — landscape controls rendered on top of the
 * always-mounted video surface (owned by the parent, never unmounts here).
 */
export interface FullscreenOverlayProps {
  insetsTop: number;
  insetsBottom: number;
  brightnessOverlayStyle: any;
  buffering: boolean;
  isReady: boolean;
  playerError: string | null;
  hasSource: boolean;
  isLive: boolean;
  isLiveNow: boolean;
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
  isLandscape: boolean;
  onToggleLandscape: () => void;
  onSetLocked: (locked: boolean) => void;
  onForceShowCtrl: () => void;
  swipeType: 'volume' | 'brightness' | null;
  swipeValue: number;
  bumpCtrl: () => void;
}

export function FullscreenOverlay(props: FullscreenOverlayProps) {
  const {
    insetsTop, insetsBottom, brightnessOverlayStyle, buffering, isReady,
    playerError, hasSource, isLive, isLiveNow, src, sources, srcIdx,
    onSwitchSource, onRefresh, onShowDebug, pipActive, fsGesture, showCtrl,
    ctrlStyle, isLocked, onGoBack, title, streamFormat, pip, onTogglePip,
    selectedVidIdx, videoTracks, onSeek, onSeekSide, seekSide, isPlaying,
    onSetPlaying, duration, currentTime, progressSV, trackWidthRef,
    onSeekFrac, speed, onOpenSheet, selectedAudIdx, selectedSubIdx, aspect,
    onSetAspect, isLandscape, onToggleLandscape, onSetLocked, onForceShowCtrl,
    swipeType, swipeValue, bumpCtrl,
  } = props;

  return (
    <View style={g.fullRoot} pointerEvents="box-none">
      <StatusBar hidden barStyle="light-content" backgroundColor="#000" />

      {/* Brightness overlay (animated, ZERO re-renders) */}
      <Animated.View
        pointerEvents="none"
        style={[StyleSheet.absoluteFill, { backgroundColor: '#000' }, brightnessOverlayStyle]}
      />

      {/* Buffering */}
      {!pipActive && (buffering || !isReady) && !playerError && hasSource && (
        <View style={g.overlayCenter} pointerEvents="none">
          <ActivityIndicator size="large" color={C.primary} />
          <Text style={g.bufferingTxt}>
            {isLive ? 'Buffering live stream…' : 'Buffering…'}
          </Text>
        </View>
      )}

      {/* Error */}
      {!pipActive && playerError && (
        <View style={g.overlayCenter}>
          <Ionicons name="alert-circle-outline" size={48} color={C.live} />
          <Text style={g.errorTxt}>Playback Failed</Text>
          <Text style={g.errorSub} numberOfLines={3}>{playerError}</Text>
          {src?.cookieExpired && (
            <Text style={[g.errorSub, { fontSize: 12, color: '#f59e0b', marginTop: 6, textAlign: 'center' }]}>
              🍪 Cookie expired — admin needs to update stream credentials
            </Text>
          )}
          <View style={g.errorActions}>
            {sources.length > 1 && srcIdx < sources.length - 1 && (
              <TouchableOpacity onPress={() => onSwitchSource(srcIdx + 1)} style={g.altBtn}>
                <Text style={g.altBtnTxt}>Try Server {srcIdx + 2}</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={onRefresh} style={g.retryBtn}>
              <Ionicons name="refresh" size={16} color="#fff" />
              <Text style={g.retryTxt}>Retry</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onShowDebug} style={g.altBtn}>
              <Text style={g.altBtnTxt}>Debug</Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Gesture layer — tap/double-tap/swipe for controls, brightness, volume */}
      {!pipActive && !playerError && (
        <GestureDetector gesture={fsGesture}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
      )}

      {/* Controls */}
      {showCtrl && !pipActive && !playerError && (
        <Animated.View style={[StyleSheet.absoluteFill, ctrlStyle]} pointerEvents="box-none">
          <LinearGradient
            colors={['transparent', 'transparent', 'transparent', 'rgba(0,0,0,0.35)']}
            locations={[0, 0.55, 0.78, 1]}
            style={StyleSheet.absoluteFill}
            pointerEvents="none"
          />

          {/* Top bar */}
          {!isLocked && (
            <View style={[g.topBar, { paddingTop: insetsTop + 10 }]}>
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
                {/* PiP */}
                {Platform.OS !== 'web' && (
                  <TouchableOpacity style={g.iconBtn} onPress={onTogglePip}>
                    <MaterialIcons name="picture-in-picture-alt" size={20} color={pip ? C.primary : '#fff'} />
                  </TouchableOpacity>
                )}
                {/* Refresh */}
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
                    {i === srcIdx ? '● ' : ''}{s.label || `S${i + 1}`}
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

          {/* Bottom bar */}
          {!isLocked && (
            <View style={[g.bottomBar, { paddingBottom: insetsBottom + 14 }]}>
              {!isLiveNow && (
                <SeekBar
                  progressSV={progressSV}
                  currentTime={currentTime}
                  duration={duration}
                  trackWidthRef={trackWidthRef}
                  onSeekFrac={onSeekFrac}
                />
              )}

              {/* Tool row */}
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
                {Platform.OS !== 'web' && (
                  <TouchableOpacity onPress={onToggleLandscape} style={g.toolBtn} hitSlop={8}>
                    <MaterialIcons
                      name={isLandscape ? 'stay-primary-portrait' : 'stay-primary-landscape'}
                      size={20}
                      color={isLandscape ? C.primary : '#fff'}
                    />
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => { onSetLocked(!isLocked); bumpCtrl(); }} style={g.toolBtn}>
                  <Ionicons name={isLocked ? 'lock-closed' : 'lock-open-outline'} size={20} color="#fff" />
                </TouchableOpacity>
              </View>
            </View>
          )}
        </Animated.View>
      )}

      {/* Lock badge — OUTSIDE showCtrl block so it stays visible even after
          controls auto-hide. Tapping unlocks and re-shows controls. */}
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
