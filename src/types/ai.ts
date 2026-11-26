import { SideberySnapshot, CategorizationRule } from "./sidebery";

export type BuiltinAIProviderKey = "deepseek" | "claude" | "openai" | "gemini";
export type AIProviderKey = BuiltinAIProviderKey | "custom" | (string & {});
export type AIProtocolType = "openai" | "anthropic" | "gemini";

export interface CustomAIProvider {
  id: string;
  name: string;
  type: AIProtocolType;
  baseUrl: string;
  model: string;
}

export interface AIProviderPreset {
  name: string;
  baseUrl: string;
  model: string;
  models: string[];
  type: AIProtocolType;
}

export const BUILTIN_PROVIDER_KEYS: BuiltinAIProviderKey[] = [
  "deepseek",
  "claude",
  "openai",
  "gemini",
];

export const AI_PROVIDERS: Record<string, AIProviderPreset> = {
  deepseek: {
    name: "DeepSeek",
    baseUrl: "https://api.deepseek.com/v1",
    model: "deepseek-flash",
    models: ["deepseek-flash", "deepseek-v4-pro"],
    type: "openai",
  },
  claude: {
    name: "Claude",
    baseUrl: "https://api.anthropic.com/v1",
    model: "claude-fable-5-1",
    models: [
      "claude-fable-5-1",
      "claude-opus-5-5",
      "claude-sonnet-5-5",
      "claude-haiku-5-5",
    ],
    type: "anthropic",
  },
  openai: {
    name: "OpenAI",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-6-astra",
    models: ["gpt-6-astra", "gpt-6.1-sol", "gpt-6-luna"],
    type: "openai",
  },
  gemini: {
    name: "Google Gemini",
    baseUrl: "https://generativelanguage.googleapis.com/v1beta",
    model: "gemini-3.8-flash",
    models: ["gemini-3.8-flash", "gemini-4-argon"],
    type: "gemini",
  },
  custom: {
    name: "自定义接口",
    baseUrl: "https://api.openai.com/v1",
    model: "gpt-4o-mini",
    models: [],
    type: "openai",
  },
};

export type AICallPreset = "eco" | "balanced" | "deep" | "custom";

export interface AICallSettings {
  preset: AICallPreset;
  temperature: number;
  maxTokens?: number;
  timeoutSeconds: number;
  maxHistoryTurns: number;
  minIntervalSeconds: number;
  dailyCallLimit: number;
}

export interface AIUsageStats {
  date: string;
  callsToday: number;
  totalCalls: number;
  promptTokensToday: number;
  completionTokensToday: number;
  lastCallAt?: number;
}

export interface AIConfig {
  provider: AIProviderKey;
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
  type?: AIProtocolType;
  callSettings?: AICallSettings;
  /**
   * 各 API 选项独立的密钥映射池（如 deepseek, claude, openai, gemini, custom_openai, custom_anthropic）
   */
  apiKeys?: Record<string, string>;
  /**
   * 各 API 选项独立的 Base URL 映射池
   */
  baseURLs?: Record<string, string>;
  /**
   * 各 API 选项独立选中的模型映射池
   */
  models?: Record<string, string>;
  /**
   * 各 API 选项置顶的常用模型列表映射池
   */
  pinnedModels?: Record<string, string[]>;
  /**
   * 各 API 选项最近拉取的可用模型缓存列表
   */
  cachedModels?: Record<string, string[]>;
  /**
   * 用户通过「+」自定义添加的供应商列表
   */
  customProviders?: CustomAIProvider[];
}

export interface AIDropdownSettings {
  visibleProviders: string[];
  maxDropdownModels: number;
}

export interface CategoryProportion {
  id: string;
  name: string;
  color: string;
  ratio: number; // percentage (0 - 100)
  targetRatio?: number;
  description: string;
  matchCount: number;
  keywords?: string[];
  associatedRuleId?: string;
}

export interface ProportionReport {
  totalAnalyzed: number;
  excludedCount: number;
  categories: CategoryProportion[];
  suggestedAction?: string;
}

export interface TabClassificationResult {
  tabId: string | number;
  categoryId: string;
  categoryName: string;
  confidence?: number;
}

export interface AIProcessedCache {
  originalSnapshot: SideberySnapshot;
  processedSnapshot: SideberySnapshot;
  timestamp: number;
  categoryNames: string[];
  classificationMap: Record<string, string>; // tabId -> categoryName
  generatedRules?: CategorizationRule[];
  summary: {
    total: number;
    categorizedCount: number;
    uncategorizedCount: number;
    categoryCounts: Record<string, number>;
  };
  targetMode: "tree" | "panel";
  targetPanelId?: string;
}

export type ClusterGranularity = "coarse" | "balanced" | "fine";

export type ClusterCohesionReason =
  | "group_subtree"
  | "tree_subtree"
  | "domain_path"
  | "semantic_topic"
  | "tail_misc";

export interface TabMicroCluster {
  id: string;
  labelHint: string;
  tabIds: string[];
  tabCount: number;
  domains: string[];
  sampleTitles: string[];
  sourcePanelIds: string[];
  sourcePanelNames: string[];
  cohesionReason: ClusterCohesionReason;
  keywords: string[];
}

export interface ClusterCompressionReport {
  totalTabs: number;
  nonExemptCount: number;
  exemptProtectedCount: number;
  granularity: ClusterGranularity;
  clusters: TabMicroCluster[];
  compressionRatio: number;
  emptyPanelNames: string[];
  activePanels: { id: string; name: string; count: number; pct: string }[];
  treeDepthDistribution: Record<number, number>;
}

export interface ReorganizationCategory {
  name: string;
  description?: string;
  clusterIds?: string[];
  matchDomains?: string[];
  matchKeywords?: string[];
  targetPanelId?: string;
  targetPanelName?: string;
  color?: string;
  createGroup?: boolean;
  estimatedCount?: number;
}

export interface ReorganizationScheme {
  id: string;
  name: string;
  strategy: string;
  tags?: string[];
  categories: ReorganizationCategory[];
  excludedClusterIds?: string[];
  granularity?: ClusterGranularity;
  pros?: string[];
  cons?: string[];
  targetMode?: "tree" | "panel";
}

export interface AIChatMessage {
  id: string;
  sender: "user" | "assistant" | "system";
  timestamp: number;
  text: string;
  schemes?: ReorganizationScheme[];
  clusterReport?: ClusterCompressionReport;
  appliedSchemeId?: string;
}

export interface AIChatSession {
  id: string;
  title: string;
  updatedAt: number;
  messages: AIChatMessage[];
}
