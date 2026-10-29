"use client";

import React, { useState } from "react";
import { X, Sparkles, FolderTree, PanelsTopLeft, Loader2 } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { classifyTabs } from "@/services/aiService";
import { flattenTabTree } from "@/services/snapshotParser";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

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
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          style={{
            width: "100%",
            maxWidth: "520px",
            padding: "1.5rem",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(56, 189, 248, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#38bdf8",
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <Dialog.Title>按 AI 探查比例自动重构</Dialog.Title>
                <Dialog.Description>选择重组形式并将标签批量分配到对应目标</Dialog.Description>
              </div>
            </div>

            <Button
              variant="ghost"
              size="xs"
              pill
              onClick={onClose}
              style={{ color: "#94a3b8", padding: "4px" }}
              title="关闭"
            >
              <X size={18} />
            </Button>
          </div>

          {/* Mode Selection Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div
              onClick={() => setRestructureMode("tree")}
              style={{
                padding: "1rem",
                borderRadius: "0.75rem",
                border: restructureMode === "tree" ? "2px solid #38bdf8" : "1px solid #334155",
                backgroundColor: restructureMode === "tree" ? "rgba(56, 189, 248, 0.08)" : "#0f172a",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                transition: "all 0.15s ease",
              }}
            >
              <FolderTree size={20} color={restructureMode === "tree" ? "#38bdf8" : "#94a3b8"} style={{ marginTop: "2px" }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#f8fafc" }}>
                  生成树形目录（创建分类 Group 组）
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                  在当前面板内创建对应类别的 Group 标签，并将同类标签移入作为子标签。保持子树整体。
                </div>
              </div>
            </div>

            <div
              onClick={() => setRestructureMode("panel")}
              style={{
                padding: "1rem",
                borderRadius: "0.75rem",
                border: restructureMode === "panel" ? "2px solid #38bdf8" : "1px solid #334155",
                backgroundColor: restructureMode === "panel" ? "rgba(56, 189, 248, 0.08)" : "#0f172a",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                transition: "all 0.15s ease",
              }}
            >
              <PanelsTopLeft size={20} color={restructureMode === "panel" ? "#38bdf8" : "#94a3b8"} style={{ marginTop: "2px" }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "#f8fafc" }}>
                  分割为独立面板（创建侧边栏 Panels）
                </div>
                <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.25rem" }}>
                  为每个主题分类新建一个独立的侧边栏面板，将同类标签移入对应面板中，适合按领域彻底隔离。
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {isClassifying && (
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "#38bdf8", marginBottom: "0.35rem" }}>
                <span>AI 正在逐批归类标签...</span>
                <span>
                  {classificationProgress.current} / {classificationProgress.total} ({percent}%)
                </span>
              </div>
              <div style={{ width: "100%", height: "6px", backgroundColor: "#0f172a", borderRadius: "9999px", overflow: "hidden" }}>
                <div style={{ width: `${percent}%`, height: "100%", backgroundColor: "#38bdf8", transition: "width 0.2s ease" }} />
              </div>
            </div>
          )}

          {errorMsg && (
            <div style={{ padding: "0.6rem 0.85rem", borderRadius: "0.5rem", backgroundColor: "rgba(239, 68, 68, 0.15)", border: "1px solid #ef4444", color: "#f87171", fontSize: "0.8rem", marginBottom: "1rem" }}>
              {errorMsg}
            </div>
          )}

          {/* Footer actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={isClassifying}
              style={{ borderColor: "#334155", color: "#94a3b8" }}
            >
              取消
            </Button>
            <Button
              variant="solid"
              size="sm"
              onClick={handleExecute}
              disabled={isClassifying}
              style={{ backgroundColor: isClassifying ? "#334155" : "#2563eb", color: "#fff" }}
            >
              {isClassifying ? <Loader2 size={15} className="animate-spin" /> : <Sparkles size={15} />}
              <span>{isClassifying ? "正在重组..." : "确认并执行重构"}</span>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
