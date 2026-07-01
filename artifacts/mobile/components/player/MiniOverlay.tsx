import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated from 'react-native-reanimated';
import { GestureDetector, type GestureType } from 'react-native-gesture-handler';
import { g } from './playerStyles';

/**
 * MINI MODE OVERLAY — gesture + controls + title bar.
 * Tracks the miniAnimStyle shared value driven by the parent's pan gesture.
 * The video area here is transparent — the actual video surface renders
 * behind it as a sibling Animated.View (owned by GlobalVideoPlayer so it
 * never unmounts across mode transitions).
 */
export interface MiniOverlayProps {
  panGesture: GestureType;
  miniAnimStyle: any;
  isLive: boolean;
  title: string;
  isPlaying: boolean;
  showCtrl: boolean;
  onToggleCtrl: () => void;
  onSetPlaying: (playing: boolean) => void;
  onExpand: () => void;
  onClose: () => void;
}

export function MiniOverlay({
  panGesture, miniAnimStyle, isLive, title, isPlaying, showCtrl,
  onToggleCtrl, onSetPlaying, onExpand, onClose,
}: MiniOverlayProps) {
  return (
    <GestureDetector gesture={panGesture}>
      <Animated.View style={[g.miniRoot, miniAnimStyle]}>

        {/* Transparent video area (actual video is the sibling behind) */}
        <View style={[g.miniVideo, { backgroundColor: 'transparent' }]}>
          {/* LIVE badge */}
          {isLive && (
            <View style={g.miniLive} pointerEvents="none">
              <View style={g.miniLiveDot} />
              <Text style={g.miniLiveTxt}>LIVE</Text>
            </View>
          )}

          {/* Tap area — show controls, then auto-hide after 1.5 s */}
          <TouchableOpacity
            activeOpacity={1}
            style={StyleSheet.absoluteFill}
            onPress={onToggleCtrl}
          >
            {showCtrl && (
              <View style={g.miniOverlay}>
                {/* Close × */}
                <TouchableOpacity
                  style={g.miniClose}
                  onPress={onClose}
                  hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                >
                  <Ionicons name="close" size={12} color="#fff" />
                </TouchableOpacity>

                {/* Center: play/pause + expand */}
                <View style={g.miniCenter}>
                  <TouchableOpacity
                    style={g.miniBtn}
                    onPress={() => onSetPlaying(!isPlaying)}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name={isPlaying ? 'pause' : 'play'} size={20} color="#fff" />
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={g.miniBtn}
                    onPress={onExpand}
                    hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                  >
                    <Ionicons name="expand-outline" size={18} color="#fff" />
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </TouchableOpacity>
        </View>

        {/* Title bar */}
        <View style={g.miniTitle}>
          <Text style={g.miniTitleTxt} numberOfLines={1}>{title}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <TouchableOpacity
              onPress={() => onSetPlaying(!isPlaying)}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Ionicons
                name={isPlaying ? 'pause' : 'play'}
                size={14}
                color="rgba(255,255,255,0.78)"
              />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={onClose}
              hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
            >
              <Ionicons name="close" size={16} color="rgba(255,255,255,0.78)" />
            </TouchableOpacity>
          </View>
        </View>

      </Animated.View>
    </GestureDetector>
  );
}
