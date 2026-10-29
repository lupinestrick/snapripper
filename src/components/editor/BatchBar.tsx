"use client";

import React, { useState } from "react";
import { Trash2, Pin, PinOff, FolderInput, X } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";

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
        backgroundColor: "var(--bg-surface)",
        border: "1px solid var(--accent)",
        borderRadius: "0.5rem",
        padding: "0.5rem 1rem",
        display: "flex",
        alignItems: "center",
        gap: "0.85rem",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.5), 0 8px 10px -6px rgba(0, 0, 0, 0.4)",
        zIndex: 50,
      }}
    >
      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--accent)" }}>
        已选择 {selectedIds.size} 个标签
      </div>

      <div style={{ height: "1.2rem", width: "1px", backgroundColor: "var(--border-subtle)" }} />

      <button
        onClick={deleteSelected}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          padding: "0.35rem 0.65rem",
          borderRadius: "0.25rem",
          backgroundColor: "rgba(239, 68, 68, 0.15)",
          color: "var(--danger)",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          fontSize: "0.8rem",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        <Trash2 size={14} />
        删除
      </button>

      <button
        onClick={() => markSelectedPinned(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          padding: "0.35rem 0.65rem",
          borderRadius: "0.25rem",
          backgroundColor: "var(--bg-subtle)",
          color: "var(--text-main)",
          border: "1px solid var(--border-subtle)",
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
      >
        <Pin size={14} />
        置顶
      </button>

      <button
        onClick={() => markSelectedPinned(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          padding: "0.35rem 0.65rem",
          borderRadius: "0.25rem",
          backgroundColor: "var(--bg-subtle)",
          color: "var(--text-muted)",
          border: "1px solid var(--border-subtle)",
          fontSize: "0.8rem",
          cursor: "pointer",
        }}
      >
        <PinOff size={14} />
        取消置顶
      </button>

      {panels.length > 0 && (
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setPanelSelectOpen(!panelSelectOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              padding: "0.35rem 0.65rem",
              borderRadius: "0.25rem",
              backgroundColor: "var(--bg-subtle)",
              color: "var(--text-main)",
              border: "1px solid var(--border-subtle)",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            <FolderInput size={14} />
            移至面板...
          </button>

          {panelSelectOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 0.5rem)",
                left: 0,
                backgroundColor: "var(--bg-surface)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "0.375rem",
                padding: "0.3rem",
                boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.3)",
                minWidth: "140px",
                zIndex: 60,
              }}
            >
              {panels.map((p) => (
                <button
                  key={p.id}
                  onClick={() => {
                    moveSelectedToPanel(p.id);
                    setPanelSelectOpen(false);
                  }}
                  style={{
                    display: "block",
                    width: "100%",
                    textAlign: "left",
                    padding: "0.35rem 0.6rem",
                    borderRadius: "0.25rem",
                    background: "transparent",
                    border: "none",
                    color: "var(--text-main)",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--bg-subtle)")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        onClick={clearSelection}
        title="取消选择"
        style={{
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
          cursor: "pointer",
          display: "flex",
          alignItems: "center",
          padding: "0.2rem",
        }}
      >
        <X size={16} />
      </button>
    </div>
  );
}
