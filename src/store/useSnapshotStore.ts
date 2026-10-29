import { create } from "zustand";
import { SideberySnapshot, SideberyTab, TabTreeNode } from "@/types/sidebery";
import { ProportionReport } from "@/types/ai";
import { parseSnapshot, buildTabTree, flattenTabTree } from "@/services/snapshotParser";
import {
  batchDeleteNodes,
  batchUpdatePanel,
  batchUpdatePinned,
  getDuplicateUrlSet,
  reorganizeTreeIntoCategories,
  reorganizeTabsIntoPanels,
} from "@/services/treeOperations";

interface SnapshotStoreState {
  rawSnapshot: SideberySnapshot | null;
  fileName: string;
  activeWindowId: string;
  activePanelId: string | null; // null = all panels
  rootNodes: TabTreeNode[];
  selectedIds: Set<string>;
  expandedIds: Set<string>;
  searchQuery: string;
  panelFilter: string | null;
  containerFilter: string | null;
  onlyDuplicates: boolean;
  duplicateUrls: Set<string>;

  proportionReport: ProportionReport | null;
  isAnalyzing: boolean;
  isClassifying: boolean;
  progressStatus: string;
  classificationProgress: { current: number; total: number };

  undoStack: SideberySnapshot[];
  redoStack: SideberySnapshot[];

  loadSnapshot: (jsonString: string, fileName: string) => void;
  setActivePanelId: (panelId: string | null) => void;
  selectTab: (id: string, isMulti?: boolean, isRange?: boolean) => void;
  selectAll: () => void;
  clearSelection: () => void;
  toggleExpand: (id: string) => void;
  expandAll: () => void;
  collapseAll: () => void;
  setSearchQuery: (query: string) => void;
  setPanelFilter: (panelId: string | null) => void;
  setContainerFilter: (containerId: string | null) => void;
  setOnlyDuplicates: (val: boolean) => void;

  deleteSelected: () => void;
  markSelectedPinned: (pinned: boolean) => void;
  moveSelectedToPanel: (targetPanelId: string) => void;
  applySnapshotUpdate: (newSnapshot: SideberySnapshot, actionLabel?: string) => void;
  undo: () => void;
  redo: () => void;

  setProportionReport: (report: ProportionReport | null) => void;
  updateCategoryName: (categoryId: string, newName: string) => void;
  updateCategoryRatio: (categoryId: string, newRatio: number) => void;
  removeCategory: (categoryId: string) => void;
  addCategory: (name: string) => void;
  setIsAnalyzing: (val: boolean, status?: string) => void;
  setIsClassifying: (val: boolean, progress?: { current: number; total: number }) => void;

  applyTreeCategorization: (classificationMap: Map<string, string>, categoryNames: string[]) => void;
  applyPanelCategorization: (classificationMap: Map<string, string>, categories: { id: string; name: string }[]) => void;
  getExportSnapshot: (mode: "tree" | "panel" | "container") => SideberySnapshot;
}

export const useSnapshotStore = create<SnapshotStoreState>()((set, get) => ({
  rawSnapshot: null,
  fileName: "",
  activeWindowId: "1",
  activePanelId: null,
  rootNodes: [],
  selectedIds: new Set<string>(),
  expandedIds: new Set<string>(),
  searchQuery: "",
  panelFilter: null,
  containerFilter: null,
  onlyDuplicates: false,
  duplicateUrls: new Set<string>(),

  proportionReport: null,
  isAnalyzing: false,
  isClassifying: false,
  progressStatus: "",
  classificationProgress: { current: 0, total: 0 },

  undoStack: [],
  redoStack: [],

  loadSnapshot: (jsonString, fileName) => {
    const parsed = parseSnapshot(jsonString);
    const winKeys = Object.keys(parsed.snapshot.windows);
    const primaryWinId = winKeys[0] || "1";
    const tabs = parsed.snapshot.windows[primaryWinId]?.tabs || [];
    const tree = buildTabTree(tabs);
    const duplicates = getDuplicateUrlSet(tabs);

    const initialExpanded = new Set<string>(tree.map((n) => n.id));

    set({
      rawSnapshot: parsed.snapshot,
      fileName,
      activeWindowId: primaryWinId,
      activePanelId: null,
      panelFilter: null,
      rootNodes: tree,
      duplicateUrls: duplicates,
      expandedIds: initialExpanded,
      selectedIds: new Set<string>(),
      searchQuery: "",
      onlyDuplicates: false,
      undoStack: [],
      redoStack: [],
      proportionReport: null,
    });
  },

  setActivePanelId: (panelId) => {
    set({ activePanelId: panelId, panelFilter: panelId });
  },

  selectTab: (id, isMulti, isRange) => {
    const { selectedIds } = get();
    const next = new Set(isMulti ? selectedIds : []);

    if (isMulti) {
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
    } else {
      next.clear();
      next.add(id);
    }

    set({ selectedIds: next });
  },

  selectAll: () => {
    const { rootNodes } = get();
    const all = new Set<string>();
    function collect(nodes: TabTreeNode[]) {
      for (const n of nodes) {
        all.add(n.id);
        if (n.children) collect(n.children);
      }
    }
    collect(rootNodes);
    set({ selectedIds: all });
  },

  clearSelection: () => {
    set({ selectedIds: new Set<string>() });
  },

  toggleExpand: (id) => {
    const { expandedIds } = get();
    const next = new Set(expandedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    set({ expandedIds: next });
  },

  expandAll: () => {
    const { rootNodes } = get();
    const all = new Set<string>();
    function collect(nodes: TabTreeNode[]) {
      for (const n of nodes) {
        if (n.children && n.children.length > 0) {
          all.add(n.id);
          collect(n.children);
        }
      }
    }
    collect(rootNodes);
    set({ expandedIds: all });
  },

  collapseAll: () => {
    set({ expandedIds: new Set<string>() });
  },

  setSearchQuery: (searchQuery) => set({ searchQuery }),
  setPanelFilter: (panelFilter) => set({ panelFilter, activePanelId: panelFilter }),
  setContainerFilter: (containerFilter) => set({ containerFilter }),
  setOnlyDuplicates: (onlyDuplicates) => set({ onlyDuplicates }),

  applySnapshotUpdate: (newSnapshot, actionLabel) => {
    const { rawSnapshot, undoStack } = get();
    if (!rawSnapshot) return;

    const winKeys = Object.keys(newSnapshot.windows);
    const primaryWinId = winKeys[0] || "1";
    const tabs = newSnapshot.windows[primaryWinId]?.tabs || [];
    const tree = buildTabTree(tabs);
    const duplicates = getDuplicateUrlSet(tabs);

    set({
      undoStack: [...undoStack, rawSnapshot],
      redoStack: [],
      rawSnapshot: newSnapshot,
      rootNodes: tree,
      duplicateUrls: duplicates,
      selectedIds: new Set<string>(),
    });
  },

  deleteSelected: () => {
    const { rootNodes, selectedIds, rawSnapshot, activeWindowId, undoStack } = get();
    if (selectedIds.size === 0 || !rawSnapshot) return;

    const updatedNodes = batchDeleteNodes(rootNodes, selectedIds);
    const updatedTabs = flattenTabTree(updatedNodes);

    const updatedSnapshot: SideberySnapshot = {
      ...rawSnapshot,
      windows: {
        ...rawSnapshot.windows,
        [activeWindowId]: { tabs: updatedTabs },
      },
    };

    set({
      undoStack: [...undoStack, rawSnapshot],
      redoStack: [],
      rawSnapshot: updatedSnapshot,
      rootNodes: updatedNodes,
      selectedIds: new Set<string>(),
      duplicateUrls: getDuplicateUrlSet(updatedTabs),
    });
  },

  markSelectedPinned: (pinned) => {
    const { rootNodes, selectedIds, rawSnapshot, activeWindowId, undoStack } = get();
    if (selectedIds.size === 0 || !rawSnapshot) return;

    const updatedNodes = batchUpdatePinned(rootNodes, selectedIds, pinned);
    const updatedTabs = flattenTabTree(updatedNodes);

    const updatedSnapshot: SideberySnapshot = {
      ...rawSnapshot,
      windows: {
        ...rawSnapshot.windows,
        [activeWindowId]: { tabs: updatedTabs },
      },
    };

    set({
      undoStack: [...undoStack, rawSnapshot],
      redoStack: [],
      rawSnapshot: updatedSnapshot,
      rootNodes: updatedNodes,
    });
  },

  moveSelectedToPanel: (targetPanelId) => {
    const { rootNodes, selectedIds, rawSnapshot, activeWindowId, undoStack } = get();
    if (selectedIds.size === 0 || !rawSnapshot) return;

    const updatedNodes = batchUpdatePanel(rootNodes, selectedIds, targetPanelId);
    const updatedTabs = flattenTabTree(updatedNodes, targetPanelId);

    const updatedSnapshot: SideberySnapshot = {
      ...rawSnapshot,
      windows: {
        ...rawSnapshot.windows,
        [activeWindowId]: { tabs: updatedTabs },
      },
    };

    set({
      undoStack: [...undoStack, rawSnapshot],
      redoStack: [],
      rawSnapshot: updatedSnapshot,
      rootNodes: updatedNodes,
      selectedIds: new Set<string>(),
    });
  },

  undo: () => {
    const { undoStack, redoStack, rawSnapshot, activeWindowId } = get();
    if (undoStack.length === 0 || !rawSnapshot) return;

    const prevSnapshot = undoStack[undoStack.length - 1];
    const newUndo = undoStack.slice(0, -1);
    const tabs = prevSnapshot.windows[activeWindowId]?.tabs || [];
    const tree = buildTabTree(tabs);

    set({
      rawSnapshot: prevSnapshot,
      rootNodes: tree,
      undoStack: newUndo,
      redoStack: [...redoStack, rawSnapshot],
      duplicateUrls: getDuplicateUrlSet(tabs),
      selectedIds: new Set<string>(),
    });
  },

  redo: () => {
    const { redoStack, undoStack, rawSnapshot, activeWindowId } = get();
    if (redoStack.length === 0 || !rawSnapshot) return;

    const nextSnapshot = redoStack[redoStack.length - 1];
    const newRedo = redoStack.slice(0, -1);
    const tabs = nextSnapshot.windows[activeWindowId]?.tabs || [];
    const tree = buildTabTree(tabs);

    set({
      rawSnapshot: nextSnapshot,
      rootNodes: tree,
      undoStack: [...undoStack, rawSnapshot],
      redoStack: newRedo,
      duplicateUrls: getDuplicateUrlSet(tabs),
      selectedIds: new Set<string>(),
    });
  },

  setProportionReport: (proportionReport) => set({ proportionReport }),

  updateCategoryName: (categoryId, newName) => {
    const { proportionReport } = get();
    if (!proportionReport) return;
    set({
      proportionReport: {
        ...proportionReport,
        categories: proportionReport.categories.map((c) =>
          c.id === categoryId ? { ...c, name: newName } : c
        ),
      },
    });
  },

  updateCategoryRatio: (categoryId, newRatio) => {
    const { proportionReport } = get();
    if (!proportionReport) return;
    set({
      proportionReport: {
        ...proportionReport,
        categories: proportionReport.categories.map((c) =>
          c.id === categoryId ? { ...c, targetRatio: newRatio } : c
        ),
      },
    });
  },

  removeCategory: (categoryId) => {
    const { proportionReport } = get();
    if (!proportionReport) return;
    set({
      proportionReport: {
        ...proportionReport,
        categories: proportionReport.categories.filter((c) => c.id !== categoryId),
      },
    });
  },

  addCategory: (name) => {
    const { proportionReport } = get();
    if (!proportionReport) return;
    const newCat = {
      id: `cat_${Date.now()}`,
      name,
      color: "#38bdf8",
      ratio: 0,
      description: "用户自定义分类",
      matchCount: 0,
    };
    set({
      proportionReport: {
        ...proportionReport,
        categories: [...proportionReport.categories, newCat],
      },
    });
  },

  setIsAnalyzing: (isAnalyzing, status = "") => set({ isAnalyzing, progressStatus: status }),
  setIsClassifying: (isClassifying, classificationProgress = { current: 0, total: 0 }) =>
    set({ isClassifying, classificationProgress }),

  applyTreeCategorization: (classificationMap, categoryNames) => {
    const { rootNodes, rawSnapshot, activeWindowId, undoStack } = get();
    if (!rawSnapshot) return;

    const nextTree = reorganizeTreeIntoCategories(rootNodes, classificationMap, categoryNames);
    const updatedTabs = flattenTabTree(nextTree);

    const updatedSnapshot: SideberySnapshot = {
      ...rawSnapshot,
      windows: {
        ...rawSnapshot.windows,
        [activeWindowId]: { tabs: updatedTabs },
      },
    };

    set({
      undoStack: [...undoStack, rawSnapshot],
      redoStack: [],
      rawSnapshot: updatedSnapshot,
      rootNodes: nextTree,
      selectedIds: new Set<string>(),
    });
  },

  applyPanelCategorization: (classificationMap, categories) => {
    const { rawSnapshot, rootNodes, activeWindowId, undoStack } = get();
    if (!rawSnapshot) return;

    const flatTabs = flattenTabTree(rootNodes);
    const { tabs: updatedTabs, panels: updatedPanels } = reorganizeTabsIntoPanels(
      flatTabs,
      classificationMap,
      categories,
      rawSnapshot.panels || {}
    );

    const nextTree = buildTabTree(updatedTabs);
    const updatedSnapshot: SideberySnapshot = {
      ...rawSnapshot,
      panels: updatedPanels,
      windows: {
        ...rawSnapshot.windows,
        [activeWindowId]: { tabs: updatedTabs },
      },
    };

    set({
      undoStack: [...undoStack, rawSnapshot],
      redoStack: [],
      rawSnapshot: updatedSnapshot,
      rootNodes: nextTree,
      selectedIds: new Set<string>(),
    });
  },

  getExportSnapshot: (mode) => {
    const { rawSnapshot, rootNodes, activeWindowId } = get();
    if (!rawSnapshot) throw new Error("没有可导出的快照数据");
    const tabs = flattenTabTree(rootNodes);
    return {
      ...rawSnapshot,
      windows: {
        ...rawSnapshot.windows,
        [activeWindowId]: { tabs },
      },
    };
  },
}));
