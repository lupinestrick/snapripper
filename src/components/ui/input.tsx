import React from "react";
import { input, type InputVariantProps } from "@/../styled-system/recipes";

export interface InputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, "size">,
    InputVariantProps {}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ size = "md", className = "", style, ...props }, ref) => {
    const classes = input({ size });
    return (
      <input
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
Input.displayName = "Input";
