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
import { INITIAL_ARCHITECT_ANALYSIS_PROMPT } from "@/constants/aiPrompts";
import {
  Bot,
  User,
  Sparkles,
  ArrowUp,
  Loader2,
  Settings,
  Plus,
  Trash2,
  Check,
  FolderTree,
  ChevronDown,
  Layers,
} from "lucide-react";

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
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const currentProviderDef = AI_PROVIDERS[aiConfig.provider] || AI_PROVIDERS.custom;

  // Auto-scroll to bottom of chat
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [aiChatMessages, isGenerating]);

  // Auto-adjust textarea height
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
      textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
    }
  }, [inputPrompt]);

  const allTabs = rawSnapshot ? flattenTabTree(rootNodes) : [];
  const panelCount = rawSnapshot?.panels ? Object.keys(rawSnapshot.panels).length : 0;

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
    if (textareaRef.current) {
      textareaRef.current.style.height = "auto";
    }

    setIsGenerating(true);
    setStatusText("正在分析快照拓扑...");

    try {
      const diagnosticSummary = generateSnapshotDiagnosticSummary(allTabs, rawSnapshot.panels);
      setStatusText(`thinking (${aiConfig.model || currentProviderDef.model})...`);

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
      const fallbackSchemes = getFallbackSchemes(allTabs);
      const errorReply: AIChatMessage = {
        id: `ai_${Date.now()}`,
        sender: "assistant",
        timestamp: Date.now(),
        text: `⚠️ **AI 服务响应异常** (${err.message || "请求超时或密钥无效"})\n\n已根据当前快照的真实高频站点为你自动生成了 **推荐重构方案**，可直接点击卡片应用并预览 DIFF：`,
        schemes: fallbackSchemes,
      };
      addAiChatMessage(errorReply);
    } finally {
      setIsGenerating(false);
      setStatusText("");
    }
  };

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

      addAiChatMessage({
        id: `sys_${Date.now()}`,
        sender: "system",
        timestamp: Date.now(),
        text: `✨ 已生成【${scheme.name}】的差分对比。请在弹出的对比窗口中确认变更，如需调整可继续在此输入。`,
        appliedSchemeId: scheme.id,
      });
    } catch (err: any) {
      alert(`生成差分失败: ${err.message || "处理快照时发生异常"}`);
    } finally {
      setApplyingSchemeId(null);
    }
  };

  const handleTweakScheme = (scheme: ReorganizationScheme) => {
    const tweakText = `我想基于【${scheme.name}】微调：`;
    setInputPrompt(tweakText);
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
      {/* ChatGPT Style Minimal Top Bar */}
      <header
        style={{
          height: "48px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0 1.25rem",
          borderBottom: "1px solid var(--border-subtle)",
          backgroundColor: "var(--bg-surface)",
          flexShrink: 0,
          zIndex: 10,
        }}
      >
        {/* Model selector pill */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          <button
            type="button"
            onClick={() => setActivePage("settings")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.25rem 0.65rem",
              borderRadius: "8px",
              backgroundColor: "transparent",
              border: "none",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
            title="点击前往系统设置配置接口"
          >
            <span>{currentProviderDef.name}</span>
            <span style={{ fontSize: "0.75rem", color: "var(--text-muted)", fontWeight: 400 }}>
              ({aiConfig.model || currentProviderDef.model})
            </span>
            <ChevronDown size={14} style={{ color: "var(--text-muted)" }} />
          </button>
        </div>

        {/* Action icons */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <Button
            variant="ghost"
            size="xs"
            pill
            onClick={clearAiChatMessages}
            title="开始新对话"
            style={{ color: "var(--text-muted)", padding: "0.35rem 0.65rem" }}
          >
            <Plus size={14} />
            <span style={{ fontSize: "0.75rem" }}>新对话</span>
          </Button>

          <Button
            variant="ghost"
            size="xs"
            pill
            onClick={() => setActivePage("settings")}
            title="设置"
            style={{ color: "var(--text-muted)", padding: "0.35rem" }}
          >
            <Settings size={15} />
          </Button>
        </div>
      </header>

      {/* Messages Thread (Scrollable Center Area) */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          padding: "1rem 1rem 100px 1rem",
        }}
      >
        <div
          style={{
            maxWidth: "768px",
            width: "100%",
            margin: "0 auto",
            display: "flex",
            flexDirection: "column",
            gap: "1.25rem",
          }}
        >
          {/* ChatGPT Style Empty State */}
          {aiChatMessages.length === 0 && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                minHeight: "55vh",
                textAlign: "center",
              }}
            >
              <div
                style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-card)",
                  color: "var(--accent)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "1rem",
                  boxShadow: "0 4px 12px rgba(0, 0, 0, 0.05)",
                }}
              >
                <Sparkles size={22} />
              </div>

              <h2
                style={{
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  marginBottom: "0.4rem",
                  color: "var(--text-main)",
                }}
              >
                Sidebery 智能架构师
              </h2>

              {rawSnapshot ? (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    fontSize: "0.8rem",
                    color: "var(--text-muted)",
                    marginBottom: "1.5rem",
                  }}
                >
                  <Layers size={14} style={{ color: "var(--accent)" }} />
                  <span>已载入：{allTabs.length} 标签 · {panelCount} 面板</span>
                </div>
              ) : (
                <p style={{ fontSize: "0.82rem", color: "var(--text-muted)", marginBottom: "1.5rem" }}>
                  请在工作台导入 Sidebery 快照 JSON
                </p>
              )}

              {/* Prominent Analyze Tabs Action Button */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
                <Button
                  variant="solid"
                  size="md"
                  pill
                  onClick={() => handleSendMessage(INITIAL_ARCHITECT_ANALYSIS_PROMPT)}
                  disabled={isGenerating || !rawSnapshot || allTabs.length === 0}
                  style={{
                    backgroundColor: "var(--accent-solid)",
                    color: "#fff",
                    fontWeight: 600,
                    fontSize: "0.95rem",
                    padding: "0.75rem 2.25rem",
                    boxShadow: "0 4px 16px rgba(233, 61, 130, 0.25)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.5rem",
                    cursor: (!rawSnapshot || allTabs.length === 0 || isGenerating) ? "not-allowed" : "pointer",
                    opacity: (!rawSnapshot || allTabs.length === 0) ? 0.6 : 1,
                    transition: "all 0.2s ease",
                  }}
                >
                  {isGenerating ? (
                    <>
                      <Loader2 size={18} className="animate-spin" />
                      <span>正在分析标签页结构...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles size={18} />
                      <span>分析标签页</span>
                    </>
                  )}
                </Button>

              </div>
            </div>
          )}

          {/* Messages Stream */}
          {aiChatMessages.map((msg) => {
            const isUser = msg.sender === "user";
            const isSystem = msg.sender === "system";

            if (isSystem) {
              return (
                <div key={msg.id} style={{ display: "flex", justifyContent: "center", margin: "0.25rem 0" }}>
                  <div
                    style={{
                      padding: "0.35rem 0.85rem",
                      borderRadius: "9999px",
                      backgroundColor: "var(--accent-subtle)",
                      color: "var(--accent-text)",
                      fontSize: "0.72rem",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
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
                  gap: "0.75rem",
                  alignItems: "flex-start",
                }}
              >
                {/* Avatar */}
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

                {/* Message Body */}
                <div
                  style={{
                    maxWidth: isUser ? "80%" : "100%",
                    flex: isUser ? "none" : 1,
                    backgroundColor: isUser ? "var(--bg-card)" : "transparent",
                    border: isUser ? "1px solid var(--border-card)" : "none",
                    borderRadius: isUser ? "1.25rem" : "0",
                    padding: isUser ? "0.65rem 1rem" : "0",
                  }}
                >
                  <MarkdownView content={msg.text} />

                  {/* Schemes Cards */}
                  {msg.schemes && msg.schemes.length > 0 && (
                    <div style={{ marginTop: "0.75rem" }}>
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
            <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
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
                  padding: "0.5rem 0.85rem",
                  borderRadius: "1rem",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                  fontSize: "0.8rem",
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

      {/* ChatGPT Style Pinned Bottom Bar */}
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          right: 0,
          padding: "0.75rem 1rem 1rem 1rem",
          background: "linear-gradient(to top, var(--bg-canvas) 80%, rgba(0,0,0,0) 100%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          zIndex: 20,
        }}
      >
        <div style={{ maxWidth: "768px", width: "100%", display: "flex", flexDirection: "column", gap: "0.4rem" }}>
          {/* Quick Option Pills */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 0.5rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <button
                type="button"
                onClick={() => setCrossPanelMerge(!crossPanelMerge)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "0.3rem",
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
                  gap: "0.3rem",
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
                <span>Sidebery 折叠组</span>
              </button>
            </div>
          </div>

          {/* Capsule Input Box */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "0.5rem",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              borderRadius: "1.5rem",
              padding: "0.5rem 0.65rem 0.5rem 1.15rem",
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
              placeholder="输入文本..."
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

          {/* Disclaimer */}
        </div>
      </div>
    </div>
  );
}
