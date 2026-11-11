"use client";

import React from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sparkles, FileEdit, GitCompare, Check, X } from "lucide-react";

export function PostEditBanner() {
  const {
    aiProcessedCache,
    isPostEditMode,
    enterPostEditMode,
    exitPostEditMode,
    setIsAIDiffModalOpen,
  } = useSnapshotStore();

  if (!aiProcessedCache) return null;

  // State 1: When in Post-Edit Mode
  if (isPostEditMode) {
    return (
      <div
        style={{
          margin: "0.6rem 1.5rem 0",
          padding: "0.65rem 1.25rem",
          borderRadius: "0.75rem",
          backgroundColor: "var(--accent-subtle)",
          border: "1px solid var(--accent-solid)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "1rem",
          flexWrap: "wrap",
          animation: "fadeIn 0.2s ease-in-out",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.65rem" }}>
          <Badge
            variant="solid"
            size="sm"
            style={{
              backgroundColor: "var(--accent-solid)",
              color: "#fff",
              fontWeight: 700,
            }}
          >
            AI 处理后编辑 (Post Edit)
          </Badge>
          <span style={{ fontSize: "0.82rem", color: "var(--text-main)", fontWeight: 500 }}>
            当前页面显示已被 AI 分类处理的数据，可自由修改微调，点击 DIFF 可对比原始快照差异。
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <Button
            variant="outline"
            size="xs"
            pill
            onClick={() => setIsAIDiffModalOpen(true)}
            style={{
              backgroundColor: "var(--bg-card)",
              borderColor: "var(--accent-solid)",
              color: "var(--accent-text)",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
            }}
            title="查看当前编辑数据与原始快照的 DIFF 差分"
          >
            <GitCompare size={14} />
            <span>DIFF</span>
          </Button>

          <Button
            variant="solid"
            size="xs"
            pill
            onClick={() => exitPostEditMode(true)}
            style={{
              backgroundColor: "var(--success, #10b981)",
              color: "#fff",
              fontWeight: 600,
            }}
            title="应用当前编辑并保存为最终快照"
          >
            <Check size={14} />
            <span>确认应用</span>
          </Button>

          <Button
            variant="ghost"
            size="xs"
            pill
            onClick={() => exitPostEditMode(false)}
            style={{
              color: "var(--text-muted)",
            }}
            title="放弃本次编辑并还原原始数据"
          >
            <X size={14} />
            <span>退出还原</span>
          </Button>
        </div>
      </div>
    );
  }

  // State 2: Cache generated, not yet entered Post-Edit Mode
  return (
    <div
      style={{
        margin: "0.6rem 1.5rem 0",
        padding: "0.5rem 1.25rem",
        borderRadius: "0.75rem",
        backgroundColor: "var(--bg-subtle)",
        border: "1px dashed var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "1rem",
        flexWrap: "wrap",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Sparkles size={16} style={{ color: "var(--accent)" }} />
        <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-main)" }}>
          AI 分类缓存已就绪
        </span>
        <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
          (共 {aiProcessedCache.summary.categorizedCount} 个标签归入 {aiProcessedCache.categoryNames.length} 个分类)
        </span>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        <Button
          variant="solid"
          size="xs"
          pill
          onClick={enterPostEditMode}
          style={{
            backgroundColor: "var(--accent-solid)",
            color: "#fff",
            fontWeight: 600,
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <FileEdit size={13} />
          <span>AI 处理后编辑 (Post Edit)</span>
        </Button>

        <Button
          variant="outline"
          size="xs"
          pill
          onClick={() => setIsAIDiffModalOpen(true)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.3rem",
          }}
        >
          <GitCompare size={13} />
          <span>DIFF 对比</span>
        </Button>
      </div>
    </div>
  );
}
