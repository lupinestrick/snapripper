import { create } from "zustand";
import { persist } from "zustand/middleware";
import { AIConfig } from "@/types/ai";

interface ConfigState {
  aiConfig: AIConfig;
  exemptPinned: boolean;
  exemptInternalPages: boolean;
  preserveSubtrees: boolean;
  setAIConfig: (config: Partial<AIConfig>) => void;
  setExemptPinned: (val: boolean) => void;
  setExemptInternalPages: (val: boolean) => void;
  setPreserveSubtrees: (val: boolean) => void;
}

export const useConfigStore = create<ConfigState>()(
  persist(
    (set) => ({
      aiConfig: {
        provider: "custom",
        baseURL: "https://api.openai.com/v1",
        apiKey: "",
        model: "gpt-4o-mini",
        temperature: 0.2,
      },
      exemptPinned: true,
      exemptInternalPages: true,
      preserveSubtrees: true,

      setAIConfig: (config) =>
        set((state) => ({
          aiConfig: { ...state.aiConfig, ...config },
        })),
      setExemptPinned: (val) => set({ exemptPinned: val }),
      setExemptInternalPages: (val) => set({ exemptInternalPages: val }),
      setPreserveSubtrees: (val) => set({ preserveSubtrees: val }),
    }),
    {
      name: "snapripper_config_storage",
    }
  )
);
