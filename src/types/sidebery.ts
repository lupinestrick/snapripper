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
}

export interface SideberyPanel {
  id: string;
  name: string;
  color?: string;
  iconSVG?: string;
  iconIMG?: string;
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
    panels?: Record<string, SideberyPanel>;
  };
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
}
