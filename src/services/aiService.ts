import { AIConfig, CategoryProportion, ProportionReport, TabClassificationResult } from "@/types/ai";
import { SideberyTab } from "@/types/sidebery";
import { cleanUrlForAI, extractDomain, isExemptUrl } from "@/utils/urlHelper";

const PRESET_COLORS = [
  "#2563eb", // blue
  "#16a34a", // green
  "#d97706", // amber
  "#dc2626", // red
  "#0891b2", // cyan
  "#4f46e5", // indigo
  "#059669", // emerald
  "#ea580c", // orange
  "#475569", // slate
];

function normalizeChatUrl(baseURL: string): string {
  let url = baseURL.trim().replace(/\/+$/, "");
  if (url.endsWith("/chat/completions")) return url;
  if (url.endsWith("/v1")) return `${url}/chat/completions`;
  return `${url}/v1/chat/completions`;
}

export async function testAIConnection(config: AIConfig): Promise<{ success: boolean; message: string }> {
  try {
    const endpoint = normalizeChatUrl(config.baseURL || "https://api.openai.com/v1");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (config.apiKey) {
      headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;
    }

    const res = await fetch(endpoint, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model: config.model || "gpt-4o-mini",
        messages: [{ role: "user", content: "Respond with only the word OK" }],
        max_tokens: 10,
      }),
    });

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      return {
        success: false,
        message: `HTTP ${res.status}: ${errText.substring(0, 150) || res.statusText}`,
      };
    }

    return { success: true, message: "连接成功！AI 接口响应正常。" };
  } catch (err: any) {
    return { success: false, message: `网络连接失败: ${err.message || "无法访问指定端点"}` };
  }
}

export async function analyzeTabProportions(
  tabs: SideberyTab[],
  config: AIConfig,
  onProgress?: (status: string) => void
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

  const prompt = `你是一个专业的浏览器标签页整理专家。
以下是用户的浏览器标签页列表摘要（包含 id、域名 domain、路径 path、标题 title）：

${JSON.stringify(tabFingerprints, null, 1)}

请分析这批标签页的主题，归纳出 4 到 8 个高层次、互斥且覆盖全面的分类主题，并计算每个分类在当前标签库中的占比（比例总和必须为 100%）。

必须严格按照以下 JSON 格式返回，切勿包含任何 markdown 代码块外部的闲聊文本：
{
  "categories": [
    {
      "name": "类别名称（如：前端开发与工程、音视频娱乐、学术研究、购物消费、日常工具等）",
      "ratio": 35,
      "description": "简要说明该类别涵盖的网页特征",
      "keywords": ["关键词1", "关键词2"]
    }
  ],
  "suggestedAction": "简短的整理建议"
}`;

  const endpoint = normalizeChatUrl(config.baseURL || "https://api.openai.com/v1");
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (config.apiKey) {
    headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model: config.model || "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: "You are an intelligent data categorizer. Return strictly valid JSON only.",
        },
        { role: "user", content: prompt },
      ],
      temperature: 0.2,
    }),
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(`AI 服务响应错误 (HTTP ${res.status}): ${errText.slice(0, 200)}`);
  }

  const data = await res.json();
  const rawContent = data.choices?.[0]?.message?.content || "";

  let parsed: any;
  try {
    const jsonMatch = rawContent.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("AI 返回的内容中未找到有效 JSON");
    parsed = JSON.parse(jsonMatch[0]);
  } catch (err: any) {
    throw new Error(`无法解析 AI 返回的比例数据: ${err.message}`);
  }

  const categories: CategoryProportion[] = (parsed.categories || []).map((cat: any, i: number) => ({
    id: `cat_${i + 1}`,
    name: cat.name || `分类 ${i + 1}`,
    color: PRESET_COLORS[i % PRESET_COLORS.length],
    ratio: Math.round(Number(cat.ratio) || 0),
    description: cat.description || "",
    keywords: cat.keywords || [],
    matchCount: Math.round((Number(cat.ratio) / 100) * nonExemptTabs.length),
  }));

  const currentSum = categories.reduce((sum, c) => sum + c.ratio, 0);
  if (currentSum > 0 && currentSum !== 100 && categories.length > 0) {
    categories[0].ratio += 100 - currentSum;
  }

  return {
    totalAnalyzed: nonExemptTabs.length,
    excludedCount,
    categories,
    suggestedAction: parsed.suggestedAction,
  };
}

export async function classifyTabs(
  tabs: SideberyTab[],
  categories: CategoryProportion[],
  config: AIConfig,
  onProgress?: (processed: number, total: number) => void
): Promise<Map<string, string>> {
  const nonExemptTabs = tabs.filter((t) => !isExemptUrl(t.url, t.pinned));
  const categoryNames = categories.map((c) => c.name);
  const resultMap = new Map<string, string>();

  const CHUNK_SIZE = 60;
  const chunks: SideberyTab[][] = [];
  for (let i = 0; i < nonExemptTabs.length; i += CHUNK_SIZE) {
    chunks.push(nonExemptTabs.slice(i, i + CHUNK_SIZE));
  }

  let processedCount = 0;
  onProgress?.(0, nonExemptTabs.length);

  for (const chunk of chunks) {
    const batchInput = chunk.map((t) => ({
      id: String(t.id),
      d: extractDomain(t.url),
      t: (t.title || "").slice(0, 40),
    }));

    const prompt = `可选类别列表:
${JSON.stringify(categoryNames)}

请将以下标签页分配至最匹配的上述类别之一：
${JSON.stringify(batchInput)}

严格返回纯 JSON 数组，每个对象形如 {"id": "标签ID", "c": "匹配的类别名称"}:
[{"id": "...", "c": "..."}]`;

    const endpoint = normalizeChatUrl(config.baseURL || "https://api.openai.com/v1");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model || "gpt-4o-mini",
          messages: [{ role: "user", content: prompt }],
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const json = await res.json();
        const content = json.choices?.[0]?.message?.content || "";
        const match = content.match(/\[[\s\S]*\]/);
        if (match) {
          const assignments = JSON.parse(match[0]);
          for (const item of assignments) {
            if (item.id && item.c) {
              resultMap.set(String(item.id), String(item.c));
            }
          }
        }
      }
    } catch {
      // Continue gracefully on chunk error
    }

    processedCount += chunk.length;
    onProgress?.(processedCount, nonExemptTabs.length);
  }

  return resultMap;
}
