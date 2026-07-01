export const Colors = {
  background: '#05070F',
  surface: '#121A2F',
  surfaceLight: '#1C1C2A',
  foreground: '#F2F2F7',
  textSecondary: '#B3B8C8',
  textMuted: '#6B6B80',
  primary: '#7C3AED',
  primaryBlue: '#2563EB',
  accent: '#EC4899',
  success: '#10B981',
  error: '#EF4444',
  warning: '#F59E0B',
  starYellow: '#F5C518',
  border: 'rgba(255, 255, 255, 0.07)' as const,
  live: '#EF4444',
  gradientStart: '#7C3AED',
  gradientEnd: '#2563EB',
};

export const Spacing = {
  screenPadding: 24,
  cardRadius: 24,
  buttonRadius: 18,
  smallRadius: 14,
  bottomNavHeight: 80,
};

export const Typography = {
  fontFamily: {
    sans: 'Inter',
    brand: 'Outfit',
    mono: 'SpaceMono',
  },
} as const;