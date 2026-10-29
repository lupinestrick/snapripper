"use client";

import React from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { getDomain } from "@/utils/urlHelper";
import { X, Layers, Globe, Copy, CheckCircle } from "lucide-react";

interface OverviewHopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OverviewHopup({ isOpen, onClose }: OverviewHopupProps) {
  const { rawSnapshot } = useSnapshotStore();

  if (!isOpen || !rawSnapshot) return null;

  const winKeys = Object.keys(rawSnapshot.windows);
  const primaryWinId = winKeys[0] || "1";
  const tabs = rawSnapshot.windows[primaryWinId]?.tabs || [];
  const panels = rawSnapshot.panels || {};

  // Compute panel stats
  const panelCounts = new Map<string, number>();
  for (const t of tabs) {
    const pId = t.panelId || "main";
    panelCounts.set(pId, (panelCounts.get(pId) || 0) + 1);
  }

  // Compute domain stats
  const domainCounts = new Map<string, number>();
  for (const t of tabs) {
    if (!t.url) continue;
    const dom = getDomain(t.url);
    if (dom) {
      domainCounts.set(dom, (domainCounts.get(dom) || 0) + 1);
    }
  }

  const sortedDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  // Groups and Pinned counts
  const groupCount = tabs.filter((t) => t.isGroup).length;
  const pinnedCount = tabs.filter((t) => t.pinned).length;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.65)",
        backdropFilter: "blur(6px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "680px",
          maxHeight: "85vh",
          overflowY: "auto",
          backgroundColor: "#111827",
          border: "1px solid #1f2937",
          borderRadius: "1.25rem",
          padding: "1.75rem",
          color: "#f3f4f6",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.7)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
          <div>
            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.02em" }}>快照总览数据</h2>
            <p style={{ fontSize: "0.8rem", color: "#9ca3af", marginTop: "0.25rem" }}>
              快照 ID: {rawSnapshot.id || "未命名"} · 共 {tabs.length} 个标签页
            </p>
          </div>
          <button
            onClick={onClose}
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "9999px",
              border: "1px solid #374151",
              backgroundColor: "#1f2937",
              color: "#9ca3af",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* 4 Summary Pills */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
          <div style={{ backgroundColor: "#1f2937", padding: "0.875rem", borderRadius: "0.875rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>总标签</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#38bdf8", marginTop: "0.25rem" }}>{tabs.length}</div>
          </div>
          <div style={{ backgroundColor: "#1f2937", padding: "0.875rem", borderRadius: "0.875rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>面板数</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#10b981", marginTop: "0.25rem" }}>{panelCounts.size}</div>
          </div>
          <div style={{ backgroundColor: "#1f2937", padding: "0.875rem", borderRadius: "0.875rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>已有 Group</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#f59e0b", marginTop: "0.25rem" }}>{groupCount}</div>
          </div>
          <div style={{ backgroundColor: "#1f2937", padding: "0.875rem", borderRadius: "0.875rem", textAlign: "center" }}>
            <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>固定标签</div>
            <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "#a855f7", marginTop: "0.25rem" }}>{pinnedCount}</div>
          </div>
        </div>

        {/* Panels Breakdown */}
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem", color: "#e5e7eb" }}>
            <Layers size={16} color="#38bdf8" />
            <span>面板分布</span>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
            {Array.from(panelCounts.entries()).map(([pId, count]) => {
              const pName = panels[pId]?.name || (pId === "main" ? "主面板" : pId);
              const pct = tabs.length > 0 ? ((count / tabs.length) * 100).toFixed(1) : "0";
              return (
                <div key={pId}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                    <span style={{ color: "#d1d5db" }}>{pName}</span>
                    <span style={{ color: "#9ca3af" }}>
                      {count} ({pct}%)
                    </span>
                  </div>
                  <div style={{ height: "6px", backgroundColor: "#374151", borderRadius: "9999px", overflow: "hidden" }}>
                    <div
                      style={{
                        height: "100%",
                        width: `${pct}%`,
                        backgroundColor: "#38bdf8",
                        borderRadius: "9999px",
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Top Domains */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem", color: "#e5e7eb" }}>
            <Globe size={16} color="#10b981" />
            <span>顶级域名分布 (Top 8)</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
            {sortedDomains.map(([domain, count]) => {
              const pct = tabs.length > 0 ? ((count / tabs.length) * 100).toFixed(1) : "0";
              return (
                <div
                  key={domain}
                  style={{
                    backgroundColor: "#1f2937",
                    padding: "0.6rem 0.75rem",
                    borderRadius: "0.75rem",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.8rem",
                  }}
                >
                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px", color: "#e5e7eb" }}>
                    {domain}
                  </span>
                  <span style={{ color: "#9ca3af", fontWeight: 600 }}>{count} ({pct}%)</span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Close button */}
        <div style={{ marginTop: "1.75rem", display: "flex", justifyContent: "flex-end" }}>
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem 1.5rem",
              borderRadius: "9999px",
              backgroundColor: "#2563eb",
              border: "none",
              color: "#ffffff",
              fontSize: "0.875rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            完成
          </button>
        </div>
      </div>
    </div>
  );
}
