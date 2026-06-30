import React, { useRef, useMemo, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import BottomSheet, { BottomSheetView, BottomSheetBackdrop } from '@gorhom/bottom-sheet';
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
  const sheetRef = useRef<BottomSheet>(null);
  const snapPoints = useMemo(() => ['45%'], []);

  useEffect(() => {
    if (sheet !== 'none') sheetRef.current?.expand();
    else sheetRef.current?.close();
  }, [sheet]);

  let items: { label: string; value: any; isActive: boolean }[] = [];
  let title = '';

  if (sheet === 'speed') {
    title = 'Playback Speed';
    items = SPEED_OPTS.map(s => ({ label: s === 1 ? 'Normal' : `${s}×`, value: s, isActive: s === speed }));
  } else if (sheet === 'quality' && videoTracks.length > 0) {
    title = 'Video Quality';
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
    items = [{ label: 'Auto', value: -1, isActive: selectedVidIdx === -1 }, ...unique];
  } else if (sheet === 'audio') {
    title = 'Audio Track';
    items = audioTracks.length
      ? audioTracks.map((t: any, i: number) => ({ label: t.language || t.title || `Track ${i + 1}`, value: i, isActive: i === selectedAudIdx }))
      : [{ label: 'Default', value: -1, isActive: true }];
  } else if (sheet === 'subtitle') {
    title = 'Subtitles';
    items = [
      { label: 'Off', value: -1, isActive: selectedSubIdx === -1 },
      ...textTracks.map((t: any, i: number) => ({ label: t.language || t.title || `Track ${i + 1}`, value: i, isActive: i === selectedSubIdx })),
    ];
  }

  return (
    <BottomSheet
      ref={sheetRef}
      index={-1}
      snapPoints={snapPoints}
      enablePanDownToClose
      onClose={onClose}
      backdropComponent={(props: any) => (
        <BottomSheetBackdrop
          {...props}
          appearsOnIndex={0}
          disappearsOnIndex={-1}
          pressBehavior="close"
        />
      )}
      backgroundStyle={{ backgroundColor: '#111827' }}
      handleIndicatorStyle={{ backgroundColor: 'rgba(255,255,255,0.25)', width: 40 }}
      style={{ zIndex: 10001, elevation: 62 }}
    >
      <BottomSheetView style={ss.sheetView}>
        {sheet !== 'none' && (
          <>
            <Text style={ss.title}>{title}</Text>
            {items.map((item, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => { onSelect(sheet, item.value); onClose(); }}
                style={ss.row}
              >
                <Text style={[ss.rowTxt, item.isActive && ss.rowActive]}>{item.label}</Text>
                {item.isActive && <Ionicons name="checkmark-circle" size={20} color={C.primary} />}
              </TouchableOpacity>
            ))}
          </>
        )}
        <View style={{ height: 32 }} />
      </BottomSheetView>
    </BottomSheet>
  );
}

const ss = StyleSheet.create({
  sheetView: { paddingHorizontal: 20, paddingTop: 4 },
  title: { color: '#fff', fontSize: 16, fontWeight: '700', marginBottom: 10 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.06)' },
  rowTxt: { color: '#d1d5db', fontSize: 15 },
  rowActive: { color: C.primary, fontWeight: '700' },
});
