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
        bottom: "1.5rem",
        left: "50%",
        transform: "translateX(-50%)",
        backgroundColor: "#111827",
        border: "1px solid #334155",
        borderRadius: "9999px",
        padding: "0.4rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.5rem",
        zIndex: 50,
      }}
    >
      <div style={{ fontSize: "0.8rem", fontWeight: 600, color: "#38bdf8", padding: "0 0.3rem" }}>
        已选择 {selectedIds.size} 项
      </div>

      <div style={{ height: "1.2rem", width: "1px", backgroundColor: "#334155" }} />

      {/* Delete button */}
      <Button
        onClick={deleteSelected}
        style={{
          backgroundColor: "rgba(239, 68, 68, 0.15)",
          color: "#f87171",
          borderColor: "rgba(239, 68, 68, 0.3)",
        }}
      >
        <Trash2 size={13} />
        <span>批量删除</span>
      </Button>

      {/* Pin toggle */}
      <Button
        onClick={() => markSelectedPinned(true)}
        style={{
          backgroundColor: "rgba(245, 158, 11, 0.15)",
          color: "#fbbf24",
          borderColor: "rgba(245, 158, 11, 0.3)",
        }}
      >
        <Pin size={13} />
        <span>标记固定</span>
      </Button>

      <Button
        onClick={() => markSelectedPinned(false)}
      >
        <PinOff size={13} />
        <span>取消固定</span>
      </Button>

      {/* Move to Panel */}
      {panels.length > 0 && (
        <div style={{ position: "relative" }}>
          <Button
            onClick={() => setPanelSelectOpen(!panelSelectOpen)}
            style={{
              color: "#38bdf8",
            }}
          >
            <FolderInput size={13} />
            <span>移至面板...</span>
          </Button>

          {panelSelectOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "120%",
                left: 0,
                backgroundColor: "#111827",
                border: "1px solid #334155",
                borderRadius: "0.75rem",
                padding: "0.35rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                minWidth: "160px",
              }}
            >
              {panels.map((p) => (
                <Button
                  key={p.id}
                  variant="ghost"
                  pill={false}
                  onClick={() => {
                    moveSelectedToPanel(p.id);
                    setPanelSelectOpen(false);
                  }}
                  style={{
                    justifyContent: "flex-start",
                    color: "#f8fafc",
                    fontSize: "0.75rem",
                    padding: "0.35rem 0.6rem",
                  }}
                >
                  {p.name || p.id}
                </Button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clear selection */}
      <Button
        variant="ghost"
        onClick={clearSelection}
        style={{
          width: "26px",
          height: "26px",
          padding: 0,
          color: "#64748b",
        }}
        title="清除选择"
      >
        <X size={14} />
      </Button>
    </div>
  );
}
