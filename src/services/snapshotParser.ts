import { SideberySnapshot, SideberyTab, TabTreeNode } from "@/types/sidebery";
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
  if (Array.isArray(data) && data.length > 0 && data[0]?.windows) return true;
  if (Array.isArray(data.snapshots) && data.snapshots.length > 0 && data.snapshots[0]?.windows) return true;
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

  let allSnapshots: SideberySnapshot[] = [];
  let targetSnapshot: SideberySnapshot;

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

  if (!targetSnapshot.windows || typeof targetSnapshot.windows !== "object") {
    targetSnapshot.windows = { "1": { tabs: [] } };
    warnings.push("快照中未检测到有效的窗口数据，已初始化空窗口。");
  }

  let totalTabs = 0;
  const windowKeys = Object.keys(targetSnapshot.windows);

  for (const winId of windowKeys) {
    const win = targetSnapshot.windows[winId];
    if (win && Array.isArray(win.tabs)) {
      totalTabs += win.tabs.length;
    } else if (win) {
      win.tabs = [];
    }
  }

  return {
    snapshot: targetSnapshot,
    allSnapshots,
    totalTabs,
    totalWindows: windowKeys.length,
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
    });
  }

  for (const tab of tabs) {
    const stringId = String(tab.id);
    const node = nodeMap.get(stringId)!;
    const parentId = tab.parentId != null && tab.parentId !== -1 ? String(tab.parentId) : null;

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
  return JSON.stringify(snapshot, null, 2);
}
