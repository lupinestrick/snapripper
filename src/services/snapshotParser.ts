import { SideberySnapshot, SideberyTab, TabTreeNode, SideberyPanel } from "@/types/sidebery";
import { isExemptUrl } from "@/utils/urlHelper";

export interface ParsedSnapshotResult {
  snapshot: SideberySnapshot;
  allSnapshots?: SideberySnapshot[];
  totalTabs: number;
  totalWindows: number;
  warnings: string[];
}

export function validateSnapshotData(data: any): boolean {
  if (!data || typeof data !== "object") return false;
  if (data.windows && typeof data.windows === "object") return true;
  if (Array.isArray(data.tabs) && data.tabs.length > 0) return true;
  if (Array.isArray(data) && data.length > 0 && (data[0]?.windows || data[0]?.tabs)) return true;
  if (Array.isArray(data.snapshots) && data.snapshots.length > 0 && (data.snapshots[0]?.windows || data.snapshots[0]?.tabs)) return true;
  return false;
}

export function isGroupTab(tab: Partial<SideberyTab>): boolean {
  if (!tab.url) return false;
  if (tab.url.includes("/sidebery/group.html")) return true;
  if (tab.url.startsWith("about:blank#group")) return true;
  return false;
}

export function parseSnapshot(jsonString: string): ParsedSnapshotResult {
  const warnings: string[] = [];
  let raw: any;

  try {
    raw = JSON.parse(jsonString);
  } catch (err: any) {
    throw new Error(`JSON 解析失败: ${err?.message || "无效的 JSON 格式"}`);
  }

  if (!validateSnapshotData(raw)) {
    throw new Error("无法识别的 Sidebery 快照格式。请确保上传的是有效的 Sidebery 导出快照 JSON。");
  }

  let allSnapshots: any[] = [];
  let targetSnapshot: any;

  if (Array.isArray(raw)) {
    allSnapshots = raw;
    targetSnapshot = raw[raw.length - 1];
  } else if (Array.isArray(raw.snapshots)) {
    allSnapshots = raw.snapshots;
    targetSnapshot = raw.snapshots[raw.snapshots.length - 1];
  } else {
    targetSnapshot = raw;
    allSnapshots = [raw];
  }

  // Detect extension base URL from any existing group tabs
  let extensionBaseUrl = "moz-extension://sidebery-placeholder";

  // Normalize panels from sidebar.panels or panels
  const panels: Record<string, SideberyPanel> = {};
  if (targetSnapshot.sidebar?.panels) {
    Object.assign(panels, targetSnapshot.sidebar.panels);
  }
  if (targetSnapshot.panels) {
    Object.assign(panels, targetSnapshot.panels);
  }

  const normalizedWindows: Record<string, { tabs: SideberyTab[] }> = {};
  let totalTabs = 0;
  let idCounter = 1;

  // Case A: Sidebery v5 native format with raw.tabs as nested array
  if (Array.isArray(targetSnapshot.tabs)) {
    // targetSnapshot.tabs is [ [ section0Tabs, section1Tabs, ... ] ] (windows -> sections/panels)
    targetSnapshot.rawTabsFormat = true;

    for (let wIdx = 0; wIdx < targetSnapshot.tabs.length; wIdx++) {
      const winData = targetSnapshot.tabs[wIdx];
      const winId = String(wIdx + 1);
      const winTabs: SideberyTab[] = [];

      if (Array.isArray(winData)) {
        for (const section of winData) {
          if (Array.isArray(section)) {
            let depthStack: string[] = [];

            for (const t of section) {
              const currentId = t.id != null ? String(t.id) : `tab_${idCounter++}`;
              const depth = typeof t.lvl === "number" ? t.lvl : 0;
              const isGroup = isGroupTab(t);

              if (t.url && t.url.includes("/sidebery/group.html")) {
                const match = t.url.match(/^(moz-extension:\/\/[^/]+)/);
                if (match) {
                  extensionBaseUrl = match[1];
                }
              }

              let parentId: number | string = -1;
              if (depth === 0) {
                depthStack = [currentId];
              } else {
                parentId = depthStack[depth - 1] ?? depthStack[0] ?? -1;
                depthStack[depth] = currentId;
                depthStack.length = depth + 1;
              }

              const tabObj: SideberyTab = {
                id: currentId,
                panelId: t.panelId || "main",
                parentId,
                lvl: depth,
                title: t.title || t.url || "Untitled",
                url: t.url || "",
                pinned: !!t.pinned,
                containerId: t.containerId,
                customTitle: t.customTitle ?? null,
                customColor: t.customColor ?? null,
                folded: !!t.folded,
                isGroup,
              };

              winTabs.push(tabObj);
            }
          }
        }
      }

      normalizedWindows[winId] = { tabs: winTabs };
      totalTabs += winTabs.length;
    }
  } else if (targetSnapshot.windows && typeof targetSnapshot.windows === "object") {
    // Case B: Snapshot with windows: { "1": { tabs: [...] } }
    const winKeys = Object.keys(targetSnapshot.windows);
    for (const winId of winKeys) {
      const win = targetSnapshot.windows[winId];
      const winTabs: SideberyTab[] = [];

      if (win && Array.isArray(win.tabs)) {
        for (const t of win.tabs) {
          const currentId = t.id != null ? String(t.id) : `tab_${idCounter++}`;
          if (t.url && t.url.includes("/sidebery/group.html")) {
            const match = t.url.match(/^(moz-extension:\/\/[^/]+)/);
            if (match) extensionBaseUrl = match[1];
          }

          winTabs.push({
            id: currentId,
            panelId: t.panelId || "main",
            parentId: t.parentId != null ? t.parentId : -1,
            lvl: t.lvl ?? 0,
            title: t.title || t.url || "Untitled",
            url: t.url || "",
            pinned: !!t.pinned,
            containerId: t.containerId,
            customTitle: t.customTitle ?? null,
            customColor: t.customColor ?? null,
            folded: !!t.folded,
            isGroup: isGroupTab(t),
          });
        }
      }

      normalizedWindows[winId] = { tabs: winTabs };
      totalTabs += winTabs.length;
    }
  } else {
    normalizedWindows["1"] = { tabs: [] };
  }

  const finalSnapshot: SideberySnapshot = {
    ...targetSnapshot,
    panels,
    windows: normalizedWindows,
    extensionBaseUrl,
  };

  return {
    snapshot: finalSnapshot,
    allSnapshots,
    totalTabs,
    totalWindows: Object.keys(normalizedWindows).length,
    warnings,
  };
}

export function buildTabTree(tabs: SideberyTab[]): TabTreeNode[] {
  if (!tabs || tabs.length === 0) return [];

  const nodeMap = new Map<string, TabTreeNode>();
  const rootNodes: TabTreeNode[] = [];

  for (const tab of tabs) {
    const stringId = String(tab.id);
    nodeMap.set(stringId, {
      id: stringId,
      tab,
      children: [],
      depth: tab.lvl ?? 0,
      isPinned: !!tab.pinned,
      isExempt: isExemptUrl(tab.url, tab.pinned),
      isGroup: isGroupTab(tab),
    });
  }

  for (const tab of tabs) {
    const stringId = String(tab.id);
    const node = nodeMap.get(stringId)!;
    const parentId = tab.parentId != null && tab.parentId !== -1 && tab.parentId !== "-1" ? String(tab.parentId) : null;

    if (parentId && nodeMap.has(parentId)) {
      const parentNode = nodeMap.get(parentId)!;
      node.depth = parentNode.depth + 1;
      parentNode.children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  return rootNodes;
}

export function flattenTabTree(nodes: TabTreeNode[], panelIdFallback = "main"): SideberyTab[] {
  const result: SideberyTab[] = [];

  function traverse(nodeList: TabTreeNode[], currentParentId: number | string, currentDepth: number) {
    for (const node of nodeList) {
      const updatedTab: SideberyTab = {
        ...node.tab,
        parentId: currentParentId,
        lvl: currentDepth,
        panelId: node.tab.panelId || panelIdFallback,
        folded: node.tab.folded,
      };

      result.push(updatedTab);

      if (node.children && node.children.length > 0) {
        traverse(node.children, updatedTab.id, currentDepth + 1);
      }
    }
  }

  traverse(nodes, -1, 0);
  return result;
}

export function serializeSnapshot(snapshot: SideberySnapshot): string {
  // If the original was Sidebery v5 format with tabs: [ [ [ ... ] ] ], reconstruct that format
  const copy: any = { ...snapshot };

  if (snapshot.rawTabsFormat) {
    const panelsOrder = snapshot.sidebar?.nav?.filter((p) => p !== "search" && p !== "add_tp") || Object.keys(snapshot.panels || {});
    const windowsArr: any[] = [];

    for (const winKey of Object.keys(snapshot.windows)) {
      const allTabs = snapshot.windows[winKey].tabs || [];
      const sections: any[] = [];

      // Group tabs by panel in order of sidebar nav
      const panelBuckets = new Map<string, any[]>();
      for (const p of panelsOrder) {
        panelBuckets.set(p, []);
      }

      for (const t of allTabs) {
        const pId = t.panelId || "main";
        if (!panelBuckets.has(pId)) {
          panelBuckets.set(pId, []);
        }
        const cleanTab: any = {
          url: t.url,
          title: t.title,
          panelId: t.panelId,
        };
        if (t.lvl && t.lvl > 0) cleanTab.lvl = t.lvl;
        if (t.folded) cleanTab.folded = true;
        if (t.pinned) cleanTab.pinned = true;
        if (t.containerId) cleanTab.containerId = t.containerId;
        if (t.customTitle) cleanTab.customTitle = t.customTitle;
        if (t.customColor) cleanTab.customColor = t.customColor;

        panelBuckets.get(pId)!.push(cleanTab);
      }

      for (const [_, pTabs] of panelBuckets.entries()) {
        if (pTabs.length > 0) {
          sections.push(pTabs);
        }
      }

      windowsArr.push(sections);
    }

    copy.tabs = windowsArr;
    delete copy.windows;
    delete copy.rawTabsFormat;
    delete copy.extensionBaseUrl;

    return JSON.stringify(copy, null, 2);
  }

  return JSON.stringify(copy, null, 2);
}
