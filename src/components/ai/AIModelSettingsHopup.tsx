"use client";

import React, { useState, useEffect } from "react";
import {
  useConfigStore,
  DEFAULT_AI_DROPDOWN_SETTINGS,
  DEFAULT_UI_SETTINGS,
  DEFAULT_AI_CALL_SETTINGS,
  DEFAULT_AI_USAGE_STATS,
  AI_CALL_PRESET_CONFIGS,
  AIChatHistoryLayout,
} from "@/store/useConfigStore";
import { BUILTIN_PROVIDER_KEYS, AIProtocolType, AICallPreset } from "@/types/ai";
import {
  getAPIKeySlot,
  fetchAvailableModels,
  testAIConnection,
  getOrderedModelsForSlot,
  getProviderMeta,
} from "@/services/aiService";
import { AddProviderModal } from "./AddProviderModal";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  X,
  SlidersHorizontal,
  Pin,
  RefreshCw,
  Loader2,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  ChevronDownSquare,
  LayoutList,
  ChevronDown,
  ChevronRight,
  RotateCcw,
} from "lucide-react";

export type AIModelSettingsTab = "dropdown" | "api" | "architect" | "limits";

interface AIModelSettingsHopupProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: AIModelSettingsTab;
}

export function AIModelSettingsHopup({ isOpen, onClose, initialTab = "dropdown" }: AIModelSettingsHopupProps) {
  const {
    aiConfig,
    setAIConfig,
    aiDropdownSettings,
    setAIDropdownSettings,
    aiCallSettings,
    setAICallSettings,
    applyAICallPreset,
    aiUsageStats,
    resetTodayAIUsage,
    uiSettings,
    setUISettings,
    togglePinnedModel,
    switchAIProvider,
    updateCustomProvider,
    deleteCustomProvider,
  } = useConfigStore();

  const [activeTab, setActiveTab] = useState<AIModelSettingsTab>(initialTab);
  const [advancedLimitsOpen, setAdvancedLimitsOpen] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
    }
  }, [isOpen, initialTab]);
  const [customPinInput, setCustomPinInput] = useState("");
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchStatus, setFetchStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [isSearchingApiModels, setIsSearchingApiModels] = useState(false);

  if (!isOpen) return null;

  const allProviderIds = [
    ...BUILTIN_PROVIDER_KEYS,
    ...(aiConfig.customProviders || []).map((c) => c.id),
  ];
  const dropdownCfg = aiDropdownSettings || DEFAULT_AI_DROPDOWN_SETTINGS;
  const visibleProviders = dropdownCfg.visibleProviders?.length
    ? dropdownCfg.visibleProviders.filter((id) => allProviderIds.includes(id))
    : allProviderIds;
  const maxDropdownModels = dropdownCfg.maxDropdownModels || 8;

  const slot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
  const activeMeta = getProviderMeta(aiConfig, aiConfig.provider);
  const activeCustom = (aiConfig.customProviders || []).find((c) => c.id === aiConfig.provider);
  const pinnedList = aiConfig.pinnedModels?.[slot] || [];
  const pinnedSet = new Set(pinnedList);
  const orderedModels = getOrderedModelsForSlot(aiConfig);

  const apiSearchQuery = isSearchingApiModels ? (aiConfig.model || "").trim().toLowerCase() : "";
  const apiFilteredModels = apiSearchQuery
    ? orderedModels.filter((m) => m.toLowerCase().includes(apiSearchQuery))
    : orderedModels;

  const handleToggleVisibleProvider = (pKey: string) => {
    const exists = visibleProviders.includes(pKey);
    if (exists && visibleProviders.length <= 1) return;
    const next = exists
      ? visibleProviders.filter((k) => k !== pKey)
      : [...visibleProviders, pKey];
    setAIDropdownSettings({ visibleProviders: next });
  };

  const handleFetchModels = async () => {
    setIsFetchingModels(true);
    setFetchStatus(null);
    try {
      const models = await fetchAvailableModels(aiConfig);
      setAIConfig({
        cachedModels: {
          ...(aiConfig.cachedModels || {}),
          [slot]: models,
        },
      });
      setFetchStatus({ success: true, message: `已获取 ${models.length} 个模型` });
    } catch (err: any) {
      setFetchStatus({ success: false, message: err.message || "获取失败" });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testAIConnection(aiConfig);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "连接失败" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleAddCustomPin = () => {
    const val = customPinInput.trim();
    if (!val) return;
    if (!pinnedSet.has(val)) {
      togglePinnedModel(slot, val);
    }
    setCustomPinInput("");
  };

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Backdrop style={{ zIndex: 110 }} />
        <Dialog.Positioner style={{ zIndex: 120 }}>
          <Dialog.Content
            style={{
              maxWidth: "560px",
              width: "94vw",
              maxHeight: "86vh",
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
            {/* Header */}
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
                <SlidersHorizontal size={15} style={{ color: "var(--accent)" }} />
                <Dialog.Title style={{ fontSize: "0.94rem", fontWeight: 600 }}>
                  AI 架构师与模型设置
                </Dialog.Title>
              </div>
              <Dialog.CloseTrigger asChild>
                <Button variant="ghost" size="xs" pill onClick={onClose} style={{ padding: "4px" }}>
                  <X size={15} />
                </Button>
              </Dialog.CloseTrigger>
            </div>

            {/* Segmented Tab Switcher */}
            <div
              style={{
                padding: "0.6rem 1.2rem",
                borderBottom: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-surface)",
                display: "flex",
                gap: "0.4rem",
              }}
            >
              <Button
                type="button"
                variant={activeTab === "dropdown" ? "subtle" : "ghost"}
                size="xs"
                pill
                onClick={() => setActiveTab("dropdown")}
              >
                下拉菜单与置顶模型
              </Button>
              <Button
                type="button"
                variant={activeTab === "api" ? "subtle" : "ghost"}
                size="xs"
                pill
                onClick={() => setActiveTab("api")}
              >
                模型 API 设置
              </Button>
              <Button
                type="button"
                variant={activeTab === "architect" ? "subtle" : "ghost"}
                size="xs"
                pill
                onClick={() => setActiveTab("architect")}
              >
                对话历史布局
              </Button>
              <Button
                type="button"
                variant={activeTab === "limits" ? "subtle" : "ghost"}
                size="xs"
                pill
                onClick={() => setActiveTab("limits")}
              >
                调用参数与限制
              </Button>
            </div>

            {/* Body */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1.1rem 1.2rem",
                display: "flex",
                flexDirection: "column",
                gap: "1.1rem",
              }}
            >
              {activeTab === "dropdown" ? (
                <>
                  {/* 1. Visible Providers */}
                  <div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.45rem" }}>
                      下拉菜单显示的供应商
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                      {allProviderIds.map((pKey) => {
                        const active = visibleProviders.includes(pKey);
                        const meta = getProviderMeta(aiConfig, pKey);
                        return (
                          <button
                            key={pKey}
                            type="button"
                            onClick={() => handleToggleVisibleProvider(pKey)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "0.3rem",
                              padding: "0.3rem 0.7rem",
                              borderRadius: "9999px",
                              fontSize: "0.74rem",
                              border: "1px solid",
                              borderColor: active ? "var(--accent-border)" : "var(--border-subtle)",
                              backgroundColor: active ? "var(--accent-subtle)" : "var(--bg-surface)",
                              color: active ? "var(--accent-text)" : "var(--text-muted)",
                              cursor: "pointer",
                            }}
                          >
                            <Check size={11} style={{ opacity: active ? 1 : 0.25 }} />
                            <span>{meta.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 2. Max Dropdown Models Count */}
                  <div
                    style={{
                      borderTop: "1px solid var(--border-subtle)",
                      paddingTop: "0.95rem",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.75rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>下拉菜单显示模型数量</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                      {[5, 8, 12, 20].map((num) => (
                        <button
                          key={num}
                          type="button"
                          onClick={() => setAIDropdownSettings({ maxDropdownModels: num })}
                          style={{
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            fontSize: "0.72rem",
                            border: "1px solid",
                            borderColor:
                              maxDropdownModels === num
                                ? "var(--accent-border)"
                                : "var(--border-subtle)",
                            backgroundColor:
                              maxDropdownModels === num ? "var(--accent-subtle)" : "transparent",
                            color:
                              maxDropdownModels === num ? "var(--accent-text)" : "var(--text-muted)",
                            cursor: "pointer",
                          }}
                        >
                          {num}
                        </button>
                      ))}
                      <Input
                        type="number"
                        min={1}
                        max={50}
                        value={maxDropdownModels}
                        onChange={(e) =>
                          setAIDropdownSettings({
                            maxDropdownModels: Math.max(1, Math.min(50, parseInt(e.target.value) || 8)),
                          })
                        }
                        style={{ width: "58px", textAlign: "center", fontSize: "0.75rem", padding: "0.2rem" }}
                      />
                    </div>
                  </div>

                  {/* 3. Pinned Models Management */}
                  <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.95rem" }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        marginBottom: "0.5rem",
                        gap: "0.5rem",
                      }}
                    >
                      <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>
                        置顶模型（{activeMeta.name}）
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        pill
                        onClick={handleFetchModels}
                        disabled={isFetchingModels}
                        style={{ fontSize: "0.7rem" }}
                      >
                        {isFetchingModels ? (
                          <Loader2 size={11} className="animate-spin" />
                        ) : (
                          <RefreshCw size={11} />
                        )}
                        <span>拉取模型</span>
                      </Button>
                    </div>

                    {fetchStatus && (
                      <div
                        style={{
                          fontSize: "0.72rem",
                          color: fetchStatus.success ? "var(--success)" : "var(--danger)",
                          marginBottom: "0.45rem",
                        }}
                      >
                        {fetchStatus.message}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "0.4rem", marginBottom: "0.6rem" }}>
                      <Input
                        type="text"
                        value={customPinInput}
                        onChange={(e) => setCustomPinInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            handleAddCustomPin();
                          }
                        }}
                        placeholder="输入模型名称并置顶..."
                        style={{ fontSize: "0.76rem", flex: 1 }}
                      />
                      <Button type="button" variant="outline" size="xs" pill onClick={handleAddCustomPin}>
                        <Plus size={12} />
                        <span>置顶</span>
                      </Button>
                    </div>

                    <div
                      style={{
                        maxHeight: "180px",
                        overflowY: "auto",
                        border: "1px solid var(--border-subtle)",
                        borderRadius: "0.6rem",
                        backgroundColor: "var(--bg-surface)",
                      }}
                    >
                      {orderedModels.length === 0 ? (
                        <div style={{ padding: "0.75rem", fontSize: "0.75rem", color: "var(--text-muted)", textAlign: "center" }}>
                          暂无候选模型，可上方手动输入置顶或点击拉取模型
                        </div>
                      ) : (
                        orderedModels.map((m, idx) => {
                          const isPinned = pinnedSet.has(m);
                          return (
                            <div
                              key={m}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "space-between",
                                padding: "0.4rem 0.65rem",
                                borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)",
                                fontSize: "0.76rem",
                                fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                              }}
                            >
                              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {m}
                              </span>
                              <button
                                type="button"
                                onClick={() => togglePinnedModel(slot, m)}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "0.25rem",
                                  padding: "2px 7px",
                                  borderRadius: "9999px",
                                  border: "1px solid",
                                  borderColor: isPinned ? "var(--accent-border)" : "var(--border-subtle)",
                                  backgroundColor: isPinned ? "var(--accent-subtle)" : "transparent",
                                  color: isPinned ? "var(--accent-text)" : "var(--text-muted)",
                                  fontSize: "0.68rem",
                                  fontFamily: "inherit",
                                  cursor: "pointer",
                                  flexShrink: 0,
                                }}
                              >
                                <Pin size={10} />
                                <span>{isPinned ? "已置顶" : "置顶"}</span>
                              </button>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                </>
              ) : activeTab === "api" ? (
                /* Tab 2: Model API Settings */
                <>
                  <div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.45rem" }}>
                      当前供应商
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.35rem" }}>
                      {allProviderIds.map((pKey) => {
                        const active = aiConfig.provider === pKey;
                        const meta = getProviderMeta(aiConfig, pKey);
                        const isCustomItem = (aiConfig.customProviders || []).some((c) => c.id === pKey);
                        return (
                          <div key={pKey} style={{ display: "inline-flex", alignItems: "center", gap: "2px" }}>
                            <Button
                              type="button"
                              variant={active ? "solid" : "outline"}
                              size="xs"
                              pill
                              onClick={() => {
                                switchAIProvider(pKey);
                                setTestResult(null);
                                setFetchStatus(null);
                                setIsSearchingApiModels(false);
                              }}
                            >
                              {meta.name}
                            </Button>
                            {isCustomItem && active && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="xs"
                                pill
                                onClick={() => deleteCustomProvider(pKey)}
                                title="删除自定义供应商"
                                style={{ padding: "3px", color: "var(--danger)" }}
                              >
                                <Trash2 size={12} />
                              </Button>
                            )}
                          </div>
                        );
                      })}
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        pill
                        onClick={() => setAddProviderOpen(true)}
                        title="添加新的自定义供应商"
                        style={{ borderStyle: "dashed" }}
                      >
                        <Plus size={12} />
                      </Button>
                    </div>
                  </div>

                  {activeCustom && (
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.5rem" }}>
                      <Input
                        type="text"
                        value={activeCustom.name}
                        onChange={(e) => updateCustomProvider(activeCustom.id, { name: e.target.value })}
                        placeholder="供应商名称"
                        style={{ width: "145px", fontSize: "0.76rem" }}
                      />
                      <div style={{ display: "flex", gap: "0.25rem" }}>
                        {(["openai", "anthropic", "gemini"] as AIProtocolType[]).map((proto) => (
                          <Button
                            key={proto}
                            type="button"
                            variant={activeCustom.type === proto ? "subtle" : "outline"}
                            size="xs"
                            pill
                            onClick={() => updateCustomProvider(activeCustom.id, { type: proto })}
                            style={{ fontSize: "0.7rem" }}
                          >
                            {proto === "openai" ? "OpenAI" : proto === "anthropic" ? "Anthropic" : "Gemini"}
                          </Button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                      Base URL
                    </label>
                    <Input
                      type="text"
                      value={aiConfig.baseURL || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setAIConfig({
                          baseURL: val,
                          baseURLs: { ...(aiConfig.baseURLs || {}), [slot]: val },
                        });
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                      API Key
                    </label>
                    <Input
                      type="password"
                      value={aiConfig.apiKey || ""}
                      placeholder="sk-..."
                      onChange={(e) => {
                        const val = e.target.value;
                        setAIConfig({
                          apiKey: val,
                          apiKeys: { ...(aiConfig.apiKeys || {}), [slot]: val },
                        });
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                      当前模型（输入即搜索过滤）
                    </label>
                    <Input
                      type="text"
                      value={aiConfig.model || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        setIsSearchingApiModels(true);
                        setAIConfig({
                          model: val,
                          models: { ...(aiConfig.models || {}), [slot]: val },
                        });
                      }}
                    />
                    {isSearchingApiModels && apiFilteredModels.length > 0 && (
                      <div
                        style={{
                          marginTop: "0.35rem",
                          maxHeight: "130px",
                          overflowY: "auto",
                          borderRadius: "0.5rem",
                          border: "1px solid var(--border-subtle)",
                          backgroundColor: "var(--bg-surface)",
                          padding: "0.25rem",
                        }}
                      >
                        {apiFilteredModels.map((m) => (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              setAIConfig({
                                model: m,
                                models: { ...(aiConfig.models || {}), [slot]: m },
                              });
                              setIsSearchingApiModels(false);
                            }}
                            style={{
                              width: "100%",
                              textAlign: "left",
                              padding: "0.3rem 0.5rem",
                              borderRadius: "4px",
                              border: "none",
                              backgroundColor: aiConfig.model === m ? "var(--accent-subtle)" : "transparent",
                              color: aiConfig.model === m ? "var(--accent-text)" : "var(--text-main)",
                              fontSize: "0.74rem",
                              fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                              cursor: "pointer",
                            }}
                          >
                            {m}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem", flexWrap: "wrap" }}>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      pill
                      onClick={handleTestConnection}
                      disabled={isTesting}
                    >
                      {isTesting && <Loader2 size={12} className="animate-spin" />}
                      <span>测试连接</span>
                    </Button>

                    {testResult && (
                      <span
                        style={{
                          fontSize: "0.74rem",
                          color: testResult.success ? "var(--success)" : "var(--danger)",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                        }}
                      >
                        {testResult.success ? <Check size={12} /> : <AlertCircle size={12} />}
                        {testResult.message}
                      </span>
                    )}
                  </div>
                </>
              ) : activeTab === "architect" ? (
                /* Tab 3: Architect & Chat History Layout */
                <>
                  <div>
                    <div style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                      对话历史布局
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.55rem" }}>
                      {(
                        [
                          {
                            id: "dropdown" as AIChatHistoryLayout,
                            label: "下拉菜单",
                            icon: <ChevronDownSquare size={15} />,
                          },
                          {
                            id: "sidebar" as AIChatHistoryLayout,
                            label: "插入导航栏",
                            icon: <LayoutList size={15} />,
                          },
                        ] as const
                      ).map((opt) => {
                        const currentLayout =
                          uiSettings?.aiChatHistoryLayout ||
                          DEFAULT_UI_SETTINGS.aiChatHistoryLayout ||
                          "dropdown";
                        const active = currentLayout === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => setUISettings({ aiChatHistoryLayout: opt.id })}
                            style={{
                              display: "flex",
                              flexDirection: "column",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "0.35rem",
                              padding: "0.75rem 0.5rem",
                              borderRadius: "0.65rem",
                              border: "1px solid",
                              borderColor: active ? "var(--accent-solid)" : "var(--border-subtle)",
                              backgroundColor: active ? "var(--accent-subtle)" : "var(--bg-surface)",
                              color: active ? "var(--accent-text)" : "var(--text-muted)",
                              fontSize: "0.78rem",
                              fontWeight: active ? 600 : 500,
                              cursor: "pointer",
                              transition: "all 0.12s ease",
                            }}
                          >
                            {opt.icon}
                            <span>{opt.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </>
              ) : (
                /* Tab 4: Call Presets, Parameters & Limits */
                <>
                  {(() => {
                    const callCfg = aiCallSettings || DEFAULT_AI_CALL_SETTINGS;
                    const usage = aiUsageStats || DEFAULT_AI_USAGE_STATS;
                    const presets: {
                      id: Exclude<AICallPreset, "custom">;
                      title: string;
                      summary: string;
                    }[] = [
                      { id: "eco", title: "省流快速", summary: "低温 0.1 · 2 轮 · 3s 冷却 · 50次/日" },
                      { id: "balanced", title: "均衡默认", summary: "低温 0.2 · 6 轮 · 90s 超时" },
                      { id: "deep", title: "深度架构", summary: "8192 输出 · 12 轮 · 150s 超时" },
                    ];

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        {/* 1. Scenario Presets */}
                        <div>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              marginBottom: "0.45rem",
                            }}
                          >
                            <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>场景预设</span>
                            {callCfg.preset === "custom" && (
                              <span
                                style={{
                                  fontSize: "0.68rem",
                                  padding: "1px 7px",
                                  borderRadius: "9999px",
                                  backgroundColor: "var(--accent-subtle)",
                                  color: "var(--accent-text)",
                                  border: "1px solid var(--accent-border)",
                                  fontWeight: 600,
                                }}
                              >
                                已自定义
                              </span>
                            )}
                          </div>

                          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.45rem" }}>
                            {presets.map((p) => {
                              const active = callCfg.preset === p.id;
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => applyAICallPreset(p.id)}
                                  style={{
                                    display: "flex",
                                    flexDirection: "column",
                                    alignItems: "flex-start",
                                    gap: "0.2rem",
                                    padding: "0.6rem 0.65rem",
                                    borderRadius: "0.6rem",
                                    border: "1px solid",
                                    borderColor: active ? "var(--accent-solid)" : "var(--border-subtle)",
                                    backgroundColor: active ? "var(--accent-subtle)" : "var(--bg-surface)",
                                    color: active ? "var(--accent-text)" : "var(--text-main)",
                                    cursor: "pointer",
                                    textAlign: "left",
                                    transition: "all 0.12s ease",
                                  }}
                                >
                                  <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>{p.title}</span>
                                  <span style={{ fontSize: "0.66rem", color: "var(--text-muted)", lineHeight: 1.3 }}>
                                    {p.summary}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 2. Today's Usage Strip */}
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.5rem",
                            padding: "0.55rem 0.75rem",
                            borderRadius: "0.6rem",
                            backgroundColor: "var(--bg-surface)",
                            border: "1px solid var(--border-subtle)",
                            flexWrap: "wrap",
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", fontSize: "0.74rem", flexWrap: "wrap" }}>
                            <span>
                              今日调用:{" "}
                              <strong style={{ color: "var(--accent-text)" }}>
                                {usage.callsToday}
                                {callCfg.dailyCallLimit > 0 ? ` / ${callCfg.dailyCallLimit}` : ""}
                              </strong>
                            </span>
                            <span style={{ color: "var(--text-muted)" }}>
                              Tokens: {(usage.promptTokensToday || 0) + (usage.completionTokensToday || 0)}
                            </span>
                          </div>
                          <Button
                            type="button"
                            variant="ghost"
                            size="xs"
                            pill
                            onClick={resetTodayAIUsage}
                            title="重置今日调用计数"
                            style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}
                          >
                            <RotateCcw size={11} />
                            <span>重置</span>
                          </Button>
                        </div>

                        {/* 3. Collapsible Advanced Parameters & Guardrails */}
                        <div
                          style={{
                            borderRadius: "0.65rem",
                            border: "1px solid var(--border-subtle)",
                            backgroundColor: "var(--bg-surface)",
                            overflow: "hidden",
                          }}
                        >
                          <button
                            type="button"
                            onClick={() => setAdvancedLimitsOpen((prev) => !prev)}
                            style={{
                              width: "100%",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              padding: "0.6rem 0.75rem",
                              backgroundColor: "transparent",
                              border: "none",
                              color: "var(--text-main)",
                              fontSize: "0.78rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <span>高级参数与调用限制</span>
                            {advancedLimitsOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                          </button>

                          {advancedLimitsOpen && (
                            <div
                              style={{
                                padding: "0.75rem",
                                borderTop: "1px solid var(--border-subtle)",
                                display: "grid",
                                gridTemplateColumns: "repeat(2, 1fr)",
                                gap: "0.7rem",
                              }}
                            >
                              {/* Temperature */}
                              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.72rem" }}>
                                <span style={{ color: "var(--text-muted)" }}>Temperature (0 ~ 1.5)</span>
                                <Input
                                  type="number"
                                  step={0.05}
                                  min={0}
                                  max={1.5}
                                  value={callCfg.temperature}
                                  onChange={(e) =>
                                    setAICallSettings({
                                      temperature: Math.min(1.5, Math.max(0, parseFloat(e.target.value) || 0)),
                                    })
                                  }
                                  style={{ fontSize: "0.76rem", padding: "0.3rem 0.5rem" }}
                                />
                              </label>

                              {/* Max Tokens */}
                              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.72rem" }}>
                                <span style={{ color: "var(--text-muted)" }}>最大输出 Token (留空不限)</span>
                                <Input
                                  type="number"
                                  min={256}
                                  max={32768}
                                  step={256}
                                  placeholder="不限制"
                                  value={callCfg.maxTokens ?? ""}
                                  onChange={(e) => {
                                    const raw = e.target.value.trim();
                                    setAICallSettings({
                                      maxTokens: raw ? Math.max(128, parseInt(raw, 10) || 2048) : undefined,
                                    });
                                  }}
                                  style={{ fontSize: "0.76rem", padding: "0.3rem 0.5rem" }}
                                />
                              </label>

                              {/* Timeout */}
                              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.72rem" }}>
                                <span style={{ color: "var(--text-muted)" }}>请求超时 (10 ~ 180 秒)</span>
                                <Input
                                  type="number"
                                  min={10}
                                  max={180}
                                  step={10}
                                  value={callCfg.timeoutSeconds}
                                  onChange={(e) =>
                                    setAICallSettings({
                                      timeoutSeconds: Math.min(180, Math.max(10, parseInt(e.target.value, 10) || 90)),
                                    })
                                  }
                                  style={{ fontSize: "0.76rem", padding: "0.3rem 0.5rem" }}
                                />
                              </label>

                              {/* Max History Turns */}
                              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.72rem" }}>
                                <span style={{ color: "var(--text-muted)" }}>携带历史轮数 (0 ~ 20)</span>
                                <Input
                                  type="number"
                                  min={0}
                                  max={20}
                                  value={callCfg.maxHistoryTurns}
                                  onChange={(e) =>
                                    setAICallSettings({
                                      maxHistoryTurns: Math.min(20, Math.max(0, parseInt(e.target.value, 10) || 0)),
                                    })
                                  }
                                  style={{ fontSize: "0.76rem", padding: "0.3rem 0.5rem" }}
                                />
                              </label>

                              {/* Min Interval */}
                              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.72rem" }}>
                                <span style={{ color: "var(--text-muted)" }}>最小冷却间隔 (0 ~ 60 秒)</span>
                                <Input
                                  type="number"
                                  min={0}
                                  max={60}
                                  value={callCfg.minIntervalSeconds}
                                  onChange={(e) =>
                                    setAICallSettings({
                                      minIntervalSeconds: Math.min(60, Math.max(0, parseInt(e.target.value, 10) || 0)),
                                    })
                                  }
                                  style={{ fontSize: "0.76rem", padding: "0.3rem 0.5rem" }}
                                />
                              </label>

                              {/* Daily Call Limit */}
                              <label style={{ display: "flex", flexDirection: "column", gap: "0.25rem", fontSize: "0.72rem" }}>
                                <span style={{ color: "var(--text-muted)" }}>每日调用上限 (0 = 不限)</span>
                                <Input
                                  type="number"
                                  min={0}
                                  max={1000}
                                  value={callCfg.dailyCallLimit}
                                  onChange={(e) =>
                                    setAICallSettings({
                                      dailyCallLimit: Math.max(0, parseInt(e.target.value, 10) || 0),
                                    })
                                  }
                                  style={{ fontSize: "0.76rem", padding: "0.3rem 0.5rem" }}
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })()}
                </>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "0.75rem 1.2rem",
                borderTop: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-surface)",
                display: "flex",
                justifyContent: "flex-end",
              }}
            >
              <Button variant="solid" size="xs" pill onClick={onClose}>
                完成
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      <AddProviderModal isOpen={addProviderOpen} onClose={() => setAddProviderOpen(false)} />
    </>
  );
}
