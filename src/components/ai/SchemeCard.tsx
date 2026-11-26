"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import {
  ClusterCompressionReport,
  ReorganizationScheme,
  TabMicroCluster,
} from "@/types/ai";
import { computeSchemeCoverage } from "@/services/aiArchitectEngine";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Sparkles,
  MessageSquare,
  ArrowRight,
  Loader2,
  X,
  RotateCcw,
  ArrowRightLeft,
  Layers,
  LayoutGrid,
} from "lucide-react";

interface SchemeCardProps {
  scheme: ReorganizationScheme;
  clusterReport?: ClusterCompressionReport;
  isApplying?: boolean;
  onApply: (scheme: ReorganizationScheme) => void;
  onTweak: (scheme: ReorganizationScheme) => void;
  onChangeScheme?: (updatedScheme: ReorganizationScheme) => void;
  onOpenBlueprint?: (scheme: ReorganizationScheme) => void;
}

export function SchemeCard({
  scheme,
  clusterReport,
  isApplying,
  onApply,
  onTweak,
  onChangeScheme,
  onOpenBlueprint,
}: SchemeCardProps) {
  const [activeClusterInfo, setActiveClusterInfo] = useState<{
    clusterId: string;
    categoryIndex: number | null; // null = unassigned or excluded
    anchorRect: { top: number; bottom: number; left: number; width: number };
  } | null>(null);

  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!activeClusterInfo) return;
    const handleOutside = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setActiveClusterInfo(null);
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setActiveClusterInfo(null);
    };
    document.addEventListener("mousedown", handleOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [activeClusterInfo]);

  const clusterById = useMemo(() => {
    const map = new Map<string, TabMicroCluster>();
    if (clusterReport) {
      for (const c of clusterReport.clusters) {
        map.set(c.id, c);
      }
    }
    return map;
  }, [clusterReport]);

  const coverage = useMemo(
    () => computeSchemeCoverage(scheme, clusterReport),
    [scheme, clusterReport]
  );

  const excludedSet = useMemo(
    () => new Set(scheme.excludedClusterIds || []),
    [scheme.excludedClusterIds]
  );

  const unassignedClusters = useMemo(() => {
    if (!clusterReport) return [];
    const assigned = new Set(coverage.coveredClusterIds);
    return clusterReport.clusters.filter(
      (c) => !assigned.has(c.id) && !excludedSet.has(c.id)
    );
  }, [clusterReport, coverage.coveredClusterIds, excludedSet]);

  const excludedClusters = useMemo(() => {
    if (!clusterReport) return [];
    return (scheme.excludedClusterIds || [])
      .map((id) => clusterById.get(id))
      .filter((c): c is TabMicroCluster => Boolean(c));
  }, [clusterReport, scheme.excludedClusterIds, clusterById]);

  const handleMoveCluster = (clusterId: string, targetCategoryIndex: number) => {
    if (!onChangeScheme) return;
    const nextCategories = scheme.categories.map((cat, idx) => {
      const cleaned = (cat.clusterIds || []).filter((id) => id !== clusterId);
      if (idx === targetCategoryIndex) {
        return { ...cat, clusterIds: [...cleaned, clusterId] };
      }
      return { ...cat, clusterIds: cleaned };
    });
    const nextExcluded = (scheme.excludedClusterIds || []).filter((id) => id !== clusterId);

    onChangeScheme({
      ...scheme,
      categories: nextCategories,
      excludedClusterIds: nextExcluded,
    });
    setActiveClusterInfo(null);
  };

  const handleExcludeCluster = (clusterId: string) => {
    if (!onChangeScheme) return;
    const nextCategories = scheme.categories.map((cat) => ({
      ...cat,
      clusterIds: (cat.clusterIds || []).filter((id) => id !== clusterId),
    }));
    const nextExcluded = Array.from(new Set([...(scheme.excludedClusterIds || []), clusterId]));

    onChangeScheme({
      ...scheme,
      categories: nextCategories,
      excludedClusterIds: nextExcluded,
    });
    setActiveClusterInfo(null);
  };

  const handleRestoreCluster = (clusterId: string) => {
    if (!onChangeScheme) return;
    const nextExcluded = (scheme.excludedClusterIds || []).filter((id) => id !== clusterId);
    // 默认恢复到最后一个分类（或者第一个）
    const targetIdx = Math.max(0, scheme.categories.length - 1);
    const nextCategories = scheme.categories.map((cat, idx) =>
      idx === targetIdx
        ? { ...cat, clusterIds: Array.from(new Set([...(cat.clusterIds || []), clusterId])) }
        : cat
    );
    onChangeScheme({
      ...scheme,
      categories: nextCategories,
      excludedClusterIds: nextExcluded,
    });
    setActiveClusterInfo(null);
  };

  const activeCluster = activeClusterInfo ? clusterById.get(activeClusterInfo.clusterId) : null;

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
          flexWrap: "wrap",
          gap: "0.5rem",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.45rem" }}>
          <h4 style={{ fontSize: "0.925rem", fontWeight: 700, color: "var(--text-main)" }}>
            {scheme.name}
          </h4>

          {clusterReport && coverage.totalNonExemptTabs > 0 && (
            <Badge
              variant="subtle"
              size="sm"
              style={{
                fontSize: "0.68rem",
                color: coverage.coveragePct >= 85 ? "var(--success)" : "var(--accent-text)",
                backgroundColor:
                  coverage.coveragePct >= 85
                    ? "rgba(48, 164, 108, 0.14)"
                    : "var(--accent-subtle)",
              }}
            >
              覆盖 {coverage.coveragePct}% ({coverage.coveredTabs}/{coverage.totalNonExemptTabs})
            </Badge>
          )}

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
          {onOpenBlueprint && clusterReport && (
            <Button
              variant="outline"
              size="xs"
              pill
              onClick={() => onOpenBlueprint(scheme)}
              title="打开拖拽式蓝图画布微调微簇分配"
              style={{ fontSize: "0.72rem" }}
            >
              <LayoutGrid size={12} />
              <span>蓝图画布</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="xs"
            pill
            onClick={() => onTweak(scheme)}
            title="以此方案为基础在聊天中调整"
            style={{ color: "var(--text-muted)", fontSize: "0.72rem" }}
          >
            <MessageSquare size={12} />
            <span>AI 微调</span>
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

      {/* Body: Strategy + Interactive Categories Grid */}
      <div style={{ padding: "0.75rem 1rem" }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "0.65rem",
          }}
        >
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", lineHeight: 1.4, margin: 0 }}>
            {scheme.strategy}
          </p>
          {clusterReport && onChangeScheme && (
            <span
              style={{
                fontSize: "0.68rem",
                color: "var(--text-muted)",
                whiteSpace: "nowrap",
                flexShrink: 0,
              }}
            >
              点击微簇芯片可 0 Token 调整归属
            </span>
          )}
        </div>

        {/* Categories Grid */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(225px, 1fr))",
            gap: "0.5rem",
          }}
        >
          {scheme.categories.map((cat, idx) => {
            const catClusterIds = (cat.clusterIds || []).filter((cid) => !excludedSet.has(cid));
            const tabCount = coverage.categoryTabCounts[cat.name];

            return (
              <div
                key={idx}
                style={{
                  padding: "0.55rem 0.7rem",
                  borderRadius: "0.6rem",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  borderLeft: `3px solid ${cat.color || "#38bdf8"}`,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.35rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.35rem" }}>
                  <span
                    style={{
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      color: "var(--text-main)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.35rem",
                      minWidth: 0,
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
                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {cat.name}
                    </span>
                  </span>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                    {typeof tabCount === "number" && (
                      <span
                        style={{
                          fontSize: "0.64rem",
                          padding: "1px 5px",
                          borderRadius: "9999px",
                          backgroundColor: "var(--bg-subtle)",
                          color: "var(--text-muted)",
                          fontWeight: 600,
                        }}
                      >
                        {tabCount}
                      </span>
                    )}
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
                </div>

                {/* Option B Micro-Cluster Chips */}
                {catClusterIds.length > 0 && clusterById.size > 0 ? (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                    {catClusterIds.map((cid) => {
                      const clu = clusterById.get(cid);
                      if (!clu) return null;
                      const isSelected = activeClusterInfo?.clusterId === cid;
                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (isSelected) {
                              setActiveClusterInfo(null);
                              return;
                            }
                            const rect = e.currentTarget.getBoundingClientRect();
                            setActiveClusterInfo({
                              clusterId: cid,
                              categoryIndex: idx,
                              anchorRect: {
                                top: rect.top,
                                bottom: rect.bottom,
                                left: rect.left,
                                width: rect.width,
                              },
                            });
                          }}
                          title={`${clu.labelHint} (${clu.tabCount} 标签)\n样本: ${clu.sampleTitles.join(" | ")}`}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.65rem",
                            padding: "2px 6px",
                            borderRadius: "9999px",
                            backgroundColor: isSelected ? "var(--accent-subtle)" : "var(--bg-subtle)",
                            color: isSelected ? "var(--accent-text)" : "var(--text-main)",
                            border: "1px solid",
                            borderColor: isSelected ? "var(--accent-border)" : "transparent",
                            cursor: onChangeScheme ? "pointer" : "default",
                            maxWidth: "100%",
                            transition: "all 0.12s ease",
                          }}
                        >
                          <span
                            style={{
                              color: "var(--text-muted)",
                              fontFamily: "monospace",
                              fontSize: "0.6rem",
                            }}
                          >
                            {cid}
                          </span>
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              maxWidth: "130px",
                            }}
                          >
                            {clu.labelHint}
                          </span>
                          <span style={{ color: "var(--text-muted)", fontSize: "0.6rem" }}>
                            ({clu.tabCount})
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  cat.matchDomains &&
                  cat.matchDomains.length > 0 && (
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
                  )
                )}
              </div>
            );
          })}
        </div>

        {/* Unassigned & Excluded Strips */}
        {(unassignedClusters.length > 0 || excludedClusters.length > 0) && (
          <div
            style={{
              marginTop: "0.6rem",
              paddingTop: "0.5rem",
              borderTop: "1px dashed var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.35rem",
            }}
          >
            {unassignedClusters.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.68rem", color: "var(--warning)", fontWeight: 600 }}>
                  待分配微簇 ({unassignedClusters.length})：
                </span>
                {unassignedClusters.map((clu) => (
                  <button
                    key={clu.id}
                    type="button"
                    onClick={(e) => {
                    e.stopPropagation();
                    const rect = e.currentTarget.getBoundingClientRect();
                    setActiveClusterInfo({
                      clusterId: clu.id,
                      categoryIndex: null,
                      anchorRect: {
                        top: rect.top,
                        bottom: rect.bottom,
                        left: rect.left,
                        width: rect.width,
                      },
                    });
                  }}
                    style={{
                      fontSize: "0.64rem",
                      padding: "1px 6px",
                      borderRadius: "9999px",
                      border: "1px dashed var(--border-card)",
                      backgroundColor: "transparent",
                      color: "var(--text-muted)",
                      cursor: onChangeScheme ? "pointer" : "default",
                    }}
                  >
                    {clu.id} · {clu.labelHint} ({clu.tabCount})
                  </button>
                ))}
              </div>
            )}

            {excludedClusters.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.25rem" }}>
                <span style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                  已跳过 ({excludedClusters.length})：
                </span>
                {excludedClusters.map((clu) => (
                  <button
                    key={clu.id}
                    type="button"
                    onClick={() => handleRestoreCluster(clu.id)}
                    title="点击恢复纳入方案"
                    style={{
                      fontSize: "0.64rem",
                      padding: "1px 6px",
                      borderRadius: "9999px",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-subtle)",
                      color: "var(--text-muted)",
                      textDecoration: "line-through",
                      cursor: onChangeScheme ? "pointer" : "default",
                    }}
                  >
                    {clu.id} · {clu.labelHint}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Concise Pros / Cons Strip */}
        {((scheme.pros && scheme.pros.length > 0) || (scheme.cons && scheme.cons.length > 0)) && (
          <div
            style={{
              marginTop: "0.65rem",
              paddingTop: "0.55rem",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              flexWrap: "wrap",
              gap: "0.4rem 1rem",
              fontSize: "0.7rem",
              color: "var(--text-muted)",
            }}
          >
            {scheme.pros?.slice(0, 2).map((p, i) => (
              <span key={`p_${i}`} style={{ color: "var(--success)" }}>
                + {p}
              </span>
            ))}
            {scheme.cons?.slice(0, 1).map((c, i) => (
              <span key={`c_${i}`} style={{ color: "var(--text-muted)" }}>
                − {c}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Floating Cluster Popover Card (no backdrop blur) */}
      {activeCluster && activeClusterInfo && onChangeScheme && typeof window !== "undefined" && (() => {
        const rect = activeClusterInfo.anchorRect;
        const cardWidth = Math.min(360, window.innerWidth - 24);
        const left = Math.min(Math.max(12, rect.left), window.innerWidth - cardWidth - 12);
        const placeAbove = rect.bottom + 220 > window.innerHeight && rect.top > 200;
        const top = placeAbove ? Math.max(12, rect.top - 8) : Math.min(window.innerHeight - 24, rect.bottom + 8);

        return (
          <div
            ref={popoverRef}
            onMouseDown={(e) => e.stopPropagation()}
            style={{
              position: "fixed",
              left,
              top,
              transform: placeAbove ? "translateY(-100%)" : undefined,
              width: `${cardWidth}px`,
              zIndex: 90,
              padding: "0.75rem 0.9rem",
              borderRadius: "0.75rem",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--accent-border)",
              boxShadow: "0 12px 32px rgba(0, 0, 0, 0.28)",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.76rem", fontWeight: 600, minWidth: 0 }}>
                <Layers size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />
                <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  [{activeCluster.id}] {activeCluster.labelHint} · {activeCluster.tabCount} 标签
                </span>
              </div>
              <button
                type="button"
                onClick={() => setActiveClusterInfo(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "2px",
                  flexShrink: 0,
                }}
              >
                <X size={13} />
              </button>
            </div>

            {activeCluster.domains.length > 0 && (
              <div style={{ fontSize: "0.68rem", color: "var(--accent-text)" }}>
                域名：{activeCluster.domains.slice(0, 3).join(" · ")}
              </div>
            )}

            {activeCluster.sampleTitles.length > 0 && (
              <div
                style={{
                  fontSize: "0.7rem",
                  color: "var(--text-muted)",
                  lineHeight: 1.4,
                  maxHeight: "64px",
                  overflowY: "auto",
                }}
              >
                样本：{activeCluster.sampleTitles.join(" · ")}
              </div>
            )}

            <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.3rem", paddingTop: "0.2rem", borderTop: "1px solid var(--border-subtle)" }}>
              <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                <ArrowRightLeft size={11} />
                移至：
              </span>

              {scheme.categories.map((targetCat, tIdx) => {
                const isCurrent = activeClusterInfo.categoryIndex === tIdx;
                return (
                  <Button
                    key={tIdx}
                    variant={isCurrent ? "subtle" : "outline"}
                    size="xs"
                    pill
                    disabled={isCurrent}
                    onClick={() => handleMoveCluster(activeCluster.id, tIdx)}
                    style={{ fontSize: "0.67rem", padding: "0.14rem 0.5rem" }}
                  >
                    {targetCat.name}
                  </Button>
                );
              })}

              {!excludedSet.has(activeCluster.id) ? (
                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={() => handleExcludeCluster(activeCluster.id)}
                  style={{ fontSize: "0.67rem", color: "var(--danger)", padding: "0.14rem 0.5rem" }}
                >
                  <X size={11} />
                  <span>暂不整理</span>
                </Button>
              ) : (
                <Button
                  variant="subtle"
                  size="xs"
                  pill
                  onClick={() => handleRestoreCluster(activeCluster.id)}
                  style={{ fontSize: "0.67rem", padding: "0.14rem 0.5rem" }}
                >
                  <RotateCcw size={11} />
                  <span>恢复纳入</span>
                </Button>
              )}
            </div>
          </div>
        );
      })()}
    </div>
  );
}
