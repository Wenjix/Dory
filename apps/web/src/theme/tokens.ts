/**
 * Design Tokens - Supercell / Brawl Stars game UI system
 */

import { scColors } from './colors';

// ==================== SPACING ====================
export const spacing = {
  '0': '0',
  '0.5': '0.125rem',    // 2px
  '1': '0.25rem',       // 4px
  '1.5': '0.375rem',    // 6px
  '2': '0.5rem',        // 8px
  '2.5': '0.625rem',    // 10px
  '3': '0.75rem',       // 12px
  '3.5': '0.875rem',    // 14px
  '4': '1rem',          // 16px
  '5': '1.25rem',       // 20px
  '6': '1.5rem',        // 24px
  '7': '1.75rem',       // 28px
  '8': '2rem',          // 32px
  '10': '2.5rem',       // 40px
  '12': '3rem',         // 48px
  '16': '4rem',         // 64px
  '20': '5rem',         // 80px
  '24': '6rem',         // 96px
  '28': '7rem',         // 112px
  '32': '8rem',         // 128px
} as const;

// ==================== BORDER RADIUS ====================
export const borderRadius = {
  none: '0',
  sm: '6px',
  base: '8px',
  md: '10px',
  lg: '12px',
  xl: '16px',
  '2xl': '20px',
  '3xl': '24px',
  full: '9999px',
} as const;

// ==================== FONT SIZES ====================
export const fontSize = {
  xs: '0.75rem',        // 12px
  sm: '0.875rem',       // 14px
  base: '1rem',         // 16px
  lg: '1.125rem',       // 18px
  xl: '1.25rem',        // 20px
  '2xl': '1.5rem',      // 24px
  '3xl': '1.875rem',    // 30px
  '4xl': '2.25rem',     // 36px
} as const;

// ==================== LINE HEIGHTS ====================
export const lineHeight = {
  none: '1',
  tight: '1.25',
  snug: '1.375',
  normal: '1.5',
  relaxed: '1.625',
  loose: '2',
} as const;

// ==================== FONT WEIGHTS ====================
export const fontWeight = {
  normal: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
  extrabold: '800',
} as const;

// ==================== SHADOWS (Brawl Stars solid shadows) ====================
export const boxShadow = {
  sm: '0 3px 0 rgba(0,0,0,0.3)',
  base: '0 4px 0 rgba(0,0,0,0.3)',
  md: '0 6px 0 rgba(0,0,0,0.4)',
  lg: '0 8px 0 rgba(0,0,0,0.4)',
  xl: '0 10px 0 rgba(0,0,0,0.5)',
  card: `0 8px 0 rgba(0,0,0,0.4)`,
  button: `0 6px 0 ${scColors.yellow.dark}`,
  buttonGreen: `0 6px 0 #006622`,
  buttonRed: `0 6px 0 ${scColors.red.dark}`,
  pressed: `0 2px 0 rgba(0,0,0,0.3)`,
} as const;

// ==================== BORDERS (thick Brawl Stars borders) ====================
export const borders = {
  card: `6px solid ${scColors.black}`,
  cardThin: `4px solid ${scColors.black}`,
  button: `4px solid ${scColors.black}`,
  input: `4px solid ${scColors.black}`,
  accent: `4px solid`,
} as const;

// ==================== Z-INDEX ====================
export const zIndex = {
  base: 0,
  dropdown: 10,
  sticky: 20,
  fixed: 30,
  modalBackdrop: 40,
  modal: 50,
  popover: 60,
  tooltip: 70,
} as const;

// ==================== TRANSITIONS ====================
export const transition = {
  fast: '100ms ease',
  base: '150ms ease',
  slow: '300ms ease',
  all: 'all 150ms ease',
  bounce: '200ms cubic-bezier(0.68, -0.55, 0.265, 1.55)',
} as const;

// ==================== BREAKPOINTS ====================
export const breakpoints = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
} as const;

// ==================== MEDIA QUERIES ====================
export const media = {
  sm: `@media (min-width: ${breakpoints.sm})`,
  md: `@media (min-width: ${breakpoints.md})`,
  lg: `@media (min-width: ${breakpoints.lg})`,
  xl: `@media (min-width: ${breakpoints.xl})`,
  '2xl': `@media (min-width: ${breakpoints['2xl']})`,
  dark: '@media (prefers-color-scheme: dark)',
} as const;

// ==================== CONTAINER WIDTHS ====================
export const containerWidth = {
  sm: '640px',
  md: '768px',
  lg: '1024px',
  xl: '1280px',
  '2xl': '1536px',
  full: '100%',
  '7/8': '87.5%',
} as const;

// ==================== COMMON MIXINS ====================
export const mixins = {
  brawlCard: `
    background: ${scColors.surface};
    border: 6px solid ${scColors.black};
    border-radius: 20px;
    box-shadow: 0 8px 0 rgba(0,0,0,0.4);
    color: ${scColors.black};
    font-weight: 600;
  `,
  
  brawlCardBlue: `
    background: linear-gradient(180deg, ${scColors.blue.light} 0%, ${scColors.blue.dark} 100%);
    border: 6px solid ${scColors.black};
    border-radius: 20px;
    box-shadow: 0 8px 0 rgba(0,0,0,0.4);
  `,

  brawlTextOutline: `
    text-shadow: 
      3px 3px 0px ${scColors.black},
      -1px -1px 0px ${scColors.black},
      1px -1px 0px ${scColors.black},
      -1px 1px 0px ${scColors.black},
      1px 1px 0px ${scColors.black};
  `,

  brawlTextOutlineSmall: `
    text-shadow: 
      2px 2px 0px ${scColors.black},
      -1px -1px 0px ${scColors.black},
      1px -1px 0px ${scColors.black},
      -1px 1px 0px ${scColors.black};
  `,

  focusRing: `
    outline: none;
    &:focus-visible {
      border-color: ${scColors.yellow.base};
      box-shadow: 0 0 0 3px ${scColors.yellow.base}80;
    }
  `,

  truncate: `
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  `,

  lineClamp: (lines: number) => `
    display: -webkit-box;
    -webkit-line-clamp: ${lines};
    -webkit-box-orient: vertical;
    overflow: hidden;
  `,

  srOnly: `
    position: absolute;
    width: 1px;
    height: 1px;
    padding: 0;
    margin: -1px;
    overflow: hidden;
    clip: rect(0, 0, 0, 0);
    white-space: nowrap;
    border-width: 0;
  `,

  flexCenter: `
    display: flex;
    align-items: center;
    justify-content: center;
  `,

  absoluteFill: `
    position: absolute;
    inset: 0;
  `,

  scrollbar: `
    &::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }

    &::-webkit-scrollbar-track {
      background: rgba(0,0,0,0.1);
    }

    &::-webkit-scrollbar-thumb {
      background: rgba(0,0,0,0.3);
      border-radius: ${borderRadius.full};

      &:hover {
        background: rgba(0,0,0,0.5);
      }
    }
  `,
} as const;
