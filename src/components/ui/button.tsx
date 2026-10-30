"use client";

import React, { useState } from "react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "outline" | "solid" | "subtle" | "ghost";
  size?: "xs" | "sm" | "md" | "lg";
  pill?: boolean;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "outline",
      size = "xs",
      pill = false,
      className = "",
      style,
      onMouseEnter,
      onMouseLeave,
      children,
      ...props
    },
    ref
  ) => {
    const [isHovered, setIsHovered] = useState(false);

    let bg = "var(--btn-outline-bg)";
    let border = "1px solid var(--btn-outline-border)";
    let color = "var(--text-muted)";

    if (variant === "solid") {
      bg = isHovered && !props.disabled ? "var(--accent-hover)" : "var(--accent-solid)";
      border = "1px solid transparent";
      color = "var(--accent-fg)";
    } else if (variant === "subtle") {
      bg = isHovered && !props.disabled ? "var(--accent-subtle-hover)" : "var(--accent-subtle)";
      border = "1px solid var(--accent-border)";
      color = "var(--accent-text)";
    } else if (variant === "ghost") {
      bg = isHovered && !props.disabled ? "var(--btn-ghost-hover)" : "transparent";
      border = "1px solid transparent";
      color = isHovered && !props.disabled ? "var(--text-main)" : "var(--text-muted)";
    } else {
      // Park UI "Make It Yours" outline recipe
      bg = isHovered && !props.disabled ? "var(--btn-outline-hover-bg)" : "var(--btn-outline-bg)";
      border =
        isHovered && !props.disabled
          ? "1px solid var(--btn-outline-hover-border)"
          : "1px solid var(--btn-outline-border)";
      color = isHovered && !props.disabled ? "var(--text-main)" : "var(--text-muted)";
    }

    const padding =
      size === "xs"
        ? "0.28rem 0.7rem"
        : size === "sm"
        ? "0.35rem 0.85rem"
        : size === "lg"
        ? "0.55rem 1.25rem"
        : "0.45rem 1rem";

    const fontSize =
      size === "xs"
        ? "0.75rem"
        : size === "sm"
        ? "0.8rem"
        : size === "lg"
        ? "0.925rem"
        : "0.85rem";

    return (
      <button
        ref={ref}
        className={className}
        style={{
          borderRadius: pill ? "9999px" : "var(--radius-btn, 6px)",
          padding,
          fontSize,
          fontWeight: 500,
          backgroundColor: bg,
          border,
          color,
          boxShadow: "none",
          outline: "none",
          cursor: props.disabled ? "not-allowed" : "pointer",
          opacity: props.disabled ? 0.45 : 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.35rem",
          transition: "all 0.15s cubic-bezier(0.4, 0, 0.2, 1)",
          userSelect: "none",
          whiteSpace: "nowrap",
          ...style,
        }}
        onMouseEnter={(e) => {
          setIsHovered(true);
          onMouseEnter?.(e);
        }}
        onMouseLeave={(e) => {
          setIsHovered(false);
          onMouseLeave?.(e);
        }}
        {...props}
      >
        {children}
      </button>
    );
  }
);

Button.displayName = "Button";
