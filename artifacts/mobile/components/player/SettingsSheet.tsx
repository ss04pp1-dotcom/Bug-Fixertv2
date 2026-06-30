import React, { useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, Modal,
  ScrollView, Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { C } from './constants';

export const SPEED_OPTS = [0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];
export const ASPECT_CYCLE = ['contain', 'cover', 'stretch'] as const;
export type AspectMode = typeof ASPECT_CYCLE[number];
export type SheetType = 'none' | 'speed' | 'quality' | 'audio' | 'subtitle';

interface SettingsSheetProps {
  sheet: SheetType;
  onClose: () => void;
  onSelect: (type: SheetType, value: any) => void;
  speed: number;
  videoTracks: any[];
  audioTracks: any[];
  textTracks: any[];
  selectedVidIdx: number;
  selectedAudIdx: number;
  selectedSubIdx: number;
}

export function SettingsSheet({
  sheet, onClose, onSelect, speed,
  videoTracks, audioTracks, textTracks,
  selectedVidIdx, selectedAudIdx, selectedSubIdx,
}: SettingsSheetProps) {
  const items: { label: string; value: any; isActive: boolean }[] = useMemo(() => {
    if (sheet === 'speed') {
      return SPEED_OPTS.map(s => ({ label: s === 1 ? 'Normal' : `${s}×`, value: s, isActive: s === speed }));
    }
    if (sheet === 'quality' && videoTracks.length > 0) {
      const seen = new Map<number, { idx: number; bitrate: number }>();
      videoTracks.forEach((t: any, i: number) => {
        const h = t.height || 0; const br = t.bitrate || 0;
        if (h > 0) {
          const ex = seen.get(h);
          if (!ex || br > ex.bitrate) seen.set(h, { idx: i, bitrate: br });
        }
      });
      const unique = Array.from(seen.entries()).sort((a, b) => b[0] - a[0])
        .map(([h, { idx, bitrate }]) => ({
          label: `${h}p${bitrate > 0 ? ` · ${Math.round(bitrate / 1000)}kbps` : ''}`,
          value: idx, isActive: idx === selectedVidIdx,
        }));
      return [{ label: 'Auto', value: -1, isActive: selectedVidIdx === -1 }, ...unique];
    }
    if (sheet === 'audio') {
      return audioTracks.length
        ? audioTracks.map((t: any, i: number) => ({ label: t.language || t.title || `Track ${i + 1}`, value: i, isActive: i === selectedAudIdx }))
        : [{ label: 'Default', value: -1, isActive: true }];
    }
    if (sheet === 'subtitle') {
      return [
        { label: 'Off', value: -1, isActive: selectedSubIdx === -1 },
        ...textTracks.map((t: any, i: number) => ({ label: t.language || t.title || `Track ${i + 1}`, value: i, isActive: i === selectedSubIdx })),
      ];
    }
    return [];
  }, [sheet, speed, videoTracks, audioTracks, textTracks, selectedVidIdx, selectedAudIdx, selectedSubIdx]);

  const title = useMemo(() => {
    if (sheet === 'speed') return 'Playback Speed';
    if (sheet === 'quality') return 'Video Quality';
    if (sheet === 'audio') return 'Audio Track';
    if (sheet === 'subtitle') return 'Subtitles';
    return '';
  }, [sheet]);

  return (
    <Modal
      visible={sheet !== 'none'}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      supportedOrientations={['portrait', 'landscape', 'landscape-left', 'landscape-right']}
      statusBarTranslucent
    >
      <TouchableOpacity style={ss.backdrop} activeOpacity={1} onPress={onClose}>
        <TouchableOpacity activeOpacity={1} style={ss.sheet} onPress={() => {}}>
          <View style={ss.handle} />
          <Text style={ss.title}>{title}</Text>
          <ScrollView
            style={ss.scroll}
            showsVerticalScrollIndicator={false}
            bounces={false}
          >
            {items.map((item, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { onSelect(sheet, item.value); onClose(); }}
                style={ss.row}
                activeOpacity={0.7}
              >
                <Text style={[ss.rowTxt, item.isActive && ss.rowActive]}>{item.label}</Text>
                {item.isActive && <Ionicons name="checkmark-circle" size={20} color={C.primary} />}
              </TouchableOpacity>
            ))}
            <View style={{ height: 32 }} />
          </ScrollView>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const ss = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0,0,0,0.55)',
  },
  sheet: {
    backgroundColor: '#111827',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 12,
    maxHeight: '70%',
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: 14,
  },
  scroll: { flexGrow: 0 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)',
  },
  rowTxt: { color: '#d1d5db', fontSize: 15 },
  rowActive: { color: C.primary, fontWeight: '700' },
});
