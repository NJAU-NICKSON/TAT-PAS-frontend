
export const COLORS = {
  clinical: {
    50: '#E9F8EF',
    100: '#C8EED6',
    200: '#A7E4BD',
    400: '#4FBF74',
    600: '#178A3D',
    700: '#0F6E2F',
    900: '#0A4A20',
  },
  surface: {
    0: '#FFFFFF',
    1: '#F8FAFC',
    2: '#F1F5F9',
    3: '#E2E8F0',
  },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    muted: '#94A3B8',
    inverse: '#FFFFFF',
  },
  status: {
    critical: {
      bg: '#FEF2F2',
      border: '#FECACA',
      text: '#991B1B',
      icon: '#EF4444',
    },
    warning: {
      bg: '#FFFBEB',
      border: '#FDE68A',
      text: '#92400E',
      icon: '#F59E0B',
    },
    success: {
      bg: '#F0FDF4',
      border: '#BBF7D0',
      text: '#166534',
      icon: '#22C55E',
    },
    info: {
      bg: '#EFF6FF',
      border: '#BFDBFE',
      text: '#1E40AF',
      icon: '#3B82F6',
    },
    neutral: {
      bg: '#F8FAFC',
      border: '#E2E8F0',
      text: '#475569',
      icon: '#94A3B8',
    },
    flagged: {
      bg: '#FAF5FF',
      border: '#E9D5FF',
      text: '#6B21A8',
      icon: '#A855F7',
    },
  },
  priority: {
    stat: '#DC2626',
    urgent: '#EA580C',
    routine: '#2563EB',
    discharge: '#7C3AED',
    nicu: '#DB2777',
  },
  tat: {
    onTime: '#16A34A',
    warning: '#D97706',
    breached: '#DC2626',
  },
} as const;

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  '2xl': 32,
  '3xl': 48,
} as const;

export const BORDER_RADIUS = {
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  full: 9999,
} as const;

export const SHADOWS = {
  card: '0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04)',
  elevated: '0 4px 6px rgba(0,0,0,0.05), 0 2px 4px rgba(0,0,0,0.04)',
  modal: '0 20px 25px rgba(0,0,0,0.08), 0 8px 10px rgba(0,0,0,0.04)',
} as const;

export const TYPOGRAPHY = {
  display: {
    fontSize: 36,
    fontWeight: 900,
    letterSpacing: '-0.025em',
    lineHeight: 1.1,
  },
  h1: {
    fontSize: 24,
    fontWeight: 700,
    letterSpacing: '-0.02em',
    lineHeight: 1.2,
  },
  h2: {
    fontSize: 20,
    fontWeight: 600,
    letterSpacing: '-0.015em',
    lineHeight: 1.3,
  },
  h3: {
    fontSize: 16,
    fontWeight: 600,
    letterSpacing: '-0.01em',
    lineHeight: 1.4,
  },
  bodyLg: {
    fontSize: 15,
    fontWeight: 400,
    lineHeight: 1.5,
  },
  body: {
    fontSize: 14,
    fontWeight: 400,
    lineHeight: 1.5,
  },
  bodySm: {
    fontSize: 13,
    fontWeight: 400,
    lineHeight: 1.5,
  },
  caption: {
    fontSize: 12,
    fontWeight: 400,
    letterSpacing: '0.01em',
    lineHeight: 1.4,
  },
  mono: {
    fontSize: 13,
    fontWeight: 400,
    fontFamily: 'JetBrains Mono, Courier New, monospace',
  },
} as const;

export const ICON_SIZES = {
  badge: 16,
  button: 16,
  navigation: 20,
  heading: 24,
  large: 48,
} as const;

