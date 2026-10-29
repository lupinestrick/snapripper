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
        padding: "0.75rem 1.5rem",
        backgroundColor: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flex: 1, minWidth: "260px" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
            padding: "0.35rem 0.65rem",
            backgroundColor: "var(--bg-primary)",
            borderRadius: "0.375rem",
            border: "1px solid var(--border-subtle)",
            flex: 1,
            maxWidth: "360px",
          }}
        >
          <Search size={15} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="按标题或 URL / 域名搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-main)",
              fontSize: "0.85rem",
              width: "100%",
            }}
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery("")}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        {panels.length > 0 && (
          <select
            value={panelFilter || ""}
            onChange={(e) => setPanelFilter(e.target.value ? e.target.value : null)}
            style={{
              padding: "0.35rem 0.5rem",
              borderRadius: "0.375rem",
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-main)",
              fontSize: "0.8rem",
              cursor: "pointer",
            }}
          >
            <option value="">所有面板</option>
            {panels.map((p) => (
              <option key={p.id} value={p.id}>
                面板: {p.name}
              </option>
            ))}
          </select>
        )}

        {containers.length > 0 && (
          <select
            value={containerFilter || ""}
            onChange={(e) => setContainerFilter(e.target.value ? e.target.value : null)}
            style={{
              padding: "0.35rem 0.5rem",
              borderRadius: "0.375rem",
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-main)",
              fontSize: "0.8rem",
              cursor: "pointer",
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

      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        <button
          onClick={expandAll}
          style={{
            padding: "0.3rem 0.6rem",
            borderRadius: "0.25rem",
            border: "1px solid var(--border-subtle)",
            backgroundColor: "transparent",
            color: "var(--text-muted)",
            fontSize: "0.75rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <ChevronDown size={14} />
          展开全部
        </button>

        <button
          onClick={collapseAll}
          style={{
            padding: "0.3rem 0.6rem",
            borderRadius: "0.25rem",
            border: "1px solid var(--border-subtle)",
            backgroundColor: "transparent",
            color: "var(--text-muted)",
            fontSize: "0.75rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          <ChevronRight size={14} />
          折叠全部
        </button>

        <span style={{ color: "var(--border-subtle)", margin: "0 0.2rem" }}>|</span>

        <button
          onClick={selectedIds.size > 0 ? clearSelection : selectAll}
          style={{
            padding: "0.3rem 0.6rem",
            borderRadius: "0.25rem",
            border: "1px solid var(--border-subtle)",
            backgroundColor: "transparent",
            color: selectedIds.size > 0 ? "var(--accent)" : "var(--text-muted)",
            fontSize: "0.75rem",
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.25rem",
          }}
        >
          {selectedIds.size > 0 ? <Square size={14} /> : <CheckSquare size={14} />}
          {selectedIds.size > 0 ? "取消全选" : "全选"}
        </button>
      </div>
    </div>
  );
}
