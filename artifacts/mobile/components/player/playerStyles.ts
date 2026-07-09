import { StyleSheet } from 'react-native';
import { C } from './constants';

// ─── Mini layout constants ────────────────────────────────────────────────────
export const MINI_W = 220;
export const MINI_H = 124;        // 16:9
export const MINI_TITLE_H = 36;
export const MINI_MARGIN = 12;
// Tab bar base height (without bottom safe-area inset — that is subtracted separately)
export const TAB_BAR_BASE_H = 60;

// ════════════════════════════════════════════════════════════════════════════
// STYLES
// ════════════════════════════════════════════════════════════════════════════
export const g = StyleSheet.create({
  // Root wrapper — absoluteFill so all absolute children position correctly
  // on React Native new architecture (Fabric). Using a Fragment caused
  // translateY from the mini-player's shared values to leak into top mode.
  playerRoot: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 9997,
    elevation: 49,
  },
  // Fullscreen
  fullRoot: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'transparent', zIndex: 9999, elevation: 50,
  },
  overlayCenter: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center', gap: 10,
    backgroundColor: 'transparent',
  },
  bufferingTxt: { color: C.dim, fontSize: 13, marginTop: 6, textAlign: 'center' },
  errorTxt:  { color: '#fff', fontSize: 16, fontWeight: '700', marginTop: 8, textAlign: 'center' },
  errorSub:  { color: C.dim, fontSize: 12, textAlign: 'center', lineHeight: 18, paddingHorizontal: 24 },
  errorActions: { flexDirection: 'row', gap: 10, marginTop: 14 },
  retryBtn:  { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 22, paddingVertical: 10, backgroundColor: C.primary, borderRadius: 22 },
  retryTxt:  { color: '#fff', fontWeight: '700', fontSize: 14 },
  altBtn:    { paddingHorizontal: 18, paddingVertical: 10, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 22, borderWidth: 1, borderColor: C.border },
  altBtnTxt: { color: '#fff', fontSize: 14 },

  topBar:    { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 10, paddingBottom: 6, gap: 8 },
  iconBtn:   { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: C.border },
  titleTxt:  { color: '#fff', fontSize: 14, fontWeight: '600' },
  formatBadge: { color: C.dim, fontSize: 10, marginTop: 1 },
  topRight:  { flexDirection: 'row', gap: 8 },

  pillRow:       { flexDirection: 'row', gap: 6, paddingHorizontal: 14, marginTop: 2 },
  pill:          { paddingHorizontal: 12, paddingVertical: 5, backgroundColor: 'rgba(255,255,255,0.09)', borderRadius: 14, borderWidth: 1, borderColor: C.border },
  pillActive:    { borderColor: C.primary, backgroundColor: 'rgba(139,92,246,0.2)' },
  pillExpired:   { borderColor: 'rgba(239,68,68,0.5)', backgroundColor: 'rgba(239,68,68,0.12)' },
  pillTxt:       { color: '#ccc', fontSize: 12 },
  pillActiveTxt: { color: C.primary, fontWeight: '700' },
  pillExpiredTxt:{ color: '#f87171' },

  liveRow:    { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, marginTop: 4 },
  liveBadge:  { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: C.live, borderRadius: 5, paddingHorizontal: 8, paddingVertical: 4 },
  liveDot:    { width: 7, height: 7, borderRadius: 4, backgroundColor: '#fff' },
  liveTxt:    { color: '#fff', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  livePing:   { flexDirection: 'row', alignItems: 'center', gap: 4 },
  livePingTxt:{ color: C.green, fontSize: 10, fontWeight: '600' },

  centerPanel: { ...StyleSheet.absoluteFillObject, justifyContent: 'center', alignItems: 'center' },
  glassRow:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'transparent', borderRadius: 30, paddingHorizontal: 16, paddingVertical: 12 },
  ctrlBtn:   { alignItems: 'center', justifyContent: 'center', width: 54, height: 48, gap: 2 },
  seekLabel: { color: '#fff', fontSize: 9, fontWeight: '700', opacity: 0.8 },
  playBtn:   { width: 62, height: 62, borderRadius: 31, backgroundColor: 'rgba(255,255,255,0.2)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.5)', justifyContent: 'center', alignItems: 'center', marginHorizontal: 6 },

  bottomBar:   { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 12, paddingBottom: 14, paddingTop: 4 },
  toolRow:     { flexDirection: 'row', justifyContent: 'flex-end', alignItems: 'center', gap: 2 },
  toolBtn:     { width: 40, height: 36, justifyContent: 'center', alignItems: 'center' },
  speedTxt:    { color: '#e5e7eb', fontSize: 13, fontWeight: '700' },

  lockBadge: { position: 'absolute', alignSelf: 'center', top: '46%', flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: 'rgba(0,0,0,0.6)', borderRadius: 24, paddingHorizontal: 20, paddingVertical: 10, borderWidth: 1, borderColor: C.border },
  lockTxt:   { color: '#fff', fontSize: 13 },

  // Swipe-down pill handle (YouTube-style) — shown at bottom edge of TOP mode video
  swipeHandle: {
    position: 'absolute', bottom: 4, left: 0, right: 0,
    alignItems: 'center', paddingBottom: 2,
  },
  swipeHandlePill: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },

  // Top mode (video at top, related channels visible below)
  topRoot: {
    position: 'absolute', left: 0, right: 0,
    backgroundColor: 'transparent', zIndex: 9999, elevation: 50,
  },
  topControls: {
    position: 'absolute', top: 0, left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 8, paddingTop: 8, paddingBottom: 6,
    backgroundColor: 'rgba(0,0,0,0.45)', gap: 6,
  },
  topIconBtn: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.55)',
    justifyContent: 'center', alignItems: 'center',
  },
  topLiveBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: C.live, borderRadius: 4,
    paddingHorizontal: 7, paddingVertical: 3,
    marginLeft: 4,
  },

  // Mini
  miniRoot: {
    position: 'absolute', top: 0, left: 0,
    width: MINI_W,
    zIndex: 9999, elevation: 60,
    shadowColor: '#000', shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.65, shadowRadius: 20,
  },
  miniVideo: {
    width: MINI_W, height: MINI_H,
    backgroundColor: '#000',
    borderTopLeftRadius: 12, borderTopRightRadius: 12,
    overflow: 'hidden',
    borderWidth: 1.5, borderBottomWidth: 0,
    borderColor: 'rgba(139,92,246,0.6)',
  },
  miniBuffering: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center', alignItems: 'center',
  },
  miniLive: {
    position: 'absolute', top: 6, left: 6,
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(220,38,38,0.92)',
    borderRadius: 4, paddingHorizontal: 5, paddingVertical: 2,
  },
  miniLiveDot: { width: 5, height: 5, borderRadius: 3, backgroundColor: '#fff' },
  miniLiveTxt: { color: '#fff', fontSize: 8, fontWeight: '800' },
  miniOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.48)',
    justifyContent: 'center', alignItems: 'center',
  },
  miniClose: {
    position: 'absolute', top: 6, right: 6,
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'center', alignItems: 'center',
  },
  miniCenter: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: MINI_TITLE_H,
    flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 16,
  },
  miniBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: 'rgba(0,0,0,0.65)',
    justifyContent: 'center', alignItems: 'center',
  },
  miniTitle: {
    flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8,
    height: MINI_TITLE_H, backgroundColor: '#0D0D1F',
    borderBottomLeftRadius: 12, borderBottomRightRadius: 12,
    borderWidth: 1.5, borderTopWidth: 0,
    borderColor: 'rgba(139,92,246,0.6)',
  },
  miniTitleLogo: { width: 20, height: 20, borderRadius: 4 },
  miniTitleTxt: { flex: 1, color: '#EFEFEF', fontSize: 10.5, fontWeight: '600' },
  miniError: {
    position: 'absolute', top: 6, right: 6,
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: 'rgba(0,0,0,0.7)',
    borderRadius: 12, paddingHorizontal: 8, paddingVertical: 4,
  },
});

export const db = StyleSheet.create({
  backdrop: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    justifyContent: 'flex-end',
  },
  panel: {
    backgroundColor: '#0f1729',
    borderTopLeftRadius: 20, borderTopRightRadius: 20,
    maxHeight: '85%',
    paddingBottom: 24,
    borderTopWidth: 1, borderColor: 'rgba(139,92,246,0.3)',
  },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: 18, paddingTop: 18, paddingBottom: 12,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  headerTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
  statusBadge: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5,
  },
  statusTxt: { fontSize: 12, fontWeight: '700' },
  scrollWrap: { paddingHorizontal: 18, paddingTop: 14 },
  sectionTitle: {
    color: C.dim, fontSize: 10, fontWeight: '700',
    letterSpacing: 0.8, marginBottom: 8,
  },
  codeBox: {
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 8, padding: 10,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  codeText: { color: '#e5e7eb', fontSize: 11, lineHeight: 17 },
  metaLine: { color: C.dim, fontSize: 11, marginTop: 5, marginBottom: 2 },
  row: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 8,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  rowLabel: { color: C.dim, fontSize: 13 },
  rowVal: { color: '#e5e7eb', fontSize: 13 },
  badge: { borderRadius: 6, paddingHorizontal: 9, paddingVertical: 4 },
  badgeTxt: { fontSize: 12, fontWeight: '700' },
  emptyNote: { color: C.dim, fontSize: 12, fontStyle: 'italic', paddingVertical: 4 },
  closeBtn: {
    marginTop: 18, marginHorizontal: 18,
    backgroundColor: C.primary,
    borderRadius: 24, paddingVertical: 13,
    alignItems: 'center',
  },
  closeTxt: { color: '#fff', fontSize: 15, fontWeight: '700' },
});
