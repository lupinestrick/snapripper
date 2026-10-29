"use client";

import React, { useState } from "react";
import { TopNav } from "@/components/layout/TopNav";
import { StatsHeader } from "@/components/layout/StatsHeader";
import { SearchFilter } from "@/components/editor/SearchFilter";
import { TabTreeView } from "@/components/editor/TabTreeView";
import { BatchBar } from "@/components/editor/BatchBar";
import { ProportionCard } from "@/components/ai/ProportionCard";
import { AIConfigDialog } from "@/components/ai/AIConfigDialog";
import { CategorizeModal } from "@/components/ai/CategorizeModal";
import { ExportDialog } from "@/components/export/ExportDialog";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { analyzeTabProportions } from "@/services/aiService";
import { flattenTabTree } from "@/services/snapshotParser";
import { Loader2 } from "lucide-react";

export default function WorkbenchPage() {
  const {
    rawSnapshot,
    rootNodes,
    proportionReport,
    setProportionReport,
    isAnalyzing,
    setIsAnalyzing,
    progressStatus,
    loadSnapshot,
  } = useSnapshotStore();

  const { aiConfig } = useConfigStore();

  const [aiConfigOpen, setAiConfigOpen] = useState(false);
  const [categorizeModalOpen, setCategorizeModalOpen] = useState(false);
  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  const handleTriggerAIAnalysis = async () => {
    if (rootNodes.length === 0) return;
    const allTabs = flattenTabTree(rootNodes);

    setIsAnalyzing(true, "准备发送至 AI 分析...");
    try {
      const report = await analyzeTabProportions(allTabs, aiConfig, (status) => {
        setIsAnalyzing(true, status);
      });
      setProportionReport(report);
      setIsAnalyzing(false);
    } catch (err: any) {
      setIsAnalyzing(false);
      alert(`AI 分析失败: ${err.message || "请检查 AI 设置中的端点与 API Key"}`);
      setAiConfigOpen(true);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        loadSnapshot(content, file.name);
      } catch (err: any) {
        alert(err.message || "读取文件失败");
      }
    };
    reader.readAsText(file);
  };

  return (
    <main
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: "flex",
        flexDirection: "column",
        minHeight: "100vh",
        backgroundColor: "var(--bg-primary)",
        position: "relative",
      }}
    >
      {isDragOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(56, 189, 248, 0.15)",
            backdropFilter: "blur(2px)",
            border: "3px dashed var(--accent)",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "1.5rem 2.5rem",
              backgroundColor: "var(--bg-surface)",
              borderRadius: "0.75rem",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.5)",
              color: "var(--accent)",
              fontWeight: 700,
              fontSize: "1.2rem",
            }}
          >
            松开鼠标以导入 Sidebery 快照 JSON
          </div>
        </div>
      )}

      <TopNav
        onOpenAIConfig={() => setAiConfigOpen(true)}
        onOpenExport={() => setExportDialogOpen(true)}
        onTriggerAIAnalysis={handleTriggerAIAnalysis}
      />

      <StatsHeader />

      {rawSnapshot && <SearchFilter />}

      {isAnalyzing && (
        <div
          style={{
            margin: "0.75rem 1.5rem",
            padding: "0.75rem 1rem",
            backgroundColor: "rgba(56, 189, 248, 0.1)",
            border: "1px solid var(--accent)",
            borderRadius: "0.5rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            fontSize: "0.85rem",
            color: "var(--accent)",
          }}
        >
          <Loader2 size={16} />
          <span>{progressStatus || "正在进行智能比例探查与聚类分析..."}</span>
        </div>
      )}

      {proportionReport && (
        <ProportionCard
          onStartClassification={() => setCategorizeModalOpen(true)}
          onClose={() => setProportionReport(null)}
        />
      )}

      <TabTreeView />

      <BatchBar />

      <AIConfigDialog isOpen={aiConfigOpen} onClose={() => setAiConfigOpen(false)} />

      <CategorizeModal
        isOpen={categorizeModalOpen}
        onClose={() => setCategorizeModalOpen(false)}
      />

      <ExportDialog isOpen={exportDialogOpen} onClose={() => setExportDialogOpen(false)} />
    </main>
  );
}
