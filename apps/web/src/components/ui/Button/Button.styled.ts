/**
 * Button Styled Components
 * Supercell / Brawl Stars game UI buttons
 */

import styled, { css } from "styled-components";
import { scColors } from '@/theme';

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";

interface StyledButtonProps {
  $variant?: ButtonVariant;
  $size?: ButtonSize;
}

const variantStyles = {
  default: css`
    background: linear-gradient(180deg, ${scColors.yellow.light} 0%, ${scColors.yellow.base} 100%);
    color: ${scColors.black};
    border: 4px solid ${scColors.black};
    box-shadow: 0 6px 0 ${scColors.yellow.dark};
    text-shadow: none;

    &:hover {
      filter: brightness(1.1);
    }

    &:active {
      transform: translateY(3px);
      box-shadow: 0 3px 0 ${scColors.yellow.dark};
    }
  `,
  destructive: css`
    background: linear-gradient(180deg, ${scColors.red.light} 0%, ${scColors.red.base} 100%);
    color: ${scColors.white};
    border: 4px solid ${scColors.black};
    box-shadow: 0 6px 0 ${scColors.red.dark};
    text-shadow: 2px 2px 0px rgba(0,0,0,0.3);

    &:hover {
      filter: brightness(1.1);
    }

    &:active {
      transform: translateY(3px);
      box-shadow: 0 3px 0 ${scColors.red.dark};
    }
  `,
  outline: css`
    background: ${scColors.surface};
    color: ${scColors.black};
    border: 4px solid ${scColors.black};
    box-shadow: 0 4px 0 rgba(0,0,0,0.3);
    font-weight: 600;

    &:hover {
      background: rgba(0,0,0,0.05);
    }

    &:active {
      transform: translateY(3px);
      box-shadow: 0 1px 0 rgba(0,0,0,0.3);
    }
  `,
  secondary: css`
    background: linear-gradient(180deg, ${scColors.blue.light} 0%, ${scColors.blue.base} 100%);
    color: ${scColors.white};
    border: 4px solid ${scColors.black};
    box-shadow: 0 6px 0 ${scColors.blue.dark};
    text-shadow: 2px 2px 0px rgba(0,0,0,0.3);

    &:hover {
      filter: brightness(1.1);
    }

    &:active {
      transform: translateY(3px);
      box-shadow: 0 3px 0 ${scColors.blue.dark};
    }
  `,
  ghost: css`
    background: transparent;
    color: ${scColors.black};
    border: 3px solid transparent;
    box-shadow: none;

    &:hover {
      background: rgba(0,0,0,0.08);
      border-color: rgba(0,0,0,0.1);
    }

    &:active {
      background: rgba(0,0,0,0.12);
    }
  `,
  link: css`
    background: transparent;
    color: ${scColors.blue.base};
    border: none;
    box-shadow: none;
    text-decoration: underline;
    text-underline-offset: 4px;
    font-weight: 800;

    &:hover {
      color: ${scColors.blue.light};
    }
  `,
};

const sizeStyles = {
  default: css`
    height: 2.5rem;
    padding: 0.5rem 1.25rem;

    &:has(> svg) {
      padding-left: 1rem;
      padding-right: 1rem;
    }
  `,
  sm: css`
    height: 2rem;
    border-radius: 8px;
    gap: 0.375rem;
    padding: 0 0.75rem;
    font-size: 0.75rem;

    &:has(> svg) {
      padding-left: 0.625rem;
      padding-right: 0.625rem;
    }
  `,
  lg: css`
    height: 3rem;
    border-radius: 12px;
    padding: 0 2rem;
    font-size: 1.125rem;

    &:has(> svg) {
      padding-left: 1.25rem;
      padding-right: 1.25rem;
    }
  `,
  icon: css`
    width: 2.5rem;
    height: 2.5rem;
  `,
  "icon-sm": css`
    width: 2rem;
    height: 2rem;
  `,
  "icon-lg": css`
    width: 3rem;
    height: 3rem;
  `,
};

export const StyledButton = styled.button<StyledButtonProps>`
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  white-space: nowrap;
  border-radius: 12px;
  font-size: 0.875rem;
  line-height: 1.25rem;
  font-weight: 700;
  transition: transform 100ms ease, box-shadow 100ms ease, filter 100ms ease;
  flex-shrink: 0;
  outline: none;
  cursor: pointer;
  font-family: 'Lilita One', cursive;
  text-transform: uppercase;
  letter-spacing: 0.05em;

  &:disabled {
    pointer-events: none;
    opacity: 0.5;
  }

  & svg {
    pointer-events: none;
    flex-shrink: 0;

    &:not([class*='size-']) {
      width: 1rem;
      height: 1rem;
    }
  }

  ${({ $variant = "default" }) => variantStyles[$variant]}
  ${({ $size = "default" }) => sizeStyles[$size]}
`;
