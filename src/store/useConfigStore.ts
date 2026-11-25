import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AIConfig, AI_PROVIDERS, AIProviderKey, AIProtocolType, AIDropdownSettings, CustomAIProvider } from "@/types/ai";
import { getAPIKeySlot, getProviderMeta } from "@/services/aiService";
import { CategorizationRule, RulesSettings } from "@/types/sidebery";
import { DEFAULT_RULES_SETTINGS } from "@/services/ruleEngine";
import { DomainMergeConfig, DEFAULT_DOMAIN_MERGE_CONFIG } from "@/services/domainMergeEngine";
import { AIPromptsConfig, DEFAULT_AI_PROMPTS } from "@/constants/aiPrompts";

import { AppTheme } from "@/constants/themes";

export type { AppTheme };
export type AppPage = "workbench" | "process" | "rules" | "ai" | "settings";

export type ProcessScope = "current" | "all" | "selected";

export type WorkbenchPanelLayout = "vertical" | "horizontal" | "dropdown";

export interface UISettings {
  hideFileName: boolean;
  hideQuickTheme: boolean;
  hideEmptyPanels: boolean;
  workbenchPanelLayout?: WorkbenchPanelLayout;
}

export const DEFAULT_UI_SETTINGS: UISettings = {
  hideFileName: false,
  hideQuickTheme: false,
  hideEmptyPanels: false,
  workbenchPanelLayout: "vertical",
};

export const DEFAULT_AI_DROPDOWN_SETTINGS: AIDropdownSettings = {
  visibleProviders: ["deepseek", "claude", "openai", "gemini"],
  maxDropdownModels: 8,
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
  crossPanelMerge: boolean;
  createGroupTabs: boolean;

  // Process & Diff Scope Settings
  processScope: ProcessScope;
  selectedProcessPanelIds: string[];
  domainMergeConfig: DomainMergeConfig;
  aiPrompts: AIPromptsConfig;
  uiSettings: UISettings;
  aiDropdownSettings: AIDropdownSettings;
  setUISettings: (settings: Partial<UISettings>) => void;
  setAIDropdownSettings: (settings: Partial<AIDropdownSettings>) => void;
  togglePinnedModel: (slot: string, modelName: string) => void;
  switchAIProvider: (key: AIProviderKey, protocolOverride?: AIProtocolType) => void;
  addCustomProvider: (provider: Omit<CustomAIProvider, "id">, apiKey?: string) => string;
  updateCustomProvider: (id: string, partial: Partial<CustomAIProvider>) => void;
  deleteCustomProvider: (id: string) => void;

  setActivePage: (page: AppPage) => void;
  setTheme: (theme: AppTheme) => void;
  setAIConfig: (config: Partial<AIConfig>) => void;
  setRulesSettings: (settings: Partial<RulesSettings>) => void;
  addRule: (rule: Omit<CategorizationRule, "id">) => void;
  updateRule: (id: string, rule: Partial<CategorizationRule>) => void;
  deleteRule: (id: string) => void;
  toggleRule: (id: string) => void;
  reorderRules: (fromIndex: number, toIndex: number) => void;
  importRulesJSON: (jsonString: string) => boolean;
  exportRulesJSON: () => string;

  setExemptPinned: (val: boolean) => void;
  setExemptInternalPages: (val: boolean) => void;
  setPreserveSubtrees: (val: boolean) => void;
  setCascadeSelectChildren: (val: boolean) => void;
  setAiThresholds: (thresholds: Partial<AIThresholds>) => void;
  setAiGenerateRulesFirst: (val: boolean) => void;
  setCrossPanelMerge: (val: boolean) => void;
  setCreateGroupTabs: (val: boolean) => void;

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
      crossPanelMerge: true,
      createGroupTabs: true,
      processScope: "all",
      selectedProcessPanelIds: [],
      domainMergeConfig: DEFAULT_DOMAIN_MERGE_CONFIG,
      aiPrompts: DEFAULT_AI_PROMPTS,
      uiSettings: DEFAULT_UI_SETTINGS,
      aiDropdownSettings: DEFAULT_AI_DROPDOWN_SETTINGS,
      setUISettings: (settings) => set((state) => ({ uiSettings: { ...state.uiSettings, ...settings } })),
      setAIDropdownSettings: (settings) =>
        set((state) => ({
          aiDropdownSettings: {
            ...(state.aiDropdownSettings || DEFAULT_AI_DROPDOWN_SETTINGS),
            ...settings,
          },
        })),

      togglePinnedModel: (slot, modelName) =>
        set((state) => {
          const cleanName = modelName.trim();
          if (!cleanName) return state;
          const currentMap = state.aiConfig.pinnedModels || {};
          const existing = currentMap[slot] || [];
          const exists = existing.includes(cleanName);
          const nextList = exists
            ? existing.filter((m) => m !== cleanName)
            : [cleanName, ...existing];
          return {
            aiConfig: {
              ...state.aiConfig,
              pinnedModels: {
                ...currentMap,
                [slot]: nextList,
              },
            },
          };
        }),

      switchAIProvider: (key, protocolOverride) =>
        set((state) => {
          const aiConfig = state.aiConfig;
          const currentSlot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
          const apiKeysPool = { ...(aiConfig.apiKeys || {}), [currentSlot]: aiConfig.apiKey };
          const baseURLsPool = { ...(aiConfig.baseURLs || {}), [currentSlot]: aiConfig.baseURL };
          const modelsPool = { ...(aiConfig.models || {}), [currentSlot]: aiConfig.model };

          const meta = getProviderMeta(aiConfig, key);
          const newType =
            key === "custom"
              ? protocolOverride || (aiConfig.type === "anthropic" ? "anthropic" : "openai")
              : meta.type;
          const targetSlot = getAPIKeySlot(key, newType);
          const targetKey = apiKeysPool[targetSlot] || "";

          let targetBaseURL = meta.baseUrl;
          if (key === "custom") {
            const savedCustomUrl = baseURLsPool[targetSlot];
            if (savedCustomUrl && !savedCustomUrl.includes("api.custome.ai")) {
              targetBaseURL = savedCustomUrl;
            } else {
              targetBaseURL =
                newType === "anthropic"
                  ? "https://api.anthropic.com/v1"
                  : "https://api.openai.com/v1";
            }
          } else if (baseURLsPool[targetSlot]) {
            targetBaseURL = baseURLsPool[targetSlot];
          }

          let targetModel = meta.model;
          if (key === "custom") {
            const savedCustomModel = modelsPool[targetSlot];
            if (savedCustomModel && savedCustomModel !== "deepseek-flash") {
              targetModel = savedCustomModel;
            } else {
              targetModel =
                newType === "anthropic" ? "claude-3-7-sonnet-20250219" : "gpt-4o-mini";
            }
          } else if (modelsPool[targetSlot]) {
            targetModel = modelsPool[targetSlot];
          }

          baseURLsPool[targetSlot] = targetBaseURL;
          modelsPool[targetSlot] = targetModel;
          apiKeysPool[targetSlot] = targetKey;

          return {
            aiConfig: {
              ...aiConfig,
              provider: key,
              type: newType,
              baseURL: targetBaseURL,
              model: targetModel,
              apiKey: targetKey,
              apiKeys: apiKeysPool,
              baseURLs: baseURLsPool,
              models: modelsPool,
            },
          };
        }),

      addCustomProvider: (providerData, apiKey = "") => {
        const id = `custom_${Date.now()}`;
        set((state) => {
          const aiConfig = state.aiConfig;
          const currentSlot = getAPIKeySlot(aiConfig.provider, aiConfig.type);
          const apiKeysPool = { ...(aiConfig.apiKeys || {}), [currentSlot]: aiConfig.apiKey, [id]: apiKey.trim() };
          const baseURLsPool = { ...(aiConfig.baseURLs || {}), [currentSlot]: aiConfig.baseURL, [id]: providerData.baseUrl.trim() };
          const modelsPool = { ...(aiConfig.models || {}), [currentSlot]: aiConfig.model, [id]: providerData.model.trim() };

          const newProvider: CustomAIProvider = {
            id,
            name: providerData.name.trim() || "自定义供应商",
            type: providerData.type || "openai",
            baseUrl: providerData.baseUrl.trim() || "https://api.openai.com/v1",
            model: providerData.model.trim() || "gpt-4o-mini",
          };

          const existingDropdown = state.aiDropdownSettings || DEFAULT_AI_DROPDOWN_SETTINGS;
          const nextVisible = Array.from(new Set([...(existingDropdown.visibleProviders || []), id]));

          return {
            aiConfig: {
              ...aiConfig,
              customProviders: [...(aiConfig.customProviders || []), newProvider],
              provider: id,
              type: newProvider.type,
              baseURL: newProvider.baseUrl,
              model: newProvider.model,
              apiKey: apiKey.trim(),
              apiKeys: apiKeysPool,
              baseURLs: baseURLsPool,
              models: modelsPool,
            },
            aiDropdownSettings: {
              ...existingDropdown,
              visibleProviders: nextVisible,
            },
          };
        });
        return id;
      },

      updateCustomProvider: (id, partial) =>
        set((state) => {
          const updatedList = (state.aiConfig.customProviders || []).map((c) =>
            c.id === id ? { ...c, ...partial } : c
          );
          const isActive = state.aiConfig.provider === id;
          const updatedItem = updatedList.find((c) => c.id === id);
          return {
            aiConfig: {
              ...state.aiConfig,
              customProviders: updatedList,
              ...(isActive && updatedItem
                ? {
                    type: updatedItem.type,
                    baseURL: updatedItem.baseUrl,
                    model: updatedItem.model,
                    baseURLs: { ...(state.aiConfig.baseURLs || {}), [id]: updatedItem.baseUrl },
                    models: { ...(state.aiConfig.models || {}), [id]: updatedItem.model },
                  }
                : {}),
            },
          };
        }),

      deleteCustomProvider: (id) =>
        set((state) => {
          const remaining = (state.aiConfig.customProviders || []).filter((c) => c.id !== id);
          const existingDropdown = state.aiDropdownSettings || DEFAULT_AI_DROPDOWN_SETTINGS;
          const nextVisible = (existingDropdown.visibleProviders || []).filter((p) => p !== id);
          const isDeletingActive = state.aiConfig.provider === id;

          let nextConfig = {
            ...state.aiConfig,
            customProviders: remaining,
          };

          if (isDeletingActive) {
            const fallbackKey = "deepseek";
            const meta = getProviderMeta(nextConfig, fallbackKey);
            nextConfig = {
              ...nextConfig,
              provider: fallbackKey,
              type: meta.type,
              baseURL: nextConfig.baseURLs?.[fallbackKey] || meta.baseUrl,
              model: nextConfig.models?.[fallbackKey] || meta.model,
              apiKey: nextConfig.apiKeys?.[fallbackKey] || "",
            };
          }

          return {
            aiConfig: nextConfig,
            aiDropdownSettings: {
              ...existingDropdown,
              visibleProviders: nextVisible.length > 0 ? nextVisible : ["deepseek"],
            },
          };
        }),

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

      reorderRules: (fromIndex, toIndex) =>
        set((state) => {
          const list = [...state.rulesSettings.rules];
          if (
            fromIndex < 0 ||
            toIndex < 0 ||
            fromIndex >= list.length ||
            toIndex >= list.length ||
            fromIndex === toIndex
          ) {
            return state;
          }
          const [moved] = list.splice(fromIndex, 1);
          list.splice(toIndex, 0, moved);
          return {
            rulesSettings: {
              ...state.rulesSettings,
              rules: list,
            },
          };
        }),

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
      setCrossPanelMerge: (val) => set({ crossPanelMerge: val }),
      setCreateGroupTabs: (val) => set({ createGroupTabs: val }),

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
