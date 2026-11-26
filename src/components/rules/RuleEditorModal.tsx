"use client";

import React, { useState, useMemo, useEffect } from "react";
import {
  CategorizationRule,
  RuleActionType,
  RuleCondition,
  RuleConditionField,
  RuleConditionOperator,
  RuleMatchMode,
  RuleScope,
  SideberyTab,
} from "@/types/sidebery";
import { matchTabWithRule, normalizeRuleToDSL } from "@/services/ruleEngine";
import { toast } from "@/store/useFeedbackStore";
import { isExemptUrl } from "@/utils/urlHelper";
import { isGroupTab } from "@/services/snapshotParser";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { X, Plus, Trash2, Check } from "lucide-react";

interface RuleEditorModalProps {
  isOpen: boolean;
  initialRule: Omit<CategorizationRule, "id"> | CategorizationRule | null;
  isNew: boolean;
  panels: Record<string, any>;
  containers: Record<string, any>;
  snapshotTabs: SideberyTab[];
  onClose: () => void;
  onSave: (rule: Omit<CategorizationRule, "id"> | CategorizationRule) => void;
}

const COLOR_SWATCHES = [
  "#3b82f6",
  "#10b981",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#f59e0b",
  "#ec4899",
  "#64748b",
  "#f97316",
];

function createEmptyCondition(): RuleCondition {
  return {
    id: `cond_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    field: "domain",
    operator: "contains",
    value: "",
  };
}

export function RuleEditorModal({
  isOpen,
  initialRule,
  isNew,
  panels,
  containers,
  snapshotTabs,
  onClose,
  onSave,
}: RuleEditorModalProps) {
  const [draft, setDraft] = useState<CategorizationRule | null>(null);

  useEffect(() => {
    if (!isOpen || !initialRule) return;
    const base: CategorizationRule = {
      id: "id" in initialRule ? initialRule.id : `draft_${Date.now()}`,
      ...initialRule,
    };
    const normalized = normalizeRuleToDSL(base);
    if (!normalized.conditions || normalized.conditions.length === 0) {
      normalized.conditions = [createEmptyCondition()];
    }
    setDraft(normalized);
  }, [isOpen, initialRule]);

  const liveMatches = useMemo(() => {
    if (!draft || snapshotTabs.length === 0) return [];
    const evalRule: CategorizationRule = { ...draft, enabled: true };
    return snapshotTabs.filter(
      (t) => !t.pinned && !isExemptUrl(t.url, t.pinned) && !isGroupTab(t) && matchTabWithRule(t, evalRule)
    );
  }, [draft, snapshotTabs]);

  if (!isOpen || !draft) return null;

  const conditions = draft.conditions || [];
  const actionType: RuleActionType = draft.action?.type || "group";

  const handleUpdateCondition = (idx: number, partial: Partial<RuleCondition>) => {
    const next = conditions.map((c, i) => (i === idx ? { ...c, ...partial } : c));
    setDraft({ ...draft, conditions: next });
  };

  const handleRemoveCondition = (idx: number) => {
    const next = conditions.filter((_, i) => i !== idx);
    setDraft({
      ...draft,
      conditions: next.length > 0 ? next : [createEmptyCondition()],
    });
  };

  const handleAddCondition = () => {
    setDraft({
      ...draft,
      conditions: [...conditions, createEmptyCondition()],
    });
  };

  const handleSubmit = () => {
    if (!draft.name.trim()) {
      toast.warning("请输入规则名称");
      return;
    }
    const validConditions = conditions.filter((c) => c.value.trim().length > 0);
    if (validConditions.length === 0) {
      toast.warning("请至少填写一条有效条件");
      return;
    }

    const cleaned: CategorizationRule = {
      ...draft,
      name: draft.name.trim(),
      conditions: validConditions,
      // 同步清掉旧版字符串字段，避免旧值干扰新条件修改
      matchDomain: undefined,
      matchKeyword: undefined,
      action: {
        ...draft.action,
        type: actionType,
        createGroup: actionType === "group" || actionType === "groupAndMove",
      },
    };

    if (isNew) {
      const { id: _ignore, ...withoutId } = cleaned;
      onSave(withoutId);
    } else {
      onSave(cleaned);
    }
    onClose();
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 110 }} />
      <Dialog.Positioner style={{ zIndex: 120 }}>
        <Dialog.Content
          style={{
            maxWidth: "620px",
            width: "94vw",
            maxHeight: "88vh",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 40px rgba(0,0,0,0.45)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.8rem 1.2rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <Dialog.Title style={{ fontSize: "0.95rem", fontWeight: 600 }}>
              {isNew ? "新建规则" : "编辑规则"}
            </Dialog.Title>
            <Dialog.CloseTrigger asChild>
              <Button variant="ghost" size="xs" pill onClick={onClose} style={{ padding: "4px" }}>
                <X size={16} />
              </Button>
            </Dialog.CloseTrigger>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.1rem 1.2rem",
              display: "flex",
              flexDirection: "column",
              gap: "1rem",
            }}
          >
            {/* Name + Color + Threshold */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr auto", gap: "0.75rem", alignItems: "end" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                  规则 / 分组名称
                </label>
                <Input
                  type="text"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  placeholder="例如: 💻 前端研发"
                />
              </div>

              {actionType !== "moveToPanel" && actionType !== "exempt" && (
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.3rem" }}>
                    成组阈值
                  </label>
                  <Input
                    type="number"
                    min={1}
                    max={30}
                    value={draft.minThreshold}
                    onChange={(e) =>
                      setDraft({ ...draft, minThreshold: Math.max(1, parseInt(e.target.value) || 1) })
                    }
                    style={{ width: "76px", textAlign: "center" }}
                  />
                </div>
              )}
            </div>

            {/* Color Swatches + Scope */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "0.75rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
                {COLOR_SWATCHES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setDraft({ ...draft, color: c })}
                    style={{
                      width: "18px",
                      height: "18px",
                      borderRadius: "50%",
                      backgroundColor: c,
                      border: draft.color === c ? "2px solid var(--text-main)" : "2px solid transparent",
                      cursor: "pointer",
                    }}
                  />
                ))}
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                <Select
                  value={draft.scope}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      scope: e.target.value as RuleScope,
                      targetScopeId: "",
                    })
                  }
                  pill={false}
                  style={{ fontSize: "0.75rem" }}
                >
                  <option value="all">全局范围</option>
                  <option value="panel">限定面板</option>
                  <option value="container">限定容器</option>
                </Select>

                {draft.scope === "panel" && (
                  <Select
                    value={draft.targetScopeId || ""}
                    onChange={(e) => setDraft({ ...draft, targetScopeId: e.target.value })}
                    pill={false}
                    style={{ fontSize: "0.75rem" }}
                  >
                    <option value="">选择面板...</option>
                    {Object.entries(panels).map(([id, p]: [string, any]) => (
                      <option key={id} value={id}>
                        {p.name || id}
                      </option>
                    ))}
                  </Select>
                )}

                {draft.scope === "container" && (
                  <Select
                    value={draft.targetScopeId || ""}
                    onChange={(e) => setDraft({ ...draft, targetScopeId: e.target.value })}
                    pill={false}
                    style={{ fontSize: "0.75rem" }}
                  >
                    <option value="">选择容器...</option>
                    {Object.entries(containers).map(([id, c]: [string, any]) => (
                      <option key={id} value={id}>
                        {c.name || id}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </div>

            {/* Condition Group DSL */}
            <div
              style={{
                padding: "0.85rem",
                borderRadius: "0.75rem",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "0.6rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>匹配条件 (When)</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.25rem" }}>
                  {(["all", "any"] as RuleMatchMode[]).map((mode) => (
                    <button
                      key={mode}
                      type="button"
                      onClick={() => setDraft({ ...draft, matchMode: mode })}
                      style={{
                        padding: "2px 8px",
                        borderRadius: "9999px",
                        fontSize: "0.7rem",
                        border: "1px solid",
                        borderColor:
                          (draft.matchMode || "all") === mode
                            ? "var(--accent-border)"
                            : "var(--border-subtle)",
                        backgroundColor:
                          (draft.matchMode || "all") === mode
                            ? "var(--accent-subtle)"
                            : "transparent",
                        color:
                          (draft.matchMode || "all") === mode
                            ? "var(--accent-text)"
                            : "var(--text-muted)",
                        cursor: "pointer",
                      }}
                    >
                      {mode === "all" ? "满足全部 (AND)" : "满足任一 (OR)"}
                    </button>
                  ))}
                </div>
              </div>

              {conditions.map((cond, idx) => (
                <div
                  key={cond.id}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "92px 86px 1fr 28px",
                    gap: "0.4rem",
                    alignItems: "center",
                  }}
                >
                  <Select
                    value={cond.field}
                    onChange={(e) =>
                      handleUpdateCondition(idx, { field: e.target.value as RuleConditionField })
                    }
                    pill={false}
                    style={{ fontSize: "0.74rem", padding: "0.3rem 0.4rem" }}
                  >
                    <option value="domain">域名</option>
                    <option value="urlPath">路径</option>
                    <option value="title">标题</option>
                    <option value="url">完整 URL</option>
                    <option value="panel">来源面板</option>
                    <option value="container">所属容器</option>
                  </Select>

                  <Select
                    value={cond.operator}
                    onChange={(e) =>
                      handleUpdateCondition(idx, {
                        operator: e.target.value as RuleConditionOperator,
                      })
                    }
                    pill={false}
                    style={{ fontSize: "0.74rem", padding: "0.3rem 0.4rem" }}
                  >
                    <option value="contains">包含</option>
                    <option value="equals">等于</option>
                    <option value="startsWith">开头为</option>
                    <option value="regex">正则</option>
                    <option value="notContains">不包含</option>
                    <option value="notEquals">不等于</option>
                  </Select>

                  <Input
                    type="text"
                    value={cond.value}
                    onChange={(e) => handleUpdateCondition(idx, { value: e.target.value })}
                    placeholder={
                      cond.operator === "regex"
                        ? "正则表达式"
                        : "值（多值用逗号分隔）"
                    }
                    style={{ fontSize: "0.76rem", padding: "0.32rem 0.55rem" }}
                  />

                  <Button
                    type="button"
                    variant="ghost"
                    size="xs"
                    pill
                    onClick={() => handleRemoveCondition(idx)}
                    style={{ padding: "4px", color: "var(--text-muted)" }}
                  >
                    <Trash2 size={13} />
                  </Button>
                </div>
              ))}

              <div>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  pill
                  onClick={handleAddCondition}
                  style={{ fontSize: "0.72rem" }}
                >
                  <Plus size={12} />
                  <span>添加条件</span>
                </Button>
              </div>
            </div>

            {/* Action Selector */}
            <div
              style={{
                padding: "0.85rem",
                borderRadius: "0.75rem",
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                display: "flex",
                flexDirection: "column",
                gap: "0.55rem",
              }}
            >
              <span style={{ fontSize: "0.78rem", fontWeight: 600 }}>执行动作 (Then)</span>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                <Select
                  value={actionType}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      action: {
                        ...draft.action,
                        type: e.target.value as RuleActionType,
                      },
                    })
                  }
                  pill={false}
                  style={{ fontSize: "0.76rem" }}
                >
                  <option value="group">自动建折叠组</option>
                  <option value="groupAndMove">建组并移至指定面板</option>
                  <option value="moveToPanel">仅移至指定面板</option>
                  <option value="exempt">跳过保护（不归类）</option>
                </Select>

                {(actionType === "moveToPanel" || actionType === "groupAndMove") && (
                  <Select
                    value={draft.action?.targetPanelId || ""}
                    onChange={(e) => {
                      const pid = e.target.value;
                      setDraft({
                        ...draft,
                        action: {
                          ...draft.action,
                          type: actionType,
                          targetPanelId: pid,
                          targetPanelName: panels[pid]?.name || pid,
                        },
                      });
                    }}
                    pill={false}
                    style={{ fontSize: "0.76rem" }}
                  >
                    <option value="">选择目标面板...</option>
                    {Object.entries(panels).map(([id, p]: [string, any]) => (
                      <option key={id} value={id}>
                        {p.name || id}
                      </option>
                    ))}
                  </Select>
                )}
              </div>
            </div>

            {/* Live Match Preview */}
            {snapshotTabs.length > 0 && (
              <div
                style={{
                  padding: "0.65rem 0.85rem",
                  borderRadius: "0.65rem",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px dashed var(--border-card)",
                  fontSize: "0.74rem",
                  color: "var(--text-muted)",
                }}
              >
                <div>
                  当前快照预计命中{" "}
                  <strong style={{ color: liveMatches.length > 0 ? "var(--accent-text)" : "var(--text-main)" }}>
                    {liveMatches.length}
                  </strong>{" "}
                  个标签
                </div>
                {liveMatches.length > 0 && (
                  <div
                    style={{
                      marginTop: "0.3rem",
                      whiteSpace: "nowrap",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                    }}
                  >
                    样本：{liveMatches.slice(0, 3).map((t) => t.title || t.url).join(" · ")}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "0.75rem 1.2rem",
              borderTop: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.5rem",
            }}
          >
            <Button variant="outline" size="xs" pill onClick={onClose}>
              取消
            </Button>
            <Button variant="solid" size="xs" pill onClick={handleSubmit}>
              <Check size={13} />
              <span>保存</span>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
