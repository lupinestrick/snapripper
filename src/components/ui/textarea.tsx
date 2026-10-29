import React from "react";
import { textarea, type TextareaVariantProps } from "@/../styled-system/recipes";

export interface TextareaProps
  extends React.TextareaHTMLAttributes<HTMLTextAreaElement>,
    TextareaVariantProps {}

export const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ size = "md", className = "", style, ...props }, ref) => {
    const classes = textarea({ size });
    return (
      <textarea
        ref={ref}
        className={`${classes} ${className}`}
        style={{
          backgroundColor: "#0f172a",
          border: "1px solid #334155",
          borderRadius: "0.5rem",
          color: "#f8fafc",
          padding: "0.5rem 0.75rem",
          outline: "none",
          width: "100%",
          fontSize: "0.85rem",
          ...style,
        }}
        {...props}
      />
    );
  }
);
Textarea.displayName = "Textarea";
