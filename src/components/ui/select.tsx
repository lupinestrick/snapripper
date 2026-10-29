import React from "react";
import { input } from "@/../styled-system/recipes";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  pill?: boolean;
}

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ pill = true, className = "", style, ...props }, ref) => {
    const classes = input({ size: "sm" });
    return (
      <select
        ref={ref}
        className={`${classes} ${className}`}
        style={{
          borderRadius: pill ? "9999px" : "0.5rem",
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          color: "#f8fafc",
          padding: "0.35rem 0.85rem",
          outline: "none",
          fontSize: "0.8rem",
          cursor: "pointer",
          ...style,
        }}
        {...props}
      />
    );
  }
);
Select.displayName = "Select";
