import { SideberySnapshot, SideberyTab, TabTreeNode, PanelDiffResult, RulesSettings } from "@/types/sidebery";
import { buildTabTree, flattenTabTree } from "./snapshotParser";
import { applyRulesToTreeNodes, deduplicateTreeNodes } from "./ruleEngine";
import { applyDomainMergeToTreeNodes, DomainMergeConfig } from "./domainMergeEngine";

export type ProcessScope = "current" | "all" | "selected";

export interface ProcessingOptions {
  enableDedup: boolean;
  enableRules: boolean;
  enableDomainMerge?: boolean;
  domainMergeConfig?: DomainMergeConfig;
  enableAICategorize: boolean;
  aiClassificationMap?: Map<string, string>;
  aiCategoryNames?: string[];

  // Scope
  scope?: ProcessScope;
  targetPanelIds?: string[];
  currentActivePanelId?: string;

  // Organization settings
  exemptPinned?: boolean;
  exemptInternalPages?: boolean;
  preserveSubtrees?: boolean;
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

  // Determine effective panels based on scope
  let effectivePanelIds: Set<string> | null = null;
  if (options.scope === "current" && options.currentActivePanelId) {
    effectivePanelIds = new Set([options.currentActivePanelId]);
  } else if (options.scope === "selected" && options.targetPanelIds && options.targetPanelIds.length > 0) {
    effectivePanelIds = new Set(options.targetPanelIds);
  }

  const newTabsByWindow: SideberyTab[] = [];

  for (const [panelId, pTabs] of panelTabsMap.entries()) {
    if (pTabs.length === 0) continue;

    const panelName = panels[panelId]?.name || (panelId === "main" ? "主面板" : panelId);
    const beforeTree = buildTabTree(pTabs);
    let currentTree = beforeTree;
    let panelDeduped = 0;
    let panelGroupsCreated = 0;

    // Check if this panel is within scope
    const isPanelInScope = !effectivePanelIds || effectivePanelIds.has(panelId);

    if (isPanelInScope) {
      // 1. Deduplication
      if (options.enableDedup) {
        const dedupResult = deduplicateTreeNodes(currentTree);
        currentTree = dedupResult.newNodes;
        panelDeduped = dedupResult.removedCount;
        totalDeduped += panelDeduped;
      }

      // 2. Same-Domain Tabs Merge
      if (options.enableDomainMerge && options.domainMergeConfig) {
        const domainResult = applyDomainMergeToTreeNodes(
          currentTree,
          options.domainMergeConfig,
          {
            exemptPinned: options.exemptPinned ?? true,
            exemptInternalPages: options.exemptInternalPages ?? true,
            preserveSubtrees: options.preserveSubtrees ?? true,
            treatExistingGroupsAsUnit: rulesSettings.treatExistingGroupsAsUnit ?? true,
            extensionBaseUrl: snapshot.extensionBaseUrl || "moz-extension://sidebery-placeholder",
          }
        );
        currentTree = domainResult.newNodes;
        panelGroupsCreated += domainResult.groupsCreated;
        totalGroupsCreated += domainResult.groupsCreated;
      }

      // 3. Rule-based clustering
      if (options.enableRules) {
        const ruleResult = applyRulesToTreeNodes(
          currentTree,
          rulesSettings,
          snapshot.extensionBaseUrl || "moz-extension://sidebery-placeholder"
        );
        currentTree = ruleResult.newNodes;
        panelGroupsCreated += ruleResult.groupsCreated;
        totalGroupsCreated += ruleResult.groupsCreated;
      }
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
