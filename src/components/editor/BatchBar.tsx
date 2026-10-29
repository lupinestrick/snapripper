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
        backgroundColor: "#111827",
        border: "1px solid #38bdf8",
        borderRadius: "9999px", // Oval pill floating bar
        padding: "0.5rem 1.25rem",
        display: "flex",
        alignItems: "center",
        gap: "0.85rem",
        boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.7)",
        zIndex: 50,
      }}
    >
      <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "#38bdf8" }}>
        已选择 {selectedIds.size} 项
      </div>

      <div style={{ height: "1.2rem", width: "1px", backgroundColor: "#334155" }} />

      {/* Delete button (pill style) */}
      <button
        onClick={deleteSelected}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          padding: "0.35rem 0.85rem",
          borderRadius: "9999px",
          backgroundColor: "rgba(239, 68, 68, 0.15)",
          color: "#f87171",
          border: "1px solid rgba(239, 68, 68, 0.3)",
          fontSize: "0.8rem",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        <Trash2 size={13} />
        <span>批量删除</span>
      </button>

      {/* Pin toggle (pill style) */}
      <button
        onClick={() => markSelectedPinned(true)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          padding: "0.35rem 0.85rem",
          borderRadius: "9999px",
          backgroundColor: "rgba(245, 158, 11, 0.15)",
          color: "#fbbf24",
          border: "1px solid rgba(245, 158, 11, 0.3)",
          fontSize: "0.8rem",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        <Pin size={13} />
        <span>标记固定</span>
      </button>

      <button
        onClick={() => markSelectedPinned(false)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.3rem",
          padding: "0.35rem 0.85rem",
          borderRadius: "9999px",
          backgroundColor: "#1e293b",
          color: "#94a3b8",
          border: "1px solid #334155",
          fontSize: "0.8rem",
          fontWeight: 500,
          cursor: "pointer",
        }}
      >
        <PinOff size={13} />
        <span>取消固定</span>
      </button>

      {/* Move to Panel */}
      {panels.length > 0 && (
        <div style={{ position: "relative" }}>
          <button
            onClick={() => setPanelSelectOpen(!panelSelectOpen)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.3rem",
              padding: "0.35rem 0.85rem",
              borderRadius: "9999px",
              backgroundColor: "#1e293b",
              color: "#38bdf8",
              border: "1px solid #334155",
              fontSize: "0.8rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            <FolderInput size={13} />
            <span>移至面板...</span>
          </button>

          {panelSelectOpen && (
            <div
              style={{
                position: "absolute",
                bottom: "120%",
                left: 0,
                backgroundColor: "#111827",
                border: "1px solid #334155",
                borderRadius: "0.75rem",
                padding: "0.4rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.25rem",
                minWidth: "160px",
                boxShadow: "0 10px 15px -3px rgba(0, 0, 0, 0.7)",
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
                    padding: "0.35rem 0.75rem",
                    borderRadius: "0.375rem",
                    border: "none",
                    backgroundColor: "transparent",
                    color: "#f8fafc",
                    fontSize: "0.8rem",
                    textAlign: "left",
                    cursor: "pointer",
                  }}
                  onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#1e293b")}
                  onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
                >
                  {p.name || p.id}
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Clear selection (round button) */}
      <button
        onClick={clearSelection}
        style={{
          width: "26px",
          height: "26px",
          borderRadius: "9999px",
          border: "none",
          backgroundColor: "#1e293b",
          color: "#64748b",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          cursor: "pointer",
        }}
        title="清除选择"
      >
        <X size={14} />
      </button>
    </div>
  );
}
