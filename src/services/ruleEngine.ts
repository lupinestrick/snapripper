import { SideberyTab, TabTreeNode, CategorizationRule, RulesSettings } from "@/types/sidebery";
import { getDomain, isExemptUrl } from "@/utils/urlHelper";
import { isGroupTab } from "./snapshotParser";

export const DEFAULT_RULES: CategorizationRule[] = [
  {
    id: "rule_dlsite",
    name: "DLsite 作品",
    enabled: true,
    scope: "all",
    matchDomain: "dlsite.com, ch.dlsite.com",
    matchKeyword: "RJ, 同人, DLsite",
    minThreshold: 2,
    color: "#3b82f6",
  },
  {
    id: "rule_animesharing",
    name: "Anime-Sharing",
    enabled: true,
    scope: "all",
    matchDomain: "anime-sharing.com",
    matchKeyword: "Anime-Sharing, Voice, RJ",
    minThreshold: 2,
    color: "#ec4899",
  },
  {
    id: "rule_asmr",
    name: "ASMR 音频",
    enabled: true,
    scope: "all",
    matchDomain: "asmr.one, asmr-one.com",
    matchKeyword: "ASMR, 音声, バイノーラル, オナサポ",
    minThreshold: 2,
    color: "#8b5cf6",
  },
  {
    id: "rule_dev",
    name: "开发与技术",
    enabled: true,
    scope: "all",
    matchDomain: "github.com, gitlab.com, npmjs.com, stackoverflow.com",
    matchKeyword: "GitHub, Docs, API, React, Next.js",
    minThreshold: 2,
    color: "#10b981",
  },
  {
    id: "rule_media",
    name: "视频与媒体",
    enabled: true,
    scope: "all",
    matchDomain: "youtube.com, bilibili.com, nicovideo.jp",
    matchKeyword: "YouTube, 哔哩哔哩, B站",
    minThreshold: 2,
    color: "#f59e0b",
  },
];

export const DEFAULT_RULES_SETTINGS: RulesSettings = {
  treatExistingGroupsAsUnit: true,
  defaultMinThreshold: 2,
  rules: DEFAULT_RULES,
};

export function matchTabWithRule(tab: SideberyTab, rule: CategorizationRule): boolean {
  if (!rule.enabled) return false;

  // Scope check
  if (rule.scope === "panel" && rule.targetScopeId && tab.panelId !== rule.targetScopeId) {
    return false;
  }
  if (rule.scope === "container" && rule.targetScopeId && tab.containerId !== rule.targetScopeId) {
    return false;
  }

  // Domain check
  if (rule.matchDomain) {
    const domains = rule.matchDomain.split(",").map((d) => d.trim().toLowerCase()).filter(Boolean);
    const tabDomain = getDomain(tab.url).toLowerCase();
    for (const d of domains) {
      if (tabDomain === d || tabDomain.endsWith(`.${d}`)) {
        return true;
      }
    }
  }

  // Keyword check in title or URL
  if (rule.matchKeyword) {
    const keywords = rule.matchKeyword.split(",").map((k) => k.trim().toLowerCase()).filter(Boolean);
    const titleLower = (tab.title || "").toLowerCase();
    const urlLower = (tab.url || "").toLowerCase();
    for (const k of keywords) {
      if (titleLower.includes(k) || urlLower.includes(k)) {
        return true;
      }
    }
  }

  return false;
}

export function applyRulesToTreeNodes(
  nodes: TabTreeNode[],
  settings: RulesSettings,
  extensionBaseUrl = "moz-extension://sidebery-placeholder"
): {
  newNodes: TabTreeNode[];
  matchedCount: number;
  groupsCreated: number;
} {
  const activeRules = settings.rules.filter((r) => r.enabled);
  if (activeRules.length === 0) {
    return { newNodes: nodes, matchedCount: 0, groupsCreated: 0 };
  }

  // Group candidate nodes: collect root nodes or nodes to cluster
  const ruleBuckets = new Map<string, { rule: CategorizationRule; nodes: TabTreeNode[] }>();
  for (const rule of activeRules) {
    ruleBuckets.set(rule.id, { rule, nodes: [] });
  }

  const unassignedNodes: TabTreeNode[] = [];
  let matchedCount = 0;

  for (const node of nodes) {
    // Check if node is exempt (pinned, etc.)
    if (node.isPinned || isExemptUrl(node.tab.url, node.tab.pinned)) {
      unassignedNodes.push(node);
      continue;
    }

    // Check if already a group and setting says treat as unit
    if (node.isGroup && settings.treatExistingGroupsAsUnit) {
      unassignedNodes.push(node);
      continue;
    }

    // Match against rules in priority order
    let matched = false;
    for (const rule of activeRules) {
      if (matchTabWithRule(node.tab, rule)) {
        ruleBuckets.get(rule.id)!.nodes.push(node);
        matched = true;
        matchedCount += 1;
        break;
      }
    }

    if (!matched) {
      unassignedNodes.push(node);
    }
  }

  const resultNodes: TabTreeNode[] = [];
  let groupsCreated = 0;

  // Build group headers for rules that meet threshold
  for (const [_, { rule, nodes: matchedNodes }] of ruleBuckets.entries()) {
    const threshold = rule.minThreshold || settings.defaultMinThreshold || 2;

    if (matchedNodes.length >= threshold) {
      groupsCreated += 1;
      const groupId = `group_rule_${rule.id}_${Date.now()}`;
      const groupTabUrl = `${extensionBaseUrl}/sidebery/group.html#${encodeURIComponent(rule.name)}`;

      const groupTab: SideberyTab = {
        id: groupId,
        panelId: matchedNodes[0]?.tab.panelId || "main",
        parentId: -1,
        lvl: 0,
        title: rule.name,
        url: groupTabUrl,
        folded: true,
        isGroup: true,
        customColor: rule.color,
      };

      // Wrap matched nodes as children with depth + 1
      const children = matchedNodes.map((childNode) => {
        return {
          ...childNode,
          depth: 1,
          tab: {
            ...childNode.tab,
            parentId: groupId,
            lvl: 1,
          },
        };
      });

      resultNodes.push({
        id: groupId,
        tab: groupTab,
        children,
        depth: 0,
        isGroup: true,
        categoryName: rule.name,
      });
    } else {
      // Threshold not met, keep nodes unassigned
      unassignedNodes.push(...matchedNodes);
    }
  }

  // Append remaining unassigned nodes
  resultNodes.push(...unassignedNodes);

  return {
    newNodes: resultNodes,
    matchedCount,
    groupsCreated,
  };
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
