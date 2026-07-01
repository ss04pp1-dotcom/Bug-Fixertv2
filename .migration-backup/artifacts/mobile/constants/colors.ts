import { Colors } from './theme';

const light = {
  background: Colors.background,
  surface: Colors.surface,
  surfaceLight: Colors.surfaceLight,
  foreground: Colors.foreground,
  textSecondary: Colors.textSecondary,
  textMuted: Colors.textMuted,
  primary: Colors.primary,
  primaryBlue: Colors.primaryBlue,
  accent: Colors.accent,
  success: Colors.success,
  error: Colors.error,
  warning: Colors.warning,
  starYellow: Colors.starYellow,
  border: Colors.border,
  live: Colors.live,
  gradientStart: Colors.gradientStart,
  gradientEnd: Colors.gradientEnd,
};

// M-020: dark palette. The existing theme constants are already dark-leaning
// (near-black backgrounds, light foreground), but `useColors` switches palettes
// based on the device color scheme — without a `dark` key it would silently
// fall back to `light` even when the user is in dark mode. Export a proper
// dark palette so the hook's `'dark' in colors` branch takes effect.
const dark = {
  background: '#0A0A0F',
  surface: '#13131C',
  surfaceLight: '#1C1C2A',
  foreground: '#FFFFFF',
  textSecondary: '#A1A1AA',
  textMuted: '#6B6B80',
  primary: Colors.primary,
  primaryBlue: Colors.primaryBlue,
  accent: Colors.accent,
  success: Colors.success,
  error: Colors.error,
  warning: Colors.warning,
  starYellow: Colors.starYellow,
  border: 'rgba(255, 255, 255, 0.06)',
  live: Colors.live,
  gradientStart: Colors.gradientStart,
  gradientEnd: Colors.gradientEnd,
};

const colors = {
  light,
  dark,
  radius: 12,
};

export default colors;
