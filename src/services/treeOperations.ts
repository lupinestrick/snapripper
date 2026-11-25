import { SideberyTab, TabTreeNode, SideberyPanel, SideberyContainer } from "@/types/sidebery";
import { cleanUrlForAI, isExemptUrl } from "@/utils/urlHelper";

export function filterTree(
  nodes: TabTreeNode[],
  query: string,
  options?: {
    containerId?: string;
    panelId?: string;
    showOnlyDuplicates?: boolean;
    duplicateUrls?: Set<string>;
  }
): TabTreeNode[] {
  const q = query.trim().toLowerCase();

  function matchNode(node: TabTreeNode): boolean {
    if (options?.containerId && node.tab.containerId !== options.containerId) return false;
    if (options?.panelId && node.tab.panelId !== options.panelId) return false;
    if (options?.showOnlyDuplicates && options.duplicateUrls) {
      if (!options.duplicateUrls.has(node.tab.url)) return false;
    }

    if (!q) return true;
    const titleMatch = node.tab.title?.toLowerCase().includes(q);
    const urlMatch = node.tab.url?.toLowerCase().includes(q);
    return !!(titleMatch || urlMatch);
  }

  function filterRecursive(nodeList: TabTreeNode[]): TabTreeNode[] {
    const filtered: TabTreeNode[] = [];

    for (const node of nodeList) {
      const filteredChildren = filterRecursive(node.children);
      const isSelfMatch = matchNode(node);

      if (isSelfMatch || filteredChildren.length > 0) {
        filtered.push({
          ...node,
          children: filteredChildren,
        });
      }
    }

    return filtered;
  }

  return filterRecursive(nodes);
}

export function getDuplicateUrlSet(tabs: SideberyTab[]): Set<string> {
  const urlCount = new Map<string, number>();
  for (const tab of tabs) {
    if (!tab.url || tab.url.startsWith("about:")) continue;
    urlCount.set(tab.url, (urlCount.get(tab.url) || 0) + 1);
  }

  const duplicates = new Set<string>();
  for (const [url, count] of urlCount.entries()) {
    if (count > 1) {
      duplicates.add(url);
    }
  }
  return duplicates;
}

export function batchDeleteNodes(
  nodes: TabTreeNode[],
  idsToDelete: Set<string>,
  cascade = false
): TabTreeNode[] {
  function process(list: TabTreeNode[]): TabTreeNode[] {
    const result: TabTreeNode[] = [];

    for (const node of list) {
      if (idsToDelete.has(node.id)) {
        if (!cascade && node.children.length > 0) {
          const processedChildren = process(node.children);
          result.push(...processedChildren);
        }
      } else {
        result.push({
          ...node,
          children: process(node.children),
        });
      }
    }

    return result;
  }

  return process(nodes);
}

export function batchUpdatePanel(
  nodes: TabTreeNode[],
  idsToUpdate: Set<string>,
  targetPanelId: string
): TabTreeNode[] {
  return nodes.map((node) => {
    const isTarget = idsToUpdate.has(node.id);
    return {
      ...node,
      tab: isTarget ? { ...node.tab, panelId: targetPanelId } : node.tab,
      children: batchUpdatePanel(node.children, idsToUpdate, targetPanelId),
    };
  });
}

export function batchUpdatePinned(
  nodes: TabTreeNode[],
  idsToUpdate: Set<string>,
  pinned: boolean
): TabTreeNode[] {
  return nodes.map((node) => {
    const isTarget = idsToUpdate.has(node.id);
    return {
      ...node,
      isPinned: isTarget ? pinned : node.isPinned,
      tab: isTarget ? { ...node.tab, pinned } : node.tab,
      children: batchUpdatePinned(node.children, idsToUpdate, pinned),
    };
  });
}

/**
 * 根据类别各面板出现的频次，推导该类别应当归并的目标面板（默认为该类型标签最多的面板）
 */
export function determineTargetPanelForCategory(
  categoryTabs: SideberyTab[],
  fallbackPanelId: string = "main"
): string {
  if (categoryTabs.length === 0) return fallbackPanelId;
  const panelCounts = new Map<string, number>();
  for (const tab of categoryTabs) {
    const pId = tab.panelId || "main";
    panelCounts.set(pId, (panelCounts.get(pId) || 0) + 1);
  }
  let bestPanel = fallbackPanelId;
  let maxCount = -1;
  for (const [pId, count] of panelCounts.entries()) {
    if (count > maxCount) {
      maxCount = count;
      bestPanel = pId;
    }
  }
  return bestPanel;
}

export function reorganizeTreeIntoCategories(
  rootNodes: TabTreeNode[],
  classificationMap: Map<string, string>,
  categoryNames: string[],
  options?: {
    crossPanelMerge?: boolean;
    createGroupTab?: boolean;
    extensionBaseUrl?: string;
    targetPanelId?: string;
  }
): TabTreeNode[] {
  const isGroup = options?.createGroupTab ?? true;
  const extensionBaseUrl = options?.extensionBaseUrl || "moz-extension://sidebery-placeholder";
  const crossPanelMerge = options?.crossPanelMerge ?? true;

  const exemptNodes: TabTreeNode[] = [];
  const categorizedBuckets = new Map<string, TabTreeNode[]>();

  categoryNames.forEach((cat) => categorizedBuckets.set(cat, []));
  const uncategorizedBucket: TabTreeNode[] = [];

  for (const node of rootNodes) {
    if (node.isExempt || node.isPinned) {
      exemptNodes.push(node);
      continue;
    }

    const assignedCategory = classificationMap.get(node.id);
    if (assignedCategory && categorizedBuckets.has(assignedCategory)) {
      categorizedBuckets.get(assignedCategory)!.push(node);
    } else {
      uncategorizedBucket.push(node);
    }
  }

  const finalTree: TabTreeNode[] = [...exemptNodes];
  let virtualIdCounter = 900000;

  for (const catName of categoryNames) {
    const bucket = categorizedBuckets.get(catName) || [];
    if (bucket.length === 0) continue;

    if (options?.targetPanelId) {
      // 显式指定目标面板
      const targetPanel = options.targetPanelId;
      const headerId = isGroup ? `group_cat_${++virtualIdCounter}_${Date.now()}` : String(++virtualIdCounter);
      const headerUrl = isGroup
        ? `${extensionBaseUrl}/sidebery/group.html#${encodeURIComponent(catName)}`
        : `about:blank#category=${encodeURIComponent(catName)}`;
      const headerTitle = isGroup ? catName : `📁 [${catName}] (${bucket.length})`;

      const headerTab: SideberyTab = {
        id: headerId,
        panelId: targetPanel,
        parentId: -1,
        lvl: 0,
        title: headerTitle,
        url: headerUrl,
        folded: true,
        isGroup,
        customTitle: isGroup ? null : `📁 [${catName}]`,
      };

      const headerNode: TabTreeNode = {
        id: headerId,
        tab: headerTab,
        depth: 0,
        isCategoryHeader: true,
        isGroup,
        categoryName: catName,
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
      };

      finalTree.push(headerNode);
    } else if (crossPanelMerge) {
      // 跨面板合并：默认合并到此类标签最多的面板
      const targetPanel = determineTargetPanelForCategory(
        bucket.map((n) => n.tab),
        bucket[0]?.tab.panelId || "main"
      );

      const headerId = isGroup ? `group_cat_${++virtualIdCounter}_${Date.now()}` : String(++virtualIdCounter);
      const headerUrl = isGroup
        ? `${extensionBaseUrl}/sidebery/group.html#${encodeURIComponent(catName)}`
        : `about:blank#category=${encodeURIComponent(catName)}`;
      const headerTitle = isGroup ? catName : `📁 [${catName}] (${bucket.length})`;

      const headerTab: SideberyTab = {
        id: headerId,
        panelId: targetPanel,
        parentId: -1,
        lvl: 0,
        title: headerTitle,
        url: headerUrl,
        folded: true,
        isGroup,
        customTitle: isGroup ? null : `📁 [${catName}]`,
      };

      const headerNode: TabTreeNode = {
        id: headerId,
        tab: headerTab,
        depth: 0,
        isCategoryHeader: true,
        isGroup,
        categoryName: catName,
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
      };

      finalTree.push(headerNode);
    } else {
      // 不跨面板合并：保持在各自原始面板中，分别形成该面板的组
      const panelSubBuckets = new Map<string, TabTreeNode[]>();
      for (const node of bucket) {
        const pId = node.tab.panelId || "main";
        if (!panelSubBuckets.has(pId)) {
          panelSubBuckets.set(pId, []);
        }
        panelSubBuckets.get(pId)!.push(node);
      }

      for (const [panelId, subBucket] of panelSubBuckets.entries()) {
        const headerId = isGroup ? `group_cat_${++virtualIdCounter}_${Date.now()}` : String(++virtualIdCounter);
        const headerUrl = isGroup
          ? `${extensionBaseUrl}/sidebery/group.html#${encodeURIComponent(catName)}`
          : `about:blank#category=${encodeURIComponent(catName)}`;
        const headerTitle = isGroup ? catName : `📁 [${catName}] (${subBucket.length})`;

        const headerTab: SideberyTab = {
          id: headerId,
          panelId,
          parentId: -1,
          lvl: 0,
          title: headerTitle,
          url: headerUrl,
          folded: true,
          isGroup,
          customTitle: isGroup ? null : `📁 [${catName}]`,
        };

        const headerNode: TabTreeNode = {
          id: headerId,
          tab: headerTab,
          depth: 0,
          isCategoryHeader: true,
          isGroup,
          categoryName: catName,
          children: subBucket.map((child) => ({
            ...child,
            depth: 1,
            tab: {
              ...child.tab,
              panelId,
              parentId: headerId,
              lvl: 1,
            },
          })),
        };

        finalTree.push(headerNode);
      }
    }
  }

  if (uncategorizedBucket.length > 0) {
    const headerId = String(++virtualIdCounter);
    finalTree.push({
      id: headerId,
      tab: {
        id: headerId,
        panelId: "main",
        parentId: -1,
        lvl: 0,
        title: `📁 [未分类] (${uncategorizedBucket.length})`,
        url: "about:blank#category=uncategorized",
        folded: false,
      },
      depth: 0,
      isCategoryHeader: true,
      categoryName: "未分类",
      children: uncategorizedBucket,
    });
  }

  return finalTree;
}

export function reorganizeTabsIntoPanels(
  tabs: SideberyTab[],
  classificationMap: Map<string, string>,
  categories: { id: string; name: string }[],
  existingPanels: Record<string, SideberyPanel> = {}
): { tabs: SideberyTab[]; panels: Record<string, SideberyPanel> } {
  const panels: Record<string, SideberyPanel> = { ...existingPanels };
  const catToPanelId = new Map<string, string>();

  categories.forEach((cat, index) => {
    const panelId = `panel_cat_${index + 1}`;
    catToPanelId.set(cat.name, panelId);
    if (!panels[panelId]) {
      panels[panelId] = {
        id: panelId,
        name: cat.name,
        color: "toolbar",
      };
    }
  });

  const updatedTabs = tabs.map((tab) => {
    if (tab.pinned || tab.url?.startsWith("about:")) return tab;
    const catName = classificationMap.get(String(tab.id));
    if (catName && catToPanelId.has(catName)) {
      return {
        ...tab,
        panelId: catToPanelId.get(catName)!,
      };
    }
    return tab;
  });

  return { tabs: updatedTabs, panels };
}

export function deduplicateTreeNodes(nodes: TabTreeNode[]): {
  newNodes: TabTreeNode[];
  removedCount: number;
} {
  const seenUrls = new Set<string>();
  let removedCount = 0;

  function processList(list: TabTreeNode[]): TabTreeNode[] {
    const filtered: TabTreeNode[] = [];

    for (const node of list) {
      if (node.isGroup) {
        const cleanedChildren = processList(node.children);
        filtered.push({
          ...node,
          children: cleanedChildren,
        });
        continue;
      }

      const normalized = (node.tab.url || "").replace(/#.*$/, "").trim();
      if (!normalized || isExemptUrl(normalized, node.tab.pinned)) {
        filtered.push(node);
        continue;
      }

      if (seenUrls.has(normalized)) {
        removedCount += 1;
        continue;
      }

      seenUrls.add(normalized);
      const cleanedChildren = processList(node.children);
      filtered.push({
        ...node,
        children: cleanedChildren,
      });
    }

    return filtered;
  }

  return {
    newNodes: processList(nodes),
    removedCount,
  };
}
