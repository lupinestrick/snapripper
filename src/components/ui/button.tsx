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
      pill = true,
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

    // Exact "全部展开" baseline style from Workbench:
    // padding: "0.3rem 0.75rem", borderRadius: "9999px", border: "1px solid #334155", backgroundColor: "#1e293b", color: "#94a3b8", fontSize: "0.75rem"
    let bg = "#1e293b";
    let border = "1px solid #334155";
    let color = "#94a3b8";

    if (variant === "solid") {
      bg = isHovered && !props.disabled ? "#1d4ed8" : "#2563eb";
      border = "1px solid #3b82f6";
      color = "#ffffff";
    } else if (variant === "subtle") {
      bg = isHovered && !props.disabled ? "rgba(56, 189, 248, 0.2)" : "rgba(56, 189, 248, 0.12)";
      border = "1px solid rgba(56, 189, 248, 0.3)";
      color = "#38bdf8";
    } else if (variant === "ghost") {
      bg = isHovered && !props.disabled ? "rgba(255, 255, 255, 0.08)" : "transparent";
      border = "1px solid transparent";
      color = isHovered && !props.disabled ? "#f8fafc" : "#94a3b8";
    } else {
      // "outline" - standard "全部展开" style
      bg = isHovered && !props.disabled ? "#334155" : "#1e293b";
      border = isHovered && !props.disabled ? "1px solid #475569" : "1px solid #334155";
      color = isHovered && !props.disabled ? "#f8fafc" : "#94a3b8";
    }

    const padding =
      size === "xs"
        ? "0.3rem 0.75rem"
        : size === "sm"
        ? "0.35rem 0.85rem"
        : size === "lg"
        ? "0.55rem 1.25rem"
        : "0.4rem 1rem";

    const fontSize =
      size === "xs"
        ? "0.75rem"
        : size === "sm"
        ? "0.8rem"
        : size === "lg"
        ? "0.9rem"
        : "0.85rem";

    return (
      <button
        ref={ref}
        className={className}
        style={{
          borderRadius: pill ? "9999px" : "0.5rem",
          padding,
          fontSize,
          fontWeight: 500,
          backgroundColor: bg,
          border,
          color,
          boxShadow: "none",
          outline: "none",
          cursor: props.disabled ? "not-allowed" : "pointer",
          opacity: props.disabled ? 0.5 : 1,
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.35rem",
          transition: "all 0.15s ease",
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
