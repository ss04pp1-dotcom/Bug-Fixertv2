import React from 'react';
import { View, Text, StyleSheet, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { IS_EXPO_GO, IS_WEB, C, BUFFER_LIVE, BUFFER_VOD } from './constants';

export interface NativePlayerProps {
  source: { uri: string; headers: Record<string, string>; type?: string };
  paused: boolean;
  rate: number;
  volume: number;
  resizeMode: 'contain' | 'cover' | 'stretch';
  pip: boolean;
  isLive: boolean;
  videoRef: React.MutableRefObject<any>;
  selectedVideoTrack: any;
  selectedAudioTrack: any;
  selectedTextTrack: any;
  onLoad: (d: any) => void;
  onLoadStart: () => void;
  onReadyForDisplay: () => void;
  onProgress: (d: any) => void;
  onBuffer: (b: boolean) => void;
  onError: (e: any) => void;
  onEnd: () => void;
  onVideoTracks: (t: any[]) => void;
  onAudioTracks: (t: any[]) => void;
  onTextTracks: (t: any[]) => void;
  onPipChange: (active: boolean) => void;
  onBandwidth?: (bps: number) => void;
  metadata?: { title: string; artist: string; imageUri?: string };
}

// ── Progress interval ─────────────────────────────────────────────────────
// VOD: 250 ms → smooth seek-bar scrubbing and resume-position accuracy.
// Live: 1 000 ms → no seek bar, so no need to update at 60fps; saves CPU.
const PROGRESS_INTERVAL_VOD  = 250;
const PROGRESS_INTERVAL_LIVE = 1_000;

// ── iOS AVPlayer buffer ───────────────────────────────────────────────────
// AVPlayer uses `preferredForwardBufferDuration` (seconds) instead of
// ExoPlayer's `bufferConfig`. Mirror our buffer targets for parity.
const IOS_FWD_BUFFER_LIVE = 12;  // 12 s forward buffer for live
const IOS_FWD_BUFFER_VOD  = 30;  // 30 s forward buffer for VOD

export const NativeIPTVPlayer = React.memo(function NativeIPTVPlayer({
  source, paused, rate, volume, resizeMode, pip, isLive, videoRef,
  selectedVideoTrack, selectedAudioTrack, selectedTextTrack,
  onLoad, onLoadStart, onReadyForDisplay, onProgress, onBuffer,
  onError, onEnd, onVideoTracks, onAudioTracks, onTextTracks,
  onPipChange, onBandwidth, metadata,
}: NativePlayerProps) {

  if (IS_EXPO_GO || IS_WEB) {
    return (
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center', gap: 10 }]}>
        <Ionicons name="phone-portrait-outline" size={42} color={C.primary} />
        <Text style={{ color: '#fff', fontSize: 12, textAlign: 'center' }}>
          Development Build Required{'\n'}(react-native-video needs a dev build)
        </Text>
      </View>
    );
  }

  try {
    const Video = require('react-native-video').default;

    return (
      <Video
        ref={videoRef}
        source={source}
        style={StyleSheet.absoluteFill}

        // ── Playback ──────────────────────────────────────────────────────
        paused={paused}
        rate={rate}
        volume={volume}
        muted={false}
        resizeMode={resizeMode}
        controls={false}
        ignoreSilentSwitch="ignore"
        playInBackground={true}
        playWhenInactive={true}
        preventsDisplaySleepDuringVideoPlayback={true}

        // ── Rendering ─────────────────────────────────────────────────────
        // useTextureView: Android-only. TextureView supports transformation
        // animations (scale, translate) that SurfaceView cannot. Required
        // for our mini-player animated position changes to work correctly.
        useTextureView={true}
        // hideShutterView: hides the ExoPlayer "black frame" that flashes
        // for ~1 frame when the surface is first created. Makes channel
        // switches look seamless (poster cross-fades directly to video).
        hideShutterView={true}

        // ── Buffer (Android / ExoPlayer Media3) ──────────────────────────
        bufferConfig={isLive ? BUFFER_LIVE : BUFFER_VOD}

        // ── Buffer (iOS / AVPlayer) ───────────────────────────────────────
        // preferredForwardBufferDuration: how many seconds AVPlayer tries
        // to keep buffered ahead. Lower = faster channel start; higher =
        // smoother under bad network. Mirror our ExoPlayer targets.
        preferredForwardBufferDuration={isLive ? IOS_FWD_BUFFER_LIVE : IOS_FWD_BUFFER_VOD}

        // automaticallyWaitsToMinimizeStalling (iOS only):
        // When false AVPlayer starts immediately with whatever is buffered
        // instead of waiting for its own internal "enough data" heuristic.
        // Combined with preferredForwardBufferDuration this gives us the
        // same sub-1 s start feel as ExoPlayer.
        automaticallyWaitsToMinimizeStalling={false}

        // ── Quality / ABR ─────────────────────────────────────────────────
        // maxBitRate=0 means no cap — let the ABR algorithm pick the
        // highest sustainable quality. ExoPlayer measures real bandwidth
        // and ramps up automatically after the first few seconds.
        maxBitRate={0}
        minLoadRetryCount={8}

        // ── External playback (iOS AirPlay) ──────────────────────────────
        allowsExternalPlayback={Platform.OS === 'ios'}

        // ── Progress ──────────────────────────────────────────────────────
        progressUpdateInterval={isLive ? PROGRESS_INTERVAL_LIVE : PROGRESS_INTERVAL_VOD}

        // ── PiP ───────────────────────────────────────────────────────────
        pictureInPicture={pip}

        // ── Track selection ───────────────────────────────────────────────
        selectedVideoTrack={selectedVideoTrack}
        selectedAudioTrack={selectedAudioTrack}
        selectedTextTrack={selectedTextTrack}

        // ── Lock‐screen / Now Playing metadata ────────────────────────────
        {...(metadata ? { metadata } : {})}

        // ── Callbacks ─────────────────────────────────────────────────────
        onLoadStart={onLoadStart}
        onLoad={onLoad}
        onReadyForDisplay={onReadyForDisplay}
        onProgress={onProgress}
        onBuffer={(d: any) => onBuffer(d?.isBuffering ?? false)}
        onError={onError}
        onEnd={onEnd}

        onVideoTracks={(data: any) => {
          const tracks = Array.isArray(data) ? data : data?.videoTracks ?? [];
          if (tracks.length) onVideoTracks(tracks);
        }}
        onAudioTracks={(data: any) => {
          const tracks = Array.isArray(data) ? data : data?.audioTracks ?? [];
          if (tracks.length) onAudioTracks(tracks);
        }}
        onTextTracks={(data: any) => {
          const tracks = Array.isArray(data) ? data : data?.textTracks ?? [];
          if (tracks.length) onTextTracks(tracks);
        }}

        // Bandwidth updates — forwarded to parent so it can adapt quality
        // or display debug info. Runs on JS thread at most once per second.
        onBandwidthUpdate={(d: any) => {
          if (onBandwidth && typeof d?.bitrate === 'number') {
            onBandwidth(d.bitrate);
          }
        }}

        onPictureInPictureStatusChanged={(d: any) => onPipChange(d?.isActive ?? false)}
      />
    );
  } catch (e: any) {
    return (
      <View style={[StyleSheet.absoluteFill, { justifyContent: 'center', alignItems: 'center' }]}>
        <Ionicons name="alert-circle-outline" size={42} color={C.accent} />
        <Text style={{ color: '#fff', marginTop: 6, fontSize: 11, textAlign: 'center' }}>
          Player load failed{'\n'}{e?.message}
        </Text>
      </View>
    );
  }
});
