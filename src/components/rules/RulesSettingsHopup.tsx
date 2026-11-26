"use client";

import React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useConfigStore, RulesLayoutMode } from "@/store/useConfigStore";
import { confirmAction, toast } from "@/store/useFeedbackStore";
import { DEFAULT_RULES_SETTINGS, RulePreviewStats } from "@/services/ruleEngine";
import {
  X,
  SlidersHorizontal,
  List,
  LayoutGrid,
  ArrowDownWideNarrow,
  EyeOff,
  RotateCcw,
} from "lucide-react";

interface RulesSettingsHopupProps {
  isOpen: boolean;
  onClose: () => void;
  hasSnapshot: boolean;
  previewStats: Map<string, RulePreviewStats>;
}

export function RulesSettingsHopup({
  isOpen,
  onClose,
  hasSnapshot,
  previewStats,
}: RulesSettingsHopupProps) {
  const {
    uiSettings,
    setUISettings,
    rulesSettings,
    setRulesSettings,
    exemptPinned,
    setExemptPinned,
    exemptInternalPages,
    setExemptInternalPages,
  } = useConfigStore();

  if (!isOpen) return null;

  const currentLayout: RulesLayoutMode = uiSettings?.rulesLayoutMode || "list";

  const handleSortByHits = () => {
    const sorted = [...rulesSettings.rules].sort((a, b) => {
      const hitsA = previewStats.get(a.id)?.effectiveHits || 0;
      const hitsB = previewStats.get(b.id)?.effectiveHits || 0;
      return hitsB - hitsA;
    });
    setRulesSettings({ rules: sorted });
  };

  const handleDisableZeroHits = () => {
    if (!hasSnapshot) return;
    const updated = rulesSettings.rules.map((r) => {
      const hits = previewStats.get(r.id)?.effectiveHits || 0;
      return hits === 0 ? { ...r, enabled: false } : r;
    });
    setRulesSettings({ rules: updated });
  };

  const handleResetDefaultRules = async () => {
    const confirmed = await confirmAction({
      title: "恢复默认规则",
      message: "确定恢复为默认预设规则列表？当前自定义规则将被替换。",
      confirmLabel: "恢复默认",
      destructive: true,
    });
    if (confirmed) {
      setRulesSettings({ rules: DEFAULT_RULES_SETTINGS.rules });
      toast.success("已恢复默认预设规则");
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 110 }} />
      <Dialog.Positioner style={{ zIndex: 120 }}>
        <Dialog.Content
          style={{
            maxWidth: "460px",
            width: "92vw",
            maxHeight: "86vh",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.45)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.8rem 1.15rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <SlidersHorizontal size={15} style={{ color: "var(--accent)" }} />
              <Dialog.Title style={{ fontSize: "0.9rem", fontWeight: 600 }}>规则管理设置</Dialog.Title>
            </div>
            <Dialog.CloseTrigger asChild>
              <Button variant="ghost" size="xs" pill onClick={onClose} style={{ padding: "4px" }}>
                <X size={15} />
              </Button>
            </Dialog.CloseTrigger>
          </div>

          {/* Body */}
          <div
            style={{
              padding: "1.05rem 1.15rem",
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "1.05rem",
            }}
          >
            {/* 1. Layout & Display */}
            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.45rem" }}>
                卡片与显示布局
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.45rem", marginBottom: "0.6rem" }}>
                {(
                  [
                    { id: "list" as RulesLayoutMode, label: "紧凑列表", icon: <List size={14} /> },
                    { id: "grid" as RulesLayoutMode, label: "多列卡片", icon: <LayoutGrid size={14} /> },
                  ] as const
                ).map((opt) => {
                  const active = currentLayout === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setUISettings({ rulesLayoutMode: opt.id })}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.4rem",
                        padding: "0.55rem 0.6rem",
                        borderRadius: "0.6rem",
                        border: "1px solid",
                        borderColor: active ? "var(--accent-solid)" : "var(--border-subtle)",
                        backgroundColor: active ? "var(--accent-subtle)" : "var(--bg-surface)",
                        color: active ? "var(--accent-text)" : "var(--text-muted)",
                        fontSize: "0.76rem",
                        fontWeight: active ? 600 : 500,
                        cursor: "pointer",
                      }}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
                {[
                  {
                    label: "隐藏已禁用规则",
                    checked: Boolean(uiSettings?.rulesHideDisabled),
                    onChange: (v: boolean) => setUISettings({ rulesHideDisabled: v }),
                  },
                  {
                    label: "仅显示当前快照有命中的规则",
                    checked: Boolean(uiSettings?.rulesOnlyWithHits),
                    onChange: (v: boolean) => setUISettings({ rulesOnlyWithHits: v }),
                  },
                  {
                    label: "显示命中标签示例标题",
                    checked: Boolean(uiSettings?.rulesShowSampleTitles),
                    onChange: (v: boolean) => setUISettings({ rulesShowSampleTitles: v }),
                  },
                ].map((item) => (
                  <label
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.55rem",
                      padding: "0.42rem 0.65rem",
                      borderRadius: "0.5rem",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "0.76rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.onChange(e.target.checked)}
                      style={{ accentColor: "var(--accent-solid)", width: "14px", height: "14px", cursor: "pointer" }}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 2. Engine Global Parameters */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.9rem" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                规则引擎参数
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "0.45rem 0.65rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    fontSize: "0.76rem",
                  }}
                >
                  <span>默认最小成组阈值</span>
                  <Input
                    type="number"
                    min={1}
                    max={20}
                    size="sm"
                    value={rulesSettings.defaultMinThreshold}
                    onChange={(e) =>
                      setRulesSettings({ defaultMinThreshold: Math.max(1, parseInt(e.target.value, 10) || 1) })
                    }
                    style={{ width: "58px", textAlign: "center", fontSize: "0.74rem", padding: "0.18rem" }}
                  />
                </div>

                {[
                  {
                    label: "保留已有 Group 为整体",
                    checked: rulesSettings.treatExistingGroupsAsUnit,
                    onChange: (v: boolean) => setRulesSettings({ treatExistingGroupsAsUnit: v }),
                  },
                  {
                    label: "跳过已固定标签 (Pinned)",
                    checked: exemptPinned,
                    onChange: (v: boolean) => setExemptPinned(v),
                  },
                  {
                    label: "跳过浏览器内部页面",
                    checked: exemptInternalPages,
                    onChange: (v: boolean) => setExemptInternalPages(v),
                  },
                ].map((item) => (
                  <label
                    key={item.label}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "0.55rem",
                      padding: "0.42rem 0.65rem",
                      borderRadius: "0.5rem",
                      backgroundColor: "var(--bg-surface)",
                      border: "1px solid var(--border-subtle)",
                      fontSize: "0.76rem",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={item.checked}
                      onChange={(e) => item.onChange(e.target.checked)}
                      style={{ accentColor: "var(--accent-solid)", width: "14px", height: "14px", cursor: "pointer" }}
                    />
                    <span>{item.label}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* 3. Quick Batch Tools */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.9rem" }}>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, marginBottom: "0.5rem" }}>
                快捷批量管理
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.4rem" }}>
                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  pill
                  disabled={!hasSnapshot}
                  onClick={handleSortByHits}
                  title="按当前快照命中数量从高到低重排优先级"
                >
                  <ArrowDownWideNarrow size={12} />
                  <span>按命中数排序</span>
                </Button>

                <Button
                  type="button"
                  variant="outline"
                  size="xs"
                  pill
                  disabled={!hasSnapshot}
                  onClick={handleDisableZeroHits}
                  title="禁用当前快照未命中的规则"
                >
                  <EyeOff size={12} />
                  <span>禁用 0 命中规则</span>
                </Button>

                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={handleResetDefaultRules}
                  style={{ color: "var(--text-muted)" }}
                >
                  <RotateCcw size={12} />
                  <span>恢复默认规则</span>
                </Button>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "0.7rem 1.15rem",
              borderTop: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Button variant="solid" size="xs" pill onClick={onClose}>
              完成
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
