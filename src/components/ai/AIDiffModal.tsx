"use client";

import React, { useState } from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { buildTabTree } from "@/services/snapshotParser";
import { TabTreeNode } from "@/types/sidebery";
import {
  Sparkles,
  X,
  Check,
  FolderTree,
  PanelsTopLeft,
  FileEdit,
  GitCompare,
  Layers,
  Globe,
  Sliders,
  ChevronRight,
  ListTree,
  BarChart3,
} from "lucide-react";
import { extractDomain } from "@/utils/urlHelper";

interface AIDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AIDiffModal({ isOpen, onClose }: AIDiffModalProps) {
  const {
    aiProcessedCache,
    isPostEditMode,
    rootNodes,
    activeWindowId,
    enterPostEditMode,
    exitPostEditMode,
    updateProcessedTreeTarget,
    applySnapshotUpdate,
  } = useSnapshotStore();

  const { setActivePage } = useConfigStore();

  const [viewMode, setViewMode] = useState<"tree" | "stats">("tree");
  const [selectedMode, setSelectedMode] = useState<"tree" | "panel">(
    aiProcessedCache?.targetMode || "tree"
  );
  const [selectedPanelId, setSelectedPanelId] = useState<string>(
    aiProcessedCache?.targetPanelId || ""
  );

  if (!isOpen || !aiProcessedCache) return null;

  const originalTabs = aiProcessedCache.originalSnapshot.windows[activeWindowId]?.tabs || [];
  const originalTree = buildTabTree(originalTabs);

  // If in post-edit mode, compare with currently edited rootNodes; otherwise use processedSnapshot tree
  const processedTabs = isPostEditMode
    ? []
    : aiProcessedCache.processedSnapshot.windows[activeWindowId]?.tabs || [];
  const currentAfterTree: TabTreeNode[] = isPostEditMode
    ? rootNodes
    : buildTabTree(processedTabs);

  const panels = aiProcessedCache.originalSnapshot.panels || {};
  const panelList = Object.entries(panels).map(([id, p]) => ({
    id,
    name: p.name || (id === "main" ? "主面板" : id),
  }));

  const handleModeChange = (mode: "tree" | "panel") => {
    setSelectedMode(mode);
    updateProcessedTreeTarget(mode, selectedPanelId || undefined);
  };

  const handlePanelChange = (panelId: string) => {
    setSelectedPanelId(panelId);
    updateProcessedTreeTarget(selectedMode, panelId || undefined);
  };

  const handleEnterPostEdit = () => {
    enterPostEditMode();
    onClose();
  };

  const handleDirectApply = () => {
    if (isPostEditMode) {
      exitPostEditMode(true);
    } else {
      applySnapshotUpdate(aiProcessedCache.processedSnapshot, "应用 AI 比例重组");
    }
    onClose();
  };

  const summary = aiProcessedCache.summary;
  const categorizedPercent =
    summary.total > 0 ? Math.round((summary.categorizedCount / summary.total) * 100) : 0;
  const uncategorizedPercent =
    summary.total > 0 ? Math.round((summary.uncategorizedCount / summary.total) * 100) : 0;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          style={{
            width: "100%",
            maxWidth: "1150px",
            height: "88vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            padding: 0,
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.85rem 1.5rem",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "8px",
                  backgroundColor: "var(--accent-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent)",
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <Dialog.Title style={{ fontSize: "1.05rem", fontWeight: 600 }}>
                  AI 比例重组 — 差分对比与重构设置
                </Dialog.Title>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                  {isPostEditMode
                    ? "正在对比工作台当前手动调整状态与重组前原始快照"
                    : "已完成智能语义归类，请确认差分变更并选择重组应用方式"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Badge variant="subtle" size="sm" style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent-text)" }}>
                总计 {summary.total} 标签
              </Badge>
              <Badge variant="subtle" size="sm" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#10b981" }}>
                已分类 {summary.categorizedCount} ({categorizedPercent}%)
              </Badge>
              {summary.uncategorizedCount > 0 && (
                <Badge variant="subtle" size="sm" style={{ backgroundColor: "rgba(148, 163, 184, 0.2)", color: "var(--text-muted)" }}>
                  未分类 {summary.uncategorizedCount} ({uncategorizedPercent}%)
                </Badge>
              )}

              <Button
                variant="ghost"
                size="xs"
                pill
                onClick={onClose}
                style={{ color: "var(--text-muted)", marginLeft: "0.5rem" }}
                title="关闭"
              >
                <X size={18} />
              </Button>
            </div>
          </div>

          {/* Subheader: Target placement configuration bar */}
          <div
            style={{
              padding: "0.75rem 1.5rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
              <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)" }}>
                重组目标形式：
              </span>

              {/* Mode Segmented Controls */}
              <div
                style={{
                  display: "inline-flex",
                  backgroundColor: "var(--bg-card)",
                  borderRadius: "6px",
                  padding: "2px",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <button
                  type="button"
                  onClick={() => handleModeChange("tree")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.3rem 0.75rem",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: selectedMode === "tree" ? "var(--accent-solid)" : "transparent",
                    color: selectedMode === "tree" ? "#fff" : "var(--text-muted)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <FolderTree size={14} />
                  <span>树状目录 (Group 组)</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange("panel")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    padding: "0.3rem 0.75rem",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: selectedMode === "panel" ? "var(--accent-solid)" : "transparent",
                    color: selectedMode === "panel" ? "#fff" : "var(--text-muted)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  <PanelsTopLeft size={14} />
                  <span>独立面板 (Panels)</span>
                </button>
              </div>

              {/* Panel dropdown when tree mode is chosen */}
              {selectedMode === "tree" && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>归入位置：</span>
                  <select
                    value={selectedPanelId}
                    onChange={(e) => handlePanelChange(e.target.value)}
                    style={{
                      padding: "0.3rem 0.6rem",
                      borderRadius: "6px",
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-main)",
                      fontSize: "0.78rem",
                      outline: "none",
                      cursor: "pointer",
                    }}
                  >
                    <option value="">保持原标签所在面板</option>
                    {panelList.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} ({p.id})
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {/* View Mode Toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Button
                variant={viewMode === "tree" ? "solid" : "ghost"}
                size="xs"
                pill
                onClick={() => setViewMode("tree")}
                style={{ fontSize: "0.75rem" }}
              >
                <ListTree size={13} />
                <span>树状对比</span>
              </Button>
              <Button
                variant={viewMode === "stats" ? "solid" : "ghost"}
                size="xs"
                pill
                onClick={() => setViewMode("stats")}
                style={{ fontSize: "0.75rem" }}
              >
                <BarChart3 size={13} />
                <span>分类比例</span>
              </Button>
            </div>
          </div>

          {/* Main Diff Content */}
          <div style={{ flex: 1, minHeight: 0, overflow: "hidden", display: "flex" }}>
            {viewMode === "tree" ? (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", width: "100%", height: "100%" }}>
                {/* Left: Original Snapshot Tree */}
                <div
                  style={{
                    borderRight: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    backgroundColor: "var(--bg-card)",
                  }}
                >
                  <div
                    style={{
                      padding: "0.6rem 1rem",
                      borderBottom: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-subtle)",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>原始快照结构 (Before)</span>
                    <span>{originalTabs.length} 标签</span>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
                    <TabTreePreview nodes={originalTree} />
                  </div>
                </div>

                {/* Right: AI Processed Tree */}
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    height: "100%",
                    backgroundColor: "var(--bg-card)",
                  }}
                >
                  <div
                    style={{
                      padding: "0.6rem 1rem",
                      borderBottom: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-subtle)",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: "var(--accent)",
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>AI 重构后结构 (After)</span>
                    <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                      {selectedMode === "tree" ? "树状 Group 归组" : "新建独立面板"}
                    </span>
                  </div>

                  <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
                    <TabTreePreview nodes={currentAfterTree} isAfterView />
                  </div>
                </div>
              </div>
            ) : (
              /* Stats & Distribution View */
              <div style={{ width: "100%", padding: "2rem", overflowY: "auto" }}>
                <h3 style={{ fontSize: "1rem", fontWeight: 600, marginBottom: "1rem" }}>
                  AI 分类比例与规则匹配概览
                </h3>

                {/* Segmented Bar */}
                <div
                  style={{
                    width: "100%",
                    height: "14px",
                    borderRadius: "9999px",
                    overflow: "hidden",
                    display: "flex",
                    backgroundColor: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    marginBottom: "1.5rem",
                  }}
                >
                  {aiProcessedCache.categoryNames.map((catName, idx) => {
                    const count = summary.categoryCounts[catName] || 0;
                    const pct = summary.total > 0 ? (count / summary.total) * 100 : 0;
                    if (pct <= 0) return null;
                    const colors = [
                      "#3b82f6", "#10b981", "#ef4444", "#06b6d4",
                      "#8b5cf6", "#f59e0b", "#ec4899", "#64748b",
                    ];
                    return (
                      <div
                        key={catName}
                        title={`${catName}: ${count} 个 (${pct.toFixed(1)}%)`}
                        style={{
                          width: `${pct}%`,
                          backgroundColor: colors[idx % colors.length],
                          height: "100%",
                        }}
                      />
                    );
                  })}
                  {summary.uncategorizedCount > 0 && (
                    <div
                      title={`未分类: ${summary.uncategorizedCount} 个 (${uncategorizedPercent}%)`}
                      style={{
                        width: `${uncategorizedPercent}%`,
                        backgroundColor: "var(--border-strong, #64748b)",
                        height: "100%",
                      }}
                    />
                  )}
                </div>

                {/* Breakdown Table */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.75rem" }}>
                  {aiProcessedCache.categoryNames.map((catName, idx) => {
                    const count = summary.categoryCounts[catName] || 0;
                    const pct = summary.total > 0 ? ((count / summary.total) * 100).toFixed(1) : "0";
                    const colors = [
                      "#3b82f6", "#10b981", "#ef4444", "#06b6d4",
                      "#8b5cf6", "#f59e0b", "#ec4899", "#64748b",
                    ];
                    return (
                      <div
                        key={catName}
                        style={{
                          padding: "0.75rem 1rem",
                          borderRadius: "0.5rem",
                          backgroundColor: "var(--bg-subtle)",
                          border: "1px solid var(--border-subtle)",
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{
                              width: "10px",
                              height: "10px",
                              borderRadius: "50%",
                              backgroundColor: colors[idx % colors.length],
                              display: "inline-block",
                            }}
                          />
                          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                            {catName}
                          </span>
                        </div>
                        <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                          {count} 个 ({pct}%)
                        </span>
                      </div>
                    );
                  })}

                  {/* Explicit Uncategorized Entry */}
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "0.5rem",
                      backgroundColor: "var(--bg-subtle)",
                      border: "1px dashed var(--border-subtle)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                      <span
                        style={{
                          width: "10px",
                          height: "10px",
                          borderRadius: "50%",
                          backgroundColor: "#94a3b8",
                          display: "inline-block",
                        }}
                      />
                      <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-muted)" }}>
                        📁 未分类 (Uncategorized)
                      </span>
                    </div>
                    <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", fontWeight: 600 }}>
                      {summary.uncategorizedCount} 个 ({uncategorizedPercent}%)
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: "0.85rem 1.5rem",
              borderTop: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>
              提示：进入工作台后，将加载 AI 分类后的树状数据供您自由拖拽、编辑，并可随时点击 DIFF 按钮重新打开对比。
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
              <Button variant="outline" size="xs" pill onClick={onClose}>
                稍后处理 (保留缓存)
              </Button>

              <Button
                variant="solid"
                size="xs"
                pill
                onClick={handleEnterPostEdit}
                style={{
                  backgroundColor: "var(--accent-solid)",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                <FileEdit size={14} />
                <span>进入工作台编辑 (Post Edit)</span>
              </Button>

              <Button
                variant="outline"
                size="xs"
                pill
                onClick={handleDirectApply}
                style={{
                  borderColor: "var(--success, #10b981)",
                  color: "var(--success, #10b981)",
                  fontWeight: 600,
                }}
              >
                <Check size={14} />
                <span>直接应用更改</span>
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

/**
 * 树状轻量预览组件
 */
function TabTreePreview({ nodes, isAfterView }: { nodes: TabTreeNode[]; isAfterView?: boolean }) {
  if (nodes.length === 0) {
    return <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", padding: "1rem" }}>没有标签数据</div>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      {nodes.map((node) => (
        <PreviewTreeNodeItem key={node.id} node={node} isAfterView={isAfterView} />
      ))}
    </div>
  );
}

function PreviewTreeNodeItem({ node, isAfterView }: { node: TabTreeNode; isAfterView?: boolean }) {
  const isCategoryHeader = node.isCategoryHeader;
  const isGroup = node.isGroup;
  const isUncategorized = node.categoryName === "未分类";

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.45rem",
          padding: isCategoryHeader ? "0.4rem 0.6rem" : "0.25rem 0.5rem",
          paddingLeft: `${node.depth * 18 + (isCategoryHeader ? 6 : 14)}px`,
          borderRadius: "4px",
          backgroundColor: isCategoryHeader
            ? isUncategorized
              ? "rgba(148, 163, 184, 0.12)"
              : "var(--accent-subtle)"
            : "transparent",
          border: isCategoryHeader
            ? isUncategorized
              ? "1px dashed var(--border-subtle)"
              : "1px solid var(--border-subtle)"
            : "none",
          fontSize: isCategoryHeader ? "0.82rem" : "0.78rem",
          fontWeight: isCategoryHeader ? 600 : 400,
          color: isCategoryHeader
            ? isUncategorized
              ? "var(--text-muted)"
              : "var(--accent-text)"
            : "var(--text-main)",
        }}
      >
        {isCategoryHeader ? (
          <FolderTree size={14} style={{ color: isUncategorized ? "var(--text-muted)" : "var(--accent)" }} />
        ) : isGroup ? (
          <FolderTree size={13} style={{ color: "var(--text-muted)" }} />
        ) : (
          <Globe size={12} style={{ color: "var(--text-muted)", opacity: 0.7 }} />
        )}

        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            maxWidth: "380px",
          }}
          title={node.tab.title || node.tab.url}
        >
          {node.tab.title || node.tab.url || "无标题标签"}
        </span>

        {isAfterView && isCategoryHeader && (
          <Badge
            variant="subtle"
            size="sm"
            style={{
              marginLeft: "auto",
              fontSize: "0.68rem",
              backgroundColor: isUncategorized ? "rgba(148, 163, 184, 0.2)" : "rgba(16, 185, 129, 0.15)",
              color: isUncategorized ? "var(--text-muted)" : "#10b981",
            }}
          >
            {node.children.length} 项
          </Badge>
        )}
      </div>

      {node.children && node.children.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
          {node.children.map((child) => (
            <PreviewTreeNodeItem key={child.id} node={child} isAfterView={isAfterView} />
          ))}
        </div>
      )}
    </div>
  );
}
