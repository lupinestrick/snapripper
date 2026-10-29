"use client";

import React from "react";
import { Search, ChevronDown, ChevronRight, CheckSquare, Square, X } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";

export function SearchFilter() {
  const {
    searchQuery,
    setSearchQuery,
    panelFilter,
    setPanelFilter,
    containerFilter,
    setContainerFilter,
    rawSnapshot,
    expandAll,
    collapseAll,
    selectAll,
    clearSelection,
    selectedIds,
  } = useSnapshotStore();

  const panels = rawSnapshot?.panels ? (Object.values(rawSnapshot.panels) as any[]) : [];
  const containers = rawSnapshot?.containers ? (Object.values(rawSnapshot.containers) as any[]) : [];

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexWrap: "wrap",
        gap: "0.75rem",
        padding: "0.6rem 1.5rem",
        backgroundColor: "#0f172a",
        borderBottom: "1px solid #1e293b",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: "260px" }}>
        {/* Search bar (pill style) */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.35rem 0.85rem",
            backgroundColor: "#1e293b",
            borderRadius: "9999px",
            border: "1px solid #334155",
            flex: 1,
            maxWidth: "340px",
          }}
        >
          <Search size={14} color="#64748b" />
          <input
            type="text"
            placeholder="按标题或域名搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "#f8fafc",
              fontSize: "0.8rem",
              width: "100%",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "#64748b" }}
            >
              <X size={13} />
            </button>
          )}
        </div>

        {/* Panel filter (pill style) */}
        {panels.length > 0 && (
          <select
            value={panelFilter || ""}
            onChange={(e) => setPanelFilter(e.target.value ? e.target.value : null)}
            style={{
              padding: "0.35rem 0.85rem",
              borderRadius: "9999px",
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
              fontSize: "0.8rem",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="">所有面板</option>
            {panels.map((p) => (
              <option key={p.id} value={p.id}>
                面板: {p.name || p.id}
              </option>
            ))}
          </select>
        )}

        {/* Container filter (pill style) */}
        {containers.length > 0 && (
          <select
            value={containerFilter || ""}
            onChange={(e) => setContainerFilter(e.target.value ? e.target.value : null)}
            style={{
              padding: "0.35rem 0.85rem",
              borderRadius: "9999px",
              backgroundColor: "#1e293b",
              border: "1px solid #334155",
              color: "#f8fafc",
              fontSize: "0.8rem",
              cursor: "pointer",
              outline: "none",
            }}
          >
            <option value="">所有容器</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                容器: {c.name}
              </option>
            ))}
          </select>
        )}
      </div>

      {/* Action buttons (pill style) */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <button
          onClick={expandAll}
          style={{
            padding: "0.3rem 0.75rem",
            borderRadius: "9999px",
            border: "1px solid #334155",
            backgroundColor: "#1e293b",
            color: "#94a3b8",
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          全部展开
        </button>

        <button
          onClick={collapseAll}
          style={{
            padding: "0.3rem 0.75rem",
            borderRadius: "9999px",
            border: "1px solid #334155",
            backgroundColor: "#1e293b",
            color: "#94a3b8",
            fontSize: "0.75rem",
            cursor: "pointer",
          }}
        >
          全部折叠
        </button>

        {selectedIds.size > 0 ? (
          <button
            onClick={clearSelection}
            style={{
              padding: "0.3rem 0.75rem",
              borderRadius: "9999px",
              border: "1px solid #334155",
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#f87171",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            取消选中 ({selectedIds.size})
          </button>
        ) : (
          <button
            onClick={selectAll}
            style={{
              padding: "0.3rem 0.75rem",
              borderRadius: "9999px",
              border: "1px solid #334155",
              backgroundColor: "#1e293b",
              color: "#94a3b8",
              fontSize: "0.75rem",
              cursor: "pointer",
            }}
          >
            全选当前
          </button>
        )}
      </div>
    </div>
  );
}
