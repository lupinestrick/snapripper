import { SideberySnapshot, SideberyTab, TabTreeNode, PanelDiffResult, RulesSettings } from "@/types/sidebery";
import { buildTabTree, flattenTabTree } from "./snapshotParser";
import { applyRulesToTreeNodes, deduplicateTreeNodes, matchTabWithRule } from "./ruleEngine";
import { applyDomainMergeToTreeNodes, DomainMergeConfig } from "./domainMergeEngine";
import { reorganizeTreeIntoCategories, determineTargetPanelForCategory } from "./treeOperations";
import { isExemptUrl } from "@/utils/urlHelper";

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
  crossPanelMerge?: boolean;
  createGroupTabs?: boolean;
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
  const allTabs = (snapshot.windows[primaryWinId]?.tabs || []).map((t) => ({ ...t }));

  // Determine effective panels based on scope
  let effectivePanelIds: Set<string> | null = null;
  if (options.scope === "current" && options.currentActivePanelId) {
    effectivePanelIds = new Set([options.currentActivePanelId]);
  } else if (options.scope === "selected" && options.targetPanelIds && options.targetPanelIds.length > 0) {
    effectivePanelIds = new Set(options.targetPanelIds);
  }

  const shouldCrossPanelMerge = options.crossPanelMerge ?? rulesSettings.crossPanelMerge ?? true;

  // 跨面板合并预处理：将属于同一规则或 AI 类别的标签合并到此类标签最多的面板
  if (shouldCrossPanelMerge) {
    // 1. 规则跨面板聚合
    if (options.enableRules) {
      const activeRules = rulesSettings.rules.filter((r) => r.enabled);
      for (const rule of activeRules) {
        const threshold = rule.minThreshold || rulesSettings.defaultMinThreshold || 2;
        const matchedTabs = allTabs.filter((t) => {
          const pId = t.panelId || "main";
          if (effectivePanelIds && !effectivePanelIds.has(pId)) return false;
          if (t.pinned || isExemptUrl(t.url, t.pinned)) return false;
          return matchTabWithRule(t, rule);
        });

        if (matchedTabs.length >= threshold) {
          const targetPanel = determineTargetPanelForCategory(matchedTabs, matchedTabs[0]?.panelId || "main");
          for (const tab of matchedTabs) {
            tab.panelId = targetPanel;
          }
        }
      }
    }

    // 2. AI 类别跨面板聚合
    if (options.enableAICategorize && options.aiClassificationMap && options.aiCategoryNames) {
      for (const catName of options.aiCategoryNames) {
        const matchedTabs = allTabs.filter((t) => {
          const pId = t.panelId || "main";
          if (effectivePanelIds && !effectivePanelIds.has(pId)) return false;
          if (t.pinned || isExemptUrl(t.url, t.pinned)) return false;
          return options.aiClassificationMap!.get(String(t.id)) === catName;
        });

        if (matchedTabs.length > 0) {
          const targetPanel = determineTargetPanelForCategory(matchedTabs, matchedTabs[0]?.panelId || "main");
          for (const tab of matchedTabs) {
            tab.panelId = targetPanel;
          }
        }
      }
    }
  }

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

      // 4. AI-based category clustering
      if (options.enableAICategorize && options.aiClassificationMap && options.aiCategoryNames) {
        currentTree = reorganizeTreeIntoCategories(
          currentTree,
          options.aiClassificationMap,
          options.aiCategoryNames,
          {
            crossPanelMerge: false, // 已经在预处理阶段根据整体分布精准迁移过 panelId
            createGroupTab: options.createGroupTabs ?? rulesSettings.createGroupTabs ?? true,
            extensionBaseUrl: snapshot.extensionBaseUrl,
          }
        );
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
