"use client";

import React, { useState } from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { computeSnapshotDiff } from "@/services/diffEngine";
import { PanelDiffResult, SideberySnapshot } from "@/types/sidebery";
import { DiffHopupModal } from "./DiffHopupModal";
import { Trash2, FolderPlus, Bot, ArrowRight, Play, AlertCircle } from "lucide-react";

export function ProcessPage() {
  const { rawSnapshot, duplicateUrls, applySnapshotUpdate } = useSnapshotStore();
  const { rulesSettings } = useConfigStore();

  const [enableDedup, setEnableDedup] = useState(true);
  const [enableRules, setEnableRules] = useState(true);
  const [enableAI, setEnableAI] = useState(false);

  const [diffModalOpen, setDiffModalOpen] = useState(false);
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
        <p style={{ fontSize: "0.95rem" }}>暂无快照数据，请先在工作台导入或加载 Sidebery 快照。</p>
      </div>
    );
  }

  const enabledRulesCount = rulesSettings.rules.filter((r) => r.enabled).length;

  const handleStartProcess = () => {
    const result = computeSnapshotDiff(
      rawSnapshot,
      {
        enableDedup,
        enableRules,
        enableAICategorize: enableAI,
      },
      rulesSettings
    );

    setDiffResults(result);
    setDiffModalOpen(true);
  };

  const handleConfirmApply = () => {
    if (diffResults.newSnapshot) {
      applySnapshotUpdate(diffResults.newSnapshot, "执行去重与规则整理");
      setDiffModalOpen(false);
      alert("已成功应用更改！可在工作台查看最新标签树，支持通过撤销按钮回滚。");
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto", color: "#f8fafc" }}>
      {/* Title */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>快照处理中心</h1>
        <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.25rem" }}>
          选择需要执行的优化操作，点击后将实时生成处理前后对比（Diff），确认无误后再应用至快照。
        </p>
      </div>

      {/* Feature Cards Grid */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem", marginBottom: "2rem" }}>
        {/* Card 1: Deduplication */}
        <div
          onClick={() => setEnableDedup(!enableDedup)}
          style={{
            padding: "1.25rem",
            borderRadius: "1rem",
            backgroundColor: "#1e293b",
            border: enableDedup ? "1px solid #38bdf8" : "1px solid #334155",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "9999px",
                backgroundColor: enableDedup ? "rgba(56, 189, 248, 0.15)" : "#0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: enableDedup ? "#38bdf8" : "#64748b",
              }}
            >
              <Trash2 size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>智能 URL 去重</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                自动识别跨面板或同面板完全相同的网址，保留首个实例并清理冗余项
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#f87171", fontWeight: 600 }}>
              检测到 {duplicateUrls.size} 项重复
            </span>
            <input
              type="checkbox"
              checked={enableDedup}
              onChange={() => {}}
              style={{ width: "18px", height: "18px", accentColor: "#38bdf8", cursor: "pointer" }}
            />
          </div>
        </div>

        {/* Card 2: Rule Clustering */}
        <div
          onClick={() => setEnableRules(!enableRules)}
          style={{
            padding: "1.25rem",
            borderRadius: "1rem",
            backgroundColor: "#1e293b",
            border: enableRules ? "1px solid #10b981" : "1px solid #334155",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "9999px",
                backgroundColor: enableRules ? "rgba(16, 185, 129, 0.15)" : "#0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: enableRules ? "#10b981" : "#64748b",
              }}
            >
              <FolderPlus size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>自定义规则自动建组</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                按照设定的域名与标题关键词将同类标签折叠为 Sidebery Group，保持原有 Group 为整体
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <span style={{ fontSize: "0.8rem", color: "#34d399", fontWeight: 600 }}>
              {enabledRulesCount} 条规则已启用
            </span>
            <input
              type="checkbox"
              checked={enableRules}
              onChange={() => {}}
              style={{ width: "18px", height: "18px", accentColor: "#10b981", cursor: "pointer" }}
            />
          </div>
        </div>

        {/* Card 3: AI Categorization */}
        <div
          onClick={() => setEnableAI(!enableAI)}
          style={{
            padding: "1.25rem",
            borderRadius: "1rem",
            backgroundColor: "#1e293b",
            border: enableAI ? "1px solid #a855f7" : "1px solid #334155",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "9999px",
                backgroundColor: enableAI ? "rgba(168, 85, 247, 0.15)" : "#0f172a",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: enableAI ? "#a855f7" : "#64748b",
              }}
            >
              <Bot size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "0.95rem" }}>AI 生成式比例分类</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                根据大模型探索出的标签比例报告执行全局语义分类（需先在 AI 页面生成比例看板）
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <input
              type="checkbox"
              checked={enableAI}
              onChange={() => {}}
              style={{ width: "18px", height: "18px", accentColor: "#a855f7", cursor: "pointer" }}
            />
          </div>
        </div>
      </div>

      {/* Start Button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={handleStartProcess}
          disabled={!enableDedup && !enableRules && !enableAI}
          style={{
            padding: "0.75rem 2rem",
            borderRadius: "9999px", // Circular pill style
            border: "none",
            backgroundColor: !enableDedup && !enableRules && !enableAI ? "#334155" : "#2563eb",
            color: "#ffffff",
            fontSize: "0.95rem",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            cursor: !enableDedup && !enableRules && !enableAI ? "not-allowed" : "pointer",
            boxShadow: "0 10px 15px -3px rgba(37, 99, 235, 0.3)",
          }}
        >
          <Play size={16} fill="currentColor" />
          <span>开始处理并预览 Diff 对比</span>
        </button>
      </div>

      {/* Hop-up Modal for Diff */}
      <DiffHopupModal
        isOpen={diffModalOpen}
        onClose={() => setDiffModalOpen(false)}
        onConfirm={handleConfirmApply}
        panelDiffs={diffResults.panelDiffs}
        totalDeduped={diffResults.totalDeduped}
        totalGroupsCreated={diffResults.totalGroupsCreated}
      />
    </div>
  );
}
