"use client";

import React, { useState, useRef, useEffect } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { confirmAction, toast } from "@/store/useFeedbackStore";
import { THEME_DEFINITIONS } from "@/constants/themes";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { testAIConnection, fetchAvailableModels, getAPIKeySlot, getOrderedModelsForSlot, getProviderMeta } from "@/services/aiService";
import { AI_PROVIDERS, AIProviderKey, AIProtocolType, BUILTIN_PROVIDER_KEYS } from "@/types/ai";
import { AddProviderModal } from "@/components/ai/AddProviderModal";
import { SidebarDrawerTrigger } from "@/components/layout/AppSidebar";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";
import {
  Bot,
  Sliders,
  Check,
  AlertCircle,
  Loader2,
  Download,
  Upload,
  Layers,
  ShieldCheck,
  FolderTree,
  Palette,
  Sun,
  Moon,
  Sparkles,
  RotateCcw,
  MessageSquareCode,
  Save,
  LayoutGrid,
  ChevronDown,
  RefreshCw,
  Trash2,
  Pin,
  Plus,
  Maximize2,
  Minimize2,
  X,
} from "lucide-react";
import {
  DEFAULT_RULES_GENERATOR_PROMPT,
  DEFAULT_AI_ARCHITECT_PROMPT,
  DEFAULT_ARCHITECT_DIAGNOSIS_PROMPT,
  DEFAULT_ARCHITECT_REFINEMENT_PROMPT,
} from "@/constants/aiPrompts";

const PROMPT_TEMPLATE_ITEMS = [
  {
    key: "rulesGeneratorPrompt",
    title: "1. 规则生成助手 (System Prompt)",
    defaultVal: DEFAULT_RULES_GENERATOR_PROMPT,
    placeholder: "规则生成助手提示词...",
    rows: 6,
  },
  {
    key: "architectPrompt",
    title: "2. AI 架构师 - 全量方案 (System Prompt)",
    defaultVal: DEFAULT_AI_ARCHITECT_PROMPT,
    placeholder: "AI 架构师全量方案提示词...",
    rows: 6,
  },
  {
    key: "architectDiagnosisPrompt",
    title: "3. AI 架构师 - 前置轻诊断与方向反问",
    defaultVal: DEFAULT_ARCHITECT_DIAGNOSIS_PROMPT,
    placeholder: "AI 架构师轻诊断提示词...",
    rows: 5,
  },
  {
    key: "architectRefinementPrompt",
    title: "4. AI 架构师 - 多轮精准微调",
    defaultVal: DEFAULT_ARCHITECT_REFINEMENT_PROMPT,
    placeholder: "AI 架构师多轮微调提示词...",
    rows: 5,
  },
] as const;

type PromptTemplateKey = (typeof PROMPT_TEMPLATE_ITEMS)[number]["key"];

export function SettingsPage() {
  const {
    theme,
    setTheme,
    aiConfig,
    setAIConfig,
    togglePinnedModel,
    switchAIProvider,
    updateCustomProvider,
    deleteCustomProvider,
    aiPrompts,
    uiSettings,
    setUISettings,
    setAIPrompt,
    resetAIPrompt,
    exemptPinned,
    setExemptPinned,
    exemptInternalPages,
    setExemptInternalPages,
    preserveSubtrees,
    setPreserveSubtrees,
    cascadeSelectChildren,
    setCascadeSelectChildren,
    rulesSettings,
    setRulesSettings,
    exportRulesJSON,
    importRulesJSON,
  } = useConfigStore();

  const { fileName, clearAllCache } = useSnapshotStore();

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  const handleSaveAIConfig = () => {
    const slot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
    const updatedApiKeys = {
      ...(aiConfig.apiKeys || {}),
      [slot]: aiConfig.apiKey,
    };
    const updatedBaseURLs = {
      ...(aiConfig.baseURLs || {}),
      [slot]: aiConfig.baseURL,
    };
    const updatedModels = {
      ...(aiConfig.models || {}),
      [slot]: aiConfig.model,
    };
    setAIConfig({
      ...aiConfig,
      apiKey: aiConfig.apiKey,
      baseURL: aiConfig.baseURL,
      model: aiConfig.model,
      apiKeys: updatedApiKeys,
      baseURLs: updatedBaseURLs,
      models: updatedModels,
    });
    setSaveSuccess(true);
    setTimeout(() => {
      setSaveSuccess(false);
    }, 2000);
  };

  const currentPreset = getProviderMeta(aiConfig, aiConfig.provider);

  const [availableModels, setAvailableModels] = useState<string[]>(() => currentPreset.models || []);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelsStatus, setFetchModelsStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const [isSearchingModels, setIsSearchingModels] = useState(false);
  const [addProviderOpen, setAddProviderOpen] = useState(false);
  const [fullscreenPromptKey, setFullscreenPromptKey] = useState<PromptTemplateKey | null>(null);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

  const activeFullscreenPrompt = fullscreenPromptKey
    ? PROMPT_TEMPLATE_ITEMS.find((item) => item.key === fullscreenPromptKey) ?? null
    : null;
  const activeFullscreenValue = activeFullscreenPrompt
    ? aiPrompts?.[activeFullscreenPrompt.key] ?? activeFullscreenPrompt.defaultVal
    : "";

  // Click outside to close model dropdown
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (modelDropdownRef.current && !modelDropdownRef.current.contains(e.target as Node)) {
        setModelDropdownOpen(false);
      }
    };
    if (modelDropdownOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [modelDropdownOpen]);

  const handleFetchModelsList = async () => {
    setIsFetchingModels(true);
    setFetchModelsStatus(null);
    try {
      const models = await fetchAvailableModels(aiConfig);
      const slot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
      setAvailableModels(models);
      setAIConfig({
        cachedModels: {
          ...(aiConfig.cachedModels || {}),
          [slot]: models,
        },
      });
      setFetchModelsStatus({
        success: true,
        message: `已获取 ${models.length} 个模型`,
      });
      setModelDropdownOpen(true);
      setTimeout(() => setFetchModelsStatus(null), 3500);
    } catch (err: any) {
      setFetchModelsStatus({
        success: false,
        message: err.message || "获取模型列表失败",
      });
    } finally {
      setIsFetchingModels(false);
    }
  };

  const handleSelectProvider = (key: AIProviderKey) => {
    switchAIProvider(key);
    const meta = getProviderMeta(aiConfig, key);
    setAvailableModels(meta.models && meta.models.length > 0 ? meta.models : []);
    setTestResult(null);
    setFetchModelsStatus(null);
    setModelDropdownOpen(false);
    setIsSearchingModels(false);
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

  const handleExportAll = () => {
    const jsonStr = exportRulesJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapripper-settings-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportAll = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result as string;
      const success = importRulesJSON(content);
      if (success) {
        toast.success("配置导入成功");
      } else {
        toast.error("导入失败：无效的配置文件格式");
      }
    };
    reader.readAsText(file);
  };

  const handleClearCache = async () => {
    const confirmed = await confirmAction({
      title: "清除本地缓存",
      message: "确定要清除导入的标签和编辑记录吗？此操作将重置当前工作台数据并清除本地 Cookie 缓存。",
      confirmLabel: "确认清除",
      destructive: true,
    });
    if (confirmed) {
      clearAllCache();
      toast.success("已成功清除缓存");
    }
  };

  const THEME_CONFIGS = THEME_DEFINITIONS;

  return (
    <div
      style={{
        height: "100%",
        width: "100%",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
        color: "var(--text-main)",
      }}
    >
      {/* Unified Top Navbar for Settings */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.55rem 1.25rem",
          minHeight: "50px",
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          <SidebarDrawerTrigger />
          <h1 style={{ fontSize: "1.05rem", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            系统设置
          </h1>
        </div>
      </div>

      {/* Scrollable Body */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0 }}>
        <div style={{ padding: "1.25rem 2.25rem 70px", maxWidth: "1360px", width: "100%", margin: "0 auto" }}>

      {/* Theme Section */}
      <div
        style={{
          padding: "1.15rem 1.25rem",
          borderRadius: "var(--radius-btn, 8px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.9rem" }}>
          <Palette size={18} style={{ color: "var(--accent)" }} />
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600 }}>界面主题</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(155px, 1fr))", gap: "0.6rem" }}>
          {THEME_CONFIGS.map((t) => {
            const isSelected = (theme || "park-light") === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setTheme(t.id)}
                style={{
                  padding: "0.65rem 0.8rem",
                  borderRadius: "var(--radius-btn, 6px)",
                  border: "1.5px solid",
                  borderColor: isSelected ? "var(--accent-solid)" : "var(--border-subtle)",
                  backgroundColor: isSelected ? "var(--accent-subtle)" : "var(--bg-subtle)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.45rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {t.name}
                  </span>
                </div>

                <div
                  style={{
                    display: "flex",
                    height: "6px",
                    width: "100%",
                    borderRadius: "9999px",
                    overflow: "hidden",
                  }}
                >
                  {t.colors.map((c, i) => (
                    <div
                      key={i}
                      style={{
                        flex: 1,
                        height: "100%",
                        backgroundColor: c,
                      }}
                      title={c}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section: UI Settings */}
      <div
        style={{
          padding: "1.15rem 1.25rem",
          borderRadius: "var(--radius-btn, 8px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.9rem" }}>
          <LayoutGrid size={18} style={{ color: "var(--accent)" }} />
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600 }}>界面显示</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.55rem" }}>
          {[
            {
              label: "隐藏左下角数据总览卡片",
              checked: uiSettings?.hideSidebarOverviewCard || false,
              onChange: (checked: boolean) => setUISettings({ hideSidebarOverviewCard: checked }),
            },
            {
              label: "隐藏 0 标签页空面板",
              checked: uiSettings?.hideEmptyPanels || false,
              onChange: (checked: boolean) => setUISettings({ hideEmptyPanels: checked }),
            },
          ].map((item) => (
            <label
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                cursor: "pointer",
                padding: "0.55rem 0.75rem",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.82rem",
                fontWeight: 500,
                color: "var(--text-main)",
              }}
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.onChange(e.target.checked)}
                style={{ accentColor: "var(--accent-solid)", width: "15px", height: "15px", cursor: "pointer" }}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Section 1: AI Model Services */}
      <div
        style={{
          padding: "1.15rem 1.25rem",
          borderRadius: "var(--radius-btn, 8px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}>
          <Bot size={18} style={{ color: "var(--accent)" }} />
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600 }}>模型服务配置</h2>
        </div>

        {/* Provider Pills */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            接口提供方
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "0.45rem" }}>
            {BUILTIN_PROVIDER_KEYS.map((key) => {
              const preset = AI_PROVIDERS[key];
              const isSelected = aiConfig.provider === key;
              return (
                <Button
                  key={key}
                  type="button"
                  variant={isSelected ? "solid" : "outline"}
                  size="xs"
                  onClick={() => handleSelectProvider(key)}
                >
                  {preset.name}
                </Button>
              );
            })}

            {(aiConfig.customProviders || []).map((cp) => {
              const isSelected = aiConfig.provider === cp.id;
              return (
                <Button
                  key={cp.id}
                  type="button"
                  variant={isSelected ? "solid" : "outline"}
                  size="xs"
                  onClick={() => handleSelectProvider(cp.id)}
                >
                  {cp.name}
                </Button>
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
              <Plus size={13} />
            </Button>
          </div>

          {/* Selected Custom Provider Quick Metadata Editor */}
          {(() => {
            const activeCustom = (aiConfig.customProviders || []).find((c) => c.id === aiConfig.provider);
            if (!activeCustom) return null;
            return (
              <div
                style={{
                  marginTop: "0.75rem",
                  padding: "0.65rem 0.85rem",
                  borderRadius: "var(--radius-btn, 6px)",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  display: "flex",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "0.65rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>名称:</span>
                  <input
                    type="text"
                    value={activeCustom.name}
                    onChange={(e) => updateCustomProvider(activeCustom.id, { name: e.target.value })}
                    style={{
                      padding: "0.25rem 0.5rem",
                      borderRadius: "4px",
                      backgroundColor: "var(--bg-subtle)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-main)",
                      fontSize: "0.78rem",
                      width: "140px",
                      outline: "none",
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
                  <span style={{ fontSize: "0.74rem", color: "var(--text-muted)" }}>协议:</span>
                  {(["openai", "anthropic", "gemini"] as AIProtocolType[]).map((proto) => (
                    <Button
                      key={proto}
                      type="button"
                      variant={activeCustom.type === proto ? "subtle" : "outline"}
                      size="xs"
                      pill
                      onClick={() => updateCustomProvider(activeCustom.id, { type: proto })}
                      style={{ fontSize: "0.7rem", padding: "0.15rem 0.55rem" }}
                    >
                      {proto === "openai" ? "OpenAI" : proto === "anthropic" ? "Anthropic" : "Gemini"}
                    </Button>
                  ))}
                </div>
              </div>
            );
          })()}
        </div>

        {/* Form Inputs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.35rem",
                minHeight: "24px",
              }}
            >
              <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                API Base URL
              </label>

              {aiConfig.provider === "custom" && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                  <Button
                    type="button"
                    variant={aiConfig.type === "anthropic" ? "outline" : "solid"}
                    size="xs"
                    pill
                    onClick={() => {
                      const currentSlot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
                      const apiKeysPool = { ...(aiConfig.apiKeys || {}), [currentSlot]: aiConfig.apiKey };
                      const baseURLsPool = { ...(aiConfig.baseURLs || {}), [currentSlot]: aiConfig.baseURL };
                      const modelsPool = { ...(aiConfig.models || {}), [currentSlot]: aiConfig.model };

                      const targetSlot = "custom_openai";
                      const targetKey = apiKeysPool[targetSlot] || "";
                      let targetBaseURL = baseURLsPool[targetSlot] || "";
                      if (!targetBaseURL || targetBaseURL.includes("api.custome.ai")) {
                        targetBaseURL = "https://api.openai.com/v1";
                      }
                      let targetModel = modelsPool[targetSlot] || "";
                      if (!targetModel || targetModel === "deepseek-flash") {
                        targetModel = "gpt-4o-mini";
                      }

                      baseURLsPool[targetSlot] = targetBaseURL;
                      modelsPool[targetSlot] = targetModel;
                      apiKeysPool[targetSlot] = targetKey;

                      setAIConfig({
                        type: "openai",
                        apiKey: targetKey,
                        baseURL: targetBaseURL,
                        model: targetModel,
                        apiKeys: apiKeysPool,
                        baseURLs: baseURLsPool,
                        models: modelsPool,
                      });
                    }}
                    title="切换为 OpenAI Compatible 协议 (/chat/completions)"
                    style={{ fontSize: "0.72rem", padding: "0.15rem 0.55rem" }}
                  >
                    OpenAI
                  </Button>
                  <Button
                    type="button"
                    variant={aiConfig.type === "anthropic" ? "solid" : "outline"}
                    size="xs"
                    pill
                    onClick={() => {
                      const currentSlot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
                      const apiKeysPool = { ...(aiConfig.apiKeys || {}), [currentSlot]: aiConfig.apiKey };
                      const baseURLsPool = { ...(aiConfig.baseURLs || {}), [currentSlot]: aiConfig.baseURL };
                      const modelsPool = { ...(aiConfig.models || {}), [currentSlot]: aiConfig.model };

                      const targetSlot = "custom_anthropic";
                      const targetKey = apiKeysPool[targetSlot] || "";
                      let targetBaseURL = baseURLsPool[targetSlot] || "";
                      if (!targetBaseURL || targetBaseURL.includes("api.custome.ai")) {
                        targetBaseURL = "https://api.anthropic.com/v1";
                      }
                      let targetModel = modelsPool[targetSlot] || "";
                      if (!targetModel || targetModel === "deepseek-flash") {
                        targetModel = "claude-3-7-sonnet-20250219";
                      }

                      baseURLsPool[targetSlot] = targetBaseURL;
                      modelsPool[targetSlot] = targetModel;
                      apiKeysPool[targetSlot] = targetKey;

                      setAIConfig({
                        type: "anthropic",
                        apiKey: targetKey,
                        baseURL: targetBaseURL,
                        model: targetModel,
                        apiKeys: apiKeysPool,
                        baseURLs: baseURLsPool,
                        models: modelsPool,
                      });
                    }}
                    title="切换为 Anthropic 协议 (/messages)"
                    style={{ fontSize: "0.72rem", padding: "0.15rem 0.55rem" }}
                  >
                    Anthropic
                  </Button>
                </div>
              )}
            </div>
            <input
              type="text"
              placeholder={
                aiConfig.provider === "custom"
                  ? aiConfig.type === "anthropic"
                    ? "例如 https://api.anthropic.com/v1"
                    : "例如 https://api.openai.com/v1"
                  : "API Base URL"
              }
              value={aiConfig.baseURL || ""}
              onChange={(e) => {
                const val = e.target.value;
                const slot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
                setAIConfig({
                  baseURL: val,
                  baseURLs: {
                    ...(aiConfig.baseURLs || {}),
                    [slot]: val,
                  },
                });
              }}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <label style={{ fontSize: "0.8rem", color: "var(--text-muted)" }}>
                模型名称
              </label>

              <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
                {fetchModelsStatus && (
                  <span
                    style={{
                      fontSize: "0.72rem",
                      color: fetchModelsStatus.success ? "#34d399" : "#f87171",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.2rem",
                    }}
                  >
                    {fetchModelsStatus.success ? <Check size={12} /> : <AlertCircle size={12} />}
                    {fetchModelsStatus.message}
                  </span>
                )}
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  pill
                  onClick={handleFetchModelsList}
                  disabled={isFetchingModels}
                  title="向当前配置的 API 端点拉取可用模型列表"
                  style={{ fontSize: "0.72rem", padding: "0.15rem 0.5rem" }}
                >
                  {isFetchingModels ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
                  <span>获取模型列表</span>
                </Button>
              </div>
            </div>

            <div style={{ position: "relative" }} ref={modelDropdownRef}>
              <input
                type="text"
                placeholder="输入以搜索或直接填写模型标识符"
                value={aiConfig.model || ""}
                onFocus={() => {
                  setModelDropdownOpen(true);
                }}
                onChange={(e) => {
                  const val = e.target.value;
                  const slot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
                  setAIConfig({
                    model: val,
                    models: {
                      ...(aiConfig.models || {}),
                      [slot]: val,
                    },
                  });
                  setIsSearchingModels(true);
                  setModelDropdownOpen(true);
                }}
                style={{
                  width: "100%",
                  padding: "0.5rem 2.2rem 0.5rem 0.75rem",
                  borderRadius: "var(--radius-btn, 6px)",
                  backgroundColor: "var(--bg-subtle)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                  fontSize: "0.85rem",
                  outline: "none",
                }}
              />

              {/* Embedded dropdown button on the right inside the input */}
              <button
                type="button"
                onClick={() => {
                  setIsSearchingModels(false);
                  setModelDropdownOpen((prev) => !prev);
                }}
                title={availableModels.length > 0 ? "展开模型列表下拉菜单" : "暂无获取到的模型，可点击右上角「获取模型列表」"}
                style={{
                  position: "absolute",
                  right: "6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "24px",
                  height: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  backgroundColor: "transparent",
                  border: "none",
                  borderRadius: "4px",
                  cursor: "pointer",
                  color: modelDropdownOpen ? "var(--accent)" : "var(--text-muted)",
                  transition: "all 0.15s ease",
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = "var(--bg-card)";
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = "transparent";
                }}
              >
                <ChevronDown
                  size={15}
                  style={{
                    transform: modelDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                  }}
                />
              </button>

              {/* Dropdown Menu Popup */}
              {modelDropdownOpen && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    maxHeight: "220px",
                    overflowY: "auto",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-btn, 6px)",
                    padding: "0.35rem",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
                    zIndex: 60,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.15rem",
                  }}
                >
                  {(() => {
                    const allOrdered = getOrderedModelsForSlot(aiConfig, availableModels);
                    const query = isSearchingModels ? (aiConfig.model || "").trim().toLowerCase() : "";
                    const filtered = query
                      ? allOrdered.filter((m) => m.toLowerCase().includes(query))
                      : allOrdered;

                    if (allOrdered.length === 0) {
                      return (
                        <div
                          style={{
                            padding: "0.6rem 0.75rem",
                            fontSize: "0.78rem",
                            color: "var(--text-muted)",
                            textAlign: "center",
                          }}
                        >
                          暂无已获取的模型，请点击右上角「获取模型列表」
                        </div>
                      );
                    }

                    return (
                      <>
                        <div
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 600,
                            color: "var(--text-muted)",
                            padding: "0.2rem 0.45rem",
                            borderBottom: "1px solid var(--border-subtle)",
                            marginBottom: "0.15rem",
                            display: "flex",
                            justifyContent: "space-between",
                          }}
                        >
                          <span>
                            {query
                              ? `搜索 "${aiConfig.model?.trim()}" (${filtered.length})`
                              : `可用模型 (${filtered.length})`}
                          </span>
                        </div>

                        {filtered.length === 0 ? (
                          <div
                            style={{
                              padding: "0.55rem 0.65rem",
                              fontSize: "0.76rem",
                              color: "var(--text-muted)",
                              textAlign: "center",
                            }}
                          >
                            无匹配项，当前输入将作为自定义模型使用
                          </div>
                        ) : (
                          filtered.map((m) => {
                            const isSelected = aiConfig.model === m;
                            const slot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
                            const isPinned = (aiConfig.pinnedModels?.[slot] || []).includes(m);
                            return (
                              <div
                                key={m}
                                onClick={() => {
                                  setAIConfig({
                                    model: m,
                                    models: {
                                      ...(aiConfig.models || {}),
                                      [slot]: m,
                                    },
                                  });
                                  setIsSearchingModels(false);
                                  setModelDropdownOpen(false);
                                }}
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  padding: "0.35rem 0.55rem",
                                  borderRadius: "var(--radius-btn, 4px)",
                                  border: "1px solid",
                                  borderColor: isSelected ? "var(--accent-border)" : "transparent",
                                  backgroundColor: isSelected ? "var(--accent-subtle)" : "transparent",
                                  color: isSelected ? "var(--accent-text)" : "var(--text-main)",
                                  cursor: "pointer",
                                  outline: "none",
                                  transition: "all 0.15s ease",
                                  textAlign: "left",
                                  fontSize: "0.78rem",
                                  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                                }}
                                onMouseEnter={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
                                  }
                                }}
                                onMouseLeave={(e) => {
                                  if (!isSelected) {
                                    e.currentTarget.style.backgroundColor = "transparent";
                                  }
                                }}
                              >
                                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", minWidth: 0 }}>
                                  {isPinned && <Pin size={11} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                    {m}
                                  </span>
                                </div>
                                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem", flexShrink: 0 }}>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      togglePinnedModel(slot, m);
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
                                    <Pin size={12} />
                                  </button>
                                  {isSelected && <Check size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </>
                    );
                  })()}
                </div>
              )}
            </div>

            {/* Pinned Models Quick Bar in SettingsPage */}
            {(() => {
              const slot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
              const pinnedList = aiConfig.pinnedModels?.[slot] || [];
              const curModel = (aiConfig.model || "").trim();
              const canPinCurrent = Boolean(curModel && !pinnedList.includes(curModel));
              if (pinnedList.length === 0 && !canPinCurrent) return null;
              return (
                <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.35rem", marginTop: "0.45rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "0.2rem" }}>
                    <Pin size={10} />
                    置顶模型:
                  </span>
                  {pinnedList.map((pm) => {
                    const isActive = curModel === pm;
                    return (
                      <span
                        key={pm}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          padding: "1px 7px",
                          borderRadius: "9999px",
                          fontSize: "0.7rem",
                          border: "1px solid",
                          borderColor: isActive ? "var(--accent-border)" : "var(--border-subtle)",
                          backgroundColor: isActive ? "var(--accent-subtle)" : "var(--bg-subtle)",
                          color: isActive ? "var(--accent-text)" : "var(--text-main)",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        }}
                      >
                        <button
                          type="button"
                          onClick={() =>
                            setAIConfig({
                              model: pm,
                              models: { ...(aiConfig.models || {}), [slot]: pm },
                            })
                          }
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "inherit",
                            cursor: "pointer",
                            padding: 0,
                            fontSize: "inherit",
                            fontFamily: "inherit",
                          }}
                        >
                          {pm}
                        </button>
                        <button
                          type="button"
                          onClick={() => togglePinnedModel(slot, pm)}
                          title="取消置顶"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "var(--text-muted)",
                            cursor: "pointer",
                            padding: 0,
                            fontSize: "0.75rem",
                            lineHeight: 1,
                          }}
                        >
                          ×
                        </button>
                      </span>
                    );
                  })}
                  {canPinCurrent && (
                    <button
                      type="button"
                      onClick={() => togglePinnedModel(slot, curModel)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "0.2rem",
                        padding: "1px 7px",
                        borderRadius: "9999px",
                        fontSize: "0.68rem",
                        border: "1px dashed var(--border-card)",
                        backgroundColor: "transparent",
                        color: "var(--text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      <Pin size={10} />
                      <span>置顶当前</span>
                    </button>
                  )}
                </div>
              );
            })()}
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
              API Key {aiConfig.provider === "custom" ? "(根据自定义服务选填)" : ""}
            </label>
            <input
              type="password"
              placeholder={
                aiConfig.provider === "claude" || (aiConfig.provider === "custom" && aiConfig.type === "anthropic")
                  ? "sk-ant-..."
                  : "sk-..."
              }
              value={aiConfig.apiKey || ""}
              onChange={(e) => {
                const val = e.target.value;
                const slot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
                setAIConfig({
                  apiKey: val,
                  apiKeys: {
                    ...(aiConfig.apiKeys || {}),
                    [slot]: val,
                  },
                });
              }}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Actions: Save, Test Connection & Delete Custom Provider */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "0.75rem",
            marginTop: "1.25rem",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
            <Button
              type="button"
              onClick={handleSaveAIConfig}
              variant="solid"
              size="xs"
              pill
            >
              <Save size={13} />
              <span>保存</span>
            </Button>

            <Button
              type="button"
              onClick={handleTestConnection}
              disabled={isTesting}
              variant="outline"
              size="xs"
              pill
            >
              {isTesting ? <Loader2 size={13} className="animate-spin" /> : null}
              <span>测试连接</span>
            </Button>

            {saveSuccess && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: "#34d399",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                <Check size={14} />
                已保存
              </span>
            )}

            {testResult && (
              <span
                style={{
                  fontSize: "0.8rem",
                  color: testResult.success ? "#34d399" : "#f87171",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.3rem",
                }}
              >
                {testResult.success ? <Check size={14} /> : <AlertCircle size={14} />}
                {testResult.message}
              </span>
            )}
          </div>

          {(() => {
            const activeCustom = (aiConfig.customProviders || []).find((c) => c.id === aiConfig.provider);
            if (!activeCustom) return null;
            return (
              <Button
                type="button"
                variant="outline"
                size="xs"
                pill
                onClick={async () => {
                  const ok = await confirmAction({
                    title: "删除自定义供应商",
                    message: `确定要删除「${activeCustom.name}」吗？其对应的 API Key 与缓存模型也将一并移除。`,
                    confirmLabel: "删除",
                    destructive: true,
                  });
                  if (ok) {
                    deleteCustomProvider(activeCustom.id);
                    toast.info(`已删除供应商「${activeCustom.name}」`);
                  }
                }}
                title="删除此自定义供应商"
                style={{
                  color: "var(--danger)",
                  borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)",
                }}
              >
                <Trash2 size={13} />
                <span>删除供应商</span>
              </Button>
            );
          })()}
        </div>
      </div>

      {/* Section 2: AI Prompt Templates Configuration */}
      <div
        style={{
          padding: "1.15rem 1.25rem",
          borderRadius: "var(--radius-btn, 8px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.9rem" }}>
          <MessageSquareCode size={18} style={{ color: "var(--accent)" }} />
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600 }}>AI 提示词模板</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {PROMPT_TEMPLATE_ITEMS.map((item) => (
            <div
              key={item.key}
              style={{
                padding: "0.85rem 1rem",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "0.55rem",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
                <div style={{ fontSize: "0.84rem", fontWeight: 600, color: "var(--text-main)" }}>
                  {item.title}
                </div>

                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  pill
                  onClick={() => resetAIPrompt(item.key)}
                  title="恢复默认"
                >
                  <RotateCcw size={12} />
                  <span>恢复默认</span>
                </Button>
              </div>

              <div style={{ position: "relative", width: "100%" }}>
                <textarea
                  rows={item.rows}
                  value={aiPrompts?.[item.key] ?? item.defaultVal}
                  onChange={(e) => setAIPrompt(item.key, e.target.value)}
                  placeholder={item.placeholder}
                  style={{
                    display: "block",
                    width: "100%",
                    padding: "0.55rem 0.75rem 2rem 0.75rem",
                    borderRadius: "var(--radius-btn, 6px)",
                    backgroundColor: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-main)",
                    fontSize: "0.78rem",
                    lineHeight: "1.45",
                    fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                    outline: "none",
                    resize: "none",
                  }}
                />

                <button
                  type="button"
                  onClick={() => setFullscreenPromptKey(item.key)}
                  title="全屏编辑"
                  aria-label="全屏编辑"
                  style={{
                    position: "absolute",
                    right: "14px",
                    bottom: "8px",
                    width: "26px",
                    height: "26px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-subtle)",
                    color: "var(--text-muted)",
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    cursor: "pointer",
                  }}
                >
                  <Maximize2 size={13} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Section 3: General & Interaction Preferences */}
      <div
        style={{
          padding: "1.15rem 1.25rem",
          borderRadius: "var(--radius-btn, 8px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          marginBottom: "1.25rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.9rem" }}>
          <Sliders size={18} style={{ color: "var(--accent)" }} />
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600 }}>整理偏好</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "0.55rem" }}>
          {[
            {
              label: "级联勾选子标签",
              checked: cascadeSelectChildren,
              onChange: (checked: boolean) => setCascadeSelectChildren(checked),
            },
            {
              label: "保持子树完整性",
              checked: preserveSubtrees,
              onChange: (checked: boolean) => setPreserveSubtrees(checked),
            },
            {
              label: "既有组视为整体",
              checked: rulesSettings.treatExistingGroupsAsUnit,
              onChange: (checked: boolean) => setRulesSettings({ treatExistingGroupsAsUnit: checked }),
            },
            {
              label: "豁免固定标签",
              checked: exemptPinned,
              onChange: (checked: boolean) => setExemptPinned(checked),
            },
            {
              label: "豁免浏览器内部页",
              checked: exemptInternalPages,
              onChange: (checked: boolean) => setExemptInternalPages(checked),
            },
          ].map((item) => (
            <label
              key={item.label}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.6rem",
                cursor: "pointer",
                padding: "0.55rem 0.75rem",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.82rem",
                fontWeight: 500,
                color: "var(--text-main)",
              }}
            >
              <input
                type="checkbox"
                checked={item.checked}
                onChange={(e) => item.onChange(e.target.checked)}
                style={{ accentColor: "var(--accent-solid)", width: "15px", height: "15px", cursor: "pointer" }}
              />
              <span>{item.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* Section 4: Local Storage & Cache Persistence */}
      <div
        style={{
          marginBottom: "1rem",
          padding: "1rem 1.25rem",
          borderRadius: "var(--radius-btn, 8px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
            <h2 style={{ fontSize: "0.95rem", fontWeight: 600 }}>本地缓存</h2>
            {fileName && (
              <span
                style={{
                  fontSize: "0.72rem",
                  padding: "2px 8px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(16, 185, 129, 0.12)",
                  color: "var(--success, #10b981)",
                  border: "1px solid rgba(16, 185, 129, 0.25)",
                  fontWeight: 500,
                }}
              >
                {fileName}
              </span>
            )}
          </div>

          <Button
            onClick={handleClearCache}
            variant="outline"
            size="xs"
            style={{
              color: "#ef4444",
              borderColor: "rgba(239, 68, 68, 0.35)",
            }}
            title="清除快照与本地缓存"
          >
            <Trash2 size={13} />
            <span>清除缓存</span>
          </Button>
        </div>
      </div>

      {/* Section 5: Backup & Restore */}
      <div
        style={{
          padding: "1rem 1.25rem",
          borderRadius: "var(--radius-btn, 8px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <h2 style={{ fontSize: "0.95rem", fontWeight: 600 }}>配置备份</h2>

          <div style={{ display: "flex", gap: "0.6rem" }}>
            <label
              style={{
                padding: "0.28rem 0.7rem",
                borderRadius: "var(--radius-btn, 6px)",
                border: "1px solid var(--btn-outline-border)",
                backgroundColor: "var(--btn-outline-bg)",
                color: "var(--text-muted)",
                fontSize: "0.75rem",
                fontWeight: 500,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "0.35rem",
                transition: "all 0.15s ease",
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = "var(--btn-outline-hover-bg)";
                e.currentTarget.style.borderColor = "var(--btn-outline-hover-border)";
                e.currentTarget.style.color = "var(--text-main)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = "var(--btn-outline-bg)";
                e.currentTarget.style.borderColor = "var(--btn-outline-border)";
                e.currentTarget.style.color = "var(--text-muted)";
              }}
            >
              <Upload size={13} />
              <span>导入配置</span>
              <input type="file" accept=".json" onChange={handleImportAll} style={{ display: "none" }} />
            </label>

            <Button
              onClick={handleExportAll}
              variant="outline"
              size="xs"
            >
              <Download size={13} />
              <span>导出配置</span>
            </Button>
          </div>
        </div>
      </div>

      <AddProviderModal isOpen={addProviderOpen} onClose={() => setAddProviderOpen(false)} />

      <Dialog.Root
        open={Boolean(activeFullscreenPrompt)}
        onOpenChange={(open) => !open && setFullscreenPromptKey(null)}
      >
        <Dialog.Backdrop style={{ zIndex: 130 }} />
        <Dialog.Positioner style={{ zIndex: 140, padding: "0.75rem" }}>
          <Dialog.Content
            style={{
              width: "100%",
              height: "100%",
              maxWidth: "none",
              maxHeight: "none",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              borderRadius: "0.85rem",
              color: "var(--text-main)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.45)",
            }}
          >
            {activeFullscreenPrompt && (
              <>
                <div
                  style={{
                    padding: "0.75rem 1.15rem",
                    borderBottom: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-surface)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.75rem",
                    flexWrap: "wrap",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
                    <MessageSquareCode size={16} style={{ color: "var(--accent)", flexShrink: 0 }} />
                    <Dialog.Title style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                      {activeFullscreenPrompt.title}
                    </Dialog.Title>
                    <span
                      style={{
                        fontSize: "0.72rem",
                        color: "var(--text-muted)",
                        padding: "0.12rem 0.5rem",
                        borderRadius: "999px",
                        backgroundColor: "var(--bg-subtle)",
                        border: "1px solid var(--border-subtle)",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {activeFullscreenValue ? activeFullscreenValue.split("\n").length : 0} 行 · {activeFullscreenValue.length} 字符
                    </span>
                  </div>

                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      pill
                      onClick={() => resetAIPrompt(activeFullscreenPrompt.key)}
                      title="恢复默认"
                    >
                      <RotateCcw size={12} />
                      <span>恢复默认</span>
                    </Button>

                    <Button
                      type="button"
                      variant="solid"
                      size="xs"
                      pill
                      onClick={() => setFullscreenPromptKey(null)}
                      title="退出全屏 (Esc)"
                    >
                      <Minimize2 size={12} />
                      <span>退出全屏</span>
                    </Button>

                    <Dialog.CloseTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="xs"
                        pill
                        onClick={() => setFullscreenPromptKey(null)}
                        style={{ padding: "4px" }}
                        title="关闭"
                      >
                        <X size={15} />
                      </Button>
                    </Dialog.CloseTrigger>
                  </div>
                </div>

                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    padding: "1rem",
                    display: "flex",
                    flexDirection: "column",
                    backgroundColor: "var(--bg-subtle)",
                  }}
                >
                  <textarea
                    autoFocus
                    value={activeFullscreenValue}
                    onChange={(e) => setAIPrompt(activeFullscreenPrompt.key, e.target.value)}
                    placeholder={activeFullscreenPrompt.placeholder}
                    style={{
                      flex: 1,
                      width: "100%",
                      height: "100%",
                      padding: "0.9rem 1rem",
                      borderRadius: "var(--radius-btn, 8px)",
                      backgroundColor: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-main)",
                      fontSize: "0.84rem",
                      lineHeight: "1.6",
                      fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                      outline: "none",
                      resize: "none",
                    }}
                  />
                </div>
              </>
            )}
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>
        </div>
      </div>
    </div>
  );
}
