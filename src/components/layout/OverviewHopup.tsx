"use client";

import React from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { extractDomain } from "@/utils/urlHelper";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, Layers, Globe, Pin, Folder } from "lucide-react";

interface OverviewHopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OverviewHopup({ isOpen, onClose }: OverviewHopupProps) {
  const { rawSnapshot } = useSnapshotStore();

  if (!rawSnapshot) return null;

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
    const dom = extractDomain(t.url);
    if (dom) {
      domainCounts.set(dom, (domainCounts.get(dom) || 0) + 1);
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
        <Dialog.Content
          style={{
            width: "100%",
            maxWidth: "680px",
            maxHeight: "85vh",
            overflowY: "auto",
            padding: "1.75rem",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <div>
              <Dialog.Title>快照总览数据分析</Dialog.Title>
              <Dialog.Description>
                快照 ID: {rawSnapshot.id || "未命名"} · 共 {tabs.length.toLocaleString()} 个标签页
              </Dialog.Description>
            </div>
            <Button
              variant="outline"
              size="xs"
              pill
              onClick={onClose}
              style={{
                width: "32px",
                height: "32px",
                padding: 0,
                backgroundColor: "#1e293b",
                borderColor: "#334155",
                color: "#9ca3af",
              }}
              title="关闭"
            >
              <X size={16} />
            </Button>
          </div>

          {/* Quick Metrics */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div style={{ padding: "0.85rem", borderRadius: "0.75rem", backgroundColor: "#1e293b", border: "1px solid #334155" }}>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>标签总数</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#38bdf8", marginTop: "0.2rem" }}>
                {tabs.length}
              </div>
            </div>

            <div style={{ padding: "0.85rem", borderRadius: "0.75rem", backgroundColor: "#1e293b", border: "1px solid #334155" }}>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>面板数</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f3f4f6", marginTop: "0.2rem" }}>
                {Object.keys(panels).length}
              </div>
            </div>

            <div style={{ padding: "0.85rem", borderRadius: "0.75rem", backgroundColor: "#1e293b", border: "1px solid #334155" }}>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>已有 Group 组</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f3f4f6", marginTop: "0.2rem" }}>
                {groupCount}
              </div>
            </div>

            <div style={{ padding: "0.85rem", borderRadius: "0.75rem", backgroundColor: "#1e293b", border: "1px solid #334155" }}>
              <div style={{ fontSize: "0.75rem", color: "#9ca3af" }}>固定常驻项</div>
              <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f3f4f6", marginTop: "0.2rem" }}>
                {pinnedCount}
              </div>
            </div>
          </div>

          {/* Panels Breakdown */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem" }}>
              <Layers size={16} color="#38bdf8" />
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>面板分布详情</h3>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
              {Object.entries(panels).map(([pId, p]: [string, any]) => {
                const count = panelCounts.get(pId) || 0;
                const percent = tabs.length > 0 ? Math.round((count / tabs.length) * 100) : 0;
                return (
                  <div
                    key={pId}
                    style={{
                      padding: "0.6rem 0.85rem",
                      borderRadius: "0.5rem",
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>{p.name || pId}</span>
                      <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>({count} 个标签)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", width: "120px" }}>
                      <div style={{ flex: 1, height: "6px", backgroundColor: "#0f172a", borderRadius: "9999px", overflow: "hidden" }}>
                        <div style={{ width: `${percent}%`, height: "100%", backgroundColor: "#38bdf8" }} />
                      </div>
                      <Badge variant="subtle" size="sm" style={{ width: "38px", justifyContent: "center" }}>
                        {percent}%
                      </Badge>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Top Domains */}
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.75rem" }}>
              <Globe size={16} color="#38bdf8" />
              <h3 style={{ fontSize: "0.95rem", fontWeight: 600 }}>高频域名 Top 8</h3>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
              {sortedDomains.map(([dom, count]) => (
                <div
                  key={dom}
                  style={{
                    padding: "0.5rem 0.75rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.8rem",
                  }}
                >
                  <span style={{ color: "#e5e7eb", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>
                    {dom}
                  </span>
                  <Badge variant="outline" size="sm">
                    {count} 个
                  </Badge>
                </div>
              ))}
            </div>
          </div>

          {/* Footer */}
          <div style={{ marginTop: "1.5rem", display: "flex", justifyContent: "flex-end" }}>
            <Button variant="solid" size="sm" onClick={onClose} style={{ backgroundColor: "#2563eb", color: "#fff" }}>
              完成查看
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
