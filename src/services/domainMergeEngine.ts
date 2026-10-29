import { SideberyTab, TabTreeNode } from "@/types/sidebery";
import { isExemptUrl } from "@/utils/urlHelper";

export type DomainMatchMode = "full" | "suffix" | "keyword" | "custom";

export interface DomainMergeConfig {
  matchMode: DomainMatchMode;
  customPattern: string;
  minThreshold: number;
}

export const DEFAULT_DOMAIN_MERGE_CONFIG: DomainMergeConfig = {
  matchMode: "suffix",
  customPattern: "",
  minThreshold: 2,
};

const MULTI_PART_TLDS = new Set([
  "com.cn",
  "net.cn",
  "org.cn",
  "edu.cn",
  "gov.cn",
  "co.jp",
  "ac.jp",
  "ne.jp",
  "go.jp",
  "co.uk",
  "org.uk",
  "me.uk",
  "ltd.uk",
  "com.tw",
  "org.tw",
  "idv.tw",
  "com.hk",
  "org.hk",
  "edu.hk",
  "co.nz",
  "net.nz",
  "org.nz",
  "co.kr",
  "ne.kr",
  "re.kr",
  "com.au",
  "net.au",
  "org.au",
  "com.br",
  "net.br",
  "com.sg",
  "edu.sg",
]);

export function extractDomainByMode(
  rawUrl: string,
  mode: DomainMatchMode,
  customPattern?: string
): string | null {
  if (!rawUrl) return null;
  if (isExemptUrl(rawUrl, false)) return null;

  try {
    const urlObj = new URL(rawUrl);
    const hostname = urlObj.hostname.toLowerCase().replace(/^www\./, "");
    if (!hostname) return null;

    if (mode === "full") {
      return hostname;
    }

    if (mode === "suffix") {
      const parts = hostname.split(".");
      if (parts.length <= 2) return hostname;
      const lastTwo = parts.slice(-2).join(".");
      if (MULTI_PART_TLDS.has(lastTwo)) {
        return parts.slice(-3).join(".");
      }
      return lastTwo;
    }

    if (mode === "keyword") {
      const parts = hostname.split(".");
      let rootPart = parts[0];
      if (parts.length > 2) {
        const lastTwo = parts.slice(-2).join(".");
        if (MULTI_PART_TLDS.has(lastTwo)) {
          rootPart = parts[parts.length - 3] || parts[0];
        } else {
          rootPart = parts[parts.length - 2] || parts[0];
        }
      }
      return rootPart ? rootPart.charAt(0).toUpperCase() + rootPart.slice(1) : hostname;
    }

    if (mode === "custom") {
      if (!customPattern || !customPattern.trim()) {
        return hostname;
      }
      try {
        const reg = new RegExp(customPattern.trim(), "i");
        const match = rawUrl.match(reg);
        if (match) {
          return match[1] || match[0];
        }
      } catch {
        return hostname;
      }
      return hostname;
    }

    return hostname;
  } catch {
    return null;
  }
}

export function applyDomainMergeToTreeNodes(
  nodes: TabTreeNode[],
  config: DomainMergeConfig,
  options: {
    exemptPinned?: boolean;
    exemptInternalPages?: boolean;
    preserveSubtrees?: boolean;
    treatExistingGroupsAsUnit?: boolean;
    extensionBaseUrl?: string;
  }
): {
  newNodes: TabTreeNode[];
  groupsCreated: number;
  mergedTabsCount: number;
} {
  const extensionBaseUrl = options.extensionBaseUrl || "moz-extension://sidebery-placeholder";
  const minThreshold = Math.max(1, config.minThreshold || 2);

  // Group candidates by domain
  const domainBuckets = new Map<string, TabTreeNode[]>();
  const firstOccurrence = new Map<string, number>();

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    // Exempt pinned tabs
    if (options.exemptPinned && (node.isPinned || node.tab.pinned)) {
      continue;
    }

    // Exempt internal pages
    if (options.exemptInternalPages && isExemptUrl(node.tab.url, node.tab.pinned)) {
      continue;
    }

    // Treat existing groups as unit
    if (options.treatExistingGroupsAsUnit && node.isGroup) {
      continue;
    }

    const domainKey = extractDomainByMode(node.tab.url, config.matchMode, config.customPattern);
    if (!domainKey) continue;

    if (!domainBuckets.has(domainKey)) {
      domainBuckets.set(domainKey, []);
      firstOccurrence.set(domainKey, i);
    }
    domainBuckets.get(domainKey)!.push(node);
  }

  // Identify which domains meet the threshold
  const validDomains = new Set<string>();
  const clusteredNodeIds = new Set<string>();
  let mergedTabsCount = 0;

  for (const [domainKey, bucket] of domainBuckets.entries()) {
    if (bucket.length >= minThreshold) {
      validDomains.add(domainKey);
      mergedTabsCount += bucket.length;
      for (const n of bucket) {
        clusteredNodeIds.add(n.id);
      }
    }
  }

  if (validDomains.size === 0) {
    return { newNodes: nodes, groupsCreated: 0, mergedTabsCount: 0 };
  }

  // Build the new tree while preserving relative flow
  const resultNodes: TabTreeNode[] = [];
  const renderedGroups = new Set<string>();
  let groupsCreated = 0;

  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];

    if (!clusteredNodeIds.has(node.id)) {
      // Node was not clustered, keep in tree
      resultNodes.push(node);
      continue;
    }

    // Node was clustered, check if its group was already rendered
    const domainKey = extractDomainByMode(node.tab.url, config.matchMode, config.customPattern);
    if (domainKey && validDomains.has(domainKey) && !renderedGroups.has(domainKey)) {
      renderedGroups.add(domainKey);
      groupsCreated += 1;

      const bucketNodes = domainBuckets.get(domainKey)!;
      const groupId = `group_domain_${domainKey.replace(/[^a-zA-Z0-9_-]/g, "_")}_${Date.now()}_${groupsCreated}`;
      const groupTabUrl = `${extensionBaseUrl}/sidebery/group.html#${encodeURIComponent(domainKey)}`;

      const groupTab: SideberyTab = {
        id: groupId,
        panelId: bucketNodes[0]?.tab.panelId || "main",
        parentId: -1,
        lvl: 0,
        title: domainKey,
        url: groupTabUrl,
        folded: true,
        isGroup: true,
      };

      const groupNode: TabTreeNode = {
        id: groupId,
        tab: groupTab,
        depth: 0,
        children: bucketNodes.map((child) => ({
          ...child,
          depth: (child.depth || 0) + 1,
          tab: {
            ...child.tab,
            parentId: groupId,
            lvl: 1,
          },
        })),
        isGroup: true,
      };

      resultNodes.push(groupNode);
    }
  }

  return {
    newNodes: resultNodes,
    groupsCreated,
    mergedTabsCount,
  };
}
