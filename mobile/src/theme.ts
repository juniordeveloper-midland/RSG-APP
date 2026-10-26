/**
 * Region Security Guarding (RSG) Mobile Theme Tokens
 * Mandated strictly by AGENTS.md:
 * - Primary: #eb0505
 * - Background: #333333
 * - Surface/cards: #3d3d3d
 * - Border: #4a4a4a
 * - Text: #ffffff, muted text: #bdbdbd
 * - White text on red buttons. Never hardcode hex values elsewhere!
 */

export const theme = {
  colors: {
    // Brand Core
    primary: '#eb0505',
    primaryHover: '#ff2222',
    primaryActive: '#c80404',
    primaryMuted: 'rgba(235, 5, 5, 0.15)',
    primaryBorder: 'rgba(235, 5, 5, 0.45)',

    // Surfaces & Backgrounds
    background: '#333333',
    backgroundDarker: '#262626',
    surface: '#3d3d3d',
    surfaceHover: '#484848',
    surfaceTranslucent: 'rgba(61, 61, 61, 0.92)',

    // Borders & Dividers
    border: '#4a4a4a',
    borderLight: '#585858',

    // Text & Content
    text: '#ffffff',
    textMuted: '#bdbdbd',
    textDim: '#888888',
    textOnPrimary: '#ffffff',

    // Functional & Status Indicators
    success: '#10b981',
    successBg: 'rgba(16, 185, 129, 0.15)',
    warning: '#f59e0b',
    warningBg: 'rgba(245, 158, 11, 0.15)',
    danger: '#ef4444',
    dangerBg: 'rgba(239, 68, 68, 0.15)',
    info: '#3b82f6',
    infoBg: 'rgba(59, 130, 246, 0.15)',
  },

  spacing: {
    xs: 4,
    sm: 8,
    md: 12,
    base: 16,
    lg: 20,
    xl: 24,
    xxl: 32,
    giant: 48,
  },

  borderRadius: {
    sm: 6,
    md: 10,
    lg: 16,
    xl: 24,
    full: 9999,
  },

  typography: {
    fontSizes: {
      xs: 11,
      sm: 13,
      base: 15,
      md: 17,
      lg: 20,
      xl: 24,
      xxl: 30,
      hero: 38,
    },
    lineHeights: {
      tight: 1.2,
      normal: 1.4,
      relaxed: 1.6,
    },
  },

  touchTargets: {
    minHeight: 48,
    buttonLg: 56,
    clockButton: 72,
  },
} as const;

export type Theme = typeof theme;
