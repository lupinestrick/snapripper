"use client";

import React from "react";
import { Dialog as ArkDialog } from "@ark-ui/react/dialog";
import { dialog } from "@/../styled-system/recipes";

export interface DialogProps {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
  children: React.ReactNode;
}

export const Dialog = {
  Root: ({ open, onOpenChange, children }: DialogProps) => (
    <ArkDialog.Root open={open} onOpenChange={(details) => onOpenChange?.(details.open)}>
      {children}
    </ArkDialog.Root>
  ),
  Trigger: ArkDialog.Trigger,
  Backdrop: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className = "", style, ...props }, ref) => {
      const classes = dialog();
      return (
        <ArkDialog.Backdrop
          ref={ref}
          className={`${classes.backdrop} ${className}`}
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(0, 0, 0, 0.75)",
            backdropFilter: "blur(4px)",
            zIndex: 100,
            ...style,
          }}
          {...props}
        />
      );
    }
  ),
  Positioner: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className = "", style, ...props }, ref) => {
      const classes = dialog();
      return (
        <ArkDialog.Positioner
          ref={ref}
          className={`${classes.positioner} ${className}`}
          style={{
            position: "fixed",
            inset: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 101,
            padding: "1rem",
            ...style,
          }}
          {...props}
        />
      );
    }
  ),
  Content: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className = "", style, ...props }, ref) => {
      const classes = dialog();
      return (
        <ArkDialog.Content
          ref={ref}
          className={`${classes.content} ${className}`}
          style={{
            backgroundColor: "#111827",
            border: "1px solid #1f2937",
            borderRadius: "1rem",
            boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            overflow: "hidden",
            color: "#f8fafc",
            ...style,
          }}
          {...props}
        />
      );
    }
  ),
  Title: React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className = "", style, ...props }, ref) => {
      const classes = dialog();
      return (
        <ArkDialog.Title
          ref={ref}
          className={`${classes.title} ${className}`}
          style={{ fontSize: "1.05rem", fontWeight: 600, color: "#f8fafc", ...style }}
          {...props}
        />
      );
    }
  ),
  Description: React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className = "", style, ...props }, ref) => {
      const classes = dialog();
      return (
        <ArkDialog.Description
          ref={ref}
          className={`${classes.description} ${className}`}
          style={{ fontSize: "0.825rem", color: "#94a3b8", marginTop: "0.25rem", ...style }}
          {...props}
        />
      );
    }
  ),
  CloseTrigger: ArkDialog.CloseTrigger,
};
