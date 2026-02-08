import * as React from "react";
import styled from "styled-components";
import { scColors } from '@/theme';

interface InputProps extends React.ComponentProps<"input"> {}

const StyledInput = styled.input`
  display: flex;
  height: 2.75rem;
  width: 100%;
  min-width: 0;
  border-radius: 12px;
  border: 4px solid ${scColors.black};
  background-color: ${scColors.surface};
  padding: 0.5rem 1rem;
  font-size: 1rem;
  line-height: 1.5rem;
  color: ${scColors.black};
  box-shadow: 0 4px 0 rgba(0,0,0,0.3);
  transition: border-color 0.15s ease, box-shadow 0.15s ease;
  outline: none;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 600;
  
  &::selection {
    background-color: ${scColors.yellow.base};
    color: ${scColors.black};
  }
  
  &::placeholder {
    color: rgba(0, 0, 0, 0.3);
    font-weight: 400;
  }
  
  &:focus-visible {
    border-color: ${scColors.yellow.base};
    box-shadow: 0 4px 0 rgba(0,0,0,0.3), 0 0 0 2px ${scColors.yellow.base}60;
  }
  
  &[aria-invalid="true"] {
    border-color: ${scColors.red.base};
    box-shadow: 0 4px 0 rgba(0,0,0,0.3), 0 0 0 2px ${scColors.red.base}40;
  }
  
  &:disabled {
    pointer-events: none;
    cursor: not-allowed;
    opacity: 0.5;
  }
  
  &[type="file"] {
    &::file-selector-button {
      display: inline-flex;
      height: 1.75rem;
      border: 0;
      background-color: transparent;
      font-size: 0.875rem;
      line-height: 1.25rem;
      font-weight: 700;
      color: ${scColors.black};
    }
  }
  
  @media (min-width: 768px) {
    font-size: 0.9375rem;
  }
`;

export const Input: React.FC<InputProps> = ({ type, ...props }) => {
  return <StyledInput type={type} data-slot="input" {...props} />;
};
