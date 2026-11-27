"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { toast } from "@/store/useFeedbackStore";
import { buildAIMergeReport } from "@/services/aiArchitectEngine";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import { MasonryColumns } from "@/components/ui/MasonryColumns";
import { buildTabTree } from "@/services/snapshotParser";
import { TabTreeNode, SideberyTab } from "@/types/sidebery";
import {
  Sparkles,
  X,
  Check,
  FolderTree,
  PanelsTopLeft,
  GitCommit,
  ListTree,
  Folder,
  Search,
  ChevronRight,
  ChevronDown,
  ChevronsUpDown,
} from "lucide-react";
import { extractDomain } from "@/utils/urlHelper";

interface AIDiffModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ComputedPanelSummary {
  panelId: string;
  panelName: string;
  beforeTabs: SideberyTab[];
  afterTabs: SideberyTab[];
  beforeTree: TabTreeNode[];
  afterTree: TabTreeNode[];
  removedTabs: SideberyTab[];
  movedInTabs: SideberyTab[];
  newGroups: TabTreeNode[];
  removedIds: Set<string | number>;
  movedInIds: Set<string | number>;
  changeCount: number;
}

export function AIDiffModal({ isOpen, onClose }: AIDiffModalProps) {
  const {
    aiProcessedCache,
    activeWindowId,
    updateProcessedTreeTarget,
    applySnapshotUpdate,
    addAiChatMessage,
    setActiveMergeReport,
  } = useSnapshotStore();

  const { uiSettings, crossPanelMerge } = useConfigStore();

  const [activePanelId, setActivePanelId] = useState<string>("");
  const [viewMode, setViewMode] = useState<"changes" | "tree">("changes");
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);
  const [onlyChangedPanels, setOnlyChangedPanels] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandAllTree, setExpandAllTree] = useState(true);

  const [selectedMode, setSelectedMode] = useState<"tree" | "panel">(
    aiProcessedCache?.targetMode || "tree"
  );
  // Explicit 3-way strategy: "keep" (stay in original panels) | "merge" (tree merge into existing panel) | "panel" (new top-level panels)
  const [strategy, setStrategy] = useState<"keep" | "merge" | "panel">(() => {
    if (aiProcessedCache?.targetMode === "panel") return "panel";
    if (aiProcessedCache?.targetPanelId || crossPanelMerge) return "merge";
    return "keep";
  });
  const [mergeTargetPanelId, setMergeTargetPanelId] = useState<string>(
    aiProcessedCache?.targetPanelId || ""
  );

  useEffect(() => {
    const checkWidth = () => setIsNarrowScreen(window.innerWidth < 800);
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  useEffect(() => {
    if (!aiProcessedCache) return;
    const mode = aiProcessedCache.targetMode || "tree";
    setSelectedMode(mode);
    if (mode === "panel") {
      setStrategy("panel");
      setMergeTargetPanelId("");
    } else if (aiProcessedCache.targetPanelId) {
      setStrategy("merge");
      setMergeTargetPanelId(aiProcessedCache.targetPanelId);
    } else {
      setStrategy(crossPanelMerge ? "merge" : "keep");
      setMergeTargetPanelId("");
    }
    setActivePanelId("");
  }, [aiProcessedCache?.timestamp]);

  const originalTabs = useMemo(() => {
    return aiProcessedCache?.originalSnapshot.windows[activeWindowId]?.tabs || [];
  }, [aiProcessedCache, activeWindowId]);

  const processedTabs = useMemo(() => {
    if (!aiProcessedCache) return [];
    return aiProcessedCache.processedSnapshot.windows[activeWindowId]?.tabs || [];
  }, [aiProcessedCache, activeWindowId]);

  const panelList = useMemo(() => {
    if (!aiProcessedCache) return [{ id: "main", name: "主面板" }];
    const panels = aiProcessedCache.processedSnapshot.panels || aiProcessedCache.originalSnapshot.panels || {};
    const list = Object.entries(panels).map(([id, p]: [string, any]) => ({
      id,
      name: p.name || (id === "main" ? "主面板" : id),
    }));
    return list.length > 0 ? list : [{ id: "main", name: "主面板" }];
  }, [aiProcessedCache]);

  const panelSummaries = useMemo(() => {
    const map = new Map<string, ComputedPanelSummary>();
    for (const p of panelList) {
      const beforeTabs = originalTabs.filter((t) => (t.panelId || "main") === p.id);
      const afterTabs = processedTabs.filter((t) => (t.panelId || "main") === p.id);
      const beforeTree = buildTabTree(beforeTabs);
      const afterTree = buildTabTree(afterTabs);

      const afterIds = new Set(afterTabs.map((t) => t.id));
      const beforeIds = new Set(beforeTabs.map((t) => t.id));
      const removedTabs = beforeTabs.filter((t) => !afterIds.has(t.id));
      const movedInTabs = afterTabs.filter(
        (t) => !beforeIds.has(t.id) && !String(t.id).startsWith("group_") && !String(t.id).startsWith("cat_header_")
      );
      const newGroups = afterTree.filter(
        (n) =>
          !beforeIds.has(n.tab.id) &&
          (n.isGroup ||
            (n.tab.url || "").startsWith("about:blank#category=") ||
            String(n.id).startsWith("group_") ||
            String(n.id).startsWith("cat_header_"))
      );
      const changeCount = removedTabs.length + movedInTabs.length + newGroups.length;

      map.set(p.id, {
        panelId: p.id,
        panelName: p.name,
        beforeTabs,
        afterTabs,
        beforeTree,
        afterTree,
        removedTabs,
        movedInTabs,
        newGroups,
        removedIds: new Set(removedTabs.map((t) => t.id)),
        movedInIds: new Set(movedInTabs.map((t) => t.id)),
        changeCount,
      });
    }
    return map;
  }, [panelList, originalTabs, processedTabs]);

  const displayedPanelList = useMemo(() => {
    let list = panelList;
    if (uiSettings?.hideEmptyPanels) {
      const nonEmpty = list.filter((p) => {
        const s = panelSummaries.get(p.id);
        return (s?.beforeTabs.length || 0) > 0 || (s?.afterTabs.length || 0) > 0;
      });
      if (nonEmpty.length > 0) list = nonEmpty;
    }
    if (onlyChangedPanels) {
      const changed = list.filter((p) => (panelSummaries.get(p.id)?.changeCount || 0) > 0);
      if (changed.length > 0) list = changed;
    }
    return list;
  }, [panelList, uiSettings?.hideEmptyPanels, onlyChangedPanels, panelSummaries]);

  useEffect(() => {
    if (!isOpen || displayedPanelList.length === 0) return;
    if (!displayedPanelList.some((p) => p.id === activePanelId)) {
      const firstChanged = displayedPanelList.find(
        (p) => (panelSummaries.get(p.id)?.changeCount || 0) > 0
      );
      setActivePanelId((firstChanged || displayedPanelList[0]).id);
    }
  }, [isOpen, displayedPanelList, activePanelId, panelSummaries]);

  const existingPanelsForTarget = useMemo(() => {
    const origPanels = aiProcessedCache?.originalSnapshot.panels || {};
    const list = Object.entries(origPanels).map(([id, p]: [string, any]) => ({
      id,
      name: p.name || (id === "main" ? "主面板" : id),
    }));
    return list.length > 0 ? list : [{ id: "main", name: "主面板" }];
  }, [aiProcessedCache?.originalSnapshot.panels]);

  const effectivePanelId = activePanelId || displayedPanelList[0]?.id || "main";
  const currentSummary = panelSummaries.get(effectivePanelId);
  const changedPanelsCount = Array.from(panelSummaries.values()).filter((s) => s.changeCount > 0).length;

  const handleStrategyChange = (nextStrategy: "keep" | "merge" | "panel") => {
    setStrategy(nextStrategy);
    setActivePanelId("");
    if (nextStrategy === "panel") {
      setSelectedMode("panel");
      updateProcessedTreeTarget("panel", undefined, { crossPanelMerge: true });
    } else if (nextStrategy === "keep") {
      setSelectedMode("tree");
      updateProcessedTreeTarget("tree", undefined, { crossPanelMerge: false });
    } else {
      setSelectedMode("tree");
      updateProcessedTreeTarget("tree", mergeTargetPanelId || undefined, { crossPanelMerge: true });
    }
  };

  const handleMergeTargetChange = (panelId: string) => {
    setMergeTargetPanelId(panelId);
    setActivePanelId("");
    updateProcessedTreeTarget("tree", panelId || undefined, { crossPanelMerge: true });
  };

  const handleDirectApply = () => {
    if (!aiProcessedCache) return;
    applySnapshotUpdate(aiProcessedCache.processedSnapshot, "应用 AI 重构方案");
    const report = buildAIMergeReport(aiProcessedCache);
    addAiChatMessage({
      id: `ai_report_${Date.now()}`,
      sender: "assistant",
      timestamp: Date.now(),
      text: `已完成重构写入：**${report.categorizedCount}** 个标签已归类，**${report.movedAcrossPanelsCount}** 个标签跨面板迁移。点击下方按钮可随时检索每个标签的去向：`,
      mergeReport: report,
    });
    onClose();
    setActiveMergeReport(report);
    toast.success("已应用方案并生成合并变更报告");
  };

  const summary = aiProcessedCache?.summary || {
    total: 0,
    categorizedCount: 0,
    uncategorizedCount: 0,
    categoryCounts: {},
  };
  const categorizedPercent =
    summary.total > 0 ? Math.round((summary.categorizedCount / summary.total) * 100) : 0;

  return (
    <Dialog.Root
      open={isOpen && Boolean(aiProcessedCache)}
      onOpenChange={(open) => !open && onClose()}
    >
      <Dialog.Backdrop style={{ zIndex: 110 }} />
      <Dialog.Positioner style={{ zIndex: 120 }}>
        {aiProcessedCache && (
        <Dialog.Content
          style={{
            width: "94vw",
            maxWidth: "1140px",
            height: "88vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            padding: 0,
            overflow: "hidden",
            boxShadow: "0 24px 48px rgba(0, 0, 0, 0.45)",
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
              <Sparkles size={16} style={{ color: "var(--accent)" }} />
              <Dialog.Title style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                AI 方案变更确认
              </Dialog.Title>
              <Badge
                variant="subtle"
                size="sm"
                style={{ backgroundColor: "rgba(16, 185, 129, 0.14)", color: "#10b981", fontSize: "0.7rem" }}
              >
                已归类 {summary.categorizedCount} ({categorizedPercent}%)
              </Badge>
              {summary.uncategorizedCount > 0 && (
                <Badge variant="subtle" size="sm" style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                  保持原位 {summary.uncategorizedCount}
                </Badge>
              )}
              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                {changedPanelsCount} / {panelList.length} 个面板有变更
              </span>
            </div>

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

          {/* Toolbar: Separated Rows (Strategy/View | Dedicated Panel Strip | Search) */}
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
            {/* Row 1: Fixed Strategy Controls + View Mode Switcher */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.65rem", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", flexWrap: "wrap" }}>
                <div
                  style={{
                    display: "inline-flex",
                    backgroundColor: "var(--bg-card)",
                    borderRadius: "9999px",
                    padding: "2px",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  {(
                    [
                      { id: "keep" as const, label: "原地建组", icon: <FolderTree size={12} />, title: "不跨面板，仅在各原面板内按分类建组" },
                      { id: "merge" as const, label: "跨面板归并", icon: <Folder size={12} />, title: "在现有面板中按类智能归并或集中至指定面板" },
                      { id: "panel" as const, label: "新建面板", icon: <PanelsTopLeft size={12} />, title: "抛弃旧面板划分，按每个分类新建顶层面板" },
                    ]
                  ).map((opt) => (
                    <Button
                      key={opt.id}
                      type="button"
                      variant={strategy === opt.id ? "solid" : "ghost"}
                      size="xs"
                      pill
                      onClick={() => handleStrategyChange(opt.id)}
                      title={opt.title}
                      style={{ fontSize: "0.71rem" }}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </Button>
                  ))}
                </div>

                {strategy === "merge" && (
                  <Select
                    value={mergeTargetPanelId}
                    onChange={(e) => handleMergeTargetChange(e.target.value)}
                    style={{ fontSize: "0.72rem", padding: "0.2rem 0.55rem" }}
                  >
                    <option value="">智能归并至最多标签面板</option>
                    {existingPanelsForTarget.map((p) => (
                      <option key={p.id} value={p.id}>
                        全部集中至: {p.name}
                      </option>
                    ))}
                  </Select>
                )}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                <Button
                  type="button"
                  variant={viewMode === "changes" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setViewMode("changes")}
                >
                  <GitCommit size={13} />
                  <span>变更摘要</span>
                </Button>
                <Button
                  type="button"
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

            {/* Row 2: Dedicated Panel Strip (hidden in New-Panel Summary mode where global waterfall shows all new panels at once) */}
            {(strategy !== "panel" || viewMode === "tree") && (
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", minWidth: 0 }}>
                {isNarrowScreen ? (
                  <Select
                    value={effectivePanelId}
                    onChange={(e) => setActivePanelId(e.target.value)}
                    style={{ flex: 1, maxWidth: "280px" }}
                  >
                    {displayedPanelList.map((p) => {
                      const s = panelSummaries.get(p.id);
                      const chg = s?.changeCount || 0;
                      return (
                        <option key={p.id} value={p.id}>
                          {p.name} ({s?.beforeTabs.length || 0} → {s?.afterTabs.length || 0}
                          {chg > 0 ? ` · ${chg} 变更` : ""})
                        </option>
                      );
                    })}
                  </Select>
                ) : (
                  <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", overflowX: "auto", paddingBottom: "2px", width: "100%" }}>
                    {displayedPanelList.map((p) => {
                      const isActive = p.id === effectivePanelId;
                      const s = panelSummaries.get(p.id);
                      const chg = s?.changeCount || 0;
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => setActivePanelId(p.id)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.35rem",
                            padding: "0.26rem 0.65rem",
                            borderRadius: "9999px",
                            border: "1px solid",
                            borderColor: isActive ? "var(--accent-solid)" : "var(--border-subtle)",
                            backgroundColor: isActive ? "var(--accent-subtle)" : "var(--bg-card)",
                            color: isActive ? "var(--accent-text)" : chg > 0 ? "var(--text-main)" : "var(--text-muted)",
                            fontSize: "0.73rem",
                            fontWeight: isActive || chg > 0 ? 600 : 400,
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            cursor: "pointer",
                          }}
                        >
                          <span>{p.name}</span>
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
                            <span style={{ fontSize: "0.68rem", opacity: 0.6 }}>{s?.afterTabs.length || 0}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Row 3: Search + Quick Toggles */}
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
                  placeholder={strategy === "panel" && viewMode === "changes" ? "搜索新建面板名、标签标题或来源面板..." : "搜索标签标题、域名或新建分类..."}
                  style={{ paddingLeft: "1.9rem", fontSize: "0.76rem", paddingTop: "0.28rem", paddingBottom: "0.28rem" }}
                />
              </div>

              {(strategy !== "panel" || viewMode === "tree") && changedPanelsCount > 0 && (
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
              {strategy === "panel" ? (
                <PanelModeGlobalSummaryView
                  panelList={panelList}
                  panelSummaries={panelSummaries}
                  originalTabs={originalTabs}
                  originalPanels={aiProcessedCache.originalSnapshot.panels || {}}
                  searchQuery={searchQuery}
                />
              ) : (
                currentSummary && (
                  <ChangesSummaryView summary={currentSummary} searchQuery={searchQuery} />
                )
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
                  <span>重构前</span>
                  <Badge variant="outline" size="sm">{currentSummary?.beforeTabs.length || 0} 标签</Badge>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
                  <DiffTreeColumn
                    nodes={currentSummary?.beforeTree || []}
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
                  <span>重构后</span>
                  <Badge variant="subtle" size="sm">{currentSummary?.afterTabs.length || 0} 标签</Badge>
                </div>

                <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
                  <DiffTreeColumn
                    nodes={currentSummary?.afterTree || []}
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
              确认应用后将写入快照树，并自动生成可搜索的合并变更报告。
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <Button variant="ghost" size="xs" pill onClick={onClose}>
                取消
              </Button>
              <Button variant="solid" size="xs" pill onClick={handleDirectApply}>
                <Check size={14} />
                <span>确认应用并生成报告</span>
              </Button>
            </div>
          </div>
        </Dialog.Content>
        )}
      </Dialog.Positioner>
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

function PanelModeGlobalSummaryView({
  panelList,
  panelSummaries,
  originalTabs,
  originalPanels,
  searchQuery,
}: {
  panelList: { id: string; name: string }[];
  panelSummaries: Map<string, ComputedPanelSummary>;
  originalTabs: SideberyTab[];
  originalPanels: Record<string, any>;
  searchQuery: string;
}) {
  const newPanels = panelList.filter((p) => p.id.startsWith("panel_cat_"));
  const legacyPanels = panelList.filter((p) => !p.id.startsWith("panel_cat_"));

  const [expandedPanels, setExpandedPanels] = useState<Set<string>>(
    () => new Set(newPanels.map((p) => p.id))
  );

  useEffect(() => {
    setExpandedPanels(new Set(panelList.filter((p) => p.id.startsWith("panel_cat_")).map((p) => p.id)));
  }, [panelList]);

  const origTabPanelNameById = useMemo(() => {
    const map = new Map<string | number, string>();
    for (const t of originalTabs) {
      const pId = t.panelId || "main";
      const pName = originalPanels[pId]?.name || (pId === "main" ? "主面板" : pId);
      map.set(t.id, pName);
    }
    return map;
  }, [originalTabs, originalPanels]);

  const q = searchQuery.trim().toLowerCase();

  const filteredNewPanels = newPanels.filter((p) => {
    const s = panelSummaries.get(p.id);
    if (!s || s.afterTabs.length === 0) return false;
    if (!q) return true;
    if (p.name.toLowerCase().includes(q)) return true;
    return s.afterTabs.some(
      (t) => matchesSearch(t, q) || (origTabPanelNameById.get(t.id) || "").toLowerCase().includes(q)
    );
  });

  const togglePanelCard = (id: string) => {
    setExpandedPanels((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const totalMovedTabs = newPanels.reduce(
    (acc, p) => acc + (panelSummaries.get(p.id)?.afterTabs.length || 0),
    0
  );
  const retainedOldTabs = legacyPanels.reduce(
    (acc, p) => acc + (panelSummaries.get(p.id)?.afterTabs.length || 0),
    0
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
      {/* Top Compact Overview of Panel Reconstruction */}
      <div
        style={{
          padding: "0.7rem 0.9rem",
          borderRadius: "0.75rem",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          gap: "0.45rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.78rem", fontWeight: 700, color: "var(--accent-text)" }}>
            <PanelsTopLeft size={14} />
            <span>全局重建 {newPanels.length} 个顶层面板（迁入 {totalMovedTabs} 个标签）</span>
          </div>
          {retainedOldTabs > 0 && (
            <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
              原面板留守 {retainedOldTabs} 个固定/豁免或未归类标签
            </span>
          )}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
          {legacyPanels.map((lp) => {
            const s = panelSummaries.get(lp.id);
            if (!s || (s.beforeTabs.length === 0 && s.afterTabs.length === 0)) return null;
            return (
              <Badge key={lp.id} variant="outline" size="sm" style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                {lp.name}: {s.beforeTabs.length} → {s.afterTabs.length}
              </Badge>
            );
          })}
        </div>
      </div>

      {/* Waterfall Cards for Each Newly Created Panel */}
      {filteredNewPanels.length === 0 ? (
        <div style={{ padding: "2rem", textAlign: "center", fontSize: "0.8rem", color: "var(--text-muted)" }}>
          {q ? `未匹配到 “${searchQuery}” 相关新建面板或标签` : "当前方案暂无新建分类面板"}
        </div>
      ) : (
        <MasonryColumns
          items={filteredNewPanels}
          getKey={(p) => p.id}
          estimateHeight={(p) => 48 + Math.min((panelSummaries.get(p.id)?.afterTabs.length || 0) * 26, 260)}
          renderItem={(panel) => {
            const s = panelSummaries.get(panel.id);
            const tabs = (s?.afterTabs || []).filter(
              (t) =>
                !q ||
                panel.name.toLowerCase().includes(q) ||
                matchesSearch(t, q) ||
                (origTabPanelNameById.get(t.id) || "").toLowerCase().includes(q)
            );
            const isExpanded = expandedPanels.has(panel.id) || Boolean(q);

            const sourceBreakdown = new Map<string, number>();
            for (const t of s?.afterTabs || []) {
              const src = origTabPanelNameById.get(t.id) || "原面板";
              sourceBreakdown.set(src, (sourceBreakdown.get(src) || 0) + 1);
            }
            const sourceHint = Array.from(sourceBreakdown.entries())
              .map(([name, cnt]) => `${name}(${cnt})`)
              .join(" · ");

            return (
              <div
                style={{
                  borderRadius: "0.65rem",
                  border: "1px solid var(--accent-border)",
                  backgroundColor: "var(--bg-card)",
                  overflow: "hidden",
                }}
              >
                <button
                  type="button"
                  onClick={() => togglePanelCard(panel.id)}
                  style={{
                    width: "100%",
                    padding: "0.55rem 0.75rem",
                    backgroundColor: "var(--accent-subtle)",
                    border: "none",
                    color: "var(--text-main)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.2rem",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <div style={{ width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.4rem" }}>
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", minWidth: 0, fontSize: "0.78rem", fontWeight: 700, color: "var(--accent-text)" }}>
                      {isExpanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
                      <PanelsTopLeft size={13} style={{ flexShrink: 0 }} />
                      <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {panel.name}
                      </span>
                    </span>
                    <Badge variant="subtle" size="sm" style={{ fontSize: "0.66rem", flexShrink: 0 }}>
                      {s?.afterTabs.length || 0}
                    </Badge>
                  </div>
                  {sourceHint && (
                    <div style={{ fontSize: "0.66rem", color: "var(--text-muted)", paddingLeft: "1.1rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      来自: {sourceHint}
                    </div>
                  )}
                </button>

                {isExpanded && tabs.length > 0 && (
                  <div
                    style={{
                      padding: "0.45rem 0.7rem",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                      maxHeight: "260px",
                      overflowY: "auto",
                    }}
                  >
                    {tabs.map((tab) => {
                      const srcName = origTabPanelNameById.get(tab.id);
                      const domain = extractDomain(tab.url);
                      return (
                        <div
                          key={tab.id}
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
                            · {tab.title || tab.url}
                          </span>
                          <span style={{ fontSize: "0.65rem", color: "var(--text-muted)", flexShrink: 0 }}>
                            {srcName ? `${srcName} →` : domain}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }}
        />
      )}
    </div>
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
    return matchesSearch(g.tab, q) || g.children.some((c) => matchesSearch(c.tab, q));
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
        面板「{summary.panelName}」无变更（保持 {summary.afterTabs.length} 个标签原位）
      </div>
    );
  }

  if (q && filteredGroups.length === 0 && filteredMovedIn.length === 0 && filteredRemoved.length === 0) {
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
      {filteredGroups.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#10b981" }}>
            新建分类 / 分组 ({filteredGroups.length})
          </div>

          <MasonryColumns
            items={filteredGroups}
            getKey={(group) => group.id}
            estimateHeight={(group) => 44 + Math.min(group.children.length * 24, 260)}
            renderItem={(group) => {
              const isExpanded = expandedGroups.has(group.id) || Boolean(q);
              return (
                <div
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
                        {group.tab.title || "未命名分类"}
                      </span>
                    </span>
                    <Badge variant="subtle" size="sm" style={{ fontSize: "0.66rem", color: "#10b981", flexShrink: 0 }}>
                      {group.children.length}
                    </Badge>
                  </button>

                  {isExpanded && group.children.length > 0 && (
                    <div
                      style={{
                        padding: "0.45rem 0.7rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.25rem",
                        maxHeight: "260px",
                        overflowY: "auto",
                      }}
                    >
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
            }}
          />
        </div>
      )}

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

      {filteredRemoved.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
          <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#ef4444" }}>
            移出此面板 ({filteredRemoved.length})
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

  const isGroup = node.isGroup || Boolean((node as any).categoryName);
  const isNewlyAddedGroup =
    !isBefore && (node.id.startsWith("group_") || node.id.startsWith("cat_header_") || Boolean((node as any).categoryName));
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
            {node.id.startsWith("cat_header_") ? "分类" : "Group"}
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
