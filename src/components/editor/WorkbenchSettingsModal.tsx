"use client";

import React from "react";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useConfigStore, WorkbenchPanelLayout } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { X, SlidersHorizontal, PanelLeft, PanelTop, ChevronDownSquare, RotateCcw } from "lucide-react";

interface WorkbenchSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const LAYOUT_OPTIONS: {
  id: WorkbenchPanelLayout;
  label: string;
  icon: React.ReactNode;
}[] = [
  { id: "vertical", label: "纵向排布", icon: <PanelLeft size={14} /> },
  { id: "horizontal", label: "横向排布", icon: <PanelTop size={14} /> },
  { id: "dropdown", label: "下拉菜单", icon: <ChevronDownSquare size={14} /> },
];

export function WorkbenchSettingsModal({ isOpen, onClose }: WorkbenchSettingsModalProps) {
  const {
    uiSettings,
    setUISettings,
    cascadeSelectChildren,
    setCascadeSelectChildren,
  } = useConfigStore();

  const {
    rawSnapshot,
    containerFilter,
    setContainerFilter,
    onlyDuplicates,
    setOnlyDuplicates,
    duplicateUrls,
    searchQuery,
    setSearchQuery,
    setActivePanelId,
    panelFilter,
  } = useSnapshotStore();

  if (!isOpen) return null;

  const currentLayout: WorkbenchPanelLayout = uiSettings?.workbenchPanelLayout || "vertical";
  const containers = rawSnapshot?.containers ? (Object.values(rawSnapshot.containers) as any[]) : [];
  const hasActiveFilters = Boolean(searchQuery || panelFilter || containerFilter || onlyDuplicates);

  const handleResetFilters = () => {
    setSearchQuery("");
    setActivePanelId(null);
    setContainerFilter(null);
    setOnlyDuplicates(false);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 110 }} />
      <Dialog.Positioner style={{ zIndex: 120 }}>
        <Dialog.Content
          style={{
            maxWidth: "440px",
            width: "92vw",
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
              padding: "0.8rem 1.15rem",
              borderBottom: "1px solid var(--border-subtle)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              backgroundColor: "var(--bg-surface)",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <SlidersHorizontal size={15} style={{ color: "var(--accent)" }} />
              <Dialog.Title style={{ fontSize: "0.9rem", fontWeight: 600 }}>工作台设置</Dialog.Title>
            </div>
            <Dialog.CloseTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                pill
                onClick={onClose}
                style={{ color: "var(--text-muted)", padding: "4px" }}
              >
                <X size={15} />
              </Button>
            </Dialog.CloseTrigger>
          </div>

          {/* Body */}
          <div style={{ padding: "1.1rem", display: "flex", flexDirection: "column", gap: "1.1rem" }}>
            {/* 1. Panel Layout Mode */}
            <div>
              <div style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "0.5rem" }}>
                面板排列方式
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.45rem" }}>
                {LAYOUT_OPTIONS.map((opt) => {
                  const active = currentLayout === opt.id;
                  return (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setUISettings({ workbenchPanelLayout: opt.id })}
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "0.35rem",
                        padding: "0.6rem 0.4rem",
                        borderRadius: "0.65rem",
                        border: "1px solid",
                        borderColor: active ? "var(--accent-solid)" : "var(--border-subtle)",
                        backgroundColor: active ? "var(--accent-subtle)" : "var(--bg-surface)",
                        color: active ? "var(--accent-text)" : "var(--text-muted)",
                        fontSize: "0.75rem",
                        fontWeight: active ? 600 : 500,
                        cursor: "pointer",
                        transition: "all 0.12s ease",
                      }}
                    >
                      {opt.icon}
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. Filter Options */}
            <div style={{ borderTop: "1px solid var(--border-subtle)", paddingTop: "0.9rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "0.6rem",
                }}
              >
                <span style={{ fontSize: "0.78rem", fontWeight: 600, color: "var(--text-main)" }}>
                  筛选选项
                </span>
                {hasActiveFilters && (
                  <Button
                    variant="ghost"
                    size="xs"
                    pill
                    onClick={handleResetFilters}
                    style={{ fontSize: "0.7rem", color: "var(--accent-text)", padding: "2px 6px" }}
                  >
                    <RotateCcw size={11} />
                    <span>重置筛选</span>
                  </Button>
                )}
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "0.65rem" }}>
                {/* Container Filter */}
                {containers.length > 0 && (
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.75rem" }}>
                    <span style={{ fontSize: "0.78rem", color: "var(--text-muted)" }}>容器筛选</span>
                    <select
                      value={containerFilter || ""}
                      onChange={(e) => setContainerFilter(e.target.value ? e.target.value : null)}
                      style={{
                        padding: "0.3rem 0.7rem",
                        borderRadius: "9999px",
                        backgroundColor: "var(--bg-subtle)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-main)",
                        fontSize: "0.75rem",
                        cursor: "pointer",
                        outline: "none",
                        maxWidth: "200px",
                      }}
                    >
                      <option value="">全部容器</option>
                      {containers.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Only Duplicates */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <span>仅显示重复 URL ({duplicateUrls.size})</span>
                  <input
                    type="checkbox"
                    checked={onlyDuplicates}
                    onChange={(e) => setOnlyDuplicates(e.target.checked)}
                    style={{ accentColor: "var(--accent-solid)", cursor: "pointer" }}
                  />
                </label>

                {/* Cascade Select Children */}
                <label
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    fontSize: "0.78rem",
                    color: "var(--text-muted)",
                    cursor: "pointer",
                  }}
                >
                  <span>勾选父项时联动子项</span>
                  <input
                    type="checkbox"
                    checked={cascadeSelectChildren}
                    onChange={(e) => setCascadeSelectChildren(e.target.checked)}
                    style={{ accentColor: "var(--accent-solid)", cursor: "pointer" }}
                  />
                </label>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "0.75rem 1.15rem",
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
