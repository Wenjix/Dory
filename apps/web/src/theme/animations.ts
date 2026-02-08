/**
 * Animations - Supercell / Brawl Stars game-feel animations
 */

import { keyframes, css } from 'styled-components';

// ==================== KEYFRAMES ====================

export const fadeIn = keyframes`
  from { opacity: 0; }
  to { opacity: 1; }
`;

export const fadeOut = keyframes`
  from { opacity: 1; }
  to { opacity: 0; }
`;

export const slideInFromBottom = keyframes`
  from {
    transform: translateY(20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

export const slideInFromTop = keyframes`
  from {
    transform: translateY(-20px);
    opacity: 0;
  }
  to {
    transform: translateY(0);
    opacity: 1;
  }
`;

export const slideInFromLeft = keyframes`
  from {
    transform: translateX(-20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

export const slideInFromRight = keyframes`
  from {
    transform: translateX(20px);
    opacity: 0;
  }
  to {
    transform: translateX(0);
    opacity: 1;
  }
`;

export const slideOutToBottom = keyframes`
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(20px);
    opacity: 0;
  }
`;

export const slideOutToTop = keyframes`
  from {
    transform: translateY(0);
    opacity: 1;
  }
  to {
    transform: translateY(-20px);
    opacity: 0;
  }
`;

export const scaleIn = keyframes`
  from {
    transform: scale(0.8);
    opacity: 0;
  }
  to {
    transform: scale(1);
    opacity: 1;
  }
`;

export const scaleOut = keyframes`
  from {
    transform: scale(1);
    opacity: 1;
  }
  to {
    transform: scale(0.8);
    opacity: 0;
  }
`;

export const bounceIn = keyframes`
  0% { transform: scale(0.3); opacity: 0; }
  50% { transform: scale(1.05); }
  70% { transform: scale(0.9); }
  100% { transform: scale(1); opacity: 1; }
`;

export const spin = keyframes`
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
`;

export const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
`;

export const bounce = keyframes`
  0%, 100% {
    transform: translateY(-10%);
    animation-timing-function: cubic-bezier(0.8, 0, 1, 1);
  }
  50% {
    transform: translateY(0);
    animation-timing-function: cubic-bezier(0, 0, 0.2, 1);
  }
`;

export const brawlFloat = keyframes`
  0%, 100% { transform: translateY(0) rotate(-2deg); }
  50% { transform: translateY(-15px) rotate(2deg); }
`;

export const characterTalk = keyframes`
  0%, 100% { transform: scale(1); filter: brightness(1); }
  50% { transform: scale(1.08) translateY(-5px); filter: brightness(1.2); }
`;

export const shimmer = keyframes`
  0% { background-position: -1000px 0; }
  100% { background-position: 1000px 0; }
`;

export const gradientShift = keyframes`
  0% { background-position: 0% 50%; }
  50% { background-position: 100% 50%; }
  100% { background-position: 0% 50%; }
`;

export const wiggle = keyframes`
  0%, 100% { transform: rotate(0deg); }
  25% { transform: rotate(-3deg); }
  75% { transform: rotate(3deg); }
`;

// ==================== ANIMATION MIXINS ====================

export const animateFadeIn = (duration = '200ms', delay = '0ms') => css`
  animation: ${fadeIn} ${duration} ease-out ${delay} forwards;
`;

export const animateFadeOut = (duration = '200ms', delay = '0ms') => css`
  animation: ${fadeOut} ${duration} ease-out ${delay} forwards;
`;

export const animateSlideInFromBottom = (duration = '300ms', delay = '0ms') => css`
  animation: ${slideInFromBottom} ${duration} ease-out ${delay} forwards;
`;

export const animateSlideInFromTop = (duration = '300ms', delay = '0ms') => css`
  animation: ${slideInFromTop} ${duration} ease-out ${delay} forwards;
`;

export const animateSlideInFromLeft = (duration = '300ms', delay = '0ms') => css`
  animation: ${slideInFromLeft} ${duration} ease-out ${delay} forwards;
`;

export const animateSlideInFromRight = (duration = '300ms', delay = '0ms') => css`
  animation: ${slideInFromRight} ${duration} ease-out ${delay} forwards;
`;

export const animateScaleIn = (duration = '300ms', delay = '0ms') => css`
  animation: ${scaleIn} ${duration} ease-out ${delay} forwards;
`;

export const animateBounceIn = (duration = '500ms', delay = '0ms') => css`
  animation: ${bounceIn} ${duration} ease-out ${delay} forwards;
`;

export const animateSpin = (duration = '1s') => css`
  animation: ${spin} ${duration} linear infinite;
`;

export const animatePulse = (duration = '2s') => css`
  animation: ${pulse} ${duration} cubic-bezier(0.4, 0, 0.6, 1) infinite;
`;

export const animateFloat = (duration = '4s') => css`
  animation: ${brawlFloat} ${duration} ease-in-out infinite;
`;

export const animateIn = (duration = '300ms', delay = '0ms') => css`
  animation: ${fadeIn} ${duration} ease-out ${delay} forwards,
              ${slideInFromBottom} ${duration} ease-out ${delay} forwards;
`;

export const animateOut = (duration = '200ms', delay = '0ms') => css`
  animation: ${fadeOut} ${duration} ease-out ${delay} forwards,
              ${slideOutToBottom} ${duration} ease-out ${delay} forwards;
`;

// ==================== TRANSITION HELPERS ====================

export const transitionBase = css`
  transition: all 150ms ease;
`;

export const transitionColors = css`
  transition: color 150ms ease,
              background-color 150ms ease,
              border-color 150ms ease;
`;

export const transitionShadow = css`
  transition: box-shadow 150ms ease;
`;

export const transitionTransform = css`
  transition: transform 100ms ease;
`;

export const transitionAll = css`
  ${transitionColors}
  ${transitionShadow}
`;
