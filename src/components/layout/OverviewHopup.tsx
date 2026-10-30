"use client";

import React from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { extractDomain } from "@/utils/urlHelper";
import { X, Layers, Globe } from "lucide-react";

interface OverviewHopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OverviewHopup({ isOpen, onClose }: OverviewHopupProps) {
  const { rawSnapshot } = useSnapshotStore();

  if (!isOpen || !rawSnapshot) return null;

  const primaryWinId = Object.keys(rawSnapshot.windows)[0] || "1";
  const tabs = rawSnapshot.windows[primaryWinId]?.tabs || [];
  const panels = rawSnapshot.panels || {};

  // Count by panel
  const panelCounts = new Map<string, number>();
  for (const t of tabs) {
    const pId = t.panelId || "main";
    panelCounts.set(pId, (panelCounts.get(pId) || 0) + 1);
  }

  // Count top domains
  const domainCounts = new Map<string, number>();
  for (const t of tabs) {
    const d = extractDomain(t.url);
    if (d) {
      domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
    }
  }

  const sortedDomains = Array.from(domainCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const groupCount = tabs.filter((t) => t.isGroup).length;
  const pinnedCount = tabs.filter((t) => t.pinned).length;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content style={{ maxWidth: "680px", maxHeight: "85vh", overflowY: "auto", padding: "1.75rem" }}>
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <Dialog.Title>快照总览数据分析</Dialog.Title>
              <Dialog.Description>
                快照 ID: {rawSnapshot.id || "未命名"} · 共 {tabs.length.toLocaleString()} 个标签页
              </Dialog.Description>
            </div>
            <Dialog.CloseTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                pill
                onClick={onClose}
                style={{
                  width: "32px",
                  height: "32px",
                  padding: 0,
                  color: "var(--text-muted)",
                }}
                title="关闭"
              >
                <X size={16} />
              </Button>
            </Dialog.CloseTrigger>
          </div>

          {/* 4 Summary Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div style={{ backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", padding: "0.875rem", borderRadius: "0.875rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>总标签</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent)", marginTop: "0.25rem" }}>{tabs.length}</div>
            </div>
            <div style={{ backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", padding: "0.875rem", borderRadius: "0.875rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>面板数</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent)", marginTop: "0.25rem" }}>{panelCounts.size}</div>
            </div>
            <div style={{ backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", padding: "0.875rem", borderRadius: "0.875rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>已有 Group</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent)", marginTop: "0.25rem" }}>{groupCount}</div>
            </div>
            <div style={{ backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", padding: "0.875rem", borderRadius: "0.875rem", textAlign: "center" }}>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>固定标签</div>
              <div style={{ fontSize: "1.4rem", fontWeight: 700, color: "var(--accent)", marginTop: "0.25rem" }}>{pinnedCount}</div>
            </div>
          </div>

          {/* Panels Breakdown */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-main)" }}>
              <Layers size={16} style={{ color: "var(--accent)" }} />
              <span>面板分布</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
              {Array.from(panelCounts.entries()).map(([pId, count]) => {
                const pName = panels[pId]?.name || (pId === "main" ? "主面板" : pId);
                const pct = tabs.length > 0 ? ((count / tabs.length) * 100).toFixed(1) : "0";
                return (
                  <div key={pId}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.8rem", marginBottom: "0.25rem" }}>
                      <span style={{ color: "var(--text-main)" }}>{pName}</span>
                      <span style={{ color: "var(--text-muted)" }}>
                        {count} ({pct}%)
                      </span>
                    </div>
                    <div style={{ height: "6px", backgroundColor: "var(--bg-subtle)", border: "1px solid var(--border-subtle)", borderRadius: "9999px", overflow: "hidden" }}>
                      <div
                        style={{
                          height: "100%",
                          width: `${pct}%`,
                          backgroundColor: "var(--accent-solid)",
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
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", fontWeight: 600, marginBottom: "0.75rem", color: "var(--text-main)" }}>
              <Globe size={16} style={{ color: "var(--accent)" }} />
              <span>顶级域名分布 (Top 8)</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
              {sortedDomains.map(([domain, count]) => {
                const pct = tabs.length > 0 ? ((count / tabs.length) * 100).toFixed(1) : "0";
                return (
                  <div
                    key={domain}
                    style={{
                      backgroundColor: "var(--bg-subtle)",
                      border: "1px solid var(--border-subtle)",
                      padding: "0.6rem 0.75rem",
                      borderRadius: "0.75rem",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.8rem",
                    }}
                  >
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "180px", color: "var(--text-main)" }}>
                      {domain}
                    </span>
                    <span style={{ color: "var(--text-muted)", fontWeight: 600 }}>{count} ({pct}%)</span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Complete button */}
          <div style={{ marginTop: "1.75rem", display: "flex", justifyContent: "flex-end" }}>
            <Button
              variant="solid"
              size="sm"
              pill
              onClick={onClose}
            >
              完成
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
