import {
  SideberySnapshot,
  SideberyTab,
  TabTreeNode,
  PanelDiffResult,
  RulesSettings,
} from "@/types/sidebery";
import { ClusterGranularity } from "@/types/ai";
import { buildTabTree, flattenTabTree } from "./snapshotParser";
import { applyRulesToTreeNodes, deduplicateTreeNodes, matchTabWithRule } from "./ruleEngine";
import {
  applyDomainMergeToTreeNodes,
  DomainMergeConfig,
  extractDomainByMode,
} from "./domainMergeEngine";
import { reorganizeTreeIntoCategories, determineTargetPanelForCategory } from "./treeOperations";
import { clusterSnapshotTabs } from "./tabClusterEngine";
import { isExemptUrl } from "@/utils/urlHelper";

export type ProcessScope = "current" | "all" | "selected";

export interface ProcessingOptions {
  enableDedup: boolean;
  enableRules: boolean;
  enableDomainMerge?: boolean;
  domainMergeConfig?: DomainMergeConfig;
  enableLocalCluster?: boolean;
  clusterGranularity?: ClusterGranularity;
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

function isTabExempted(tab: SideberyTab, options: ProcessingOptions): boolean {
  const exemptPinned = options.exemptPinned ?? true;
  const exemptInternal = options.exemptInternalPages ?? true;

  if (tab.pinned) return exemptPinned;
  if (!exemptInternal) return false;
  return isExemptUrl(tab.url, false);
}

function getEffectivePanelIds(options: ProcessingOptions): Set<string> | null {
  if (options.scope === "current" && options.currentActivePanelId) {
    return new Set([options.currentActivePanelId]);
  }
  if (
    options.scope === "selected" &&
    options.targetPanelIds &&
    options.targetPanelIds.length > 0
  ) {
    return new Set(options.targetPanelIds);
  }
  return null;
}

/**
 * 将本地微簇聚类应用到当前树中尚未归组的散装节点（保持已有规则组、域名组与父子树完整）
 */
function applyLocalClusterToTreeNodes(
  nodes: TabTreeNode[],
  options: ProcessingOptions,
  extensionBaseUrl: string
): { newNodes: TabTreeNode[]; groupsCreated: number } {
  const preserveSubtrees = options.preserveSubtrees ?? true;
  const createGroupTab = options.createGroupTabs ?? true;
  const granularity = options.clusterGranularity || "balanced";

  const pinnedOrGrouped: TabTreeNode[] = [];
  const looseNodes: TabTreeNode[] = [];

  for (const node of nodes) {
    const isExemptNode =
      (node.isPinned && (options.exemptPinned ?? true)) ||
      (node.isExempt && !node.isPinned && (options.exemptInternalPages ?? true));
    const isAlreadyGrouped = Boolean(node.isGroup || node.isCategoryHeader);
    const isProtectedSubtree =
      preserveSubtrees && Boolean(node.children && node.children.length > 0);

    if (isExemptNode || isAlreadyGrouped || isProtectedSubtree) {
      pinnedOrGrouped.push(node);
    } else {
      looseNodes.push(node);
    }
  }

  if (looseNodes.length < 2) {
    return { newNodes: nodes, groupsCreated: 0 };
  }

  const looseTabs = looseNodes.map((n) => n.tab);
  const report = clusterSnapshotTabs(looseTabs, undefined, granularity);

  // 仅对包含 >= 2 个标签的高纯度微簇建立分组，避免出现单页空壳组
  const validClusters = report.clusters.filter(
    (c) => c.tabCount >= 2 && c.cohesionReason !== "tail_misc"
  );
  if (validClusters.length === 0) {
    return { newNodes: nodes, groupsCreated: 0 };
  }

  const tabIdToClusterName = new Map<string, string>();
  const clusterNames: string[] = [];

  for (const clu of validClusters) {
    clusterNames.push(clu.labelHint);
    for (const tid of clu.tabIds) {
      tabIdToClusterName.set(String(tid), clu.labelHint);
    }
  }

  const panelIdFallback = looseNodes[0]?.tab.panelId || "main";
  const bucketMap = new Map<string, TabTreeNode[]>();
  const leftoverLoose: TabTreeNode[] = [];

  for (const node of looseNodes) {
    const label = tabIdToClusterName.get(String(node.id));
    if (label) {
      if (!bucketMap.has(label)) bucketMap.set(label, []);
      bucketMap.get(label)!.push(node);
    } else {
      leftoverLoose.push(node);
    }
  }

  let virtualCounter = 850000;
  const clusterHeaderNodes: TabTreeNode[] = [];
  let groupsCreated = 0;

  for (const label of clusterNames) {
    const bucket = bucketMap.get(label);
    if (!bucket || bucket.length < 2) {
      if (bucket) leftoverLoose.push(...bucket);
      continue;
    }

    const targetPanel = bucket[0]?.tab.panelId || panelIdFallback;
    const headerId = createGroupTab
      ? `group_clu_${++virtualCounter}_${Date.now()}`
      : String(++virtualCounter);
    const headerUrl = createGroupTab
      ? `${extensionBaseUrl}/sidebery/group.html#${encodeURIComponent(label)}`
      : `about:blank#cluster=${encodeURIComponent(label)}`;
    const headerTitle = createGroupTab ? label : `📁 [${label}] (${bucket.length})`;

    const headerTab: SideberyTab = {
      id: headerId,
      panelId: targetPanel,
      parentId: -1,
      lvl: 0,
      title: headerTitle,
      url: headerUrl,
      folded: true,
      isGroup: createGroupTab,
      customTitle: createGroupTab ? null : `📁 [${label}]`,
    };

    clusterHeaderNodes.push({
      id: headerId,
      tab: headerTab,
      depth: 0,
      isCategoryHeader: true,
      isGroup: createGroupTab,
      categoryName: label,
      children: bucket.map((child) => ({
        ...child,
        depth: 1,
        tab: {
          ...child.tab,
          panelId: targetPanel,
          parentId: headerId,
          lvl: 1,
        },
      })),
    });

    groupsCreated++;
  }

  return {
    newNodes: [...pinnedOrGrouped, ...clusterHeaderNodes, ...leftoverLoose],
    groupsCreated,
  };
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
  const effectivePanelIds = getEffectivePanelIds(options);
  const shouldCrossPanelMerge =
    options.crossPanelMerge ?? rulesSettings.crossPanelMerge ?? true;
  const extensionBaseUrl =
    snapshot.extensionBaseUrl || "moz-extension://sidebery-placeholder";

  // 跨面板合并预处理：按优先级将跨面板散落标签聚合到主体面板
  if (shouldCrossPanelMerge) {
    // 1. 规则跨面板聚合（支持 moveToPanel / groupAndMove 指定目标面板与 exempt 跳过）
    if (options.enableRules) {
      const activeRules = rulesSettings.rules.filter((r) => r.enabled);
      for (const rule of activeRules) {
        const actionType = rule.action?.type || "group";
        if (actionType === "exempt") continue;

        const threshold =
          actionType === "moveToPanel"
            ? 1
            : rule.minThreshold || rulesSettings.defaultMinThreshold || 2;

        const matchedTabs = allTabs.filter((t) => {
          const pId = t.panelId || "main";
          if (effectivePanelIds && !effectivePanelIds.has(pId)) return false;
          if (isTabExempted(t, options)) return false;
          return matchTabWithRule(t, rule);
        });

        if (matchedTabs.length >= threshold) {
          const explicitPanel =
            (actionType === "moveToPanel" || actionType === "groupAndMove") &&
            rule.action?.targetPanelId
              ? rule.action.targetPanelId
              : undefined;
          const targetPanel =
            explicitPanel ||
            determineTargetPanelForCategory(
              matchedTabs,
              matchedTabs[0]?.panelId || "main"
            );
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
          if (isTabExempted(t, options)) return false;
          return options.aiClassificationMap!.get(String(t.id)) === catName;
        });

        if (matchedTabs.length > 0) {
          const targetPanel = determineTargetPanelForCategory(
            matchedTabs,
            matchedTabs[0]?.panelId || "main"
          );
          for (const tab of matchedTabs) {
            tab.panelId = targetPanel;
          }
        }
      }
    }

    // 3. 同域名跨面板聚合
    if (options.enableDomainMerge && options.domainMergeConfig) {
      const domainMap = new Map<string, SideberyTab[]>();
      for (const tab of allTabs) {
        const pId = tab.panelId || "main";
        if (effectivePanelIds && !effectivePanelIds.has(pId)) continue;
        if (isTabExempted(tab, options)) continue;
        const domain = extractDomainByMode(
          tab.url,
          options.domainMergeConfig.matchMode,
          options.domainMergeConfig.customPattern
        );
        if (domain) {
          if (!domainMap.has(domain)) domainMap.set(domain, []);
          domainMap.get(domain)!.push(tab);
        }
      }

      const threshold = options.domainMergeConfig.minThreshold || 2;
      for (const [, tabs] of domainMap.entries()) {
        if (tabs.length >= threshold) {
          const targetPanel = determineTargetPanelForCategory(
            tabs,
            tabs[0]?.panelId || "main"
          );
          for (const tab of tabs) {
            tab.panelId = targetPanel;
          }
        }
      }
    }

    // 4. Option B 本地微簇跨面板聚合
    if (options.enableLocalCluster) {
      const scopedNonExempt = allTabs.filter((t) => {
        const pId = t.panelId || "main";
        if (effectivePanelIds && !effectivePanelIds.has(pId)) return false;
        return !isTabExempted(t, options);
      });
      const report = clusterSnapshotTabs(
        scopedNonExempt,
        panels,
        options.clusterGranularity || "balanced"
      );
      const tabById = new Map(allTabs.map((t) => [String(t.id), t]));
      for (const clu of report.clusters) {
        if (clu.tabCount < 2 || clu.cohesionReason === "tail_misc") continue;
        const cluTabs = clu.tabIds
          .map((id) => tabById.get(id))
          .filter((t): t is SideberyTab => Boolean(t));
        if (cluTabs.length < 2) continue;
        const targetPanel = determineTargetPanelForCategory(
          cluTabs,
          cluTabs[0]?.panelId || "main"
        );
        for (const tab of cluTabs) {
          tab.panelId = targetPanel;
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

    const isPanelInScope = !effectivePanelIds || effectivePanelIds.has(panelId);

    if (isPanelInScope) {
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
          extensionBaseUrl
        );
        currentTree = ruleResult.newNodes;
        panelGroupsCreated += ruleResult.groupsCreated;
        totalGroupsCreated += ruleResult.groupsCreated;
      }

      // 3. Same-Domain Tabs Merge
      if (options.enableDomainMerge && options.domainMergeConfig) {
        const domainResult = applyDomainMergeToTreeNodes(
          currentTree,
          options.domainMergeConfig,
          {
            exemptPinned: options.exemptPinned ?? true,
            exemptInternalPages: options.exemptInternalPages ?? true,
            preserveSubtrees: options.preserveSubtrees ?? true,
            treatExistingGroupsAsUnit: rulesSettings.treatExistingGroupsAsUnit ?? true,
            extensionBaseUrl,
          }
        );
        currentTree = domainResult.newNodes;
        panelGroupsCreated += domainResult.groupsCreated;
        totalGroupsCreated += domainResult.groupsCreated;
      }

      // 4. Option B Local Micro-Cluster Grouping
      if (options.enableLocalCluster) {
        const clusterResult = applyLocalClusterToTreeNodes(
          currentTree,
          options,
          extensionBaseUrl
        );
        currentTree = clusterResult.newNodes;
        panelGroupsCreated += clusterResult.groupsCreated;
        totalGroupsCreated += clusterResult.groupsCreated;
      }

      // 5. AI-based category clustering
      if (
        options.enableAICategorize &&
        options.aiClassificationMap &&
        options.aiCategoryNames
      ) {
        currentTree = reorganizeTreeIntoCategories(
          currentTree,
          options.aiClassificationMap,
          options.aiCategoryNames,
          {
            crossPanelMerge: false,
            createGroupTab: options.createGroupTabs ?? rulesSettings.createGroupTabs ?? true,
            extensionBaseUrl,
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
