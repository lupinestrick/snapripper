"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useConfigStore, DEFAULT_AI_DROPDOWN_SETTINGS } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { toast } from "@/store/useFeedbackStore";
import { flattenTabTree } from "@/services/snapshotParser";
import { clusterSnapshotTabs } from "@/services/tabClusterEngine";
import { getAPIKeySlot, getOrderedModelsForSlot, getProviderMeta, checkAICallLimits } from "@/services/aiService";
import {
  sendArchitectChatRequest,
  sendArchitectDiagnosisRequest,
  DEFAULT_ARCHITECT_DIRECTION_CHIPS,
  applySchemeToSnapshot,
  getFallbackSchemes,
  computeSchemeCoverage,
} from "@/services/aiArchitectEngine";
import {
  BUILTIN_PROVIDER_KEYS,
  ReorganizationScheme,
  AIChatMessage,
  ClusterGranularity,
  ClusterCompressionReport,
} from "@/types/ai";
import { SchemeCard } from "./SchemeCard";
import { MarkdownView } from "./MarkdownView";
import { AIModelSettingsHopup, AIModelSettingsTab } from "./AIModelSettingsHopup";
import { BlueprintCanvasModal } from "./BlueprintCanvasModal";
import { SnapshotFileHopupModal } from "@/components/layout/SnapshotFileHopupModal";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { INITIAL_ARCHITECT_ANALYSIS_PROMPT } from "@/constants/aiPrompts";
import {
  Bot,
  User,
  Sparkles,
  ArrowUp,
  Loader2,
  Settings,
  Plus,
  Check,
  ChevronDown,
  Layers,
  Zap,
  X,
  Pin,
  SlidersHorizontal,
  FolderArchive,
  Undo2,
  History,
  Edit3,
  Trash2,
  Lock,
  Unlock,
  Compass,
} from "lucide-react";

const GRANULARITY_LABELS: Record<ClusterGranularity, string> = {
  coarse: "粗略",
  balanced: "均衡",
  fine: "细致",
};

function SchemeTabsGroup({
  schemes,
  clusterReport,
  applyingSchemeId,
  onApply,
  onTweak,
  onChangeScheme,
  onOpenBlueprint,
}: {
  schemes: ReorganizationScheme[];
  clusterReport?: ClusterCompressionReport;
  applyingSchemeId: string | null;
  onApply: (scheme: ReorganizationScheme) => void;
  onTweak: (scheme: ReorganizationScheme) => void;
  onChangeScheme: (updated: ReorganizationScheme) => void;
  onOpenBlueprint: (scheme: ReorganizationScheme) => void;
}) {
  const [selectedIdx, setSelectedIdx] = useState(0);
  const safeIdx = selectedIdx < schemes.length ? selectedIdx : 0;
  const activeScheme = schemes[safeIdx];

  if (!activeScheme) return null;

  return (
    <div style={{ marginTop: "0.75rem" }}>
      {schemes.length > 1 && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "0.55rem",
            marginBottom: "0.15rem",
          }}
        >
          {schemes.map((s, idx) => {
            const isActive = idx === safeIdx;
            const cov = clusterReport ? computeSchemeCoverage(s, clusterReport) : null;
            const assignedClusterCount = s.categories.reduce(
              (acc, c) => acc + (c.clusterIds?.length || 0),
              0
            );
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => setSelectedIdx(idx)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "flex-start",
                  gap: "0.3rem",
                  padding: "0.65rem 0.8rem",
                  borderRadius: "0.75rem",
                  border: "1px solid",
                  borderColor: isActive ? "var(--accent-solid)" : "var(--border-card)",
                  backgroundColor: isActive ? "var(--accent-subtle)" : "var(--bg-surface)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  textAlign: "left",
                  transition: "all 0.12s ease",
                }}
              >
                <div
                  style={{
                    width: "100%",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.4rem",
                  }}
                >
                  <span
                    style={{
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      color: isActive ? "var(--accent-text)" : "var(--text-main)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.name}
                  </span>
                  {cov && cov.totalNonExemptTabs > 0 && (
                    <span
                      style={{
                        fontSize: "0.68rem",
                        fontWeight: 600,
                        color: cov.coveragePct >= 85 ? "var(--success)" : "var(--accent-text)",
                        flexShrink: 0,
                      }}
                    >
                      {cov.coveragePct}%
                    </span>
                  )}
                </div>

                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.4rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span>{s.categories.length} 分类</span>
                  {assignedClusterCount > 0 && (
                    <>
                      <span>·</span>
                      <span>{assignedClusterCount} 微簇</span>
                    </>
                  )}
                  {cov && cov.totalNonExemptTabs > 0 && (
                    <>
                      <span>·</span>
                      <span>
                        {cov.coveredTabs}/{cov.totalNonExemptTabs} 标签
                      </span>
                    </>
                  )}
                </div>

                {s.strategy && (
                  <div
                    style={{
                      fontSize: "0.71rem",
                      color: "var(--text-muted)",
                      lineHeight: 1.35,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {s.strategy}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      )}

      <SchemeCard
        scheme={activeScheme}
        clusterReport={clusterReport}
        isApplying={applyingSchemeId === activeScheme.id}
        onApply={onApply}
        onTweak={onTweak}
        onChangeScheme={onChangeScheme}
        onOpenBlueprint={onOpenBlueprint}
      />
    </div>
  );
}

export function AIPage() {
  const {
    aiConfig,
    setAIConfig,
    aiPrompts,
    aiDropdownSettings,
    aiCallSettings,
    aiUsageStats,
    recordAIUsage,
    uiSettings,
    togglePinnedModel,
    switchAIProvider,
    crossPanelMerge,
    setCrossPanelMerge,
    createGroupTabs,
    setCreateGroupTabs,
  } = useConfigStore();

  const {
    rawSnapshot,
    rootNodes,
    undoStack,
    undo,
    aiChatMessages,
    aiChatSessions,
    activeChatSessionId,
    addAiChatMessage,
    updateSchemeInChat,
    startNewAiChat,
    selectAiChatSession,
    renameAiChatSession,
    deleteAiChatSession,
    setAiProcessedCache,
    setIsAIDiffModalOpen,
    setActiveMergeReport,
  } = useSnapshotStore();

  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [applyingSchemeId, setApplyingSchemeId] = useState<string | null>(null);
  const [granularity, setGranularity] = useState<ClusterGranularity>("balanced");
  const [clusterInspectorOpen, setClusterInspectorOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const [modelSettingsHopupOpen, setModelSettingsHopupOpen] = useState(false);
  const [settingsHopupTab, setSettingsHopupTab] = useState<AIModelSettingsTab>("dropdown");
  const [fileHopupOpen, setFileHopupOpen] = useState(false);
  const [historyMenuOpen, setHistoryMenuOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");
  const [excludedPanelIds, setExcludedPanelIds] = useState<string[]>([]);
  const [blueprintTarget, setBlueprintTarget] = useState<{
    messageId: string;
    scheme: ReorganizationScheme;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const modelMenuRef = useRef<HTMLDivElement>(null);
  const historyMenuRef = useRef<HTMLDivElement>(null);

  const currentProviderDef = getProviderMeta(aiConfig, aiConfig.provider);
  const dropdownCfg = aiDropdownSettings || DEFAULT_AI_DROPDOWN_SETTINGS;
  const allProviderKeys = useMemo(
    () => [
      ...BUILTIN_PROVIDER_KEYS,
      ...(aiConfig.customProviders || []).map((c) => c.id),
    ],
    [aiConfig.customProviders]
  );
  const visibleProviders = dropdownCfg.visibleProviders?.length
    ? dropdownCfg.visibleProviders.filter((id) => allProviderKeys.includes(id))
    : allProviderKeys;
  const currentSlot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
  const pinnedModels = aiConfig.pinnedModels?.[currentSlot] || [];
  const pinnedSet = useMemo(() => new Set(pinnedModels), [pinnedModels]);
  const dropdownModels = useMemo(
    () => getOrderedModelsForSlot(aiConfig),
    [aiConfig]
  );

  useEffect(() => {
    const handleOutside = (e: MouseEvent) => {
      if (modelMenuRef.current && !modelMenuRef.current.contains(e.target as Node)) {
        setModelMenuOpen(false);
      }
      if (historyMenuRef.current && !historyMenuRef.current.contains(e.target as Node)) {
        setHistoryMenuOpen(false);
        setEditingSessionId(null);
      }
    };
    if (modelMenuOpen || historyMenuOpen) {
      document.addEventListener("mousedown", handleOutside);
    }
    return () => document.removeEventListener("mousedown", handleOutside);
  }, [modelMenuOpen, historyMenuOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiChatMessages, isGenerating]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputPrompt]);

  const allTabs = useMemo(
    () => (rawSnapshot ? flattenTabTree(rootNodes) : []),
    [rawSnapshot, rootNodes]
  );
  const panelCount = rawSnapshot?.panels ? Object.keys(rawSnapshot.panels).length : 0;

  const clusterReport = useMemo<ClusterCompressionReport | undefined>(() => {
    if (!rawSnapshot || allTabs.length === 0) return undefined;
    return clusterSnapshotTabs(allTabs, rawSnapshot.panels, granularity);
  }, [rawSnapshot, allTabs, granularity]);

  const toggleExcludedPanel = (panelId: string) => {
    setExcludedPanelIds((prev) =>
      prev.includes(panelId) ? prev.filter((id) => id !== panelId) : [...prev, panelId]
    );
  };

  const buildScopedReport = (report: ClusterCompressionReport): ClusterCompressionReport => {
    if (excludedPanelIds.length === 0) return report;
    const lockedSet = new Set(excludedPanelIds);
    const activeClusters = report.clusters.filter(
      (c) => !c.sourcePanelIds.every((pid) => lockedSet.has(pid))
    );
    const nonExemptCount = activeClusters.reduce((acc, c) => acc + c.tabCount, 0);
    return {
      ...report,
      clusters: activeClusters,
      nonExemptCount,
    };
  };

  const handleRunDiagnosis = async () => {
    if (isGenerating) return;
    if (!rawSnapshot || allTabs.length === 0 || !clusterReport) {
      toast.warning("请先在工作台导入或加载 Sidebery 快照");
      return;
    }

    const limitCheck = checkAICallLimits(aiCallSettings, aiUsageStats);
    if (!limitCheck.ok) {
      addAiChatMessage({
        id: `ai_limit_${Date.now()}`,
        sender: "assistant",
        timestamp: Date.now(),
        text: `⏳ **已触发调用限制**：${limitCheck.reason}`,
      });
      return;
    }

    const scopedReport = buildScopedReport(clusterReport);

    addAiChatMessage({
      id: `user_diag_${Date.now()}`,
      sender: "user",
      timestamp: Date.now(),
      text: "先生成快照结构诊断摘要，并给出可选整理方向",
    });

    setIsGenerating(true);
    setStatusText(`正在由 ${aiConfig.model || currentProviderDef.model} 生成结构诊断与反问选项...`);

    let usageRecorded = false;
    try {
      const { text, chips } = await sendArchitectDiagnosisRequest(
        { ...aiConfig, callSettings: aiCallSettings },
        scopedReport,
        {
          customSystemPrompt: aiPrompts?.architectDiagnosisPrompt,
          onUsage: (u) => {
            usageRecorded = true;
            recordAIUsage(u);
          },
        }
      );
      if (!usageRecorded) {
        recordAIUsage({ promptTokens: 0, completionTokens: 0 });
      }

      addAiChatMessage({
        id: `ai_diag_${Date.now()}`,
        sender: "assistant",
        timestamp: Date.now(),
        text,
        directionChips: chips,
        clusterReport: scopedReport,
      });
    } catch (err: any) {
      addAiChatMessage({
        id: `ai_diag_err_${Date.now()}`,
        sender: "assistant",
        timestamp: Date.now(),
        text: `⚠️ **诊断请求失败** (${err.message || "连接异常"})\n\n你仍可直接选择下方预设整理方向或使用离线方案：`,
        directionChips: DEFAULT_ARCHITECT_DIRECTION_CHIPS,
        clusterReport: scopedReport,
      });
    } finally {
      setIsGenerating(false);
      setStatusText("");
    }
  };

  const handleInstantLocalSchemes = () => {
    if (!rawSnapshot || allTabs.length === 0 || !clusterReport) {
      toast.warning("请先在工作台导入或加载 Sidebery 快照");
      return;
    }
    const localSchemes = getFallbackSchemes(allTabs, clusterReport, granularity);
    addAiChatMessage({
      id: `ai_local_${Date.now()}`,
      sender: "assistant",
      timestamp: Date.now(),
      text: `已完成本地预聚类（**${clusterReport.nonExemptCount}** 标签 → **${clusterReport.clusters.length}** 微簇，压缩 **${clusterReport.compressionRatio}%**）。点击下方选项卡切换方案，或点选微簇芯片即时调整：`,
      schemes: localSchemes,
      clusterReport,
    });
  };

  const handleSendMessage = async (rawPromptOverride?: string, displayLabel?: string) => {
    const promptForAI = (rawPromptOverride || inputPrompt).trim();
    if (!promptForAI && !rawPromptOverride) return;
    if (isGenerating) return;

    if (!rawSnapshot || allTabs.length === 0 || !clusterReport) {
      toast.warning("请先在工作台导入或加载 Sidebery 快照");
      return;
    }

    const limitCheck = checkAICallLimits(aiCallSettings, aiUsageStats);
    if (!limitCheck.ok) {
      addAiChatMessage({
        id: `ai_limit_${Date.now()}`,
        sender: "assistant",
        timestamp: Date.now(),
        text: `⏳ **已触发调用限制**：${limitCheck.reason}`,
      });
      return;
    }

    const userMsg: AIChatMessage = {
      id: `user_${Date.now()}`,
      sender: "user",
      timestamp: Date.now(),
      text: displayLabel || promptForAI,
    };

    addAiChatMessage(userMsg);
    setInputPrompt("");
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    const scopedReport = buildScopedReport(clusterReport);
    const lockedNames = (scopedReport.activePanels || [])
      .filter((p) => excludedPanelIds.includes(p.id))
      .map((p) => p.name);
    const lockNote =
      lockedNames.length > 0 ? `\n\n（注意：用户已锁定排除以下面板，请勿包含它们：${lockedNames.join("、")}）` : "";

    setIsGenerating(true);
    setStatusText(
      `已压缩 ${scopedReport.clusters.length} 微簇 · 请求 ${aiConfig.model || currentProviderDef.model}...`
    );

    let usageRecorded = false;
    try {
      const latestSchemesMsg = [...aiChatMessages]
        .reverse()
        .find((m) => m.schemes && m.schemes.length > 0);
      const isFreshGeneration =
        !latestSchemesMsg ||
        rawPromptOverride === INITIAL_ARCHITECT_ANALYSIS_PROMPT ||
        Boolean(displayLabel?.startsWith("按「")) ||
        /重(新)?生成|全部方案|3\s*套|三套/.test(promptForAI);

      const historyForAI = [
        ...aiChatMessages.map((m) => ({
          role: m.sender as "user" | "assistant" | "system",
          content: m.text,
        })),
        { role: "user" as const, content: `${promptForAI}${lockNote}` },
      ];

      const { text, schemes } = await sendArchitectChatRequest(
        { ...aiConfig, callSettings: aiCallSettings },
        historyForAI,
        scopedReport,
        aiPrompts?.architectPrompt,
        {
          mode: isFreshGeneration ? "architect" : "refine",
          activeSchemes: latestSchemesMsg?.schemes,
          customRefinementPrompt: aiPrompts?.architectRefinementPrompt,
          onUsage: (u) => {
            usageRecorded = true;
            recordAIUsage(u);
          },
        }
      );
      if (!usageRecorded) {
        recordAIUsage({ promptTokens: 0, completionTokens: 0 });
      }

      const resolvedSchemes =
        schemes && schemes.length > 0
          ? schemes.map((s) => ({ ...s, granularity }))
          : getFallbackSchemes(allTabs, scopedReport, granularity);

      const aiMsg: AIChatMessage = {
        id: `ai_${Date.now()}`,
        sender: "assistant",
        timestamp: Date.now(),
        text,
        schemes: resolvedSchemes,
        clusterReport: scopedReport,
      };

      addAiChatMessage(aiMsg);
    } catch (err: any) {
      console.warn("AI generation failed, fallback to local cluster schemes:", err);
      const fallbackSchemes = getFallbackSchemes(allTabs, clusterReport, granularity);
      const errorReply: AIChatMessage = {
        id: `ai_${Date.now()}`,
        sender: "assistant",
        timestamp: Date.now(),
        text: `⚠️ **AI 响应异常** (${err.message || "连接失败"})\n\n已通过本地微簇引擎生成 3 套离线方案，可直接微调并预览 DIFF：`,
        schemes: fallbackSchemes,
        clusterReport,
      };
      addAiChatMessage(errorReply);
    } finally {
      setIsGenerating(false);
      setStatusText("");
    }
  };

  const handleApplyScheme = (
    scheme: ReorganizationScheme,
    messageClusterReport?: ClusterCompressionReport
  ) => {
    if (!rawSnapshot) return;

    setApplyingSchemeId(scheme.id);
    try {
      const processedCache = applySchemeToSnapshot(rawSnapshot, scheme, {
        crossPanelMerge,
        createGroupTabs,
        targetMode: scheme.targetMode || "tree",
        clusterReport: messageClusterReport || clusterReport,
      });

      setAiProcessedCache(processedCache);
      setIsAIDiffModalOpen(true);

      addAiChatMessage({
        id: `sys_${Date.now()}`,
        sender: "system",
        timestamp: Date.now(),
        text: `已生成【${scheme.name}】差分（覆盖 ${processedCache.summary.categorizedCount} 标签）`,
        appliedSchemeId: scheme.id,
      });
    } catch (err: any) {
      toast.error(`生成差分失败: ${err.message || "处理异常"}`);
    } finally {
      setApplyingSchemeId(null);
    }
  };

  const handleTweakScheme = (scheme: ReorganizationScheme) => {
    setInputPrompt(`基于【${scheme.name}】调整：`);
    textareaRef.current?.focus();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        width: "100%",
        overflow: "hidden",
        backgroundColor: "var(--bg-canvas)",
        color: "var(--text-main)",
        position: "relative",
      }}
    >
      {/* Minimal Top Bar */}
      <header
        style={{
          height: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1rem",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-surface)",
          flexShrink: 0,
          zIndex: 10,
          gap: "0.5rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
          {/* Icon-only File Button (replaces TopNav file button without text) */}
          <Button
            variant="outline"
            size="xs"
            pill
            onClick={() => setFileHopupOpen(true)}
            title="快照文件与导入导出管理"
            style={{ width: "30px", height: "30px", padding: 0, flexShrink: 0 }}
          >
            <FolderArchive size={14} style={{ color: "var(--accent)" }} />
          </Button>

          {/* Provider & Model Dropdown Trigger */}
          <div ref={modelMenuRef} style={{ position: "relative" }}>
            <button
              type="button"
              onClick={() => setModelMenuOpen((prev) => !prev)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                padding: "0.25rem 0.55rem",
                borderRadius: "8px",
                backgroundColor: modelMenuOpen ? "var(--bg-subtle)" : "transparent",
                border: "none",
                color: "var(--text-main)",
                fontSize: "0.84rem",
                fontWeight: 600,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              title="切换供应商与模型"
            >
              <span>{currentProviderDef.name}</span>
              <span style={{ fontSize: "0.74rem", color: "var(--text-muted)", fontWeight: 400 }}>
                ({aiConfig.model || currentProviderDef.model})
              </span>
              <ChevronDown
                size={13}
                style={{
                  color: "var(--text-muted)",
                  transform: modelMenuOpen ? "rotate(180deg)" : "rotate(0deg)",
                  transition: "transform 0.15s ease",
                }}
              />
            </button>

            {modelMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  left: 0,
                  width: "300px",
                  maxWidth: "88vw",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-card)",
                  borderRadius: "0.85rem",
                  boxShadow: "0 12px 28px -5px rgba(0, 0, 0, 0.35)",
                  zIndex: 50,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                {/* Providers Switcher */}
                <div
                  style={{
                    padding: "0.6rem 0.7rem",
                    borderBottom: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.35rem",
                  }}
                >
                  <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--text-muted)" }}>
                    供应商
                  </span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                    {visibleProviders.map((pKey) => {
                      const active = aiConfig.provider === pKey;
                      const pMeta = getProviderMeta(aiConfig, pKey);
                      return (
                        <button
                          key={pKey}
                          type="button"
                          onClick={() => switchAIProvider(pKey)}
                          style={{
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            fontSize: "0.7rem",
                            border: "1px solid",
                            borderColor: active ? "var(--accent-border)" : "var(--border-subtle)",
                            backgroundColor: active ? "var(--accent-subtle)" : "var(--bg-card)",
                            color: active ? "var(--accent-text)" : "var(--text-main)",
                            fontWeight: active ? 600 : 400,
                            cursor: "pointer",
                          }}
                        >
                          {pMeta.name}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Models List (Pinned first) */}
                <div
                  style={{
                    padding: "0.45rem 0.5rem",
                    maxHeight: "230px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.15rem",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      padding: "0.15rem 0.3rem",
                    }}
                  >
                    <span>模型 ({dropdownModels.length})</span>
                  </div>

                  {dropdownModels.map((m) => {
                    const isSelected = (aiConfig.model || currentProviderDef.model) === m;
                    const isPinned = pinnedSet.has(m);
                    return (
                      <div
                        key={m}
                        onClick={() => {
                          setAIConfig({
                            model: m,
                            models: { ...(aiConfig.models || {}), [currentSlot]: m },
                          });
                          setModelMenuOpen(false);
                        }}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.35rem",
                          padding: "0.35rem 0.45rem",
                          borderRadius: "0.45rem",
                          backgroundColor: isSelected ? "var(--accent-subtle)" : "transparent",
                          color: isSelected ? "var(--accent-text)" : "var(--text-main)",
                          cursor: "pointer",
                          fontSize: "0.75rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", minWidth: 0 }}>
                          {isPinned && <Pin size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                          <span
                            style={{
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                            }}
                          >
                            {m}
                          </span>
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              togglePinnedModel(currentSlot, m);
                            }}
                            title={isPinned ? "取消置顶" : "置顶模型"}
                            style={{
                              background: "transparent",
                              border: "none",
                              color: isPinned ? "var(--accent)" : "var(--text-muted)",
                              cursor: "pointer",
                              padding: "2px",
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <Pin size={11} />
                          </button>
                          {isSelected && <Check size={12} style={{ color: "var(--accent)" }} />}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Bottom Settings Trigger */}
                <div
                  style={{
                    padding: "0.45rem 0.6rem",
                    borderTop: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-card)",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => {
                      setModelMenuOpen(false);
                      setSettingsHopupTab("dropdown");
                      setModelSettingsHopupOpen(true);
                    }}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "0.35rem",
                      padding: "0.35rem 0.5rem",
                      borderRadius: "0.45rem",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: "var(--bg-surface)",
                      color: "var(--text-main)",
                      fontSize: "0.74rem",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <SlidersHorizontal size={12} />
                    <span>设置</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {clusterReport && (
            <button
              type="button"
              onClick={() => setClusterInspectorOpen(true)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "0.3rem",
                fontSize: "0.7rem",
                padding: "2px 9px",
                borderRadius: "9999px",
                backgroundColor: "var(--accent-subtle)",
                color: "var(--accent-text)",
                border: "1px solid var(--accent-border)",
                fontWeight: 500,
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
              title="点击查看本地预聚类微簇明细"
            >
              <Layers size={11} />
              <span>
                {clusterReport.clusters.length} 微簇 · {clusterReport.compressionRatio}%
              </span>
            </button>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
          {rawSnapshot && (
            <Button
              variant="outline"
              size="xs"
              pill
              onClick={undo}
              disabled={undoStack.length === 0}
              title="撤销 (Undo)"
              style={{
                width: "30px",
                height: "30px",
                padding: 0,
                color: undoStack.length > 0 ? "var(--text-main)" : "var(--text-muted)",
              }}
            >
              <Undo2 size={14} />
            </Button>
          )}

          <Button
            variant="ghost"
            size="xs"
            pill
            onClick={startNewAiChat}
            title="新对话"
            style={{ color: "var(--text-muted)", padding: "0.3rem 0.6rem" }}
          >
            <Plus size={14} />
            <span style={{ fontSize: "0.74rem" }}>新对话</span>
          </Button>

          {/* Chat History Dropdown (only when layout === "dropdown") */}
          {(uiSettings?.aiChatHistoryLayout || "dropdown") === "dropdown" && (
            <div ref={historyMenuRef} style={{ position: "relative" }}>
            <Button
              variant="ghost"
              size="xs"
              pill
              onClick={() => setHistoryMenuOpen((prev) => !prev)}
              title="对话历史"
              style={{
                color: historyMenuOpen ? "var(--accent)" : "var(--text-muted)",
                padding: "0.3rem 0.4rem",
              }}
            >
              <History size={14} />
              <ChevronDown size={11} />
            </Button>

            {historyMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: "290px",
                  maxWidth: "88vw",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-card)",
                  borderRadius: "0.85rem",
                  boxShadow: "0 12px 28px -5px rgba(0, 0, 0, 0.35)",
                  zIndex: 55,
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                }}
              >
                <div
                  style={{
                    padding: "0.55rem 0.75rem",
                    borderBottom: "1px solid var(--border-subtle)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                  }}
                >
                  <span>对话历史 ({(aiChatSessions || []).length})</span>
                </div>

                <div
                  style={{
                    maxHeight: "280px",
                    overflowY: "auto",
                    padding: "0.35rem",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.2rem",
                  }}
                >
                  {!aiChatSessions || aiChatSessions.length === 0 ? (
                    <div
                      style={{
                        padding: "1rem 0.5rem",
                        textAlign: "center",
                        fontSize: "0.75rem",
                        color: "var(--text-muted)",
                      }}
                    >
                      暂无历史对话
                    </div>
                  ) : (
                    aiChatSessions.map((session) => {
                      const isActive = session.id === activeChatSessionId;
                      const isEditing = editingSessionId === session.id;
                      return (
                        <div
                          key={session.id}
                          onClick={() => {
                            if (!isEditing) {
                              selectAiChatSession(session.id);
                              setHistoryMenuOpen(false);
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.35rem",
                            padding: "0.4rem 0.5rem",
                            borderRadius: "0.5rem",
                            backgroundColor: isActive ? "var(--accent-subtle)" : "transparent",
                            color: isActive ? "var(--accent-text)" : "var(--text-main)",
                            cursor: isEditing ? "default" : "pointer",
                            fontSize: "0.76rem",
                          }}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingTitleValue}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditingTitleValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  renameAiChatSession(session.id, editingTitleValue);
                                  setEditingSessionId(null);
                                } else if (e.key === "Escape") {
                                  setEditingSessionId(null);
                                }
                              }}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--accent-border)",
                                backgroundColor: "var(--bg-card)",
                                color: "var(--text-main)",
                                fontSize: "0.74rem",
                                outline: "none",
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                flex: 1,
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: isActive ? 600 : 400,
                              }}
                              title={session.title}
                            >
                              {session.title}
                            </span>
                          )}

                          <div
                            style={{ display: "flex", alignItems: "center", gap: "0.15rem", flexShrink: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isEditing ? (
                              <button
                                type="button"
                                onClick={() => {
                                  renameAiChatSession(session.id, editingTitleValue);
                                  setEditingSessionId(null);
                                }}
                                title="保存名称"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--success)",
                                  cursor: "pointer",
                                  padding: "2px",
                                }}
                              >
                                <Check size={13} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSessionId(session.id);
                                  setEditingTitleValue(session.title);
                                }}
                                title="编辑名称"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--text-muted)",
                                  cursor: "pointer",
                                  padding: "2px",
                                }}
                              >
                                <Edit3 size={12} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => deleteAiChatSession(session.id)}
                              title="删除对话"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                padding: "2px",
                              }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            )}
            </div>
          )}

          <Button
            variant="ghost"
            size="xs"
            pill
            onClick={() => {
              setSettingsHopupTab("architect");
              setModelSettingsHopupOpen(true);
            }}
            title="AI 架构师设置"
            style={{ color: "var(--text-muted)", padding: "0.35rem" }}
          >
            <Settings size={15} />
          </Button>
        </div>
      </header>

      {/* Scrollable Chat Stream */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          padding: "1.25rem 1rem 132px 1rem",
        }}
      >
        <div
          style={{
            maxWidth: "820px",
            width: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.15rem",
          }}
        >
          {/* Phase 1: 0-Token Local Summary & Direction Selector Card */}
          {aiChatMessages.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                paddingTop: "1rem",
              }}
            >
              <div
                style={{
                  width: "42px",
                  height: "42px",
                  borderRadius: "50%",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-card)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "0.7rem",
                }}
              >
                <Sparkles size={18} />
              </div>

              <h2
                style={{
                  fontSize: "1.25rem",
                  fontWeight: 700,
                  marginBottom: "0.35rem",
                  color: "var(--text-main)",
                }}
              >
                Sidebery 智能架构师
              </h2>

              {rawSnapshot && clusterReport ? (
                <div
                  style={{
                    width: "100%",
                    marginTop: "0.75rem",
                    padding: "1rem 1.15rem",
                    borderRadius: "0.9rem",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-card)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.85rem",
                  }}
                >
                  {/* 0-Token Diagnostic Header */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: "0.5rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.84rem", fontWeight: 600 }}>
                      <Compass size={15} style={{ color: "var(--accent)" }} />
                      <span>本地结构摘要（0 Token）</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.74rem", color: "var(--text-muted)" }}>
                      <span>{allTabs.length} 标签</span>
                      <span>·</span>
                      <span>
                        <strong style={{ color: "var(--text-main)" }}>{clusterReport.clusters.length}</strong> 微簇
                      </span>
                      {clusterReport.exemptProtectedCount > 0 && (
                        <>
                          <span>·</span>
                          <span>已豁免 {clusterReport.exemptProtectedCount}</span>
                        </>
                      )}
                      {clusterReport.emptyPanelNames.length > 0 && (
                        <>
                          <span>·</span>
                          <span>{clusterReport.emptyPanelNames.length} 空面板</span>
                        </>
                      )}
                    </div>
                  </div>

                  {/* Scope Lock: Click panel to lock/exclude */}
                  {clusterReport.activePanels.length > 0 && (
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                        参与整理的面板（点击可锁定跳过）：
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                        {clusterReport.activePanels.map((p) => {
                          const isLocked = excludedPanelIds.includes(p.id);
                          return (
                            <button
                              key={p.id}
                              type="button"
                              onClick={() => toggleExcludedPanel(p.id)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "0.3rem",
                                padding: "0.24rem 0.6rem",
                                borderRadius: "9999px",
                                border: "1px solid",
                                borderColor: isLocked ? "var(--border-subtle)" : "var(--accent-border)",
                                backgroundColor: isLocked ? "var(--bg-card)" : "var(--accent-subtle)",
                                color: isLocked ? "var(--text-muted)" : "var(--accent-text)",
                                fontSize: "0.72rem",
                                textDecoration: isLocked ? "line-through" : "none",
                                cursor: "pointer",
                              }}
                              title={isLocked ? "点击解锁纳入整理" : "点击锁定不参与本次整理"}
                            >
                              {isLocked ? <Lock size={10} /> : <Unlock size={10} />}
                              <span>{p.name}</span>
                              <span style={{ opacity: 0.75 }}>{p.count}</span>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Top Micro-Clusters Preview */}
                  {clusterReport.clusters.length > 0 && (
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                        主要聚类主题预览：
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                        {clusterReport.clusters.slice(0, 6).map((c) => (
                          <span
                            key={c.id}
                            style={{
                              fontSize: "0.7rem",
                              padding: "0.18rem 0.55rem",
                              borderRadius: "9999px",
                              backgroundColor: "var(--bg-card)",
                              border: "1px solid var(--border-subtle)",
                              color: "var(--text-main)",
                            }}
                          >
                            {c.labelHint} <span style={{ color: "var(--text-muted)" }}>({c.tabCount})</span>
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Direction Chips */}
                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.75rem" }}>
                    <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                      按方向快速生成方案：
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(165px, 1fr))", gap: "0.45rem" }}>
                      {DEFAULT_ARCHITECT_DIRECTION_CHIPS.map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          disabled={isGenerating}
                          onClick={() => handleSendMessage(chip.prompt, `按「${chip.label}」方向生成重构方案`)}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: "0.15rem",
                            padding: "0.5rem 0.65rem",
                            borderRadius: "0.6rem",
                            border: "1px solid var(--border-subtle)",
                            backgroundColor: "var(--bg-card)",
                            color: "var(--text-main)",
                            cursor: isGenerating ? "not-allowed" : "pointer",
                            textAlign: "left",
                            transition: "border-color 0.12s ease",
                          }}
                        >
                          <span style={{ fontSize: "0.76rem", fontWeight: 600 }}>{chip.label}</span>
                          {chip.description && (
                            <span style={{ fontSize: "0.67rem", color: "var(--text-muted)" }}>
                              {chip.description}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Primary Action Bar */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      justifyContent: "flex-end",
                      alignItems: "center",
                      gap: "0.5rem",
                      paddingTop: "0.2rem",
                    }}
                  >
                    <Button
                      variant="ghost"
                      size="xs"
                      pill
                      onClick={handleInstantLocalSchemes}
                      disabled={isGenerating}
                      style={{ color: "var(--text-muted)", fontSize: "0.76rem" }}
                    >
                      <Zap size={13} style={{ color: "var(--accent)" }} />
                      <span>离线快速方案</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="xs"
                      pill
                      onClick={handleRunDiagnosis}
                      disabled={isGenerating}
                      style={{ fontSize: "0.76rem" }}
                    >
                      <Compass size={13} />
                      <span>AI 深度诊断并反问</span>
                    </Button>

                    <Button
                      variant="solid"
                      size="xs"
                      pill
                      onClick={() =>
                        handleSendMessage(
                          INITIAL_ARCHITECT_ANALYSIS_PROMPT,
                          "分析当前快照结构并生成重构选项"
                        )
                      }
                      disabled={isGenerating}
                      style={{
                        backgroundColor: "var(--accent-solid)",
                        color: "#fff",
                        fontWeight: 600,
                        fontSize: "0.78rem",
                      }}
                    >
                      <Sparkles size={13} />
                      <span>直接生成重构方案</span>
                    </Button>
                  </div>
                </div>
              ) : (
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginTop: "0.4rem" }}>
                  请先在工作台导入 Sidebery 快照
                </p>
              )}
            </div>
          )}

          {/* Messages Stream */}
          {aiChatMessages.map((msg) => {
            const isUser = msg.sender === "user";
            const isSystem = msg.sender === "system";

            if (isSystem) {
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: "center" }}>
                  <div
                    style={{
                      padding: "0.3rem 0.8rem",
                      borderRadius: "9999px",
                      backgroundColor: "var(--accent-subtle)",
                      color: "var(--accent-text)",
                      fontSize: "0.72rem",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.35rem",
                    }}
                  >
                    <Sparkles size={12} />
                    <span>{msg.text}</span>
                  </div>
                </div>
              );
            }

            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  flexDirection: isUser ? "row-reverse" : "row",
                  gap: "0.7rem",
                  alignItems: "flex-start",
                }}
              >
                <div
                  style={{
                    width: "28px",
                    height: "28px",
                    borderRadius: "50%",
                    backgroundColor: isUser ? "var(--accent-solid)" : "var(--bg-card)",
                    color: isUser ? "#fff" : "var(--accent)",
                    border: isUser ? "none" : "1px solid var(--border-card)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                    marginTop: "2px",
                  }}
                >
                  {isUser ? <User size={14} /> : <Bot size={15} />}
                </div>

                <div
                  style={{
                    maxWidth: isUser ? "78%" : "100%",
                    flex: isUser ? "none" : 1,
                    backgroundColor: isUser ? "var(--bg-surface)" : "transparent",
                    border: isUser ? "1px solid var(--border-card)" : "none",
                    borderRadius: isUser ? "1.15rem 1.15rem 0.3rem 1.15rem" : "0",
                    padding: isUser ? "0.6rem 0.95rem" : "0",
                    minWidth: 0,
                    overflowWrap: "anywhere",
                  }}
                >
                  <MarkdownView content={msg.text} />

                  {msg.directionChips && msg.directionChips.length > 0 && (
                    <div
                      style={{
                        marginTop: "0.7rem",
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(185px, 1fr))",
                        gap: "0.5rem",
                      }}
                    >
                      {msg.directionChips.map((chip) => (
                        <button
                          key={chip.id}
                          type="button"
                          disabled={isGenerating}
                          onClick={() => handleSendMessage(chip.prompt, `按「${chip.label}」方向生成重构方案`)}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: "flex-start",
                            gap: "0.2rem",
                            padding: "0.6rem 0.75rem",
                            borderRadius: "0.7rem",
                            border: "1px solid var(--border-card)",
                            backgroundColor: "var(--bg-surface)",
                            color: "var(--text-main)",
                            cursor: isGenerating ? "not-allowed" : "pointer",
                            textAlign: "left",
                            transition: "border-color 0.12s ease",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.78rem", fontWeight: 600, color: "var(--accent-text)" }}>
                            <Compass size={13} />
                            <span>{chip.label}</span>
                          </div>
                          {chip.description && (
                            <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", lineHeight: 1.35 }}>
                              {chip.description}
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}

                  {msg.schemes && msg.schemes.length > 0 && (
                    <SchemeTabsGroup
                      schemes={msg.schemes}
                      clusterReport={msg.clusterReport || clusterReport}
                      applyingSchemeId={applyingSchemeId}
                      onApply={(s) => handleApplyScheme(s, msg.clusterReport)}
                      onTweak={handleTweakScheme}
                      onChangeScheme={(updated) => updateSchemeInChat(msg.id, updated)}
                      onOpenBlueprint={(s) => setBlueprintTarget({ messageId: msg.id, scheme: s })}
                    />
                  )}

                  {msg.mergeReport && (
                    <div style={{ marginTop: "0.6rem" }}>
                      <Button
                        variant="outline"
                        size="xs"
                        pill
                        onClick={() => setActiveMergeReport(msg.mergeReport!)}
                      >
                        <Compass size={12} />
                        <span>
                          查看合并变更报告 ({msg.mergeReport.categorizedCount}/{msg.mergeReport.totalTabs})
                        </span>
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}

          {isGenerating && (
            <div style={{ display: "flex", gap: "0.7rem", alignItems: "center" }}>
              <div
                style={{
                  width: "28px",
                  height: "28px",
                  borderRadius: "50%",
                  backgroundColor: "var(--bg-card)",
                  color: "var(--accent)",
                  border: "1px solid var(--border-card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Loader2 size={14} className="animate-spin" />
              </div>

              <div
                style={{
                  padding: "0.45rem 0.85rem",
                  borderRadius: "1rem",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.78rem",
                  color: "var(--text-muted)",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <Loader2 size={13} className="animate-spin" />
                <span>{statusText || "思考中..."}</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Pinned Bottom Capsule Input Bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "0.75rem 1rem 1rem 1rem",
          background: "linear-gradient(to top, var(--bg-canvas) 82%, rgba(0,0,0,0) 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 20,
        }}
      >
        <div style={{ maxWidth: "820px", width: "100%", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              flexWrap: "wrap",
              gap: "0.4rem",
              padding: "0 0.4rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
              <button
                type="button"
                onClick={() => setCrossPanelMerge(!crossPanelMerge)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontSize: "0.7rem",
                  border: "1px solid",
                  borderColor: crossPanelMerge ? "var(--accent-border)" : "var(--border-subtle)",
                  backgroundColor: crossPanelMerge ? "var(--accent-subtle)" : "var(--bg-surface)",
                  color: crossPanelMerge ? "var(--accent-text)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <Check size={11} style={{ opacity: crossPanelMerge ? 1 : 0.3 }} />
                <span>跨面板合并</span>
              </button>

              <button
                type="button"
                onClick={() => setCreateGroupTabs(!createGroupTabs)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.25rem",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  fontSize: "0.7rem",
                  border: "1px solid",
                  borderColor: createGroupTabs ? "var(--accent-border)" : "var(--border-subtle)",
                  backgroundColor: createGroupTabs ? "var(--accent-subtle)" : "var(--bg-surface)",
                  color: createGroupTabs ? "var(--accent-text)" : "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                <Check size={11} style={{ opacity: createGroupTabs ? 1 : 0.3 }} />
                <span>折叠组</span>
              </button>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.2rem" }}>
              {(["coarse", "balanced", "fine"] as ClusterGranularity[]).map((g) => (
                <button
                  key={g}
                  type="button"
                  onClick={() => setGranularity(g)}
                  style={{
                    padding: "2px 7px",
                    borderRadius: "9999px",
                    fontSize: "0.68rem",
                    border: "1px solid",
                    borderColor: granularity === g ? "var(--accent-border)" : "var(--border-subtle)",
                    backgroundColor: granularity === g ? "var(--accent-subtle)" : "var(--bg-surface)",
                    color: granularity === g ? "var(--accent-text)" : "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  {GRANULARITY_LABELS[g]}
                </button>
              ))}
            </div>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "0.5rem",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              borderRadius: "1.5rem",
              padding: "0.5rem 0.65rem 0.5rem 1.1rem",
              boxShadow: "0 4px 16px rgba(0, 0, 0, 0.05)",
            }}
          >
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputPrompt}
              onChange={(e) => setInputPrompt(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder="输入调整要求（例如：合并 c1 与 c3，或拆出独立面板）..."
              disabled={isGenerating || !rawSnapshot}
              style={{
                flex: 1,
                backgroundColor: "transparent",
                border: "none",
                outline: "none",
                resize: "none",
                fontSize: "0.875rem",
                color: "var(--text-main)",
                lineHeight: 1.45,
                maxHeight: "150px",
                fontFamily: "inherit",
                padding: "4px 0",
              }}
            />

            <button
              type="button"
              onClick={() => handleSendMessage()}
              disabled={isGenerating || !rawSnapshot || !inputPrompt.trim()}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "50%",
                backgroundColor: inputPrompt.trim() ? "var(--accent-solid)" : "var(--bg-subtle)",
                color: inputPrompt.trim() ? "#fff" : "var(--text-muted)",
                border: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: inputPrompt.trim() ? "pointer" : "default",
                transition: "all 0.15s ease",
                flexShrink: 0,
              }}
            >
              {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <ArrowUp size={16} />}
            </button>
          </div>
        </div>
      </div>

      {/* Micro-Cluster Inspector Hop-up */}
      {clusterReport && (
        <Dialog.Root open={clusterInspectorOpen} onOpenChange={(open) => !open && setClusterInspectorOpen(false)}>
          <Dialog.Backdrop style={{ zIndex: 110 }} />
          <Dialog.Positioner style={{ zIndex: 120 }}>
            <Dialog.Content
              style={{
                maxWidth: "660px",
                width: "94vw",
                maxHeight: "82vh",
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-card)",
                borderRadius: "1rem",
                color: "var(--text-main)",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
              }}
            >
              <div
                style={{
                  padding: "0.8rem 1.2rem",
                  borderBottom: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-surface)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Layers size={15} style={{ color: "var(--accent)" }} />
                  <Dialog.Title style={{ fontSize: "0.92rem", fontWeight: 600 }}>
                    本地预聚类微簇 ({clusterReport.clusters.length})
                  </Dialog.Title>
                  <Badge variant="subtle" size="sm" style={{ fontSize: "0.68rem" }}>
                    {clusterReport.nonExemptCount} 标签 · 压缩 {clusterReport.compressionRatio}%
                  </Badge>
                </div>
                <Dialog.CloseTrigger asChild>
                  <Button
                    variant="ghost"
                    size="xs"
                    pill
                    onClick={() => setClusterInspectorOpen(false)}
                    style={{ padding: "4px" }}
                  >
                    <X size={15} />
                  </Button>
                </Dialog.CloseTrigger>
              </div>

              <div
                style={{
                  flex: 1,
                  overflowY: "auto",
                  padding: "0.85rem 1.1rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem",
                }}
              >
                {clusterReport.clusters.map((clu) => (
                  <div
                    key={clu.id}
                    style={{
                      padding: "0.55rem 0.75rem",
                      borderRadius: "0.6rem",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.25rem",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
                        <span
                          style={{
                            fontFamily: "monospace",
                            fontSize: "0.68rem",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            backgroundColor: "var(--accent-subtle)",
                            color: "var(--accent-text)",
                            fontWeight: 600,
                          }}
                        >
                          {clu.id}
                        </span>
                        <span
                          style={{
                            fontSize: "0.8rem",
                            fontWeight: 600,
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {clu.labelHint}
                        </span>
                      </div>

                      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
                        <Badge variant="outline" size="sm" style={{ fontSize: "0.65rem" }}>
                          {clu.tabCount} 标签
                        </Badge>
                      </div>
                    </div>

                    {clu.sampleTitles.length > 0 && (
                      <div
                        style={{
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {clu.sampleTitles.join(" · ")}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </Dialog.Content>
          </Dialog.Positioner>
        </Dialog.Root>
      )}

      {/* Model & Architect Settings Hop-up */}
      <AIModelSettingsHopup
        isOpen={modelSettingsHopupOpen}
        onClose={() => setModelSettingsHopupOpen(false)}
        initialTab={settingsHopupTab}
      />

      {/* Optional Drag-and-Drop Blueprint Canvas Modal */}
      <BlueprintCanvasModal
        isOpen={Boolean(blueprintTarget)}
        scheme={blueprintTarget?.scheme || null}
        clusterReport={clusterReport}
        onClose={() => setBlueprintTarget(null)}
        onSave={(updated) => {
          if (blueprintTarget) {
            updateSchemeInChat(blueprintTarget.messageId, updated);
          }
        }}
        onApply={(updated) => {
          if (blueprintTarget) {
            updateSchemeInChat(blueprintTarget.messageId, updated);
          }
          handleApplyScheme(updated, clusterReport);
        }}
      />

      {/* Snapshot File Hop-up */}
      <SnapshotFileHopupModal
        isOpen={fileHopupOpen}
        onClose={() => setFileHopupOpen(false)}
      />
    </div>
  );
}
