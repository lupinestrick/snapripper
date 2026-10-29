import { SideberyTab, TabTreeNode, SideberyPanel, SideberyContainer } from "@/types/sidebery";
import { cleanUrlForAI } from "@/utils/urlHelper";

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

export function reorganizeTreeIntoCategories(
  rootNodes: TabTreeNode[],
  classificationMap: Map<string, string>,
  categoryNames: string[]
): TabTreeNode[] {
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

    const headerId = String(++virtualIdCounter);
    const headerTab: SideberyTab = {
      id: headerId,
      panelId: bucket[0]?.tab.panelId || "main",
      parentId: -1,
      lvl: 0,
      title: `📁 [${catName}] (${bucket.length})`,
      url: `about:blank#category=${encodeURIComponent(catName)}`,
      customTitle: `📁 [${catName}]`,
      folded: false,
    };

    const headerNode: TabTreeNode = {
      id: headerId,
      tab: headerTab,
      depth: 0,
      isCategoryHeader: true,
      categoryName: catName,
      children: bucket.map((child) => ({
        ...child,
        depth: 1,
        tab: {
          ...child.tab,
          parentId: headerId,
          lvl: 1,
        },
      })),
    };

    finalTree.push(headerNode);
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
