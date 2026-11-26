"use client";

import React, { useMemo, useState } from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { flattenTabTree, isGroupTab } from "@/services/snapshotParser";
import { previewRulesOnTabs } from "@/services/ruleEngine";
import { clusterSnapshotTabs } from "@/services/tabClusterEngine";
import { extractDomain, isExemptUrl } from "@/utils/urlHelper";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  BarChart3,
  Globe,
  Layers,
  Sparkles,
  CopyCheck,
  SlidersHorizontal,
  ArrowRight,
  FolderTree,
  Shield,
} from "lucide-react";

interface OverviewHopupProps {
  isOpen: boolean;
  onClose: () => void;
}

type OverviewTab = "overview" | "domains" | "rules_clusters";

export function OverviewHopup({ isOpen, onClose }: OverviewHopupProps) {
  const {
    rawSnapshot,
    rootNodes,
    duplicateUrls,
    setActivePanelId,
    setSearchQuery,
    setContainerFilter,
    setOnlyDuplicates,
  } = useSnapshotStore();
  const { rulesSettings, setActivePage } = useConfigStore();
  const rules = rulesSettings?.rules || [];
  const [activeTab, setActiveTab] = useState<OverviewTab>("overview");

  const analytics = useMemo(() => {
    if (!rawSnapshot) return null;

    const allTabs = flattenTabTree(rootNodes);
    const panels = rawSnapshot.panels || {};
    const panelEntriesList = Object.values(panels) as any[];

    const panelCounts = new Map<string, number>();
    const domainCounts = new Map<string, number>();
    const containerCounts = new Map<string, number>();

    let groupCount = 0;
    let pinnedCount = 0;
    let exemptCount = 0;
    let duplicateTabCount = 0;

    for (const t of allTabs) {
      const pId = t.panelId || "main";
      panelCounts.set(pId, (panelCounts.get(pId) || 0) + 1);

      if (isGroupTab(t)) groupCount++;
      if (t.pinned) pinnedCount++;
      if (isExemptUrl(t.url, t.pinned)) exemptCount++;
      if (duplicateUrls.has(t.url)) duplicateTabCount++;

      const d = extractDomain(t.url);
      if (d) {
        domainCounts.set(d, (domainCounts.get(d) || 0) + 1);
      }

      const cId = t.containerId || "firefox-default";
      containerCounts.set(cId, (containerCounts.get(cId) || 0) + 1);
    }

    const panelRows = panelEntriesList.map((p) => {
      const count = panelCounts.get(p.id) || 0;
      const pct = allTabs.length > 0 ? Math.round((count / allTabs.length) * 100) : 0;
      return {
        id: p.id,
        name: p.name || p.id,
        count,
        pct,
      };
    });

    const emptyPanels = panelRows.filter((p) => p.count === 0);

    const topDomains = Array.from(domainCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 12)
      .map(([domain, count]) => ({
        domain,
        count,
        pct: allTabs.length > 0 ? ((count / allTabs.length) * 100).toFixed(1) : "0",
      }));

    const containersMap = (rawSnapshot.containers || {}) as Record<string, any>;
    const containerRows = Array.from(containerCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .map(([id, count]) => {
        const meta = containersMap[id];
        return {
          id,
          name: meta?.name || (id === "firefox-default" ? "默认容器" : id),
          count,
          pct: allTabs.length > 0 ? Math.round((count / allTabs.length) * 100) : 0,
        };
      });

    const clusterReport = clusterSnapshotTabs(allTabs, panels, "balanced");

    const ruleStatsMap = previewRulesOnTabs(allTabs, rules);
    let ruleMatchedTotal = 0;
    const ruleHits = rules
      .map((r) => {
        const st = ruleStatsMap.get(r.id);
        const hits = st?.effectiveHits || 0;
        const shadowed = st?.shadowedHits || 0;
        ruleMatchedTotal += hits;
        return {
          id: r.id,
          name: r.name,
          enabled: r.enabled,
          hits,
          shadowed,
        };
      })
      .filter((r) => r.hits > 0 || r.shadowed > 0)
      .sort((a, b) => b.hits - a.hits);

    const ruleEligibleCount = clusterReport.nonExemptCount;
    const ruleCoveragePct =
      ruleEligibleCount > 0 ? Math.min(100, Math.round((ruleMatchedTotal / ruleEligibleCount) * 100)) : 0;

    return {
      totalTabs: allTabs.length,
      panelCount: panelEntriesList.length,
      groupCount,
      pinnedCount,
      exemptCount,
      duplicateTabCount,
      emptyPanels,
      panelRows,
      topDomains,
      containerRows,
      clusterReport,
      ruleMatchedTotal,
      ruleEligibleCount,
      ruleCoveragePct,
      ruleHits,
    };
  }, [rawSnapshot, rootNodes, duplicateUrls, rules]);

  if (!isOpen) return null;

  const jumpToWorkbench = (opts: {
    panelId?: string | null;
    query?: string;
    container?: string | null;
    onlyDup?: boolean;
  }) => {
    setActivePanelId(opts.panelId ?? null);
    setSearchQuery(opts.query ?? "");
    setContainerFilter(opts.container ?? null);
    setOnlyDuplicates(Boolean(opts.onlyDup));
    setActivePage("workbench");
    onClose();
  };

  if (!rawSnapshot || !analytics) {
    return (
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Backdrop style={{ zIndex: 110 }} />
        <Dialog.Positioner style={{ zIndex: 120 }}>
          <Dialog.Content
            style={{
              maxWidth: "420px",
              width: "92vw",
              padding: "1.5rem",
              textAlign: "center",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              borderRadius: "1rem",
              color: "var(--text-main)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <Button variant="ghost" size="xs" pill onClick={onClose} style={{ padding: "4px" }}>
                <X size={15} />
              </Button>
            </div>
            <BarChart3 size={28} style={{ color: "var(--accent)", margin: "0.25rem auto 0.75rem" }} />
            <Dialog.Title style={{ fontSize: "1rem", fontWeight: 700 }}>暂无快照数据</Dialog.Title>
            <Dialog.Description style={{ marginTop: "0.4rem", fontSize: "0.8rem", color: "var(--text-muted)" }}>
              请先导入 Sidebery 快照 JSON 文件。
            </Dialog.Description>
            <div style={{ marginTop: "1.1rem" }}>
              <Button variant="solid" size="xs" pill onClick={onClose}>
                关闭
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
    );
  }

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 110 }} />
      <Dialog.Positioner style={{ zIndex: 120 }}>
        <Dialog.Content
          style={{
            maxWidth: "760px",
            width: "94vw",
            maxHeight: "86vh",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 44px rgba(0,0,0,0.4)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.8rem 1.2rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <BarChart3 size={16} style={{ color: "var(--accent)" }} />
              <Dialog.Title style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                快照多维分析
              </Dialog.Title>
              <Badge variant="subtle" size="sm" style={{ fontSize: "0.68rem" }}>
                {analytics.totalTabs} 标签 · {analytics.panelCount} 面板
              </Badge>
            </div>

            <Dialog.CloseTrigger asChild>
              <Button variant="ghost" size="xs" pill onClick={onClose} style={{ padding: "4px" }}>
                <X size={15} />
              </Button>
            </Dialog.CloseTrigger>
          </div>

          {/* Segmented Tabs */}
          <div
            style={{
              padding: "0.55rem 1.2rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              gap: "0.4rem",
            }}
          >
            {(
              [
                { id: "overview", label: "概览与健康", icon: <Layers size={13} /> },
                { id: "domains", label: "域名与容器", icon: <Globe size={13} /> },
                { id: "rules_clusters", label: "规则与聚类", icon: <SlidersHorizontal size={13} /> },
              ] as const
            ).map((t) => (
              <Button
                key={t.id}
                type="button"
                variant={activeTab === t.id ? "subtle" : "ghost"}
                size="xs"
                pill
                onClick={() => setActiveTab(t.id)}
              >
                {t.icon}
                <span>{t.label}</span>
              </Button>
            ))}
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.05rem 1.2rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {activeTab === "overview" && (
              <>
                {/* 4 KPI Cards */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(145px, 1fr))", gap: "0.6rem" }}>
                  <div
                    style={{
                      padding: "0.7rem 0.85rem",
                      borderRadius: "0.65rem",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>可整理 / 总标签</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, marginTop: "0.15rem" }}>
                      {analytics.clusterReport.nonExemptCount}{" "}
                      <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)" }}>
                        / {analytics.totalTabs}
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() =>
                      analytics.duplicateTabCount > 0 && jumpToWorkbench({ onlyDup: true })
                    }
                    style={{
                      padding: "0.7rem 0.85rem",
                      borderRadius: "0.65rem",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid",
                      borderColor: analytics.duplicateTabCount > 0 ? "rgba(245, 158, 11, 0.4)" : "var(--border-subtle)",
                      textAlign: "left",
                      cursor: analytics.duplicateTabCount > 0 ? "pointer" : "default",
                      color: "var(--text-main)",
                    }}
                    title={analytics.duplicateTabCount > 0 ? "点击前往工作台筛选重复标签" : undefined}
                  >
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>重复 URL 标签</div>
                    <div
                      style={{
                        fontSize: "1.15rem",
                        fontWeight: 700,
                        marginTop: "0.15rem",
                        color: analytics.duplicateTabCount > 0 ? "#f59e0b" : "var(--text-main)",
                      }}
                    >
                      {analytics.duplicateTabCount}
                    </div>
                  </button>

                  <div
                    style={{
                      padding: "0.7rem 0.85rem",
                      borderRadius: "0.65rem",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>原生 Group 组</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, marginTop: "0.15rem" }}>
                      {analytics.groupCount}
                    </div>
                  </div>

                  <div
                    style={{
                      padding: "0.7rem 0.85rem",
                      borderRadius: "0.65rem",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>固定 / 内部豁免</div>
                    <div style={{ fontSize: "1.15rem", fontWeight: 700, marginTop: "0.15rem" }}>
                      {analytics.pinnedCount}{" "}
                      <span style={{ fontSize: "0.75rem", fontWeight: 500, color: "var(--text-muted)" }}>
                        / {analytics.exemptCount}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Health Check Strip */}
                {(analytics.duplicateTabCount > 0 || analytics.emptyPanels.length > 0) && (
                  <div
                    style={{
                      padding: "0.65rem 0.85rem",
                      borderRadius: "0.65rem",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", fontSize: "0.76rem", flexWrap: "wrap" }}>
                      {analytics.duplicateTabCount > 0 && (
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "0.3rem", color: "#f59e0b" }}>
                          <CopyCheck size={13} />
                          <span>{analytics.duplicateTabCount} 个重复标签待清理</span>
                        </span>
                      )}
                      {analytics.emptyPanels.length > 0 && (
                        <span style={{ color: "var(--text-muted)" }}>
                          · {analytics.emptyPanels.length} 个空面板
                        </span>
                      )}
                    </div>

                    {analytics.duplicateTabCount > 0 && (
                      <Button
                        variant="outline"
                        size="xs"
                        pill
                        onClick={() => {
                          setActivePage("process");
                          onClose();
                        }}
                      >
                        <span>前往处理中心去重</span>
                        <ArrowRight size={12} />
                      </Button>
                    )}
                  </div>
                )}

                {/* Panel Load Distribution (Clickable) */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>面板负载分布</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>点击面板跳转工作台</span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                    {analytics.panelRows.map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => jumpToWorkbench({ panelId: p.id })}
                        style={{
                          width: "100%",
                          padding: "0.45rem 0.65rem",
                          borderRadius: "0.55rem",
                          border: "1px solid var(--border-subtle)",
                          backgroundColor: "var(--bg-surface)",
                          color: "var(--text-main)",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "0.3rem",
                          textAlign: "left",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.76rem", width: "100%" }}>
                          <span style={{ fontWeight: 500 }}>{p.name}</span>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}>
                            {p.count} ({p.pct}%)
                          </span>
                        </div>
                        <div
                          style={{
                            width: "100%",
                            height: "5px",
                            borderRadius: "9999px",
                            backgroundColor: "var(--bg-card)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            style={{
                              width: `${Math.max(p.count > 0 ? 2 : 0, p.pct)}%`,
                              height: "100%",
                              backgroundColor: "var(--accent-solid)",
                              borderRadius: "9999px",
                            }}
                          />
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === "domains" && (
              <>
                {/* Top Domains */}
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.45rem" }}>
                    <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>Top 12 高频域名</span>
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>点击域名筛选</span>
                  </div>
                  {analytics.topDomains.length === 0 ? (
                    <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>暂无有效域名数据</div>
                  ) : (
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.4rem" }}>
                      {analytics.topDomains.map((d) => (
                        <button
                          key={d.domain}
                          type="button"
                          onClick={() => jumpToWorkbench({ query: d.domain })}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                            padding: "0.45rem 0.65rem",
                            borderRadius: "0.55rem",
                            border: "1px solid var(--border-subtle)",
                            backgroundColor: "var(--bg-surface)",
                            color: "var(--text-main)",
                            fontSize: "0.75rem",
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", fontWeight: 500 }}>
                            {d.domain}
                          </span>
                          <span style={{ color: "var(--accent-text)", fontWeight: 600, flexShrink: 0 }}>
                            {d.count} <span style={{ color: "var(--text-muted)", fontWeight: 400 }}>({d.pct}%)</span>
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                {/* Container Breakdown */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.45rem" }}>
                    <Shield size={13} style={{ color: "var(--accent)" }} />
                    <span>容器分布</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {analytics.containerRows.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => jumpToWorkbench({ container: c.id })}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.4rem",
                          padding: "0.35rem 0.7rem",
                          borderRadius: "9999px",
                          border: "1px solid var(--border-subtle)",
                          backgroundColor: "var(--bg-surface)",
                          color: "var(--text-main)",
                          fontSize: "0.74rem",
                          cursor: "pointer",
                        }}
                      >
                        <span>{c.name}</span>
                        <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>
                          {c.count} ({c.pct}%)
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Tree Depth Distribution */}
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.45rem" }}>
                    <FolderTree size={13} style={{ color: "var(--accent)" }} />
                    <span>树状嵌套深度分布</span>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                    {Object.entries(analytics.clusterReport.treeDepthDistribution)
                      .sort((a, b) => Number(a[0]) - Number(b[0]))
                      .map(([depth, count]) => (
                        <div
                          key={depth}
                          style={{
                            padding: "0.35rem 0.7rem",
                            borderRadius: "0.5rem",
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-subtle)",
                            fontSize: "0.74rem",
                          }}
                        >
                          <span style={{ color: "var(--text-muted)" }}>第 {depth} 层：</span>
                          <strong>{count}</strong>
                        </div>
                      ))}
                  </div>
                </div>
              </>
            )}

            {activeTab === "rules_clusters" && (
              <>
                {/* Rule DSL Coverage */}
                <div
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: "0.7rem",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                        规则引擎实时覆盖率：{analytics.ruleCoveragePct}%
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                        {analytics.ruleMatchedTotal} / {analytics.ruleEligibleCount} 可整理标签已被现有 {rules.length} 条规则命中
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="xs"
                      pill
                      onClick={() => {
                        setActivePage("rules");
                        onClose();
                      }}
                    >
                      <span>管理规则</span>
                      <ArrowRight size={12} />
                    </Button>
                  </div>

                  <div
                    style={{
                      width: "100%",
                      height: "6px",
                      borderRadius: "9999px",
                      backgroundColor: "var(--bg-card)",
                      overflow: "hidden",
                    }}
                  >
                    <div
                      style={{
                        width: `${analytics.ruleCoveragePct}%`,
                        height: "100%",
                        backgroundColor: analytics.ruleCoveragePct >= 60 ? "var(--success, #10b981)" : "var(--accent-solid)",
                      }}
                    />
                  </div>

                  {analytics.ruleHits.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.15rem" }}>
                      {analytics.ruleHits.slice(0, 8).map((rh) => (
                        <span
                          key={rh.id}
                          style={{
                            fontSize: "0.7rem",
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            backgroundColor: "var(--bg-card)",
                            border: "1px solid var(--border-subtle)",
                          }}
                        >
                          {rh.name}: <strong>{rh.hits}</strong>
                          {rh.shadowed > 0 && (
                            <span style={{ color: "#f59e0b", marginLeft: "4px" }}>
                              (冲突 {rh.shadowed})
                            </span>
                          )}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {/* Micro-Cluster Preview */}
                <div
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: "0.7rem",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.6rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                    <div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                        本地微簇聚类：{analytics.clusterReport.clusters.length} 簇
                      </div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginTop: "0.1rem" }}>
                        压缩率 {analytics.clusterReport.compressionRatio}% · 100% 覆盖非豁免标签
                      </div>
                    </div>
                    <Button
                      variant="solid"
                      size="xs"
                      pill
                      onClick={() => {
                        setActivePage("ai");
                        onClose();
                      }}
                    >
                      <Sparkles size={12} />
                      <span>前往 AI 架构师</span>
                    </Button>
                  </div>

                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {analytics.clusterReport.clusters.slice(0, 12).map((c) => (
                      <span
                        key={c.id}
                        style={{
                          fontSize: "0.71rem",
                          padding: "3px 8px",
                          borderRadius: "9999px",
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--border-subtle)",
                        }}
                      >
                        {c.labelHint} <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>({c.tabCount})</span>
                      </span>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
