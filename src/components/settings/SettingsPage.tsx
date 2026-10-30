"use client";

import React, { useState } from "react";
import { useConfigStore, AppTheme } from "@/store/useConfigStore";
import { testAIConnection } from "@/services/aiService";
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
} from "lucide-react";

export function SettingsPage() {
  const {
    theme,
    setTheme,
    aiConfig,
    setAIConfig,
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

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const currentPreset = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.custom;

  const handleSelectProvider = (key: AIProviderKey) => {
    const preset = AI_PROVIDERS[key];
    setAIConfig({
      provider: key,
      baseURL: preset.baseUrl,
      model: preset.model,
      type: preset.type,
    });
    setTestResult(null);
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

  const THEME_CONFIGS: {
    id: AppTheme;
    name: string;
    tag: string;
    desc: string;
    colors: string[];
  }[] = [
    {
      id: "park-light",
      name: "Park UI 浅色 (Crimson Light)",
      tag: "默认浅色",
      desc: "Neutral 极净亮白底色，搭配 Park-UI 经典绯红 Crimson 强调色。",
      colors: ["#fcfcfc", "#ffffff", "#e93d82", "#cb1d63"],
    },
    {
      id: "park-dark",
      name: "Park UI 深色 (Crimson Dark)",
      tag: "Park-UI 深色",
      desc: "Neutral 深黑灰底色，搭配 Park-UI 经典绯红 Crimson 强调色。",
      colors: ["#111111", "#202020", "#e93d82", "#ff92ad"],
    },
    {
      id: "midnight",
      name: "经典暗蓝 (Midnight)",
      tag: "经典深色",
      desc: "沉稳暗夜深蓝底色与科技蓝 Accent，专注夜间整理与护眼。",
      colors: ["#0b0f19", "#1e293b", "#2563eb", "#38bdf8"],
    },
    {
      id: "nord-snow-storm",
      name: "Nord Snow Storm",
      tag: "北欧雪暴",
      desc: "Nord 极光官方雪暴浅色，高对比冷白基调与 Frost 冰蓝点缀。",
      colors: ["#eceff4", "#ffffff", "#5e81ac", "#81a1c1"],
    },
    {
      id: "rose-pine-dawn",
      name: "Rosé Pine Dawn",
      tag: "晨曦玫瑰",
      desc: "Rosé Pine 极具人文诗意的柔和暖色晨曦白与复古玫瑰粉。",
      colors: ["#faf4ed", "#fffaf3", "#b4637a", "#ea9d34"],
    },
    {
      id: "nord-dark",
      name: "Nord Dark",
      tag: "北极极光",
      desc: "Nord 标志性 Polar Night 极夜暗色底，搭配北极冰川青蓝 Accent。",
      colors: ["#242933", "#3b4252", "#88c0d0", "#81a1c1"],
    },
    {
      id: "catppuccin-mocha",
      name: "Catppuccin Mocha",
      tag: "猫普契诺 摩卡",
      desc: "Catppuccin 广受欢迎的 Mocha 深色方案，温暖基底与淡紫 Mauve 强调色。",
      colors: ["#1e1e2e", "#252538", "#cba6f7", "#89b4fa"],
    },
  ];

  return (
    <div style={{ padding: "2rem", maxWidth: "960px", margin: "0 auto", color: "var(--text-main)" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>系统设置</h1>
        <p style={{ fontSize: "0.85rem", color: "var(--text-muted)", marginTop: "0.25rem" }}>
          个性化主题外观、配置生成式大模型服务接口与标签页整理交互偏好。
        </p>
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
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>界面主题与配色方案</h2>
            <p style={{ fontSize: "0.78rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
              精选 7 种极简专业主题，含 Park-UI Crimson、Nord 极光与 Rosé Pine / Catppuccin。
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "1rem" }}>
          {THEME_CONFIGS.map((t) => {
            const isSelected = (theme || "park-light") === t.id;
            return (
              <div
                key={t.id}
                onClick={() => setTheme(t.id)}
                style={{
                  padding: "1rem",
                  borderRadius: "var(--radius-btn, 6px)",
                  border: "2px solid",
                  borderColor: isSelected ? "var(--accent-solid)" : "var(--border-subtle)",
                  backgroundColor: isSelected ? "var(--accent-subtle)" : "var(--bg-subtle)",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                }}
              >
                <div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.4rem" }}>
                    <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)" }}>
                      {t.name}
                    </span>
                    <span
                      style={{
                        fontSize: "0.68rem",
                        padding: "2px 6px",
                        borderRadius: "4px",
                        backgroundColor: isSelected ? "var(--accent-solid)" : "var(--bg-card)",
                        color: isSelected ? "#ffffff" : "var(--text-muted)",
                        border: "1px solid",
                        borderColor: isSelected ? "var(--accent-solid)" : "var(--border-subtle)",
                        fontWeight: isSelected ? 600 : 400,
                      }}
                    >
                      {t.tag}
                    </span>
                  </div>
                  <p style={{ fontSize: "0.75rem", color: "var(--text-muted)", lineHeight: 1.45 }}>
                    {t.desc}
                  </p>
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginTop: "0.25rem" }}>
                  <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>色板:</span>
                  <div style={{ display: "flex", gap: "5px" }}>
                    {t.colors.map((c, i) => (
                      <span
                        key={i}
                        style={{
                          width: "18px",
                          height: "18px",
                          borderRadius: "4px",
                          backgroundColor: c,
                          border: "1px solid rgba(128,128,128,0.25)",
                          display: "inline-block",
                        }}
                        title={c}
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
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
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
              API Base URL
            </label>
            <input
              type="text"
              value={aiConfig.baseURL}
              onChange={(e) => setAIConfig({ baseURL: e.target.value })}
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
              {currentPreset.models.length > 0 && (
                <div style={{ display: "flex", gap: "0.3rem" }}>
                  {currentPreset.models.map((m) => {
                    const isModelActive = aiConfig.model === m;
                    return (
                      <Button
                        key={m}
                        type="button"
                        variant={isModelActive ? "solid" : "outline"}
                        size="xs"
                        onClick={() => setAIConfig({ model: m })}
                        style={{
                          padding: "0.15rem 0.5rem",
                          fontSize: "0.7rem",
                        }}
                      >
                        {m}
                      </Button>
                    );
                  })}
                </div>
              )}
            </div>
            <input
              type="text"
              placeholder="模型标识符"
              value={aiConfig.model}
              onChange={(e) => setAIConfig({ model: e.target.value })}
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

          <div style={{ gridColumn: "span 2" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
              API Key {aiConfig.provider === "custom" ? "(根据自定义服务选填)" : ""}
            </label>
            <input
              type="password"
              placeholder={aiConfig.provider === "claude" ? "sk-ant-..." : "sk-..."}
              value={aiConfig.apiKey}
              onChange={(e) => setAIConfig({ apiKey: e.target.value })}
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

        {/* Test Connection Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1.25rem" }}>
          <Button
            onClick={handleTestConnection}
            disabled={isTesting}
            variant="outline"
            size="xs"
            pill
          >
            {isTesting ? <Loader2 size={13} className="animate-spin" /> : null}
            <span>测试连接</span>
          </Button>

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

      {/* Section 2: General & Interaction Preferences */}
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

      {/* Section 3: Backup & Restore */}
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
