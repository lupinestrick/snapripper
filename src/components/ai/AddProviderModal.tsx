"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { toast } from "@/store/useFeedbackStore";
import { fetchAvailableModels } from "@/services/aiService";
import { AIProtocolType } from "@/types/ai";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Plus, Check, RefreshCw, Loader2, ChevronDown } from "lucide-react";

interface AddProviderModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface AddProviderFormProps {
  isActive: boolean;
  onCancel: () => void;
  onSuccess?: (providerId: string) => void;
}

const SESSION_MODELS_CACHE_KEY = "snapripper-add-provider-models-cache";
const memoryModelsCache = new Map<string, string[]>();

function getSessionCacheKey(type: AIProtocolType, baseUrl: string): string {
  return `${type}::${baseUrl.trim().replace(/\/+$/, "").toLowerCase()}`;
}

function readCachedModelsForUrl(type: AIProtocolType, baseUrl: string): string[] | null {
  const key = getSessionCacheKey(type, baseUrl);
  if (memoryModelsCache.has(key)) {
    return memoryModelsCache.get(key) || null;
  }
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(SESSION_MODELS_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Record<string, string[]>;
    if (Array.isArray(parsed[key]) && parsed[key].length > 0) {
      memoryModelsCache.set(key, parsed[key]);
      return parsed[key];
    }
  } catch {
    // ignore storage errors
  }
  return null;
}

function writeCachedModelsForUrl(type: AIProtocolType, baseUrl: string, models: string[]) {
  const key = getSessionCacheKey(type, baseUrl);
  memoryModelsCache.set(key, models);
  if (typeof window === "undefined") return;
  try {
    const raw = window.sessionStorage.getItem(SESSION_MODELS_CACHE_KEY);
    const parsed = raw ? (JSON.parse(raw) as Record<string, string[]>) : {};
    parsed[key] = models;
    window.sessionStorage.setItem(SESSION_MODELS_CACHE_KEY, JSON.stringify(parsed));
  } catch {
    // ignore storage errors
  }
}

const CHINA_PROVIDER_PRESETS: {
  name: string;
  type: AIProtocolType;
  baseUrl: string;
}[] = [
  { name: "硅基流动", type: "openai", baseUrl: "https://api.siliconflow.cn/v1" },
  { name: "阿里云百炼", type: "openai", baseUrl: "https://dashscope.aliyuncs.com/compatible-mode/v1" },
  { name: "智谱 GLM", type: "openai", baseUrl: "https://open.bigmodel.cn/api/paas/v4" },
  { name: "火山豆包", type: "openai", baseUrl: "https://ark.cn-beijing.volces.com/api/v3" },
  { name: "Kimi", type: "openai", baseUrl: "https://api.moonshot.cn/v1" },
  { name: "MiniMax", type: "openai", baseUrl: "https://api.minimaxi.com/v1" },
  { name: "腾讯混元", type: "openai", baseUrl: "https://api.hunyuan.cloud.tencent.com/v1" },
  { name: "Ollama", type: "openai", baseUrl: "http://localhost:11434/v1" },
];

/**
 * 可复用的自定义供应商表单（支持独立弹窗与设置弹窗内嵌子视图，避免双层弹窗堆叠）
 */
export function AddProviderForm({ isActive, onCancel, onSuccess }: AddProviderFormProps) {
  const { addCustomProvider } = useConfigStore();

  const [name, setName] = useState("");
  const [type, setType] = useState<AIProtocolType>("openai");
  const [baseUrl, setBaseUrl] = useState("https://api.openai.com/v1");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");
  const [fetchedModels, setFetchedModels] = useState<string[]>([]);
  const [isFetchingModels, setIsFetchingModels] = useState(false);
  const [fetchHint, setFetchHint] = useState<string | null>(null);
  const [isModelDropdownOpen, setIsModelDropdownOpen] = useState(false);
  const [isSearchingModel, setIsSearchingModel] = useState(false);

  const runFetchModels = useCallback(
    async (
      targetType: AIProtocolType,
      targetBaseUrl: string,
      targetApiKey: string,
      openDropdownOnSuccess: boolean = false
    ) => {
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
        writeCachedModelsForUrl(targetType, cleanUrl, models);
        setFetchHint(
          models.length > 0
            ? `已获取 ${models.length} 个模型（本会话内已缓存），请选择模型`
            : "接口返回 0 个可用模型，可手动输入模型 ID"
        );
        if (openDropdownOnSuccess && models.length > 0) {
          setIsSearchingModel(false);
          setIsModelDropdownOpen(true);
        }
      } catch (err: any) {
        setFetchHint(err?.message || "获取模型失败");
      } finally {
        setIsFetchingModels(false);
      }
    },
    []
  );

  useEffect(() => {
    if (!isActive) return;
    const cleanUrl = baseUrl.trim();
    const cleanKey = apiKey.trim();
    if (!/^https?:\/\/.+/i.test(cleanUrl)) return;

    const cached = readCachedModelsForUrl(type, cleanUrl);
    if (cached && cached.length > 0) {
      setFetchedModels(cached);
      setFetchHint(`已从本会话缓存恢复 ${cached.length} 个模型`);
      return;
    }

    const isLocalhost = cleanUrl.includes("localhost") || cleanUrl.includes("127.0.0.1");
    if (!cleanKey && !isLocalhost) {
      return;
    }
    const timer = setTimeout(() => {
      runFetchModels(type, cleanUrl, cleanKey);
    }, 650);
    return () => clearTimeout(timer);
  }, [isActive, type, baseUrl, apiKey, runFetchModels]);

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
  };

  const handleSubmit = () => {
    if (!name.trim()) {
      toast.warning("请输入供应商名称");
      return;
    }
    if (!baseUrl.trim()) {
      toast.warning("请输入 API Base URL");
      return;
    }
    if (!model.trim()) {
      if (fetchedModels.length > 0) {
        toast.warning("请从列表中选择一个模型");
        setIsSearchingModel(false);
        setIsModelDropdownOpen(true);
      } else {
        toast.warning("请先获取并选择模型，或手动输入模型 ID");
      }
      return;
    }

    const cleanUrl = baseUrl.trim();
    const cleanKey = apiKey.trim();
    const newId = addCustomProvider(
      {
        name: name.trim(),
        type,
        baseUrl: cleanUrl,
        model: model.trim(),
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
    setModel("");
    setFetchedModels([]);
    setFetchHint(null);
    onSuccess?.(newId);
  };

  return (
    <>
      <div style={{ padding: "1.1rem", display: "flex", flexDirection: "column", gap: "0.85rem", overflowY: "auto", flex: 1 }}>
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
                  setModel("");
                  setFetchedModels([]);
                  setFetchHint(null);
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
              选择模型
            </label>
            <button
              type="button"
              onClick={() => runFetchModels(type, baseUrl, apiKey, true)}
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
          <div style={{ position: "relative" }}>
            <Input
              type="text"
              value={model}
              onFocus={() => {
                setIsSearchingModel(false);
                if (fetchedModels.length > 0) setIsModelDropdownOpen(true);
              }}
              onBlur={() =>
                setTimeout(() => {
                  setIsModelDropdownOpen(false);
                  setIsSearchingModel(false);
                }, 160)
              }
              onChange={(e) => {
                setModel(e.target.value);
                setIsSearchingModel(true);
                if (fetchedModels.length > 0) setIsModelDropdownOpen(true);
              }}
              placeholder={
                fetchedModels.length > 0
                  ? `点击选择模型（已获取 ${fetchedModels.length} 个），或输入筛选`
                  : "填写 URL 与 Key 后自动获取可选模型，或手动输入"
              }
              style={{ paddingRight: "2rem" }}
            />
            {fetchedModels.length > 0 && (
              <button
                type="button"
                onMouseDown={(e) => {
                  e.preventDefault();
                  setIsSearchingModel(false);
                  setIsModelDropdownOpen((prev) => !prev);
                }}
                title="展开/收起模型列表"
                style={{
                  position: "absolute",
                  right: "0.45rem",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: "2px",
                  display: "flex",
                  alignItems: "center",
                }}
              >
                <ChevronDown
                  size={14}
                  style={{
                    transform: isModelDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                    transition: "transform 0.15s ease",
                  }}
                />
              </button>
            )}
          </div>
          {fetchHint && (
            <div style={{ fontSize: "0.7rem", color: fetchedModels.length > 0 ? "var(--success, #10b981)" : "var(--text-muted)", marginTop: "0.25rem" }}>
              {fetchHint}
            </div>
          )}
          {isModelDropdownOpen && fetchedModels.length > 0 && (() => {
            const q = isSearchingModel ? model.trim().toLowerCase() : "";
            const filtered = q
              ? fetchedModels.filter((m) => m.toLowerCase().includes(q))
              : fetchedModels;
            return (
              <div
                style={{
                  position: "absolute",
                  left: 0,
                  right: 0,
                  bottom: "calc(100% + 4px)",
                  maxHeight: "230px",
                  overflowY: "auto",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-card)",
                  borderRadius: "0.65rem",
                  boxShadow: "0 -10px 28px rgba(0,0,0,0.35)",
                  zIndex: 50,
                  padding: "0.35rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "2px",
                }}
              >
                {filtered.length === 0 ? (
                  <div style={{ padding: "0.5rem 0.65rem", fontSize: "0.76rem", color: "var(--text-muted)" }}>
                    无匹配模型
                  </div>
                ) : (
                  filtered.slice(0, 60).map((m) => (
                    <button
                      key={m}
                      type="button"
                      onMouseDown={(e) => {
                        e.preventDefault();
                        setModel(m);
                        setIsSearchingModel(false);
                        setIsModelDropdownOpen(false);
                      }}
                      style={{
                        width: "100%",
                        display: "block",
                        textAlign: "left",
                        padding: "0.45rem 0.65rem",
                        borderRadius: "0.45rem",
                        border: "none",
                        backgroundColor: m === model ? "var(--accent-subtle)" : "transparent",
                        color: m === model ? "var(--accent-text)" : "var(--text-main)",
                        fontSize: "0.8rem",
                        lineHeight: 1.4,
                        fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                        cursor: "pointer",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                      }}
                      title={m}
                    >
                      {m}
                    </button>
                  ))
                )}
              </div>
            );
          })()}
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
        <Button variant="outline" size="xs" pill onClick={onCancel}>
          取消
        </Button>
        <Button variant="solid" size="xs" pill onClick={handleSubmit}>
          <Check size={13} />
          <span>添加</span>
        </Button>
      </div>
    </>
  );
}

export function AddProviderModal({ isOpen, onClose }: AddProviderModalProps) {
  if (!isOpen) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 130 }} />
      <Dialog.Positioner style={{ zIndex: 140 }}>
        <Dialog.Content
          style={{
            maxWidth: "520px",
            width: "92vw",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            display: "flex",
            flexDirection: "column",
            overflow: "visible",
            boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
          }}
        >
          <div
            style={{
              padding: "0.8rem 1.15rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              borderTopLeftRadius: "1rem",
              borderTopRightRadius: "1rem",
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

          <AddProviderForm isActive={isOpen} onCancel={onClose} onSuccess={() => onClose()} />
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
