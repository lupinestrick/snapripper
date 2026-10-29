import React from "react";
import { badge, type BadgeVariantProps } from "@/../styled-system/recipes";

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    BadgeVariantProps {}

export const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ variant = "subtle", size = "md", className = "", style, ...props }, ref) => {
    const classes = badge({ variant, size });
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
          ...style,
        }}
        {...props}
      />
    );
  }
);
Badge.displayName = "Badge";
