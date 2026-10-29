"use client";

import React, { useRef } from "react";
import { FolderUp, Sparkles, Download, Undo2, PlayCircle, Settings, Layers } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { MOCK_SIDEBERY_SNAPSHOT } from "@/utils/mockSnapshot";
import { serializeSnapshot } from "@/services/snapshotParser";

interface TopNavProps {
  onOpenAIConfig: () => void;
  onOpenExport: () => void;
  onTriggerAIAnalysis: () => void;
}

export function TopNav({ onOpenAIConfig, onOpenExport, onTriggerAIAnalysis }: TopNavProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadSnapshot, undoStack, undo, rawSnapshot, fileName } = useSnapshotStore();
  const { aiConfig } = useConfigStore();

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
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
    e.target.value = "";
  };

  const handleLoadDemo = () => {
    const demoJson = serializeSnapshot(MOCK_SIDEBERY_SNAPSHOT);
    loadSnapshot(demoJson, "Sidebery_Demo_Snapshot.json");
  };

  const hasData = !!rawSnapshot;

  return (
    <header
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        padding: "0.75rem 1.5rem",
        backgroundColor: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
        position: "sticky",
        top: 0,
        zIndex: 40,
      }}
    >
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: "2.25rem",
            height: "2.25rem",
            borderRadius: "0.5rem",
            backgroundColor: "rgba(56, 189, 248, 0.15)",
            color: "var(--accent)",
          }}
        >
          <Layers size={20} />
        </div>
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span style={{ fontWeight: 700, fontSize: "1.1rem", letterSpacing: "-0.025em" }}>SnapRipper</span>
            <span
              style={{
                fontSize: "0.7rem",
                padding: "0.1rem 0.4rem",
                borderRadius: "0.25rem",
                backgroundColor: "rgba(56, 189, 248, 0.2)",
                color: "var(--accent)",
                fontWeight: 600,
              }}
            >
              Sidebery 快照工具
            </span>
          </div>
          <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
            {fileName ? `当前快照: ${fileName}` : "本地安全编辑 · AI 比例归类 · 无损导出"}
          </p>
        </div>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.45rem 0.85rem",
            borderRadius: "0.375rem",
            fontSize: "0.85rem",
            fontWeight: 500,
            cursor: "pointer",
            border: "1px solid var(--border-subtle)",
            backgroundColor: "var(--bg-subtle)",
            color: "var(--text-main)",
            transition: "all 0.15s",
          }}
        >
          <FolderUp size={16} />
          导入快照 JSON
        </button>

        <button
          onClick={handleLoadDemo}
          title="加载包含多样测试标签的模拟快照"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.45rem 0.85rem",
            borderRadius: "0.375rem",
            fontSize: "0.85rem",
            fontWeight: 500,
            cursor: "pointer",
            border: "1px solid rgba(56, 189, 248, 0.4)",
            backgroundColor: "rgba(56, 189, 248, 0.1)",
            color: "var(--accent)",
            transition: "all 0.15s",
          }}
        >
          <PlayCircle size={16} />
          演示样本
        </button>

        {undoStack.length > 0 && (
          <button
            onClick={undo}
            title={`撤销上一次操作 (Ctrl+Z) - 剩余 ${undoStack.length} 步`}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              padding: "0.45rem 0.75rem",
              borderRadius: "0.375rem",
              fontSize: "0.85rem",
              cursor: "pointer",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "transparent",
              color: "var(--text-main)",
            }}
          >
            <Undo2 size={16} />
            撤销 ({undoStack.length})
          </button>
        )}

        <button
          onClick={onOpenAIConfig}
          title="配置 AI 模型与 API 端点"
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.45rem 0.75rem",
            borderRadius: "0.375rem",
            fontSize: "0.85rem",
            cursor: "pointer",
            border: "1px solid var(--border-subtle)",
            backgroundColor: "transparent",
            color: "var(--text-muted)",
          }}
        >
          <Settings size={16} />
          AI 设置
        </button>

        {hasData && (
          <button
            onClick={onTriggerAIAnalysis}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.95rem",
              borderRadius: "0.375rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              boxShadow: "0 2px 4px rgba(37, 99, 235, 0.2)",
            }}
          >
            <Sparkles size={16} />
            AI 比例分析
          </button>
        )}

        {hasData && (
          <button
            onClick={onOpenExport}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 0.95rem",
              borderRadius: "0.375rem",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              backgroundColor: "var(--accent)",
              color: "#0f172a",
            }}
          >
            <Download size={16} />
            导出快照
          </button>
        )}
      </div>
    </header>
  );
}
