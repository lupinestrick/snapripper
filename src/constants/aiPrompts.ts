/**
 * 默认 AI 提示词配置文件 (Default AI Prompt Presets)
 * ==============================================================================
 * 本文件集中管理项目中两个 AI 应用特性的默认提示词模板。
 * 您可直接在此文件中修改初始默认提示词，系统设置中也支持随时“恢复默认”。
 * ==============================================================================
 */

export interface AIPromptsConfig {
  /** 1. AI 标签比例分析与智能归纳提示词 */
  proportionAnalysisPrompt: string;
  /** 2. AI 智能生成分类规则助手系统提示词 */
  rulesGeneratorPrompt: string;
}

/**
 * 【特性 1：AI 标签比例分析与智能归纳】
 * ------------------------------------------------------------------------------
 * 适用场景：在「AI 比例」页面分析全部标签页的主题分布。
 * 变量说明：
 * - {{tabsSummary}}：会被自动替换为当前标签页指纹摘要（包含 id、域名 domain、路径 path、标题 title）。
 *   若提示词中未包含此占位符，系统会在提示词末尾自动追加标签列表。
 */
export const DEFAULT_PROPORTION_ANALYSIS_PROMPT = `以下是用户的浏览器标签页列表摘要（包含 id、域名 domain、路径 path、标题 title）：

{{tabsSummary}}

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

必须严格返回如下合法的 JSON 格式：
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

/**
 * 【特性 2：AI 智能生成分类规则助手】
 * ------------------------------------------------------------------------------
 * 适用场景：在「规则管理」页面点击“AI 生成”弹窗后，与 AI 对话提炼分类规则。
 * 作用：作为 System Prompt，指导 AI 输出符合 Sidebery 规则引擎规范的 JSON 规则数组。
 */
export const DEFAULT_RULES_GENERATOR_PROMPT = `你是一个 Sidebery 标签页分类规则生成专家。
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

/** 全局默认提示词对象 */
export const DEFAULT_AI_PROMPTS: AIPromptsConfig = {
  proportionAnalysisPrompt: DEFAULT_PROPORTION_ANALYSIS_PROMPT,
  rulesGeneratorPrompt: DEFAULT_RULES_GENERATOR_PROMPT,
};
