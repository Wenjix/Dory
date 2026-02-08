/**
 * Global Styles - Supercell / Brawl Stars game UI
 */

import { createGlobalStyle } from 'styled-components';
import { scColors } from './colors';

export const GlobalStyles = createGlobalStyle`
  * {
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }

  html {
    -webkit-text-size-adjust: 100%;
    -moz-text-size-adjust: 100%;
    text-size-adjust: 100%;
    font-size: 16px;
  }

  html,
  body {
    font-family: 'Lilita One', cursive;
    -webkit-font-smoothing: antialiased;
    -moz-osx-font-smoothing: grayscale;
    touch-action: manipulation;
    background-color: ${scColors.blue.base};
    color: ${scColors.white};
    overflow-x: hidden;
    background-image: 
      radial-gradient(circle at 50% 50%, rgba(0,0,0,0.2) 0%, transparent 100%);
  }

  #__next {
    min-height: 100vh;
  }

  a {
    color: inherit;
    text-decoration: none;
  }

  button {
    font-family: 'Lilita One', cursive;
  }

  p, span, input, textarea {
    font-family: 'Plus Jakarta Sans', sans-serif;
  }

  h1, h2, h3, h4, h5, h6 {
    font-family: 'Lilita One', cursive;
  }

  /* Hide scrollbar */
  ::-webkit-scrollbar {
    width: 8px;
    height: 8px;
  }

  ::-webkit-scrollbar-track {
    background: rgba(0, 0, 0, 0.2);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb {
    background: rgba(0, 0, 0, 0.4);
    border-radius: 4px;
  }

  ::-webkit-scrollbar-thumb:hover {
    background: rgba(0, 0, 0, 0.6);
  }

  .no-scrollbar::-webkit-scrollbar { display: none; }
  .no-scrollbar { -ms-overflow-style: none; scrollbar-width: none; }

  /* Brawl-style text outline utility */
  .brawl-text-outline {
    text-shadow: 
      4px 4px 0px ${scColors.black},
      -1px -1px 0px ${scColors.black},
      1px -1px 0px ${scColors.black},
      -1px 1px 0px ${scColors.black},
      1px 1px 0px ${scColors.black};
  }

  /* Brawl slant utility */
  .brawl-slant {
    transform: skewX(-5deg);
  }

  /* Supercell card utility */
  .brawl-card {
    background: ${scColors.surface};
    border: 6px solid ${scColors.black};
    border-radius: 20px;
    box-shadow: 0 8px 0 rgba(0,0,0,0.4);
    color: ${scColors.black};
    font-weight: 600;
  }

  .brawl-card-blue {
    background: linear-gradient(180deg, ${scColors.blue.light} 0%, ${scColors.blue.dark} 100%);
    border: 6px solid ${scColors.black};
    border-radius: 20px;
    box-shadow: 0 8px 0 rgba(0,0,0,0.4);
  }

  .brawl-card-pink {
    background: linear-gradient(180deg, ${scColors.pink.light} 0%, ${scColors.pink.dark} 100%);
    border: 6px solid ${scColors.black};
    border-radius: 20px;
    box-shadow: 0 8px 0 rgba(0,0,0,0.4);
  }

  /* Brawl float animation */
  @keyframes brawl-float {
    0%, 100% { transform: translateY(0) rotate(-2deg); }
    50% { transform: translateY(-15px) rotate(2deg); }
  }

  .animate-brawl-float {
    animation: brawl-float 4s ease-in-out infinite;
  }

  /* Character talk animation */
  @keyframes character-talk {
    0%, 100% { transform: scale(1); filter: brightness(1); }
    50% { transform: scale(1.08) translateY(-5px); filter: brightness(1.2); }
  }

  .character-active {
    animation: character-talk 0.25s ease-in-out infinite;
  }

  /* Fade in animation */
  @keyframes fadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes slideInUp {
    from {
      opacity: 0;
      transform: translateY(20px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }

  @keyframes bounceIn {
    0% { transform: scale(0.3); opacity: 0; }
    50% { transform: scale(1.05); }
    70% { transform: scale(0.9); }
    100% { transform: scale(1); opacity: 1; }
  }

  .animate-fade-in {
    animation: fadeIn 0.5s ease-out;
  }

  .animate-slide-up {
    animation: slideInUp 0.5s ease-out;
  }

  .animate-bounce-in {
    animation: bounceIn 0.6s ease-out;
  }
`;
