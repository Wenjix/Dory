// @ts-nocheck
"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { XIcon } from "lucide-react";
import {
  StyledDialogOverlay,
  StyledDialogContent,
  StyledDialogClose,
  StyledDialogHeader,
  StyledDialogFooter,
  StyledDialogTitle,
  StyledDialogDescription,
} from "./Dialog.styled";

export interface DialogProps
  extends React.ComponentProps<typeof DialogPrimitive.Root> {}

export interface DialogTriggerProps
  extends React.ComponentProps<typeof DialogPrimitive.Trigger> {}

export interface DialogPortalProps
  extends React.ComponentProps<typeof DialogPrimitive.Portal> {}

export interface DialogCloseProps
  extends React.ComponentProps<typeof DialogPrimitive.Close> {}

export interface DialogOverlayProps
  extends React.ComponentProps<typeof DialogPrimitive.Overlay> {}

export interface DialogContentProps
  extends React.ComponentProps<typeof DialogPrimitive.Content> {
  showCloseButton?: boolean;
}

export interface DialogHeaderProps extends React.ComponentProps<"div"> {}

export interface DialogFooterProps extends React.ComponentProps<"div"> {}

export interface DialogTitleProps
  extends React.ComponentProps<typeof DialogPrimitive.Title> {}

export interface DialogDescriptionProps
  extends React.ComponentProps<typeof DialogPrimitive.Description> {}

export const Dialog: React.FC<DialogProps> = ({ ...props }) => {
  return <DialogPrimitive.Root data-slot="dialog" {...props} />;
};

export const DialogTrigger: React.FC<DialogTriggerProps> = ({ ...props }) => {
  return <DialogPrimitive.Trigger data-slot="dialog-trigger" {...props} />;
};

export const DialogPortal: React.FC<DialogPortalProps> = ({ ...props }) => {
  return <DialogPrimitive.Portal data-slot="dialog-portal" {...props} />;
};

export const DialogClose: React.FC<DialogCloseProps> = ({ ...props }) => {
  return <DialogPrimitive.Close data-slot="dialog-close" {...props} />;
};

export const DialogOverlay: React.FC<DialogOverlayProps> = ({ ...props }) => {
  return <StyledDialogOverlay data-slot="dialog-overlay" {...props} />;
};

export const DialogContent: React.FC<DialogContentProps> = ({
  children,
  showCloseButton = true,
  ...props
}) => {
  return (
    <DialogPortal data-slot="dialog-portal">
      <DialogOverlay />
      <StyledDialogContent data-slot="dialog-content" {...props}>
        {children}
        {showCloseButton && (
          <StyledDialogClose data-slot="dialog-close">
            <XIcon />
            <span style={{ position: 'absolute', width: '1px', height: '1px', padding: 0, margin: '-1px', overflow: 'hidden', clip: 'rect(0,0,0,0)', whiteSpace: 'nowrap', borderWidth: 0 }}>Close</span>
          </StyledDialogClose>
        )}
      </StyledDialogContent>
    </DialogPortal>
  );
};

export const DialogHeader: React.FC<DialogHeaderProps> = ({ ...props }) => {
  return <StyledDialogHeader data-slot="dialog-header" {...props} />;
};

export const DialogFooter: React.FC<DialogFooterProps> = ({ ...props }) => {
  return <StyledDialogFooter data-slot="dialog-footer" {...props} />;
};

export const DialogTitle: React.FC<DialogTitleProps> = ({ ...props }) => {
  return <StyledDialogTitle data-slot="dialog-title" {...props} />;
};

export const DialogDescription: React.FC<DialogDescriptionProps> = ({
  ...props
}) => {
  return <StyledDialogDescription data-slot="dialog-description" {...props} />;
};

