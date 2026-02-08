/**
 * Color System - Supercell / Brawl Stars inspired palette
 */

export const colors = {
  light: {
    radius: '0.625rem',
    background: '#0066cc',
    foreground: '#ffffff',
    primary: '#0059C8',
    primaryForeground: '#ffffff',
    secondary: '#4488ff',
    secondaryForeground: '#ffffff',
    muted: '#0055aa',
    mutedForeground: 'rgba(255, 255, 255, 0.6)',
    accent: '#ff9900',
    accentForeground: '#000000',
    destructive: '#ff3333',
    destructiveForeground: '#ffffff',
    border: '#000000',
    input: 'rgba(0, 0, 0, 0.3)',
    ring: '#0059C8',
    sidebar: '#004499',
    sidebarForeground: '#ffffff',
    sidebarPrimary: '#0059C8',
    sidebarPrimaryForeground: '#ffffff',
    sidebarAccent: '#0055aa',
    sidebarAccentForeground: '#ffffff',
    sidebarBorder: '#000000',
    sidebarRing: '#0059C8',
  },
  dark: {
    radius: '0.625rem',
    background: '#0066cc',
    foreground: '#ffffff',
    primary: '#0059C8',
    primaryForeground: '#ffffff',
    secondary: '#4488ff',
    secondaryForeground: '#ffffff',
    muted: '#0055aa',
    mutedForeground: 'rgba(255, 255, 255, 0.6)',
    accent: '#ff9900',
    accentForeground: '#000000',
    destructive: '#ff3333',
    destructiveForeground: '#ffffff',
    border: '#000000',
    input: 'rgba(0, 0, 0, 0.3)',
    ring: '#0059C8',
    sidebar: '#004499',
    sidebarForeground: '#ffffff',
    sidebarPrimary: '#0059C8',
    sidebarPrimaryForeground: '#ffffff',
    sidebarAccent: '#0055aa',
    sidebarAccentForeground: '#ffffff',
    sidebarBorder: '#000000',
    sidebarRing: '#0059C8',
  },
} as const;

/** Supercell / Brawl Stars accent colors */
export const scColors = {
  blue: {
    light: '#4488ff',
    base: '#0066cc',
    dark: '#0044bb',
  },
  yellow: {
    light: '#3380D8',
    base: '#0059C8',
    dark: '#003E8C',
  },
  orange: {
    light: '#ffbb33',
    base: '#ff9900',
    dark: '#cc7700',
  },
  purple: {
    light: '#bb66ff',
    base: '#9933ff',
    dark: '#6622cc',
  },
  pink: {
    light: '#ff77cc',
    base: '#ff44aa',
    dark: '#aa2277',
  },
  green: {
    light: '#44ee88',
    base: '#22dd55',
    dark: '#11aa44',
  },
  red: {
    light: '#ff5252',
    base: '#d32f2f',
    dark: '#8b0000',
  },
  border: '#000000',
  white: '#ffffff',
  surface: '#ffcc00',
  black: '#000000',
} as const;

/** @deprecated Use scColors instead */
export const doryColors = {
  cyan: {
    50: '#ecfeff',
    100: '#cffafe',
    200: '#a5f3fc',
    300: '#67e8f9',
    400: '#22d3ee',
    500: '#06b6d4',
    600: '#0891b2',
    700: '#0e7490',
    800: '#155e75',
    900: '#164e63',
  },
  purple: {
    50: '#faf5ff',
    100: '#f3e8ff',
    200: '#e9d5ff',
    300: '#d8b4fe',
    400: '#c084fc',
    500: '#a855f7',
    600: '#9333ea',
    700: '#7e22ce',
    800: '#6b21a8',
    900: '#581c87',
  },
} as const;

export const currentColors = colors.dark;
export type ColorPalette = typeof colors.light;
export type ColorMode = 'light' | 'dark';
