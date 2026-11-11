import { create } from "zustand";
import { SideberySnapshot, SideberyTab, TabTreeNode, CategorizationRule } from "@/types/sidebery";
import { ProportionReport, AIProcessedCache } from "@/types/ai";
import { parseSnapshot, buildTabTree, flattenTabTree } from "@/services/snapshotParser";
import { useConfigStore } from "./useConfigStore";
import {
  batchDeleteNodes,
  batchUpdatePanel,
  batchUpdatePinned,
  getDuplicateUrlSet,
  filterTree,
  reorganizeTreeIntoCategories,
  reorganizeTabsIntoPanels,
} from "@/services/treeOperations";

function findNodeAndDescendants(nodes: TabTreeNode[], targetId: string): string[] {
  for (const n of nodes) {
    if (n.id === targetId) {
      const descendants: string[] = [n.id];
      function collect(childList?: TabTreeNode[]) {
        if (!childList) return;
        for (const c of childList) {
          descendants.push(c.id);
          collect(c.children);
        }
      }
      collect(n.children);
      return descendants;
    }
    if (n.children && n.children.length > 0) {
      const res = findNodeAndDescendants(n.children, targetId);
      if (res.length > 0) return res;
    }
  }
  return [];
}

export function buildProcessedSnapshot(
  originalSnapshot: SideberySnapshot,
  classificationMap: Map<string, string>,
  categories: { id: string; name: string }[],
  targetMode: "tree" | "panel",
  targetPanelId?: string
): { processedSnapshot: SideberySnapshot; processedTree: TabTreeNode[] } {
  const primaryWinId = Object.keys(originalSnapshot.windows)[0] || "1";
  const tabs = originalSnapshot.windows[primaryWinId]?.tabs || [];
  const categoryNames = categories.map((c) => c.name);

  if (targetMode === "panel") {
    const { tabs: updatedTabs, panels: updatedPanels } = reorganizeTabsIntoPanels(
      tabs,
      classificationMap,
      categories,
      originalSnapshot.panels || {}
    );
    const processedTree = buildTabTree(updatedTabs);
    const processedSnapshot: SideberySnapshot = {
      ...originalSnapshot,
      panels: updatedPanels,
      windows: {
        ...originalSnapshot.windows,
        [primaryWinId]: { tabs: updatedTabs },
      },
    };
    return { processedSnapshot, processedTree };
  } else {
    const originalTree = buildTabTree(tabs);
    let processedTree = reorganizeTreeIntoCategories(originalTree, classificationMap, categoryNames);
    if (targetPanelId) {
      processedTree = processedTree.map((node) => {
        if (node.isCategoryHeader) {
          return {
            ...node,
            tab: { ...node.tab, panelId: targetPanelId },
            children: node.children.map((c) => ({
              ...c,
              tab: { ...c.tab, panelId: targetPanelId },
            })),
          };
        }
        return node;
      });
    }
    const updatedTabs = flattenTabTree(processedTree);
    const processedSnapshot: SideberySnapshot = {
      ...originalSnapshot,
      windows: {
        ...originalSnapshot.windows,
        [primaryWinId]: { tabs: updatedTabs },
      },
    };
    return { processedSnapshot, processedTree };
  }
}

interface SnapshotStoreState {
  rawSnapshot: SideberySnapshot | null;
  fileName: string;
  rawFileSize: number;
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

  aiProcessedCache: AIProcessedCache | null;
  isPostEditMode: boolean;
  isAIDiffModalOpen: boolean;
  isOverviewHopupOpen: boolean;

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

  setAiProcessedCache: (cache: AIProcessedCache | null) => void;
  setIsAIDiffModalOpen: (open: boolean) => void;
  setIsOverviewHopupOpen: (open: boolean) => void;
  enterPostEditMode: () => void;
  exitPostEditMode: (apply: boolean) => void;
  updateProcessedTreeTarget: (targetMode: "tree" | "panel", targetPanelId?: string) => void;
}

export const useSnapshotStore = create<SnapshotStoreState>()((set, get) => ({
  rawSnapshot: null,
  fileName: "",
  rawFileSize: 0,
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

  aiProcessedCache: null,
  isPostEditMode: false,
  isAIDiffModalOpen: false,
  isOverviewHopupOpen: false,

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
      rawFileSize: new Blob([jsonString]).size,
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
      aiProcessedCache: null,
      isPostEditMode: false,
      isAIDiffModalOpen: false,
    });
  },

  setActivePanelId: (panelId) => {
    set({ activePanelId: panelId, panelFilter: panelId });
  },

  selectTab: (id, isMulti, isRange) => {
    const { selectedIds, rootNodes } = get();
    const shouldCascade = useConfigStore.getState().cascadeSelectChildren;
    const targetIds = shouldCascade ? findNodeAndDescendants(rootNodes, id) : [id];
    if (targetIds.length === 0) targetIds.push(id);

    const next = new Set(isMulti ? selectedIds : []);

    if (isMulti) {
      const isCurrentlySelected = next.has(id);
      if (isCurrentlySelected) {
        for (const tid of targetIds) next.delete(tid);
      } else {
        for (const tid of targetIds) next.add(tid);
      }
    } else {
      next.clear();
      for (const tid of targetIds) next.add(tid);
    }

    set({ selectedIds: next });
  },

  selectAll: () => {
    const { rootNodes, searchQuery, panelFilter, containerFilter, onlyDuplicates, duplicateUrls } = get();
    const all = new Set<string>();

    const hasFilter = searchQuery.trim() !== "" || !!panelFilter || !!containerFilter || onlyDuplicates;

    if (hasFilter) {
      const filtered = filterTree(rootNodes, searchQuery, {
        panelId: panelFilter || undefined,
        containerId: containerFilter || undefined,
        showOnlyDuplicates: onlyDuplicates,
        duplicateUrls,
      });

      function collectMatching(nodes: TabTreeNode[]) {
        for (const n of nodes) {
          if (onlyDuplicates) {
            // Strictly select only nodes that are actual duplicate tabs
            if (duplicateUrls.has(n.tab.url)) {
              all.add(n.id);
            }
          } else {
            all.add(n.id);
          }
          if (n.children) collectMatching(n.children);
        }
      }
      collectMatching(filtered);
    } else {
      function collect(nodes: TabTreeNode[]) {
        for (const n of nodes) {
          all.add(n.id);
          if (n.children) collect(n.children);
        }
      }
      collect(rootNodes);
    }

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

  setAiProcessedCache: (cache) => set({ aiProcessedCache: cache }),
  setIsAIDiffModalOpen: (open) => set({ isAIDiffModalOpen: open }),
  setIsOverviewHopupOpen: (open) => set({ isOverviewHopupOpen: open }),

  enterPostEditMode: () => {
    const { aiProcessedCache, activeWindowId } = get();
    if (!aiProcessedCache) return;
    const procWinTabs = aiProcessedCache.processedSnapshot.windows[activeWindowId]?.tabs || [];
    const tree = buildTabTree(procWinTabs);
    const expandedIds = new Set<string>(tree.map((n) => n.id));
    set({
      isPostEditMode: true,
      rootNodes: tree,
      expandedIds,
      selectedIds: new Set<string>(),
    });
    useConfigStore.getState().setActivePage("workbench");
  },

  exitPostEditMode: (apply) => {
    const { aiProcessedCache, rootNodes, rawSnapshot, activeWindowId, undoStack } = get();
    if (!aiProcessedCache || !rawSnapshot) {
      set({ isPostEditMode: false });
      return;
    }

    if (apply) {
      const updatedTabs = flattenTabTree(rootNodes);
      const committedSnapshot: SideberySnapshot = {
        ...aiProcessedCache.processedSnapshot,
        windows: {
          ...aiProcessedCache.processedSnapshot.windows,
          [activeWindowId]: { tabs: updatedTabs },
        },
      };
      set({
        undoStack: [...undoStack, rawSnapshot],
        redoStack: [],
        rawSnapshot: committedSnapshot,
        isPostEditMode: false,
      });
    } else {
      const origWinTabs = aiProcessedCache.originalSnapshot.windows[activeWindowId]?.tabs || [];
      const origTree = buildTabTree(origWinTabs);
      set({
        rawSnapshot: aiProcessedCache.originalSnapshot,
        rootNodes: origTree,
        isPostEditMode: false,
      });
    }
  },

  updateProcessedTreeTarget: (targetMode, targetPanelId) => {
    const { aiProcessedCache, isPostEditMode } = get();
    if (!aiProcessedCache) return;

    const classificationMap = new Map<string, string>(Object.entries(aiProcessedCache.classificationMap));
    const categories = aiProcessedCache.categoryNames.map((name, i) => ({ id: `cat_${i}`, name }));

    const { processedSnapshot, processedTree } = buildProcessedSnapshot(
      aiProcessedCache.originalSnapshot,
      classificationMap,
      categories,
      targetMode,
      targetPanelId
    );

    const updatedCache: AIProcessedCache = {
      ...aiProcessedCache,
      processedSnapshot,
      targetMode,
      targetPanelId,
    };

    set({
      aiProcessedCache: updatedCache,
      ...(isPostEditMode ? { rootNodes: processedTree } : {}),
    });
  },
}));
