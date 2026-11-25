"use client";

import React, { useState, useRef, useMemo } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { CategorizationRule, RuleActionType } from "@/types/sidebery";
import { flattenTabTree } from "@/services/snapshotParser";
import {
  formatRuleConditionsCompact,
  normalizeRuleToDSL,
  previewRulesOnTabs,
} from "@/services/ruleEngine";
import { AIRulesChatModal } from "./AIRulesChatModal";
import { RuleEditorModal } from "./RuleEditorModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Plus,
  Trash2,
  Download,
  Upload,
  Sparkles,
  Edit3,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

const ACTION_LABELS: Record<RuleActionType, string> = {
  group: "建组",
  moveToPanel: "移面板",
  groupAndMove: "建组+移面板",
  exempt: "跳过保护",
};

export function RulesPage() {
  const {
    rulesSettings,
    setRulesSettings,
    addRule,
    updateRule,
    deleteRule,
    toggleRule,
    reorderRules,
    importRulesJSON,
    exportRulesJSON,
  } = useConfigStore();

  const { rawSnapshot, rootNodes } = useSnapshotStore();
  const panels = rawSnapshot?.panels || {};
  const containers = rawSnapshot?.containers || {};
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isAIChatOpen, setIsAIChatOpen] = useState(false);
  const [editorState, setEditorState] = useState<{
    isOpen: boolean;
    isNew: boolean;
    rule: Omit<CategorizationRule, "id"> | CategorizationRule | null;
  }>({ isOpen: false, isNew: true, rule: null });

  const allTabs = useMemo(
    () => (rawSnapshot ? flattenTabTree(rootNodes) : []),
    [rawSnapshot, rootNodes]
  );

  const previewStats = useMemo(
    () => previewRulesOnTabs(allTabs, rulesSettings.rules),
    [allTabs, rulesSettings.rules]
  );

  const totalEffectiveHits = useMemo(() => {
    let sum = 0;
    for (const s of previewStats.values()) sum += s.effectiveHits;
    return sum;
  }, [previewStats]);

  const handleExport = () => {
    const jsonStr = exportRulesJSON();
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `snapripper-rules-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      const success = importRulesJSON(event.target?.result as string);
      alert(success ? "规则导入成功" : "导入失败：无效的配置文件");
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const openCreateModal = () => {
    setEditorState({
      isOpen: true,
      isNew: true,
      rule: {
        name: "",
        enabled: true,
        scope: "all",
        targetScopeId: "",
        matchMode: "all",
        conditions: [],
        action: { type: "group", createGroup: true },
        minThreshold: rulesSettings.defaultMinThreshold || 2,
        color: "#3b82f6",
      },
    });
  };

  const openEditModal = (rule: CategorizationRule) => {
    setEditorState({
      isOpen: true,
      isNew: false,
      rule,
    });
  };

  const handleSaveModal = (saved: Omit<CategorizationRule, "id"> | CategorizationRule) => {
    if (editorState.isNew) {
      addRule(saved as Omit<CategorizationRule, "id">);
    } else if ("id" in saved) {
      updateRule(saved.id, saved);
    }
  };

  return (
    <div style={{ padding: "1.75rem 2rem", maxWidth: "920px", margin: "0 auto", color: "var(--text-main)" }}>
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          flexWrap: "wrap",
          gap: "0.75rem",
        }}
      >
        <h1 style={{ fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
          规则管理
        </h1>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
          <Button variant="subtle" size="xs" pill onClick={() => setIsAIChatOpen(true)}>
            <Sparkles size={12} />
            <span>AI 生成</span>
          </Button>

          <Button variant="outline" size="xs" pill onClick={() => fileInputRef.current?.click()}>
            <Upload size={12} />
            <span>导入</span>
          </Button>
          <input ref={fileInputRef} type="file" accept=".json" onChange={handleImport} style={{ display: "none" }} />

          <Button variant="outline" size="xs" pill onClick={handleExport}>
            <Download size={12} />
            <span>导出</span>
          </Button>

          <Button variant="solid" size="xs" pill onClick={openCreateModal}>
            <Plus size={12} />
            <span>添加规则</span>
          </Button>
        </div>
      </div>

      {/* Compact Global Settings & Hit Telemetry Bar */}
      <div
        style={{
          padding: "0.65rem 1rem",
          borderRadius: "0.75rem",
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          marginBottom: "1rem",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.85rem",
          fontSize: "0.78rem",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "1rem", flexWrap: "wrap" }}>
          <label style={{ display: "inline-flex", alignItems: "center", gap: "0.4rem", cursor: "pointer" }}>
            <input
              type="checkbox"
              checked={rulesSettings.treatExistingGroupsAsUnit}
              onChange={(e) => setRulesSettings({ treatExistingGroupsAsUnit: e.target.checked })}
              style={{ cursor: "pointer", accentColor: "var(--accent-solid)" }}
            />
            <span>保留已有 Group</span>
          </label>

          <div style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem" }}>
            <span style={{ color: "var(--text-muted)" }}>默认阈值</span>
            <Input
              type="number"
              min={1}
              max={20}
              size="sm"
              value={rulesSettings.defaultMinThreshold}
              onChange={(e) =>
                setRulesSettings({ defaultMinThreshold: Math.max(1, parseInt(e.target.value) || 1) })
              }
              style={{ width: "56px", textAlign: "center", padding: "0.18rem 0.3rem", fontSize: "0.76rem" }}
            />
          </div>
        </div>

        <div style={{ color: "var(--text-muted)", fontSize: "0.75rem" }}>
          {rulesSettings.rules.length} 条规则 ·{" "}
          {allTabs.length > 0 ? (
            <>
              当前快照命中 <strong style={{ color: "var(--accent-text)" }}>{totalEffectiveHits}</strong> /{" "}
              {allTabs.length}
            </>
          ) : (
            "按优先级从上到下匹配"
          )}
        </div>
      </div>

      {/* Rules List */}
      <div
        style={{
          borderRadius: "0.9rem",
          border: "1px solid var(--border-card)",
          backgroundColor: "var(--bg-surface)",
          overflow: "hidden",
        }}
      >
        {rulesSettings.rules.map((rawRule, index) => {
          const rule = normalizeRuleToDSL(rawRule);
          const stats = previewStats.get(rule.id);
          const chips = formatRuleConditionsCompact(rule);
          const actionType: RuleActionType = rule.action?.type || "group";

          return (
            <div
              key={rule.id}
              style={{
                padding: "0.8rem 1rem",
                borderTop: index === 0 ? "none" : "1px solid var(--border-subtle)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "0.75rem",
                opacity: rule.enabled ? 1 : 0.55,
                backgroundColor: rule.enabled ? "var(--bg-card)" : "transparent",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0, flex: 1 }}>
                <input
                  type="checkbox"
                  checked={rule.enabled}
                  onChange={() => toggleRule(rule.id)}
                  style={{ cursor: "pointer", width: 15, height: 15, accentColor: "var(--accent-solid)", flexShrink: 0 }}
                />

                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    backgroundColor: rule.color || "var(--accent)",
                    flexShrink: 0,
                  }}
                />

                <div style={{ minWidth: 0, flex: 1 }}>
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.35rem" }}>
                    <span style={{ fontWeight: 600, fontSize: "0.88rem", color: "var(--text-main)" }}>
                      {rule.name}
                    </span>

                    <Badge variant="subtle" size="sm" style={{ fontSize: "0.66rem" }}>
                      {ACTION_LABELS[actionType]}
                    </Badge>

                    <Badge variant="outline" size="sm" style={{ fontSize: "0.65rem" }}>
                      {rule.matchMode === "all" ? "AND" : "OR"}
                    </Badge>

                    {allTabs.length > 0 && stats && (
                      <Badge
                        variant="subtle"
                        size="sm"
                        style={{
                          fontSize: "0.66rem",
                          backgroundColor:
                            stats.effectiveHits > 0 ? "var(--accent-subtle)" : "var(--bg-subtle)",
                          color: stats.effectiveHits > 0 ? "var(--accent-text)" : "var(--text-muted)",
                        }}
                      >
                        命中 {stats.effectiveHits}
                        {stats.shadowedHits > 0 ? ` (冲突 ${stats.shadowedHits})` : ""}
                      </Badge>
                    )}
                  </div>

                  {chips.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem", marginTop: "0.35rem" }}>
                      {chips.slice(0, 4).map((chip, cIdx) => (
                        <span
                          key={cIdx}
                          style={{
                            fontSize: "0.67rem",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "var(--bg-subtle)",
                            color: "var(--text-muted)",
                            maxWidth: "280px",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={chip}
                        >
                          {chip}
                        </span>
                      ))}
                      {chips.length > 4 && (
                        <span style={{ fontSize: "0.67rem", color: "var(--text-muted)" }}>
                          +{chips.length - 4}
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Priority & Edit/Delete Controls */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.15rem", flexShrink: 0 }}>
                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  disabled={index === 0}
                  onClick={() => reorderRules(index, index - 1)}
                  style={{ padding: "0.3rem" }}
                  title="上移优先级"
                >
                  <ArrowUp size={13} />
                </Button>

                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  disabled={index === rulesSettings.rules.length - 1}
                  onClick={() => reorderRules(index, index + 1)}
                  style={{ padding: "0.3rem" }}
                  title="下移优先级"
                >
                  <ArrowDown size={13} />
                </Button>

                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={() => openEditModal(rule)}
                  style={{ padding: "0.35rem" }}
                  title="编辑"
                >
                  <Edit3 size={14} />
                </Button>

                <Button
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={() => deleteRule(rule.id)}
                  style={{ padding: "0.35rem", color: "var(--text-muted)" }}
                  title="删除"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Shared Create/Edit DSL Modal */}
      <RuleEditorModal
        isOpen={editorState.isOpen}
        initialRule={editorState.rule}
        isNew={editorState.isNew}
        panels={panels}
        containers={containers}
        snapshotTabs={allTabs}
        onClose={() => setEditorState({ isOpen: false, isNew: true, rule: null })}
        onSave={handleSaveModal}
      />

      {/* AI Rule Generator Chat Hop-up Modal */}
      <AIRulesChatModal isOpen={isAIChatOpen} onClose={() => setIsAIChatOpen(false)} />
    </div>
  );
}
