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
import { Dialog } from "@/components/ui/dialog";
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
  Workflow,
  X,
  Play,
  Check,
  Undo2,
} from "lucide-react";

type PipelinePresetId = "cleanup" | "full" | "quick";

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
    setCrossPanelMerge,
    createGroupTabs,
    setCreateGroupTabs,
    setActivePage,
  } = useConfigStore();

  const [diffModalOpen, setDiffModalOpen] = useState(false);
  const [pageSettingsOpen, setPageSettingsOpen] = useState(false);
  const [pipelineModalOpen, setPipelineModalOpen] = useState(false);
  const [appliedNotification, setAppliedNotification] = useState<string | null>(null);
  const [clusterGranularity, setClusterGranularity] = useState<ClusterGranularity>("balanced");
  const [activePresetId, setActivePresetId] = useState<PipelinePresetId | null>("cleanup");

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
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          color: "var(--text-main)",
        }}
      >
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
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
            <SidebarDrawerTrigger />
            <h1 style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
              处理中心
            </h1>
          </div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            flex: 1,
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

  const runDiffComputation = (
    options: PipelineStepState,
    granularityOverride?: ClusterGranularity
  ) => {
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
        clusterGranularity: granularityOverride ?? clusterGranularity,
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
    setActivePresetId(null);
    setPipeline((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const pipelinePresets: Array<{
    id: PipelinePresetId;
    title: string;
    subtitle: string;
    steps: PipelineStepState;
  }> = [
    {
      id: "cleanup",
      title: "一键大扫除",
      subtitle: "去重 + 规则分组 + 本地微簇",
      steps: {
        enableDedup: true,
        enableRules: true,
        enableDomainMerge: false,
        enableLocalCluster: true,
        enableAI: false,
      },
    },
    {
      id: "full",
      title: "全量整理",
      subtitle: "去重 + 规则 + 同域名 + 微簇",
      steps: {
        enableDedup: true,
        enableRules: true,
        enableDomainMerge: true,
        enableLocalCluster: true,
        enableAI: false,
      },
    },
    {
      id: "quick",
      title: "快速清理",
      subtitle: "仅执行 URL 去重 + 微簇聚拢",
      steps: {
        enableDedup: true,
        enableRules: false,
        enableDomainMerge: false,
        enableLocalCluster: true,
        enableAI: false,
      },
    },
  ];

  const selectPipelinePreset = (presetId: PipelinePresetId) => {
    const found = pipelinePresets.find((p) => p.id === presetId);
    if (!found) return;
    setActivePresetId(presetId);
    setPipeline(found.steps);
  };

  const activeStepsCount = Object.values(pipeline).filter(Boolean).length;

  const pipelineRows: Array<{
    key: keyof PipelineStepState;
    order: number;
    title: string;
    description: string;
    icon: React.ReactNode;
    badge: React.ReactNode;
    disabled?: boolean;
    extraControl?: React.ReactNode;
  }> = [
    {
      key: "enableDedup",
      order: 1,
      title: "URL 去重",
      description: "保持原有树形结构不变，安全清理重复打开的相同页面。",
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
      description: "按照已启用的分类规则，将匹配的标签自动归组或移入目标面板。",
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
      description: "把同一主域名下的散落标签页聚合成折叠组，减少根目录杂乱。",
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
      description: "无需消耗 AI Token，按域名与标题相似度在本地智能聚类。",
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
      description: aiProcessedCache
        ? "将 AI 架构师生成的分类方案预览并合并至当前工作台。"
        : "尚无 AI 分类缓存，前往 AI 架构师生成方案后可在此一键落地。",
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
          <Button
            variant="subtle"
            size="xs"
            pill
            onClick={() => setPipelineModalOpen(true)}
            title="打开组合流水线与预设方案"
          >
            <Workflow size={13} />
            <span>流水线</span>
          </Button>

          <button
            type="button"
            onClick={() => setPageSettingsOpen(true)}
            title="点击更改作用范围与处理策略"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              padding: "3px 10px",
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
        <div style={{ padding: "1.25rem 2rem 3rem", maxWidth: "920px", margin: "0 auto" }}>

      {/* Compact Telemetry + Quick Strategy Strip */}
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
            标签 <strong style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{totalTabs}</strong>
          </span>
          <span>
            重复{" "}
            <strong style={{ color: totalDuplicateTabs > 0 ? "var(--danger)" : "var(--success)", fontVariantNumeric: "tabular-nums" }}>
              {totalDuplicateTabs}
            </strong>
          </span>
          <span>
            规则 <strong style={{ color: "var(--text-main)", fontVariantNumeric: "tabular-nums" }}>{activeRulesCount}</strong>
          </span>
          <span>
            微簇 <strong style={{ color: "var(--accent-text)", fontVariantNumeric: "tabular-nums" }}>{multiTabClustersCount}</strong>
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexWrap: "wrap" }}>
          {[
            {
              label: "跨面板聚合",
              active: crossPanelMerge,
              onClick: () => setCrossPanelMerge(!crossPanelMerge),
            },
            {
              label: "原生折叠组",
              active: createGroupTabs,
              onClick: () => setCreateGroupTabs(!createGroupTabs),
            },
          ].map((opt) => (
            <button
              key={opt.label}
              type="button"
              onClick={opt.onClick}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.28rem",
                padding: "2px 8px",
                borderRadius: "9999px",
                fontSize: "0.7rem",
                border: "1px solid",
                borderColor: opt.active ? "var(--accent-border)" : "var(--border-subtle)",
                backgroundColor: opt.active ? "var(--accent-subtle)" : "var(--bg-card)",
                color: opt.active ? "var(--accent-text)" : "var(--text-muted)",
                cursor: "pointer",
                transition: "all 0.12s ease",
              }}
            >
              <Check size={10} style={{ opacity: opt.active ? 1 : 0.25 }} />
              <span>{opt.label}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Applied Notification */}
      {appliedNotification && (
        <div
          className="sr-popover-in"
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

      {/* Standalone Feature Cards (Click directly to preview & apply) */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
          gap: "0.85rem",
        }}
      >
        {pipelineRows.map((row) => {
          const isAICardNoCache = row.key === "enableAI" && !aiProcessedCache;
          return (
            <div
              key={row.key}
              onClick={() => {
                if (isAICardNoCache) {
                  setActivePage("ai");
                } else if (!row.disabled) {
                  runDiffComputation({
                    enableDedup: row.key === "enableDedup",
                    enableRules: row.key === "enableRules",
                    enableDomainMerge: row.key === "enableDomainMerge",
                    enableLocalCluster: row.key === "enableLocalCluster",
                    enableAI: row.key === "enableAI",
                  });
                }
              }}
              style={{
                padding: "1rem 1.1rem",
                borderRadius: "0.9rem",
                border: "1px solid var(--border-card)",
                backgroundColor: "var(--bg-surface)",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                gap: "0.85rem",
                cursor: "pointer",
                transition: "border-color 0.15s ease, background-color 0.15s ease, transform 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = "var(--accent-border)";
                e.currentTarget.style.backgroundColor = "var(--bg-card)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = "var(--border-card)";
                e.currentTarget.style.backgroundColor = "var(--bg-surface)";
              }}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", minWidth: 0 }}>
                    <span
                      style={{
                        width: "30px",
                        height: "30px",
                        borderRadius: "9999px",
                        backgroundColor: row.disabled ? "var(--bg-subtle)" : "var(--accent-subtle)",
                        color: row.disabled ? "var(--text-muted)" : "var(--accent)",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {row.icon}
                    </span>
                    <span style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--text-main)" }}>
                      {row.title}
                    </span>
                  </div>
                  {row.badge}
                </div>

                <p style={{ fontSize: "0.76rem", color: "var(--text-muted)", lineHeight: 1.5, margin: 0 }}>
                  {row.description}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Pipeline Hop-up Modal (Top Presets + 5-Step Checklist) */}
      <Dialog.Root open={pipelineModalOpen} onOpenChange={(open) => !open && setPipelineModalOpen(false)}>
        <Dialog.Backdrop style={{ zIndex: 110 }} />
        <Dialog.Positioner style={{ zIndex: 120 }}>
          <Dialog.Content
            style={{
              maxWidth: "700px",
              width: "94vw",
              maxHeight: "88vh",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              borderRadius: "1rem",
              color: "var(--text-main)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 20px 44px rgba(0, 0, 0, 0.45)",
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                padding: "0.85rem 1.2rem",
                borderBottom: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <Workflow size={16} style={{ color: "var(--accent)" }} />
                <Dialog.Title style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                  自定义整理流水线
                </Dialog.Title>
                <Badge variant="subtle" size="sm" style={{ backgroundColor: "var(--accent-subtle)", color: "var(--accent-text)" }}>
                  已选 {activeStepsCount} 步
                </Badge>
              </div>

              <Dialog.CloseTrigger asChild>
                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={() => setPipelineModalOpen(false)}
                  style={{ color: "var(--text-muted)", padding: "4px" }}
                >
                  <X size={15} />
                </Button>
              </Dialog.CloseTrigger>
            </div>

            {/* Modal Body */}
            <div style={{ flex: 1, overflowY: "auto", padding: "1rem 1.2rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
              {/* Top Preset Pipeline Cards */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))", gap: "0.6rem" }}>
                {pipelinePresets.map((preset) => {
                  const selected = activePresetId === preset.id;
                  return (
                    <button
                      key={preset.id}
                      type="button"
                      onClick={() => selectPipelinePreset(preset.id)}
                      style={{
                        padding: "0.65rem 0.8rem",
                        borderRadius: "0.75rem",
                        border: "1.5px solid",
                        borderColor: selected ? "var(--accent-solid)" : "var(--border-subtle)",
                        backgroundColor: selected ? "var(--accent-subtle)" : "var(--bg-surface)",
                        textAlign: "left",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.2rem",
                        transition: "all 0.12s ease",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.35rem" }}>
                        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: selected ? "var(--accent-text)" : "var(--text-main)" }}>
                          {preset.title}
                        </span>
                        {selected && <Check size={12} style={{ color: "var(--accent)" }} />}
                      </div>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {preset.subtitle}
                      </span>
                    </button>
                  );
                })}
              </div>

              {/* 5-Step Checklist (Same layout as screenshot) */}
              <div
                style={{
                  borderRadius: "0.85rem",
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
                        padding: "0.8rem 1.05rem",
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
                            transition: "background-color 0.15s ease, border-color 0.15s ease",
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
                            width: "28px",
                            height: "28px",
                            borderRadius: "9999px",
                            backgroundColor: isChecked ? "var(--accent-subtle)" : "var(--bg-subtle)",
                            color: isChecked ? "var(--accent)" : "var(--text-muted)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0,
                            transition: "background-color 0.15s ease, color 0.15s ease",
                          }}
                        >
                          {row.icon}
                        </span>

                        <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-main)" }}>
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
                            onClick={() => {
                              setPipelineModalOpen(false);
                              runDiffComputation({
                                enableDedup: row.key === "enableDedup",
                                enableRules: row.key === "enableRules",
                                enableDomainMerge: row.key === "enableDomainMerge",
                                enableLocalCluster: row.key === "enableLocalCluster",
                                enableAI: row.key === "enableAI",
                              });
                            }}
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
            </div>

            {/* Modal Footer */}
            <div
              style={{
                padding: "0.8rem 1.2rem",
                borderTop: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                flexWrap: "wrap",
                gap: "0.75rem",
              }}
            >
              <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>
                已选 {activeStepsCount} 步 · {crossPanelMerge ? "跨面板聚合" : "单面板内"} ·{" "}
                {createGroupTabs ? "原生折叠组" : "虚拟标题组"}
              </span>

              <Button
                variant="solid"
                size="sm"
                pill
                disabled={activeStepsCount === 0}
                onClick={() => {
                  setPipelineModalOpen(false);
                  runDiffComputation(pipeline);
                }}
                style={{
                  backgroundColor: "var(--accent-solid)",
                  color: "#fff",
                  fontWeight: 600,
                }}
              >
                <Play size={13} />
                <span>预览自定义流水线 (DIFF)</span>
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Diff Modal */}
      <DiffHopupModal
        isOpen={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        onConfirm={handleConfirmApply}
        panelDiffs={diffResults.panelDiffs}
        totalDeduped={diffResults.totalDeduped}
        totalGroupsCreated={diffResults.totalGroupsCreated}
        onRecomputeDiff={() => runDiffComputation(lastExecutedOptions)}
        clusterGranularity={lastExecutedOptions.enableLocalCluster ? clusterGranularity : undefined}
        onChangeClusterGranularity={
          lastExecutedOptions.enableLocalCluster
            ? (g) => {
                setClusterGranularity(g);
                runDiffComputation(lastExecutedOptions, g);
              }
            : undefined
        }
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
