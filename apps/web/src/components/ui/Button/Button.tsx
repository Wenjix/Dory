import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { StyledButton } from "./Button.styled";

type ButtonVariant = "default" | "destructive" | "outline" | "secondary" | "ghost" | "link";
type ButtonSize = "default" | "sm" | "lg" | "icon" | "icon-sm" | "icon-lg";

export interface ButtonProps extends React.ComponentProps<"button"> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  asChild?: boolean;
}

export const Button: React.FC<ButtonProps> = ({
  variant = "default",
  size = "default",
  asChild = false,
  ...props
}) => {
  const Comp = asChild ? Slot : "button";

  return (
    <StyledButton
      as={Comp as any}
      data-slot="button"
      $variant={variant}
      $size={size}
      {...props}
    />
  );
};

