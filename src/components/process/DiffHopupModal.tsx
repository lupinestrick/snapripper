"use client";

import React, { useState, useEffect } from "react";
import { PanelDiffResult, TabTreeNode, SideberyTab } from "@/types/sidebery";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { X, Check, GitCommit, ListTree, Folder, Globe, SlidersHorizontal } from "lucide-react";
import { extractDomain } from "@/utils/urlHelper";
import { DiffSettingsModal } from "./DiffSettingsModal";

interface DiffHopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  panelDiffs: PanelDiffResult[];
  totalDeduped: number;
  totalGroupsCreated: number;
  onRecomputeDiff?: () => void;
}

export function DiffHopupModal({
  isOpen,
  onClose,
  onConfirm,
  panelDiffs,
  totalDeduped,
  totalGroupsCreated,
  onRecomputeDiff,
}: DiffHopupModalProps) {
  const [activePanelId, setActivePanelId] = useState<string>("");
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [viewMode, setViewMode] = useState<"tree" | "git">("tree");
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  useEffect(() => {
    if (panelDiffs.length > 0 && !activePanelId) {
      setActivePanelId(panelDiffs[0].panelId);
    }
  }, [panelDiffs, activePanelId]);

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrowScreen(window.innerWidth < 800);
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  if (!isOpen || panelDiffs.length === 0) return null;

  const currentDiff = panelDiffs.find((p) => p.panelId === activePanelId) || panelDiffs[0];

  // Calculate Git-style differences for current panel
  const afterTabIds = new Set(currentDiff?.afterTabs.map((t) => t.id));
  const removedTabs = currentDiff?.beforeTabs.filter((t) => !afterTabIds.has(t.id)) || [];
  const newlyCreatedGroups = currentDiff?.afterTree.filter((n) => n.isGroup && n.id.startsWith("group_")) || [];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          style={{
            width: "100%",
            maxWidth: "1100px",
            height: "88vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "1rem",
          }}
        >
          {/* Top Header */}
          <div
            style={{
              padding: "0.85rem 1.5rem",
              borderBottom: "1px solid #1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#111827",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.85rem" }}>
              <Dialog.Title>Diff 变更确认</Dialog.Title>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                {totalDeduped > 0 && (
                  <Badge variant="subtle" size="sm" style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#f87171" }}>
                    去重 -{totalDeduped}
                  </Badge>
                )}
                {totalGroupsCreated > 0 && (
                  <Badge variant="subtle" size="sm" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                    分组 +{totalGroupsCreated}
                  </Badge>
                )}
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <Button
                variant="outline"
                size="xs"
                pill
                onClick={() => setIsSettingsOpen(true)}
                title="处理与整理设置"
              >
                <SlidersHorizontal size={13} />
                <span>设置</span>
              </Button>

              <Dialog.CloseTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={onClose}
                  style={{ color: "#94a3b8", padding: "4px" }}
                  title="关闭"
                >
                  <X size={18} />
                </Button>
              </Dialog.CloseTrigger>
            </div>
          </div>

          {/* Panel Selector & Git Diff View Mode Toggle */}
          <div
            style={{
              padding: "0.6rem 1.5rem",
              borderBottom: "1px solid #1e293b",
              backgroundColor: "#0b0f19",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "1rem",
            }}
          >
            {/* Panel Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flex: 1, overflowX: "auto" }}>
              <span style={{ fontSize: "0.8rem", color: "#94a3b8", flexShrink: 0 }}>面板:</span>

              {isNarrowScreen ? (
                <Select
                  value={activePanelId}
                  onChange={(e) => setActivePanelId(e.target.value)}
                  style={{ flex: 1, maxWidth: "260px" }}
                >
                  {panelDiffs.map((p) => (
                    <option key={p.panelId} value={p.panelId}>
                      {p.panelName} ({p.beforeTabs.length} → {p.afterTabs.length})
                    </option>
                  ))}
                </Select>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", overflowX: "auto" }}>
                  {panelDiffs.map((p) => {
                    const isActive = p.panelId === activePanelId;
                    return (
                      <Button
                        key={p.panelId}
                        variant={isActive ? "solid" : "outline"}
                        size="xs"
                        pill
                        onClick={() => setActivePanelId(p.panelId)}
                        style={{
                          backgroundColor: isActive ? "#2563eb" : "#1e293b",
                          borderColor: isActive ? "#3b82f6" : "#334155",
                          color: isActive ? "#ffffff" : "#94a3b8",
                          fontSize: "0.75rem",
                          whiteSpace: "nowrap",
                        }}
                      >
                        <span>{p.panelName}</span>
                        <span style={{ opacity: 0.7, fontSize: "0.7rem" }}>
                          ({p.beforeTabs.length} → {p.afterTabs.length})
                        </span>
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Git Diff View Mode Switcher */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
              <Button
                variant={viewMode === "tree" ? "solid" : "outline"}
                size="xs"
                pill
                onClick={() => setViewMode("tree")}
                style={{
                  backgroundColor: viewMode === "tree" ? "#334155" : "transparent",
                  borderColor: "#334155",
                  color: viewMode === "tree" ? "#ffffff" : "#94a3b8",
                }}
              >
                <ListTree size={13} />
                <span>完整结构</span>
              </Button>

              <Button
                variant={viewMode === "git" ? "solid" : "outline"}
                size="xs"
                pill
                onClick={() => setViewMode("git")}
                style={{
                  backgroundColor: viewMode === "git" ? "#1e293b" : "transparent",
                  borderColor: viewMode === "git" ? "#38bdf8" : "#334155",
                  color: viewMode === "git" ? "#38bdf8" : "#94a3b8",
                }}
              >
                <GitCommit size={13} />
                <span>Git 差分</span>
              </Button>
            </div>
          </div>

          {/* Diff Content View Area */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
            {/* Left: Before */}
            <div
              style={{
                borderRight: "1px solid #1e293b",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                backgroundColor: "rgba(15, 23, 42, 0.4)",
              }}
            >
              <div
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: "#111827",
                  borderBottom: "1px solid #1e293b",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                }}
              >
                <span>处理前原始结构</span>
                <Badge variant="outline" size="sm">{currentDiff?.beforeTabs.length || 0} 标签</Badge>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "0.85rem" }}>
                {currentDiff && <DiffTreeColumn nodes={currentDiff.beforeTree} isBefore={true} />}
              </div>
            </div>

            {/* Right: After / Git Diff */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                backgroundColor: "rgba(15, 23, 42, 0.2)",
              }}
            >
              <div
                style={{
                  padding: "0.5rem 1rem",
                  backgroundColor: viewMode === "git" ? "rgba(56, 189, 248, 0.1)" : "rgba(37, 99, 235, 0.1)",
                  borderBottom: "1px solid #1e293b",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: viewMode === "git" ? "#38bdf8" : "#60a5fa",
                }}
              >
                <span>{viewMode === "git" ? "变更差分(+ / -)" : "处理后结构"}</span>
                <Badge variant="subtle" size="sm" style={{ color: "#38bdf8" }}>
                  {currentDiff?.afterTabs.length || 0} 标签
                </Badge>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "0.85rem" }}>
                {viewMode === "git" ? (
                  <GitDiffView
                    removedTabs={removedTabs}
                    newGroups={newlyCreatedGroups}
                    afterTabsCount={currentDiff?.afterTabs.length || 0}
                  />
                ) : (
                  currentDiff && <DiffTreeColumn nodes={currentDiff.afterTree} isBefore={false} />
                )}
              </div>
            </div>
          </div>

          {/* Bottom Footer Actions (No redundant cancel button) */}
          <div
            style={{
              padding: "0.75rem 1.5rem",
              borderTop: "1px solid #1e293b",
              backgroundColor: "#111827",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
              确认应用后写入快照树，可通过撤销按钮回滚。
            </div>

            <Button
              variant="solid"
              size="sm"
              pill
              onClick={onConfirm}
              style={{ backgroundColor: "#2563eb", color: "#ffffff" }}
            >
              <Check size={15} />
              <span>确认应用修改</span>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>

      {/* Nested Settings Hop-up Modal */}
      <DiffSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activePanelId={activePanelId}
        panels={panelDiffs.map((p) => ({ id: p.panelId, name: p.panelName }))}
        onSave={() => onRecomputeDiff?.()}
      />
    </Dialog.Root>
  );
}

// Tree Column Display
function DiffTreeColumn({ nodes, isBefore }: { nodes: TabTreeNode[]; isBefore: boolean }) {
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
  const isNewlyAddedGroup = !isBefore && isGroup && node.id.startsWith("group_");

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.3rem 0.5rem",
          borderRadius: "0.375rem",
          backgroundColor: isNewlyAddedGroup ? "rgba(16, 185, 129, 0.12)" : "rgba(30, 41, 59, 0.4)",
          border: isNewlyAddedGroup ? "1px solid rgba(16, 185, 129, 0.4)" : "1px solid transparent",
          fontSize: "0.8rem",
          color: isNewlyAddedGroup ? "#34d399" : "#e2e8f0",
        }}
      >
        {isGroup && (
          <span style={{ padding: "1px 6px", borderRadius: "9999px", backgroundColor: "#334155", fontSize: "0.65rem", color: "#94a3b8" }}>
            Group
          </span>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {node.tab.title || node.tab.url}
        </span>
        {node.children.length > 0 && (
          <span style={{ fontSize: "0.7rem", color: "#64748b", flexShrink: 0 }}>
            ({node.children.length})
          </span>
        )}
      </div>

      {node.children.length > 0 && (
        <div style={{ paddingLeft: "1.25rem", borderLeft: "1px solid #1e293b", marginTop: "0.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {node.children.map((child) => (
            <DiffNodeItem key={child.id} node={child} isBefore={isBefore} />
          ))}
        </div>
      )}
    </div>
  );
}

// Git-style unified changes diff view
function GitDiffView({
  removedTabs,
  newGroups,
  afterTabsCount,
}: {
  removedTabs: SideberyTab[];
  newGroups: TabTreeNode[];
  afterTabsCount: number;
}) {
  const hasChanges = removedTabs.length > 0 || newGroups.length > 0;

  if (!hasChanges) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", color: "#64748b", fontSize: "0.85rem" }}>
        该面板在此操作下无增删变更 (标签数保持: {afterTabsCount})
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
      {/* Removed Tabs (Red -) */}
      {removedTabs.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.3rem" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#f87171", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span>- 移除 / 去重标签 ({removedTabs.length})</span>
          </div>
          {removedTabs.map((tab) => {
            const domain = extractDomain(tab.url);
            return (
              <div
                key={tab.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  padding: "0.35rem 0.6rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "rgba(239, 68, 68, 0.12)",
                  border: "1px solid rgba(239, 68, 68, 0.3)",
                  color: "#fca5a5",
                  fontSize: "0.78rem",
                }}
              >
                <span style={{ fontWeight: 700, color: "#ef4444", flexShrink: 0 }}>-</span>
                <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                  {tab.title || tab.url}
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

      {/* Newly Created Groups (Green +) */}
      {newGroups.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem", marginTop: removedTabs.length > 0 ? "0.6rem" : "0" }}>
          <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#34d399", display: "flex", alignItems: "center", gap: "0.3rem" }}>
            <span>+ 新建分组及归类 ({newGroups.length} 个组)</span>
          </div>
          {newGroups.map((group) => (
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
                  color: "#34d399",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                }}
              >
                <span style={{ fontWeight: 700 }}>+</span>
                <Folder size={14} />
                <span style={{ flex: 1 }}>{group.tab.title}</span>
                <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>({group.children.length} 标签)</span>
              </div>

              {group.children.length > 0 && (
                <div style={{ padding: "0.3rem 0.6rem 0.4rem 1.4rem", display: "flex", flexDirection: "column", gap: "0.2rem" }}>
                  {group.children.map((child) => (
                    <div
                      key={child.id}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "0.4rem",
                        fontSize: "0.75rem",
                        color: "#cbd5e1",
                      }}
                    >
                      <span style={{ color: "#34d399", fontSize: "0.7rem" }}>↳</span>
                      <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {child.tab.title || child.tab.url}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
