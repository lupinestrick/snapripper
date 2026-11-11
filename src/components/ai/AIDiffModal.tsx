"use client";

import React, { useState, useEffect } from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { buildTabTree, flattenTabTree } from "@/services/snapshotParser";
import { TabTreeNode, SideberyTab } from "@/types/sidebery";
import {
  Sparkles,
  X,
  Check,
  FolderTree,
  PanelsTopLeft,
  FileEdit,
  GitCommit,
  ListTree,
  Folder,
  Globe,
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

  const [activePanelId, setActivePanelId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"tree" | "git">("tree");
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  const [selectedMode, setSelectedMode] = useState<"tree" | "panel">(
    aiProcessedCache?.targetMode || "tree"
  );
  const [selectedPanelId, setSelectedPanelId] = useState<string>(
    aiProcessedCache?.targetPanelId || ""
  );

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrowScreen(window.innerWidth < 800);
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  useEffect(() => {
    if (aiProcessedCache && !activePanelId) {
      const panelKeys = Object.keys(aiProcessedCache.originalSnapshot.panels || {});
      setActivePanelId(panelKeys[0] || "main");
    }
  }, [aiProcessedCache, activePanelId]);

  if (!isOpen || !aiProcessedCache) return null;

  const originalTabs = aiProcessedCache.originalSnapshot.windows[activeWindowId]?.tabs || [];
  const processedTabs = isPostEditMode
    ? flattenTabTree(rootNodes)
    : aiProcessedCache.processedSnapshot.windows[activeWindowId]?.tabs || [];

  const panels = aiProcessedCache.originalSnapshot.panels || {};
  const panelList = Object.entries(panels).map(([id, p]) => ({
    id,
    name: p.name || (id === "main" ? "主面板" : id),
  }));
  if (panelList.length === 0) {
    panelList.push({ id: "main", name: "主面板" });
  }

  const effectivePanelId = activePanelId || panelList[0]?.id || "main";

  // Filter tabs for the active panel
  const beforePanelTabs = originalTabs.filter(
    (t) => (t.panelId || "main") === effectivePanelId
  );
  const afterPanelTabs = processedTabs.filter(
    (t) => (t.panelId || "main") === effectivePanelId
  );

  const beforeTree = buildTabTree(beforePanelTabs);
  const afterTree = isPostEditMode
    ? rootNodes.filter(
        (n) => (n.tab.panelId || "main") === effectivePanelId || (!n.tab.panelId && effectivePanelId === "main")
      )
    : buildTabTree(afterPanelTabs);

  // Identify new category groups created by AI in the active panel
  const newlyCreatedGroups = afterTree.filter(
    (n) => n.isGroup || (n as any).categoryName || n.id.startsWith("group_") || n.id.startsWith("cat_header_")
  );

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
          {/* Top Header */}
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
                  变更确认
                </Dialog.Title>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                  {isPostEditMode
                    ? "正在对比工作台当前手动调整状态与重组前原始快照"
                    : "已完成智能语义归类，请确认差分变更并选择重组应用方式"}
                </div>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Badge
                variant="subtle"
                size="sm"
                style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "var(--success, #10b981)" }}
              >
                已分类 {summary.categorizedCount} ({categorizedPercent}%)
              </Badge>
              {summary.uncategorizedCount > 0 && (
                <Badge
                  variant="subtle"
                  size="sm"
                  style={{ backgroundColor: "rgba(148, 163, 184, 0.2)", color: "var(--text-muted)" }}
                >
                  未分类 {summary.uncategorizedCount} ({uncategorizedPercent}%)
                </Badge>
              )}

              <Dialog.CloseTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={onClose}
                  style={{ color: "var(--text-muted)", padding: "4px", marginLeft: "0.5rem" }}
                  title="关闭"
                >
                  <X size={18} />
                </Button>
              </Dialog.CloseTrigger>
            </div>
          </div>

          {/* Subheader: Panel Selector & Target Mode & View Mode Switcher */}
          <div
            style={{
              padding: "0.6rem 1.5rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
              flexWrap: "wrap",
            }}
          >
            {/* Panel Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, overflowX: "auto" }}>
              <span style={{ fontSize: "0.8rem", color: "var(--text-muted)", flexShrink: 0 }}>面板:</span>

              {isNarrowScreen ? (
                <Select
                  value={effectivePanelId}
                  onChange={(e) => setActivePanelId(e.target.value)}
                  style={{ flex: 1, maxWidth: "260px" }}
                >
                  {panelList.map((p) => {
                    const beforeCount = originalTabs.filter((t) => (t.panelId || "main") === p.id).length;
                    const afterCount = processedTabs.filter((t) => (t.panelId || "main") === p.id).length;
                    return (
                      <option key={p.id} value={p.id}>
                        {p.name} ({beforeCount} → {afterCount})
                      </option>
                    );
                  })}
                </Select>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", overflowX: "auto" }}>
                  {panelList.map((p) => {
                    const isActive = p.id === effectivePanelId;
                    const beforeCount = originalTabs.filter((t) => (t.panelId || "main") === p.id).length;
                    const afterCount = processedTabs.filter((t) => (t.panelId || "main") === p.id).length;
                    return (
                      <Button
                        key={p.id}
                        variant={isActive ? "solid" : "outline"}
                        size="xs"
                        pill
                        onClick={() => setActivePanelId(p.id)}
                        style={{
                          fontSize: "0.75rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span>{p.name}</span>
                        <span style={{ opacity: 0.7, fontSize: "0.7rem" }}>
                          ({beforeCount} → {afterCount})
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Target Reorganization Mode (AI Specific Control) */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
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
                    gap: "0.3rem",
                    padding: "0.25rem 0.6rem",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: selectedMode === "tree" ? "var(--accent-solid)" : "transparent",
                    color: selectedMode === "tree" ? "#fff" : "var(--text-muted)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title="在当前面板内创建 Category Group 折叠目录"
                >
                  <FolderTree size={13} />
                  <span>树状目录</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleModeChange("panel")}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.3rem",
                    padding: "0.25rem 0.6rem",
                    borderRadius: "4px",
                    border: "none",
                    backgroundColor: selectedMode === "panel" ? "var(--accent-solid)" : "transparent",
                    color: selectedMode === "panel" ? "#fff" : "var(--text-muted)",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                  title="为每个主题创建独立的 Sidebery 标签页独立面板"
                >
                  <PanelsTopLeft size={13} />
                  <span>独立面板</span>
                </button>
              </div>

              {selectedMode === "tree" && (
                <select
                  value={selectedPanelId}
                  onChange={(e) => handlePanelChange(e.target.value)}
                  style={{
                    padding: "0.25rem 0.5rem",
                    borderRadius: "6px",
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-main)",
                    fontSize: "0.75rem",
                    outline: "none",
                    cursor: "pointer",
                  }}
                  title="选择将分类树归入哪个目标面板"
                >
                  <option value="">保持原面板</option>
                  {panelList.map((p) => (
                    <option key={p.id} value={p.id}>
                      归入: {p.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* View Mode Switcher (完整结构 vs 差分) */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
              <Button
                variant={viewMode === "tree" ? "solid" : "outline"}
                size="xs"
                pill
                onClick={() => setViewMode("tree")}
              >
                <ListTree size={13} />
                <span>完整结构</span>
              </Button>

              <Button
                variant={viewMode === "git" ? "solid" : "outline"}
                size="xs"
                pill
                onClick={() => setViewMode("git")}
              >
                <GitCommit size={13} />
                <span>差分</span>
              </Button>
            </div>
          </div>

          {/* Main Diff Content Area */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
            {/* Left: Before */}
            <div
              style={{
                borderRight: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                backgroundColor: "var(--bg-canvas)",
              }}
            >
              <div
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "var(--bg-surface)",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--text-muted)",
                }}
              >
                <span>处理前原始结构</span>
                <Badge variant="outline" size="sm">
                  {beforePanelTabs.length} 标签
                </Badge>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "0.85rem" }}>
                <DiffTreeColumn nodes={beforeTree} isBefore={true} />
              </div>
            </div>

            {/* Right: After / Git Diff */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                backgroundColor: "var(--bg-canvas)",
              }}
            >
              <div
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "var(--bg-surface)",
                  borderBottom: "1px solid var(--border-subtle)",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--accent-text)",
                }}
              >
                <span>{viewMode === "git" ? "变更差分(+ / -)" : "处理后结构"}</span>
                <Badge variant="subtle" size="sm">
                  {afterPanelTabs.length} 标签
                </Badge>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "0.85rem" }}>
                {viewMode === "git" ? (
                  <AIGitDiffView
                    newGroups={newlyCreatedGroups}
                    afterTabsCount={afterPanelTabs.length}
                  />
                ) : (
                  <DiffTreeColumn nodes={afterTree} isBefore={false} />
                )}
              </div>
            </div>
          </div>

          {/* Bottom Footer Actions */}
          <div
            style={{
              padding: "0.75rem 1.5rem",
              borderTop: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "0.75rem",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
              确认应用后写入快照树，可通过撤销按钮回滚。
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <Button
                variant="outline"
                size="sm"
                pill
                onClick={handleEnterPostEdit}
                style={{
                  borderColor: "var(--accent-solid)",
                  color: "var(--accent-text)",
                  fontWeight: 600,
                }}
                title="进入工作台可自由手动调整分类与结构"
              >
                <FileEdit size={14} />
                <span>进入工作台微调 (Post Edit)</span>
              </Button>

              <Button
                variant="solid"
                size="sm"
                pill
                onClick={handleDirectApply}
              >
                <Check size={15} />
                <span>确认应用修改</span>
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

// Tree Column Display (Consistent with DiffHopupModal)
function DiffTreeColumn({ nodes, isBefore }: { nodes: TabTreeNode[]; isBefore: boolean }) {
  if (nodes.length === 0) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        该面板暂无标签页
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {nodes.map((node) => (
        <DiffNodeItem key={node.id} node={node} isBefore={isBefore} />
      ))}
    </div>
  );
}

function DiffNodeItem({ node, isBefore }: { node: TabTreeNode; isBefore: boolean }) {
  const isGroup = node.isGroup;
  const isCategoryHeader = (node as any).categoryName || (!isBefore && isGroup && (node.id.startsWith("group_") || node.id.startsWith("cat_header_")));

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.3rem 0.5rem",
          borderRadius: "0.375rem",
          backgroundColor: isCategoryHeader ? "rgba(16, 185, 129, 0.12)" : "var(--bg-subtle)",
          border: isCategoryHeader ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid var(--border-subtle)",
          fontSize: "0.8rem",
          color: isCategoryHeader ? "var(--success, #10b981)" : "var(--text-main)",
        }}
      >
        {isCategoryHeader && (
          <span
            style={{
              padding: "1px 6px",
              borderRadius: "9999px",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.65rem",
              color: "var(--text-muted)",
              fontWeight: 600,
            }}
          >
            分类组
          </span>
        )}
        {!isCategoryHeader && isGroup && (
          <span
            style={{
              padding: "1px 6px",
              borderRadius: "9999px",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.65rem",
              color: "var(--text-muted)",
            }}
          >
            Group
          </span>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {(node as any).categoryName || node.tab.title || node.tab.url}
        </span>
        {node.children.length > 0 && (
          <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", flexShrink: 0 }}>
            ({node.children.length})
          </span>
        )}
      </div>

      {node.children.length > 0 && (
        <div
          style={{
            paddingLeft: "1.25rem",
            borderLeft: "1px solid var(--border-subtle)",
            marginTop: "0.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.25rem",
          }}
        >
          {node.children.map((child) => (
            <DiffNodeItem key={child.id} node={child} isBefore={isBefore} />
          ))}
        </div>
      )}
    </div>
  );
}

// Git-style unified changes diff view (Consistent with DiffHopupModal)
function AIGitDiffView({
  newGroups,
  afterTabsCount,
}: {
  newGroups: TabTreeNode[];
  afterTabsCount: number;
}) {
  const hasChanges = newGroups.length > 0;

  if (!hasChanges) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "var(--text-muted)", fontSize: "0.85rem" }}>
        该面板在此操作下无新建分类分组 (标签总数: {afterTabsCount})
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "var(--success, #10b981)", display: "flex", alignItems: "center", gap: "0.3rem" }}>
        <span>+ 新建 AI 分类分组与归类 ({newGroups.length} 个组)</span>
      </div>

      {newGroups.map((group) => {
        const groupTitle = (group as any).categoryName || group.tab.title || "分类";
        return (
          <div
            key={group.id}
            style={{
              borderRadius: "0.5rem",
              backgroundColor: "rgba(16, 185, 129, 0.08)",
              border: "1px solid rgba(16, 185, 129, 0.35)",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                padding: "0.35rem 0.6rem",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                color: "var(--success, #10b981)",
                fontSize: "0.8rem",
                fontWeight: 600,
              }}
            >
              <span style={{ fontWeight: 700 }}>+</span>
              <Folder size={14} />
              <span style={{ flex: 1 }}>{groupTitle}</span>
              <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>({group.children.length} 标签)</span>
            </div>

            {group.children.length > 0 && (
              <div style={{ padding: "0.3rem 0.6rem 0.4rem 1.4rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                {group.children.map((child) => {
                  const domain = extractDomain(child.tab.url);
                  return (
                    <div
                      key={child.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontSize: "0.75rem",
                        color: "var(--text-main)",
                      }}
                    >
                      <span style={{ color: "var(--success, #10b981)", fontSize: "0.7rem" }}>↳</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {child.tab.title || child.tab.url}
                      </span>
                      {domain && (
                        <span style={{ fontSize: "0.68rem", opacity: 0.7, flexShrink: 0 }}>
                          {domain}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
