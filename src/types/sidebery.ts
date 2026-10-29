export interface SideberyTab {
  id: number | string;
  panelId: string;
  parentId: number | string; // -1 or undefined for root tabs
  lvl?: number;
  title: string;
  url: string;
  pinned?: boolean;
  containerId?: string;
  customTitle?: string | null;
  customColor?: string | null;
  favIconUrl?: string;
  isParent?: boolean;
  folded?: boolean;
  isGroup?: boolean;
}

export interface SideberyPanel {
  id: string;
  name: string;
  color?: string;
  iconSVG?: string;
  iconIMG?: string;
  type?: number;
}

export interface SideberyContainer {
  id: string;
  name: string;
  color: string;
  icon: string;
}

export interface SideberyWindow {
  tabs: SideberyTab[];
}

export interface SideberySnapshot {
  id: string;
  time: number;
  containers?: Record<string, SideberyContainer>;
  panels?: Record<string, SideberyPanel>;
  windows: Record<string, SideberyWindow>;
  sidebar?: {
    nav?: string[];
    panels?: Record<string, SideberyPanel>;
  };
  rawTabsFormat?: boolean; // True if original was 3D array tabs[win][section]
  extensionBaseUrl?: string; // Captured from existing group tabs (e.g. moz-extension://uuid)
}

export interface TabTreeNode {
  id: string;
  tab: SideberyTab;
  children: TabTreeNode[];
  depth: number;
  isCategoryHeader?: boolean;
  categoryName?: string;
  isPinned?: boolean;
  isExempt?: boolean;
  isGroup?: boolean;
}

export type RuleScope = "all" | "panel" | "container";

export interface CategorizationRule {
  id: string;
  name: string;               // 目标 Group 名称
  enabled: boolean;
  scope: RuleScope;           // 适用范围：全部、指定面板、指定容器
  targetScopeId?: string;     // 对应的 panelId 或 containerId
  matchDomain?: string;       // 匹配域名 (支持逗号分隔或单个，如 "dlsite.com, ch.dlsite.com")
  matchKeyword?: string;      // 匹配标题关键词 (支持逗号分隔，如 "RJ, 同人, 音声")
  minThreshold: number;       // 最低阈值：匹配到几个标签才组成 Group (默认 2)
  color?: string;
}

export interface RulesSettings {
  treatExistingGroupsAsUnit: boolean; // 本来就是 group 的当成一个整体
  defaultMinThreshold: number;        // 默认最小成组阈值
  rules: CategorizationRule[];
}

export interface DiffTabChange {
  tab: SideberyTab;
  changeType: "added" | "removed" | "grouped" | "unchanged" | "deduped";
  groupName?: string;
}

export interface PanelDiffResult {
  panelId: string;
  panelName: string;
  beforeTabs: SideberyTab[];
  afterTabs: SideberyTab[];
  beforeTree: TabTreeNode[];
  afterTree: TabTreeNode[];
  addedGroupsCount: number;
  dedupedCount: number;
}
