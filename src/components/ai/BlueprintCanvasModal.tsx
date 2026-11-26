"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  ClusterCompressionReport,
  ReorganizationScheme,
  ReorganizationCategory,
  TabMicroCluster,
} from "@/types/ai";
import { computeSchemeCoverage } from "@/services/aiArchitectEngine";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Plus,
  Trash2,
  GripVertical,
  LayoutGrid,
  ArrowRight,
  Check,
  Inbox,
} from "lucide-react";

interface BlueprintCanvasModalProps {
  isOpen: boolean;
  scheme: ReorganizationScheme | null;
  clusterReport?: ClusterCompressionReport;
  onClose: () => void;
  onSave: (updatedScheme: ReorganizationScheme) => void;
  onApply: (updatedScheme: ReorganizationScheme) => void;
}

const PALETTE = [
  "#3b82f6",
  "#ec4899",
  "#10b981",
  "#8b5cf6",
  "#f59e0b",
  "#06b6d4",
  "#6366f1",
  "#f97316",
];

export function BlueprintCanvasModal({
  isOpen,
  scheme,
  clusterReport,
  onClose,
  onSave,
  onApply,
}: BlueprintCanvasModalProps) {
  const [draft, setDraft] = useState<ReorganizationScheme | null>(null);
  const [draggingClusterId, setDraggingClusterId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null); // "unassigned" | `cat_${idx}`

  useEffect(() => {
    if (isOpen && scheme) {
      setDraft(JSON.parse(JSON.stringify(scheme)));
    }
  }, [isOpen, scheme]);

  const clusterById = useMemo(() => {
    const map = new Map<string, TabMicroCluster>();
    if (clusterReport) {
      for (const c of clusterReport.clusters) {
        map.set(c.id, c);
      }
    }
    return map;
  }, [clusterReport]);

  const coverage = useMemo(() => {
    if (!draft) {
      return { totalNonExemptTabs: 0, coveredTabs: 0, coveragePct: 0, coveredClusterIds: [] as string[] };
    }
    return computeSchemeCoverage(draft, clusterReport);
  }, [draft, clusterReport]);

  const unassignedClusters = useMemo(() => {
    if (!draft || !clusterReport) return [];
    const assigned = new Set(coverage.coveredClusterIds);
    return clusterReport.clusters.filter((c) => !assigned.has(c.id));
  }, [draft, clusterReport, coverage.coveredClusterIds]);

  if (!isOpen || !draft) return null;

  const moveCluster = (clusterId: string, targetCategoryIndex: number | null) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextCategories = prev.categories.map((cat, idx) => {
        const cleaned = (cat.clusterIds || []).filter((id) => id !== clusterId);
        if (targetCategoryIndex !== null && idx === targetCategoryIndex) {
          return { ...cat, clusterIds: [...cleaned, clusterId] };
        }
        return { ...cat, clusterIds: cleaned };
      });
      const nextExcluded =
        targetCategoryIndex === null
          ? Array.from(new Set([...(prev.excludedClusterIds || []), clusterId]))
          : (prev.excludedClusterIds || []).filter((id) => id !== clusterId);

      return {
        ...prev,
        categories: nextCategories,
        excludedClusterIds: nextExcluded,
      };
    });
  };

  const handleRenameCategory = (idx: number, name: string) => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextCategories = prev.categories.map((cat, i) =>
        i === idx ? { ...cat, name, targetPanelName: name } : cat
      );
      return { ...prev, categories: nextCategories };
    });
  };

  const handleAddCategory = () => {
    setDraft((prev) => {
      if (!prev) return prev;
      const nextIdx = prev.categories.length;
      const newCat: ReorganizationCategory = {
        name: `新分类 ${nextIdx + 1}`,
        color: PALETTE[nextIdx % PALETTE.length],
        clusterIds: [],
        createGroup: true,
      };
      return { ...prev, categories: [...prev.categories, newCat] };
    });
  };

  const handleDeleteCategory = (idx: number) => {
    setDraft((prev) => {
      if (!prev || prev.categories.length <= 1) return prev;
      const removedIds = prev.categories[idx]?.clusterIds || [];
      const nextCategories = prev.categories.filter((_, i) => i !== idx);
      const nextExcluded = Array.from(new Set([...(prev.excludedClusterIds || []), ...removedIds]));
      return {
        ...prev,
        categories: nextCategories,
        excludedClusterIds: nextExcluded,
      };
    });
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 110 }} />
      <Dialog.Positioner style={{ zIndex: 120 }}>
        <Dialog.Content
          style={{
            maxWidth: "1180px",
            width: "95vw",
            height: "86vh",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 24px 48px rgba(0, 0, 0, 0.45)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.85rem 1.25rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <LayoutGrid size={16} style={{ color: "var(--accent)" }} />
              <Dialog.Title style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                蓝图画布 · {draft.name}
              </Dialog.Title>
              {clusterReport && coverage.totalNonExemptTabs > 0 && (
                <Badge
                  variant="subtle"
                  size="sm"
                  style={{
                    fontSize: "0.7rem",
                    color: coverage.coveragePct >= 85 ? "var(--success)" : "var(--accent-text)",
                    backgroundColor:
                      coverage.coveragePct >= 85 ? "rgba(48, 164, 108, 0.14)" : "var(--accent-subtle)",
                  }}
                >
                  覆盖 {coverage.coveragePct}% ({coverage.coveredTabs}/{coverage.totalNonExemptTabs})
                </Badge>
              )}
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                拖拽微簇卡片跨分类调整（0 Token 本地即时生效）
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Button variant="outline" size="xs" pill onClick={handleAddCategory}>
                <Plus size={13} />
                <span>新增分类</span>
              </Button>
              <Dialog.CloseTrigger asChild>
                <Button variant="ghost" size="xs" pill onClick={onClose} style={{ padding: "4px" }}>
                  <X size={16} />
                </Button>
              </Dialog.CloseTrigger>
            </div>
          </div>

          {/* Horizontal Scrollable Kanban Board */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowX: "auto",
              overflowY: "hidden",
              padding: "1rem 1.15rem",
              display: "flex",
              gap: "0.85rem",
              alignItems: "stretch",
            }}
          >
            {/* Unassigned / Excluded Pool Column */}
            <div
              onDragOver={(e) => {
                e.preventDefault();
                setDragOverTarget("unassigned");
              }}
              onDragLeave={() => setDragOverTarget(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverTarget(null);
                if (draggingClusterId) {
                  moveCluster(draggingClusterId, null);
                  setDraggingClusterId(null);
                }
              }}
              style={{
                width: "240px",
                minWidth: "240px",
                display: "flex",
                flexDirection: "column",
                borderRadius: "0.75rem",
                border: "1px dashed",
                borderColor:
                  dragOverTarget === "unassigned" ? "var(--accent-solid)" : "var(--border-subtle)",
                backgroundColor:
                  dragOverTarget === "unassigned" ? "var(--accent-subtle)" : "var(--bg-surface)",
                overflow: "hidden",
              }}
            >
              <div
                style={{
                  padding: "0.65rem 0.75rem",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                }}
              >
                <span style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
                  <Inbox size={13} />
                  <span>保留原位 / 未分配</span>
                </span>
                <span>{unassignedClusters.length}</span>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "0.55rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem",
                }}
              >
                {unassignedClusters.length === 0 ? (
                  <div
                    style={{
                      padding: "1.5rem 0.5rem",
                      textAlign: "center",
                      fontSize: "0.72rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    拖入此处可保留在原面板
                  </div>
                ) : (
                  unassignedClusters.map((c) => (
                    <div
                      key={c.id}
                      draggable
                      onDragStart={(e) => {
                        e.dataTransfer.effectAllowed = "move";
                        e.dataTransfer.setData("text/plain", c.id);
                        setDraggingClusterId(c.id);
                      }}
                      onDragEnd={() => {
                        setDraggingClusterId(null);
                        setDragOverTarget(null);
                      }}
                      style={{
                        padding: "0.5rem 0.6rem",
                        borderRadius: "0.55rem",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-card)",
                        cursor: "grab",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.2rem",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.35rem" }}>
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.25rem",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <GripVertical size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.labelHint}</span>
                        </span>
                        <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", flexShrink: 0 }}>
                          {c.tabCount}
                        </span>
                      </div>
                      {c.domains.length > 0 && (
                        <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {c.domains.slice(0, 2).join(", ")}
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Category Columns */}
            {draft.categories.map((cat, idx) => {
              const catClusters = (cat.clusterIds || [])
                .map((id) => clusterById.get(id))
                .filter((c): c is TabMicroCluster => Boolean(c));
              const totalCatTabs = catClusters.reduce((acc, c) => acc + c.tabCount, 0);
              const isOver = dragOverTarget === `cat_${idx}`;

              return (
                <div
                  key={`${idx}_${cat.color || ""}`}
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOverTarget(`cat_${idx}`);
                  }}
                  onDragLeave={() => setDragOverTarget(null)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOverTarget(null);
                    if (draggingClusterId) {
                      moveCluster(draggingClusterId, idx);
                      setDraggingClusterId(null);
                    }
                  }}
                  style={{
                    width: "260px",
                    minWidth: "260px",
                    display: "flex",
                    flexDirection: "column",
                    borderRadius: "0.75rem",
                    border: "1px solid",
                    borderColor: isOver ? "var(--accent-solid)" : "var(--border-card)",
                    backgroundColor: isOver ? "var(--accent-subtle)" : "var(--bg-surface)",
                    overflow: "hidden",
                    transition: "border-color 0.12s ease, background-color 0.12s ease",
                  }}
                >
                  {/* Column Header */}
                  <div
                    style={{
                      padding: "0.6rem 0.7rem",
                      borderBottom: "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                    }}
                  >
                    <span
                      style={{
                        width: "9px",
                        height: "9px",
                        borderRadius: "50%",
                        backgroundColor: cat.color || PALETTE[idx % PALETTE.length],
                        flexShrink: 0,
                      }}
                    />
                    <input
                      type="text"
                      value={cat.name}
                      onChange={(e) => handleRenameCategory(idx, e.target.value)}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        backgroundColor: "transparent",
                        border: "1px solid transparent",
                        borderRadius: "4px",
                        color: "var(--text-main)",
                        fontSize: "0.8rem",
                        fontWeight: 600,
                        padding: "1px 4px",
                        outline: "none",
                      }}
                    />
                    <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", flexShrink: 0 }}>
                      {totalCatTabs}
                    </span>
                    {draft.categories.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteCategory(idx)}
                        title="删除分类（微簇将回到未分配）"
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "var(--text-muted)",
                          cursor: "pointer",
                          padding: "2px",
                          display: "flex",
                          alignItems: "center",
                        }}
                      >
                        <Trash2 size={12} />
                      </button>
                    )}
                  </div>

                  {/* Column Cluster Cards */}
                  <div
                    style={{
                      flex: 1,
                      overflowY: "auto",
                      padding: "0.55rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.45rem",
                    }}
                  >
                    {catClusters.length === 0 ? (
                      <div
                        style={{
                          padding: "1.5rem 0.5rem",
                          textAlign: "center",
                          fontSize: "0.72rem",
                          color: "var(--text-muted)",
                        }}
                      >
                        拖拽微簇到此分类
                      </div>
                    ) : (
                      catClusters.map((c) => (
                        <div
                          key={c.id}
                          draggable
                          onDragStart={() => setDraggingClusterId(c.id)}
                          onDragEnd={() => {
                            setDraggingClusterId(null);
                            setDragOverTarget(null);
                          }}
                          style={{
                            padding: "0.5rem 0.6rem",
                            borderRadius: "0.55rem",
                            border: "1px solid var(--border-subtle)",
                            backgroundColor: "var(--bg-card)",
                            cursor: "grab",
                            display: "flex",
                            flexDirection: "column",
                            gap: "0.2rem",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.35rem" }}>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.25rem",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <GripVertical size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis" }}>{c.labelHint}</span>
                            </span>
                            <div style={{ display: "inline-flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                              <span style={{ fontSize: "0.68rem", color: "var(--accent-text)", fontWeight: 600 }}>
                                {c.tabCount}
                              </span>
                              <button
                                type="button"
                                onClick={() => moveCluster(c.id, null)}
                                title="移出至保留原位"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--text-muted)",
                                  cursor: "pointer",
                                  padding: "1px",
                                  display: "flex",
                                }}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          </div>

                          {c.domains.length > 0 && (
                            <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {c.domains.slice(0, 2).join(", ")}
                            </div>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "0.8rem 1.25rem",
              borderTop: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "flex-end",
              gap: "0.55rem",
            }}
          >
            <Button variant="ghost" size="xs" pill onClick={onClose}>
              取消
            </Button>
            <Button
              variant="outline"
              size="xs"
              pill
              onClick={() => {
                onSave(draft);
                onClose();
              }}
            >
              <Check size={13} />
              <span>保存草稿</span>
            </Button>
            <Button
              variant="solid"
              size="xs"
              pill
              onClick={() => {
                onApply(draft);
                onClose();
              }}
            >
              <span>保存并预览 DIFF</span>
              <ArrowRight size={13} />
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
