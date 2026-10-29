"use client";

import React, { useState } from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConfigStore, ProcessScope } from "@/store/useConfigStore";
import { DomainMatchMode } from "@/services/domainMergeEngine";
import { X, SlidersHorizontal, Check, Globe } from "lucide-react";

interface DiffSettingsModalProps {
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
            backgroundColor: "#0f172a",
            border: "1px solid #334155",
            borderRadius: "1rem",
            color: "#f8fafc",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 40px rgba(0,0,0,0.8)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.85rem 1.25rem",
              borderBottom: "1px solid #1e293b",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "#111827",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <SlidersHorizontal size={16} color="#38bdf8" />
              <Dialog.Title style={{ fontSize: "0.95rem", fontWeight: 600 }}>处理与整理设置</Dialog.Title>
            </div>
            <Dialog.CloseTrigger asChild>
              <Button variant="ghost" size="xs" pill onClick={onClose} style={{ color: "#94a3b8", padding: "4px" }}>
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
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.5rem" }}>
                应用范围
              </label>
              <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap", marginBottom: "0.6rem" }}>
                <Button
                  type="button"
                  variant={localScope === "current" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalScope("current")}
                  style={{
                    backgroundColor: localScope === "current" ? "#2563eb" : "#1e293b",
                    borderColor: localScope === "current" ? "#3b82f6" : "#334155",
                    color: localScope === "current" ? "#fff" : "#94a3b8",
                  }}
                >
                  当前面板
                </Button>

                <Button
                  type="button"
                  variant={localScope === "all" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalScope("all")}
                  style={{
                    backgroundColor: localScope === "all" ? "#2563eb" : "#1e293b",
                    borderColor: localScope === "all" ? "#3b82f6" : "#334155",
                    color: localScope === "all" ? "#fff" : "#94a3b8",
                  }}
                >
                  所有面板
                </Button>

                <Button
                  type="button"
                  variant={localScope === "selected" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalScope("selected")}
                  style={{
                    backgroundColor: localScope === "selected" ? "#2563eb" : "#1e293b",
                    borderColor: localScope === "selected" ? "#3b82f6" : "#334155",
                    color: localScope === "selected" ? "#fff" : "#94a3b8",
                  }}
                >
                  多项面板
                </Button>
              </div>

              {localScope === "selected" && panels.length > 0 && (
                <div
                  style={{
                    padding: "0.65rem 0.85rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.4rem",
                    maxHeight: "130px",
                    overflowY: "auto",
                  }}
                >
                  <div style={{ fontSize: "0.72rem", color: "#94a3b8", marginBottom: "0.2rem" }}>勾选要参与处理的面板:</div>
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
                          color: isChecked ? "#f8fafc" : "#94a3b8",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() => handleTogglePanelSelect(p.id)}
                          style={{ accentColor: "#2563eb", cursor: "pointer" }}
                        />
                        <span>{p.name || p.id}</span>
                      </label>
                    );
                  })}
                </div>
              )}
            </div>

            {/* 2. Organization Settings */}
            <div style={{ borderTop: "1px solid #1e293b", paddingTop: "1rem" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1", marginBottom: "0.6rem" }}>
                标签整理常规设置
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    fontSize: "0.78rem",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localExemptPinned}
                    onChange={(e) => setLocalExemptPinned(e.target.checked)}
                    style={{ accentColor: "#2563eb", cursor: "pointer" }}
                  />
                  <span>豁免固定标签</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    fontSize: "0.78rem",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localExemptInternal}
                    onChange={(e) => setLocalExemptInternal(e.target.checked)}
                    style={{ accentColor: "#2563eb", cursor: "pointer" }}
                  />
                  <span>豁免关于与内建页</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    fontSize: "0.78rem",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localPreserveSubtrees}
                    onChange={(e) => setLocalPreserveSubtrees(e.target.checked)}
                    style={{ accentColor: "#2563eb", cursor: "pointer" }}
                  />
                  <span>保持子树完整性</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    fontSize: "0.78rem",
                    color: "#94a3b8",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localTreatGroupAsUnit}
                    onChange={(e) => setLocalTreatGroupAsUnit(e.target.checked)}
                    style={{ accentColor: "#2563eb", cursor: "pointer" }}
                  />
                  <span>原有 Group 视为整体</span>
                </label>

                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    fontSize: "0.78rem",
                    color: "#94a3b8",
                    cursor: "pointer",
                    gridColumn: "span 2",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={localCascade}
                    onChange={(e) => setLocalCascade(e.target.checked)}
                    style={{ accentColor: "#2563eb", cursor: "pointer" }}
                  />
                  <span>勾选标签时默认级联包含子标签</span>
                </label>
              </div>
            </div>

            {/* 3. Domain Merge Scheme */}
            <div style={{ borderTop: "1px solid #1e293b", paddingTop: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", marginBottom: "0.5rem" }}>
                <Globe size={14} color="#38bdf8" />
                <label style={{ fontSize: "0.8rem", fontWeight: 600, color: "#cbd5e1" }}>
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
                  style={{
                    backgroundColor: localMatchMode === "full" ? "#2563eb" : "#1e293b",
                    borderColor: localMatchMode === "full" ? "#3b82f6" : "#334155",
                    color: localMatchMode === "full" ? "#fff" : "#94a3b8",
                  }}
                >
                  匹配完整域名
                </Button>

                <Button
                  type="button"
                  variant={localMatchMode === "suffix" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalMatchMode("suffix")}
                  style={{
                    backgroundColor: localMatchMode === "suffix" ? "#2563eb" : "#1e293b",
                    borderColor: localMatchMode === "suffix" ? "#3b82f6" : "#334155",
                    color: localMatchMode === "suffix" ? "#fff" : "#94a3b8",
                  }}
                >
                  匹配域名后缀
                </Button>

                <Button
                  type="button"
                  variant={localMatchMode === "keyword" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalMatchMode("keyword")}
                  style={{
                    backgroundColor: localMatchMode === "keyword" ? "#2563eb" : "#1e293b",
                    borderColor: localMatchMode === "keyword" ? "#3b82f6" : "#334155",
                    color: localMatchMode === "keyword" ? "#fff" : "#94a3b8",
                  }}
                >
                  域名关键字匹配
                </Button>

                <Button
                  type="button"
                  variant={localMatchMode === "custom" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setLocalMatchMode("custom")}
                  style={{
                    backgroundColor: localMatchMode === "custom" ? "#2563eb" : "#1e293b",
                    borderColor: localMatchMode === "custom" ? "#3b82f6" : "#334155",
                    color: localMatchMode === "custom" ? "#fff" : "#94a3b8",
                  }}
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
                      backgroundColor: "#1e293b",
                      border: "1px solid #334155",
                      color: "#fff",
                      fontSize: "0.78rem",
                      outline: "none",
                    }}
                  />
                </div>
              )}

              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>同域名成组阈值:</span>
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
                    backgroundColor: "#1e293b",
                    border: "1px solid #334155",
                    color: "#fff",
                    fontSize: "0.75rem",
                    textAlign: "center",
                    outline: "none",
                  }}
                />
                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>个标签</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "0.85rem 1.25rem",
              borderTop: "1px solid #1e293b",
              display: "flex",
              justifyContent: "flex-end",
              alignItems: "center",
              gap: "0.5rem",
              backgroundColor: "#111827",
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
              style={{ backgroundColor: "#2563eb", borderColor: "#3b82f6", color: "#fff" }}
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
