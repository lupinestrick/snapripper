"use client";

import React from "react";
import { ReorganizationScheme } from "@/types/ai";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  FolderTree,
  PanelsTopLeft,
  Layers,
  ArrowRight,
  Globe,
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
        marginTop: "0.85rem",
        marginBottom: "0.85rem",
        borderRadius: "0.875rem",
        border: "1px solid var(--border-card)",
        backgroundColor: "var(--bg-card)",
        overflow: "hidden",
        boxShadow: "0 4px 12px rgba(0, 0, 0, 0.04)",
        transition: "border-color 0.2s, box-shadow 0.2s",
      }}
    >
      {/* Scheme Header */}
      <div
        style={{
          padding: "0.85rem 1.15rem",
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <div
            style={{
              padding: "0.3rem",
              borderRadius: "6px",
              backgroundColor: "var(--accent-subtle)",
              color: "var(--accent)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <Layers size={16} />
          </div>
          <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--text-main)" }}>
            {scheme.name}
          </h3>
        </div>

        {/* Tags */}
        <div style={{ display: "flex", gap: "0.35rem", flexWrap: "wrap" }}>
          {(scheme.tags || []).map((tag, idx) => (
            <Badge
              key={idx}
              variant="subtle"
              size="sm"
              style={{
                fontSize: "0.7rem",
                color: tag.includes("推荐") ? "var(--accent-text)" : "var(--text-muted)",
                backgroundColor: tag.includes("推荐") ? "var(--accent-subtle)" : undefined,
                borderColor: tag.includes("推荐") ? "var(--accent-border)" : undefined,
              }}
            >
              {tag}
            </Badge>
          ))}
        </div>
      </div>

      {/* Strategy Summary */}
      <div style={{ padding: "0.85rem 1.15rem", borderBottom: "1px solid var(--border-subtle)" }}>
        <p style={{ fontSize: "0.825rem", color: "var(--text-main)", lineHeight: 1.5 }}>
          <strong style={{ color: "var(--accent)" }}>💡 架构策略：</strong>
          {scheme.strategy}
        </p>
      </div>

      {/* Categories List */}
      <div style={{ padding: "0.85rem 1.15rem", backgroundColor: "var(--bg-card)" }}>
        <div
          style={{
            fontSize: "0.75rem",
            fontWeight: 600,
            color: "var(--text-muted)",
            marginBottom: "0.6rem",
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
          }}
        >
          <FolderTree size={13} />
          <span>规划的分类结构 ({scheme.categories.length} 个分类)：</span>
        </div>

        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
            gap: "0.6rem",
          }}
        >
          {scheme.categories.map((cat, idx) => (
            <div
              key={idx}
              style={{
                padding: "0.6rem 0.75rem",
                borderRadius: "0.5rem",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "0.35rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span
                  style={{
                    fontSize: "0.825rem",
                    fontWeight: 600,
                    color: "var(--text-main)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.35rem",
                  }}
                >
                  <span
                    style={{
                      width: "8px",
                      height: "8px",
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
                      fontSize: "0.65rem",
                      padding: "1px 5px",
                      borderRadius: "4px",
                      backgroundColor: "var(--accent-subtle)",
                      color: "var(--accent-text)",
                    }}
                    title="自动打包为 Sidebery 原生可折叠 Group 组"
                  >
                    折叠组
                  </span>
                )}
              </div>

              {cat.description && (
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.3 }}>
                  {cat.description}
                </p>
              )}

              {/* Matched Domains preview pills */}
              {cat.matchDomains && cat.matchDomains.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.15rem" }}>
                  {cat.matchDomains.slice(0, 4).map((dom, dIdx) => (
                    <span
                      key={dIdx}
                      style={{
                        fontSize: "0.65rem",
                        padding: "1px 4px",
                        borderRadius: "3px",
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-muted)",
                      }}
                    >
                      {dom}
                    </span>
                  ))}
                  {cat.matchDomains.length > 4 && (
                    <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", opacity: 0.8 }}>
                      +{cat.matchDomains.length - 4} 站点
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Pros & Cons */}
      {((scheme.pros && scheme.pros.length > 0) || (scheme.cons && scheme.cons.length > 0)) && (
        <div
          style={{
            padding: "0.6rem 1.15rem",
            backgroundColor: "var(--bg-subtle)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            flexDirection: "column",
            gap: "0.3rem",
            fontSize: "0.75rem",
          }}
        >
          {scheme.pros?.map((pro, pIdx) => (
            <div key={pIdx} style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--success)" }}>
              <CheckCircle2 size={12} style={{ flexShrink: 0 }} />
              <span>{pro}</span>
            </div>
          ))}
          {scheme.cons?.map((con, cIdx) => (
            <div key={cIdx} style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--text-muted)" }}>
              <AlertCircle size={12} style={{ flexShrink: 0 }} />
              <span>{con}</span>
            </div>
          ))}
        </div>
      )}

      {/* Actions Footer */}
      <div
        style={{
          padding: "0.75rem 1.15rem",
          backgroundColor: "var(--bg-surface)",
          borderTop: "1px solid var(--border-subtle)",
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "center",
          gap: "0.6rem",
        }}
      >
        <Button
          variant="outline"
          size="xs"
          pill
          onClick={() => onTweak(scheme)}
          title="将此方案填入输入框，通过自然语言进一步沟通修改"
        >
          <MessageSquare size={12} />
          <span>针对此方案微调</span>
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
          }}
        >
          {isApplying ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
          <span>{isApplying ? "正在生成差分..." : "应用此方案并生成 DIFF"}</span>
          <ArrowRight size={13} />
        </Button>
      </div>
    </div>
  );
}
