import { create } from "zustand";
import { SideberySnapshot, SideberyTab, TabTreeNode, SideberyPanel, SideberyContainer } from "@/types/sidebery";
import { ProportionReport } from "@/types/ai";
import { parseSnapshot, buildTabTree, flattenTabTree, serializeSnapshot } from "@/services/snapshotParser";
import {
  batchDeleteNodes,
  batchUpdatePanel,
  batchUpdatePinned,
  filterTree,
  getDuplicateUrlSet,
  reorganizeTreeIntoCategories,
  reorganizeTabsIntoPanels,
} from "@/services/treeOperations";

interface SnapshotStoreState {
  rawSnapshot: SideberySnapshot | null;
  fileName: string;
  activeWindowId: string;
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

  undoStack: TabTreeNode[][];

  loadSnapshot: (jsonString: string, fileName: string) => void;
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
  undo: () => void;

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
      rootNodes: tree,
      selectedIds: new Set(),
      expandedIds: initialExpanded,
      duplicateUrls: duplicates,
      proportionReport: null,
      undoStack: [],
      searchQuery: "",
      panelFilter: null,
      containerFilter: null,
      onlyDuplicates: false,
    });
  },

  selectTab: (id, isMulti = false) => {
    const { selectedIds } = get();
    const next = new Set(selectedIds);
    if (!isMulti) {
      if (next.has(id) && next.size === 1) {
        next.clear();
      } else {
        next.clear();
        next.add(id);
      }
    } else {
      if (next.has(id)) next.delete(id);
      else next.add(id);
    }
    set({ selectedIds: next });
  },

  selectAll: () => {
    const allIds = new Set<string>();
    function collect(nodes: TabTreeNode[]) {
      for (const n of nodes) {
        allIds.add(n.id);
        if (n.children) collect(n.children);
      }
    }
    collect(get().rootNodes);
    set({ selectedIds: allIds });
  },

  clearSelection: () => set({ selectedIds: new Set() }),

  toggleExpand: (id) => {
    const { expandedIds } = get();
    const next = new Set(expandedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    set({ expandedIds: next });
  },

  expandAll: () => {
    const allIds = new Set<string>();
    function collect(nodes: TabTreeNode[]) {
      for (const n of nodes) {
        if (n.children.length > 0) allIds.add(n.id);
        collect(n.children);
      }
    }
    collect(get().rootNodes);
    set({ expandedIds: allIds });
  },

  collapseAll: () => set({ expandedIds: new Set() }),

  setSearchQuery: (query) => set({ searchQuery: query }),
  setPanelFilter: (panelId) => set({ panelFilter: panelId }),
  setContainerFilter: (containerId) => set({ containerFilter: containerId }),
  setOnlyDuplicates: (val) => set({ onlyDuplicates: val }),

  deleteSelected: () => {
    const { rootNodes, selectedIds, undoStack } = get();
    if (selectedIds.size === 0) return;

    const nextTree = batchDeleteNodes(rootNodes, selectedIds, false);
    const flatTabs = flattenTabTree(nextTree);

    set({
      undoStack: [rootNodes, ...undoStack.slice(0, 10)],
      rootNodes: nextTree,
      selectedIds: new Set(),
      duplicateUrls: getDuplicateUrlSet(flatTabs),
    });
  },

  markSelectedPinned: (pinned) => {
    const { rootNodes, selectedIds, undoStack } = get();
    if (selectedIds.size === 0) return;

    const nextTree = batchUpdatePinned(rootNodes, selectedIds, pinned);
    set({
      undoStack: [rootNodes, ...undoStack.slice(0, 10)],
      rootNodes: nextTree,
    });
  },

  moveSelectedToPanel: (targetPanelId) => {
    const { rootNodes, selectedIds, undoStack } = get();
    if (selectedIds.size === 0) return;

    const nextTree = batchUpdatePanel(rootNodes, selectedIds, targetPanelId);
    set({
      undoStack: [rootNodes, ...undoStack.slice(0, 10)],
      rootNodes: nextTree,
    });
  },

  undo: () => {
    const { undoStack, rootNodes } = get();
    if (undoStack.length === 0) return;
    const [previous, ...rest] = undoStack;
    const flatTabs = flattenTabTree(previous);

    set({
      rootNodes: previous,
      undoStack: rest,
      selectedIds: new Set(),
      duplicateUrls: getDuplicateUrlSet(flatTabs),
    });
  },

  setProportionReport: (report) => set({ proportionReport: report }),

  updateCategoryName: (categoryId, newName) => {
    const { proportionReport } = get();
    if (!proportionReport) return;
    const updated = proportionReport.categories.map((c) => (c.id === categoryId ? { ...c, name: newName } : c));
    set({ proportionReport: { ...proportionReport, categories: updated } });
  },

  updateCategoryRatio: (categoryId, newRatio) => {
    const { proportionReport } = get();
    if (!proportionReport) return;
    const updated = proportionReport.categories.map((c) => (c.id === categoryId ? { ...c, ratio: newRatio } : c));
    set({ proportionReport: { ...proportionReport, categories: updated } });
  },

  removeCategory: (categoryId) => {
    const { proportionReport } = get();
    if (!proportionReport) return;
    const filtered = proportionReport.categories.filter((c) => c.id !== categoryId);
    set({ proportionReport: { ...proportionReport, categories: filtered } });
  },

  addCategory: (name) => {
    const { proportionReport } = get();
    if (!proportionReport) return;
    const newCat = {
      id: `cat_${Date.now()}`,
      name,
      color: "#0284c7",
      ratio: 0,
      description: "用户新增自定义分类",
      matchCount: 0,
    };
    set({
      proportionReport: {
        ...proportionReport,
        categories: [...proportionReport.categories, newCat],
      },
    });
  },

  setIsAnalyzing: (val, status = "") => set({ isAnalyzing: val, progressStatus: status }),
  setIsClassifying: (val, progress = { current: 0, total: 0 }) =>
    set({ isClassifying: val, classificationProgress: progress }),

  applyTreeCategorization: (classificationMap, categoryNames) => {
    const { rootNodes, undoStack } = get();
    const nextTree = reorganizeTreeIntoCategories(rootNodes, classificationMap, categoryNames);
    const newExpanded = new Set<string>(nextTree.map((n) => n.id));

    set({
      undoStack: [rootNodes, ...undoStack.slice(0, 10)],
      rootNodes: nextTree,
      expandedIds: newExpanded,
    });
  },

  applyPanelCategorization: (classificationMap, categories) => {
    const { rawSnapshot, rootNodes, undoStack, activeWindowId } = get();
    if (!rawSnapshot) return;

    const flatTabs = flattenTabTree(rootNodes);
    const { tabs: updatedTabs, panels: updatedPanels } = reorganizeTabsIntoPanels(
      flatTabs,
      classificationMap,
      categories,
      rawSnapshot.panels || {}
    );

    const nextTree = buildTabTree(updatedTabs);
    const nextSnapshot = {
      ...rawSnapshot,
      panels: updatedPanels,
      windows: {
        ...rawSnapshot.windows,
        [activeWindowId]: { tabs: updatedTabs },
      },
    };

    set({
      undoStack: [rootNodes, ...undoStack.slice(0, 10)],
      rawSnapshot: nextSnapshot,
      rootNodes: nextTree,
    });
  },

  getExportSnapshot: (mode) => {
    const { rawSnapshot, rootNodes, activeWindowId } = get();
    if (!rawSnapshot) throw new Error("无快照数据");

    const flatTabs = flattenTabTree(rootNodes);
    return {
      ...rawSnapshot,
      time: Date.now(),
      windows: {
        ...rawSnapshot.windows,
        [activeWindowId]: {
          tabs: flatTabs,
        },
      },
    };
  },
}));
