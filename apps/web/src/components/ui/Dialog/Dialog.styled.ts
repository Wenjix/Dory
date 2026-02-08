/**
 * Dialog Styled Components
 * Supercell / Brawl Stars game UI style
 */

import styled from "styled-components";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { scColors } from '@/theme';

export const StyledDialogOverlay = styled(DialogPrimitive.Overlay)`
  position: fixed;
  inset: 0;
  z-index: 50;
  background-color: rgba(0, 0, 0, 0.6);

  &[data-state="closed"] {
    animation: fade-out 0.2s;
  }

  &[data-state="open"] {
    animation: fade-in 0.2s;
  }

  @keyframes fade-in {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes fade-out {
    from { opacity: 1; }
    to { opacity: 0; }
  }
`;

export const StyledDialogContent = styled(DialogPrimitive.Content)`
  position: fixed;
  top: 50%;
  left: 50%;
  z-index: 50;
  display: grid;
  width: 100%;
  max-width: calc(100% - 2rem);
  transform: translate(-50%, -50%);
  gap: 1rem;
  background: ${scColors.surface};
  border: 6px solid ${scColors.black};
  border-radius: 24px;
  box-shadow: 0 10px 0 rgba(0,0,0,0.4);
  padding: 2rem;
  color: ${scColors.black};
  font-weight: 600;

  &[data-state="closed"] {
    animation: fade-out 0.2s, zoom-out 0.2s;
  }

  &[data-state="open"] {
    animation: fade-in 0.2s, zoom-in 0.2s;
  }

  @media (min-width: 640px) {
    max-width: 32rem;
  }

  @keyframes zoom-in {
    from { transform: translate(-50%, -50%) scale(0.9); }
    to { transform: translate(-50%, -50%) scale(1); }
  }

  @keyframes zoom-out {
    from { transform: translate(-50%, -50%) scale(1); }
    to { transform: translate(-50%, -50%) scale(0.9); }
  }
`;

export const StyledDialogClose = styled(DialogPrimitive.Close)`
  position: absolute;
  top: 1rem;
  right: 1rem;
  width: 2rem;
  height: 2rem;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: linear-gradient(180deg, #ff5252 0%, #d32f2f 100%);
  border: 3px solid ${scColors.black};
  box-shadow: 0 3px 0 ${scColors.red.dark};
  color: ${scColors.white};
  cursor: pointer;
  transition: transform 100ms ease, box-shadow 100ms ease;

  &:hover {
    filter: brightness(1.1);
  }

  &:active {
    transform: translateY(2px);
    box-shadow: 0 1px 0 ${scColors.red.dark};
  }

  &:disabled {
    pointer-events: none;
  }

  & svg {
    pointer-events: none;
    flex-shrink: 0;
    width: 0.875rem;
    height: 0.875rem;
  }
`;

export const StyledDialogHeader = styled.div`
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  text-align: center;

  @media (min-width: 640px) {
    text-align: left;
  }
`;

export const StyledDialogFooter = styled.div`
  display: flex;
  flex-direction: column-reverse;
  gap: 0.75rem;

  @media (min-width: 640px) {
    flex-direction: row;
    justify-content: flex-end;
  }
`;

export const StyledDialogTitle = styled(DialogPrimitive.Title)`
  font-size: 1.25rem;
  line-height: 1;
  font-weight: 700;
  color: ${scColors.black};
  font-family: 'Lilita One', cursive;
`;

export const StyledDialogDescription = styled(DialogPrimitive.Description)`
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgba(0, 0, 0, 0.6);
  font-family: 'Plus Jakarta Sans', sans-serif;
`;
