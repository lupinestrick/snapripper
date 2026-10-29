"use client";

import React, { useState } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { testAIConnection } from "@/services/aiService";
import { AI_PROVIDERS, AIProviderKey } from "@/types/ai";
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
} from "lucide-react";

export function SettingsPage() {
  const {
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

  return (
    <div style={{ padding: "2rem", maxWidth: "960px", margin: "0 auto", color: "#f8fafc" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>系统设置</h1>
        <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.25rem" }}>
          配置生成式大模型服务接口与标签页整理交互偏好。
        </p>
      </div>

      {/* Section 1: AI Model Services */}
      <div
        style={{
          padding: "1.5rem",
          borderRadius: "1rem",
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem" }}>
          <Bot size={20} color="#38bdf8" />
          <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>模型服务配置</h2>
        </div>

        {/* Provider Pills */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.5rem" }}>
            接口提供方
          </label>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.5rem" }}>
            {(Object.keys(AI_PROVIDERS) as AIProviderKey[]).map((key) => {
              const preset = AI_PROVIDERS[key];
              const isSelected = aiConfig.provider === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => handleSelectProvider(key)}
                  style={{
                    padding: "0.45rem 1.1rem",
                    borderRadius: "9999px",
                    border: isSelected ? "1.5px solid #3b82f6" : "1px solid #334155",
                    backgroundColor: isSelected ? "#2563eb" : "#0f172a",
                    color: isSelected ? "#ffffff" : "#94a3b8",
                    fontWeight: isSelected ? 600 : 400,
                    fontSize: "0.825rem",
                    cursor: "pointer",
                    transition: "all 0.15s ease",
                  }}
                >
                  {preset.name}
                </button>
              );
            })}
          </div>
        </div>

        {/* Form Inputs */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.35rem" }}>
              API Base URL
            </label>
            <input
              type="text"
              value={aiConfig.baseURL}
              onChange={(e) => setAIConfig({ baseURL: e.target.value })}
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.5rem",
                backgroundColor: "#0f172a",
                border: "1px solid #374151",
                color: "#fff",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>

          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
              <label style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
                模型名称
              </label>
              {currentPreset.models.length > 0 && (
                <div style={{ display: "flex", gap: "0.3rem" }}>
                  {currentPreset.models.map((m) => {
                    const isModelActive = aiConfig.model === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setAIConfig({ model: m })}
                        style={{
                          padding: "0.15rem 0.5rem",
                          borderRadius: "9999px",
                          border: isModelActive ? "1px solid #3b82f6" : "1px solid #334155",
                          backgroundColor: isModelActive ? "rgba(37, 99, 235, 0.25)" : "transparent",
                          color: isModelActive ? "#60a5fa" : "#64748b",
                          fontSize: "0.7rem",
                          cursor: "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {m}
                      </button>
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
                borderRadius: "0.5rem",
                backgroundColor: "#0f172a",
                border: "1px solid #374151",
                color: "#fff",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.35rem" }}>
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
                borderRadius: "0.5rem",
                backgroundColor: "#0f172a",
                border: "1px solid #374151",
                color: "#fff",
                fontSize: "0.85rem",
                outline: "none",
              }}
            />
          </div>
        </div>

        {/* Test Connection Button */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", marginTop: "1.25rem" }}>
          <button
            onClick={handleTestConnection}
            disabled={isTesting}
            style={{
              padding: "0.45rem 1.1rem",
              borderRadius: "9999px",
              border: "1px solid #475569",
              backgroundColor: "transparent",
              color: "#94a3b8",
              fontSize: "0.8rem",
              cursor: isTesting ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            {isTesting ? <Loader2 size={14} className="animate-spin" /> : null}
            <span>测试连接</span>
          </button>

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
          borderRadius: "1rem",
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1.25rem" }}>
          <Sliders size={20} color="#38bdf8" />
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
              borderRadius: "0.5rem",
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
            }}
          >
            <input
              type="checkbox"
              checked={cascadeSelectChildren}
              onChange={(e) => setCascadeSelectChildren(e.target.checked)}
              style={{ marginTop: "0.2rem", accentColor: "#2563eb", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f8fafc" }}>
                勾选标签时默认级联勾选所有子标签（包含子标签）
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.15rem" }}>
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
              borderRadius: "0.5rem",
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
            }}
          >
            <input
              type="checkbox"
              checked={preserveSubtrees}
              onChange={(e) => setPreserveSubtrees(e.target.checked)}
              style={{ marginTop: "0.2rem", accentColor: "#2563eb", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f8fafc" }}>
                保持子树完整性
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.15rem" }}>
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
              borderRadius: "0.5rem",
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
            }}
          >
            <input
              type="checkbox"
              checked={rulesSettings.treatExistingGroupsAsUnit}
              onChange={(e) => setRulesSettings({ treatExistingGroupsAsUnit: e.target.checked })}
              style={{ marginTop: "0.2rem", accentColor: "#2563eb", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f8fafc" }}>
                既有 Group 组当成独立整体
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.15rem" }}>
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
              borderRadius: "0.5rem",
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
            }}
          >
            <input
              type="checkbox"
              checked={exemptPinned}
              onChange={(e) => setExemptPinned(e.target.checked)}
              style={{ marginTop: "0.2rem", accentColor: "#2563eb", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f8fafc" }}>
                豁免已固定标签 (Pinned Tabs)
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.15rem" }}>
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
              borderRadius: "0.5rem",
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
            }}
          >
            <input
              type="checkbox"
              checked={exemptInternalPages}
              onChange={(e) => setExemptInternalPages(e.target.checked)}
              style={{ marginTop: "0.2rem", accentColor: "#2563eb", width: "16px", height: "16px", cursor: "pointer" }}
            />
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f8fafc" }}>
                豁免浏览器内部页面
              </div>
              <div style={{ fontSize: "0.75rem", color: "#94a3b8", marginTop: "0.15rem" }}>
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
          borderRadius: "1rem",
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>配置备份与恢复</h2>
            <p style={{ fontSize: "0.8rem", color: "#94a3b8", marginTop: "0.25rem" }}>
              导出或导入规则列表与全局偏好配置 JSON。
            </p>
          </div>

          <div style={{ display: "flex", gap: "0.6rem" }}>
            <label
              style={{
                padding: "0.45rem 1.1rem",
                borderRadius: "9999px",
                border: "1px solid #334155",
                backgroundColor: "#0f172a",
                color: "#94a3b8",
                fontSize: "0.8rem",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Upload size={14} />
              <span>导入配置</span>
              <input type="file" accept=".json" onChange={handleImportAll} style={{ display: "none" }} />
            </label>

            <button
              onClick={handleExportAll}
              style={{
                padding: "0.45rem 1.1rem",
                borderRadius: "9999px",
                border: "1px solid #334155",
                backgroundColor: "#0f172a",
                color: "#94a3b8",
                fontSize: "0.8rem",
                fontWeight: 500,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Download size={14} />
              <span>导出配置</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
