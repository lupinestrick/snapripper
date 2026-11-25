"use client";

import React, { useState } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { AIProtocolType } from "@/types/ai";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Check } from "lucide-react";

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

    addCustomProvider(
      {
        name: name.trim(),
        type,
        baseUrl: baseUrl.trim(),
        model: model.trim() || "gpt-4o-mini",
      },
      apiKey.trim()
    );

    setName("");
    setApiKey("");
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

            <div>
              <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                默认模型
              </label>
              <Input
                type="text"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="gpt-4o-mini"
              />
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
