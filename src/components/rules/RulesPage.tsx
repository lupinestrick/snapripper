"use client";

import React, { useState, useRef, useMemo } from "react";
import { useConfigStore } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { toast } from "@/store/useFeedbackStore";
import { CategorizationRule, RuleActionType } from "@/types/sidebery";
import { flattenTabTree } from "@/services/snapshotParser";
import {
  formatRuleConditionsCompact,
  normalizeRuleToDSL,
  previewRulesOnTabs,
} from "@/services/ruleEngine";
import { AIRulesChatModal } from "./AIRulesChatModal";
import { RuleEditorModal } from "./RuleEditorModal";
import { RulesSettingsHopup } from "./RulesSettingsHopup";
import { Button } from "@/components/ui/button";
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
  Settings,
  GripVertical,
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
    uiSettings,
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
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [draggedRuleIdx, setDraggedRuleIdx] = useState<number | null>(null);
  const [dragOverRuleIdx, setDragOverRuleIdx] = useState<number | null>(null);
  const [dragReadyIdx, setDragReadyIdx] = useState<number | null>(null);
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
      if (success) {
        toast.success("规则导入成功");
      } else {
        toast.error("导入失败：无效的配置文件");
      }
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

  const layoutMode = uiSettings?.rulesLayoutMode || "list";
  const hideDisabled = Boolean(uiSettings?.rulesHideDisabled);
  const onlyWithHits = Boolean(uiSettings?.rulesOnlyWithHits);
  const showSampleTitles = Boolean(uiSettings?.rulesShowSampleTitles);

  const visibleRulesWithIndex = useMemo(() => {
    return rulesSettings.rules
      .map((rawRule, originalIndex) => ({ rawRule, originalIndex }))
      .filter(({ rawRule }) => {
        if (hideDisabled && !rawRule.enabled) return false;
        if (onlyWithHits && allTabs.length > 0) {
          const hits = previewStats.get(rawRule.id)?.effectiveHits || 0;
          if (hits === 0) return false;
        }
        return true;
      });
  }, [rulesSettings.rules, hideDisabled, onlyWithHits, allTabs.length, previewStats]);

  return (
    <div
      style={{
        padding: "1.5rem 2rem",
        maxWidth: layoutMode === "grid" ? "100%" : "920px",
        margin: "0 auto",
        color: "var(--text-main)",
      }}
    >
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
        <div style={{ display: "flex", alignItems: "baseline", gap: "0.65rem", flexWrap: "wrap" }}>
          <h1 style={{ fontSize: "1.35rem", fontWeight: 700, letterSpacing: "-0.02em", margin: 0 }}>
            规则管理
          </h1>
          <span style={{ fontSize: "0.76rem", color: "var(--text-muted)" }}>
            {rulesSettings.rules.length} 条规则
            {allTabs.length > 0 && (
              <>
                {" · "}命中 <strong style={{ color: "var(--accent-text)" }}>{totalEffectiveHits}</strong> / {allTabs.length}
              </>
            )}
          </span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
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

          <Button
            variant="ghost"
            size="xs"
            pill
            onClick={() => setIsSettingsOpen(true)}
            title="规则管理设置"
            style={{ color: "var(--text-muted)", padding: "0.35rem" }}
          >
            <Settings size={15} />
          </Button>
        </div>
      </div>

      {/* Rules List or Grid */}
      {visibleRulesWithIndex.length === 0 ? (
        <div
          style={{
            padding: "2rem 1rem",
            textAlign: "center",
            borderRadius: "0.9rem",
            border: "1px dashed var(--border-subtle)",
            color: "var(--text-muted)",
            fontSize: "0.82rem",
          }}
        >
          当前筛选条件下暂无规则
        </div>
      ) : layoutMode === "grid" ? (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(215px, 1fr))",
            gap: "0.75rem",
          }}
        >
          {visibleRulesWithIndex.map(({ rawRule, originalIndex }) => {
            const rule = normalizeRuleToDSL(rawRule);
            const stats = previewStats.get(rule.id);
            const chips = formatRuleConditionsCompact(rule);
            const actionType: RuleActionType = rule.action?.type || "group";
            const displayHits = stats ? (rule.enabled ? stats.effectiveHits : stats.potentialHits) : 0;
            const isDragTarget = dragOverRuleIdx === originalIndex && draggedRuleIdx !== originalIndex;

            return (
              <div
                key={rule.id}
                draggable
                onClick={() => toggleRule(rule.id)}
                onDragStart={(e) => {
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", rule.id);
                  setDraggedRuleIdx(originalIndex);
                }}
                onDragOver={(e) => {
                  if (draggedRuleIdx === null) return;
                  e.preventDefault();
                  setDragOverRuleIdx(originalIndex);
                }}
                onDragLeave={() => {
                  if (dragOverRuleIdx === originalIndex) {
                    setDragOverRuleIdx(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedRuleIdx !== null && draggedRuleIdx !== originalIndex) {
                    reorderRules(draggedRuleIdx, originalIndex);
                  }
                  setDraggedRuleIdx(null);
                  setDragOverRuleIdx(null);
                }}
                onDragEnd={() => {
                  setDraggedRuleIdx(null);
                  setDragOverRuleIdx(null);
                }}
                title="点击启用/停用规则 · 拖拽卡片调整优先级"
                style={{
                  padding: "0.95rem 0.9rem 0.75rem",
                  minHeight: "184px",
                  borderRadius: "0.85rem",
                  border: "1.5px solid",
                  borderColor: isDragTarget
                    ? "var(--accent-solid)"
                    : rule.enabled
                      ? "var(--accent-border)"
                      : "var(--border-subtle)",
                  backgroundColor: rule.enabled ? "var(--bg-card)" : "var(--bg-surface)",
                  opacity: draggedRuleIdx === originalIndex ? 0.45 : rule.enabled ? 1 : 0.62,
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "0.7rem",
                  cursor: "pointer",
                  transition: "border-color 0.12s ease, opacity 0.12s ease",
                }}
              >
                <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                  {/* Top row: color dot + full-width title */}
                  <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
                    <span
                      style={{
                        width: 9,
                        height: 9,
                        borderRadius: "50%",
                        backgroundColor: rule.enabled ? (rule.color || "var(--accent)") : "var(--text-muted)",
                        flexShrink: 0,
                      }}
                    />
                    <span
                      style={{
                        fontWeight: 600,
                        fontSize: "0.85rem",
                        color: rule.enabled ? "var(--text-main)" : "var(--text-muted)",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                      title={rule.name}
                    >
                      {rule.name}
                    </span>
                  </div>

                  {/* Badges */}
                  <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "0.3rem" }}>
                    <Badge variant="subtle" size="sm" style={{ fontSize: "0.64rem", opacity: rule.enabled ? 1 : 0.75 }}>
                      {ACTION_LABELS[actionType]}
                    </Badge>
                    <Badge variant="outline" size="sm" style={{ fontSize: "0.63rem", opacity: rule.enabled ? 1 : 0.75 }}>
                      {rule.matchMode === "all" ? "AND" : "OR"}
                    </Badge>
                    {allTabs.length > 0 && stats && (
                      <Badge
                        variant="subtle"
                        size="sm"
                        style={{
                          fontSize: "0.64rem",
                          backgroundColor:
                            rule.enabled && displayHits > 0 ? "var(--accent-subtle)" : "var(--bg-subtle)",
                          color:
                            rule.enabled && displayHits > 0 ? "var(--accent-text)" : "var(--text-muted)",
                          opacity: rule.enabled ? 1 : 0.75,
                        }}
                      >
                        命中 {displayHits}
                        {rule.enabled && stats.shadowedHits > 0 ? ` (冲突 ${stats.shadowedHits})` : ""}
                      </Badge>
                    )}
                  </div>

                  {/* Conditions */}
                  {chips.length > 0 && (
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.25rem" }}>
                      {chips.slice(0, 3).map((chip, cIdx) => (
                        <span
                          key={cIdx}
                          style={{
                            fontSize: "0.65rem",
                            padding: "1px 6px",
                            borderRadius: "4px",
                            backgroundColor: "var(--bg-subtle)",
                            color: "var(--text-muted)",
                            maxWidth: "100%",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                          title={chip}
                        >
                          {chip}
                        </span>
                      ))}
                      {chips.length > 3 && (
                        <span style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>
                          +{chips.length - 3}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Optional Sample Titles */}
                  {showSampleTitles && stats && stats.sampleTitles.length > 0 && (
                    <div
                      style={{
                        fontSize: "0.67rem",
                        color: "var(--text-muted)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.15rem",
                      }}
                    >
                      {stats.sampleTitles.slice(0, 2).map((title, tIdx) => (
                        <div key={tIdx} style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          · {title}
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Card Footer: Drag Handle + Edit/Delete */}
                <div
                  style={{
                    paddingTop: "0.45rem",
                    borderTop: "1px solid var(--border-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "0.25rem",
                  }}
                >
                  <span
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "0.25rem",
                      fontSize: "0.66rem",
                      color: "var(--text-muted)",
                      cursor: "grab",
                    }}
                    title="按住卡片拖动调整优先级"
                  >
                    <GripVertical size={13} />
                    <span>#{originalIndex + 1}</span>
                  </span>
                  <div
                    style={{ display: "flex", alignItems: "center", gap: "0.15rem" }}
                    onClick={(e) => e.stopPropagation()}
                  >
                    <Button
                      variant="ghost"
                      size="xs"
                      pill
                      onClick={() => openEditModal(rule)}
                      style={{ padding: "0.25rem" }}
                      title="编辑"
                    >
                      <Edit3 size={13} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="xs"
                      pill
                      onClick={() => deleteRule(rule.id)}
                      style={{ padding: "0.25rem", color: "var(--text-muted)" }}
                      title="删除"
                    >
                      <Trash2 size={13} />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div
          style={{
            borderRadius: "0.9rem",
            border: "1px solid var(--border-card)",
            backgroundColor: "var(--bg-surface)",
            overflow: "hidden",
          }}
        >
          {visibleRulesWithIndex.map(({ rawRule, originalIndex }, idx) => {
            const rule = normalizeRuleToDSL(rawRule);
            const stats = previewStats.get(rule.id);
            const chips = formatRuleConditionsCompact(rule);
            const actionType: RuleActionType = rule.action?.type || "group";
            const isDragTarget = dragOverRuleIdx === originalIndex && draggedRuleIdx !== originalIndex;

            return (
              <div
                key={rule.id}
                draggable={dragReadyIdx === originalIndex}
                onDragStart={(e) => {
                  if (dragReadyIdx !== originalIndex) {
                    e.preventDefault();
                    return;
                  }
                  e.dataTransfer.effectAllowed = "move";
                  e.dataTransfer.setData("text/plain", rule.id);
                  setDraggedRuleIdx(originalIndex);
                }}
                onDragOver={(e) => {
                  if (draggedRuleIdx === null) return;
                  e.preventDefault();
                  setDragOverRuleIdx(originalIndex);
                }}
                onDragLeave={() => {
                  if (dragOverRuleIdx === originalIndex) {
                    setDragOverRuleIdx(null);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (draggedRuleIdx !== null && draggedRuleIdx !== originalIndex) {
                    reorderRules(draggedRuleIdx, originalIndex);
                  }
                  setDraggedRuleIdx(null);
                  setDragOverRuleIdx(null);
                  setDragReadyIdx(null);
                }}
                onDragEnd={() => {
                  setDraggedRuleIdx(null);
                  setDragOverRuleIdx(null);
                  setDragReadyIdx(null);
                }}
                style={{
                  padding: "0.8rem 1rem",
                  borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)",
                  borderBottom: isDragTarget ? "2px solid var(--accent-solid)" : "2px solid transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  opacity: draggedRuleIdx === originalIndex ? 0.45 : rule.enabled ? 1 : 0.55,
                  backgroundColor: isDragTarget
                    ? "var(--accent-subtle)"
                    : rule.enabled
                      ? "var(--bg-card)"
                      : "transparent",
                  transition: "background-color 0.12s ease, opacity 0.12s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.65rem", minWidth: 0, flex: 1 }}>
                  <span
                    onMouseDown={() => setDragReadyIdx(originalIndex)}
                    onMouseUp={() => setDragReadyIdx(null)}
                    title="按住拖拽调整优先级"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      justifyContent: "center",
                      color: "var(--text-muted)",
                      cursor: "grab",
                      padding: "2px",
                      flexShrink: 0,
                    }}
                  >
                    <GripVertical size={15} />
                  </span>

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
                              rule.enabled && stats.effectiveHits > 0
                                ? "var(--accent-subtle)"
                                : "var(--bg-subtle)",
                            color:
                              rule.enabled && stats.effectiveHits > 0
                                ? "var(--accent-text)"
                                : "var(--text-muted)",
                            opacity: rule.enabled ? 1 : 0.75,
                          }}
                        >
                          命中 {rule.enabled ? stats.effectiveHits : stats.potentialHits}
                          {rule.enabled && stats.shadowedHits > 0 ? ` (冲突 ${stats.shadowedHits})` : ""}
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

                    {showSampleTitles && stats && stats.sampleTitles.length > 0 && (
                      <div style={{ fontSize: "0.68rem", color: "var(--text-muted)", marginTop: "0.3rem", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        示例：{stats.sampleTitles.slice(0, 2).join(" / ")}
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
                    disabled={originalIndex === 0}
                    onClick={() => reorderRules(originalIndex, originalIndex - 1)}
                    style={{ padding: "0.3rem" }}
                    title="上移优先级"
                  >
                    <ArrowUp size={13} />
                  </Button>

                  <Button
                    variant="ghost"
                    size="xs"
                    pill
                    disabled={originalIndex === rulesSettings.rules.length - 1}
                    onClick={() => reorderRules(originalIndex, originalIndex + 1)}
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
      )}

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

      {/* Rules Settings Hop-up Modal */}
      <RulesSettingsHopup
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        hasSnapshot={allTabs.length > 0}
        previewStats={previewStats}
      />
    </div>
  );
}
