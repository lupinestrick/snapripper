"use client";

import React from "react";
import { ReorganizationScheme } from "@/types/ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  MessageSquare,
  CheckCircle2,
  FolderTree,
  ArrowRight,
  Loader2,
} from "lucide-react";

interface SchemeCardProps {
  scheme: ReorganizationScheme;
  isApplying?: boolean;
  onApply: (scheme: ReorganizationScheme) => void;
  onTweak: (scheme: ReorganizationScheme) => void;
}

export function SchemeCard({ scheme, isApplying, onApply, onTweak }: SchemeCardProps) {
  return (
    <div
      style={{
        marginTop: "0.75rem",
        marginBottom: "0.75rem",
        borderRadius: "0.875rem",
        border: "1px solid var(--border-card)",
        backgroundColor: "var(--bg-surface)",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.04)",
        transition: "border-color 0.15s, box-shadow 0.15s",
      }}
    >
      {/* Header */}
      <div
        style={{
          padding: "0.75rem 1rem",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "0.5rem",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <h4 style={{ fontSize: "0.925rem", fontWeight: 700, color: "var(--text-main)" }}>
            {scheme.name}
          </h4>
          {(scheme.tags || []).slice(0, 2).map((tag, idx) => (
            <Badge
              key={idx}
              variant="subtle"
              size="sm"
              style={{
                fontSize: "0.68rem",
                color: tag.includes("推荐") ? "var(--accent-text)" : "var(--text-muted)",
                backgroundColor: tag.includes("推荐") ? "var(--accent-subtle)" : undefined,
              }}
            >
              {tag}
            </Badge>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Button
            variant="ghost"
            size="xs"
            pill
            onClick={() => onTweak(scheme)}
            title="以此方案为基础在聊天中调整"
            style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}
          >
            <MessageSquare size={12} />
            <span>微调</span>
          </Button>

          <Button
            variant="solid"
            size="xs"
            pill
            onClick={() => onApply(scheme)}
            disabled={isApplying}
            style={{
              backgroundColor: "var(--accent-solid)",
              color: "#fff",
              fontWeight: 600,
              fontSize: "0.72rem",
            }}
          >
            {isApplying ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
            <span>{isApplying ? "生成差分中..." : "应用并预览 DIFF"}</span>
            <ArrowRight size={12} />
          </Button>
        </div>
      </div>

      {/* Body: Strategy + Categories */}
      <div style={{ padding: "0.75rem 1rem" }}>
        <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.65rem", lineHeight: 1.4 }}>
          {scheme.strategy}
        </p>

        {/* Categories Chips Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
            gap: "0.45rem",
          }}
        >
          {scheme.categories.map((cat, idx) => (
            <div
              key={idx}
              style={{
                padding: "0.45rem 0.65rem",
                borderRadius: "0.5rem",
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "0.2rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                >
                  <span
                    style={{
                      width: "7px",
                      height: "7px",
                      borderRadius: "50%",
                      backgroundColor: cat.color || "#38bdf8",
                      flexShrink: 0,
                    }}
                  />
                  <span>{cat.name}</span>
                </span>

                {cat.createGroup && (
                  <span
                    style={{
                      fontSize: "0.62rem",
                      padding: "1px 4px",
                      borderRadius: "3px",
                      backgroundColor: "var(--accent-subtle)",
                      color: "var(--accent-text)",
                    }}
                  >
                    折叠组
                  </span>
                )}
              </div>

              {cat.matchDomains && cat.matchDomains.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.2rem" }}>
                  {cat.matchDomains.slice(0, 3).map((dom, dIdx) => (
                    <span
                      key={dIdx}
                      style={{
                        fontSize: "0.63rem",
                        padding: "1px 4px",
                        borderRadius: "3px",
                        backgroundColor: "var(--bg-subtle)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {dom}
                    </span>
                  ))}
                  {cat.matchDomains.length > 3 && (
                    <span style={{ fontSize: "0.62rem", color: "var(--text-muted)" }}>
                      +{cat.matchDomains.length - 3}
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
