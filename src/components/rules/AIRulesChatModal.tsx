"use client";

import React, { useState, useRef, useEffect, useMemo } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { CategorizationRule, RuleActionType } from "@/types/sidebery";
import { flattenTabTree } from "@/services/snapshotParser";
import {
  buildUnmatchedSnapshotContext,
  formatRuleConditionsCompact,
  matchTabWithRule,
  parseAIRulesFromResponse,
} from "@/services/ruleEngine";
import {
  checkAICallLimits,
  getProviderMeta,
  sendAIConversationRequest,
} from "@/services/aiService";
import { DEFAULT_RULES_GENERATOR_PROMPT } from "@/constants/aiPrompts";
import { MarkdownView } from "@/components/ai/MarkdownView";
import { RuleEditorModal } from "./RuleEditorModal";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  X,
  Sparkles,
  Send,
  Loader2,
  Check,
  Plus,
  Bot,
  User,
  Edit3,
  RotateCcw,
  Layers,
} from "lucide-react";

interface AIRulesChatModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface ChatMessage {
  id: string;
  sender: "user" | "assistant";
  text: string;
  suggestedRules?: Omit<CategorizationRule, "id">[];
}

const ACTION_LABELS: Record<RuleActionType, string> = {
  group: "建组",
  moveToPanel: "移面板",
  groupAndMove: "建组+移面板",
  exempt: "跳过保护",
};

const CURATED_PROMPTS = [
  {
    label: "GitHub Issues / PR 分组",
    prompt: "帮我生成两条规则：把 github.com 下路径包含 /issues 或 /pull 的页面分别归组，并排除 /settings 页面。",
  },
  {
    label: "视频与播客媒体",
    prompt: "帮我生成视频与播客媒体规则（如 B站、YouTube、Twitch），按 OR 匹配并自动建组。",
  },
  {
    label: "前端文档与开源库",
    prompt: "帮我生成前端技术文档与开源库规则（React、Next.js、Tailwind、MDN、Vite 等），合并为技术文档组。",
  },
];

export function AIRulesChatModal({ isOpen, onClose }: AIRulesChatModalProps) {
  const {
    aiConfig,
    aiCallSettings,
    aiUsageStats,
    recordAIUsage,
    aiPrompts,
    rulesSettings,
    addRule,
  } = useConfigStore();
  const { rawSnapshot, rootNodes } = useSnapshotStore();

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "描述你想整理的标签主题或域名条件，我将生成新版 **Rule DSL** 规则（支持组合条件、排除项与动作），并实时试算当前快照的命中数量。",
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [includeSnapshotContext, setIncludeSnapshotContext] = useState(true);
  const [addedRuleKeys, setAddedRuleKeys] = useState<Set<string>>(new Set());
  const [editingDraft, setEditingDraft] = useState<{
    key: string;
    rule: Omit<CategorizationRule, "id">;
  } | null>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);

  const allTabs = useMemo(
    () => (rawSnapshot ? flattenTabTree(rootNodes) : []),
    [rawSnapshot, rootNodes]
  );

  const snapshotContext = useMemo(() => {
    if (!rawSnapshot || allTabs.length === 0) return null;
    return buildUnmatchedSnapshotContext(
      allTabs,
      rulesSettings.rules,
      rawSnapshot.panels || {},
      rawSnapshot.containers || {}
    );
  }, [rawSnapshot, allTabs, rulesSettings.rules]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  if (!isOpen) return null;

  const providerMeta = getProviderMeta(aiConfig, aiConfig.provider);
  const activeModel = aiConfig.model || providerMeta.model;

  const computePreviewHits = (rule: Omit<CategorizationRule, "id">): number => {
    if (allTabs.length === 0) return 0;
    const previewRule: CategorizationRule = {
      ...rule,
      id: "__preview__",
      enabled: true,
    };
    let count = 0;
    for (const tab of allTabs) {
      if (matchTabWithRule(tab, previewRule)) count++;
    }
    return count;
  };

  const handleResetChat = () => {
    setMessages([
      {
        id: "welcome",
        sender: "assistant",
        text: "已开启新对话。描述你想整理的标签主题或域名条件，我将为你生成可试算的 **Rule DSL** 规则。",
      },
    ]);
    setAddedRuleKeys(new Set());
    setInputPrompt("");
  };

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isGenerating) return;

    const limitCheck = checkAICallLimits(aiCallSettings, aiUsageStats);
    if (!limitCheck.ok) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_limit_${Date.now()}`,
          sender: "assistant",
          text: `⏳ **已触发调用限制**：${limitCheck.reason}`,
        },
      ]);
      return;
    }

    const userMsg: ChatMessage = { id: `user_${Date.now()}`, sender: "user", text: prompt };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInputPrompt("");
    setIsGenerating(true);

    let usageRecorded = false;
    try {
      const baseSystemPrompt = aiPrompts?.rulesGeneratorPrompt || DEFAULT_RULES_GENERATOR_PROMPT;
      const systemPrompt =
        includeSnapshotContext && snapshotContext
          ? `${baseSystemPrompt}\n\n【当前快照上下文（未命中高频域名与可用面板/容器）】:\n${snapshotContext.contextText}`
          : baseSystemPrompt;

      const turns = nextMessages
        .filter((m) => m.id !== "welcome")
        .map((m) => ({
          role: m.sender as "user" | "assistant",
          content: m.text,
        }));

      const rawResponse = await sendAIConversationRequest(
        { ...aiConfig, callSettings: aiCallSettings },
        systemPrompt,
        turns,
        {
          onUsage: (u) => {
            usageRecorded = true;
            recordAIUsage(u);
          },
        }
      );
      if (!usageRecorded) {
        recordAIUsage({ promptTokens: 0, completionTokens: 0 });
      }

      const { rules: suggestedRules, cleanedText } = parseAIRulesFromResponse(rawResponse);

      setMessages((prev) => [
        ...prev,
        {
          id: `ai_${Date.now()}`,
          sender: "assistant",
          text:
            cleanedText ||
            (suggestedRules?.length
              ? `已为你生成 **${suggestedRules.length}** 条 Rule DSL 规则，可直接试算并添加：`
              : "未能解析出规则 JSON，请尝试更具体地描述域名、路径或关键词条件。"),
          suggestedRules,
        },
      ]);
    } catch (err: any) {
      setMessages((prev) => [
        ...prev,
        {
          id: `ai_err_${Date.now()}`,
          sender: "assistant",
          text: `⚠️ **生成失败**：${err.message || "请检查模型接口与 API Key 配置。"}`,
        },
      ]);
    } finally {
      setIsGenerating(false);
    }
  };

  const handleAddRule = (rule: Omit<CategorizationRule, "id">, key: string) => {
    addRule(rule);
    setAddedRuleKeys((prev) => new Set([...prev, key]));
  };

  const handleAddAllInMessage = (msgId: string, list: Omit<CategorizationRule, "id">[]) => {
    const nextKeys = new Set(addedRuleKeys);
    list.forEach((rule, idx) => {
      const key = `${msgId}_${idx}`;
      if (!nextKeys.has(key)) {
        addRule(rule);
        nextKeys.add(key);
      }
    });
    setAddedRuleKeys(nextKeys);
  };

  return (
    <>
      <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
        <Dialog.Backdrop style={{ zIndex: 110 }} />
        <Dialog.Positioner style={{ zIndex: 120 }}>
          <Dialog.Content
            style={{
              maxWidth: "740px",
              width: "94vw",
              height: "84vh",
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-card)",
              borderRadius: "1rem",
              color: "var(--text-main)",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              boxShadow: "0 24px 48px rgba(0, 0, 0, 0.45)",
            }}
          >
            {/* Header */}
            <div
              style={{
                padding: "0.75rem 1.15rem",
                borderBottom: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-surface)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.6rem",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <Sparkles size={16} style={{ color: "var(--accent)" }} />
                <Dialog.Title style={{ fontSize: "0.94rem", fontWeight: 700 }}>
                  AI 规则生成助手
                </Dialog.Title>
                <Badge variant="subtle" size="sm" style={{ fontSize: "0.68rem" }}>
                  {providerMeta.name} · {activeModel}
                </Badge>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                {snapshotContext && (
                  <button
                    type="button"
                    onClick={() => setIncludeSnapshotContext((prev) => !prev)}
                    title="开启后将自动注入当前快照未命中域名、可用面板与容器列表"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.3rem",
                      padding: "0.24rem 0.65rem",
                      borderRadius: "9999px",
                      border: "1px solid",
                      borderColor: includeSnapshotContext ? "var(--accent-border)" : "var(--border-subtle)",
                      backgroundColor: includeSnapshotContext ? "var(--accent-subtle)" : "var(--bg-card)",
                      color: includeSnapshotContext ? "var(--accent-text)" : "var(--text-muted)",
                      fontSize: "0.7rem",
                      fontWeight: 500,
                      cursor: "pointer",
                    }}
                  >
                    <Layers size={11} />
                    <span>结合快照 (未命中 {snapshotContext.unmatchedCount})</span>
                  </button>
                )}

                <Button variant="ghost" size="xs" pill onClick={handleResetChat} title="新对话">
                  <RotateCcw size={13} />
                </Button>

                <Dialog.CloseTrigger asChild>
                  <Button variant="ghost" size="xs" pill onClick={onClose} style={{ padding: "4px" }}>
                    <X size={15} />
                  </Button>
                </Dialog.CloseTrigger>
              </div>
            </div>

            {/* Message Stream */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1rem 1.15rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.95rem",
              }}
            >
              {messages.map((msg) => {
                const isUser = msg.sender === "user";
                return (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      flexDirection: isUser ? "row-reverse" : "row",
                      alignItems: "flex-start",
                      gap: "0.65rem",
                    }}
                  >
                    <div
                      style={{
                        width: "28px",
                        height: "28px",
                        borderRadius: "50%",
                        backgroundColor: isUser ? "var(--accent-solid)" : "var(--bg-surface)",
                        border: isUser ? "none" : "1px solid var(--border-card)",
                        color: isUser ? "#fff" : "var(--accent)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {isUser ? <User size={14} /> : <Bot size={14} />}
                    </div>

                    <div
                      style={{
                        maxWidth: isUser ? "78%" : "100%",
                        flex: isUser ? "none" : 1,
                        minWidth: 0,
                        backgroundColor: isUser ? "var(--bg-surface)" : "transparent",
                        border: isUser ? "1px solid var(--border-card)" : "none",
                        borderRadius: isUser ? "1rem 1rem 0.25rem 1rem" : "0",
                        padding: isUser ? "0.55rem 0.9rem" : "0",
                      }}
                    >
                      <MarkdownView content={msg.text} />

                      {/* Suggested Rule DSL Cards */}
                      {msg.suggestedRules && msg.suggestedRules.length > 0 && (
                        <div style={{ marginTop: "0.7rem", display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "0.5rem",
                            }}
                          >
                            <span style={{ fontSize: "0.74rem", fontWeight: 600, color: "var(--text-muted)" }}>
                              已生成 {msg.suggestedRules.length} 条规则
                            </span>
                            {msg.suggestedRules.length > 1 && (
                              <Button
                                variant="outline"
                                size="xs"
                                pill
                                onClick={() => handleAddAllInMessage(msg.id, msg.suggestedRules!)}
                              >
                                <Plus size={12} />
                                <span>一键全部添加</span>
                              </Button>
                            )}
                          </div>

                          {msg.suggestedRules.map((rule, rIdx) => {
                            const key = `${msg.id}_${rIdx}`;
                            const isAdded = addedRuleKeys.has(key);
                            const hitCount = computePreviewHits(rule);
                            const chips = formatRuleConditionsCompact({ ...rule, id: key });
                            const actionType: RuleActionType = rule.action?.type || "group";

                            return (
                              <div
                                key={key}
                                style={{
                                  padding: "0.75rem 0.9rem",
                                  borderRadius: "0.75rem",
                                  border: "1px solid var(--border-card)",
                                  backgroundColor: "var(--bg-surface)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "0.75rem",
                                  flexWrap: "wrap",
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.35rem" }}>
                                    <span
                                      style={{
                                        width: 8,
                                        height: 8,
                                        borderRadius: "50%",
                                        backgroundColor: rule.color || "var(--accent)",
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span style={{ fontWeight: 600, fontSize: "0.84rem" }}>{rule.name}</span>
                                    <Badge variant="subtle" size="sm" style={{ fontSize: "0.64rem" }}>
                                      {ACTION_LABELS[actionType]}
                                    </Badge>
                                    <Badge variant="outline" size="sm" style={{ fontSize: "0.63rem" }}>
                                      {rule.matchMode === "all" ? "AND" : "OR"}
                                    </Badge>
                                    {allTabs.length > 0 && (
                                      <Badge
                                        variant="subtle"
                                        size="sm"
                                        style={{
                                          fontSize: "0.64rem",
                                          backgroundColor:
                                            hitCount > 0 ? "var(--accent-subtle)" : "var(--bg-card)",
                                          color: hitCount > 0 ? "var(--accent-text)" : "var(--text-muted)",
                                        }}
                                      >
                                        预计命中 {hitCount}
                                      </Badge>
                                    )}
                                  </div>

                                  {chips.length > 0 && (
                                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.35rem" }}>
                                      {chips.slice(0, 4).map((chip, cIdx) => (
                                        <span
                                          key={cIdx}
                                          style={{
                                            fontSize: "0.66rem",
                                            padding: "1px 6px",
                                            borderRadius: "4px",
                                            backgroundColor: "var(--bg-card)",
                                            color: "var(--text-muted)",
                                            border: "1px solid var(--border-subtle)",
                                          }}
                                        >
                                          {chip}
                                        </span>
                                      ))}
                                    </div>
                                  )}
                                </div>

                                <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", flexShrink: 0 }}>
                                  {!isAdded && (
                                    <Button
                                      variant="ghost"
                                      size="xs"
                                      pill
                                      onClick={() => setEditingDraft({ key, rule })}
                                      title="编辑后添加"
                                    >
                                      <Edit3 size={12} />
                                      <span>编辑</span>
                                    </Button>
                                  )}
                                  <Button
                                    variant={isAdded ? "subtle" : "solid"}
                                    size="xs"
                                    pill
                                    disabled={isAdded}
                                    onClick={() => handleAddRule(rule, key)}
                                  >
                                    {isAdded ? <Check size={12} /> : <Plus size={12} />}
                                    <span>{isAdded ? "已添加" : "添加"}</span>
                                  </Button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Quick Prompts on Empty Conversation */}
              {messages.length <= 1 && !isGenerating && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem", paddingLeft: "2.35rem" }}>
                  {snapshotContext && snapshotContext.unmatchedCount > 0 && (
                    <button
                      type="button"
                      onClick={() =>
                        handleSendMessage(
                          `请根据当前快照中尚未被命中的高频域名（共 ${snapshotContext.unmatchedCount} 个未命中标签），为我提炼 3~5 条最实用的自动化归类规则。`
                        )
                      }
                      style={{
                        padding: "0.42rem 0.8rem",
                        borderRadius: "9999px",
                        border: "1px solid var(--accent-border)",
                        backgroundColor: "var(--accent-subtle)",
                        color: "var(--accent-text)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ✨ 为当前 {snapshotContext.unmatchedCount} 个未命中标签推荐规则
                    </button>
                  )}

                  {CURATED_PROMPTS.map((item) => (
                    <button
                      key={item.label}
                      type="button"
                      onClick={() => handleSendMessage(item.prompt)}
                      style={{
                        padding: "0.4rem 0.75rem",
                        borderRadius: "9999px",
                        border: "1px solid var(--border-subtle)",
                        backgroundColor: "var(--bg-surface)",
                        color: "var(--text-muted)",
                        fontSize: "0.74rem",
                        cursor: "pointer",
                      }}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              )}

              {isGenerating && (
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", paddingLeft: "2.35rem", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  <Loader2 size={14} className="animate-spin" />
                  <span>正在生成 Rule DSL 规则...</span>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Bottom Input Bar */}
            <div
              style={{
                padding: "0.75rem 1.15rem",
                borderTop: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-surface)",
                display: "flex",
                alignItems: "flex-end",
                gap: "0.55rem",
              }}
            >
              <textarea
                rows={2}
                value={inputPrompt}
                onChange={(e) => setInputPrompt(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    handleSendMessage();
                  }
                }}
                placeholder="描述你的分类规则需求，支持多轮追问调整（Enter 发送，Shift+Enter 换行）..."
                style={{
                  flex: 1,
                  resize: "none",
                  padding: "0.55rem 0.8rem",
                  borderRadius: "0.75rem",
                  border: "1px solid var(--border-card)",
                  backgroundColor: "var(--bg-card)",
                  color: "var(--text-main)",
                  fontSize: "0.82rem",
                  lineHeight: 1.45,
                  outline: "none",
                }}
              />
              <Button
                variant="solid"
                size="sm"
                pill
                disabled={isGenerating || !inputPrompt.trim()}
                onClick={() => handleSendMessage()}
                style={{ height: "38px", padding: "0 1rem" }}
              >
                <Send size={14} />
                <span>生成</span>
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Positioner>
      </Dialog.Root>

      {/* Edit Before Adding */}
      <RuleEditorModal
        isOpen={Boolean(editingDraft)}
        initialRule={editingDraft?.rule || null}
        isNew
        panels={rawSnapshot?.panels || {}}
        containers={rawSnapshot?.containers || {}}
        snapshotTabs={allTabs}
        onClose={() => setEditingDraft(null)}
        onSave={(saved) => {
          if (editingDraft) {
            handleAddRule(saved as Omit<CategorizationRule, "id">, editingDraft.key);
            setEditingDraft(null);
          }
        }}
      />
    </>
  );
}
