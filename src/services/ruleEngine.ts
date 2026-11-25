import {
  SideberyTab,
  TabTreeNode,
  CategorizationRule,
  RulesSettings,
  RuleCondition,
  RuleConditionField,
  RuleConditionOperator,
} from "@/types/sidebery";
import { extractDomain, isExemptUrl } from "@/utils/urlHelper";
import { isGroupTab } from "./snapshotParser";

export {
  DEFAULT_RULES,
  RULE_PRESETS,
  DEFAULT_RULES_SETTINGS,
} from "@/constants/rulePresets";
export { deduplicateTreeNodes } from "./treeOperations";

/**
 * 将旧版 matchDomain / matchKeyword 规则无损标准化为 Option B 条件组 DSL
 */
export function normalizeRuleToDSL(rule: CategorizationRule): CategorizationRule {
  if (rule.conditions && rule.conditions.length > 0) {
    return {
      ...rule,
      matchMode: rule.matchMode || "all",
      action: rule.action || { type: "group", createGroup: true },
    };
  }

  const synthesized: RuleCondition[] = [];
  if (rule.matchDomain && rule.matchDomain.trim()) {
    synthesized.push({
      id: `${rule.id}_dom`,
      field: "domain",
      operator: "contains",
      value: rule.matchDomain.trim(),
    });
  }
  if (rule.matchKeyword && rule.matchKeyword.trim()) {
    synthesized.push({
      id: `${rule.id}_kw`,
      field: "title",
      operator: "contains",
      value: rule.matchKeyword.trim(),
    });
  }

  return {
    ...rule,
    matchMode: rule.matchMode || "any",
    conditions: synthesized,
    action: rule.action || { type: "group", createGroup: true },
  };
}

function getTabFieldValue(tab: SideberyTab, field: RuleConditionField): string {
  switch (field) {
    case "domain":
      return extractDomain(tab.url).toLowerCase();
    case "urlPath": {
      try {
        return new URL(tab.url).pathname.toLowerCase();
      } catch {
        return "";
      }
    }
    case "title":
      return (tab.title || "").toLowerCase();
    case "url":
      return (tab.url || "").toLowerCase();
    case "panel":
      return (tab.panelId || "main").toLowerCase();
    case "container":
      return (tab.containerId || "").toLowerCase();
    default:
      return "";
  }
}

function matchSingleValue(
  haystack: string,
  field: RuleConditionField,
  operator: RuleConditionOperator,
  needle: string
): boolean {
  const cleanNeedle = needle.trim().toLowerCase();
  if (!cleanNeedle) return false;

  if (field === "domain" && (operator === "contains" || operator === "equals")) {
    return haystack === cleanNeedle || haystack.endsWith(`.${cleanNeedle}`);
  }

  switch (operator) {
    case "contains":
      return haystack.includes(cleanNeedle);
    case "equals":
      return haystack === cleanNeedle;
    case "startsWith":
      return haystack.startsWith(cleanNeedle);
    default:
      return false;
  }
}

/**
 * 评估单条条件是否命中指定标签页（支持逗号分隔多值、正则与否定操作符）
 */
export function evaluateCondition(tab: SideberyTab, condition: RuleCondition): boolean {
  const rawVal = (condition.value || "").trim();
  if (!rawVal) return false;

  const haystack = getTabFieldValue(tab, condition.field);
  // title 字段在旧版中同时检查 title 与 url，保持一致体验
  const secondaryUrl = condition.field === "title" ? (tab.url || "").toLowerCase() : "";

  if (condition.operator === "regex") {
    try {
      const re = new RegExp(rawVal, "i");
      return re.test(haystack) || (secondaryUrl ? re.test(secondaryUrl) : false);
    } catch {
      return false;
    }
  }

  const terms = rawVal
    .split(",")
    .map((t) => t.trim())
    .filter(Boolean);
  if (terms.length === 0) return false;

  const isNegated = condition.operator === "notContains" || condition.operator === "notEquals";
  const baseOp: RuleConditionOperator =
    condition.operator === "notContains"
      ? "contains"
      : condition.operator === "notEquals"
        ? "equals"
        : condition.operator;

  const anyMatched = terms.some(
    (term) =>
      matchSingleValue(haystack, condition.field, baseOp, term) ||
      (secondaryUrl ? matchSingleValue(secondaryUrl, "url", baseOp, term) : false)
  );

  return isNegated ? !anyMatched : anyMatched;
}

/**
 * 评估标签页是否命中规则（支持 scope 过滤、Condition DSL 与旧版兼容）
 */
export function matchTabWithRule(tab: SideberyTab, rule: CategorizationRule): boolean {
  if (!rule.enabled) return false;

  if (rule.scope === "panel" && rule.targetScopeId && tab.panelId !== rule.targetScopeId) {
    return false;
  }
  if (rule.scope === "container" && rule.targetScopeId && tab.containerId !== rule.targetScopeId) {
    return false;
  }

  const normalized = normalizeRuleToDSL(rule);
  const conditions = normalized.conditions || [];
  if (conditions.length === 0) return false;

  if (normalized.matchMode === "all") {
    return conditions.every((cond) => evaluateCondition(tab, cond));
  }
  return conditions.some((cond) => evaluateCondition(tab, cond));
}

/**
 * 解释单个标签在规则集中的命中与被前置规则遮蔽（冲突）情况
 */
export function explainTabMatch(
  tab: SideberyTab,
  rules: CategorizationRule[]
): {
  matchedRule: CategorizationRule | null;
  allMatchingRules: CategorizationRule[];
} {
  const allMatchingRules = rules.filter((r) => matchTabWithRule(tab, r));
  return {
    matchedRule: allMatchingRules[0] || null,
    allMatchingRules,
  };
}

export interface RulePreviewStats {
  ruleId: string;
  effectiveHits: number;
  shadowedHits: number;
  sampleTitles: string[];
}

/**
 * 实时计算当前规则列表在快照标签上的命中分布与冲突抢占数
 */
export function previewRulesOnTabs(
  tabs: SideberyTab[],
  rules: CategorizationRule[]
): Map<string, RulePreviewStats> {
  const statsMap = new Map<string, RulePreviewStats>();
  for (const r of rules) {
    statsMap.set(r.id, {
      ruleId: r.id,
      effectiveHits: 0,
      shadowedHits: 0,
      sampleTitles: [],
    });
  }

  for (const tab of tabs) {
    if (tab.pinned || isExemptUrl(tab.url, tab.pinned) || isGroupTab(tab)) continue;
    const { matchedRule, allMatchingRules } = explainTabMatch(tab, rules);
    for (const r of allMatchingRules) {
      const entry = statsMap.get(r.id);
      if (!entry) continue;
      if (matchedRule && matchedRule.id === r.id) {
        entry.effectiveHits++;
        if (entry.sampleTitles.length < 3 && tab.title) {
          entry.sampleTitles.push(tab.title.trim().slice(0, 40));
        }
      } else {
        entry.shadowedHits++;
      }
    }
  }

  return statsMap;
}

const FIELD_LABELS: Record<RuleConditionField, string> = {
  domain: "域名",
  urlPath: "路径",
  title: "标题",
  url: "URL",
  panel: "面板",
  container: "容器",
};

const OP_LABELS: Record<RuleConditionOperator, string> = {
  contains: "含",
  equals: "=",
  startsWith: "开头",
  regex: "正则",
  notContains: "不含",
  notEquals: "≠",
};

/**
 * 将规则条件格式化为极简的胶囊描述标签列表（用于 UI 展示）
 */
export function formatRuleConditionsCompact(rule: CategorizationRule): string[] {
  const normalized = normalizeRuleToDSL(rule);
  return (normalized.conditions || [])
    .filter((c) => c.value.trim())
    .map((c) => `${FIELD_LABELS[c.field]} ${OP_LABELS[c.operator]} ${c.value.trim()}`);
}

/**
 * 执行规则集合的动作（建折叠组 / 仅移入面板 / 建组并移入面板 / 跳过保护）
 */
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

  const ruleBuckets = new Map<string, { rule: CategorizationRule; nodes: TabTreeNode[] }>();
  for (const rule of activeRules) {
    ruleBuckets.set(rule.id, { rule, nodes: [] });
  }

  const unassignedNodes: TabTreeNode[] = [];
  let matchedCount = 0;

  for (const node of nodes) {
    if (node.isPinned || isExemptUrl(node.tab.url, node.tab.pinned)) {
      unassignedNodes.push(node);
      continue;
    }

    if (node.isGroup && settings.treatExistingGroupsAsUnit) {
      unassignedNodes.push(node);
      continue;
    }

    let matched = false;
    for (const rule of activeRules) {
      if (matchTabWithRule(node.tab, rule)) {
        const actionType = rule.action?.type || "group";
        if (actionType === "exempt") {
          // 跳过保护动作：直接保留在原位且不被后续规则匹配
          unassignedNodes.push(node);
        } else {
          ruleBuckets.get(rule.id)!.nodes.push(node);
          matchedCount += 1;
        }
        matched = true;
        break;
      }
    }

    if (!matched) {
      unassignedNodes.push(node);
    }
  }

  const resultNodes: TabTreeNode[] = [];
  let groupsCreated = 0;
  let virtualCounter = 0;

  for (const [, { rule, nodes: matchedNodes }] of ruleBuckets.entries()) {
    const action = rule.action || { type: "group", createGroup: true };

    if (action.type === "moveToPanel") {
      const targetPanel = action.targetPanelId || matchedNodes[0]?.tab.panelId || "main";
      for (const n of matchedNodes) {
        unassignedNodes.push({
          ...n,
          tab: { ...n.tab, panelId: targetPanel },
        });
      }
      continue;
    }

    const threshold = rule.minThreshold || settings.defaultMinThreshold || 2;
    if (matchedNodes.length >= threshold) {
      const shouldCreateGroup =
        (action.createGroup ?? true) && (settings.createGroupTabs ?? true);
      const targetPanel =
        action.type === "groupAndMove" && action.targetPanelId
          ? action.targetPanelId
          : matchedNodes[0]?.tab.panelId || "main";

      groupsCreated += 1;
      virtualCounter += 1;

      const groupId = shouldCreateGroup
        ? `group_rule_${rule.id}_${virtualCounter}_${Date.now()}`
        : `cat_rule_${rule.id}_${virtualCounter}_${Date.now()}`;
      const groupTabUrl = shouldCreateGroup
        ? `${extensionBaseUrl}/sidebery/group.html#${encodeURIComponent(rule.name)}`
        : `about:blank#category=${encodeURIComponent(rule.name)}`;
      const groupTitle = shouldCreateGroup
        ? rule.name
        : `📁 [${rule.name}] (${matchedNodes.length})`;

      const groupTab: SideberyTab = {
        id: groupId,
        panelId: targetPanel,
        parentId: -1,
        lvl: 0,
        title: groupTitle,
        url: groupTabUrl,
        folded: true,
        isGroup: shouldCreateGroup,
        customTitle: shouldCreateGroup ? null : `📁 [${rule.name}]`,
        customColor: rule.color,
      };

      const children = matchedNodes.map((childNode) => ({
        ...childNode,
        depth: 1,
        tab: {
          ...childNode.tab,
          panelId: targetPanel,
          parentId: groupId,
          lvl: 1,
        },
      }));

      resultNodes.push({
        id: groupId,
        tab: groupTab,
        children,
        depth: 0,
        isGroup: shouldCreateGroup,
        isCategoryHeader: !shouldCreateGroup,
        categoryName: rule.name,
      });
    } else {
      unassignedNodes.push(...matchedNodes);
    }
  }

  resultNodes.push(...unassignedNodes);

  return {
    newNodes: resultNodes,
    matchedCount,
    groupsCreated,
  };
}
