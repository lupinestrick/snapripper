export type AppTheme =
  | "park-light"
  | "park-dark"
  | "midnight"
  | "nord-snow-storm"
  | "rose-pine-dawn"
  | "matcha-latte"
  | "amber-paper"
  | "nord-dark"
  | "catppuccin-mocha"
  | "tokyo-night"
  | "emerald-obsidian";

export interface ThemeDefinition {
  id: AppTheme;
  name: string;
  isLight: boolean;
  previewDot: string;
  colors: string[];
}

export const THEME_DEFINITIONS: ThemeDefinition[] = [
  {
    id: "park-light",
    name: "Crimson Light",
    isLight: true,
    previewDot: "#e93d82",
    colors: ["#fcfcfc", "#f0f0f0", "#e93d82", "#cb1d63"],
  },
  {
    id: "park-dark",
    name: "Crimson Dark",
    isLight: false,
    previewDot: "#e93d82",
    colors: ["#111111", "#202020", "#e93d82", "#ff92ad"],
  },
  {
    id: "midnight",
    name: "Midnight",
    isLight: false,
    previewDot: "#3b82f6",
    colors: ["#090d16", "#162033", "#3b82f6", "#60a5fa"],
  },
  {
    id: "nord-snow-storm",
    name: "Nord Snow Storm",
    isLight: true,
    previewDot: "#5e81ac",
    colors: ["#f4f7fa", "#e8eef5", "#5e81ac", "#2e3440"],
  },
  {
    id: "rose-pine-dawn",
    name: "Rosé Pine Dawn",
    isLight: true,
    previewDot: "#c25964",
    colors: ["#f8f1e9", "#f1e7dc", "#c25964", "#4a4468"],
  },
  {
    id: "matcha-latte",
    name: "Matcha Sage",
    isLight: true,
    previewDot: "#2f855a",
    colors: ["#f3f5f1", "#e9ede6", "#2f855a", "#1f2922"],
  },
  {
    id: "amber-paper",
    name: "Amber Paper",
    isLight: true,
    previewDot: "#d97706",
    colors: ["#f7f4ec", "#efeae0", "#d97706", "#292524"],
  },
  {
    id: "nord-dark",
    name: "Nord Polar Night",
    isLight: false,
    previewDot: "#88c0d0",
    colors: ["#20252e", "#343b49", "#88c0d0", "#81a1c1"],
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    isLight: false,
    previewDot: "#cba6f7",
    colors: ["#11111b", "#222234", "#f5c2e7", "#cba6f7"],
  },
  {
    id: "tokyo-night",
    name: "Tokyo Night",
    isLight: false,
    previewDot: "#7aa2f7",
    colors: ["#13141c", "#202230", "#7aa2f7", "#7dcfff"],
  },
  {
    id: "emerald-obsidian",
    name: "Obsidian Emerald",
    isLight: false,
    previewDot: "#10b981",
    colors: ["#090c0b", "#161d1a", "#10b981", "#34d399"],
  },
];

const LIGHT_THEME_SET = new Set<AppTheme>(
  THEME_DEFINITIONS.filter((t) => t.isLight).map((t) => t.id)
);

export function isLightTheme(themeId?: AppTheme | string): boolean {
  if (!themeId) return true;
  return LIGHT_THEME_SET.has(themeId as AppTheme);
}
