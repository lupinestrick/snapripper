"use client";

import React, { useState } from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { computeSnapshotDiff } from "@/services/diffEngine";
import { PanelDiffResult, SideberySnapshot } from "@/types/sidebery";
import { DiffHopupModal } from "./DiffHopupModal";
import {
  Trash2,
  FolderPlus,
  Bot,
  AlertCircle,
  Sparkles,
  Globe,
  ChevronLeft,
} from "lucide-react";

export function ProcessPage() {
  const { rawSnapshot, applySnapshotUpdate } = useSnapshotStore();
  const {
    rulesSettings,
    domainMergeConfig,
    processScope,
    selectedProcessPanelIds,
    exemptPinned,
    exemptInternalPages,
    preserveSubtrees,
  } = useConfigStore();

  const [diffModalOpen, setDiffModalOpen] = useState(false);

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
          color: "#94a3b8",
          gap: "1rem",
        }}
      >
        <AlertCircle size={40} color="#64748b" />
        <p style={{ fontSize: "0.95rem" }}>暂无快照数据，请在工作台导入 Sidebery 快照。</p>
      </div>
    );
  }

  const runDiffComputation = (options: {
    enableDedup: boolean;
    enableRules: boolean;
    enableDomainMerge: boolean;
    enableAI: boolean;
  }) => {
    setActiveProcessOptions(options);

    const result = computeSnapshotDiff(
      rawSnapshot,
      {
        enableDedup: options.enableDedup,
        enableRules: options.enableRules,
        enableDomainMerge: options.enableDomainMerge,
        domainMergeConfig,
        enableAICategorize: options.enableAI,
        scope: processScope,
        targetPanelIds: selectedProcessPanelIds,
        exemptPinned,
        exemptInternalPages,
        preserveSubtrees,
      },
      rulesSettings
    );

    setDiffResults(result);
    setDiffModalOpen(true);
  };

  const handleRecomputeCurrentDiff = () => {
    if (!rawSnapshot) return;
    const result = computeSnapshotDiff(
      rawSnapshot,
      {
        enableDedup: activeProcessOptions.enableDedup,
        enableRules: activeProcessOptions.enableRules,
        enableDomainMerge: activeProcessOptions.enableDomainMerge,
        domainMergeConfig: useConfigStore.getState().domainMergeConfig,
        enableAICategorize: activeProcessOptions.enableAI,
        scope: useConfigStore.getState().processScope,
        targetPanelIds: useConfigStore.getState().selectedProcessPanelIds,
        exemptPinned: useConfigStore.getState().exemptPinned,
        exemptInternalPages: useConfigStore.getState().exemptInternalPages,
        preserveSubtrees: useConfigStore.getState().preserveSubtrees,
      },
      useConfigStore.getState().rulesSettings
    );

    setDiffResults(result);
  };

  const handleConfirmApply = () => {
    if (diffResults.newSnapshot) {
      applySnapshotUpdate(diffResults.newSnapshot, "执行处理中心变更");
      setDiffModalOpen(false);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto", color: "var(--text-main)" }}>
      {/* Title */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>快照处理中心</h1>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
          点击下方功能面板即可直接进入 Diff 对比确认
        </p>
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
            borderRadius: "var(--radius-btn, 8px)",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--accent-solid)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--accent-subtle)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-card)")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-btn, 6px)",
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
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-main)" }}>
                一键全量优化 (去重 + 同域名合并 + 规则建组)
              </div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                同时执行 URL 智能去重、同域名折叠与关键词规则自动建组
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
            <ChevronLeft size={18} />
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
            borderRadius: "var(--radius-btn, 8px)",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-focus)";
            e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-card)";
            e.currentTarget.style.backgroundColor = "var(--bg-card)";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#38bdf8",
              }}
            >
              <Trash2 size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-main)" }}>URL 智能去重</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                移除跨面板或同面板重复打开的相同网页，保留首个实例
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
            <ChevronLeft size={18} />
          </div>
        </div>

        {/* Card 3: Same Domain Tabs Merge */}
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
            borderRadius: "var(--radius-btn, 8px)",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-focus)";
            e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-card)";
            e.currentTarget.style.backgroundColor = "var(--bg-card)";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "rgba(6, 182, 212, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#06b6d4",
              }}
            >
              <Globe size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-main)" }}>同域名标签合并</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                将同域名的标签页自动归类折叠为分组
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
            <ChevronLeft size={18} />
          </div>
        </div>

        {/* Card 4: Rule-based Grouping */}
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
            borderRadius: "var(--radius-btn, 8px)",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-focus)";
            e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-card)";
            e.currentTarget.style.backgroundColor = "var(--bg-card)";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#10b981",
              }}
            >
              <FolderPlus size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-main)" }}>基于规则自动归类成组</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                匹配域名与关键词，自动折叠为 Group 分组
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
            <ChevronLeft size={18} />
          </div>
        </div>

        {/* Card 5: AI Categorization */}
        <div
          onClick={() =>
            runDiffComputation({
              enableDedup: false,
              enableRules: false,
              enableDomainMerge: false,
              enableAI: true,
            })
          }
          style={{
            padding: "1.25rem",
            borderRadius: "var(--radius-btn, 8px)",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = "var(--border-focus)";
            e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = "var(--border-card)";
            e.currentTarget.style.backgroundColor = "var(--bg-card)";
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "rgba(168, 85, 247, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#a855f7",
              }}
            >
              <Bot size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "var(--text-main)" }}>AI 智能比例重组</div>
              <div style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
                按大模型探查的主题比例执行语义归类
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", color: "var(--text-muted)" }}>
            <ChevronLeft size={18} />
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
    </div>
  );
}

export default ProcessPage;
