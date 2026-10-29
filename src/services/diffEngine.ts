import { SideberySnapshot, SideberyTab, TabTreeNode, PanelDiffResult, RulesSettings } from "@/types/sidebery";
import { buildTabTree, flattenTabTree } from "./snapshotParser";
import { applyRulesToTreeNodes, deduplicateTreeNodes } from "./ruleEngine";

export interface ProcessingOptions {
  enableDedup: boolean;
  enableRules: boolean;
  enableAICategorize: boolean;
  aiClassificationMap?: Map<string, string>;
  aiCategoryNames?: string[];
}

export function computeSnapshotDiff(
  snapshot: SideberySnapshot,
  options: ProcessingOptions,
  rulesSettings: RulesSettings
): {
  panelDiffs: PanelDiffResult[];
  newSnapshot: SideberySnapshot;
  totalDeduped: number;
  totalGroupsCreated: number;
} {
  const panelDiffs: PanelDiffResult[] = [];
  let totalDeduped = 0;
  let totalGroupsCreated = 0;

  const panels = snapshot.panels || {};
  const primaryWinId = Object.keys(snapshot.windows)[0] || "1";
  const allTabs = snapshot.windows[primaryWinId]?.tabs || [];

  // Group tabs by panelId
  const panelTabsMap = new Map<string, SideberyTab[]>();
  for (const t of allTabs) {
    const pId = t.panelId || "main";
    if (!panelTabsMap.has(pId)) {
      panelTabsMap.set(pId, []);
    }
    panelTabsMap.get(pId)!.push(t);
  }

  // Also include panels that exist in snapshot.panels even if empty
  for (const pId of Object.keys(panels)) {
    if (!panelTabsMap.has(pId)) {
      panelTabsMap.set(pId, []);
    }
  }

  const newTabsByWindow: SideberyTab[] = [];

  for (const [panelId, pTabs] of panelTabsMap.entries()) {
    if (pTabs.length === 0) continue;

    const panelName = panels[panelId]?.name || (panelId === "main" ? "主面板" : panelId);
    const beforeTree = buildTabTree(pTabs);
    let currentTree = beforeTree;
    let panelDeduped = 0;
    let panelGroupsCreated = 0;

    // 1. Deduplication
    if (options.enableDedup) {
      const dedupResult = deduplicateTreeNodes(currentTree);
      currentTree = dedupResult.newNodes;
      panelDeduped = dedupResult.removedCount;
      totalDeduped += panelDeduped;
    }

    // 2. Rule-based clustering
    if (options.enableRules) {
      const ruleResult = applyRulesToTreeNodes(
        currentTree,
        rulesSettings,
        snapshot.extensionBaseUrl || "moz-extension://sidebery-placeholder"
      );
      currentTree = ruleResult.newNodes;
      panelGroupsCreated = ruleResult.groupsCreated;
      totalGroupsCreated += panelGroupsCreated;
    }

    const afterTabs = flattenTabTree(currentTree, panelId);
    newTabsByWindow.push(...afterTabs);

    panelDiffs.push({
      panelId,
      panelName,
      beforeTabs: pTabs,
      afterTabs,
      beforeTree,
      afterTree: currentTree,
      addedGroupsCount: panelGroupsCreated,
      dedupedCount: panelDeduped,
    });
  }

  const newSnapshot: SideberySnapshot = {
    ...snapshot,
    windows: {
      ...snapshot.windows,
      [primaryWinId]: {
        tabs: newTabsByWindow,
      },
    },
  };

  return {
    panelDiffs,
    newSnapshot,
    totalDeduped,
    totalGroupsCreated,
  };
}
