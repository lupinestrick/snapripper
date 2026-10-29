"use client";

import React, { useState } from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { computeSnapshotDiff } from "@/services/diffEngine";
import { PanelDiffResult, SideberySnapshot } from "@/types/sidebery";
import { DiffHopupModal } from "./DiffHopupModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trash2, FolderPlus, Bot, ArrowRight, AlertCircle, Sparkles } from "lucide-react";

export function ProcessPage() {
  const { rawSnapshot, duplicateUrls, applySnapshotUpdate } = useSnapshotStore();
  const { rulesSettings } = useConfigStore();

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
        <p style={{ fontSize: "0.95rem" }}>暂无快照数据，请在工作台导入 Sidebery 快照。</p>
      </div>
    );
  }

  const enabledRulesCount = rulesSettings.rules.filter((r) => r.enabled).length;

  const handleRunDiff = (options: { enableDedup: boolean; enableRules: boolean; enableAI: boolean }) => {
    const result = computeSnapshotDiff(
      rawSnapshot,
      {
        enableDedup: options.enableDedup,
        enableRules: options.enableRules,
        enableAICategorize: options.enableAI,
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
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "900px", margin: "0 auto", color: "#f8fafc" }}>
      {/* Title */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>快照处理中心</h1>
        <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.25rem" }}>
          点击下方功能面板即可直接进入 Diff 对比确认
        </p>
      </div>

      {/* Feature Cards Grid (Direct click triggers diff hopup) */}
      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        {/* Card 1: All-in-One Optimization */}
        <div
          onClick={() => handleRunDiff({ enableDedup: true, enableRules: true, enableAI: false })}
          style={{
            padding: "1.25rem",
            borderRadius: "1rem",
            backgroundColor: "#1e293b",
            border: "1px solid #3b82f6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "rgba(30, 41, 59, 0.9)")}
          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1e293b")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "9999px",
                backgroundColor: "rgba(59, 130, 246, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#60a5fa",
              }}
            >
              <Sparkles size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "#f8fafc" }}>一键全量优化 (去重 + 规则建组)</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                同时执行 URL 智能去重与关键词规则自动折叠分组
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Button variant="solid" size="xs" pill style={{ backgroundColor: "#2563eb", color: "#fff" }}>
              <span>预览 Diff</span>
              <ArrowRight size={13} />
            </Button>
          </div>
        </div>

        {/* Card 2: Deduplication */}
        <div
          onClick={() => handleRunDiff({ enableDedup: true, enableRules: false, enableAI: false })}
          style={{
            padding: "1.25rem",
            borderRadius: "1rem",
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#38bdf8")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#334155")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "9999px",
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
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "#f8fafc" }}>URL 智能去重</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                移除跨面板或同面板重复打开的相同网页，保留首个实例
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Badge variant="subtle" size="sm" style={{ color: "#38bdf8" }}>
              发现 {duplicateUrls.size} 个重复项
            </Badge>
            <Button variant="outline" size="xs" pill style={{ borderColor: "#334155", color: "#38bdf8" }}>
              <span>去重 Diff</span>
              <ArrowRight size={13} />
            </Button>
          </div>
        </div>

        {/* Card 3: Rule-based Grouping */}
        <div
          onClick={() => handleRunDiff({ enableDedup: false, enableRules: true, enableAI: false })}
          style={{
            padding: "1.25rem",
            borderRadius: "1rem",
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#34d399")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#334155")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "9999px",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#34d399",
              }}
            >
              <FolderPlus size={20} />
            </div>
            <div>
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "#f8fafc" }}>基于规则自动归类成组</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                匹配域名与关键词，自动折叠为 Group 分组
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Badge variant="subtle" size="sm" style={{ color: "#34d399" }}>
              {enabledRulesCount} 条规则已启用
            </Badge>
            <Button variant="outline" size="xs" pill style={{ borderColor: "#334155", color: "#34d399" }}>
              <span>建组 Diff</span>
              <ArrowRight size={13} />
            </Button>
          </div>
        </div>

        {/* Card 4: AI Categorization */}
        <div
          onClick={() => handleRunDiff({ enableDedup: false, enableRules: false, enableAI: true })}
          style={{
            padding: "1.25rem",
            borderRadius: "1rem",
            backgroundColor: "#1e293b",
            border: "1px solid #334155",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            cursor: "pointer",
            transition: "all 0.15s ease",
          }}
          onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#a855f7")}
          onMouseLeave={(e) => (e.currentTarget.style.borderColor = "#334155")}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <div
              style={{
                width: "44px",
                height: "44px",
                borderRadius: "9999px",
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
              <div style={{ fontWeight: 600, fontSize: "1rem", color: "#f8fafc" }}>AI 智能比例重组</div>
              <div style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.2rem" }}>
                按大模型探查的主题比例执行语义归类
              </div>
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <Button variant="outline" size="xs" pill style={{ borderColor: "#334155", color: "#a855f7" }}>
              <span>AI 重构 Diff</span>
              <ArrowRight size={13} />
            </Button>
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
      />
    </div>
  );
}
