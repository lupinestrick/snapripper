import React from "react";
import { badge, type BadgeVariantProps } from "@/../styled-system/recipes";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    BadgeVariantProps {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "subtle", size = "md", className = "", style, ...props }, ref) => {
    const classes = badge({ variant, size });

    let bg = "var(--accent-subtle)";
    let border = "1px solid var(--accent-border)";
    let color = "var(--accent-text)";

    if (variant === "solid") {
      bg = "var(--accent-solid)";
      border = "1px solid var(--accent-solid)";
      color = "var(--accent-fg, #ffffff)";
    } else if (variant === "outline") {
      bg = "transparent";
      border = "1px solid var(--border-subtle)";
      color = "var(--text-muted)";
    }

    const padding =
      size === "sm"
        ? "0.15rem 0.5rem"
        : size === "lg"
        ? "0.3rem 0.85rem"
        : "0.2rem 0.65rem";

    const fontSize =
      size === "sm"
        ? "0.7rem"
        : size === "lg"
        ? "0.85rem"
        : "0.75rem";

    return (
      <span
        ref={ref}
        className={`${classes} ${className}`}
        style={{
          borderRadius: "9999px",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.25rem",
          fontWeight: 600,
          backgroundColor: bg,
          border,
          color,
          padding,
          fontSize,
          ...style,
        }}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
