"use client";

import React, { useState, useRef, useEffect } from "react";
import { useConfigStore, AppTheme } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { testAIConnection, fetchAvailableModels, getAPIKeySlot } from "@/services/aiService";
import { AI_PROVIDERS, AIProviderKey } from "@/types/ai";
import { Button } from "@/components/ui/button";
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
} from "lucide-react";
import {
  DEFAULT_PROPORTION_ANALYSIS_PROMPT,
  DEFAULT_RULES_GENERATOR_PROMPT,
} from "@/constants/aiPrompts";

export function SettingsPage() {
  const {
    theme,
    setTheme,
    aiConfig,
    setAIConfig,
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
    aiGenerateRulesFirst,
    setAiGenerateRulesFirst,
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

  const currentPreset = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.custom;

  const [availableModels, setAvailableModels] = useState<string[]>(() => currentPreset.models || []);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchModelsStatus, setFetchModelsStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [modelDropdownOpen, setModelDropdownOpen] = useState(false);
  const modelDropdownRef = useRef<HTMLDivElement>(null);

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
      setAvailableModels(models);
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
    // 先把当前正在编辑的槽位配置沉淀至映射池，避免切换丢失
    const currentSlot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
    const apiKeysPool = {
      ...(aiConfig.apiKeys || {}),
      [currentSlot]: aiConfig.apiKey,
    };
    const baseURLsPool = {
      ...(aiConfig.baseURLs || {}),
      [currentSlot]: aiConfig.baseURL,
    };
    const modelsPool = {
      ...(aiConfig.models || {}),
      [currentSlot]: aiConfig.model,
    };

    const preset = AI_PROVIDERS[key];
    const newType = key === "custom" ? (aiConfig.type === "anthropic" ? "anthropic" : "openai") : preset.type;
    const targetSlot = getAPIKeySlot(key, newType);
    const targetKey = apiKeysPool[targetSlot] || "";

    // 解析目标 Base URL：若是 custom，优先取已保存的自定义地址，无则按协议提供官方标准地址，彻底杜绝回退至 api.custome.ai
    let targetBaseURL = preset.baseUrl;
    if (key === "custom") {
      const savedCustomUrl = baseURLsPool[targetSlot];
      if (savedCustomUrl && !savedCustomUrl.includes("api.custome.ai")) {
        targetBaseURL = savedCustomUrl;
      } else if (aiConfig.provider === "custom" && aiConfig.baseURL && !aiConfig.baseURL.includes("api.custome.ai")) {
        targetBaseURL = aiConfig.baseURL;
      } else {
        targetBaseURL = newType === "anthropic" ? "https://api.anthropic.com/v1" : "https://api.openai.com/v1";
      }
    } else if (baseURLsPool[targetSlot]) {
      targetBaseURL = baseURLsPool[targetSlot];
    }

    // 解析目标 Model：若是 custom，优先取已保存的模型，无则按协议提供默认模型
    let targetModel = preset.model;
    if (key === "custom") {
      const savedCustomModel = modelsPool[targetSlot];
      if (savedCustomModel && savedCustomModel !== "deepseek-flash") {
        targetModel = savedCustomModel;
      } else if (aiConfig.provider === "custom" && aiConfig.model && aiConfig.model !== "deepseek-flash") {
        targetModel = aiConfig.model;
      } else {
        targetModel = newType === "anthropic" ? "claude-3-7-sonnet-20250219" : "gpt-4o-mini";
      }
    } else if (modelsPool[targetSlot]) {
      targetModel = modelsPool[targetSlot];
    }

    baseURLsPool[targetSlot] = targetBaseURL;
    modelsPool[targetSlot] = targetModel;
    apiKeysPool[targetSlot] = targetKey;

    setAIConfig({
      provider: key,
      baseURL: targetBaseURL,
      model: targetModel,
      type: newType,
      apiKey: targetKey,
      apiKeys: apiKeysPool,
      baseURLs: baseURLsPool,
      models: modelsPool,
    });
    setAvailableModels(preset.models && preset.models.length > 0 ? preset.models : []);
    setTestResult(null);
    setFetchModelsStatus(null);
    setModelDropdownOpen(false);
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
        alert("配置导入成功！");
      } else {
        alert("导入失败：无效的配置文件格式");
      }
    };
    reader.readAsText(file);
  };

  const handleClearCache = () => {
    if (window.confirm("确定要清除导入的标签和编辑记录吗？此操作将重置当前工作台数据并清除本地 Cookie 缓存。")) {
      clearAllCache();
      alert("已成功清除缓存！");
    }
  };

  const THEME_CONFIGS: {
    id: AppTheme;
    name: string;
    colors: string[];
  }[] = [
    {
      id: "park-light",
      name: "Crimson Light",
      colors: ["#fcfcfc", "#f0f0f0", "#e93d82", "#cb1d63"],
    },
    {
      id: "park-dark",
      name: "Crimson Dark",
      colors: ["#111111", "#202020", "#e93d82", "#ff92ad"],
    },
    {
      id: "midnight",
      name: "Midnight",
      colors: ["#0b0f19", "#1e293b", "#2563eb", "#38bdf8"],
    },
    {
      id: "nord-snow-storm",
      name: "Nord Snow Storm",
      colors: ["#eceff4", "#e5e9f0", "#88c0d0", "#2e3440"],
    },
    {
      id: "rose-pine-dawn",
      name: "Rosé Pine Dawn",
      colors: ["#faf4ed", "#fffaf3", "#d7827e", "#575279"],
    },
    {
      id: "nord-dark",
      name: "Nord Polar Night",
      colors: ["#2e3440", "#3b4252", "#88c0d0", "#81a1c1"],
    },
    {
      id: "catppuccin-mocha",
      name: "Catppuccin Mocha",
      colors: ["#1e1e2e", "#313244", "#f5c2e7", "#cba6f7"],
    },
  ];

  return (
    <div style={{ padding: "2rem", maxWidth: "960px", margin: "0 auto", color: "var(--text-main)" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>系统设置</h1>
      </div>

      {/* Theme Section */}
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
          <Palette size={20} style={{ color: "var(--accent)" }} />
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>界面主题与配色方案</h2>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "0.75rem" }}>
          {THEME_CONFIGS.map((t) => {
            const isSelected = (theme || "park-light") === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setTheme(t.id)}
                style={{
                  padding: "0.85rem 1rem",
                  borderRadius: "var(--radius-btn, 6px)",
                  border: "1.5px solid",
                  borderColor: isSelected ? "var(--accent-solid)" : "var(--border-subtle)",
                  backgroundColor: isSelected ? "var(--accent-subtle)" : "var(--bg-subtle)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.65rem",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <span style={{ fontSize: "0.875rem", fontWeight: 600, color: "var(--text-main)" }}>
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
          padding: "1.5rem",
          borderRadius: "var(--radius-btn, 8px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem" }}>
          <LayoutGrid size={20} style={{ color: "var(--accent)" }} />
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>界面设置</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
          {/* Toggle: Hide File Name */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              cursor: "pointer",
              padding: "0.75rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="checkbox"
              checked={uiSettings?.hideFileName || false}
              onChange={(e) => setUISettings({ hideFileName: e.target.checked })}
              style={{ marginTop: "0.2rem", accentColor: "var(--accent-solid)", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                隐藏配置文件
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                在顶栏隐藏当前快照的配置文件展示。
              </div>
            </div>
          </label>

          {/* Toggle: Hide Quick Theme Button */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              cursor: "pointer",
              padding: "0.75rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="checkbox"
              checked={uiSettings?.hideQuickTheme || false}
              onChange={(e) => setUISettings({ hideQuickTheme: e.target.checked })}
              style={{ marginTop: "0.2rem", accentColor: "var(--accent-solid)", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                隐藏快速主题按钮
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                在顶栏右上角隐藏调色板快速主题切换菜单。
              </div>
            </div>
          </label>

          {/* Toggle: Hide 0-Tab Empty Panels */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              cursor: "pointer",
              padding: "0.75rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="checkbox"
              checked={uiSettings?.hideEmptyPanels || false}
              onChange={(e) => setUISettings({ hideEmptyPanels: e.target.checked })}
              style={{ marginTop: "0.2rem", accentColor: "var(--accent-solid)", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                隐藏 0 标签页面板
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                在各个差分确认页面以及所有通过按钮样式显示的面板选项中，自动隐藏标签数量为 0 的面板（不包含下拉菜单）。
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Section 1: AI Model Services */}
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
          <Bot size={20} style={{ color: "var(--accent)" }} />
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>模型服务配置</h2>
        </div>

        {/* Provider Pills */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.5rem" }}>
            接口提供方
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {(Object.keys(AI_PROVIDERS) as AIProviderKey[]).map((key) => {
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
          </div>
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
                placeholder="请输入或下拉选择模型标识符"
                value={aiConfig.model || ""}
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
                onClick={() => setModelDropdownOpen((prev) => !prev)}
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
                  {availableModels.length === 0 ? (
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
                  ) : (
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
                        <span>可用模型 ({availableModels.length})</span>
                      </div>

                      {availableModels.map((m) => {
                        const isSelected = aiConfig.model === m;
                        return (
                          <button
                            key={m}
                            type="button"
                            onClick={() => {
                              const slot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
                              setAIConfig({
                                model: m,
                                models: {
                                  ...(aiConfig.models || {}),
                                  [slot]: m,
                                },
                              });
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
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {m}
                            </span>
                            {isSelected && <Check size={13} style={{ color: "var(--accent)", flexShrink: 0 }} />}
                          </button>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </div>
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

        {/* Actions: Save & Test Connection */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1.25rem", flexWrap: "wrap" }}>
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
      </div>

      {/* Section 2: AI Prompt Templates Configuration */}
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
          <MessageSquareCode size={20} style={{ color: "var(--accent)" }} />
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>AI 提示词模板配置</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1.25rem" }}>
          {/* Prompt 1: Tab Proportion Analysis */}
          <div
            style={{
              padding: "1.1rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-main)" }}>
                  1. 标签比例分析提示词 (User Prompt)
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem", lineHeight: 1.4 }}>
                  用于在「AI 比例」分析当前标签的主题分布。系统会自动将待分析标签摘要注入到 <code style={{ color: "var(--accent-text)" }}>{"{{tabsSummary}}"}</code> 占位符处。
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="xs"
                pill
                onClick={() => resetAIPrompt("proportionAnalysisPrompt")}
                title="重置为官方预设提示词"
              >
                <RotateCcw size={12} />
                <span>恢复默认</span>
              </Button>
            </div>

            <textarea
              rows={8}
              value={aiPrompts?.proportionAnalysisPrompt || DEFAULT_PROPORTION_ANALYSIS_PROMPT}
              onChange={(e) => setAIPrompt("proportionAnalysisPrompt", e.target.value)}
              placeholder="请输入标签比例分析提示词模板..."
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.8rem",
                lineHeight: "1.5",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>

          {/* Prompt 2: Categorization Rules Generator */}
          <div
            style={{
              padding: "1.1rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.75rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "1rem", flexWrap: "wrap" }}>
              <div>
                <div style={{ fontSize: "0.88rem", fontWeight: 600, color: "var(--text-main)" }}>
                  2. 规则生成助手提示词 (System Prompt)
                </div>
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.2rem", lineHeight: 1.4 }}>
                  用于在「规则管理」的“AI 生成”对话框中，指导 AI 模型如何根据用户的自然语言需求提炼输出规范的 Sidebery 标签匹配规则。
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                size="xs"
                pill
                onClick={() => resetAIPrompt("rulesGeneratorPrompt")}
                title="重置为官方预设提示词"
              >
                <RotateCcw size={12} />
                <span>恢复默认</span>
              </Button>
            </div>

            <textarea
              rows={8}
              value={aiPrompts?.rulesGeneratorPrompt || DEFAULT_RULES_GENERATOR_PROMPT}
              onChange={(e) => setAIPrompt("rulesGeneratorPrompt", e.target.value)}
              placeholder="请输入规则生成助手的系统提示词..."
              style={{
                width: "100%",
                padding: "0.65rem 0.85rem",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.8rem",
                lineHeight: "1.5",
                fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
                outline: "none",
                resize: "vertical",
              }}
            />
          </div>
        </div>
      </div>

      {/* Section 3: General & Interaction Preferences */}
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
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>全局整理偏好</h2>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
          {/* AI generate rules first toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              cursor: "pointer",
              padding: "0.75rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="checkbox"
              checked={aiGenerateRulesFirst}
              onChange={(e) => setAiGenerateRulesFirst(e.target.checked)}
              style={{ marginTop: "0.2rem", accentColor: "var(--accent-solid)", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                AI 分类前先生成匹配规则
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                开启后，AI 比例重构将先依据分析主题提炼域名与关键词匹配规则，优先通过规则引擎快速分类，再对剩余未匹配标签进行 AI 补充归纳；关闭则直接逐批调用大模型分类。
              </div>
            </div>
          </label>

          {/* Cascade select children toggle */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              cursor: "pointer",
              padding: "0.75rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="checkbox"
              checked={cascadeSelectChildren}
              onChange={(e) => setCascadeSelectChildren(e.target.checked)}
              style={{ marginTop: "0.2rem", accentColor: "var(--accent-solid)", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                勾选标签时默认级联勾选所有子标签（包含子标签）
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                在工作台树状图中勾选父标签或组节点时，自动同时勾选其下层的所有子标签页；取消勾选时同理。
              </div>
            </div>
          </label>

          {/* Preserve subtrees */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              cursor: "pointer",
              padding: "0.75rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="checkbox"
              checked={preserveSubtrees}
              onChange={(e) => setPreserveSubtrees(e.target.checked)}
              style={{ marginTop: "0.2rem", accentColor: "var(--accent-solid)", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                保持子树完整性
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                分类与重组时将整个子树作为整体跟随父节点归入新类别，不拆散既有层级结构。
              </div>
            </div>
          </label>

          {/* Treat existing groups as unit */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              cursor: "pointer",
              padding: "0.75rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="checkbox"
              checked={rulesSettings.treatExistingGroupsAsUnit}
              onChange={(e) => setRulesSettings({ treatExistingGroupsAsUnit: e.target.checked })}
              style={{ marginTop: "0.2rem", accentColor: "var(--accent-solid)", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                既有 Group 组当成独立整体
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                快照中原本就是 Sidebery Group 的组标签作为一个原子单元参与规则匹配，不拆分内部标签。
              </div>
            </div>
          </label>

          {/* Exempt Pinned */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              cursor: "pointer",
              padding: "0.75rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="checkbox"
              checked={exemptPinned}
              onChange={(e) => setExemptPinned(e.target.checked)}
              style={{ marginTop: "0.2rem", accentColor: "var(--accent-solid)", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                豁免已固定标签 (Pinned Tabs)
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                固定标签默认作为常驻项，不参与批量去重或重组。
              </div>
            </div>
          </label>

          {/* Exempt Internal Pages */}
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.75rem",
              cursor: "pointer",
              padding: "0.75rem",
              borderRadius: "var(--radius-btn, 6px)",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
            }}
          >
            <input
              type="checkbox"
              checked={exemptInternalPages}
              onChange={(e) => setExemptInternalPages(e.target.checked)}
              style={{ marginTop: "0.2rem", accentColor: "var(--accent-solid)", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                豁免浏览器内部页面
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                忽略 about:, chrome:, moz-extension: 等本地系统页面。
              </div>
            </div>
          </label>
        </div>
      </div>

      {/* Section 4: Local Storage & Cache Persistence */}
      <div
        style={{
          marginBottom: "1.25rem",
          padding: "1.5rem",
          borderRadius: "var(--radius-btn, 8px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>数据持久化与缓存</h2>
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
                  已持久化: {fileName}
                </span>
              )}
            </div>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              已启用 Cookie 状态凭据与本地离线持久化，自动实时保存导入的标签数据与编辑记录，防止刷新页面时丢失数据。
            </p>
          </div>

          <div>
            <Button
              onClick={handleClearCache}
              variant="outline"
              size="xs"
              style={{
                color: "#ef4444",
                borderColor: "rgba(239, 68, 68, 0.35)",
              }}
              title="清除已导入的标签快照、编辑记录及本地 Cookie 缓存"
            >
              <Trash2 size={13} />
              <span>清除缓存</span>
            </Button>
          </div>
        </div>
      </div>

      {/* Section 5: Backup & Restore */}
      <div
        style={{
          padding: "1.5rem",
          borderRadius: "var(--radius-btn, 8px)",
          backgroundColor: "var(--bg-card)",
          border: "1px solid var(--border-card)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>配置备份与恢复</h2>
            <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
              导出或导入规则列表与全局偏好配置 JSON。
            </p>
          </div>

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
    </div>
  );
}
