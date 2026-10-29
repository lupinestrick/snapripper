"use client";

import React, { useState } from "react";
import { X, Sparkles, FolderTree, PanelsTopLeft, Loader2 } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { classifyTabs } from "@/services/aiService";
import { flattenTabTree } from "@/services/snapshotParser";

interface CategorizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CategorizeModal({ isOpen, onClose }: CategorizeModalProps) {
  const {
    rootNodes,
    proportionReport,
    isClassifying,
    setIsClassifying,
    classificationProgress,
    applyTreeCategorization,
    applyPanelCategorization,
  } = useSnapshotStore();

  const { aiConfig } = useConfigStore();
  const [restructureMode, setRestructureMode] = useState<"tree" | "panel">("tree");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !proportionReport) return null;

  const handleExecute = async () => {
    setErrorMsg(null);
    const allTabs = flattenTabTree(rootNodes);
    setIsClassifying(true, { current: 0, total: allTabs.length });

    try {
      const classificationMap = await classifyTabs(
        allTabs,
        proportionReport.categories,
        aiConfig,
        (current, total) => {
          setIsClassifying(true, { current, total });
        }
      );

      const categoryNames = proportionReport.categories.map((c) => c.name);

      if (restructureMode === "tree") {
        applyTreeCategorization(classificationMap, categoryNames);
      } else {
        applyPanelCategorization(
          classificationMap,
          proportionReport.categories.map((c) => ({ id: c.id, name: c.name }))
        );
      }

      setIsClassifying(false);
      onClose();
    } catch (err: any) {
      setIsClassifying(false);
      setErrorMsg(err.message || "分类归纳执行失败");
    }
  };

  const percent =
    classificationProgress.total > 0
      ? Math.round((classificationProgress.current / classificationProgress.total) * 100)
      : 0;

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem",
      }}
      onClick={() => !isClassifying && onClose()}
    >
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "0.75rem",
          width: "100%",
          maxWidth: "520px",
          padding: "1.5rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          color: "var(--text-main)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                padding: "0.4rem",
                borderRadius: "0.375rem",
                backgroundColor: "rgba(34, 197, 94, 0.15)",
                color: "var(--success)",
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>执行按比例智能分类与树重构</h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                共 {proportionReport.categories.length} 个分类，重构整理目标结构
              </p>
            </div>
          </div>
          {!isClassifying && (
            <button
              onClick={onClose}
              style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
            >
              <X size={20} />
            </button>
          )}
        </div>

        {!isClassifying && (
          <div style={{ marginBottom: "1.25rem" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "0.5rem" }}>
              选择在 Sidebery 中的重构组织方式:
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <div
                onClick={() => setRestructureMode("tree")}
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: restructureMode === "tree" ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                  backgroundColor: restructureMode === "tree" ? "rgba(56, 189, 248, 0.1)" : "var(--bg-primary)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
                  <FolderTree size={16} color="var(--accent)" />
                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>树形分组父标签</span>
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.3 }}>
                  在原面板内为每个分类生成折叠父标签，保持原有子树完整性
                </p>
              </div>

              <div
                onClick={() => setRestructureMode("panel")}
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  border: restructureMode === "panel" ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                  backgroundColor: restructureMode === "panel" ? "rgba(56, 189, 248, 0.1)" : "var(--bg-primary)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.25rem" }}>
                  <PanelsTopLeft size={16} color="#38bdf8" />
                  <span style={{ fontWeight: 600, fontSize: "0.85rem" }}>拆分 Sidebery 面板</span>
                </div>
                <p style={{ fontSize: "0.72rem", color: "var(--text-muted)", lineHeight: 1.3 }}>
                  为每个分类创建独立的 Sidebery 侧边栏面板，彻底物理隔离
                </p>
              </div>
            </div>
          </div>
        )}

        {isClassifying && (
          <div style={{ padding: "1rem", backgroundColor: "var(--bg-primary)", borderRadius: "0.5rem", marginBottom: "1rem" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.5rem" }}>
              <span style={{ fontSize: "0.85rem", display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Loader2 size={16} />
                正在智能匹配并分配标签...
              </span>
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--accent)" }}>
                {classificationProgress.current} / {classificationProgress.total} ({percent}%)
              </span>
            </div>

            <div style={{ height: "0.5rem", backgroundColor: "var(--bg-subtle)", borderRadius: "0.25rem", overflow: "hidden" }}>
              <div
                style={{
                  height: "100%",
                  width: `${percent}%`,
                  backgroundColor: "var(--accent)",
                  transition: "width 0.2s ease",
                }}
              />
            </div>
          </div>
        )}

        {errorMsg && (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "var(--danger)",
              fontSize: "0.8rem",
              marginBottom: "1rem",
            }}
          >
            {errorMsg}
          </div>
        )}

        {!isClassifying && (
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <button
              onClick={onClose}
              style={{
                padding: "0.45rem 0.85rem",
                borderRadius: "0.375rem",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "transparent",
                color: "var(--text-muted)",
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              取消
            </button>
            <button
              onClick={handleExecute}
              style={{
                padding: "0.45rem 1.1rem",
                borderRadius: "0.375rem",
                border: "none",
                backgroundColor: "var(--accent)",
                color: "#0f172a",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              开始重构
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
