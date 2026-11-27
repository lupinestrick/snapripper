import { create } from "zustand";
import { persist, createJSONStorage, StateStorage } from "zustand/middleware";
import { get as idbGet, set as idbSet, del as idbDel } from "idb-keyval";
import { SideberySnapshot, SideberyTab, TabTreeNode, CategorizationRule } from "@/types/sidebery";
import { ProportionReport, AIProcessedCache, CategoryProportion, AIChatMessage, AIChatSession, AIMergeReport } from "@/types/ai";
import { parseSnapshot, buildTabTree, flattenTabTree } from "@/services/snapshotParser";
import { useConfigStore } from "./useConfigStore";
import { syncSnapshotCookie, clearSnapshotCookies } from "@/utils/cookieHelper";
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
  targetPanelId?: string,
  options?: {
    crossPanelMerge?: boolean;
    createGroupTab?: boolean;
    createGroupTabs?: boolean;
  }
): { processedSnapshot: SideberySnapshot; processedTree: TabTreeNode[] } {
  const primaryWinId = Object.keys(originalSnapshot.windows)[0] || "1";
  const tabs = originalSnapshot.windows[primaryWinId]?.tabs || [];
  const categoryNames = categories.map((c) => c.name);
  const extensionBaseUrl = originalSnapshot.extensionBaseUrl || "moz-extension://sidebery-placeholder";

  const crossPanelMerge = options?.crossPanelMerge ?? true;
  const createGroupTab = options?.createGroupTabs ?? options?.createGroupTab ?? true;

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
    const processedTree = reorganizeTreeIntoCategories(originalTree, classificationMap, categoryNames, {
      crossPanelMerge,
      createGroupTab,
      extensionBaseUrl,
      targetPanelId,
    });
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
  initialSnapshot: SideberySnapshot | null;
  initialLoadedAt: number | null;
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
  onlyPinned: boolean;
  duplicateUrls: Set<string>;
  lastChangedIds: Set<string>;

  proportionReport: ProportionReport | null;
  isAnalyzing: boolean;
  isClassifying: boolean;
  progressStatus: string;
  classificationProgress: { current: number; total: number };

  aiProcessedCache: AIProcessedCache | null;
  aiChatMessages: AIChatMessage[];
  aiChatSessions: AIChatSession[];
  activeChatSessionId: string | null;
  isAIDiffModalOpen: boolean;
  activeMergeReport: AIMergeReport | null;
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
  setOnlyPinned: (val: boolean) => void;

  deleteSelected: () => void;
  markSelectedPinned: (pinned: boolean) => void;
  moveSelectedToPanel: (targetPanelId: string) => void;
  applySnapshotUpdate: (newSnapshot: SideberySnapshot, actionLabel?: string) => void;
  resetToInitialSnapshot: () => boolean;
  undo: () => void;
  redo: () => void;

  setProportionReport: (report: ProportionReport | null) => void;
  updateCategoryName: (categoryId: string, newName: string) => void;
  updateCategoryRatio: (categoryId: string, newRatio: number) => void;
  removeCategory: (categoryId: string) => void;
  updateCategory: (categoryId: string, updates: Partial<CategoryProportion>) => void;
  addCategory: (
    name: string,
    options?: {
      color?: string;
      description?: string;
      keywords?: string[];
      associatedRuleId?: string;
    }
  ) => void;
  setIsAnalyzing: (val: boolean, status?: string) => void;
  setIsClassifying: (val: boolean, progress?: { current: number; total: number }) => void;

  applyTreeCategorization: (classificationMap: Map<string, string>, categoryNames: string[]) => void;
  applyPanelCategorization: (classificationMap: Map<string, string>, categories: { id: string; name: string }[]) => void;
  getExportSnapshot: (mode: "tree" | "panel" | "container") => SideberySnapshot;

  setAiProcessedCache: (cache: AIProcessedCache | null) => void;
  setAiChatMessages: (messages: AIChatMessage[]) => void;
  addAiChatMessage: (message: AIChatMessage) => void;
  updateSchemeInChat: (messageId: string, updatedScheme: import("@/types/ai").ReorganizationScheme) => void;
  clearAiChatMessages: () => void;
  startNewAiChat: () => void;
  selectAiChatSession: (sessionId: string) => void;
  renameAiChatSession: (sessionId: string, newTitle: string) => void;
  deleteAiChatSession: (sessionId: string) => void;
  setIsAIDiffModalOpen: (open: boolean) => void;
  setActiveMergeReport: (report: AIMergeReport | null) => void;
  setIsOverviewHopupOpen: (open: boolean) => void;
  updateProcessedTreeTarget: (
    targetMode: "tree" | "panel",
    targetPanelId?: string,
    options?: { crossPanelMerge?: boolean }
  ) => void;
  clearAllCache: () => void;
}

let rowFlashTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleRowFlashClear(setFn: (partial: Partial<SnapshotStoreState>) => void) {
  if (rowFlashTimer) clearTimeout(rowFlashTimer);
  rowFlashTimer = setTimeout(() => {
    setFn({ lastChangedIds: new Set<string>() });
    rowFlashTimer = null;
  }, 1300);
}

const SNAPSHOT_STORAGE_KEY = "snapripper-snapshot-storage";

/**
 * IndexedDB storage adapter for large tab snapshots & undo stacks,
 * with transparent one-time migration from legacy localStorage and error-safe writes.
 */
const snapshotStorage: StateStorage = {
  getItem: async (name) => {
    if (typeof window === "undefined") return null;
    if (typeof indexedDB !== "undefined") {
      try {
        const val = await idbGet<string>(name);
        if (val != null) return val;
      } catch (err) {
        console.warn("[useSnapshotStore] IndexedDB getItem failed:", err);
      }
    }
    if (typeof localStorage !== "undefined") {
      try {
        const legacy = localStorage.getItem(name);
        if (legacy != null) {
          if (typeof indexedDB !== "undefined") {
            await idbSet(name, legacy).catch(() => {});
            localStorage.removeItem(name);
          }
          return legacy;
        }
      } catch {}
    }
    return null;
  },
  setItem: async (name, value) => {
    if (typeof window === "undefined") return;
    if (typeof indexedDB !== "undefined") {
      try {
        await idbSet(name, value);
        return;
      } catch (err) {
        console.warn("[useSnapshotStore] IndexedDB setItem failed:", err);
        return;
      }
    }
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.setItem(name, value);
      } catch (err) {
        console.warn("[useSnapshotStore] localStorage setItem failed:", err);
      }
    }
  },
  removeItem: async (name) => {
    if (typeof window === "undefined") return;
    if (typeof indexedDB !== "undefined") {
      try {
        await idbDel(name);
      } catch {}
    }
    if (typeof localStorage !== "undefined") {
      try {
        localStorage.removeItem(name);
      } catch {}
    }
  },
};

export const useSnapshotStore = create<SnapshotStoreState>()(
  persist(
    (set, get) => ({
  rawSnapshot: null,
  initialSnapshot: null,
  initialLoadedAt: null,
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
  onlyPinned: false,
  duplicateUrls: new Set<string>(),
  lastChangedIds: new Set<string>(),

  proportionReport: null,
  isAnalyzing: false,
  isClassifying: false,
  progressStatus: "",
  classificationProgress: { current: 0, total: 0 },

  aiProcessedCache: null,
  aiChatMessages: [],
  aiChatSessions: [],
  activeChatSessionId: null,
  isAIDiffModalOpen: false,
  activeMergeReport: null,
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
    syncSnapshotCookie(fileName, tabs.length);

    set({
      rawSnapshot: parsed.snapshot,
      initialSnapshot: parsed.snapshot,
      initialLoadedAt: Date.now(),
      fileName,
      rawFileSize: new Blob([jsonString]).size,
      activeWindowId: primaryWinId,
      activePanelId: null,
      panelFilter: null,
      rootNodes: tree,
      duplicateUrls: duplicates,
      lastChangedIds: new Set<string>(),
      expandedIds: initialExpanded,
      selectedIds: new Set<string>(),
      searchQuery: "",
      onlyDuplicates: false,
      onlyPinned: false,
      undoStack: [],
      redoStack: [],
      proportionReport: null,
      aiProcessedCache: null,
      isAIDiffModalOpen: false,
      activeMergeReport: null,
    });
  },

  resetToInitialSnapshot: () => {
    const { initialSnapshot, rawSnapshot, fileName, activeWindowId, undoStack } = get();
    if (!initialSnapshot || !rawSnapshot) return false;
    const winKeys = Object.keys(initialSnapshot.windows || {});
    const targetWinId = initialSnapshot.windows?.[activeWindowId] ? activeWindowId : winKeys[0] || "1";
    const tabs = initialSnapshot.windows?.[targetWinId]?.tabs || [];
    const tree = buildTabTree(tabs);
    const duplicates = getDuplicateUrlSet(tabs);
    const initialExpanded = new Set<string>(tree.map((n) => n.id));
    syncSnapshotCookie(fileName, tabs.length);

    set({
      rawSnapshot: initialSnapshot,
      activeWindowId: targetWinId,
      activePanelId: null,
      panelFilter: null,
      containerFilter: null,
      rootNodes: tree,
      duplicateUrls: duplicates,
      lastChangedIds: new Set<string>(),
      expandedIds: initialExpanded,
      selectedIds: new Set<string>(),
      searchQuery: "",
      onlyDuplicates: false,
      onlyPinned: false,
      undoStack: [...undoStack, rawSnapshot],
      redoStack: [],
      aiProcessedCache: null,
      activeMergeReport: null,
    });
    return true;
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
    const { rootNodes, searchQuery, panelFilter, containerFilter, onlyDuplicates, onlyPinned, duplicateUrls } = get();
    const all = new Set<string>();

    const hasFilter = searchQuery.trim() !== "" || !!panelFilter || !!containerFilter || onlyDuplicates || onlyPinned;

    if (hasFilter) {
      const filtered = filterTree(rootNodes, searchQuery, {
        panelId: panelFilter || undefined,
        containerId: containerFilter || undefined,
        showOnlyDuplicates: onlyDuplicates,
        duplicateUrls,
        showOnlyPinned: onlyPinned,
      });

      function collectMatching(nodes: TabTreeNode[]) {
        for (const n of nodes) {
          const matchesDuplicate = !onlyDuplicates || duplicateUrls.has(n.tab.url);
          const matchesPinned = !onlyPinned || !!n.tab.pinned;
          if (matchesDuplicate && matchesPinned) {
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
  setOnlyPinned: (onlyPinned) => set({ onlyPinned }),

  applySnapshotUpdate: (newSnapshot, actionLabel) => {
    const { rawSnapshot, undoStack } = get();
    if (!rawSnapshot) return;

    const winKeys = Object.keys(newSnapshot.windows);
    const primaryWinId = winKeys[0] || "1";
    const tabs = newSnapshot.windows[primaryWinId]?.tabs || [];
    const tree = buildTabTree(tabs);
    const duplicates = getDuplicateUrlSet(tabs);

    syncSnapshotCookie(get().fileName, tabs.length);

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

    syncSnapshotCookie(get().fileName, updatedTabs.length);

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

    syncSnapshotCookie(get().fileName, updatedTabs.length);

    const flashedIds = new Set(selectedIds);

    set({
      undoStack: [...undoStack, rawSnapshot],
      redoStack: [],
      rawSnapshot: updatedSnapshot,
      rootNodes: updatedNodes,
      lastChangedIds: flashedIds,
    });
    scheduleRowFlashClear(set);
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

    syncSnapshotCookie(get().fileName, updatedTabs.length);
    const flashedIds = new Set(selectedIds);

    set({
      undoStack: [...undoStack, rawSnapshot],
      redoStack: [],
      rawSnapshot: updatedSnapshot,
      rootNodes: updatedNodes,
      selectedIds: new Set<string>(),
      lastChangedIds: flashedIds,
    });
    scheduleRowFlashClear(set);
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
      isAIDiffModalOpen: false,
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

  updateCategory: (categoryId, updates) => {
    const { proportionReport } = get();
    if (!proportionReport) return;
    set({
      proportionReport: {
        ...proportionReport,
        categories: proportionReport.categories.map((c) =>
          c.id === categoryId ? { ...c, ...updates } : c
        ),
      },
    });
  },

  addCategory: (name, options) => {
    const { proportionReport } = get();
    if (!proportionReport) return;
    const newCat = {
      id: `cat_${Date.now()}`,
      name,
      color: options?.color || "#38bdf8",
      ratio: 0,
      targetRatio: 0,
      description: options?.description || "用户自定义分类",
      matchCount: 0,
      keywords: options?.keywords || [],
      associatedRuleId: options?.associatedRuleId,
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

    syncSnapshotCookie(get().fileName, updatedTabs.length);

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

    syncSnapshotCookie(get().fileName, updatedTabs.length);

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
  setAiChatMessages: (messages) => set({ aiChatMessages: messages }),
  addAiChatMessage: (message) =>
    set((state) => {
      const isDiffNotice =
        message.sender === "system" &&
        (Boolean(message.appliedSchemeId) || /^已生成【.*】差分/.test(message.text || ""));
      const baseMessages = isDiffNotice
        ? state.aiChatMessages.filter(
            (m) =>
              !(
                m.sender === "system" &&
                (Boolean(m.appliedSchemeId) || /^已生成【.*】差分/.test(m.text || ""))
              )
          )
        : state.aiChatMessages;
      const nextMessages = [...baseMessages, message];
      const now = Date.now();
      let sessionId = state.activeChatSessionId;
      let nextSessions = [...(state.aiChatSessions || [])];

      if (!sessionId) {
        sessionId = `chat_${now}`;
        const firstUserText =
          nextMessages.find((m) => m.sender === "user")?.text ||
          message.text ||
          "新对话";
        const autoTitle = firstUserText.trim().slice(0, 24) || "新对话";
        nextSessions = [
          { id: sessionId, title: autoTitle, updatedAt: now, messages: nextMessages },
          ...nextSessions,
        ];
      } else {
        const exists = nextSessions.some((s) => s.id === sessionId);
        if (exists) {
          nextSessions = nextSessions.map((s) =>
            s.id === sessionId ? { ...s, updatedAt: now, messages: nextMessages } : s
          );
        } else {
          const firstUserText =
            nextMessages.find((m) => m.sender === "user")?.text || "新对话";
          nextSessions = [
            {
              id: sessionId,
              title: firstUserText.trim().slice(0, 24) || "新对话",
              updatedAt: now,
              messages: nextMessages,
            },
            ...nextSessions,
          ];
        }
      }

      return {
        aiChatMessages: nextMessages,
        activeChatSessionId: sessionId,
        aiChatSessions: nextSessions,
      };
    }),
  updateSchemeInChat: (messageId, updatedScheme) =>
    set((state) => {
      const nextMessages = state.aiChatMessages.map((msg) => {
        if (msg.id !== messageId || !msg.schemes) return msg;
        return {
          ...msg,
          schemes: msg.schemes.map((s) => (s.id === updatedScheme.id ? updatedScheme : s)),
        };
      });
      const nextSessions = state.activeChatSessionId
        ? (state.aiChatSessions || []).map((s) =>
            s.id === state.activeChatSessionId ? { ...s, messages: nextMessages } : s
          )
        : state.aiChatSessions || [];
      return {
        aiChatMessages: nextMessages,
        aiChatSessions: nextSessions,
      };
    }),
  clearAiChatMessages: () => set({ aiChatMessages: [], activeChatSessionId: null }),
  startNewAiChat: () => set({ aiChatMessages: [], activeChatSessionId: null }),
  selectAiChatSession: (sessionId) =>
    set((state) => {
      const target = (state.aiChatSessions || []).find((s) => s.id === sessionId);
      if (!target) return state;
      return {
        activeChatSessionId: target.id,
        aiChatMessages: target.messages || [],
      };
    }),
  renameAiChatSession: (sessionId, newTitle) =>
    set((state) => {
      const clean = newTitle.trim();
      if (!clean) return state;
      return {
        aiChatSessions: (state.aiChatSessions || []).map((s) =>
          s.id === sessionId ? { ...s, title: clean } : s
        ),
      };
    }),
  deleteAiChatSession: (sessionId) =>
    set((state) => {
      const remaining = (state.aiChatSessions || []).filter((s) => s.id !== sessionId);
      const deletingActive = state.activeChatSessionId === sessionId;
      return {
        aiChatSessions: remaining,
        activeChatSessionId: deletingActive ? null : state.activeChatSessionId,
        aiChatMessages: deletingActive ? [] : state.aiChatMessages,
      };
    }),
  setIsAIDiffModalOpen: (open) => set({ isAIDiffModalOpen: open }),
  setActiveMergeReport: (report: AIMergeReport | null) => set({ activeMergeReport: report }),
  setIsOverviewHopupOpen: (open) => set({ isOverviewHopupOpen: open }),

  updateProcessedTreeTarget: (targetMode, targetPanelId, options) => {
    const { aiProcessedCache } = get();
    if (!aiProcessedCache) return;

    const classificationMap = new Map<string, string>(Object.entries(aiProcessedCache.classificationMap));
    const categories = aiProcessedCache.categoryNames.map((name, i) => ({ id: `cat_${i}`, name }));

    const { crossPanelMerge, createGroupTabs } = useConfigStore.getState();
    const resolvedCrossPanelMerge =
      targetMode === "panel" ? true : (options?.crossPanelMerge ?? crossPanelMerge);

    const { processedSnapshot } = buildProcessedSnapshot(
      aiProcessedCache.originalSnapshot,
      classificationMap,
      categories,
      targetMode,
      targetMode === "tree" ? targetPanelId : undefined,
      { crossPanelMerge: resolvedCrossPanelMerge, createGroupTabs }
    );

    const updatedCache: AIProcessedCache = {
      ...aiProcessedCache,
      processedSnapshot,
      targetMode,
      targetPanelId: targetMode === "tree" ? targetPanelId : undefined,
    };

    set({
      aiProcessedCache: updatedCache,
    });
  },

  clearAllCache: () => {
    clearSnapshotCookies();
    void snapshotStorage.removeItem?.(SNAPSHOT_STORAGE_KEY);
    set({
      rawSnapshot: null,
      initialSnapshot: null,
      initialLoadedAt: null,
      fileName: "",
      rawFileSize: 0,
      activeWindowId: "1",
      activePanelId: null,
      panelFilter: null,
      containerFilter: null,
      rootNodes: [],
      selectedIds: new Set<string>(),
      expandedIds: new Set<string>(),
      searchQuery: "",
      onlyDuplicates: false,
      onlyPinned: false,
      duplicateUrls: new Set<string>(),
      lastChangedIds: new Set<string>(),
      proportionReport: null,
      isAnalyzing: false,
      isClassifying: false,
      progressStatus: "",
      classificationProgress: { current: 0, total: 0 },
      aiProcessedCache: null,
      aiChatMessages: [],
      aiChatSessions: [],
      activeChatSessionId: null,
      isAIDiffModalOpen: false,
      activeMergeReport: null,
      isOverviewHopupOpen: false,
      undoStack: [],
      redoStack: [],
    });
  },
}),
    {
      name: SNAPSHOT_STORAGE_KEY,
      storage: createJSONStorage(() => snapshotStorage),
      partialize: (state) => ({
        rawSnapshot: state.rawSnapshot,
        initialSnapshot: state.initialSnapshot,
        initialLoadedAt: state.initialLoadedAt,
        fileName: state.fileName,
        rawFileSize: state.rawFileSize,
        activeWindowId: state.activeWindowId,
        activePanelId: state.activePanelId,
        proportionReport: state.proportionReport,
        aiChatMessages: state.aiChatMessages.slice(-20),
        aiChatSessions: (state.aiChatSessions || []).slice(0, 25),
        activeChatSessionId: state.activeChatSessionId,
        undoStack: state.undoStack.slice(-5),
        redoStack: state.redoStack.slice(-5),
      }),
      merge: (persistedState: any, currentState: SnapshotStoreState) => {
        if (!persistedState) return currentState;
        const activeWinId = persistedState.activeWindowId || currentState.activeWindowId || "1";
        const tabs = persistedState.rawSnapshot?.windows?.[activeWinId]?.tabs || [];
        const rootNodes =
          Array.isArray(persistedState.rootNodes) && persistedState.rootNodes.length > 0
            ? persistedState.rootNodes
            : buildTabTree(tabs);
        const duplicates = getDuplicateUrlSet(tabs);
        const initialExpanded = new Set<string>(rootNodes.map((n: any) => n.id));
        return {
          ...currentState,
          ...persistedState,
          rootNodes,
          initialSnapshot: persistedState.initialSnapshot || persistedState.rawSnapshot || null,
          initialLoadedAt: persistedState.initialLoadedAt || null,
          duplicateUrls: duplicates,
          expandedIds: initialExpanded,
          selectedIds: new Set<string>(),
          isAIDiffModalOpen: false,
          activeMergeReport: null,
          isOverviewHopupOpen: false,
          aiChatMessages: Array.isArray(persistedState.aiChatMessages) ? persistedState.aiChatMessages : [],
          aiChatSessions: Array.isArray(persistedState.aiChatSessions) ? persistedState.aiChatSessions : [],
          activeChatSessionId: persistedState.activeChatSessionId || null,
        };
      },
      onRehydrateStorage: () => (state) => {
        if (state && state.rawSnapshot && typeof document !== "undefined") {
          const tabs = state.rawSnapshot.windows?.[state.activeWindowId || "1"]?.tabs || [];
          syncSnapshotCookie(state.fileName, tabs.length);
        }
      },
    }
  )
);
