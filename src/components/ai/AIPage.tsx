"use client";

import React, { useState } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { analyzeTabProportions } from "@/services/aiService";
import { flattenTabTree } from "@/services/snapshotParser";
import { AI_PROVIDERS } from "@/types/ai";
import { ProportionCard } from "./ProportionCard";
import { CategorizeModal } from "./CategorizeModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sliders, Sparkles, Loader2, Settings } from "lucide-react";

export function AIPage() {
  const {
    aiConfig,
    setActivePage,
    aiThresholds,
    setAiThresholds,
    preserveSubtrees,
    setPreserveSubtrees,
  } = useConfigStore();

  const {
    rootNodes,
    proportionReport,
    setProportionReport,
    isAnalyzing,
    setIsAnalyzing,
    progressStatus,
  } = useSnapshotStore();

  const [categorizeModalOpen, setCategorizeModalOpen] = useState(false);

  const currentProviderDef = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.custom;

  const handleStartAnalysis = async () => {
    if (rootNodes.length === 0) {
      alert("请先在工作台导入或加载快照数据");
      return;
    }
    const allTabs = flattenTabTree(rootNodes);
    setIsAnalyzing(true, "提取 URL 指纹并发送至 AI 分析...");

    try {
      const report = await analyzeTabProportions(allTabs, aiConfig, (status) => {
        setIsAnalyzing(true, status);
      });
      setProportionReport(report);
      setIsAnalyzing(false);
    } catch (err: any) {
      setIsAnalyzing(false);
      alert(`AI 分析失败: ${err.message || "请检查系统设置中的 AI 端点与 API Key 配置"}`);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "960px", margin: "0 auto", color: "var(--text-main)" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "2rem" }}>
        <div>
          <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>生成式 AI 比例分析</h1>
          <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
            按域名与标题推导主题分布，并支持调整分类阈值后按比例重组。
          </p>
        </div>

        {/* Current Engine Badge + Settings Link */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div
            style={{
              padding: "0.35rem 0.8rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            <span>接口:</span>
            <strong style={{ color: "var(--accent)" }}>{currentProviderDef.name}</strong>
            <span style={{ color: "var(--text-muted)" }}>({aiConfig.model || currentProviderDef.model})</span>
          </div>

          <Button
            variant="outline"
            size="xs"
            onClick={() => setActivePage("settings")}
          >
            <Settings size={13} />
            <span>配置接口</span>
          </Button>
        </div>
      </div>

      {/* Threshold & Parameter Control Card */}
      <div
        style={{
          padding: "1.5rem",
          borderRadius: "var(--radius-btn, 8px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem" }}>
          <Sliders size={20} style={{ color: "var(--accent)" }} />
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>分类阈值与聚合控制</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1.25rem", marginBottom: "1.5rem" }}>
          {/* Min Tabs Threshold */}
          <div
            style={{
              padding: "1rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                最小成组阈值
              </label>
              <span style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: 600 }}>
                {aiThresholds.minTabsPerGroup} 个标签
              </span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              同类标签数达到此阈值才形成独立分组，少于此数合并为其他类。
            </p>
            <input
              type="range"
              min={1}
              max={10}
              value={aiThresholds.minTabsPerGroup}
              onChange={(e) => setAiThresholds({ minTabsPerGroup: parseInt(e.target.value) || 2 })}
              style={{ width: "100%", accentColor: "var(--accent-solid)", cursor: "pointer" }}
            />
          </div>

          {/* Max Categories */}
          <div
            style={{
              padding: "1rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.5rem" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                建议最大分类数
              </label>
              <span style={{ fontSize: "0.85rem", color: "var(--accent)", fontWeight: 600 }}>
                {aiThresholds.maxCategories} 个类别
              </span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.75rem" }}>
              控制大模型归纳提炼的主题数量上限，避免分类过多导致零散。
            </p>
            <input
              type="range"
              min={3}
              max={15}
              value={aiThresholds.maxCategories}
              onChange={(e) => setAiThresholds({ maxCategories: parseInt(e.target.value) || 6 })}
              style={{ width: "100%", accentColor: "var(--accent-solid)", cursor: "pointer" }}
            />
          </div>
        </div>

        {/* Interaction options */}
        <div style={{ paddingTop: "0.5rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.6rem",
              cursor: "pointer",
              fontSize: "0.825rem",
              color: "var(--text-main)",
            }}
          >
            <input
              type="checkbox"
              checked={preserveSubtrees}
              onChange={(e) => setPreserveSubtrees(e.target.checked)}
              style={{ accentColor: "var(--accent-solid)", width: 16, height: 16, cursor: "pointer" }}
            />
            <span>保持子树完整性（子标签跟随父节点整体归类）</span>
          </label>
        </div>

        {/* Start button row */}
        <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", marginTop: "1.5rem", borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem" }}>
          <Button
            variant="solid"
            size="sm"
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
          >
            {isAnalyzing ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
            <span>{isAnalyzing ? "正在分析比例..." : "开始标签比例探查"}</span>
          </Button>
        </div>
      </div>

      {/* Status banner */}
      {isAnalyzing && (
        <div
          style={{
            padding: "0.875rem 1.25rem",
            borderRadius: "0.75rem",
            backgroundColor: "rgba(56, 189, 248, 0.1)",
            border: "1px solid #38bdf8",
            color: "#38bdf8",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            fontSize: "0.85rem",
            marginBottom: "1.5rem",
          }}
        >
          <Loader2 size={16} className="animate-spin" />
          <span>{progressStatus || "正在提取特征并生成比例分布..."}</span>
        </div>
      )}

      {/* Proportion Card */}
      {proportionReport && (
        <div style={{ marginTop: "1rem" }}>
          <ProportionCard
            onStartClassification={() => setCategorizeModalOpen(true)}
            onClose={() => setProportionReport(null)}
          />
        </div>
      )}

      <CategorizeModal isOpen={categorizeModalOpen} onClose={() => setCategorizeModalOpen(false)} />
    </div>
  );
}
