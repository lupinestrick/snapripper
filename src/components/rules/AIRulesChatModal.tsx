"use client";

import React, { useState, useRef, useEffect } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { sendAIChatRequest } from "@/services/aiService";
import { CategorizationRule } from "@/types/sidebery";
import {
  X,
  Sparkles,
  Send,
  Loader2,
  Check,
  Plus,
  Bot,
  User,
  ExternalLink,
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

const QUICK_PROMPTS = [
  "🎨 二次元同人与画师社区 (Pixiv/ArtStation)",
  "📈 金融投资与加密货币 (Binance/TradingView)",
  "🎮 主机与 Steam 游戏资讯 (IGN/Steam/Metacritic)",
  "🧪 前端工程与开源库文档 (Tailwind/Vite/Bun)",
];

export function AIRulesChatModal({ isOpen, onClose }: AIRulesChatModalProps) {
  const { aiConfig, addRule } = useConfigStore();
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      sender: "assistant",
      text: "你好！我是规则生成助手。请用自然语言告诉我你想整理哪些类型的网站或主题，我会为你提炼精准的域名与关键词匹配规则。",
    },
  ]);
  const [inputPrompt, setInputPrompt] = useState("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [addedRuleKeys, setAddedRuleKeys] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isGenerating]);

  if (!isOpen) return null;

  const handleSendMessage = async (textToSend?: string) => {
    const prompt = (textToSend || inputPrompt).trim();
    if (!prompt || isGenerating) return;

    const userMsgId = `user_${Date.now()}`;
    const newMessages: ChatMessage[] = [
      ...messages,
      { id: userMsgId, sender: "user", text: prompt },
    ];
    setMessages(newMessages);
    setInputPrompt("");
    setIsGenerating(true);

    try {
      const systemPrompt = `你是一个 Sidebery 标签页分类规则生成专家。
用户的目标是将特定领域的浏览器标签页自动匹配并归类到 Group 分组中。
请使用友好精简的中文回答用户，并在回复末尾附带严格符合以下 JSON 格式的推荐规则数组代码块：
\`\`\`json
[
  {
    "name": "🎨 分组名称（带emoji）",
    "matchDomain": "domain1.com, domain2.com",
    "matchKeyword": "keyword1, keyword2, 关键词",
    "minThreshold": 2,
    "color": "#3b82f6",
    "scope": "all"
  }
]
\`\`\`
规则中的 matchDomain 和 matchKeyword 必须是逗号分隔的精确字符串。`;

      const aiResponse = await sendAIChatRequest(aiConfig, systemPrompt, prompt);

      // Extract JSON rules from response
      let suggestedRules: Omit<CategorizationRule, "id">[] | undefined = undefined;
      const jsonMatch = aiResponse.match(/```(?:json)?\s*(\[\s*\{[\s\S]*\}\s*\])\s*```/);
      if (jsonMatch) {
        try {
          const parsed = JSON.parse(jsonMatch[1]);
          if (Array.isArray(parsed)) {
            suggestedRules = parsed.map((item: any) => ({
              name: String(item.name || "未命名分类"),
              enabled: true,
              scope: (item.scope as any) || "all",
              targetScopeId: item.targetScopeId || "",
              matchDomain: String(item.matchDomain || ""),
              matchKeyword: String(item.matchKeyword || ""),
              minThreshold: Number(item.minThreshold) || 2,
              color: String(item.color || "#38bdf8"),
            }));
          }
        } catch {}
      }

      // Clean message text by removing raw json code block for better chat presentation
      const cleanedText = aiResponse.replace(/```(?:json)?\s*\[\s*\{[\s\S]*\}\s*\]\s*```/, "").trim();

      setMessages([
        ...newMessages,
        {
          id: `ai_${Date.now()}`,
          sender: "assistant",
          text: cleanedText || "我已经为你提炼了以下分类规则，你可以点击直接应用：",
          suggestedRules,
        },
      ]);
    } catch (err: any) {
      setMessages([
        ...newMessages,
        {
          id: `ai_${Date.now()}`,
          sender: "assistant",
          text: `生成失败: ${err.message || "请检查系统设置中的 AI 接口与 API Key 是否配置正确。"}`,
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
          width: "100%",
          maxWidth: "680px",
          height: "80vh",
          maxHeight: "720px",
          backgroundColor: "#111827",
          border: "1px solid #334155",
          borderRadius: "1rem",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Hop-up Header */}
        <div
          style={{
            padding: "1rem 1.25rem",
            borderBottom: "1px solid #1f2937",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "#1e293b",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <Sparkles size={18} color="#38bdf8" />
            <h3 style={{ fontSize: "1rem", fontWeight: 600, color: "#f8fafc" }}>
              AI 智能生成规则助手
            </h3>
          </div>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              color: "#94a3b8",
              cursor: "pointer",
              padding: "4px",
              borderRadius: "9999px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Chat Messages Body */}
        <div
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "1.25rem",
            display: "flex",
            flexDirection: "column",
            gap: "1rem",
          }}
        >
          {messages.map((msg) => {
            const isUser = msg.sender === "user";
            return (
              <div
                key={msg.id}
                style={{
                  display: "flex",
                  gap: "0.6rem",
                  alignSelf: isUser ? "flex-end" : "flex-start",
                  maxWidth: "85%",
                }}
              >
                {!isUser && (
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "9999px",
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Bot size={15} color="#38bdf8" />
                  </div>
                )}

                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  <div
                    style={{
                      padding: "0.75rem 1rem",
                      borderRadius: "0.75rem",
                      backgroundColor: isUser ? "#2563eb" : "#1e293b",
                      color: "#f8fafc",
                      fontSize: "0.85rem",
                      lineHeight: "1.5",
                      border: isUser ? "none" : "1px solid #334155",
                      whiteSpace: "pre-wrap",
                    }}
                  >
                    {msg.text}
                  </div>

                  {/* Render Suggested Rule Cards */}
                  {msg.suggestedRules && msg.suggestedRules.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem", marginTop: "0.25rem" }}>
                      {msg.suggestedRules.map((rule, idx) => {
                        const ruleKey = `${msg.id}_rule_${idx}`;
                        const isAdded = addedRuleKeys.has(ruleKey);
                        return (
                          <div
                            key={ruleKey}
                            style={{
                              padding: "0.85rem",
                              borderRadius: "0.6rem",
                              backgroundColor: "#0f172a",
                              border: "1px solid #334155",
                              display: "flex",
                              flexDirection: "column",
                              gap: "0.5rem",
                            }}
                          >
                            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                                <span
                                  style={{
                                    width: "10px",
                                    height: "10px",
                                    borderRadius: "50%",
                                    backgroundColor: rule.color,
                                  }}
                                />
                                <span style={{ fontWeight: 600, fontSize: "0.9rem", color: "#f8fafc" }}>
                                  {rule.name}
                                </span>
                              </div>

                              <button
                                onClick={() => handleAddRule(rule, ruleKey)}
                                disabled={isAdded}
                                style={{
                                  padding: "0.25rem 0.75rem",
                                  borderRadius: "9999px",
                                  border: isAdded ? "1px solid #059669" : "none",
                                  backgroundColor: isAdded ? "rgba(16, 185, 129, 0.15)" : "#2563eb",
                                  color: isAdded ? "#34d399" : "#fff",
                                  fontSize: "0.75rem",
                                  fontWeight: 500,
                                  cursor: isAdded ? "default" : "pointer",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "0.3rem",
                                }}
                              >
                                {isAdded ? <Check size={13} /> : <Plus size={13} />}
                                <span>{isAdded ? "已添加" : "添加此规则"}</span>
                              </button>
                            </div>

                            <div style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                              <div><strong>匹配域名:</strong> {rule.matchDomain || "无"}</div>
                              <div><strong>关键词:</strong> {rule.matchKeyword || "无"}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {isUser && (
                  <div
                    style={{
                      width: "28px",
                      height: "28px",
                      borderRadius: "9999px",
                      backgroundColor: "#3b82f6",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <User size={15} color="#fff" />
                  </div>
                )}
              </div>
            );
          })}

          {isGenerating && (
            <div style={{ display: "flex", gap: "0.6rem", alignItems: "center", color: "#38bdf8", fontSize: "0.8rem" }}>
              <Loader2 size={16} className="animate-spin" />
              <span>AI 正在思考并提取规则模式...</span>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Quick Prompts */}
        <div
          style={{
            padding: "0.5rem 1rem",
            backgroundColor: "#0b0f19",
            borderTop: "1px solid #1f2937",
            display: "flex",
            gap: "0.5rem",
            overflowX: "auto",
          }}
        >
          {QUICK_PROMPTS.map((promptText) => (
            <button
              key={promptText}
              type="button"
              onClick={() => handleSendMessage(promptText)}
              disabled={isGenerating}
              style={{
                whiteSpace: "nowrap",
                padding: "0.25rem 0.65rem",
                borderRadius: "9999px",
                border: "1px solid #334155",
                backgroundColor: "#1e293b",
                color: "#94a3b8",
                fontSize: "0.72rem",
                cursor: isGenerating ? "not-allowed" : "pointer",
              }}
            >
              {promptText}
            </button>
          ))}
        </div>

        {/* Chat Input Bar */}
        <div
          style={{
            padding: "0.85rem 1.25rem",
            backgroundColor: "#111827",
            borderTop: "1px solid #1f2937",
            display: "flex",
            gap: "0.6rem",
            alignItems: "center",
          }}
        >
          <input
            type="text"
            placeholder="描述你想分类的网站或主题（如：添加动漫、论文或海淘购物分类）..."
            value={inputPrompt}
            onChange={(e) => setInputPrompt(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            disabled={isGenerating}
            style={{
              flex: 1,
              padding: "0.55rem 0.85rem",
              borderRadius: "0.5rem",
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              color: "#fff",
              fontSize: "0.85rem",
              outline: "none",
            }}
          />

          <button
            onClick={() => handleSendMessage()}
            disabled={!inputPrompt.trim() || isGenerating}
            style={{
              padding: "0.55rem 1.1rem",
              borderRadius: "9999px",
              border: "none",
              backgroundColor: !inputPrompt.trim() || isGenerating ? "#334155" : "#2563eb",
              color: "#fff",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: !inputPrompt.trim() || isGenerating ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            {isGenerating ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
            <span>发送</span>
          </button>
        </div>
      </div>
    </div>
  );
}
