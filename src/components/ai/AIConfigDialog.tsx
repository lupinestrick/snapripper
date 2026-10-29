"use client";

import React, { useState } from "react";
import { X, Check, AlertCircle, Sparkles, Server, Key, Eye, EyeOff, ShieldCheck } from "lucide-react";
import { useConfigStore } from "@/store/useConfigStore";
import { testAIConnection } from "@/services/aiService";

interface AIConfigDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

const PRESETS = [
  {
    name: "Gemini (推荐)",
    provider: "gemini" as const,
    baseURL: "https://generativelanguage.googleapis.com/v1beta/openai",
    model: "gemini-2.0-flash",
    desc: "超快速度，百万上下文，分析上千标签极佳",
  },
  {
    name: "DeepSeek",
    provider: "custom" as const,
    baseURL: "https://api.deepseek.com/v1",
    model: "deepseek-chat",
    desc: "高性价比，中文理解极强",
  },
  {
    name: "本地 Ollama",
    provider: "ollama" as const,
    baseURL: "http://localhost:11434/v1",
    model: "qwen2.5:7b",
    desc: "100% 本地运算，零外网流量，完全隐私",
  },
  {
    name: "OpenAI",
    provider: "openai" as const,
    baseURL: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    desc: "经典标准端点",
  },
];

export function AIConfigDialog({ isOpen, onClose }: AIConfigDialogProps) {
  const {
    aiConfig,
    setAIConfig,
    exemptPinned,
    setExemptPinned,
    exemptInternalPages,
    setExemptInternalPages,
    preserveSubtrees,
    setPreserveSubtrees,
  } = useConfigStore();

  const [baseURL, setBaseURL] = useState(aiConfig.baseURL);
  const [apiKey, setApiKey] = useState(aiConfig.apiKey);
  const [model, setModel] = useState(aiConfig.model);
  const [showKey, setShowKey] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  if (!isOpen) return null;

  const handleApplyPreset = (preset: (typeof PRESETS)[0]) => {
    setBaseURL(preset.baseURL);
    setModel(preset.model);
    setTestResult(null);
  };

  const handleTest = async () => {
    setTesting(true);
    setTestResult(null);
    const res = await testAIConnection({
      provider: "custom",
      baseURL,
      apiKey,
      model,
    });
    setTesting(false);
    setTestResult(res);
  };

  const handleSave = () => {
    setAIConfig({
      baseURL,
      apiKey,
      model,
    });
    onClose();
  };

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
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "0.75rem",
          width: "100%",
          maxWidth: "560px",
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
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                color: "var(--accent)",
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>生成式 AI 接口配置</h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                支持任何兼容 OpenAI 格式的云端或本地模型端点
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ marginBottom: "1rem" }}>
          <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "0.4rem" }}>
            快速选择配置预设:
          </label>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" }}>
            {PRESETS.map((p) => (
              <button
                key={p.name}
                type="button"
                onClick={() => handleApplyPreset(p)}
                style={{
                  padding: "0.5rem 0.75rem",
                  textAlign: "left",
                  borderRadius: "0.375rem",
                  border: baseURL === p.baseURL ? "1px solid var(--accent)" : "1px solid var(--border-subtle)",
                  backgroundColor: baseURL === p.baseURL ? "rgba(56, 189, 248, 0.1)" : "var(--bg-primary)",
                  color: "var(--text-main)",
                  cursor: "pointer",
                  fontSize: "0.8rem",
                }}
              >
                <div style={{ fontWeight: 600, color: baseURL === p.baseURL ? "var(--accent)" : "inherit" }}>
                  {p.name}
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>{p.desc}</div>
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>
              API Base URL:
            </label>
            <input
              type="text"
              value={baseURL}
              onChange={(e) => setBaseURL(e.target.value)}
              placeholder="https://api.openai.com/v1"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.85rem",
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>
              API Key (本地 Ollama 请留空):
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showKey ? "text" : "password"}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-..."
                style={{
                  width: "100%",
                  padding: "0.5rem 2.2rem 0.5rem 0.75rem",
                  borderRadius: "0.375rem",
                  backgroundColor: "var(--bg-primary)",
                  border: "1px solid var(--border-subtle)",
                  color: "var(--text-main)",
                  fontSize: "0.85rem",
                }}
              />
              <button
                type="button"
                onClick={() => setShowKey(!showKey)}
                style={{
                  position: "absolute",
                  right: "0.6rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                }}
              >
                {showKey ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          <div>
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>
              模型名称 (Model ID):
            </label>
            <input
              type="text"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="gemini-2.0-flash / gpt-4o-mini / qwen2.5:7b"
              style={{
                width: "100%",
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                backgroundColor: "var(--bg-primary)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.85rem",
              }}
            />
          </div>

          <div
            style={{
              padding: "0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "rgba(15, 23, 42, 0.6)",
              border: "1px solid var(--border-subtle)",
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem",
              fontSize: "0.8rem",
            }}
          >
            <div style={{ fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.15rem" }}>
              整理与安全保护策略:
            </div>
            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={preserveSubtrees}
                onChange={(e) => setPreserveSubtrees(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              <span>保持子树完整性（子标签跟随父节点整体归类，不打散）</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={exemptPinned}
                onChange={(e) => setExemptPinned(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              <span>置顶保护（固定标签保持原位，不参与 AI 重构）</span>
            </label>

            <label style={{ display: "flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={exemptInternalPages}
                onChange={(e) => setExemptInternalPages(e.target.checked)}
                style={{ accentColor: "var(--accent)" }}
              />
              <span>豁免浏览器内建页（about: / chrome: 扩展页）</span>
            </label>
          </div>
        </div>

        {testResult && (
          <div
            style={{
              marginTop: "0.85rem",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.8rem",
              backgroundColor: testResult.success ? "rgba(34, 197, 94, 0.15)" : "rgba(239, 68, 68, 0.15)",
              color: testResult.success ? "var(--success)" : "var(--danger)",
              border: `1px solid ${testResult.success ? "rgba(34, 197, 94, 0.3)" : "rgba(239, 68, 68, 0.3)"}`,
            }}
          >
            {testResult.success ? <Check size={16} /> : <AlertCircle size={16} />}
            <span>{testResult.message}</span>
          </div>
        )}

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1.25rem" }}>
          <button
            type="button"
            onClick={handleTest}
            disabled={testing}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-primary)",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              cursor: testing ? "not-allowed" : "pointer",
            }}
          >
            {testing ? "正在测试..." : "测试连接"}
          </button>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              type="button"
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
              type="button"
              onClick={handleSave}
              style={{
                padding: "0.45rem 1rem",
                borderRadius: "0.375rem",
                border: "none",
                backgroundColor: "var(--accent)",
                color: "#0f172a",
                fontSize: "0.85rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              保存配置
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
