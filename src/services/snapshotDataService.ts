import { SideberyPanel, SideberySnapshot, SideberyTab, TabTreeNode } from "@/types/sidebery";
import { buildTabTree, flattenTabTree, isGroupTab } from "./snapshotParser";
import { isExemptUrl } from "@/utils/urlHelper";

export interface SnapshotPanelStat {
  id: string;
  name: string;
  count: number;
  pct: number;
}

export interface SnapshotHealthMetrics {
  totalTabs: number;
  effectiveTabs: number;
  rootNodeCount: number;
  panelCount: number;
  emptyPanelCount: number;
  containerCount: number;
  windowCount: number;
  exemptPinnedCount: number;
  exemptInternalCount: number;
  groupCount: number;
  duplicateTabCount: number;
  estimatedJsonBytes: number;
  panelStats: SnapshotPanelStat[];
}

export interface BaselinePanelDiff {
  panelId: string;
  panelName: string;
  beforeCount: number;
  afterCount: number;
  removedTabs: SideberyTab[];
  movedInTabs: SideberyTab[];
  newGroups: TabTreeNode[];
  changeCount: number;
}

export interface BaselineComparisonResult {
  hasChanges: boolean;
  totalBeforeTabs: number;
  totalAfterTabs: number;
  removedCount: number;
  movedInCount: number;
  newGroupsCount: number;
  panelDiffs: BaselinePanelDiff[];
}

export interface FilteredExportResult {
  snapshot: SideberySnapshot;
  tabs: SideberyTab[];
  effectiveTabCount: number;
  removedDuplicateCount: number;
}

export interface SnapshotComposition {
  totalTabs: number;
  groupedCount: number;
  looseCount: number;
  duplicateTabCount: number;
  exemptCount: number;
}

/**
 * 将标签拆分为互斥的 4 类结构占比：已成组/层级、重复链接、置顶或系统豁免、根级散落待整理。
 */
export function computeSnapshotComposition(
  tabs: SideberyTab[],
  duplicateUrls: Set<string>
): SnapshotComposition {
  let groupedCount = 0;
  let looseCount = 0;
  let duplicateTabCount = 0;
  let exemptCount = 0;

  for (const tab of tabs) {
    if (isGroupTab(tab)) {
      groupedCount++;
      continue;
    }

    if (isExemptUrl(tab.url, tab.pinned)) {
      exemptCount++;
      continue;
    }

    if (tab.url && duplicateUrls.has(tab.url)) {
      duplicateTabCount++;
      continue;
    }

    const hasHierarchy =
      (tab.lvl !== undefined && tab.lvl > 0) ||
      (tab.parentId !== undefined && tab.parentId !== -1 && tab.parentId !== "");

    if (hasHierarchy) {
      groupedCount++;
    } else {
      looseCount++;
    }
  }

  return {
    totalTabs: tabs.length,
    groupedCount,
    looseCount,
    duplicateTabCount,
    exemptCount,
  };
}

function getPanelDisplayName(
  panelId: string,
  panels?: Record<string, SideberyPanel>
): string {
  return panels?.[panelId]?.name || (panelId === "main" ? "主面板" : panelId);
}

/**
 * 计算当前快照的健康体检指标（面板分布、重复数、豁免/固定、分组与预估体积）
 */
export function computeSnapshotHealth(
  snapshot: SideberySnapshot | null,
  rootNodes: TabTreeNode[],
  duplicateUrls: Set<string>,
  activeWindowId: string = "1"
): SnapshotHealthMetrics {
  if (!snapshot) {
    return {
      totalTabs: 0,
      effectiveTabs: 0,
      rootNodeCount: 0,
      panelCount: 0,
      emptyPanelCount: 0,
      containerCount: 0,
      windowCount: 0,
      exemptPinnedCount: 0,
      exemptInternalCount: 0,
      groupCount: 0,
      duplicateTabCount: 0,
      estimatedJsonBytes: 0,
      panelStats: [],
    };
  }

  const windowTabs = snapshot.windows?.[activeWindowId]?.tabs || [];
  const totalTabs = Object.values(snapshot.windows || {}).reduce(
    (acc, w) => acc + (w.tabs?.length || 0),
    0
  );
  const panels = snapshot.panels || {};
  const panelCountMap = new Map<string, number>();

  for (const pId of Object.keys(panels)) {
    panelCountMap.set(pId, 0);
  }

  let exemptPinnedCount = 0;
  let exemptInternalCount = 0;
  let groupCount = 0;
  let duplicateTabCount = 0;
  let effectiveTabs = 0;
  const seenNormalizedUrls = new Set<string>();

  for (const tab of windowTabs) {
    const pId = tab.panelId || "main";
    panelCountMap.set(pId, (panelCountMap.get(pId) || 0) + 1);

    if (isGroupTab(tab)) {
      groupCount++;
      continue;
    }

    if (tab.pinned) {
      exemptPinnedCount++;
    } else if (isExemptUrl(tab.url, false)) {
      exemptInternalCount++;
    } else {
      effectiveTabs++;
      const normUrl = (tab.url || "").replace(/#.*$/, "").trim();
      if (normUrl) {
        if (seenNormalizedUrls.has(normUrl) || duplicateUrls.has(tab.url)) {
          duplicateTabCount++;
        } else {
          seenNormalizedUrls.add(normUrl);
        }
      }
    }
  }

  const panelStats: SnapshotPanelStat[] = Array.from(panelCountMap.entries())
    .map(([id, count]) => ({
      id,
      name: getPanelDisplayName(id, panels),
      count,
      pct: windowTabs.length > 0 ? Math.round((count / windowTabs.length) * 100) : 0,
    }))
    .sort((a, b) => b.count - a.count);

  const emptyPanelCount = panelStats.filter((p) => p.count === 0).length;
  const estimatedJsonBytes = new Blob([JSON.stringify(snapshot, null, 2)]).size;

  return {
    totalTabs,
    effectiveTabs,
    rootNodeCount: rootNodes.length,
    panelCount: panelStats.length,
    emptyPanelCount,
    containerCount: snapshot.containers ? Object.keys(snapshot.containers).length : 0,
    windowCount: snapshot.windows ? Object.keys(snapshot.windows).length : 0,
    exemptPinnedCount,
    exemptInternalCount,
    groupCount,
    duplicateTabCount,
    estimatedJsonBytes,
    panelStats,
  };
}

/**
 * 对比「最初导入原件」与「当前工作台修改态」的面板级差异
 */
export function compareSnapshotsBaseline(
  initialSnapshot: SideberySnapshot | null,
  currentSnapshot: SideberySnapshot | null,
  activeWindowId: string = "1"
): BaselineComparisonResult {
  if (!initialSnapshot || !currentSnapshot) {
    return {
      hasChanges: false,
      totalBeforeTabs: 0,
      totalAfterTabs: 0,
      removedCount: 0,
      movedInCount: 0,
      newGroupsCount: 0,
      panelDiffs: [],
    };
  }

  const initialTabs = initialSnapshot.windows?.[activeWindowId]?.tabs || [];
  const currentTabs = currentSnapshot.windows?.[activeWindowId]?.tabs || [];
  const mergedPanels: Record<string, SideberyPanel> = {
    ...(initialSnapshot.panels || {}),
    ...(currentSnapshot.panels || {}),
  };

  const panelIdSet = new Set<string>(Object.keys(mergedPanels));
  initialTabs.forEach((t) => panelIdSet.add(t.panelId || "main"));
  currentTabs.forEach((t) => panelIdSet.add(t.panelId || "main"));

  const panelDiffs: BaselinePanelDiff[] = [];
  let totalRemoved = 0;
  let totalMovedIn = 0;
  let totalNewGroups = 0;

  for (const panelId of panelIdSet) {
    const beforeTabs = initialTabs.filter((t) => (t.panelId || "main") === panelId);
    const afterTabs = currentTabs.filter((t) => (t.panelId || "main") === panelId);
    const beforeIds = new Set(beforeTabs.map((t) => t.id));
    const afterIds = new Set(afterTabs.map((t) => t.id));

    const removedTabs = beforeTabs.filter((t) => !afterIds.has(t.id));
    const movedInTabs = afterTabs.filter(
      (t) => !beforeIds.has(t.id) && !isGroupTab(t)
    );
    const afterTree = buildTabTree(afterTabs);
    const newGroups = afterTree.filter(
      (n) => (n.isGroup || isGroupTab(n.tab)) && !beforeIds.has(n.tab.id)
    );

    const changeCount = removedTabs.length + movedInTabs.length + newGroups.length;
    totalRemoved += removedTabs.length;
    totalMovedIn += movedInTabs.length;
    totalNewGroups += newGroups.length;

    panelDiffs.push({
      panelId,
      panelName: getPanelDisplayName(panelId, mergedPanels),
      beforeCount: beforeTabs.length,
      afterCount: afterTabs.length,
      removedTabs,
      movedInTabs,
      newGroups,
      changeCount,
    });
  }

  panelDiffs.sort((a, b) => b.changeCount - a.changeCount || b.afterCount - a.afterCount);

  const countChanged = initialTabs.length !== currentTabs.length;
  const orderOrHierarchyChanged =
    !countChanged &&
    initialTabs.some((t, idx) => {
      const cur = currentTabs[idx];
      return !cur || cur.id !== t.id || (cur.panelId || "main") !== (t.panelId || "main") || (cur.lvl || 0) !== (t.lvl || 0);
    });

  return {
    hasChanges:
      totalRemoved > 0 ||
      totalMovedIn > 0 ||
      totalNewGroups > 0 ||
      countChanged ||
      orderOrHierarchyChanged,
    totalBeforeTabs: initialTabs.length,
    totalAfterTabs: currentTabs.length,
    removedCount: totalRemoved,
    movedInCount: totalMovedIn,
    newGroupsCount: totalNewGroups,
    panelDiffs,
  };
}

/**
 * 根据导出选项（面板过滤、导出前去重）安全生成导出副本，不改动当前工作台状态
 */
export function buildFilteredExportSnapshot(
  baseSnapshot: SideberySnapshot,
  rootNodes: TabTreeNode[],
  options?: {
    activeWindowId?: string;
    panelIds?: string[] | null;
    dedupUrls?: boolean;
  }
): FilteredExportResult {
  const activeWindowId = options?.activeWindowId || "1";
  const currentTabs = flattenTabTree(rootNodes);
  const selectedPanels =
    options?.panelIds && options.panelIds.length > 0 ? new Set(options.panelIds) : null;

  let filteredTabs = selectedPanels
    ? currentTabs.filter((t) => selectedPanels.has(t.panelId || "main"))
    : currentTabs;

  let removedDuplicateCount = 0;
  if (options?.dedupUrls) {
    const seenUrls = new Set<string>();
    const deduped: SideberyTab[] = [];
    for (const tab of filteredTabs) {
      if (isGroupTab(tab) || isExemptUrl(tab.url, tab.pinned)) {
        deduped.push(tab);
        continue;
      }
      const norm = (tab.url || "").replace(/#.*$/, "").trim();
      if (!norm) {
        deduped.push(tab);
        continue;
      }
      if (seenUrls.has(norm)) {
        removedDuplicateCount++;
        continue;
      }
      seenUrls.add(norm);
      deduped.push(tab);
    }
    filteredTabs = deduped;
  }

  const exportSnapshot: SideberySnapshot = {
    ...baseSnapshot,
    windows: {
      ...baseSnapshot.windows,
      [activeWindowId]: { tabs: filteredTabs },
    },
  };

  const effectiveTabCount = filteredTabs.filter((t) => {
    const u = t.url || "";
    return !isGroupTab(t) && !u.startsWith("about:") && !u.startsWith("moz-extension:");
  }).length;

  return {
    snapshot: exportSnapshot,
    tabs: filteredTabs,
    effectiveTabCount,
    removedDuplicateCount,
  };
}

export function formatTabsAsPlainUrls(tabs: SideberyTab[]): string {
  return tabs
    .filter((t) => {
      const u = t.url || "";
      return !isGroupTab(t) && !u.startsWith("about:") && !u.startsWith("moz-extension:");
    })
    .map((t) => t.url)
    .join("\n");
}

export function formatTabsAsMarkdown(
  tabs: SideberyTab[],
  panels?: Record<string, SideberyPanel>
): string {
  const validTabs = tabs.filter((t) => {
    const u = t.url || "";
    return !isGroupTab(t) && !u.startsWith("about:") && !u.startsWith("moz-extension:");
  });
  const byPanel = new Map<string, SideberyTab[]>();
  for (const t of validTabs) {
    const pId = t.panelId || "main";
    if (!byPanel.has(pId)) byPanel.set(pId, []);
    byPanel.get(pId)!.push(t);
  }

  const lines: string[] = [`# Sidebery 标签清单 (${validTabs.length})`, ""];
  for (const [pId, list] of byPanel.entries()) {
    lines.push(`## ${getPanelDisplayName(pId, panels)} (${list.length})`);
    for (const t of list) {
      lines.push(`- [${(t.title || t.url).replace(/[\r\n]+/g, " ")}](${t.url})`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function formatTabsAsBookmarksHtml(
  tabs: SideberyTab[],
  panels?: Record<string, SideberyPanel>
): string {
  const validTabs = tabs.filter((t) => {
    const u = t.url || "";
    return !isGroupTab(t) && !u.startsWith("about:") && !u.startsWith("moz-extension:");
  });
  const byPanel = new Map<string, SideberyTab[]>();
  for (const t of validTabs) {
    const pId = t.panelId || "main";
    if (!byPanel.has(pId)) byPanel.set(pId, []);
    byPanel.get(pId)!.push(t);
  }

  const folders: string[] = [];
  for (const [pId, list] of byPanel.entries()) {
    const pName = escapeHtml(getPanelDisplayName(pId, panels));
    const items = list
      .map(
        (t) =>
          `      <DT><A HREF="${escapeHtml(t.url)}">${escapeHtml(t.title || t.url)}</A>`
      )
      .join("\n");
    folders.push(`    <DT><H3>${pName}</H3>\n    <DL><p>\n${items}\n    </DL><p>`);
  }

  return [
    "<!DOCTYPE NETSCAPE-Bookmark-file-1>",
    '<META HTTP-EQUIV="Content-Type" CONTENT="text/html; charset=UTF-8">',
    "<TITLE>Sidebery Snapshot Bookmarks</TITLE>",
    "<H1>Sidebery Snapshot Bookmarks</H1>",
    "<DL><p>",
    ...folders,
    "</DL><p>",
  ].join("\n");
}
