import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AIConfig, AI_PROVIDERS } from "@/types/ai";
import { CategorizationRule, RulesSettings } from "@/types/sidebery";
import { DEFAULT_RULES_SETTINGS } from "@/services/ruleEngine";
import { DomainMergeConfig, DEFAULT_DOMAIN_MERGE_CONFIG } from "@/services/domainMergeEngine";
import { AIPromptsConfig, DEFAULT_AI_PROMPTS } from "@/constants/aiPrompts";

export type AppPage = "workbench" | "process" | "rules" | "ai" | "settings";

export type AppTheme =
  | "park-light"
  | "park-dark"
  | "midnight"
  | "nord-snow-storm"
  | "rose-pine-dawn"
  | "nord-dark"
  | "catppuccin-mocha";

export type ProcessScope = "current" | "all" | "selected";

export interface UISettings {
  hideFileName: boolean;
  hideQuickTheme: boolean;
  hideEmptyPanels: boolean;
}

export const DEFAULT_UI_SETTINGS: UISettings = {
  hideFileName: false,
  hideQuickTheme: false,
  hideEmptyPanels: false,
};

export interface AIThresholds {
  minTabsPerGroup: number;
  maxCategories: number;
}

interface ConfigState {
  activePage: AppPage;
  theme: AppTheme;
  aiConfig: AIConfig;
  rulesSettings: RulesSettings;
  exemptPinned: boolean;
  exemptInternalPages: boolean;
  preserveSubtrees: boolean;
  cascadeSelectChildren: boolean;
  aiThresholds: AIThresholds;
  aiGenerateRulesFirst: boolean;

  // Process & Diff Scope Settings
  processScope: ProcessScope;
  selectedProcessPanelIds: string[];
  domainMergeConfig: DomainMergeConfig;
  aiPrompts: AIPromptsConfig;
  uiSettings: UISettings;
  setUISettings: (settings: Partial<UISettings>) => void;

  setActivePage: (page: AppPage) => void;
  setTheme: (theme: AppTheme) => void;
  setAIConfig: (config: Partial<AIConfig>) => void;
  setRulesSettings: (settings: Partial<RulesSettings>) => void;
  addRule: (rule: Omit<CategorizationRule, "id">) => void;
  updateRule: (id: string, rule: Partial<CategorizationRule>) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  importRulesJSON: (jsonString: string) => boolean;
  exportRulesJSON: () => string;

  setExemptPinned: (val: boolean) => void;
  setExemptInternalPages: (val: boolean) => void;
  setPreserveSubtrees: (val: boolean) => void;
  setCascadeSelectChildren: (val: boolean) => void;
  setAiThresholds: (thresholds: Partial<AIThresholds>) => void;
  setAiGenerateRulesFirst: (val: boolean) => void;

  setProcessScope: (scope: ProcessScope) => void;
  setSelectedProcessPanelIds: (panelIds: string[]) => void;
  setDomainMergeConfig: (config: Partial<DomainMergeConfig>) => void;
  setAIPrompt: (key: keyof AIPromptsConfig, prompt: string) => void;
  resetAIPrompt: (key: keyof AIPromptsConfig) => void;
  resetAllAIPrompts: () => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      activePage: "workbench",
      theme: "park-light",
      aiConfig: {
        provider: "deepseek",
        baseURL: AI_PROVIDERS.deepseek.baseUrl,
        apiKey: "",
        model: AI_PROVIDERS.deepseek.model,
        temperature: 0.2,
        type: AI_PROVIDERS.deepseek.type,
        apiKeys: {},
        baseURLs: {},
        models: {},
      },
      rulesSettings: DEFAULT_RULES_SETTINGS,
      exemptPinned: true,
      exemptInternalPages: true,
      preserveSubtrees: true,
      cascadeSelectChildren: true,
      aiThresholds: {
        minTabsPerGroup: 2,
        maxCategories: 6,
      },
      aiGenerateRulesFirst: true,
      processScope: "all",
      selectedProcessPanelIds: [],
      domainMergeConfig: DEFAULT_DOMAIN_MERGE_CONFIG,
      aiPrompts: DEFAULT_AI_PROMPTS,
      uiSettings: DEFAULT_UI_SETTINGS,
      setUISettings: (settings) => set((state) => ({ uiSettings: { ...state.uiSettings, ...settings } })),

      setActivePage: (page) => set({ activePage: page }),
      setTheme: (theme) => set({ theme }),

      setAIConfig: (config) =>
        set((state) => ({
          aiConfig: { ...state.aiConfig, ...config },
        })),

      setRulesSettings: (settings) =>
        set((state) => ({
          rulesSettings: { ...state.rulesSettings, ...settings },
        })),

      addRule: (newRuleData) =>
        set((state) => {
          const newRule: CategorizationRule = {
            ...newRuleData,
            id: `rule_${Date.now()}`,
          };
          return {
            rulesSettings: {
              ...state.rulesSettings,
              rules: [...state.rulesSettings.rules, newRule],
            },
          };
        }),

      updateRule: (id, partial) =>
        set((state) => ({
          rulesSettings: {
            ...state.rulesSettings,
            rules: state.rulesSettings.rules.map((r) => (r.id === id ? { ...r, ...partial } : r)),
          },
        })),

      deleteRule: (id) =>
        set((state) => ({
          rulesSettings: {
            ...state.rulesSettings,
            rules: state.rulesSettings.rules.filter((r) => r.id !== id),
          },
        })),

      toggleRule: (id) =>
        set((state) => ({
          rulesSettings: {
            ...state.rulesSettings,
            rules: state.rulesSettings.rules.map((r) => (r.id === id ? { ...r, enabled: !r.enabled } : r)),
          },
        })),

      importRulesJSON: (jsonString: string) => {
        try {
          const parsed = JSON.parse(jsonString);
          if (Array.isArray(parsed.rules)) {
            set({
              rulesSettings: {
                treatExistingGroupsAsUnit: parsed.treatExistingGroupsAsUnit ?? true,
                defaultMinThreshold: parsed.defaultMinThreshold ?? 2,
                rules: parsed.rules,
              },
            });
            return true;
          }
          return false;
        } catch {
          return false;
        }
      },

      exportRulesJSON: () => {
        return JSON.stringify(get().rulesSettings, null, 2);
      },

      setExemptPinned: (val) => set({ exemptPinned: val }),
      setExemptInternalPages: (val) => set({ exemptInternalPages: val }),
      setPreserveSubtrees: (val) => set({ preserveSubtrees: val }),
      setCascadeSelectChildren: (val) => set({ cascadeSelectChildren: val }),
      setAiThresholds: (thresholds) =>
        set((state) => ({
          aiThresholds: { ...state.aiThresholds, ...thresholds },
        })),
      setAiGenerateRulesFirst: (val) => set({ aiGenerateRulesFirst: val }),

      setProcessScope: (processScope) => set({ processScope }),
      setSelectedProcessPanelIds: (selectedProcessPanelIds) => set({ selectedProcessPanelIds }),
      setDomainMergeConfig: (config) =>
        set((state) => ({
          domainMergeConfig: { ...state.domainMergeConfig, ...config },
        })),
      setAIPrompt: (key, prompt) =>
        set((state) => ({
          aiPrompts: {
            ...(state.aiPrompts || DEFAULT_AI_PROMPTS),
            [key]: prompt,
          },
        })),
      resetAIPrompt: (key) =>
        set((state) => ({
          aiPrompts: {
            ...(state.aiPrompts || DEFAULT_AI_PROMPTS),
            [key]: DEFAULT_AI_PROMPTS[key],
          },
        })),
      resetAllAIPrompts: () =>
        set({
          aiPrompts: DEFAULT_AI_PROMPTS,
        }),
    }),
    {
      name: "snapripper_config_storage_v9",
      merge: (persistedState: any, currentState: any) => {
        const persistedAIConfig = persistedState?.aiConfig || {};
        const provider = persistedAIConfig.provider || currentState.aiConfig.provider;
        const type = persistedAIConfig.type || currentState.aiConfig.type;
        const slot = provider === "custom"
          ? (type === "anthropic" ? "custom_anthropic" : "custom_openai")
          : provider;

        const mergedApiKeys: Record<string, string> = {
          ...(persistedAIConfig.apiKeys || {}),
        };
        // 若旧存储中有全局 apiKey 但尚未记录进具体槽位，则进行平滑同步
        if (persistedAIConfig.apiKey && !mergedApiKeys[slot]) {
          mergedApiKeys[slot] = persistedAIConfig.apiKey;
        }

        const mergedBaseURLs: Record<string, string> = {
          ...(persistedAIConfig.baseURLs || {}),
        };
        // 彻底清除历史缓存中的假域名 api.custome.ai
        for (const k of Object.keys(mergedBaseURLs)) {
          if (mergedBaseURLs[k]?.includes("api.custome.ai")) {
            delete mergedBaseURLs[k];
          }
        }
        if (persistedAIConfig.baseURL && !persistedAIConfig.baseURL.includes("api.custome.ai") && !mergedBaseURLs[slot]) {
          mergedBaseURLs[slot] = persistedAIConfig.baseURL;
        }

        const mergedModels: Record<string, string> = {
          ...(persistedAIConfig.models || {}),
        };
        if (persistedAIConfig.model && !mergedModels[slot]) {
          mergedModels[slot] = persistedAIConfig.model;
        }

        const activeApiKey = mergedApiKeys[slot] ?? persistedAIConfig.apiKey ?? "";

        let activeBaseURL = mergedBaseURLs[slot] || persistedAIConfig.baseURL || "";
        if (!activeBaseURL || activeBaseURL.includes("api.custome.ai")) {
          activeBaseURL = provider === "custom"
            ? (type === "anthropic" ? "https://api.anthropic.com/v1" : "https://api.openai.com/v1")
            : (AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.baseUrl || currentState.aiConfig.baseURL);
        }

        let activeModel = mergedModels[slot] || persistedAIConfig.model || "";
        if (!activeModel || (provider === "custom" && activeModel === "deepseek-flash")) {
          activeModel = provider === "custom"
            ? (type === "anthropic" ? "claude-3-7-sonnet-20250219" : "gpt-4o-mini")
            : (AI_PROVIDERS[provider as keyof typeof AI_PROVIDERS]?.model || currentState.aiConfig.model);
        }

        return {
          ...currentState,
          ...persistedState,
          aiConfig: {
            ...currentState.aiConfig,
            ...persistedAIConfig,
            apiKey: activeApiKey,
            baseURL: activeBaseURL,
            model: activeModel,
            apiKeys: mergedApiKeys,
            baseURLs: mergedBaseURLs,
            models: mergedModels,
          },
          aiGenerateRulesFirst: persistedState?.aiGenerateRulesFirst ?? true,
          uiSettings: {
            ...DEFAULT_UI_SETTINGS,
            ...(persistedState?.uiSettings || {}),
          },
          aiPrompts: {
            proportionAnalysisPrompt:
              persistedState?.aiPrompts?.proportionAnalysisPrompt ||
              DEFAULT_AI_PROMPTS.proportionAnalysisPrompt,
            rulesGeneratorPrompt:
              persistedState?.aiPrompts?.rulesGeneratorPrompt ||
              DEFAULT_AI_PROMPTS.rulesGeneratorPrompt,
          },
        };
      },
    }
  )
);
