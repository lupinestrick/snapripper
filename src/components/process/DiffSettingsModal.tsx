"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConfigStore, ProcessScope } from "@/store/useConfigStore";
import { DomainMatchMode } from "@/services/domainMergeEngine";
import { X, SlidersHorizontal, Check, Globe } from "lucide-react";

export interface DiffSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  activePanelId?: string;
  panels?: Array<{ id: string; name: string }>;
  onSave?: () => void;
}

export function DiffSettingsModal({
  isOpen,
  onClose,
  activePanelId,
  panels = [],
  onSave,
}: DiffSettingsModalProps) {
  const {
    processScope,
    setProcessScope,
    selectedProcessPanelIds,
    setSelectedProcessPanelIds,
    domainMergeConfig,
    setDomainMergeConfig,
    exemptPinned,
    setExemptPinned,
    exemptInternalPages,
    setExemptInternalPages,
    preserveSubtrees,
    setPreserveSubtrees,
    cascadeSelectChildren,
    setCascadeSelectChildren,
    rulesSettings,
    setRulesSettings,
  } = useConfigStore();

  // Local draft states
  const [localScope, setLocalScope] = useState<ProcessScope>(processScope);
  const [localSelectedPanels, setLocalSelectedPanels] = useState<string[]>(
    selectedProcessPanelIds.length > 0 ? selectedProcessPanelIds : activePanelId ? [activePanelId] : []
  );

  const [localMatchMode, setLocalMatchMode] = useState<DomainMatchMode>(domainMergeConfig.matchMode);
  const [localCustomPattern, setLocalCustomPattern] = useState<string>(domainMergeConfig.customPattern || "");
  const [localMinThreshold, setLocalMinThreshold] = useState<number>(domainMergeConfig.minThreshold || 2);

  const [localExemptPinned, setLocalExemptPinned] = useState(exemptPinned);
  const [localExemptInternal, setLocalExemptInternal] = useState(exemptInternalPages);
  const [localPreserveSubtrees, setLocalPreserveSubtrees] = useState(preserveSubtrees);
  const [localCascade, setLocalCascade] = useState(cascadeSelectChildren);
  const [localTreatGroupAsUnit, setLocalTreatGroupAsUnit] = useState(
    rulesSettings.treatExistingGroupsAsUnit ?? true
  );

  const handleTogglePanelSelect = (pId: string) => {
    if (localSelectedPanels.includes(pId)) {
      setLocalSelectedPanels(localSelectedPanels.filter((id) => id !== pId));
    } else {
      setLocalSelectedPanels([...localSelectedPanels, pId]);
    }
  };

  const handleSaveAndApply = () => {
    setProcessScope(localScope);
    setSelectedProcessPanelIds(localSelectedPanels);
    setDomainMergeConfig({
      matchMode: localMatchMode,
      customPattern: localCustomPattern,
      minThreshold: localMinThreshold,
    });
    setExemptPinned(localExemptPinned);
    setExemptInternalPages(localExemptInternal);
    setPreserveSubtrees(localPreserveSubtrees);
    setCascadeSelectChildren(localCascade);
    setRulesSettings({
      treatExistingGroupsAsUnit: localTreatGroupAsUnit,
    });

    onSave?.();
    onClose();
  };

  if (!isOpen) return null;

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 110 }} />
      <Dialog.Positioner style={{ zIndex: 120 }}>
        <Dialog.Content
          style={{
            maxWidth: "540px",
            width: "92vw",
            maxHeight: "85vh",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.85rem 1.25rem",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <SlidersHorizontal size={16} color="var(--accent-default)" />
              <Dialog.Title style={{ fontSize: "0.95rem", fontWeight: 600 }}>处理与整理设置</Dialog.Title>
            </div>
            <Dialog.CloseTrigger asChild>
              <Button variant="ghost" size="xs" pill onClick={onClose} style={{ color: "var(--text-muted)", padding: "4px" }}>
                <X size={16} />
              </Button>
            </Dialog.CloseTrigger>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              overflowY: "auto",
              padding: "1.25rem",
              display: "flex",
              flexDirection: "column",
              gap: "1.25rem",
            }}
          >
            {/* 1. Scope Option */}
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "0.5rem" }}>
                应用范围
              </label>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                <Button
                  type="button"
                  variant={localScope === "current" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalScope("current")}
                >
                  当前面板
                </Button>

                <Button
                  type="button"
                  variant={localScope === "all" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalScope("all")}
                >
                  所有面板
                </Button>

                <Button
                  type="button"
                  variant={localScope === "selected" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalScope("selected")}
                >
                  多项面板
                </Button>
              </div>

              {localScope === "selected" && panels.length > 0 && (
                <div
                  style={{
                    padding: "0.65rem 0.85rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                    maxHeight: "130px",
                    overflowY: "auto",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>勾选要参与处理的面板:</div>
                  {panels.map((p) => {
                    const isChecked = localSelectedPanels.includes(p.id);
                    return (
                      <label
                        key={p.id}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.45rem",
                          fontSize: "0.78rem",
                          color: isChecked ? "var(--text-main)" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePanelSelect(p.id)}
                          style={{ accentColor: "var(--accent-default)", cursor: "pointer" }}
                        />
                        <span>{p.name || p.id}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Organization Settings */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "0.6rem" }}>
                标签整理常规设置
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localExemptPinned}
                    onChange={(e) => setLocalExemptPinned(e.target.checked)}
                    style={{ accentColor: "var(--accent-default)", cursor: "pointer" }}
                  />
                  <span>豁免固定标签</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localExemptInternal}
                    onChange={(e) => setLocalExemptInternal(e.target.checked)}
                    style={{ accentColor: "var(--accent-default)", cursor: "pointer" }}
                  />
                  <span>豁免关于与内建页</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localPreserveSubtrees}
                    onChange={(e) => setLocalPreserveSubtrees(e.target.checked)}
                    style={{ accentColor: "var(--accent-default)", cursor: "pointer" }}
                  />
                  <span>保持子树完整性</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localTreatGroupAsUnit}
                    onChange={(e) => setLocalTreatGroupAsUnit(e.target.checked)}
                    style={{ accentColor: "var(--accent-default)", cursor: "pointer" }}
                  />
                  <span>原有 Group 视为整体</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                    gridColumn: "span 2",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localCascade}
                    onChange={(e) => setLocalCascade(e.target.checked)}
                    style={{ accentColor: "var(--accent-default)", cursor: "pointer" }}
                  />
                  <span>勾选标签时默认级联包含子标签</span>
                </label>
              </div>
            </div>

            {/* 3. Domain Merge Scheme */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
                <Globe size={14} color="var(--accent-default)" />
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "var(--text-main)" }}>
                  同域名合并方案
                </label>
              </div>

              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                <Button
                  type="button"
                  variant={localMatchMode === "full" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalMatchMode("full")}
                >
                  匹配完整域名
                </Button>

                <Button
                  type="button"
                  variant={localMatchMode === "suffix" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalMatchMode("suffix")}
                >
                  匹配域名后缀
                </Button>

                <Button
                  type="button"
                  variant={localMatchMode === "keyword" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalMatchMode("keyword")}
                >
                  域名关键字匹配
                </Button>

                <Button
                  type="button"
                  variant={localMatchMode === "custom" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalMatchMode("custom")}
                >
                  自定义选项
                </Button>
              </div>

              {localMatchMode === "custom" && (
                <div style={{ marginBottom: "0.6rem" }}>
                  <input
                    type="text"
                    placeholder="自定义正则提取规则，如 (?:https?:\/\/)?([^\/]+)"
                    value={localCustomPattern}
                    onChange={(e) => setLocalCustomPattern(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "0.35rem 0.65rem",
                      borderRadius: "0.4rem",
                      backgroundColor: "var(--bg-subtle)",
                      border: "1px solid var(--border-subtle)",
                      color: "var(--text-main)",
                      fontSize: "0.78rem",
                      outline: "none",
                    }}
                  />
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>同域名成组阈值:</span>
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={localMinThreshold}
                  onChange={(e) => setLocalMinThreshold(Math.max(1, parseInt(e.target.value) || 2))}
                  style={{
                    width: "55px",
                    padding: "0.25rem 0.5rem",
                    borderRadius: "0.4rem",
                    backgroundColor: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    color: "var(--text-main)",
                    fontSize: "0.75rem",
                    textAlign: "center",
                    outline: "none",
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>个标签</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "0.85rem 1.25rem",
              borderTop: "1px solid var(--border-subtle)",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "0.5rem",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            <Button variant="ghost" size="xs" pill onClick={onClose}>
              取消
            </Button>
            <Button
              variant="solid"
              size="xs"
              pill
              onClick={handleSaveAndApply}
            >
              <Check size={13} />
              <span>保存并应用</span>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}

export default DiffSettingsModal;
