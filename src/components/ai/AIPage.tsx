"use client";

import React, { useState } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { analyzeTabProportions, testAIConnection } from "@/services/aiService";
import { flattenTabTree } from "@/services/snapshotParser";
import { ProportionCard } from "./ProportionCard";
import { CategorizeModal } from "./CategorizeModal";
import { Bot, Sparkles, Check, AlertCircle, Loader2, Play } from "lucide-react";

export function AIPage() {
  const { aiConfig, setAIConfig } = useConfigStore();
  const {
    rawSnapshot,
    rootNodes,
    proportionReport,
    setProportionReport,
    isAnalyzing,
    setIsAnalyzing,
    progressStatus,
  } = useSnapshotStore();

  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [categorizeModalOpen, setCategorizeModalOpen] = useState(false);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      const res = await testAIConnection(aiConfig);
      setTestResult(res);
    } catch (err: any) {
      setTestResult({ success: false, message: err.message || "请求失败" });
    } finally {
      setIsTesting(false);
    }
  };

  const handleStartAnalysis = async () => {
    if (rootNodes.length === 0) {
      alert("请先导入或加载快照数据");
      return;
    }
    const allTabs = flattenTabTree(rootNodes);
    setIsAnalyzing(true, "提取 URL 指纹并发送至 AI 分析...");

    try {
      const report = await analyzeTabProportions(allTabs, aiConfig, (status) => {
        setIsAnalyzing(true, status);
      });
      setProportionReport(report);
      setIsAnalyzing(false);
    } catch (err: any) {
      setIsAnalyzing(false);
      alert(`AI 分析失败: ${err.message || "请检查端点配置与 API Key"}`);
    }
  };

  return (
    <div style={{ padding: "2rem", maxWidth: "960px", margin: "0 auto", color: "#f8fafc" }}>
      {/* Header */}
      <div style={{ marginBottom: "2rem" }}>
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, letterSpacing: "-0.02em" }}>生成式 AI 比例分析</h1>
        <p style={{ fontSize: "0.85rem", color: "#94a3b8", marginTop: "0.25rem" }}>
          使用大语言模型（支持本地 Ollama / 云端 OpenAI 兼容端点）分析标签页域名与标题，给出类别比例并支持按比例重组。
        </p>
      </div>

      {/* API Config Box */}
      <div
        style={{
          padding: "1.5rem",
          borderRadius: "1rem",
          backgroundColor: "#1e293b",
          border: "1px solid #334155",
          marginBottom: "2rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Bot size={20} color="#38bdf8" />
            <h2 style={{ fontSize: "1rem", fontWeight: 600 }}>模型服务配置</h2>
          </div>

          <div style={{ display: "flex", gap: "0.5rem" }}>
            <button
              onClick={() =>
                setAIConfig({
                  provider: "ollama",
                  baseURL: "http://localhost:11434/v1",
                  model: "qwen2.5:7b",
                  apiKey: "ollama",
                })
              }
              style={{
                padding: "0.3rem 0.75rem",
                borderRadius: "9999px",
                border: "1px solid #475569",
                backgroundColor: "transparent",
                color: "#94a3b8",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              本地 Ollama 预设
            </button>
            <button
              onClick={() =>
                setAIConfig({
                  provider: "gemini",
                  baseURL: "https://generativelanguage.googleapis.com/v1beta/openai/",
                  model: "gemini-2.0-flash",
                })
              }
              style={{
                padding: "0.3rem 0.75rem",
                borderRadius: "9999px",
                border: "1px solid #475569",
                backgroundColor: "transparent",
                color: "#94a3b8",
                fontSize: "0.75rem",
                cursor: "pointer",
              }}
            >
              Gemini Flash 预设
            </button>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
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
              }}
            />
          </div>

          <div>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
              Model Name (模型名称)
            </label>
            <input
              type="text"
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
              }}
            />
          </div>

          <div style={{ gridColumn: "span 2" }}>
            <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.25rem" }}>
              API Key (本地 Ollama 可填任意值或留空)
            </label>
            <input
              type="password"
              placeholder="sk-..."
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
              }}
            />
          </div>
        </div>

        {/* Test connection & Start button */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
            <button
              onClick={handleTestConnection}
              disabled={isTesting}
              style={{
                padding: "0.4rem 1rem",
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
              {isTesting ? <Loader2 size={14} /> : null}
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

          <button
            onClick={handleStartAnalysis}
            disabled={isAnalyzing}
            style={{
              padding: "0.5rem 1.5rem",
              borderRadius: "9999px",
              border: "none",
              backgroundColor: isAnalyzing ? "#334155" : "#2563eb",
              color: "#fff",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: isAnalyzing ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            {isAnalyzing ? <Loader2 size={16} /> : <Sparkles size={16} />}
            <span>{isAnalyzing ? "正在分析比例..." : "开始标签比例探查"}</span>
          </button>
        </div>
      </div>

      {/* Status banner */}
      {isAnalyzing && (
        <div
          style={{
            padding: "0.875rem 1.25rem",
            borderRadius: "0.75rem",
            backgroundColor: "rgba(56, 189, 248, 0.1)",
            border: "1px solid #38bdf8",
            color: "#38bdf8",
            display: "flex",
            alignItems: "center",
            gap: "0.6rem",
            fontSize: "0.85rem",
            marginBottom: "1.5rem",
          }}
        >
          <Loader2 size={16} />
          <span>{progressStatus || "正在提取特征并生成比例分布..."}</span>
        </div>
      )}

      {/* Proportion Card */}
      {proportionReport && (
        <div style={{ marginTop: "1rem" }}>
          <ProportionCard
            onStartClassification={() => setCategorizeModalOpen(true)}
            onClose={() => setProportionReport(null)}
          />
        </div>
      )}

      <CategorizeModal isOpen={categorizeModalOpen} onClose={() => setCategorizeModalOpen(false)} />
    </div>
  );
}
