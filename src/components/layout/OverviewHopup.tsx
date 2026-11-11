"use client";

import React from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { extractDomain } from "@/utils/urlHelper";
import { matchTabWithRule } from "@/services/ruleEngine";
import { X, Layers, Globe, BarChart3, Sparkles } from "lucide-react";

interface OverviewHopupProps {
  isOpen: boolean;
  onClose: () => void;
}

export function OverviewHopup({ isOpen, onClose }: OverviewHopupProps) {
  const { rawSnapshot, aiProcessedCache, proportionReport } = useSnapshotStore();
  const { rulesSettings } = useConfigStore();

  if (!isOpen) return null;

  if (!rawSnapshot) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Backdrop />
        <Dialog.Positioner>
          <Dialog.Content style={{ maxWidth: "480px", padding: "2rem", textAlign: "center" }}>
            <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: "0.5rem" }}>
              <Button
                variant="ghost"
                size="xs"
                pill
                onClick={onClose}
                style={{ width: "32px", height: "32px", padding: 0, color: "var(--text-muted)" }}
                title="关闭"
              >
                <X size={16} />
              </Button>
            </div>
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "var(--accent-subtle)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem",
              }}
            >
              <BarChart3 size={24} />
            </div>
            <Dialog.Title style={{ fontSize: "1.1rem", fontWeight: 700 }}>暂未载入快照数据</Dialog.Title>
            <Dialog.Description style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "var(--text-muted)", lineHeight: 1.5 }}>
              请先在工作台拖入或载入 Sidebery 快照 JSON 文件，即可在此查看完整的标签统计分布、面板结构与分类比例分析。
            </Dialog.Description>
            <div style={{ marginTop: "1.5rem" }}>
              <Button variant="solid" size="sm" pill onClick={onClose}>
                知道了
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    );
  }

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

  // Classification breakdown calculation
  interface BreakdownItem {
    name: string;
    count: number;
    pct: string;
    pctNum: number;
    color: string;
  }

  const PRESET_COLORS = [
    "#3b82f6", "#10b981", "#ef4444", "#06b6d4",
    "#8b5cf6", "#f59e0b", "#ec4899", "#64748b", "#f97316"
  ];

  let breakdownBadge = "";
  let categorizedList: BreakdownItem[] = [];
  let uncategorizedItem: BreakdownItem | null = null;

  if (aiProcessedCache) {
    breakdownBadge = "AI 归类缓存";
    const total = tabs.length;
    categorizedList = aiProcessedCache.categoryNames.map((name, i) => {
      const cnt = aiProcessedCache.summary.categoryCounts[name] || 0;
      const pctNum = total > 0 ? (cnt / total) * 100 : 0;
      return {
        name,
        count: cnt,
        pct: pctNum.toFixed(1),
        pctNum,
        color: PRESET_COLORS[i % PRESET_COLORS.length],
      };
    }).filter((it) => it.count > 0);

    const uncatCount = aiProcessedCache.summary.uncategorizedCount;
    const uncatPct = total > 0 ? (uncatCount / total) * 100 : 0;
    uncategorizedItem = {
      name: "未分类 (Uncategorized)",
      count: uncatCount,
      pct: uncatPct.toFixed(1),
      pctNum: uncatPct,
      color: "#94a3b8",
    };
  } else if (proportionReport && proportionReport.categories.length > 0) {
    breakdownBadge = "AI 比例分析预测";
    const total = tabs.length;
    categorizedList = proportionReport.categories.map((c, i) => {
      const estimatedCount = Math.round((c.ratio / 100) * proportionReport.totalAnalyzed);
      const pctNum = total > 0 ? (estimatedCount / total) * 100 : c.ratio;
      return {
        name: c.name,
        count: estimatedCount,
        pct: pctNum.toFixed(1),
        pctNum,
        color: c.color || PRESET_COLORS[i % PRESET_COLORS.length],
      };
    });
    const categorizedTotal = categorizedList.reduce((acc, it) => acc + it.count, 0);
    const uncatCount = Math.max(0, total - categorizedTotal);
    const uncatPct = total > 0 ? (uncatCount / total) * 100 : 0;
    uncategorizedItem = {
      name: "未分类 / 豁免保护",
      count: uncatCount,
      pct: uncatPct.toFixed(1),
      pctNum: uncatPct,
      color: "#94a3b8",
    };
  } else {
    const activeRules = (rulesSettings?.rules || []).filter((r) => r.enabled);
    if (activeRules.length > 0) {
      breakdownBadge = "规则引擎匹配";
      const ruleCounts = new Map<string, number>();
      let matchedTotal = 0;

      for (const t of tabs) {
        if (t.pinned || t.url?.startsWith("about:")) continue;
        for (const rule of activeRules) {
          if (matchTabWithRule(t, rule)) {
            ruleCounts.set(rule.name, (ruleCounts.get(rule.name) || 0) + 1);
            matchedTotal++;
            break;
          }
        }
      }

      categorizedList = activeRules.map((rule, i) => {
        const cnt = ruleCounts.get(rule.name) || 0;
        const pctNum = tabs.length > 0 ? (cnt / tabs.length) * 100 : 0;
        return {
          name: rule.name,
          count: cnt,
          pct: pctNum.toFixed(1),
          pctNum,
          color: rule.color || PRESET_COLORS[i % PRESET_COLORS.length],
        };
      }).filter((it) => it.count > 0);

      const uncatCount = Math.max(0, tabs.length - matchedTotal);
      const uncatPct = tabs.length > 0 ? (uncatCount / tabs.length) * 100 : 0;
      uncategorizedItem = {
        name: "未分类 (未匹配既有规则)",
        count: uncatCount,
        pct: uncatPct.toFixed(1),
        pctNum: uncatPct,
        color: "#94a3b8",
      };
    }
  }

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

          {/* Classification Breakdown (AI or Rules + Uncategorized) */}
          <div style={{ marginBottom: "1.5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)" }}>
                <Sparkles size={16} style={{ color: "var(--accent)" }} />
                <span>分类比例分布与未分类</span>
              </div>
              {breakdownBadge && (
                <Badge variant="subtle" size="sm" style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent-text)", fontSize: "0.72rem" }}>
                  来源: {breakdownBadge}
                </Badge>
              )}
            </div>

            {categorizedList.length > 0 || (uncategorizedItem && uncategorizedItem.count > 0) ? (
              <div>
                {/* Segmented bar */}
                <div
                  style={{
                    height: "10px",
                    borderRadius: "9999px",
                    overflow: "hidden",
                    display: "flex",
                    backgroundColor: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    marginBottom: "0.75rem",
                  }}
                >
                  {categorizedList.map((item) => (
                    <div
                      key={item.name}
                      title={`${item.name}: ${item.count} (${item.pct}%)`}
                      style={{
                        width: `${item.pctNum}%`,
                        backgroundColor: item.color,
                        height: "100%",
                      }}
                    />
                  ))}
                  {uncategorizedItem && uncategorizedItem.count > 0 && (
                    <div
                      title={`${uncategorizedItem.name}: ${uncategorizedItem.count} (${uncategorizedItem.pct}%)`}
                      style={{
                        width: `${uncategorizedItem.pctNum}%`,
                        backgroundColor: uncategorizedItem.color,
                        height: "100%",
                      }}
                    />
                  )}
                </div>

                {/* Items grid */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
                  {categorizedList.map((item) => (
                    <div
                      key={item.name}
                      style={{
                        backgroundColor: "var(--bg-subtle)",
                        border: "1px solid var(--border-subtle)",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.5rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: item.color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-main)" }}>
                          {item.name}
                        </span>
                      </div>
                      <span style={{ color: "var(--text-muted)", fontWeight: 600, flexShrink: 0, marginLeft: "0.5rem" }}>
                        {item.count} ({item.pct}%)
                      </span>
                    </div>
                  ))}

                  {/* Explicit Uncategorized item */}
                  {uncategorizedItem && (
                    <div
                      style={{
                        backgroundColor: "var(--bg-subtle)",
                        border: "1px dashed var(--border-subtle)",
                        padding: "0.5rem 0.75rem",
                        borderRadius: "0.5rem",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        fontSize: "0.8rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            backgroundColor: uncategorizedItem.color,
                            flexShrink: 0,
                          }}
                        />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--text-muted)", fontWeight: 500 }}>
                          {uncategorizedItem.name}
                        </span>
                      </div>
                      <span style={{ color: "var(--text-muted)", fontWeight: 600, flexShrink: 0, marginLeft: "0.5rem" }}>
                        {uncategorizedItem.count} ({uncategorizedItem.pct}%)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div
                style={{
                  padding: "0.85rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--bg-subtle)",
                  border: "1px dashed var(--border-subtle)",
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  textAlign: "center",
                }}
              >
                尚未进行 AI 分类或规则匹配。前往「AI 比例」分析后，将自动在此展示精确的类别与未分类比例。
              </div>
            )}
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
