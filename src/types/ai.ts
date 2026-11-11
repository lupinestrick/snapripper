import { SideberySnapshot, CategorizationRule } from "./sidebery";

export type AIProviderKey = "deepseek" | "claude" | "openai" | "gemini" | "custom";
export type AIProtocolType = "openai" | "anthropic" | "gemini";

export interface AIProviderPreset {
  name: string;
  baseUrl: string;
  model: string;
  models: string[];
  type: AIProtocolType;
}

export const AI_PROVIDERS: Record<AIProviderKey, AIProviderPreset> = {
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
    baseUrl: "https://api.custome.ai/v1",
    model: "deepseek-flash",
    models: [],
    type: "openai",
  },
};

export interface AIConfig {
  provider: AIProviderKey;
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
  type?: AIProtocolType;
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
