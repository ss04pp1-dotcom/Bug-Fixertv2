import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
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
  metadata?: { title: string; artist: string; imageUri?: string };
}

export const NativeIPTVPlayer = React.memo(function NativeIPTVPlayer({
  source, paused, rate, volume, resizeMode, pip, isLive, videoRef,
  selectedVideoTrack, selectedAudioTrack, selectedTextTrack,
  onLoad, onLoadStart, onReadyForDisplay, onProgress, onBuffer,
  onError, onEnd, onVideoTracks, onAudioTracks, onTextTracks, onPipChange, metadata,
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

        paused={paused}
        rate={rate}
        volume={volume}
        muted={false}
        resizeMode={resizeMode}
        controls={false}
        ignoreSilentSwitch="ignore"
        playInBackground={true}
        playWhenInactive={true}

        useTextureView={true}
        hideShutterView={true}

        bufferConfig={isLive ? BUFFER_LIVE : BUFFER_VOD}
        maxBitRate={0}
        minLoadRetryCount={5}

        reportBandwidth={(_bandwidth: number) => {}}

        pictureInPicture={pip}

        selectedVideoTrack={selectedVideoTrack}
        selectedAudioTrack={selectedAudioTrack}
        selectedTextTrack={selectedTextTrack}

        {...(metadata ? { metadata } : {})}

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
        onBandwidthUpdate={(_d: any) => {}}
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
