"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { PanelDiffResult, TabTreeNode, SideberyTab } from "@/types/sidebery";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  X,
  Check,
  GitCommit,
  ListTree,
  Folder,
  SlidersHorizontal,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
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

interface ComputedPanelSummary {
  panelId: string;
  panelName: string;
  beforeCount: number;
  afterCount: number;
  removedTabs: SideberyTab[];
  movedInTabs: SideberyTab[];
  newGroups: TabTreeNode[];
  removedIds: Set<string | number>;
  movedInIds: Set<string | number>;
  changeCount: number;
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
  const { uiSettings } = useConfigStore();
  const [activePanelId, setActivePanelId] = useState<string>("");
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [viewMode, setViewMode] = useState<"changes" | "tree">("changes");
  const [onlyChangedPanels, setOnlyChangedPanels] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandAllTree, setExpandAllTree] = useState(true);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  const panelSummaries = useMemo(() => {
    const map = new Map<string, ComputedPanelSummary>();
    for (const p of panelDiffs) {
      const afterIds = new Set(p.afterTabs.map((t) => t.id));
      const beforeIds = new Set(p.beforeTabs.map((t) => t.id));
      const removedTabs = p.beforeTabs.filter((t) => !afterIds.has(t.id));
      const movedInTabs = p.afterTabs.filter(
        (t) => !beforeIds.has(t.id) && !String(t.id).startsWith("group_")
      );
      const newGroups = p.afterTree.filter(
        (n) => n.isGroup && n.id.startsWith("group_")
      );
      const changeCount = removedTabs.length + movedInTabs.length + newGroups.length;
      map.set(p.panelId, {
        panelId: p.panelId,
        panelName: p.panelName,
        beforeCount: p.beforeTabs.length,
        afterCount: p.afterTabs.length,
        removedTabs,
        movedInTabs,
        newGroups,
        removedIds: new Set(removedTabs.map((t) => t.id)),
        movedInIds: new Set(movedInTabs.map((t) => t.id)),
        changeCount,
      });
    }
    return map;
  }, [panelDiffs]);

  const displayedPanelDiffs = useMemo(() => {
    let list = panelDiffs;
    if (uiSettings?.hideEmptyPanels) {
      const nonEmpty = list.filter((p) => p.beforeTabs.length > 0 || p.afterTabs.length > 0);
      if (nonEmpty.length > 0) list = nonEmpty;
    }
    if (onlyChangedPanels) {
      const changed = list.filter((p) => (panelSummaries.get(p.panelId)?.changeCount || 0) > 0);
      if (changed.length > 0) list = changed;
    }
    return list;
  }, [panelDiffs, uiSettings?.hideEmptyPanels, onlyChangedPanels, panelSummaries]);

  // Auto-select first panel that has changes when modal opens
  useEffect(() => {
    if (!isOpen || displayedPanelDiffs.length === 0) return;
    const currentStillValid = displayedPanelDiffs.some((p) => p.panelId === activePanelId);
    if (!currentStillValid) {
      const firstChanged = displayedPanelDiffs.find(
        (p) => (panelSummaries.get(p.panelId)?.changeCount || 0) > 0
      );
      setActivePanelId((firstChanged || displayedPanelDiffs[0]).panelId);
    }
  }, [isOpen, displayedPanelDiffs, activePanelId, panelSummaries]);

  useEffect(() => {
    const checkWidth = () => setIsNarrowScreen(window.innerWidth < 800);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  if (!isOpen || panelDiffs.length === 0) return null;

  const currentDiff =
    displayedPanelDiffs.find((p) => p.panelId === activePanelId) ||
    displayedPanelDiffs[0] ||
    panelDiffs[0];
  const currentSummary = panelSummaries.get(currentDiff.panelId);
  const changedPanelsCount = Array.from(panelSummaries.values()).filter((s) => s.changeCount > 0).length;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 110 }} />
      <Dialog.Positioner style={{ zIndex: 120 }}>
        <Dialog.Content
          style={{
            width: "94vw",
            maxWidth: "1100px",
            height: "88vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            overflow: "hidden",
            boxShadow: "0 24px 48px rgba(0,0,0,0.45)",
          }}
        >
          {/* Top Header */}
          <div
            style={{
              padding: "0.8rem 1.25rem",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "var(--bg-surface)",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", flexWrap: "wrap" }}>
              <Dialog.Title style={{ fontSize: "0.95rem", fontWeight: 700 }}>变更确认</Dialog.Title>
              {totalDeduped > 0 && (
                <Badge
                  variant="subtle"
                  size="sm"
                  style={{ backgroundColor: "rgba(239, 68, 68, 0.14)", color: "#ef4444", fontSize: "0.7rem" }}
                >
                  去重 -{totalDeduped}
                </Badge>
              )}
              {totalGroupsCreated > 0 && (
                <Badge
                  variant="subtle"
                  size="sm"
                  style={{ backgroundColor: "rgba(16, 185, 129, 0.14)", color: "#10b981", fontSize: "0.7rem" }}
                >
                  新建分组 +{totalGroupsCreated}
                </Badge>
              )}
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                共 {changedPanelsCount} / {panelDiffs.length} 个面板有变更
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <Button
                variant="outline"
                size="xs"
                pill
                onClick={() => setIsSettingsOpen(true)}
                title="处理与整理设置"
              >
                <SlidersHorizontal size={13} />
                <span>规则设置</span>
              </Button>

              <Dialog.CloseTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={onClose}
                  style={{ color: "var(--text-muted)", padding: "4px" }}
                  title="关闭"
                >
                  <X size={16} />
                </Button>
              </Dialog.CloseTrigger>
            </div>
          </div>

          {/* Toolbar: Panel Selector + Search + View Mode */}
          <div
            style={{
              padding: "0.6rem 1.25rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              flexDirection: "column",
              gap: "0.55rem",
            }}
          >
            {/* Row 1: Panels + Filter */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flex: 1, minWidth: 0, overflowX: "auto" }}>
                {isNarrowScreen ? (
                  <Select
                    value={currentDiff.panelId}
                    onChange={(e) => setActivePanelId(e.target.value)}
                    style={{ flex: 1, maxWidth: "280px" }}
                  >
                    {displayedPanelDiffs.map((p) => {
                      const chg = panelSummaries.get(p.panelId)?.changeCount || 0;
                      return (
                        <option key={p.panelId} value={p.panelId}>
                          {p.panelName} ({p.beforeTabs.length} → {p.afterTabs.length}
                          {chg > 0 ? ` · ${chg} 变更` : ""})
                        </option>
                      );
                    })}
                  </Select>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", overflowX: "auto" }}>
                    {displayedPanelDiffs.map((p) => {
                      const isActive = p.panelId === currentDiff.panelId;
                      const chg = panelSummaries.get(p.panelId)?.changeCount || 0;
                      return (
                        <button
                          key={p.panelId}
                          type="button"
                          onClick={() => setActivePanelId(p.panelId)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.28rem 0.68rem",
                            borderRadius: "9999px",
                            border: "1px solid",
                            borderColor: isActive ? "var(--accent-solid)" : "var(--border-subtle)",
                            backgroundColor: isActive ? "var(--accent-subtle)" : "var(--bg-card)",
                            color: isActive ? "var(--accent-text)" : chg > 0 ? "var(--text-main)" : "var(--text-muted)",
                            fontSize: "0.74rem",
                            fontWeight: isActive || chg > 0 ? 600 : 400,
                            whiteSpace: "nowrap",
                            cursor: "pointer",
                          }}
                        >
                          <span>{p.panelName}</span>
                          {chg > 0 ? (
                            <span
                              style={{
                                fontSize: "0.66rem",
                                padding: "0 5px",
                                borderRadius: "9999px",
                                backgroundColor: "var(--accent-solid)",
                                color: "#fff",
                              }}
                            >
                              {chg}
                            </span>
                          ) : (
                            <span style={{ fontSize: "0.68rem", opacity: 0.6 }}>{p.afterTabs.length}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexShrink: 0 }}>
                <Button
                  variant={viewMode === "changes" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setViewMode("changes")}
                >
                  <GitCommit size={13} />
                  <span>变更摘要</span>
                </Button>
                <Button
                  variant={viewMode === "tree" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setViewMode("tree")}
                >
                  <ListTree size={13} />
                  <span>左右树对比</span>
                </Button>
              </div>
            </div>

            {/* Row 2: Search + Quick Toggles */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
                <Search
                  size={13}
                  style={{
                    position: "absolute",
                    left: "0.65rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="搜索标签标题、域名或新建分组..."
                  style={{ paddingLeft: "1.9rem", fontSize: "0.76rem", paddingTop: "0.28rem", paddingBottom: "0.28rem" }}
                />
              </div>

              {changedPanelsCount > 0 && (
                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.73rem", cursor: "pointer", color: "var(--text-muted)" }}>
                  <input
                    type="checkbox"
                    checked={onlyChangedPanels}
                    onChange={(e) => setOnlyChangedPanels(e.target.checked)}
                    style={{ accentColor: "var(--accent-solid)", cursor: "pointer" }}
                  />
                  <span>仅看有变更面板</span>
                </label>
              )}

              {viewMode === "tree" && (
                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={() => setExpandAllTree((prev) => !prev)}
                  style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                >
                  <ChevronsUpDown size={12} />
                  <span>{expandAllTree ? "全部折叠" : "全部展开"}</span>
                </Button>
              )}
            </div>
          </div>

          {/* Main Diff Content Area */}
          {viewMode === "changes" ? (
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.25rem", backgroundColor: "var(--bg-canvas)" }}>
              {currentSummary && (
                <ChangesSummaryView
                  summary={currentSummary}
                  searchQuery={searchQuery}
                />
              )}
            </div>
          ) : (
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "minmax(0, 1fr) minmax(0, 1fr)", overflow: "hidden" }}>
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
                    padding: "0.45rem 1rem",
                    backgroundColor: "var(--bg-surface)",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                  }}
                >
                  <span>处理前</span>
                  <Badge variant="outline" size="sm">{currentDiff.beforeTabs.length} 标签</Badge>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
                  <DiffTreeColumn
                    nodes={currentDiff.beforeTree}
                    isBefore
                    searchQuery={searchQuery}
                    removedIds={currentSummary?.removedIds}
                    expandAll={expandAllTree}
                  />
                </div>
              </div>

              {/* Right: After */}
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
                    padding: "0.45rem 1rem",
                    backgroundColor: "var(--bg-surface)",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    color: "var(--accent-text)",
                  }}
                >
                  <span>处理后</span>
                  <Badge variant="subtle" size="sm">{currentDiff.afterTabs.length} 标签</Badge>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
                  <DiffTreeColumn
                    nodes={currentDiff.afterTree}
                    isBefore={false}
                    searchQuery={searchQuery}
                    movedInIds={currentSummary?.movedInIds}
                    expandAll={expandAllTree}
                  />
                </div>
              </div>
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              padding: "0.75rem 1.25rem",
              borderTop: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
              确认应用后写入快照树，支持随时撤销回滚。
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <Button variant="ghost" size="xs" pill onClick={onClose}>
                取消
              </Button>
              <Button variant="solid" size="xs" pill onClick={onConfirm}>
                <Check size={14} />
                <span>确认应用修改</span>
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>

      {/* Nested Settings Hop-up Modal */}
      <DiffSettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        activePanelId={currentDiff.panelId}
        panels={panelDiffs.map((p) => ({ id: p.panelId, name: p.panelName }))}
        onSave={() => onRecomputeDiff?.()}
      />
    </Dialog.Root>
  );
}

function matchesSearch(tab: SideberyTab, q: string): boolean {
  if (!q) return true;
  const lower = q.toLowerCase();
  return (
    (tab.title || "").toLowerCase().includes(lower) ||
    (tab.url || "").toLowerCase().includes(lower)
  );
}

function ChangesSummaryView({
  summary,
  searchQuery,
}: {
  summary: ComputedPanelSummary;
  searchQuery: string;
}) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(() => {
    return new Set(summary.newGroups.slice(0, 4).map((g) => g.id));
  });

  useEffect(() => {
    setExpandedGroups(new Set(summary.newGroups.slice(0, 4).map((g) => g.id)));
  }, [summary.panelId, summary.newGroups]);

  const q = searchQuery.trim().toLowerCase();

  const filteredGroups = summary.newGroups.filter((g) => {
    if (!q) return true;
    return (
      matchesSearch(g.tab, q) ||
      g.children.some((c) => matchesSearch(c.tab, q))
    );
  });
  const filteredMovedIn = summary.movedInTabs.filter((t) => matchesSearch(t, q));
  const filteredRemoved = summary.removedTabs.filter((t) => matchesSearch(t, q));

  if (summary.changeCount === 0) {
    return (
      <div
        style={{
          padding: "2.5rem 1rem",
          textAlign: "center",
          borderRadius: "0.75rem",
          border: "1px dashed var(--border-subtle)",
          color: "var(--text-muted)",
          fontSize: "0.82rem",
        }}
      >
        面板「{summary.panelName}」无增删或新建分组变更（保持 {summary.afterCount} 个标签原位）
      </div>
    );
  }

  if (
    q &&
    filteredGroups.length === 0 &&
    filteredMovedIn.length === 0 &&
    filteredRemoved.length === 0
  ) {
    return (
      <div style={{ padding: "2rem", textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
        在「{summary.panelName}」的变更项中未匹配到 “{searchQuery}”
      </div>
    );
  }

  const toggleGroup = (id: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* 1. Newly Created Groups */}
      {filteredGroups.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#10b981" }}>
            新建分组 / 归类 ({filteredGroups.length})
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "0.55rem" }}>
            {filteredGroups.map((group) => {
              const isExpanded = expandedGroups.has(group.id) || Boolean(q);
              return (
                <div
                  key={group.id}
                  style={{
                    borderRadius: "0.65rem",
                    border: "1px solid rgba(16, 185, 129, 0.35)",
                    backgroundColor: "var(--bg-card)",
                    overflow: "hidden",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => toggleGroup(group.id)}
                    style={{
                      width: "100%",
                      padding: "0.55rem 0.75rem",
                      backgroundColor: "rgba(16, 185, 129, 0.08)",
                      border: "none",
                      color: "var(--text-main)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.4rem",
                      cursor: "pointer",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      textAlign: "left",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <Folder size={13} style={{ color: "#10b981", flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {group.tab.title || "未命名分组"}
                      </span>
                    </span>
                    <Badge variant="subtle" size="sm" style={{ fontSize: "0.66rem", color: "#10b981", flexShrink: 0 }}>
                      {group.children.length}
                    </Badge>
                  </button>

                  {isExpanded && group.children.length > 0 && (
                    <div style={{ padding: "0.45rem 0.7rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                      {group.children
                        .filter((c) => !q || matchesSearch(c.tab, q) || matchesSearch(group.tab, q))
                        .map((child) => {
                          const domain = extractDomain(child.tab.url);
                          return (
                            <div
                              key={child.id}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                gap: "0.45rem",
                                fontSize: "0.74rem",
                                color: "var(--text-main)",
                              }}
                            >
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                · {child.tab.title || child.tab.url}
                              </span>
                              {domain && (
                                <span style={{ fontSize: "0.66rem", color: "var(--text-muted)", flexShrink: 0 }}>
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
        </div>
      )}

      {/* 2. Moved In Tabs */}
      {filteredMovedIn.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--accent-text)" }}>
            跨面板移入标签 ({filteredMovedIn.length})
          </div>
          <div style={{ borderRadius: "0.65rem", border: "1px solid var(--accent-border)", overflow: "hidden" }}>
            {filteredMovedIn.map((tab, idx) => {
              const domain = extractDomain(tab.url);
              return (
                <div
                  key={tab.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.42rem 0.7rem",
                    borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)",
                    backgroundColor: "var(--accent-subtle)",
                    fontSize: "0.76rem",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "var(--accent)", flexShrink: 0 }}>+</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {tab.title || tab.url}
                  </span>
                  {domain && <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", flexShrink: 0 }}>{domain}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* 3. Removed / Deduped Tabs */}
      {filteredRemoved.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#ef4444" }}>
            去重 / 移出标签 ({filteredRemoved.length})
          </div>
          <div style={{ borderRadius: "0.65rem", border: "1px solid rgba(239, 68, 68, 0.35)", overflow: "hidden" }}>
            {filteredRemoved.map((tab, idx) => {
              const domain = extractDomain(tab.url);
              return (
                <div
                  key={tab.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    padding: "0.42rem 0.7rem",
                    borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)",
                    backgroundColor: "rgba(239, 68, 68, 0.08)",
                    fontSize: "0.76rem",
                  }}
                >
                  <span style={{ fontWeight: 700, color: "#ef4444", flexShrink: 0 }}>−</span>
                  <span
                    style={{
                      flex: 1,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                      textDecoration: "line-through",
                      opacity: 0.85,
                    }}
                  >
                    {tab.title || tab.url}
                  </span>
                  {domain && <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", flexShrink: 0 }}>{domain}</span>}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function nodeMatchesSearch(node: TabTreeNode, q: string): boolean {
  if (!q) return true;
  if (matchesSearch(node.tab, q)) return true;
  return node.children.some((c) => nodeMatchesSearch(c, q));
}

function DiffTreeColumn({
  nodes,
  isBefore,
  searchQuery,
  removedIds,
  movedInIds,
  expandAll,
}: {
  nodes: TabTreeNode[];
  isBefore: boolean;
  searchQuery: string;
  removedIds?: Set<string | number>;
  movedInIds?: Set<string | number>;
  expandAll: boolean;
}) {
  const q = searchQuery.trim().toLowerCase();
  const visibleNodes = q ? nodes.filter((n) => nodeMatchesSearch(n, q)) : nodes;

  if (visibleNodes.length === 0) {
    return (
      <div style={{ padding: "1.5rem", textAlign: "center", fontSize: "0.76rem", color: "var(--text-muted)" }}>
        无匹配节点
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {visibleNodes.map((node) => (
        <DiffNodeItem
          key={node.id}
          node={node}
          isBefore={isBefore}
          searchQuery={q}
          removedIds={removedIds}
          movedInIds={movedInIds}
          expandAll={expandAll}
        />
      ))}
    </div>
  );
}

function DiffNodeItem({
  node,
  isBefore,
  searchQuery,
  removedIds,
  movedInIds,
  expandAll,
}: {
  node: TabTreeNode;
  isBefore: boolean;
  searchQuery: string;
  removedIds?: Set<string | number>;
  movedInIds?: Set<string | number>;
  expandAll: boolean;
}) {
  const [collapsed, setCollapsed] = useState(false);

  useEffect(() => {
    setCollapsed(!expandAll);
  }, [expandAll]);

  const isGroup = node.isGroup;
  const isNewlyAddedGroup = !isBefore && isGroup && node.id.startsWith("group_");
  const isRemoved = isBefore && Boolean(removedIds?.has(node.tab.id));
  const isMovedIn = !isBefore && Boolean(movedInIds?.has(node.tab.id));

  const bgColor = isRemoved
    ? "rgba(239, 68, 68, 0.12)"
    : isNewlyAddedGroup
      ? "rgba(16, 185, 129, 0.12)"
      : isMovedIn
        ? "var(--accent-subtle)"
        : "var(--bg-subtle)";

  const borderColor = isRemoved
    ? "rgba(239, 68, 68, 0.4)"
    : isNewlyAddedGroup
      ? "rgba(16, 185, 129, 0.4)"
      : isMovedIn
        ? "var(--accent-border)"
        : "var(--border-subtle)";

  const textColor = isRemoved
    ? "#ef4444"
    : isNewlyAddedGroup
      ? "#10b981"
      : isMovedIn
        ? "var(--accent-text)"
        : "var(--text-main)";

  const visibleChildren = searchQuery
    ? node.children.filter((c) => nodeMatchesSearch(c, searchQuery))
    : node.children;

  return (
    <div>
      <div
        onClick={() => visibleChildren.length > 0 && setCollapsed((prev) => !prev)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.35rem",
          padding: "0.28rem 0.5rem",
          borderRadius: "0.375rem",
          backgroundColor: bgColor,
          border: `1px solid ${borderColor}`,
          fontSize: "0.78rem",
          color: textColor,
          cursor: visibleChildren.length > 0 ? "pointer" : "default",
        }}
      >
        {visibleChildren.length > 0 && (
          <span style={{ display: "inline-flex", color: "var(--text-muted)", flexShrink: 0 }}>
            {collapsed && !searchQuery ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
          </span>
        )}
        {isGroup && (
          <span style={{ padding: "0 5px", borderRadius: "9999px", backgroundColor: "var(--bg-card)", border: "1px solid var(--border-subtle)", fontSize: "0.62rem", color: "var(--text-muted)", flexShrink: 0 }}>
            Group
          </span>
        )}
        {isRemoved && <span style={{ fontWeight: 700, flexShrink: 0 }}>−</span>}
        {isMovedIn && <span style={{ fontWeight: 700, flexShrink: 0 }}>+</span>}
        <span
          style={{
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
            flex: 1,
            textDecoration: isRemoved ? "line-through" : undefined,
          }}
        >
          {node.tab.title || node.tab.url}
        </span>
        {node.children.length > 0 && (
          <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", flexShrink: 0 }}>
            ({node.children.length})
          </span>
        )}
      </div>

      {visibleChildren.length > 0 && (!collapsed || Boolean(searchQuery)) && (
        <div
          style={{
            paddingLeft: "1.1rem",
            borderLeft: "1px solid var(--border-subtle)",
            marginTop: "0.22rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.22rem",
          }}
        >
          {visibleChildren.map((child) => (
            <DiffNodeItem
              key={child.id}
              node={child}
              isBefore={isBefore}
              searchQuery={searchQuery}
              removedIds={removedIds}
              movedInIds={movedInIds}
              expandAll={expandAll}
            />
          ))}
        </div>
      )}
    </div>
  );
}
