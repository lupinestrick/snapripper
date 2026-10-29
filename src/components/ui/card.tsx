import React from "react";
import { card } from "@/../styled-system/recipes";

export const Card = {
  Root: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className = "", style, ...props }, ref) => {
      const classes = card();
      return (
        <div
          ref={ref}
          className={`${classes.root} ${className}`}
          style={{
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            borderRadius: "1rem",
            padding: "1.25rem",
            ...style,
          }}
          {...props}
        />
      );
    }
  ),
  Header: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className = "", style, ...props }, ref) => {
      const classes = card();
      return (
        <div
          ref={ref}
          className={`${classes.header} ${className}`}
          style={{ marginBottom: "1rem", ...style }}
          {...props}
        />
      );
    }
  ),
  Title: React.forwardRef<HTMLHeadingElement, React.HTMLAttributes<HTMLHeadingElement>>(
    ({ className = "", style, ...props }, ref) => {
      const classes = card();
      return (
        <h3
          ref={ref}
          className={`${classes.title} ${className}`}
          style={{ fontSize: "1rem", fontWeight: 600, color: "#f8fafc", ...style }}
          {...props}
        />
      );
    }
  ),
  Description: React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLParagraphElement>>(
    ({ className = "", style, ...props }, ref) => {
      const classes = card();
      return (
        <p
          ref={ref}
          className={`${classes.description} ${className}`}
          style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.25rem", ...style }}
          {...props}
        />
      );
    }
  ),
  Body: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className = "", style, ...props }, ref) => {
      const classes = card();
      return <div ref={ref} className={`${classes.body} ${className}`} style={style} {...props} />;
    }
  ),
  Footer: React.forwardRef<HTMLDivElement, React.HTMLAttributes<HTMLDivElement>>(
    ({ className = "", style, ...props }, ref) => {
      const classes = card();
      return (
        <div
          ref={ref}
          className={`${classes.footer} ${className}`}
          style={{ marginTop: "1.25rem", display: "flex", justifyContent: "flex-end", gap: "0.5rem", ...style }}
          {...props}
        />
      );
    }
  ),
};
