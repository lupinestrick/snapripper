import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AIConfig } from "@/types/ai";
import { CategorizationRule, RulesSettings } from "@/types/sidebery";
import { DEFAULT_RULES_SETTINGS } from "@/services/ruleEngine";

export type AppPage = "workbench" | "process" | "rules" | "ai";

interface ConfigState {
  activePage: AppPage;
  aiConfig: AIConfig;
  rulesSettings: RulesSettings;
  exemptPinned: boolean;
  exemptInternalPages: boolean;
  preserveSubtrees: boolean;

  setActivePage: (page: AppPage) => void;
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
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set, get) => ({
      activePage: "workbench",
      aiConfig: {
        provider: "custom",
        baseURL: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-4o-mini",
        temperature: 0.2,
      },
      rulesSettings: DEFAULT_RULES_SETTINGS,
      exemptPinned: true,
      exemptInternalPages: true,
      preserveSubtrees: true,

      setActivePage: (page) => set({ activePage: page }),

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
    }),
    {
      name: "snapripper_config_storage_v2",
    }
  )
);
