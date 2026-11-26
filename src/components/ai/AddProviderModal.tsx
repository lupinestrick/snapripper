"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { fetchAvailableModels } from "@/services/aiService";
import { AIProtocolType } from "@/types/ai";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Check, RefreshCw, Loader2 } from "lucide-react";

interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const CHINA_PROVIDER_PRESETS: {
  name: string;
  type: AIProtocolType;
  baseUrl: string;
  model: string;
}[] = [
  { name: "硅基流动", type: "openai", baseUrl: "https://api.siliconflow.cn/v1", model: "Qwen/Qwen2.5-72B-Instruct" },
  { name: "阿里云百炼", type: "openai", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1", model: "qwen-plus" },
  { name: "智谱 GLM", type: "openai", baseUrl: "https://open.bigmodel.cn/api/paas/v4", model: "glm-4-plus" },
  { name: "火山豆包", type: "openai", baseUrl: "https://ark.cn-beijing.volces.com/api/v3", model: "doubao-1-5-pro-32k-250115" },
  { name: "Kimi", type: "openai", baseUrl: "https://api.moonshot.cn/v1", model: "moonshot-v1-8k" },
  { name: "MiniMax", type: "openai", baseUrl: "https://api.minimaxi.com/v1", model: "MiniMax-Text-01" },
  { name: "腾讯混元", type: "openai", baseUrl: "https://api.hunyuan.cloud.tencent.com/v1", model: "hunyuan-turbos-latest" },
  { name: "Ollama", type: "openai", baseUrl: "http://localhost:11434/v1", model: "qwen2.5:7b" },
];

export function AddProviderModal({ isOpen, onClose }: AddProviderModalProps) {
  const { addCustomProvider } = useConfigStore();

  const [name, setName] = useState("");
  const [type, setType] = useState<AIProtocolType>("openai");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("gpt-4o-mini");
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchHint, setFetchHint] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);

  const runFetchModels = useCallback(async (targetType: AIProtocolType, targetBaseUrl: string, targetApiKey: string) => {
    const cleanUrl = targetBaseUrl.trim();
    const cleanKey = targetApiKey.trim();
    const isLocalhost = cleanUrl.includes("localhost") || cleanUrl.includes("127.0.0.1");
    if (!/^https?:\/\/.+/i.test(cleanUrl)) return;
    if (!cleanKey && !isLocalhost) return;

    setIsFetchingModels(true);
    setFetchHint(null);
    try {
      const models = await fetchAvailableModels({
        provider: "custom",
        type: targetType,
        baseURL: cleanUrl,
        apiKey: cleanKey,
        model: "",
      });
      setFetchedModels(models);
      setFetchHint(`已自动获取 ${models.length} 个模型`);
      setModel((prev) => (prev.trim() ? prev : models[0] || prev));
    } catch (err: any) {
      setFetchHint(err?.message || "获取模型失败");
    } finally {
      setIsFetchingModels(false);
    }
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const cleanUrl = baseUrl.trim();
    const cleanKey = apiKey.trim();
    const isLocalhost = cleanUrl.includes("localhost") || cleanUrl.includes("127.0.0.1");
    if (!/^https?:\/\/.+/i.test(cleanUrl) || (!cleanKey && !isLocalhost)) {
      return;
    }
    const timer = setTimeout(() => {
      runFetchModels(type, cleanUrl, cleanKey);
    }, 650);
    return () => clearTimeout(timer);
  }, [isOpen, type, baseUrl, apiKey, runFetchModels]);

  if (!isOpen) return null;

  const handleProtocolChange = (nextType: AIProtocolType) => {
    setType(nextType);
    if (
      baseUrl === "https://api.openai.com/v1" ||
      baseUrl === "https://api.anthropic.com/v1" ||
      baseUrl === "https://generativelanguage.googleapis.com/v1beta"
    ) {
      setBaseUrl(
        nextType === "anthropic"
          ? "https://api.anthropic.com/v1"
          : nextType === "gemini"
            ? "https://generativelanguage.googleapis.com/v1beta"
            : "https://api.openai.com/v1"
      );
    }
    if (model === "gpt-4o-mini" || model === "claude-3-7-sonnet-20250219" || model === "gemini-2.5-flash") {
      setModel(
        nextType === "anthropic"
          ? "claude-3-7-sonnet-20250219"
          : nextType === "gemini"
            ? "gemini-2.5-flash"
            : "gpt-4o-mini"
      );
    }
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      alert("请输入供应商名称");
      return;
    }
    if (!baseUrl.trim()) {
      alert("请输入 API Base URL");
      return;
    }

    const cleanUrl = baseUrl.trim();
    const cleanKey = apiKey.trim();
    const newId = addCustomProvider(
      {
        name: name.trim(),
        type,
        baseUrl: cleanUrl,
        model: model.trim() || fetchedModels[0] || "gpt-4o-mini",
      },
      cleanKey,
      fetchedModels
    );

    // 若添加时尚未拉取到模型列表，则在后台自动补拉并缓存到新供应商槽位
    if (fetchedModels.length === 0 && /^https?:\/\/.+/i.test(cleanUrl)) {
      const isLocalhost = cleanUrl.includes("localhost") || cleanUrl.includes("127.0.0.1");
      if (cleanKey || isLocalhost) {
        fetchAvailableModels({
          provider: newId,
          type,
          baseURL: cleanUrl,
          apiKey: cleanKey,
          model: model.trim(),
        })
          .then((models) => {
            if (models.length > 0) {
              const curr = useConfigStore.getState().aiConfig;
              useConfigStore.getState().setAIConfig({
                cachedModels: {
                  ...(curr.cachedModels || {}),
                  [newId]: models,
                },
              });
            }
          })
          .catch(() => {});
      }
    }

    setName("");
    setApiKey("");
    setFetchedModels([]);
    setFetchHint(null);
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 130 }} />
      <Dialog.Positioner style={{ zIndex: 140 }}>
        <Dialog.Content
          style={{
            maxWidth: "460px",
            width: "92vw",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              padding: "0.8rem 1.15rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Plus size={15} style={{ color: "var(--accent)" }} />
              <Dialog.Title style={{ fontSize: "0.92rem", fontWeight: 600 }}>
                添加自定义供应商
              </Dialog.Title>
            </div>
            <Dialog.CloseTrigger asChild>
              <Button variant="ghost" size="xs" pill onClick={onClose} style={{ padding: "4px" }}>
                <X size={15} />
              </Button>
            </Dialog.CloseTrigger>
          </div>

          <div style={{ padding: "1.1rem", display: "flex", flexDirection: "column", gap: "0.85rem" }}>
            {/* Quick Presets */}
            <div>
              <label style={{ display: "block", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                常用快捷模板
              </label>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                {CHINA_PROVIDER_PRESETS.map((p) => (
                  <button
                    key={p.name}
                    type="button"
                    onClick={() => {
                      setName(p.name);
                      setType(p.type);
                      setBaseUrl(p.baseUrl);
                      setModel(p.model);
                    }}
                    style={{
                      padding: "2px 8px",
                      borderRadius: "9999px",
                      fontSize: "0.7rem",
                      border: "1px solid var(--border-subtle)",
                      backgroundColor: name === p.name ? "var(--accent-subtle)" : "var(--bg-surface)",
                      borderColor: name === p.name ? "var(--accent-border)" : "var(--border-subtle)",
                      color: name === p.name ? "var(--accent-text)" : "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                供应商名称
              </label>
              <Input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="例如: OpenRouter / 硅基流动 / Ollama"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                接口协议
              </label>
              <div style={{ display: "flex", gap: "0.35rem" }}>
                {(["openai", "anthropic", "gemini"] as AIProtocolType[]).map((p) => (
                  <Button
                    key={p}
                    type="button"
                    variant={type === p ? "subtle" : "outline"}
                    size="xs"
                    pill
                    onClick={() => handleProtocolChange(p)}
                  >
                    {p === "openai" ? "OpenAI" : p === "anthropic" ? "Anthropic" : "Gemini"}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                API Base URL
              </label>
              <Input
                type="text"
                value={baseUrl}
                onChange={(e) => setBaseUrl(e.target.value)}
                placeholder="https://api.openai.com/v1"
              />
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                API Key
              </label>
              <Input
                type="password"
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="sk-...（本地服务可留空）"
              />
            </div>

            <div style={{ position: "relative" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.25rem",
                }}
              >
                <label style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                  默认模型
                </label>
                <button
                  type="button"
                  onClick={() => runFetchModels(type, baseUrl, apiKey)}
                  disabled={isFetchingModels}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "0.25rem",
                    background: "transparent",
                    border: "none",
                    color: "var(--accent-text)",
                    fontSize: "0.7rem",
                    cursor: isFetchingModels ? "not-allowed" : "pointer",
                    padding: 0,
                  }}
                >
                  {isFetchingModels ? <Loader2 size={11} className="animate-spin" /> : <RefreshCw size={11} />}
                  <span>{isFetchingModels ? "获取中..." : "获取模型列表"}</span>
                </button>
              </div>
              <Input
                type="text"
                value={model}
                onFocus={() => fetchedModels.length > 0 && setIsModelDropdownOpen(true)}
                onBlur={() => setTimeout(() => setIsModelDropdownOpen(false), 150)}
                onChange={(e) => {
                  setModel(e.target.value);
                  if (fetchedModels.length > 0) setIsModelDropdownOpen(true);
                }}
                placeholder="输入或从下方已获取列表选择模型"
              />
              {fetchHint && (
                <div style={{ fontSize: "0.68rem", color: fetchedModels.length > 0 ? "var(--success, #10b981)" : "var(--text-muted)", marginTop: "0.25rem" }}>
                  {fetchHint}
                </div>
              )}
              {isModelDropdownOpen && fetchedModels.length > 0 && (
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    right: 0,
                    top: "100%",
                    marginTop: "4px",
                    maxHeight: "150px",
                    overflowY: "auto",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-card)",
                    borderRadius: "0.55rem",
                    boxShadow: "0 10px 24px rgba(0,0,0,0.3)",
                    zIndex: 30,
                    padding: "0.25rem",
                  }}
                >
                  {fetchedModels
                    .filter((m) => !model.trim() || m.toLowerCase().includes(model.trim().toLowerCase()))
                    .slice(0, 30)
                    .map((m) => (
                      <button
                        key={m}
                        type="button"
                        onMouseDown={(e) => {
                          e.preventDefault();
                          setModel(m);
                          setIsModelDropdownOpen(false);
                        }}
                        style={{
                          width: "100%",
                          textAlign: "left",
                          padding: "0.35rem 0.5rem",
                          borderRadius: "0.4rem",
                          border: "none",
                          backgroundColor: m === model ? "var(--accent-subtle)" : "transparent",
                          color: m === model ? "var(--accent-text)" : "var(--text-main)",
                          fontSize: "0.74rem",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          cursor: "pointer",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {m}
                      </button>
                    ))}
                </div>
              )}
            </div>
          </div>

          <div
            style={{
              padding: "0.75rem 1.15rem",
              borderTop: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.45rem",
            }}
          >
            <Button variant="outline" size="xs" pill onClick={onClose}>
              取消
            </Button>
            <Button variant="solid" size="xs" pill onClick={handleSubmit}>
              <Check size={13} />
              <span>添加</span>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
