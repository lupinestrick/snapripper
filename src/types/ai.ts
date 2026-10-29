export interface AIConfig {
  provider: "openai" | "ollama" | "gemini" | "custom";
  baseURL: string;
  apiKey: string;
  model: string;
  temperature?: number;
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
