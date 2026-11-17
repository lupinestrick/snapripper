import {
  AIConfig,
  CategoryProportion,
  ProportionReport,
  AI_PROVIDERS,
  AIProviderKey,
  AIProtocolType,
} from "@/types/ai";
import { SideberyTab, CategorizationRule } from "@/types/sidebery";
import { cleanUrlForAI, extractDomain, isExemptUrl } from "@/utils/urlHelper";
import { DEFAULT_PROPORTION_ANALYSIS_PROMPT, DEFAULT_RULES_GENERATOR_PROMPT } from "@/constants/aiPrompts";
import { matchTabWithRule } from "./ruleEngine";

const PRESET_COLORS = [
  "#3b82f6", // blue
  "#10b981", // emerald
  "#ef4444", // red
  "#06b6d4", // cyan
  "#8b5cf6", // purple
  "#f59e0b", // amber
  "#ec4899", // pink
  "#64748b", // slate
  "#f97316", // orange
];

/**
 * URL 端点规范化工具函数：兼容 OpenAI 与 Anthropic 两类接口端点
 */
export function normalizeAnthropicMessagesUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  if (clean.endsWith("/messages")) return clean;
  if (clean.endsWith("/v1")) return `${clean}/messages`;
  return `${clean}/v1/messages`;
}

export function normalizeAnthropicModelsUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  if (clean.endsWith("/models")) return clean;
  if (clean.endsWith("/messages")) return clean.replace(/\/messages$/, "/models");
  if (clean.endsWith("/v1")) return `${clean}/models`;
  return `${clean}/v1/models`;
}

export function normalizeOpenAIChatUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  if (clean.endsWith("/chat/completions")) return clean;
  if (clean.endsWith("/v1")) return `${clean}/chat/completions`;
  return `${clean}/v1/chat/completions`;
}

export function normalizeOpenAIModelsUrl(baseUrl: string): string {
  const clean = baseUrl.trim().replace(/\/+$/, "");
  if (clean.endsWith("/models")) return clean;
  if (clean.endsWith("/chat/completions")) return clean.replace(/\/chat\/completions$/, "/models");
  if (clean.endsWith("/v1")) return `${clean}/models`;
  return `${clean}/v1/models`;
}

/**
 * 获取特定 API 选项对应的独立密钥槽位键名
 */
export function getAPIKeySlot(provider: AIProviderKey, type?: AIProtocolType): string {
  if (provider === "custom") {
    return type === "anthropic" ? "custom_anthropic" : "custom_openai";
  }
  return provider;
}

/**
 * 解析当前配置应使用的 API Key（优先使用槽位独立密钥，若无则平滑回退至 config.apiKey）
 */
export function resolveAPIKey(config: AIConfig): string {
  const slot = getAPIKeySlot(config.provider, config.type);
  if (config.apiKeys && typeof config.apiKeys[slot] === "string") {
    return config.apiKeys[slot].trim();
  }
  return (config.apiKey || "").trim();
}

/**
 * 解析当前配置应使用的 API Base URL（优先读取各槽位独立地址，清除并防止回退至 api.custome.ai）
 */
export function resolveBaseURL(config: AIConfig): string {
  const slot = getAPIKeySlot(config.provider, config.type);
  if (config.baseURLs && config.baseURLs[slot] && !config.baseURLs[slot].includes("api.custome.ai")) {
    return config.baseURLs[slot].trim();
  }
  if (config.provider === "custom") {
    if (config.baseURL && !config.baseURL.includes("api.custome.ai")) {
      return config.baseURL.trim();
    }
    return config.type === "anthropic" ? "https://api.anthropic.com/v1" : "https://api.openai.com/v1";
  }
  return (config.baseURL || AI_PROVIDERS[config.provider]?.baseUrl || "").trim();
}

/**
 * 解析当前配置应使用的模型名称
 */
export function resolveModel(config: AIConfig): string {
  const slot = getAPIKeySlot(config.provider, config.type);
  if (config.models && config.models[slot] && config.models[slot].trim()) {
    return config.models[slot].trim();
  }
  if (config.provider === "custom") {
    if (config.model && config.model.trim() && config.model.trim() !== "deepseek-flash") {
      return config.model.trim();
    }
    return config.type === "anthropic" ? "claude-3-7-sonnet-20250219" : "gpt-4o-mini";
  }
  if (config.model && config.model.trim()) {
    return config.model.trim();
  }
  return (AI_PROVIDERS[config.provider]?.model || "gpt-4o-mini").trim();
}

/**
 * 统一多协议模型通信驱动 (OpenAI, Anthropic Claude, Google Gemini)
 */
export async function sendAIChatRequest(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const providerDef = AI_PROVIDERS[config.provider] || AI_PROVIDERS.custom;
  const protocol = config.type || providerDef.type || "openai";
  const apiKey = resolveAPIKey(config);
  const model = resolveModel(config);
  const baseUrl = resolveBaseURL(config);

  const controller = new AbortController();
  const timeoutMs = 90000; // 90 秒超时控制，避免网络死等
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, timeoutMs);

  let currentEndpoint = "";

  try {
    // 1. Anthropic Claude Protocol
    if (protocol === "anthropic") {
      const endpoint = normalizeAnthropicMessagesUrl(baseUrl);
      currentEndpoint = endpoint;
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "anthropic-version": "2023-06-01",
        "dangerously-allow-browser": "true",
      };
      if (apiKey) {
        headers["x-api-key"] = apiKey;
        // 若是第三方中转代理（非 api.anthropic.com），同时附带 Authorization 标头以防中转站只认 Bearer
        if (!baseUrl.includes("anthropic.com")) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }
      }

      const isThinking = model.includes("3-7") || model.includes("thinking");
      const requestBody: Record<string, any> = {
        model,
        max_tokens: 8192,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      };
      if (!isThinking && config.temperature !== undefined) {
        requestBody.temperature = config.temperature;
      }

      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify(requestBody),
        signal: controller.signal,
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Claude/Anthropic API 错误 (HTTP ${res.status}): ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      // 兼容 Claude 3.7 / 思考模式等多 Block 响应结构，聚合所有 text 块
      if (Array.isArray(data.content)) {
        const textBlocks = data.content
          .filter((b: any) => b.type === "text" || (typeof b.text === "string" && b.type !== "thinking"))
          .map((b: any) => b.text || "");
        if (textBlocks.length > 0) {
          return textBlocks.join("");
        }
        return data.content[0]?.text || data.content[0]?.thinking || "";
      }
      if (typeof data.text === "string") {
        return data.text;
      }
      if (typeof data.completion === "string") {
        return data.completion;
      }
      return "";
    }

    // 2. Google Gemini Protocol
    if (protocol === "gemini") {
      const isNativeGemini = baseUrl.includes("generativelanguage.googleapis.com");
      if (isNativeGemini) {
        const endpoint = `${baseUrl.replace(/\/+$/, "")}/models/${model}:generateContent?key=${apiKey}`;
        currentEndpoint = endpoint;
        const res = await fetch(endpoint, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt }] },
            contents: [{ role: "user", parts: [{ text: userPrompt }] }],
            generationConfig: {
              temperature: config.temperature ?? 0.2,
            },
          }),
          signal: controller.signal,
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => "");
          throw new Error(`Gemini API 错误 (HTTP ${res.status}): ${errText.slice(0, 200)}`);
        }

        const data = await res.json();
        const parts = data.candidates?.[0]?.content?.parts || [];
        const textParts = parts
          .filter((p: any) => typeof p.text === "string" && !p.thought)
          .map((p: any) => p.text);
        if (textParts.length > 0) {
          return textParts.join("");
        }
        return parts.map((p: any) => p.text || "").join("");
      }
    }

    // 3. OpenAI Compatible Protocol (DeepSeek, OpenAI, Ollama, SiliconFlow, Groq, etc.)
    const endpoint = normalizeOpenAIChatUrl(baseUrl);
    currentEndpoint = endpoint;

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    const isReasoningModel =
      model.includes("reasoner") ||
      model.includes("r1") ||
      model.startsWith("o1") ||
      model.startsWith("o3") ||
      model.includes("qwq");

    const requestBody: Record<string, any> = {
      model,
      messages: model.startsWith("o1-mini") || model.startsWith("o1-preview")
        ? [{ role: "user", content: `${systemPrompt}\n\n${userPrompt}` }]
        : [
            { role: "system", content: systemPrompt },
            { role: "user", content: userPrompt },
          ],
    };

    if (model.startsWith("o1") || model.startsWith("o3")) {
      requestBody.max_completion_tokens = 8192;
    } else {
      requestBody.max_tokens = 8192;
      // 推理模型（如 deepseek-reasoner）禁止传递 temperature，否则返回 400
      if (!isReasoningModel) {
        requestBody.temperature = config.temperature ?? 0.2;
      }
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`AI 服务响应错误 (HTTP ${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    const choice = data.choices?.[0];
    const message = choice?.message;

    let content = "";
    if (typeof message?.content === "string") {
      content = message.content;
    } else if (Array.isArray(message?.content)) {
      content = message.content.map((p: any) => p.text || p.content || "").join("");
    } else if (typeof choice?.text === "string") {
      content = choice.text;
    }

    // 针对 DeepSeek-R1 / QwQ 等推理模型，若 content 为空则提取 reasoning_content
    if (!content.trim() && typeof message?.reasoning_content === "string") {
      content = message.reasoning_content;
    }

    // 针对某些三方代理网关或非标准响应，提取顶层 response / text / output
    if (!content.trim()) {
      if (typeof (data as any)?.response === "string") {
        content = (data as any).response;
      } else if (typeof (data as any)?.text === "string") {
        content = (data as any).text;
      } else if (typeof (data as any)?.output === "string") {
        content = (data as any).output;
      }
    }

    return content;
  } catch (err: any) {
    if (err.name === "AbortError" || controller.signal.aborted) {
      throw new Error(`AI 请求超时 (${timeoutMs / 1000} 秒未收到响应)，请检查网络连接、接口地址或更换响应更快的模型`);
    }
    if (err instanceof TypeError && err.message.includes("fetch")) {
      throw new Error(`无法连接到 AI 服务端点 (${currentEndpoint || baseUrl})，请检查网络连接、Base URL 是否填写正确或接口服务是否支持跨域 (CORS)`);
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

export async function testAIConnection(config: AIConfig): Promise<{ success: boolean; message: string }> {
  try {
    const reply = await sendAIChatRequest(
      config,
      "You are a helpful assistant.",
      "Respond with only the word OK"
    );

    if (reply) {
      return { success: true, message: "连接成功！AI 接口响应正常。" };
    }
    return { success: false, message: "服务未返回有效内容" };
  } catch (err: any) {
    return { success: false, message: `网络连接失败: ${err.message || "无法访问指定端点"}` };
  }
}

export const pingAIEndpoint = testAIConnection;

/**
 * 动态获取当前配置服务商所支持的可用模型列表
 */
export async function fetchAvailableModels(config: AIConfig): Promise<string[]> {
  const providerDef = AI_PROVIDERS[config.provider] || AI_PROVIDERS.custom;
  const protocol = config.type || providerDef.type || "openai";
  const apiKey = resolveAPIKey(config);
  const rawBaseUrl = resolveBaseURL(config);

  if (!rawBaseUrl) {
    throw new Error("请先填写有效的 API Base URL");
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 15000);

  try {
    // 1. Anthropic Claude Protocol
    if (protocol === "anthropic") {
      const endpoint = normalizeAnthropicModelsUrl(rawBaseUrl);

      const headers: Record<string, string> = {
        "anthropic-version": "2023-06-01",
        "dangerously-allow-browser": "true",
      };
      if (apiKey) {
        headers["x-api-key"] = apiKey;
        if (!rawBaseUrl.includes("anthropic.com")) {
          headers["Authorization"] = `Bearer ${apiKey}`;
        }
      }

      const res = await fetch(endpoint, {
        method: "GET",
        headers,
        signal: controller.signal,
      });

      if (!res.ok) {
        const err = await res.text().catch(() => "");
        throw new Error(`获取 Claude/Anthropic 模型列表失败 (HTTP ${res.status}): ${err.slice(0, 150)}`);
      }

      const data = await res.json();
      const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
      const models: string[] = list.map((m: any) => String(m.id || m.name || m || "")).filter(Boolean);
      if (models.length > 0) return Array.from(new Set(models)).sort();
      throw new Error("未解析到有效的 Claude/Anthropic 模型列表");
    }

    // 2. Google Gemini Protocol
    if (protocol === "gemini") {
      const isNativeGemini = rawBaseUrl.includes("generativelanguage.googleapis.com");
      if (isNativeGemini) {
        const endpoint = `${rawBaseUrl}/models?key=${apiKey}`;
        const res = await fetch(endpoint, { method: "GET", signal: controller.signal });
        if (!res.ok) {
          const err = await res.text().catch(() => "");
          throw new Error(`获取 Gemini 模型列表失败 (HTTP ${res.status}): ${err.slice(0, 150)}`);
        }
        const data = await res.json();
        const list = Array.isArray(data.models) ? data.models : [];
        const models: string[] = list
          .map((m: any) => String(m.name ? m.name.replace(/^models\//, "") : m.id || m || ""))
          .filter(Boolean);
        if (models.length > 0) return Array.from(new Set(models)).sort();
        throw new Error("未解析到有效的 Gemini 模型列表");
      }
    }

    // 3. OpenAI Compatible Protocol (DeepSeek, OpenAI, Ollama, OneAPI, vLLM, etc.)
    let endpoint = normalizeOpenAIModelsUrl(rawBaseUrl);

    const headers: Record<string, string> = {};
    if (apiKey) {
      headers["Authorization"] = `Bearer ${apiKey}`;
    }

    let res = await fetch(endpoint, { method: "GET", headers, signal: controller.signal });

    // If 404, try ${rawBaseUrl}/v1/models if endpoint wasn't /v1/models
    if (!res.ok && res.status === 404 && !endpoint.includes("/v1/models")) {
      const fallbackEndpoint = `${rawBaseUrl}/v1/models`;
      const fallbackRes = await fetch(fallbackEndpoint, { method: "GET", headers, signal: controller.signal }).catch(() => null);
      if (fallbackRes && fallbackRes.ok) {
        res = fallbackRes;
      }
    }

    // If Ollama native port 11434, fallback to /api/tags
    if (!res.ok && (rawBaseUrl.includes("11434") || rawBaseUrl.includes("localhost"))) {
      const ollamaEndpoint = `${rawBaseUrl.replace(/\/v1$/, "")}/api/tags`;
      const ollamaRes = await fetch(ollamaEndpoint, { method: "GET", signal: controller.signal }).catch(() => null);
      if (ollamaRes && ollamaRes.ok) {
        const ollamaData = await ollamaRes.json();
        if (Array.isArray(ollamaData.models)) {
          const models: string[] = ollamaData.models.map((m: any) => String(m.name || m.model || m || "")).filter(Boolean);
          if (models.length > 0) return Array.from(new Set(models)).sort();
        }
      }
    }

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`获取模型列表失败 (HTTP ${res.status}): ${err.slice(0, 150)}`);
    }

    const data = await res.json();
    let list: any[] = [];
    if (Array.isArray(data.data)) {
      list = data.data;
    } else if (Array.isArray(data.models)) {
      list = data.models;
    } else if (Array.isArray(data)) {
      list = data;
    }

    const models: string[] = list
      .map((m: any) => String(m.id || m.name || m || ""))
      .filter(Boolean);

    if (models.length === 0) {
      throw new Error("接口返回的数据中未包含模型标识 (id/name)");
    }

    return Array.from(new Set(models)).sort((a, b) => a.localeCompare(b));
  } catch (err: any) {
    if (err.name === "AbortError" || controller.signal.aborted) {
      throw new Error("获取模型列表超时 (超过 15 秒未响应)，请检查网络连接或接口地址");
    }
    throw err;
  } finally {
    clearTimeout(timeoutId);
  }
}

/**
 * 修复 LLM 返回的常见非标准 JSON 语法缺陷：
 * 1. 弯引号 / 全角引号替换
 * 2. 去除行尾或单行注释 // ...
 * 3. 去除多行注释
 * 4. 去除数组与对象尾部多余逗号 (Trailing Commas)
 * 5. 去除省略号 ...
 */
export function repairJSONString(str: string): string {
  let s = str.trim();

  // 替换全角/弯引号
  s = s.replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");

  // 移除整行或末尾的 JS 单行注释 (避免误伤 http:// 或 https://)
  s = s.replace(/(^|\n|\r)\s*\/\/[^\r\n]*/g, "$1");
  s = s.replace(/([0-9a-zA-Z"'\],\}])\s*\/\/(?!\/)[^\r\n]*/g, "$1");

  // 移除多行注释 /* ... */
  s = s.replace(/\/\*[\s\S]*?\*\//g, "");

  // 移除对象或数组末尾多余逗号
  s = s.replace(/,+(\s*[\]\}])/g, "$1");

  // 移除多余省略号 ...
  s = s.replace(/\.{3,}/g, "");

  return s;
}

/**
 * 鲁棒性 JSON 提取与解析器：
 * - 剥离 DeepSeek-R1 / QwQ 等推理模型的 <think>...</think> 标签
 * - 支持解析 Markdown ```json ``` 代码块
 * - 自动寻找最外层匹配的 { ... } 或 [ ... ] 边界
 * - 语法修复 (容错尾部逗号、注释等)
 * - 若 JSON 严重残缺或被截断，启用正则智能回退提取分类比例
 */
export function extractAndParseJSON<T = any>(rawContent: string): T {
  if (!rawContent || typeof rawContent !== "string") {
    throw new Error("AI 未返回任何文本内容");
  }

  // 1. 过滤思考标签 (<think>...</think> 或 <thought>...</thought>)
  let text = rawContent
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/<thought>[\s\S]*?<\/thought>/gi, "")
    .trim();

  if (!text) {
    // 若过滤后为空（例如模型未正常闭合思考标签），尝试在原文本中提取
    text = rawContent;
  }

  // 2. 优先匹配 Markdown 代码块 ```json ... ```
  const codeBlockMatch = text.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (codeBlockMatch && codeBlockMatch[1].trim()) {
    const inner = codeBlockMatch[1].trim();
    try {
      return JSON.parse(inner);
    } catch {
      try {
        return JSON.parse(repairJSONString(inner));
      } catch {
        // 继续向下尝试更宽容的提取
      }
    }
  }

  // 3. 寻找最外层的合法 JSON 边界（支持 {...} 或 [...]）
  const firstBrace = text.indexOf("{");
  const firstBracket = text.indexOf("[");

  let candidate = "";
  if (firstBrace !== -1 && (firstBracket === -1 || firstBrace < firstBracket)) {
    const lastBrace = text.lastIndexOf("}");
    if (lastBrace > firstBrace) {
      candidate = text.slice(firstBrace, lastBrace + 1);
    }
  } else if (firstBracket !== -1) {
    const lastBracket = text.lastIndexOf("]");
    if (lastBracket > firstBracket) {
      candidate = text.slice(firstBracket, lastBracket + 1);
    }
  }

  if (candidate) {
    try {
      return JSON.parse(candidate);
    } catch {
      try {
        return JSON.parse(repairJSONString(candidate));
      } catch {
        // 尝试解析整段修复文本
      }
    }
  }

  // 4. 尝试修复整段文本直接解析
  try {
    return JSON.parse(repairJSONString(text));
  } catch {
    // 无法直接 JSON.parse，尝试正则兜底提取
  }

  // 5. 模式回退提取：扫描类似 "name": "...", "ratio": 30 的结构
  const categoryRegex = /"name"\s*:\s*"([^"]+)"[\s\S]*?"(?:ratio|percentage)"\s*:\s*"?(\d+(?:\.\d+)?)%?"?/gi;
  const extractedCategories: Array<{ name: string; ratio: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = categoryRegex.exec(text)) !== null) {
    const name = match[1].trim();
    const ratio = parseFloat(match[2]);
    if (name && !isNaN(ratio)) {
      extractedCategories.push({ name, ratio });
    }
  }

  if (extractedCategories.length >= 2) {
    return {
      categories: extractedCategories,
      suggestedAction: "建议按上述比例分类并折叠为分组。",
    } as unknown as T;
  }

  // 6. 列表文本回退提取：扫描类似 "1. 💻 开发与技术 (35%)" 或 "- 影音娱乐: 20%"
  const bulletRegex = /(?:^|\n)\s*(?:[\d\.\-\*#]+)?\s*([^\n\:\(\)]{2,30}?)\s*[:：\(（]\s*(\d+(?:\.\d+)?)\s*[%％]/g;
  const bulletCategories: Array<{ name: string; ratio: number }> = [];
  while ((match = bulletRegex.exec(text)) !== null) {
    const name = match[1].trim().replace(/^[-*•\d\.\s]+/, "");
    const ratio = parseFloat(match[2]);
    if (name && !isNaN(ratio) && ratio > 0 && ratio <= 100) {
      bulletCategories.push({ name, ratio });
    }
  }

  if (bulletCategories.length >= 2) {
    return {
      categories: bulletCategories,
      suggestedAction: "建议按上述比例分类并折叠为分组。",
    } as unknown as T;
  }

  throw new Error(`AI 返回的内容中未找到有效 JSON (原始内容预览: ${rawContent.slice(0, 100).replace(/\s+/g, " ")}...)`);
}

/**
 * 智能标签特征摘要压缩引擎：
 * - 针对中小规模快照 (<= 100 标签)，输出详细指纹特征
 * - 针对超大规模快照 (> 100 标签)，按高频域名聚合并附带典型标题，降低 90% 提示词 Token 消耗，杜绝模型上下文超限与截断报错
 */
export function generateTabsSummary(tabs: SideberyTab[]): string {
  const nonExempt = tabs.filter((t) => !isExemptUrl(t.url, t.pinned));
  if (nonExempt.length === 0) return "[]";

  if (nonExempt.length <= 100) {
    return JSON.stringify(
      nonExempt.map((t) => ({
        id: String(t.id),
        domain: extractDomain(t.url),
        path: cleanUrlForAI(t.url),
        title: (t.title || "").slice(0, 45),
      })),
      null,
      1
    );
  }

  // 大规模标签聚合并统计高频域名
  const domainMap = new Map<string, { count: number; sampleTitles: Set<string> }>();
  for (const t of nonExempt) {
    const domain = extractDomain(t.url);
    const existing = domainMap.get(domain);
    const title = (t.title || "").trim();
    if (!existing) {
      const titles = new Set<string>();
      if (title) titles.add(title.slice(0, 40));
      domainMap.set(domain, { count: 1, sampleTitles: titles });
    } else {
      existing.count++;
      if (title && existing.sampleTitles.size < 3) {
        existing.sampleTitles.add(title.slice(0, 40));
      }
    }
  }

  const sortedDomains = Array.from(domainMap.entries()).sort((a, b) => b[1].count - a[1].count);

  // 针对超过 50 个独立域名的特大规模快照（如上千个标签），聚合长尾零散站点，大幅精简 Prompt 并杜绝模型超时
  const MAX_DETAILED_DOMAINS = 50;
  let domainSummary: Array<{ domain: string; tabCount: number; percentage: string; sampleTitles?: string[] }>;

  if (sortedDomains.length <= MAX_DETAILED_DOMAINS) {
    domainSummary = sortedDomains.map(([domain, data]) => ({
      domain,
      tabCount: data.count,
      percentage: `${((data.count / nonExempt.length) * 100).toFixed(1)}%`,
      sampleTitles: Array.from(data.sampleTitles),
    }));
  } else {
    const topDomains = sortedDomains.slice(0, MAX_DETAILED_DOMAINS);
    const tailDomains = sortedDomains.slice(MAX_DETAILED_DOMAINS);

    domainSummary = topDomains.map(([domain, data]) => ({
      domain,
      tabCount: data.count,
      percentage: `${((data.count / nonExempt.length) * 100).toFixed(1)}%`,
      sampleTitles: Array.from(data.sampleTitles),
    }));

    let tailCount = 0;
    const tailSamples: string[] = [];
    for (const [, data] of tailDomains) {
      tailCount += data.count;
      for (const st of data.sampleTitles) {
        if (tailSamples.length < 5) tailSamples.push(st);
      }
    }

    domainSummary.push({
      domain: `其他长尾零散站点 (共 ${tailDomains.length} 个独立网站)`,
      tabCount: tailCount,
      percentage: `${((tailCount / nonExempt.length) * 100).toFixed(1)}%`,
      sampleTitles: tailSamples.length > 0 ? tailSamples : undefined,
    });
  }

  return JSON.stringify(
    {
      totalTabs: nonExempt.length,
      domainDistribution: domainSummary,
    },
    null,
    1
  );
}

export async function analyzeTabProportions(
  tabs: SideberyTab[],
  config: AIConfig,
  onProgress?: (status: string) => void,
  customPrompt?: string
): Promise<ProportionReport> {
  onProgress?.("正在提取标签指纹并过滤固定与特殊页面...");

  const nonExemptTabs = tabs.filter((t) => !isExemptUrl(t.url, t.pinned));
  const excludedCount = tabs.length - nonExemptTabs.length;

  if (nonExemptTabs.length === 0) {
    throw new Error("没有可分析的有效标签页（所有标签均已被豁免保护或为空）。");
  }

  onProgress?.(`正在智能压缩与提炼 ${nonExemptTabs.length} 个标签特征指纹...`);

  const systemPrompt = "你是一个专业的浏览器标签页管理专家。必须严格返回合法的 JSON 格式，不要包含任何闲聊文本。";
  const promptTemplate = (customPrompt && customPrompt.trim()) ? customPrompt.trim() : DEFAULT_PROPORTION_ANALYSIS_PROMPT;
  const tabsJson = generateTabsSummary(nonExemptTabs);
  const userPrompt = promptTemplate.includes("{{tabsSummary}}")
    ? promptTemplate.replace("{{tabsSummary}}", tabsJson)
    : `${promptTemplate}\n\n${tabsJson}`;

  const resolvedModelName = resolveModel(config);
  onProgress?.(`已生成特征摘要，正在连接 AI 模型 (${resolvedModelName}) 分析归纳比例...`);

  const rawContent = await sendAIChatRequest(config, systemPrompt, userPrompt);

  onProgress?.("AI 响应完成，正在解析并校验分类结构...");

  let parsed: any;
  try {
    parsed = extractAndParseJSON(rawContent);
  } catch (err: any) {
    throw new Error(`无法解析 AI 返回的比例数据: ${err.message}`);
  }

  // 灵活提取各类返回外壳 (Array, { categories: [...] }, { data: [...] }, { proportions: [...] })
  let rawCategories: any[] = [];
  if (Array.isArray(parsed)) {
    rawCategories = parsed;
  } else if (Array.isArray(parsed?.categories)) {
    rawCategories = parsed.categories;
  } else if (Array.isArray(parsed?.data)) {
    rawCategories = parsed.data;
  } else if (Array.isArray(parsed?.proportions)) {
    rawCategories = parsed.proportions;
  } else if (parsed && typeof parsed === "object") {
    const entries = Object.entries(parsed).filter(
      ([k, v]) => k !== "suggestedAction" && (typeof v === "number" || typeof v === "string")
    );
    if (entries.length >= 2) {
      rawCategories = entries.map(([k, v]) => ({ name: k, ratio: v }));
    }
  }

  if (rawCategories.length === 0) {
    throw new Error("AI 返回的 JSON 中未包含有效的 categories 分类列表");
  }

  // 解析并归一化比例 (兼容 0.35 浮点小数、"30%" 字符串、整数等)
  let totalRatio = 0;
  const parsedItems = rawCategories.map((cat: any, i: number) => {
    let r = 0;
    if (typeof cat.ratio === "number") {
      r = cat.ratio;
    } else if (typeof cat.ratio === "string") {
      r = parseFloat(cat.ratio.replace(/%/, "")) || 0;
    } else if (typeof cat.percentage === "number") {
      r = cat.percentage;
    } else if (typeof cat.percentage === "string") {
      r = parseFloat(cat.percentage.replace(/%/, "")) || 0;
    }
    totalRatio += r;
    return { cat, r, i };
  });

  const isDecimal = totalRatio > 0 && totalRatio <= 1.05;
  const multiplier = isDecimal ? 100 : 1;

  const categories: CategoryProportion[] = parsedItems.map(({ cat, r, i }) => {
    const rawVal = r * multiplier;
    const finalRatio = totalRatio > 0 && !isDecimal && Math.abs(totalRatio - 100) > 5
      ? Math.round((rawVal / totalRatio) * 100)
      : Math.round(rawVal);

    return {
      id: `cat_${i}_${Date.now()}`,
      name: String(cat.name || `分类 ${i + 1}`).trim(),
      color: cat.color || PRESET_COLORS[i % PRESET_COLORS.length],
      ratio: finalRatio,
      targetRatio: finalRatio,
      description: cat.description || "",
      keywords: Array.isArray(cat.keywords) ? cat.keywords.map(String) : undefined,
      matchCount: 0,
    };
  });

  return {
    totalAnalyzed: nonExemptTabs.length,
    excludedCount,
    categories,
    suggestedAction: parsed.suggestedAction || "建议按上述比例分类并折叠为分组。",
  };
}

export async function classifyTabs(
  tabs: SideberyTab[],
  categories: CategoryProportion[],
  config: AIConfig,
  onProgress?: (current: number, total: number) => void
): Promise<Map<string, string>> {
  const result = new Map<string, string>();
  const nonExemptTabs = tabs.filter((t) => !isExemptUrl(t.url, t.pinned));

  const chunkSize = 60;
  const total = nonExemptTabs.length;
  const idToNameMap = new Map(categories.map((c) => [c.id, c.name]));
  const nameSet = new Set(categories.map((c) => c.name));

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = nonExemptTabs.slice(i, i + chunkSize);
    onProgress?.(Math.min(i + chunkSize, total), total);

    const chunkSummary = chunk.map((t) => ({
      id: String(t.id),
      domain: extractDomain(t.url),
      title: (t.title || "").slice(0, 45),
    }));

    const categoryList = categories.map((c) => ({ id: c.id, name: c.name }));

    const systemPrompt = "You are a classifier. Return strictly JSON mapping id to category id or name.";
    const userPrompt = `请将以下标签页分配至最匹配的类别。
可选类别：${JSON.stringify(categoryList)}

待分类标签列表：
${JSON.stringify(chunkSummary)}

返回格式必须为纯 JSON 键值对，键为标签 id，值为类别名称或类别 id：
{ "tabId1": "catIdA", "tabId2": "catIdB" }`;

    try {
      const content = await sendAIChatRequest(config, systemPrompt, userPrompt);
      const mapping = extractAndParseJSON<Record<string, any>>(content);
      if (mapping && typeof mapping === "object") {
        for (const [tabId, catVal] of Object.entries(mapping)) {
          const valStr = String(catVal);
          const resolvedName = idToNameMap.get(valStr) || (nameSet.has(valStr) ? valStr : "");
          if (resolvedName) {
            result.set(tabId, resolvedName);
          } else {
            // Find closest matching category
            const match = categories.find((c) => c.name.includes(valStr) || valStr.includes(c.name));
            result.set(tabId, match ? match.name : valStr);
          }
        }
      }
    } catch {
      // Continue next chunk on error
    }
  }

  return result;
}

/**
 * 依据分析得出的主题类别生成 Sidebery 匹配规则
 */
export async function generateRulesFromCategories(
  categories: CategoryProportion[],
  config: AIConfig,
  rulesGeneratorPrompt?: string
): Promise<CategorizationRule[]> {
  const systemPrompt = (rulesGeneratorPrompt && rulesGeneratorPrompt.trim())
    ? rulesGeneratorPrompt.trim()
    : DEFAULT_RULES_GENERATOR_PROMPT;

  const categoriesSummary = categories.map((c) => ({
    name: c.name,
    description: c.description || "",
    keywords: c.keywords || [],
    color: c.color,
  }));

  const userPrompt = `请根据以下标签分类的主题与特征说明，为每一个主题类别生成一份精确的 Sidebery 分类匹配规则：
${JSON.stringify(categoriesSummary, null, 2)}

要求：
1. 为每个类别提炼 5-10 个最常见、最具辨识度的高频域名（逗号分隔的 matchDomain 字符串）。
2. 为每个类别提炼 5-10 个最常见的关键标题词（逗号分隔的 matchKeyword 字符串）。
3. 分组名称保持与类别名称完全一致。
4. 返回格式必须为严格合法的 JSON 规则数组代码块：
\`\`\`json
[
  {
    "name": "类别名称",
    "matchDomain": "domain1.com, domain2.com",
    "matchKeyword": "kw1, kw2",
    "minThreshold": 2,
    "color": "#3b82f6",
    "scope": "all"
  }
]
\`\`\``;

  try {
    const rawContent = await sendAIChatRequest(config, systemPrompt, userPrompt);
    const parsed = extractAndParseJSON<any>(rawContent);
    const rulesArray: any[] = Array.isArray(parsed)
      ? parsed
      : Array.isArray(parsed?.rules)
      ? parsed.rules
      : [];

    if (rulesArray.length > 0) {
      return rulesArray.map((item, idx) => ({
        id: `ai_rule_${Date.now()}_${idx}`,
        name: String(item.name || categories[idx]?.name || `分类 ${idx + 1}`),
        enabled: true,
        scope: "all" as const,
        matchDomain: String(item.matchDomain || ""),
        matchKeyword: String(item.matchKeyword || ""),
        minThreshold: typeof item.minThreshold === "number" ? item.minThreshold : 2,
        color: item.color || categories[idx]?.color || PRESET_COLORS[idx % PRESET_COLORS.length],
      }));
    }
  } catch (err) {
    console.warn("AI 规则生成失败，将使用回退提取算法:", err);
  }

  // Fallback: Generate synthetic rules from category keywords & names
  return categories.map((cat, idx) => {
    const kw = (cat.keywords && cat.keywords.length > 0)
      ? cat.keywords.join(", ")
      : cat.name.replace(/[^\u4e00-\u9fa5a-zA-Z0-9]/g, " ").trim().split(/\s+/).join(", ");
    return {
      id: `ai_rule_${Date.now()}_${idx}`,
      name: cat.name,
      enabled: true,
      scope: "all" as const,
      matchDomain: "",
      matchKeyword: kw,
      minThreshold: 2,
      color: cat.color || PRESET_COLORS[idx % PRESET_COLORS.length],
    };
  });
}

/**
 * 复合分类器：支持先提炼生成规则进行快速精确匹配，再用 AI 对剩余未匹配标签归类
 */
export async function classifyTabsWithRulesOrAI(
  tabs: SideberyTab[],
  categories: CategoryProportion[],
  config: AIConfig,
  generateRulesFirst: boolean,
  rulesGeneratorPrompt?: string,
  onProgress?: (status: string, current: number, total: number) => void
): Promise<{
  classificationMap: Map<string, string>;
  generatedRules?: CategorizationRule[];
  matchedByRuleCount: number;
  matchedByAICount: number;
}> {
  const nonExemptTabs = tabs.filter((t) => !isExemptUrl(t.url, t.pinned));
  const total = nonExemptTabs.length;
  const classificationMap = new Map<string, string>();
  let generatedRules: CategorizationRule[] | undefined;
  let matchedByRuleCount = 0;
  let matchedByAICount = 0;

  if (generateRulesFirst) {
    onProgress?.("正在依据分析主题提炼并生成精准匹配规则...", 0, total);
    try {
      generatedRules = await generateRulesFromCategories(categories, config, rulesGeneratorPrompt);
    } catch {
      generatedRules = [];
    }

    // Step 2: match tabs using generated rules
    const unmatchedTabs: SideberyTab[] = [];
    for (const tab of nonExemptTabs) {
      let matched = false;
      for (const rule of generatedRules) {
        if (matchTabWithRule(tab, rule)) {
          // Normalize to matching category name
          const cat = categories.find(
            (c) => c.name === rule.name || rule.name.includes(c.name) || c.name.includes(rule.name)
          );
          classificationMap.set(String(tab.id), cat ? cat.name : rule.name);
          matched = true;
          matchedByRuleCount++;
          break;
        }
      }
      if (!matched) {
        unmatchedTabs.push(tab);
      }
    }

    onProgress?.(`规则引擎已匹配 ${matchedByRuleCount} 个标签，剩余 ${unmatchedTabs.length} 个未匹配标签...`, matchedByRuleCount, total);

    // Step 3: if there are unmatched tabs, classify with AI
    if (unmatchedTabs.length > 0) {
      onProgress?.(`正在对剩余 ${unmatchedTabs.length} 个未匹配标签调用 AI 语义分类...`, matchedByRuleCount, total);
      const aiMap = await classifyTabs(
        unmatchedTabs,
        categories,
        config,
        (cur, tot) => {
          onProgress?.(`AI 正在分类剩余标签 (${cur}/${tot})...`, matchedByRuleCount + cur, total);
        }
      );
      for (const [tabId, catName] of aiMap.entries()) {
        classificationMap.set(tabId, catName);
        matchedByAICount++;
      }
    }
  } else {
    // Pure AI classification
    onProgress?.("正在逐批调用 AI 进行标签全量分类...", 0, total);
    const aiMap = await classifyTabs(
      nonExemptTabs,
      categories,
      config,
      (cur, tot) => {
        onProgress?.(`AI 正在分类标签 (${cur}/${tot})...`, cur, tot);
      }
    );
    for (const [tabId, catName] of aiMap.entries()) {
      classificationMap.set(tabId, catName);
    }
    matchedByAICount = classificationMap.size;
  }

  return {
    classificationMap,
    generatedRules,
    matchedByRuleCount,
    matchedByAICount,
  };
}

/**
 * 依据指定分类（名称、描述、关键词标签或关联规则），通过 AI 语义匹配找出相似标签并返回匹配标签 ID 列表
 */
export async function findSimilarTabsForCategory(
  tabs: SideberyTab[],
  category: CategoryProportion,
  config: AIConfig,
  associatedRule?: CategorizationRule,
  onProgress?: (status: string, current: number, total: number) => void
): Promise<string[]> {
  const nonExemptTabs = tabs.filter((t) => !isExemptUrl(t.url, t.pinned));
  const matchedIds = new Set<string>();

  // 1. 若关联了规则，优先通过规则引擎进行秒级精确匹配
  if (associatedRule) {
    for (const tab of nonExemptTabs) {
      if (matchTabWithRule(tab, associatedRule)) {
        matchedIds.add(String(tab.id));
      }
    }
  }

  // 2. 将未被规则匹配的标签分批提交给 AI 进行语义相似度识别
  const remainingTabs = nonExemptTabs.filter((t) => !matchedIds.has(String(t.id)));
  if (remainingTabs.length === 0) {
    return Array.from(matchedIds);
  }

  const chunkSize = 60;
  const total = remainingTabs.length;

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = remainingTabs.slice(i, i + chunkSize);
    onProgress?.(`AI 正在语义检索相似标签 (${Math.min(i + chunkSize, total)}/${total})...`, i, total);

    const chunkSummary = chunk.map((t) => ({
      id: String(t.id),
      domain: extractDomain(t.url),
      title: (t.title || "").slice(0, 45),
    }));

    const systemPrompt = "你是一个高精度的浏览器标签页分类助手。请根据指定分类特征，从待选列表中筛选出语义高度相关的标签页。必须严格只返回纯 JSON 格式的字符串数组，包含匹配的标签 id，例如 [\"id1\", \"id2\"]。无匹配项请返回 []。";

    const userPrompt = `目标分类信息：
- 分类名称: "${category.name}"
- 描述说明: "${category.description || "无"}"
- 关联关键词/标签: "${(category.keywords || []).join(", ") || "无"}"
${associatedRule ? `- 关联规则: 域名[${associatedRule.matchDomain}], 标题关键字[${associatedRule.matchKeyword}]` : ""}

待判断标签页列表：
${JSON.stringify(chunkSummary)}

请仅返回属于该分类的标签 id 纯 JSON 数组：
["id1", "id2"]`;

    try {
      const response = await sendAIChatRequest(config, systemPrompt, userPrompt);
      const parsed = extractAndParseJSON<any>(response);
      const ids: any[] = Array.isArray(parsed)
        ? parsed
        : Array.isArray(parsed?.matchedIds)
        ? parsed.matchedIds
        : Array.isArray(parsed?.ids)
        ? parsed.ids
        : [];

      for (const item of ids) {
        if (item !== undefined && item !== null) {
          matchedIds.add(String(item));
        }
      }
    } catch {
      // 容错继续下一个 chunk
    }
  }

  return Array.from(matchedIds);
}
