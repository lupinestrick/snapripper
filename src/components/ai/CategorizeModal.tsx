"use client";

import React, { useState } from "react";
import { X, Sparkles, FolderTree, PanelsTopLeft, Loader2, GitCompare, Check } from "lucide-react";
import { useSnapshotStore, buildProcessedSnapshot } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { classifyTabsWithRulesOrAI } from "@/services/aiService";
import { flattenTabTree } from "@/services/snapshotParser";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AIProcessedCache } from "@/types/ai";

interface CategorizeModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CategorizeModal({ isOpen, onClose }: CategorizeModalProps) {
  const {
    rawSnapshot,
    rootNodes,
    proportionReport,
    isClassifying,
    setIsClassifying,
    classificationProgress,
    setAiProcessedCache,
    setIsAIDiffModalOpen,
  } = useSnapshotStore();

  const { aiConfig, aiGenerateRulesFirst, setAiGenerateRulesFirst, aiPrompts } = useConfigStore();
  const [restructureMode, setRestructureMode] = useState<"tree" | "panel">("tree");
  const [generateRulesFirst, setLocalGenerateRulesFirst] = useState<boolean>(aiGenerateRulesFirst);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!isOpen || !proportionReport) return null;

  const handleExecute = async () => {
    if (!rawSnapshot) return;
    setErrorMsg(null);
    const allTabs = flattenTabTree(rootNodes);
    setIsClassifying(true, { current: 0, total: allTabs.length });

    try {
      const { classificationMap, generatedRules } = await classifyTabsWithRulesOrAI(
        allTabs,
        proportionReport.categories,
        aiConfig,
        generateRulesFirst,
        aiPrompts?.rulesGeneratorPrompt,
        (_status, current, total) => {
          setIsClassifying(true, { current, total });
        }
      );

      const categoryNames = proportionReport.categories.map((c) => c.name);
      const total = allTabs.length;
      const categorizedCount = classificationMap.size;
      const uncategorizedCount = Math.max(0, total - categorizedCount);

      const categoryCounts: Record<string, number> = {};
      for (const name of categoryNames) {
        categoryCounts[name] = 0;
      }
      for (const catName of classificationMap.values()) {
        categoryCounts[catName] = (categoryCounts[catName] || 0) + 1;
      }

      const { processedSnapshot } = buildProcessedSnapshot(
        rawSnapshot,
        classificationMap,
        proportionReport.categories.map((c) => ({ id: c.id, name: c.name })),
        restructureMode
      );

      const cache: AIProcessedCache = {
        originalSnapshot: rawSnapshot,
        processedSnapshot,
        timestamp: Date.now(),
        categoryNames,
        classificationMap: Object.fromEntries(classificationMap),
        generatedRules,
        summary: {
          total,
          categorizedCount,
          uncategorizedCount,
          categoryCounts,
        },
        targetMode: restructureMode,
      };

      setAiProcessedCache(cache);
      setIsClassifying(false);
      onClose();
      setIsAIDiffModalOpen(true);
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
                  backgroundColor: "var(--accent-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent)",
                }}
              >
                <Sparkles size={18} />
              </div>
              <div>
                <Dialog.Title>按 AI 探查比例智能归类</Dialog.Title>
                <Dialog.Description>分类后将自动保存缓存并进入差分确认界面</Dialog.Description>
              </div>
            </div>

            <Button
              variant="ghost"
              size="xs"
              pill
              onClick={onClose}
              style={{ color: "var(--text-muted)", padding: "4px" }}
              title="关闭"
            >
              <X size={18} />
            </Button>
          </div>

          {/* AI rules first option checkbox */}
          <div
            style={{
              padding: "0.85rem 1rem",
              borderRadius: "0.75rem",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              marginBottom: "1rem",
            }}
          >
            <label style={{ display: "flex", alignItems: "flex-start", gap: "0.65rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={generateRulesFirst}
                onChange={(e) => {
                  setLocalGenerateRulesFirst(e.target.checked);
                  setAiGenerateRulesFirst(e.target.checked);
                }}
                style={{ marginTop: "0.2rem", accentColor: "var(--accent-solid)", width: "16px", height: "16px", cursor: "pointer" }}
              />
              <div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                  先提炼生成规则，再用 AI 补充分类 (推荐)
                </div>
                <div style={{ fontSize: "0.74rem", color: "var(--text-muted)", marginTop: "0.15rem", lineHeight: 1.4 }}>
                  开启后将先依据各主题提取域名与关键词生成高精度匹配规则，快速匹配主流网站，再对剩余未匹配标签调用大模型归纳。
                </div>
              </div>
            </label>
          </div>

          {/* Mode Selection Cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div
              onClick={() => setRestructureMode("tree")}
              style={{
                padding: "1rem",
                borderRadius: "0.75rem",
                border: restructureMode === "tree" ? "2px solid var(--accent-solid)" : "1px solid var(--border-subtle)",
                backgroundColor: restructureMode === "tree" ? "var(--accent-subtle)" : "var(--bg-subtle)",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                transition: "all 0.15s ease",
              }}
            >
              <FolderTree size={20} style={{ marginTop: "2px", color: restructureMode === "tree" ? "var(--accent-text)" : "var(--text-muted)" }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)" }}>
                  生成树形目录（创建分类 Group 组）
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  在指定面板内创建对应类别的 Group 组标签，将同类标签移入作为子标签。进入差分后可选择具体面板。
                </div>
              </div>
            </div>

            <div
              onClick={() => setRestructureMode("panel")}
              style={{
                padding: "1rem",
                borderRadius: "0.75rem",
                border: restructureMode === "panel" ? "2px solid var(--accent-solid)" : "1px solid var(--border-subtle)",
                backgroundColor: restructureMode === "panel" ? "var(--accent-subtle)" : "var(--bg-subtle)",
                cursor: "pointer",
                display: "flex",
                alignItems: "flex-start",
                gap: "0.75rem",
                transition: "all 0.15s ease",
              }}
            >
              <PanelsTopLeft size={20} style={{ marginTop: "2px", color: restructureMode === "panel" ? "var(--accent-text)" : "var(--text-muted)" }} />
              <div>
                <div style={{ fontWeight: 600, fontSize: "0.9rem", color: "var(--text-main)" }}>
                  分割为独立面板（创建侧边栏 Panels）
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
                  为每个主题分类新建一个独立的侧边栏面板，将同类标签移入对应面板中，适合按领域彻底隔离。
                </div>
              </div>
            </div>
          </div>

          {/* Progress bar */}
          {isClassifying && (
            <div style={{ marginBottom: "1.25rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.75rem", color: "var(--accent-text)", marginBottom: "0.35rem" }}>
                <span>正在执行分类归类...</span>
                <span>
                  {classificationProgress.current} / {classificationProgress.total} ({percent}%)
                </span>
              </div>
              <div style={{ width: "100%", height: "6px", backgroundColor: "var(--bg-subtle)", borderRadius: "9999px", overflow: "hidden" }}>
                <div style={{ width: `${percent}%`, height: "100%", backgroundColor: "var(--accent-solid)", transition: "width 0.2s ease" }} />
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
            >
              取消
            </Button>
            <Button
              variant="solid"
              size="sm"
              onClick={handleExecute}
              disabled={isClassifying}
            >
              {isClassifying ? <Loader2 size={15} className="animate-spin" /> : <GitCompare size={15} />}
              <span>{isClassifying ? "正在分类处理..." : "开始分类并生成差分"}</span>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
