import React from "react";
import { button, type ButtonVariantProps } from "@/../styled-system/recipes";

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    ButtonVariantProps {
  pill?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = "solid", size = "md", pill = true, className = "", style, ...props }, ref) => {
    const classes = button({ variant, size });
    return (
      <button
        ref={ref}
        className={`${classes} ${className}`}
        style={{
          borderRadius: pill ? "9999px" : "0.5rem",
          cursor: props.disabled ? "not-allowed" : "pointer",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.4rem",
          fontWeight: 600,
          transition: "all 0.15s ease",
          ...style,
        }}
        {...props}
      />
    );
  }
);
Button.displayName = "Button";
