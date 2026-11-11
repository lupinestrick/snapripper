import { AIConfig, CategoryProportion, ProportionReport, AI_PROVIDERS, AIProviderKey } from "@/types/ai";
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
 * 统一多协议模型通信驱动 (OpenAI, Anthropic Claude, Google Gemini)
 */
export async function sendAIChatRequest(
  config: AIConfig,
  systemPrompt: string,
  userPrompt: string
): Promise<string> {
  const providerDef = AI_PROVIDERS[config.provider] || AI_PROVIDERS.custom;
  const protocol = config.type || providerDef.type || "openai";
  const apiKey = (config.apiKey || "").trim();
  const model = config.model || providerDef.model;
  const baseUrl = (config.baseURL || providerDef.baseUrl).trim().replace(/\/+$/, "");

  // 1. Anthropic Claude Protocol
  if (protocol === "anthropic") {
    const endpoint = baseUrl.endsWith("/messages") ? baseUrl : `${baseUrl}/messages`;
    const res = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "dangerously-allow-browser": "true",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
        temperature: config.temperature ?? 0.2,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(`Claude API 错误 (HTTP ${res.status}): ${errText.slice(0, 200)}`);
    }

    const data = await res.json();
    return data.content?.[0]?.text || "";
  }

  // 2. Google Gemini Protocol
  if (protocol === "gemini") {
    const isNativeGemini = baseUrl.includes("generativelanguage.googleapis.com");
    if (isNativeGemini) {
      const endpoint = `${baseUrl}/models/${model}:generateContent?key=${apiKey}`;
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
      });

      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        throw new Error(`Gemini API 错误 (HTTP ${res.status}): ${errText.slice(0, 200)}`);
      }

      const data = await res.json();
      return data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    }
  }

  // 3. OpenAI Compatible Protocol (DeepSeek, OpenAI, Custom, etc.)
  let endpoint = baseUrl;
  if (!endpoint.endsWith("/chat/completions")) {
    endpoint = endpoint.endsWith("/v1") ? `${endpoint}/chat/completions` : `${endpoint}/v1/chat/completions`;
  }

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt },
      ],
      temperature: config.temperature ?? 0.2,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`AI 服务响应错误 (HTTP ${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  return data.choices?.[0]?.message?.content || "";
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
  const apiKey = (config.apiKey || "").trim();
  const rawBaseUrl = (config.baseURL || providerDef.baseUrl).trim().replace(/\/+$/, "");

  if (!rawBaseUrl) {
    throw new Error("请先填写有效的 API Base URL");
  }

  // 1. Anthropic Claude Protocol
  if (protocol === "anthropic") {
    let endpoint = rawBaseUrl;
    if (endpoint.endsWith("/messages")) {
      endpoint = endpoint.replace(/\/messages$/, "/models");
    } else if (!endpoint.endsWith("/models")) {
      endpoint = `${endpoint}/models`;
    }

    const res = await fetch(endpoint, {
      method: "GET",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "dangerously-allow-browser": "true",
      },
    });

    if (!res.ok) {
      const err = await res.text().catch(() => "");
      throw new Error(`获取 Claude 模型列表失败 (HTTP ${res.status}): ${err.slice(0, 150)}`);
    }

    const data = await res.json();
    const list = Array.isArray(data.data) ? data.data : Array.isArray(data) ? data : [];
    const models: string[] = list.map((m: any) => String(m.id || m.name || m || "")).filter(Boolean);
    if (models.length > 0) return Array.from(new Set(models)).sort();
    throw new Error("未解析到有效的 Claude 模型列表");
  }

  // 2. Google Gemini Protocol
  if (protocol === "gemini") {
    const isNativeGemini = rawBaseUrl.includes("generativelanguage.googleapis.com");
    if (isNativeGemini) {
      const endpoint = `${rawBaseUrl}/models?key=${apiKey}`;
      const res = await fetch(endpoint, { method: "GET" });
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
  let endpoint = rawBaseUrl;
  if (endpoint.endsWith("/chat/completions")) {
    endpoint = endpoint.replace(/\/chat\/completions$/, "/models");
  } else if (!endpoint.endsWith("/models")) {
    endpoint = `${endpoint}/models`;
  }

  const headers: Record<string, string> = {};
  if (apiKey) {
    headers["Authorization"] = `Bearer ${apiKey}`;
  }

  let res = await fetch(endpoint, { method: "GET", headers });

  // If 404, try ${rawBaseUrl}/v1/models if endpoint wasn't /v1/models
  if (!res.ok && res.status === 404 && !endpoint.includes("/v1/models")) {
    const fallbackEndpoint = `${rawBaseUrl}/v1/models`;
    const fallbackRes = await fetch(fallbackEndpoint, { method: "GET", headers }).catch(() => null);
    if (fallbackRes && fallbackRes.ok) {
      res = fallbackRes;
    }
  }

  // If Ollama native port 11434, fallback to /api/tags
  if (!res.ok && (rawBaseUrl.includes("11434") || rawBaseUrl.includes("localhost"))) {
    const ollamaEndpoint = `${rawBaseUrl.replace(/\/v1$/, "")}/api/tags`;
    const ollamaRes = await fetch(ollamaEndpoint, { method: "GET" }).catch(() => null);
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

  const tabFingerprints = nonExemptTabs.map((t) => ({
    id: String(t.id),
    domain: extractDomain(t.url),
    path: cleanUrlForAI(t.url),
    title: (t.title || "").slice(0, 45),
  }));

  onProgress?.(`正在发送 ${nonExemptTabs.length} 个标签特征至 AI 分析比例...`);

  const systemPrompt = "你是一个专业的浏览器标签页管理专家。必须严格返回合法的 JSON 格式，不要包含任何闲聊文本。";
  const promptTemplate = (customPrompt && customPrompt.trim()) ? customPrompt.trim() : DEFAULT_PROPORTION_ANALYSIS_PROMPT;
  const tabsJson = JSON.stringify(tabFingerprints, null, 1);
  const userPrompt = promptTemplate.includes("{{tabsSummary}}")
    ? promptTemplate.replace("{{tabsSummary}}", tabsJson)
    : `${promptTemplate}\n\n${tabsJson}`;

  const rawContent = await sendAIChatRequest(config, systemPrompt, userPrompt);

  let parsed: any;
  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI 返回的内容中未找到有效 JSON");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err: any) {
    throw new Error(`无法解析 AI 返回的比例数据: ${err.message}`);
  }

  const categories: CategoryProportion[] = (parsed.categories || []).map((cat: any, i: number) => ({
    id: `cat_${i}_${Date.now()}`,
    name: cat.name || `分类 ${i + 1}`,
    color: PRESET_COLORS[i % PRESET_COLORS.length],
    ratio: typeof cat.ratio === "number" ? cat.ratio : 0,
    targetRatio: typeof cat.ratio === "number" ? cat.ratio : 0,
    description: cat.description || "",
    matchCount: 0,
  }));

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
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        const mapping = JSON.parse(jsonMatch[0]);
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
    let parsed: any[] = [];
    const jsonBlockMatch = rawContent.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (jsonBlockMatch) {
      parsed = JSON.parse(jsonBlockMatch[1]);
    } else {
      const arrayMatch = rawContent.match(/\[[\s\S]*\]/);
      if (arrayMatch) {
        parsed = JSON.parse(arrayMatch[0]);
      }
    }

    if (Array.isArray(parsed) && parsed.length > 0) {
      return parsed.map((item, idx) => ({
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
