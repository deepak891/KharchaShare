export const COLORS = {
  background: '#F8F9FA',
  card: '#FFFFFF',
  primary: '#5B5FEF',
  primaryLight: '#EEEFFE',
  success: '#22C55E',
  danger: '#EF4444',
  text1: '#111827',
  text2: '#6B7280',
  text3: '#9CA3AF',
  border: '#F3F4F6',
} as const;

export const SHADOW = {
  card: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  elevated: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 8,
  },
} as const;

export const RADIUS = {
  sm: 12,
  md: 16,
  lg: 20,
  xl: 24,
} as const;
