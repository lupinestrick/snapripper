"use client";

import React, { useState, useMemo } from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { computeSnapshotDiff } from "@/services/diffEngine";
import { clusterSnapshotTabs } from "@/services/tabClusterEngine";
import { PanelDiffResult, SideberySnapshot } from "@/types/sidebery";
import { ClusterGranularity } from "@/types/ai";
import { DiffHopupModal } from "./DiffHopupModal";
import { DiffSettingsModal } from "./DiffSettingsModal";
import { flattenTabTree } from "@/services/snapshotParser";
import { getDuplicateUrlSet } from "@/services/treeOperations";
import { SidebarDrawerTrigger } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  FolderPlus,
  Bot,
  AlertCircle,
  Sparkles,
  Globe,
  Settings,
  Layers,
  CheckCircle2,
  ArrowRight,
  X,
  Play,
  Check,
  Undo2,
} from "lucide-react";

interface PipelineStepState {
  enableDedup: boolean;
  enableRules: boolean;
  enableDomainMerge: boolean;
  enableLocalCluster: boolean;
  enableAI: boolean;
}

const GRANULARITY_LABELS: Record<ClusterGranularity, string> = {
  coarse: "粗略",
  balanced: "均衡",
  fine: "细致",
};

export function ProcessPage() {
  const { rawSnapshot, rootNodes, activePanelId, applySnapshotUpdate, aiProcessedCache, undoStack, undo } =
    useSnapshotStore();
  const {
    rulesSettings,
    domainMergeConfig,
    processScope,
    selectedProcessPanelIds,
    exemptPinned,
    exemptInternalPages,
    preserveSubtrees,
    crossPanelMerge,
    createGroupTabs,
    setActivePage,
  } = useConfigStore();

  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [appliedNotification, setAppliedNotification] = useState<string | null>(null);
  const [clusterGranularity, setClusterGranularity] = useState<ClusterGranularity>("balanced");

  const [pipeline, setPipeline] = useState<PipelineStepState>({
    enableDedup: true,
    enableRules: true,
    enableDomainMerge: false,
    enableLocalCluster: true,
    enableAI: false,
  });

  const [lastExecutedOptions, setLastExecutedOptions] =
    useState<PipelineStepState>(pipeline);

  const [diffResults, setDiffResults] = useState<{
    panelDiffs: PanelDiffResult[];
    newSnapshot: SideberySnapshot | null;
    totalDeduped: number;
    totalGroupsCreated: number;
  }>({
    panelDiffs: [],
    newSnapshot: null,
    totalDeduped: 0,
    totalGroupsCreated: 0,
  });

  const allTabs = useMemo(
    () => (rawSnapshot ? flattenTabTree(rootNodes) : []),
    [rawSnapshot, rootNodes]
  );

  const duplicateUrlSet = useMemo(() => getDuplicateUrlSet(allTabs), [allTabs]);
  const totalDuplicateTabs = useMemo(
    () =>
      allTabs.filter(
        (t) => duplicateUrlSet.has((t.url || "").replace(/#.*$/, "").trim()) && !t.pinned
      ).length,
    [allTabs, duplicateUrlSet]
  );

  const clusterReport = useMemo(() => {
    if (!rawSnapshot || allTabs.length === 0) return null;
    return clusterSnapshotTabs(allTabs, rawSnapshot.panels, clusterGranularity);
  }, [rawSnapshot, allTabs, clusterGranularity]);

  if (!rawSnapshot) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          height: "60vh",
          color: "var(--text-muted)",
          gap: "1rem",
        }}
      >
        <AlertCircle size={36} color="var(--text-muted)" />
        <p style={{ fontSize: "0.9rem" }}>暂无快照数据</p>
        <Button variant="solid" size="sm" pill onClick={() => setActivePage("workbench")}>
          前往工作台导入
        </Button>
      </div>
    );
  }

  const totalTabs = allTabs.length;
  const activeRulesCount = rulesSettings.rules.filter((r) => r.enabled).length;
  const multiTabClustersCount =
    clusterReport?.clusters.filter((c) => c.tabCount >= 2 && c.cohesionReason !== "tail_misc")
      .length || 0;

  const panelsList = rawSnapshot.panels
    ? Object.entries(rawSnapshot.panels).map(([id, p]) => ({ id, name: p.name || id }))
    : [];

  const scopeLabel =
    processScope === "current"
      ? `当前面板${activePanelId && rawSnapshot.panels?.[activePanelId]?.name ? ` (${rawSnapshot.panels[activePanelId].name})` : ""}`
      : processScope === "selected"
        ? `已选 ${selectedProcessPanelIds.length} 面板`
        : "全部面板";

  const runDiffComputation = (options: PipelineStepState) => {
    setLastExecutedOptions(options);
    const currentConfig = useConfigStore.getState();
    const currentAiCache = useSnapshotStore.getState().aiProcessedCache;

    const aiMap =
      options.enableAI && currentAiCache?.classificationMap
        ? new Map(Object.entries(currentAiCache.classificationMap))
        : undefined;
    const aiCats = options.enableAI ? currentAiCache?.categoryNames : undefined;

    const result = computeSnapshotDiff(
      rawSnapshot,
      {
        enableDedup: options.enableDedup,
        enableRules: options.enableRules,
        enableDomainMerge: options.enableDomainMerge,
        domainMergeConfig: currentConfig.domainMergeConfig,
        enableLocalCluster: options.enableLocalCluster,
        clusterGranularity,
        enableAICategorize: options.enableAI,
        aiClassificationMap: aiMap,
        aiCategoryNames: aiCats,
        scope: currentConfig.processScope,
        targetPanelIds: currentConfig.selectedProcessPanelIds,
        currentActivePanelId: activePanelId || undefined,
        exemptPinned: currentConfig.exemptPinned,
        exemptInternalPages: currentConfig.exemptInternalPages,
        preserveSubtrees: currentConfig.preserveSubtrees,
        crossPanelMerge: currentConfig.crossPanelMerge,
        createGroupTabs: currentConfig.createGroupTabs,
      },
      currentConfig.rulesSettings
    );

    setDiffResults(result);
    setDiffModalOpen(true);
  };

  const handleConfirmApply = () => {
    if (diffResults.newSnapshot) {
      applySnapshotUpdate(diffResults.newSnapshot, "执行处理中心变更");
      setDiffModalOpen(false);
      setAppliedNotification("已应用处理变更至快照");
    }
  };

  const toggleStep = (key: keyof PipelineStepState) => {
    setPipeline((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const applyPreset = (preset: "full" | "dedup" | "cluster") => {
    if (preset === "full") {
      const next: PipelineStepState = {
        enableDedup: true,
        enableRules: true,
        enableDomainMerge: true,
        enableLocalCluster: true,
        enableAI: false,
      };
      setPipeline(next);
      runDiffComputation(next);
    } else if (preset === "dedup") {
      const next: PipelineStepState = {
        enableDedup: true,
        enableRules: false,
        enableDomainMerge: false,
        enableLocalCluster: false,
        enableAI: false,
      };
      setPipeline(next);
      runDiffComputation(next);
    } else {
      const next: PipelineStepState = {
        enableDedup: true,
        enableRules: false,
        enableDomainMerge: false,
        enableLocalCluster: true,
        enableAI: false,
      };
      setPipeline(next);
      runDiffComputation(next);
    }
  };

  const activeStepsCount = Object.values(pipeline).filter(Boolean).length;

  const pipelineRows: Array<{
    key: keyof PipelineStepState;
    order: number;
    title: string;
    icon: React.ReactNode;
    badge: React.ReactNode;
    disabled?: boolean;
    extraControl?: React.ReactNode;
  }> = [
    {
      key: "enableDedup",
      order: 1,
      title: "URL 去重",
      icon: <Trash2 size={16} />,
      badge:
        totalDuplicateTabs > 0 ? (
          <Badge
            variant="subtle"
            size="sm"
            style={{ backgroundColor: "rgba(239, 68, 68, 0.14)", color: "var(--danger)" }}
          >
            {totalDuplicateTabs} 重复
          </Badge>
        ) : (
          <Badge variant="subtle" size="sm" style={{ color: "var(--success)" }}>
            无重复
          </Badge>
        ),
    },
    {
      key: "enableRules",
      order: 2,
      title: "规则分组",
      icon: <FolderPlus size={16} />,
      badge: (
        <Badge variant="subtle" size="sm">
          {activeRulesCount} 条启用
        </Badge>
      ),
    },
    {
      key: "enableDomainMerge",
      order: 3,
      title: "同域名合并",
      icon: <Globe size={16} />,
      badge: (
        <Badge variant="subtle" size="sm">
          阈值 ≥{domainMergeConfig.minThreshold || 2}
        </Badge>
      ),
    },
    {
      key: "enableLocalCluster",
      order: 4,
      title: "本地微簇聚拢",
      icon: <Layers size={16} />,
      badge: (
        <Badge
          variant="subtle"
          size="sm"
          style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent-text)" }}
        >
          {multiTabClustersCount} 组 · 0 Token
        </Badge>
      ),
      extraControl: (
        <div
          onClick={(e) => e.stopPropagation()}
          style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}
        >
          {(["coarse", "balanced", "fine"] as ClusterGranularity[]).map((g) => (
            <button
              key={g}
              type="button"
              onClick={() => setClusterGranularity(g)}
              style={{
                padding: "1px 6px",
                borderRadius: "9999px",
                fontSize: "0.66rem",
                border: "1px solid",
                borderColor:
                  clusterGranularity === g ? "var(--accent-border)" : "var(--border-subtle)",
                backgroundColor:
                  clusterGranularity === g ? "var(--accent-subtle)" : "transparent",
                color:
                  clusterGranularity === g ? "var(--accent-text)" : "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              {GRANULARITY_LABELS[g]}
            </button>
          ))}
        </div>
      ),
    },
    {
      key: "enableAI",
      order: 5,
      title: "AI 方案映射",
      icon: <Bot size={16} />,
      disabled: !aiProcessedCache,
      badge: aiProcessedCache ? (
        <Badge
          variant="subtle"
          size="sm"
          style={{ backgroundColor: "rgba(16, 185, 129, 0.14)", color: "var(--success)" }}
        >
          {aiProcessedCache.categoryNames?.length || 0} 分类缓存
        </Badge>
      ) : (
        <Badge variant="subtle" size="sm" style={{ color: "var(--text-muted)" }}>
          无缓存
        </Badge>
      ),
      extraControl: !aiProcessedCache ? (
        <Button
          variant="ghost"
          size="xs"
          pill
          onClick={(e) => {
            e.stopPropagation();
            setActivePage("ai");
          }}
          style={{ fontSize: "0.7rem", color: "var(--accent-text)" }}
        >
          <span>AI 架构师</span>
          <ArrowRight size={11} />
        </Button>
      ) : undefined,
    },
  ];

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: "var(--text-main)",
      }}
    >
      {/* Unified Top Navbar for Process Center */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.55rem 1.25rem",
          minHeight: "50px",
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
          flexWrap: "wrap",
          gap: "0.6rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <SidebarDrawerTrigger />
          <h1 style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            处理中心
          </h1>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
          <Button variant="subtle" size="xs" pill onClick={() => applyPreset("full")}>
            <Sparkles size={12} />
            <span>全量预设</span>
          </Button>
          <Button variant="outline" size="xs" pill onClick={() => applyPreset("dedup")}>
            <span>仅去重</span>
          </Button>
          <Button variant="outline" size="xs" pill onClick={() => applyPreset("cluster")}>
            <span>去重+微簇</span>
          </Button>
          {undoStack.length > 0 && (
            <Button
              variant="outline"
              size="xs"
              pill
              onClick={undo}
              title={`撤销上一步修改 (${undoStack.length})`}
            >
              <Undo2 size={12} />
              <span>撤销</span>
            </Button>
          )}
          <Button
            variant="ghost"
            size="xs"
            pill
            onClick={() => setPageSettingsOpen(true)}
            title="处理范围与策略设置"
            style={{ color: "var(--text-muted)", padding: "0.35rem" }}
          >
            <Settings size={15} />
          </Button>
        </div>
      </div>

      {/* Scrollable Body */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ padding: "1.25rem 2rem 70px", maxWidth: "880px", margin: "0 auto" }}>

      {/* Compact Telemetry Strip */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
          padding: "0.65rem 1rem",
          borderRadius: "0.75rem",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          marginBottom: "1rem",
          fontSize: "0.78rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "1rem" }}>
          <span>
            标签 <strong style={{ color: "var(--text-main)" }}>{totalTabs}</strong>
          </span>
          <span>
            重复{" "}
            <strong style={{ color: totalDuplicateTabs > 0 ? "var(--danger)" : "var(--success)" }}>
              {totalDuplicateTabs}
            </strong>
          </span>
          <span>
            规则 <strong style={{ color: "var(--text-main)" }}>{activeRulesCount}</strong>
          </span>
          <span>
            微簇 <strong style={{ color: "var(--accent-text)" }}>{clusterReport?.clusters.length || 0}</strong>
          </span>
        </div>

        <button
          type="button"
          onClick={() => setPageSettingsOpen(true)}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "0.3rem",
            padding: "2px 8px",
            borderRadius: "9999px",
            border: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-card)",
            color: "var(--text-muted)",
            fontSize: "0.72rem",
            cursor: "pointer",
          }}
        >
          <span>范围：{scopeLabel}</span>
        </button>
      </div>

      {/* Applied Notification */}
      {appliedNotification && (
        <div
          style={{
            padding: "0.6rem 1rem",
            borderRadius: "0.75rem",
            backgroundColor: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.82rem" }}>
            <CheckCircle2 size={15} style={{ color: "var(--success)" }} />
            <span>{appliedNotification}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
            <Button variant="solid" size="xs" pill onClick={() => setActivePage("workbench")}>
              查看工作台
            </Button>
            <Button
              variant="ghost"
              size="xs"
              pill
              onClick={() => setAppliedNotification(null)}
              style={{ padding: "4px" }}
            >
              <X size={13} />
            </Button>
          </div>
        </div>
      )}

      {/* Composable Pipeline List */}
      <div
        style={{
          borderRadius: "0.9rem",
          border: "1px solid var(--border-card)",
          backgroundColor: "var(--bg-surface)",
          overflow: "hidden",
        }}
      >
        {pipelineRows.map((row, idx) => {
          const isChecked = pipeline[row.key] && !row.disabled;
          return (
            <div
              key={row.key}
              onClick={() => !row.disabled && toggleStep(row.key)}
              style={{
                padding: "0.85rem 1.1rem",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)",
                backgroundColor: isChecked ? "var(--bg-card)" : "transparent",
                opacity: row.disabled ? 0.55 : 1,
                cursor: row.disabled ? "default" : "pointer",
                transition: "background-color 0.12s ease",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", minWidth: 0, flexWrap: "wrap" }}>
                {/* Step Checkbox */}
                <span
                  style={{
                    width: "18px",
                    height: "18px",
                    borderRadius: "5px",
                    border: "1px solid",
                    borderColor: isChecked ? "var(--accent-solid)" : "var(--border-card)",
                    backgroundColor: isChecked ? "var(--accent-solid)" : "transparent",
                    color: "#fff",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isChecked && <Check size={12} strokeWidth={3} />}
                </span>

                <span
                  style={{
                    fontSize: "0.68rem",
                    fontFamily: "monospace",
                    color: "var(--text-muted)",
                    width: "14px",
                  }}
                >
                  0{row.order}
                </span>

                <span
                  style={{
                    width: "30px",
                    height: "30px",
                    borderRadius: "9999px",
                    backgroundColor: isChecked ? "var(--accent-subtle)" : "var(--bg-subtle)",
                    color: isChecked ? "var(--accent)" : "var(--text-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {row.icon}
                </span>

                <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)" }}>
                  {row.title}
                </span>

                {row.badge}
              </div>

              <div
                style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexShrink: 0 }}
                onClick={(e) => e.stopPropagation()}
              >
                {row.extraControl}

                {!row.disabled && (
                  <Button
                    variant="ghost"
                    size="xs"
                    pill
                    onClick={() =>
                      runDiffComputation({
                        enableDedup: row.key === "enableDedup",
                        enableRules: row.key === "enableRules",
                        enableDomainMerge: row.key === "enableDomainMerge",
                        enableLocalCluster: row.key === "enableLocalCluster",
                        enableAI: row.key === "enableAI",
                      })
                    }
                    style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}
                  >
                    单独预览
                  </Button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Primary Execute Bar */}
      <div
        style={{
          marginTop: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
          已选 {activeStepsCount} 步 · {crossPanelMerge ? "跨面板聚合" : "单面板内"} ·{" "}
          {createGroupTabs ? "原生折叠组" : "虚拟标题组"}
        </div>

        <Button
          variant="solid"
          size="md"
          pill
          disabled={activeStepsCount === 0}
          onClick={() => runDiffComputation(pipeline)}
          style={{
            backgroundColor: "var(--accent-solid)",
            color: "#fff",
            fontWeight: 600,
            padding: "0.5rem 1.4rem",
          }}
        >
          <Play size={14} />
          <span>预览流水线变更 (DIFF)</span>
        </Button>
      </div>

      {/* Diff Modal */}
      <DiffHopupModal
        isOpen={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        onConfirm={handleConfirmApply}
        panelDiffs={diffResults.panelDiffs}
        totalDeduped={diffResults.totalDeduped}
        totalGroupsCreated={diffResults.totalGroupsCreated}
        onRecomputeDiff={() => runDiffComputation(lastExecutedOptions)}
      />

      {/* Settings Modal */}
      <DiffSettingsModal
        isOpen={pageSettingsOpen}
        onClose={() => setPageSettingsOpen(false)}
        activePanelId={activePanelId || undefined}
        panels={panelsList}
      />
        </div>
      </div>
    </div>
  );
}

export default ProcessPage;
