"use client";

import React, { useState, useRef, useEffect } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { flattenTabTree } from "@/services/snapshotParser";
import {
  generateSnapshotDiagnosticSummary,
  sendArchitectChatRequest,
  applySchemeToSnapshot,
  getFallbackSchemes,
} from "@/services/aiArchitectEngine";
import { AI_PROVIDERS, ReorganizationScheme, AIChatMessage } from "@/types/ai";
import { SchemeCard } from "./SchemeCard";
import { MarkdownView } from "./MarkdownView";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Bot,
  User,
  Sparkles,
  Send,
  Loader2,
  Settings,
  RotateCcw,
  Layers,
  FolderTree,
  Sliders,
  Check,
  AlertCircle,
  HelpCircle,
  Maximize2,
} from "lucide-react";

const QUICK_PROMPTS = [
  "🧠 一键全库结构诊断与方案脑暴",
  "按生活与工作场景划分为独立面板 (推荐)",
  "将散落各处的 GitHub/开发项目一网打尽",
  "利用 Sidebery 原生可折叠 Group 组收拢 80% 视觉高度",
  "把游戏与二次元同人分开独立管理",
];

export function AIPage() {
  const {
    aiConfig,
    aiPrompts,
    setActivePage,
    crossPanelMerge,
    setCrossPanelMerge,
    createGroupTabs,
    setCreateGroupTabs,
  } = useConfigStore();

  const {
    rawSnapshot,
    rootNodes,
    aiChatMessages,
    addAiChatMessage,
    clearAiChatMessages,
    setAiProcessedCache,
    setIsAIDiffModalOpen,
  } = useSnapshotStore();

  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [applyingSchemeId, setApplyingSchemeId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const currentProviderDef = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.custom;

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiChatMessages, isGenerating]);

  const allTabs = rawSnapshot ? flattenTabTree(rootNodes) : [];
  const panelCount = rawSnapshot?.panels ? Object.keys(rawSnapshot.panels).length : 0;

  // Send message or trigger automatic diagnostic
  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt && !textToSend) return;
    if (isGenerating) return;

    if (!rawSnapshot || allTabs.length === 0) {
      alert("请先在工作台导入或加载 Sidebery 快照数据！");
      return;
    }

    const userMessageText = prompt || "请对当前快照进行深度结构分析与头脑风暴，并给出推荐的重构方案。";
    const userMsg: AIChatMessage = {
      id: `user_${Date.now()}`,
      sender: "user",
      timestamp: Date.now(),
      text: userMessageText,
    };

    addAiChatMessage(userMsg);
    setInputPrompt("");
    setIsGenerating(true);
    setStatusText("正在提取快照拓扑并进行深度诊断...");

    try {
      const diagnosticSummary = generateSnapshotDiagnosticSummary(allTabs, rawSnapshot.panels);
      setStatusText(`正在连接 AI 模型 (${aiConfig.model || currentProviderDef.model}) 构思重构方案...`);

      const history = [...aiChatMessages, userMsg].map((m) => ({
        role: m.sender as "user" | "assistant" | "system",
        content: m.text,
      }));

      const { text, schemes } = await sendArchitectChatRequest(
        aiConfig,
        history,
        diagnosticSummary,
        aiPrompts?.architectPrompt
      );

      const aiMsg: AIChatMessage = {
        id: `ai_${Date.now()}`,
        sender: "assistant",
        timestamp: Date.now(),
        text,
        schemes: schemes && schemes.length > 0 ? schemes : getFallbackSchemes(allTabs),
      };

      addAiChatMessage(aiMsg);
    } catch (err: any) {
      console.warn("AI generation failed, fallback to smart offline schemes:", err);
      // Even if AI API encounters an error (e.g. invalid key or timeout), give user instant smart schemes
      const fallbackSchemes = getFallbackSchemes(allTabs);
      const errorReply: AIChatMessage = {
        id: `ai_${Date.now()}`,
        sender: "assistant",
        timestamp: Date.now(),
        text: `⚠️ **AI 端点响应异常** (${err.message || "请求超时或密钥无效"})。\n\n别担心！我已基于当前快照中提取的高频域名（如 GitHub、DLsite、ErogameScape、Booth、MC百科 等），为你自动生成了以下 **推荐重构方案**。你可以直接点击应用并预览 DIFF：`,
        schemes: fallbackSchemes,
      };
      addAiChatMessage(errorReply);
    } finally {
      setIsGenerating(false);
      setStatusText("");
    }
  };

  // Apply a specific scheme and open the AIDiffModal
  const handleApplyScheme = (scheme: ReorganizationScheme) => {
    if (!rawSnapshot) {
      alert("当前没有可操作的快照数据");
      return;
    }

    setApplyingSchemeId(scheme.id);
    try {
      const processedCache = applySchemeToSnapshot(rawSnapshot, scheme, {
        crossPanelMerge,
        createGroupTabs,
        targetMode: scheme.targetMode || "tree",
      });

      setAiProcessedCache(processedCache);
      setIsAIDiffModalOpen(true);

      // Add a system notice message in chat
      addAiChatMessage({
        id: `sys_${Date.now()}`,
        sender: "system",
        timestamp: Date.now(),
        text: `✨ 已成功基于【${scheme.name}】生成快照重组 DIFF 差分！请在弹出的对比窗口中预览变更；若满意可一键应用，若需要微调可随时在此继续告诉我。`,
        appliedSchemeId: scheme.id,
      });
    } catch (err: any) {
      alert(`生成差分失败: ${err.message || "处理快照时发生异常"}`);
    } finally {
      setApplyingSchemeId(null);
    }
  };

  // Tweak prompt preparation
  const handleTweakScheme = (scheme: ReorganizationScheme) => {
    const tweakText = `我想基于【${scheme.name}】做进一步微调：`;
    setInputPrompt(tweakText);
    inputRef.current?.focus();
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        height: "calc(100vh - 120px)",
        maxWidth: "1080px",
        margin: "0 auto",
        padding: "1rem 1.5rem",
        color: "var(--text-main)",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          paddingBottom: "0.85rem",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                padding: "0.4rem",
                borderRadius: "8px",
                backgroundColor: "var(--accent-subtle)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Bot size={20} />
            </div>
            <h1 style={{ fontSize: "1.25rem", fontWeight: 700, letterSpacing: "-0.01em" }}>
              AI 智能架构师 (AI Architect)
            </h1>
            <Badge variant="subtle" size="sm" style={{ color: "var(--accent-text)" }}>
              Brainstorm & Reorganize
            </Badge>
          </div>
          <p style={{ fontSize: "0.8rem", color: "var(--text-muted)", marginTop: "0.2rem" }}>
            全库结构诊断、多套重构方案推荐、自然语言多轮微调与 DIFF 实时确认
          </p>
        </div>

        {/* Engine status & actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <div
            style={{
              padding: "0.3rem 0.75rem",
              borderRadius: "9999px",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.75rem",
              color: "var(--text-muted)",
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
            }}
          >
            <span>接口:</span>
            <strong style={{ color: "var(--accent)" }}>{currentProviderDef.name}</strong>
            <span style={{ opacity: 0.8 }}>({aiConfig.model || currentProviderDef.model})</span>
          </div>

          <Button
            variant="outline"
            size="xs"
            pill
            onClick={() => setActivePage("settings")}
            title="配置 AI 接口端点与密钥"
          >
            <Settings size={13} />
            <span>配置接口</span>
          </Button>

          {aiChatMessages.length > 0 && (
            <Button
              variant="ghost"
              size="xs"
              pill
              onClick={clearAiChatMessages}
              style={{ color: "var(--text-muted)" }}
              title="清空对话历史"
            >
              <RotateCcw size={13} />
              <span>清空记录</span>
            </Button>
          )}
        </div>
      </div>

      {/* Main Chat Scroll Container */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          paddingRight: "0.5rem",
          display: "flex",
          flexDirection: "column",
          gap: "1.25rem",
        }}
      >
        {/* Welcome Hero State (when empty) */}
        {aiChatMessages.length === 0 && (
          <div
            style={{
              padding: "2rem",
              borderRadius: "1rem",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.05)",
              textAlign: "center",
              margin: "auto 0",
            }}
          >
            <div
              style={{
                width: "56px",
                height: "56px",
                borderRadius: "50%",
                backgroundColor: "var(--accent-subtle)",
                color: "var(--accent)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 1.25rem auto",
              }}
            >
              <Sparkles size={28} />
            </div>

            <h2 style={{ fontSize: "1.25rem", fontWeight: 700, marginBottom: "0.5rem" }}>
              欢迎来到 Sidebery AI 架构工作台
            </h2>
            <p style={{ fontSize: "0.875rem", color: "var(--text-muted)", maxWidth: "560px", margin: "0 auto 1.5rem auto", lineHeight: 1.6 }}>
              与传统机械分类不同，AI 架构师会像资深整理专家一样，先进行<strong>全库结构诊断与痛点洞察 (Brainstorm)</strong>，并为你输出多套鲜明的重构方案供你挑选与多轮微调。
            </p>

            {/* Snapshot Snapshot Badge */}
            {rawSnapshot ? (
              <div
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.75rem",
                  padding: "0.6rem 1.25rem",
                  borderRadius: "9999px",
                  backgroundColor: "var(--bg-subtle)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.85rem",
                  marginBottom: "1.5rem",
                }}
              >
                <Layers size={15} style={{ color: "var(--accent)" }} />
                <span>当前已加载快照:</span>
                <strong style={{ color: "var(--text-main)" }}>{allTabs.length} 个标签页</strong>
                <span style={{ color: "var(--text-muted)" }}>/</span>
                <strong style={{ color: "var(--text-main)" }}>{panelCount} 个面板</strong>
              </div>
            ) : (
              <div
                style={{
                  display: "inline-block",
                  padding: "0.5rem 1rem",
                  borderRadius: "8px",
                  backgroundColor: "var(--bg-subtle)",
                  color: "var(--text-muted)",
                  fontSize: "0.85rem",
                  marginBottom: "1.5rem",
                }}
              >
                💡 尚未加载快照，请先在左侧「工作台」拖入 Sidebery JSON 快照文件
              </div>
            )}

            <div>
              <Button
                variant="solid"
                size="md"
                pill
                onClick={() => handleSendMessage("请对当前快照进行深度结构分析与头脑风暴，并给出推荐的重构方案。")}
                disabled={isGenerating || !rawSnapshot}
                style={{
                  backgroundColor: "var(--accent-solid)",
                  color: "#fff",
                  fontWeight: 700,
                  padding: "0.75rem 1.75rem",
                  fontSize: "0.95rem",
                  boxShadow: "0 4px 14px rgba(233, 61, 130, 0.3)",
                }}
              >
                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                <span>🧠 开始全库结构诊断与方案脑暴 (Brainstorm)</span>
              </Button>
            </div>
          </div>
        )}

        {/* Message Stream */}
        {aiChatMessages.map((msg) => {
          const isUser = msg.sender === "user";
          const isSystem = msg.sender === "system";

          if (isSystem) {
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  justifyContent: "center",
                  margin: "0.5rem 0",
                }}
              >
                <div
                  style={{
                    padding: "0.45rem 1rem",
                    borderRadius: "9999px",
                    backgroundColor: "var(--accent-subtle)",
                    border: "1px solid var(--accent-border)",
                    color: "var(--accent-text)",
                    fontSize: "0.75rem",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    maxWidth: "85%",
                  }}
                >
                  <Sparkles size={13} />
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
                gap: "0.85rem",
                alignItems: "flex-start",
              }}
            >
              {/* Avatar */}
              <div
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "50%",
                  backgroundColor: isUser ? "var(--accent-solid)" : "var(--bg-card)",
                  color: isUser ? "#fff" : "var(--accent)",
                  border: isUser ? "none" : "1px solid var(--border-card)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
                }}
              >
                {isUser ? <User size={16} /> : <Bot size={18} />}
              </div>

              {/* Message Bubble */}
              <div
                style={{
                  maxWidth: isUser ? "75%" : "92%",
                  backgroundColor: isUser ? "var(--bg-card)" : "var(--bg-card)",
                  border: isUser ? "1px solid var(--accent-border)" : "1px solid var(--border-card)",
                  borderRadius: "0.875rem",
                  padding: "0.85rem 1.15rem",
                  boxShadow: "0 2px 8px rgba(0, 0, 0, 0.03)",
                }}
              >
                {/* Header info */}
                <div
                  style={{
                    fontSize: "0.7rem",
                    color: "var(--text-muted)",
                    marginBottom: "0.4rem",
                    fontWeight: 600,
                  }}
                >
                  {isUser ? "你" : "AI 架构师"}
                </div>

                {/* Text Content */}
                <MarkdownView content={msg.text} />

                {/* Schemes Cards (if assistant returned schemes) */}
                {msg.schemes && msg.schemes.length > 0 && (
                  <div style={{ marginTop: "1rem" }}>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: "var(--accent-text)",
                        marginBottom: "0.5rem",
                        display: "flex",
                        alignItems: "center",
                        gap: "0.35rem",
                      }}
                    >
                      <Sparkles size={14} />
                      <span>为你量身推荐的重构方案 (点击即可一键生成 DIFF 预览)：</span>
                    </div>

                    {msg.schemes.map((scheme) => (
                      <SchemeCard
                        key={scheme.id}
                        scheme={scheme}
                        isApplying={applyingSchemeId === scheme.id}
                        onApply={handleApplyScheme}
                        onTweak={handleTweakScheme}
                      />
                    ))}
                  </div>
                )}
              </div>
            </div>
          );
        })}

        {/* Generating Indicator */}
        {isGenerating && (
          <div style={{ display: "flex", gap: "0.85rem", alignItems: "flex-start" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
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
              <Loader2 size={16} className="animate-spin" />
            </div>

            <div
              style={{
                padding: "0.75rem 1.15rem",
                borderRadius: "0.875rem",
                backgroundColor: "var(--accent-subtle)",
                border: "1px solid var(--accent-border)",
                color: "var(--accent-text)",
                fontSize: "0.85rem",
                display: "flex",
                alignItems: "center",
                gap: "0.5rem",
              }}
            >
              <Loader2 size={15} className="animate-spin" />
              <span>{statusText || "AI 架构师正在思考与分析..."}</span>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Bottom Sticky Input & Control Area */}
      <div
        style={{
          marginTop: "0.75rem",
          paddingTop: "0.75rem",
          borderTop: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {/* Quick Suggestion Pills */}
        <div
          style={{
            display: "flex",
            gap: "0.4rem",
            overflowX: "auto",
            paddingBottom: "0.5rem",
            marginBottom: "0.4rem",
          }}
        >
          {QUICK_PROMPTS.map((qp, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => handleSendMessage(qp)}
              disabled={isGenerating || !rawSnapshot}
              style={{
                padding: "0.25rem 0.65rem",
                borderRadius: "9999px",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                fontSize: "0.72rem",
                color: "var(--text-muted)",
                cursor: "pointer",
                whiteSpace: "nowrap",
                transition: "all 0.15s",
              }}
            >
              {qp}
            </button>
          ))}
        </div>

        {/* Options Row (Toggles) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "0.5rem",
            fontSize: "0.75rem",
            color: "var(--text-muted)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={crossPanelMerge}
                onChange={(e) => setCrossPanelMerge(e.target.checked)}
                style={{ accentColor: "var(--accent-solid)", cursor: "pointer" }}
              />
              <span>跨面板合并同类标签</span>
            </label>

            <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={createGroupTabs}
                onChange={(e) => setCreateGroupTabs(e.target.checked)}
                style={{ accentColor: "var(--accent-solid)", cursor: "pointer" }}
              />
              <span>生成 Sidebery 原生可折叠 Group 组</span>
            </label>
          </div>

          <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>
            按 Enter 发送，Shift+Enter 换行
          </span>
        </div>

        {/* Textarea + Send Button */}
        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "0.6rem",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "0.75rem",
            padding: "0.5rem 0.75rem",
            boxShadow: "0 2px 6px rgba(0, 0, 0, 0.03)",
          }}
        >
          <textarea
            ref={inputRef}
            rows={2}
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="输入自然语言要求（例如：“帮我把开发和游戏分开”、“按生命周期划分面板”、“把超过5个标签的域名合并为组”...）"
            disabled={isGenerating || !rawSnapshot}
            style={{
              flex: 1,
              backgroundColor: "transparent",
              border: "none",
              outline: "none",
              resize: "none",
              fontSize: "0.85rem",
              color: "var(--text-main)",
              lineHeight: 1.4,
              fontFamily: "inherit",
            }}
          />

          <Button
            variant="solid"
            size="sm"
            pill
            onClick={() => handleSendMessage()}
            disabled={isGenerating || !rawSnapshot || !inputPrompt.trim()}
            style={{
              backgroundColor: "var(--accent-solid)",
              color: "#fff",
              fontWeight: 600,
              flexShrink: 0,
            }}
          >
            {isGenerating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            <span>发送</span>
          </Button>
        </div>
      </div>
    </div>
  );
}
