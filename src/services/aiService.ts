import { AIConfig, CategoryProportion, ProportionReport, TabClassificationResult } from "@/types/ai";
import { SideberyTab } from "@/types/sidebery";
import { cleanUrlForAI, extractDomain, isExemptUrl } from "@/utils/urlHelper";

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

export const pingAIEndpoint = testAIConnection;

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

  const prompt = `你是一个专业的浏览器标签页管理专家。
以下是用户的浏览器标签页列表摘要（包含 id、域名 domain、路径 path、标题 title）：

${JSON.stringify(tabFingerprints, null, 1)}

请依据互联网主流用户的通用日常浏览与生产力习惯，对这批标签页进行语义分析，归纳出 4 到 8 个高层次、清晰且互斥的主题类别，并计算每个分类在当前标签库中的占比（各比例相加总和必须为 100%）。

分类建议参考互联网公认的标准习惯体系：
- 💻 开发与技术 (Dev & Engineering)
- 🤖 AI 与大模型 (AI & LLMs)
- 🎬 影音与流媒体 (Media & Entertainment)
- 💬 社交与社区 (Social & Community)
- 📚 知识库与学术研究 (Research & Knowledge)
- 💼 办公协作与文档 (Productivity & Work)
- 🛒 电商与生活消费 (Shopping & Life)
- 📰 科技与新闻资讯 (News & Feeds)
- 🎨 设计与创意灵感 (Design & Inspiration)
（若有其他突出的垂直领域，如特定同人资源、游戏攻略等，也可单独归纳为专属类别）

必须严格返回如下合法的 JSON 格式，不要包含任何额外的问候或闲聊内容：
{
  "categories": [
    {
      "name": "类别名称（例如：💻 开发与技术）",
      "ratio": 30,
      "description": "涵盖的网站特征说明",
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

  for (let i = 0; i < total; i += chunkSize) {
    const chunk = nonExemptTabs.slice(i, i + chunkSize);
    onProgress?.(Math.min(i + chunkSize, total), total);

    const chunkSummary = chunk.map((t) => ({
      id: String(t.id),
      domain: extractDomain(t.url),
      title: (t.title || "").slice(0, 45),
    }));

    const categoryList = categories.map((c) => ({ id: c.id, name: c.name }));

    const prompt = `请将以下标签页分配至最匹配的类别。
可选类别：${JSON.stringify(categoryList)}

待分类标签列表：
${JSON.stringify(chunkSummary)}

返回格式必须为纯 JSON 键值对，键为标签 id，值为类别 id：
{ "tabId1": "catIdA", "tabId2": "catIdB" }`;

    const endpoint = normalizeChatUrl(config.baseURL || "https://api.openai.com/v1");
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (config.apiKey) headers["Authorization"] = `Bearer ${config.apiKey.trim()}`;

    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers,
        body: JSON.stringify({
          model: config.model || "gpt-4o-mini",
          messages: [
            { role: "system", content: "You are a classifier. Return strictly JSON mapping id to category id." },
            { role: "user", content: prompt },
          ],
          temperature: 0.1,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const content = data.choices?.[0]?.message?.content || "";
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const mapping = JSON.parse(jsonMatch[0]);
          for (const [tabId, catId] of Object.entries(mapping)) {
            result.set(tabId, String(catId));
          }
        }
      }
    } catch {
      // Continue next chunk on error
    }
  }

  return result;
}
