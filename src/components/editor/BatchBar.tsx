"use client";

import React, { useState } from "react";
import { Trash2, Pin, PinOff, FolderInput, X } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { Button } from "@/components/ui/button";

export function BatchBar() {
  const {
    selectedIds,
    clearSelection,
    deleteSelected,
    markSelectedPinned,
    moveSelectedToPanel,
    rawSnapshot,
  } = useSnapshotStore();

  const [panelSelectOpen, setPanelSelectOpen] = useState(false);
  const panels = rawSnapshot?.panels ? (Object.values(rawSnapshot.panels) as any[]) : [];

  if (selectedIds.size === 0) return null;

  return (
    <div
      style={{
        position: "fixed",
        bottom: "1.25rem",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--border-card)",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
        borderRadius: "9999px",
        padding: "0.35rem 0.85rem",
        display: "flex",
        alignItems: "center",
        gap: "0.4rem",
        zIndex: 50,
      }}
    >
      <div style={{ fontSize: "0.76rem", fontWeight: 600, color: "var(--accent)", padding: "0 0.25rem" }}>
        已选 {selectedIds.size} 项
      </div>

      <div style={{ height: "1rem", width: "1px", backgroundColor: "var(--border-subtle)" }} />

      <Button
        size="xs"
        pill
        onClick={deleteSelected}
        style={{
          backgroundColor: "rgba(239, 68, 68, 0.14)",
          color: "var(--danger)",
          borderColor: "rgba(239, 68, 68, 0.3)",
        }}
      >
        <Trash2 size={12} />
        <span>删除</span>
      </Button>

      <Button
        size="xs"
        pill
        onClick={() => markSelectedPinned(true)}
        style={{
          backgroundColor: "rgba(245, 158, 11, 0.14)",
          color: "var(--warning)",
          borderColor: "rgba(245, 158, 11, 0.3)",
        }}
      >
        <Pin size={12} />
        <span>固定</span>
      </Button>

      <Button size="xs" pill onClick={() => markSelectedPinned(false)}>
        <PinOff size={12} />
        <span>解固</span>
      </Button>

      {panels.length > 0 && (
        <div style={{ position: "relative" }}>
          <Button
            size="xs"
            pill
            onClick={() => setPanelSelectOpen(!panelSelectOpen)}
            style={{ color: "var(--accent)" }}
          >
            <FolderInput size={12} />
            <span>移至</span>
          </Button>

          {panelSelectOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "120%",
                left: 0,
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-card)",
                boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.3)",
                borderRadius: "0.75rem",
                padding: "0.3rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.15rem",
                minWidth: "150px",
                maxHeight: "240px",
                overflowY: "auto",
              }}
            >
              {panels.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  size="xs"
                  pill={false}
                  onClick={() => {
                    moveSelectedToPanel(p.id);
                    setPanelSelectOpen(false);
                  }}
                  style={{
                    justifyContent: "flex-start",
                    color: "var(--text-main)",
                    fontSize: "0.75rem",
                    padding: "0.3rem 0.55rem",
                  }}
                >
                  {p.name || p.id}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      <Button
        variant="ghost"
        size="xs"
        pill
        onClick={clearSelection}
        style={{ width: "24px", height: "24px", padding: 0, color: "var(--text-muted)" }}
        title="清除"
      >
        <X size={13} />
      </Button>
    </div>
  );
}
