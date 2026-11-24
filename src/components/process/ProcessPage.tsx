"use client";

import React, { useState } from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { computeSnapshotDiff } from "@/services/diffEngine";
import { PanelDiffResult, SideberySnapshot } from "@/types/sidebery";
import { DiffHopupModal } from "./DiffHopupModal";
import { DiffSettingsModal } from "./DiffSettingsModal";
import { flattenTabTree } from "@/services/snapshotParser";
import { getDuplicateUrlSet } from "@/services/treeOperations";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Trash2,
  FolderPlus,
  Bot,
  AlertCircle,
  Sparkles,
  Globe,
  ChevronRight,
  SlidersHorizontal,
  Layers,
  CheckCircle2,
  ArrowRight,
  X,
} from "lucide-react";

export function ProcessPage() {
  const { rawSnapshot, rootNodes, applySnapshotUpdate, aiProcessedCache } = useSnapshotStore();
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

  const [activeProcessOptions, setActiveProcessOptions] = useState<{
    enableDedup: boolean;
    enableRules: boolean;
    enableDomainMerge: boolean;
    enableAI: boolean;
  }>({
    enableDedup: true,
    enableRules: true,
    enableDomainMerge: false,
    enableAI: false,
  });

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
        <AlertCircle size={40} color="var(--text-muted)" />
        <p style={{ fontSize: "0.95rem" }}>暂无快照数据，请在工作台导入 Sidebery 快照。</p>
        <Button variant="solid" size="sm" pill onClick={() => setActivePage("workbench")}>
          前往工作台导入
        </Button>
      </div>
    );
  }

  const allTabs = flattenTabTree(rootNodes);
  const totalTabs = allTabs.length;
  const panelCount = rawSnapshot.panels ? Object.keys(rawSnapshot.panels).length : 0;
  const duplicateUrlSet = getDuplicateUrlSet(allTabs);
  const totalDuplicateTabs = allTabs.filter(
    (t) => duplicateUrlSet.has((t.url || "").replace(/#.*$/, "").trim()) && !t.pinned
  ).length;
  const activeRulesCount = rulesSettings.rules.filter((r) => r.enabled).length;

  const runDiffComputation = (options: {
    enableDedup: boolean;
    enableRules: boolean;
    enableDomainMerge: boolean;
    enableAI: boolean;
  }) => {
    setActiveProcessOptions(options);

    const aiMap =
      options.enableAI && aiProcessedCache?.classificationMap
        ? new Map(Object.entries(aiProcessedCache.classificationMap))
        : undefined;
    const aiCats = options.enableAI ? aiProcessedCache?.categoryNames : undefined;

    const result = computeSnapshotDiff(
      rawSnapshot,
      {
        enableDedup: options.enableDedup,
        enableRules: options.enableRules,
        enableDomainMerge: options.enableDomainMerge,
        domainMergeConfig,
        enableAICategorize: options.enableAI,
        aiClassificationMap: aiMap,
        aiCategoryNames: aiCats,
        scope: processScope,
        targetPanelIds: selectedProcessPanelIds,
        exemptPinned,
        exemptInternalPages,
        preserveSubtrees,
        crossPanelMerge,
        createGroupTabs,
      },
      rulesSettings
    );

    setDiffResults(result);
    setDiffModalOpen(true);
  };

  const handleRecomputeCurrentDiff = () => {
    if (!rawSnapshot) return;
    const currentConfig = useConfigStore.getState();
    const currentAiCache = useSnapshotStore.getState().aiProcessedCache;

    const aiMap =
      activeProcessOptions.enableAI && currentAiCache?.classificationMap
        ? new Map(Object.entries(currentAiCache.classificationMap))
        : undefined;
    const aiCats = activeProcessOptions.enableAI ? currentAiCache?.categoryNames : undefined;

    const result = computeSnapshotDiff(
      rawSnapshot,
      {
        enableDedup: activeProcessOptions.enableDedup,
        enableRules: activeProcessOptions.enableRules,
        enableDomainMerge: activeProcessOptions.enableDomainMerge,
        domainMergeConfig: currentConfig.domainMergeConfig,
        enableAICategorize: activeProcessOptions.enableAI,
        aiClassificationMap: aiMap,
        aiCategoryNames: aiCats,
        scope: currentConfig.processScope,
        targetPanelIds: currentConfig.selectedProcessPanelIds,
        exemptPinned: currentConfig.exemptPinned,
        exemptInternalPages: currentConfig.exemptInternalPages,
        preserveSubtrees: currentConfig.preserveSubtrees,
        crossPanelMerge: currentConfig.crossPanelMerge,
        createGroupTabs: currentConfig.createGroupTabs,
      },
      currentConfig.rulesSettings
    );

    setDiffResults(result);
  };

  const handleConfirmApply = () => {
    if (diffResults.newSnapshot) {
      applySnapshotUpdate(diffResults.newSnapshot, "执行处理中心变更");
      setDiffModalOpen(false);
      setAppliedNotification("✨ 已成功将处理中心变更应用至快照树，并同步保存到本地持久化缓存。");
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto", color: "var(--text-main)" }}>
      {/* Title & Action Bar */}
      <div
        style={{
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "1rem",
        }}
      >
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>快照处理中心</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            一键批量治理与重构 Sidebery 快照，支持实时差分对比与无损回滚
          </p>
        </div>

        <Button
          variant="outline"
          size="sm"
          pill
          onClick={() => setPageSettingsOpen(true)}
          style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}
        >
          <SlidersHorizontal size={14} />
          <span>整理与规则设置</span>
        </Button>
      </div>

      {/* Applied Notification Banner */}
      {appliedNotification && (
        <div
          style={{
            padding: "0.75rem 1.25rem",
            borderRadius: "0.75rem",
            backgroundColor: "rgba(16, 185, 129, 0.12)",
            border: "1px solid rgba(16, 185, 129, 0.35)",
            marginBottom: "1.5rem",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "1rem",
            animation: "fadeIn 0.2s ease-in-out",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.85rem", color: "var(--text-main)" }}>
            <CheckCircle2 size={16} style={{ color: "var(--success)" }} />
            <span>{appliedNotification}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <Button
              variant="solid"
              size="xs"
              pill
              onClick={() => setActivePage("workbench")}
              style={{ fontSize: "0.75rem" }}
            >
              前往工作台查看
              <ArrowRight size={12} style={{ marginLeft: "2px" }} />
            </Button>
            <Button
              variant="ghost"
              size="xs"
              pill
              onClick={() => setAppliedNotification(null)}
              style={{ color: "var(--text-muted)", padding: "4px" }}
            >
              <X size={14} />
            </Button>
          </div>
        </div>
      )}

      {/* Snapshot Health & Live Diagnostic Card */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderRadius: "0.875rem",
          backgroundColor: "var(--bg-subtle)",
          border: "1px solid var(--border-subtle)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "1.5rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.82rem", color: "var(--text-main)" }}>
            <Layers size={15} style={{ color: "var(--accent)" }} />
            <span style={{ fontWeight: 600 }}>{totalTabs}</span> 标签 ·{" "}
            <span style={{ fontWeight: 600 }}>{panelCount}</span> 面板
          </div>

          <div style={{ width: "1px", height: "14px", backgroundColor: "var(--border-subtle)" }} />

          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
            <span>范围:</span>
            <Badge variant="outline" size="sm">
              {processScope === "all" ? "全部面板" : processScope === "current" ? "当前面板" : "指定面板"}
            </Badge>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
            <span>跨面板合并:</span>
            <Badge variant="subtle" size="sm" style={{ color: crossPanelMerge ? "var(--accent)" : "var(--text-muted)" }}>
              {crossPanelMerge ? "已开启" : "已关闭"}
            </Badge>
          </div>
        </div>

        {totalDuplicateTabs > 0 && (
          <Badge
            variant="subtle"
            size="sm"
            style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "var(--danger)", fontWeight: 600 }}
          >
            ⚠️ 检测到 {totalDuplicateTabs} 个重复标签
          </Badge>
        )}
      </div>

      {/* Feature Cards Grid (Direct click triggers diff hopup) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Card 1: All-in-One Optimization */}
        <div
          onClick={() =>
            runDiffComputation({
              enableDedup: true,
              enableRules: true,
              enableDomainMerge: true,
              enableAI: false,
            })
          }
          style={{
            padding: "1.25rem",
            borderRadius: "1rem",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--accent-solid)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "9999px",
                backgroundColor: "var(--accent-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-main)" }}>
                  一键全量优化 (去重 + 规则建组 + 同域名合并)
                </span>
                <Badge variant="solid" size="sm" style={{ backgroundColor: "var(--accent-solid)", color: "#fff" }}>
                  推荐全量
                </Badge>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                智能优化流水线：依次执行 URL 智能去重、规则语义分组与剩余同域名折叠
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
            <ChevronRight size={18} />
          </div>
        </div>

        {/* Card 2: Deduplication */}
        <div
          onClick={() =>
            runDiffComputation({
              enableDedup: true,
              enableRules: false,
              enableDomainMerge: false,
              enableAI: false,
            })
          }
          style={{
            padding: "1.25rem",
            borderRadius: "1rem",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "9999px",
                backgroundColor: "var(--accent-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <Trash2 size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-main)" }}>URL 智能去重</span>
                {totalDuplicateTabs > 0 ? (
                  <Badge variant="subtle" size="sm" style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "var(--danger)" }}>
                    可清理 {totalDuplicateTabs} 个重复
                  </Badge>
                ) : (
                  <Badge variant="subtle" size="sm" style={{ color: "var(--success)" }}>
                    暂无重复
                  </Badge>
                )}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                跨面板或同面板扫描重复打开的相同网页，保留首个实例并清除冗余
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
            <ChevronRight size={18} />
          </div>
        </div>

        {/* Card 3: Rule-based Grouping */}
        <div
          onClick={() =>
            runDiffComputation({
              enableDedup: false,
              enableRules: true,
              enableDomainMerge: false,
              enableAI: false,
            })
          }
          style={{
            padding: "1.25rem",
            borderRadius: "1rem",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "9999px",
                backgroundColor: "var(--accent-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <FolderPlus size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-main)" }}>基于规则自动归类成组</span>
                <Badge variant="subtle" size="sm">
                  {activeRulesCount} 条启用规则
                </Badge>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                匹配域名与关键词，自动折叠为 Sidebery 原生 Group 分组并按需跨面板迁移
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
            <ChevronRight size={18} />
          </div>
        </div>

        {/* Card 4: Same Domain Tabs Merge */}
        <div
          onClick={() =>
            runDiffComputation({
              enableDedup: false,
              enableRules: false,
              enableDomainMerge: true,
              enableAI: false,
            })
          }
          style={{
            padding: "1.25rem",
            borderRadius: "1rem",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "9999px",
                backgroundColor: "var(--accent-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <Globe size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-main)" }}>同域名标签合并</span>
                <Badge variant="subtle" size="sm">
                  成组阈值: ≥{domainMergeConfig.minThreshold || 2}
                </Badge>
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                将同域名的标签页自动归类折叠为分组（支持完整域名、后缀或关键字匹配）
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
            <ChevronRight size={18} />
          </div>
        </div>

        {/* Card 5: AI Intelligent Restructure & Scheme */}
        <div
          onClick={() => {
            if (aiProcessedCache) {
              runDiffComputation({
                enableDedup: false,
                enableRules: false,
                enableDomainMerge: false,
                enableAI: true,
              });
            } else {
              setActivePage("ai");
            }
          }}
          style={{
            padding: "1.25rem",
            borderRadius: "1rem",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "9999px",
                backgroundColor: "var(--accent-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--accent)",
              }}
            >
              <Bot size={20} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-main)" }}>
                  AI 智能架构与分类重构
                </span>
                {aiProcessedCache ? (
                  <Badge variant="subtle" size="sm" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "var(--success)" }}>
                    已有 AI 方案缓存
                  </Badge>
                ) : (
                  <Badge variant="subtle" size="sm" style={{ color: "var(--accent)" }}>
                    前往 AI 架构师 ↳
                  </Badge>
                )}
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                {aiProcessedCache
                  ? `查看并应用最近一次由 AI 智能架构师生成的重构方案（包含 ${aiProcessedCache.categoryNames?.length || 0} 个主题分类）`
                  : "尚未生成 AI 方案，点击前往「AI 架构师」进行全库深度体检与方案推荐"}
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
            <ChevronRight size={18} />
          </div>
        </div>
      </div>

      {/* Hop-up Modal for Diff */}
      <DiffHopupModal
        isOpen={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        onConfirm={handleConfirmApply}
        panelDiffs={diffResults.panelDiffs}
        totalDeduped={diffResults.totalDeduped}
        totalGroupsCreated={diffResults.totalGroupsCreated}
        onRecomputeDiff={handleRecomputeCurrentDiff}
      />

      {/* Direct Page Settings Modal */}
      <DiffSettingsModal
        isOpen={pageSettingsOpen}
        onClose={() => setPageSettingsOpen(false)}
        panels={
          rawSnapshot?.panels
            ? Object.entries(rawSnapshot.panels).map(([id, p]) => ({ id, name: p.name || id }))
            : []
        }
      />
    </div>
  );
}

export default ProcessPage;
