"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { Button } from "@/components/ui/button";

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

  const { cascadeSelectChildren, setCascadeSelectChildren } = useConfigStore();

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
        backgroundColor: "var(--bg-card)",
        borderBottom: "1px solid var(--border-subtle)",
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
            backgroundColor: "var(--bg-subtle)",
            borderRadius: "9999px",
            border: "1px solid var(--border-subtle)",
            flex: 1,
            maxWidth: "340px",
          }}
        >
          <Search size={14} style={{ color: "var(--text-muted)" }} />
          <input
            type="text"
            placeholder="按标题或域名搜索..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              background: "transparent",
              border: "none",
              outline: "none",
              color: "var(--text-main)",
              fontSize: "0.8rem",
              width: "100%",
            }}
          />
          {searchQuery && (
            <Button
              variant="ghost"
              size="xs"
              pill
              onClick={() => setSearchQuery("")}
              style={{ color: "var(--text-muted)", padding: "0.1rem", width: "20px", height: "20px" }}
            >
              <X size={13} />
            </Button>
          )}
        </div>

        {/* Panel filter (pill style) */}
        {panels.length > 0 && (
          <select
            value={panelFilter || ""}
            onChange={(e) => setPanelFilter(e.target.value ? e.target.value : null)}
            style={{
              padding: "0.3rem 0.75rem",
              borderRadius: "9999px",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-main)",
              fontSize: "0.75rem",
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
              padding: "0.3rem 0.75rem",
              borderRadius: "9999px",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-main)",
              fontSize: "0.75rem",
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
        {/* Cascade select children toggle */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.3rem 0.75rem",
            borderRadius: "9999px",
            border: cascadeSelectChildren ? "1px solid var(--accent-solid)" : "1px solid var(--border-subtle)",
            backgroundColor: cascadeSelectChildren ? "var(--accent-subtle)" : "var(--bg-subtle)",
            color: cascadeSelectChildren ? "var(--accent-text)" : "var(--text-muted)",
            fontSize: "0.75rem",
            cursor: "pointer",
            userSelect: "none",
            transition: "all 0.15s ease",
          }}
          title="勾选父级标签或组时，自动连带勾选其所包含的所有子标签"
        >
          <input
            type="checkbox"
            checked={cascadeSelectChildren}
            onChange={(e) => setCascadeSelectChildren(e.target.checked)}
            style={{ accentColor: "var(--accent-solid)", cursor: "pointer", width: 14, height: 14 }}
          />
          <span>包含子标签</span>
        </label>

        <Button onClick={expandAll}>
          全部展开
        </Button>

        <Button onClick={collapseAll}>
          全部折叠
        </Button>

        {selectedIds.size > 0 ? (
          <Button
            onClick={clearSelection}
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              borderColor: "rgba(239, 68, 68, 0.3)",
              color: "#f87171",
            }}
          >
            取消选中 ({selectedIds.size})
          </Button>
        ) : (
          <Button onClick={selectAll}>
            全选当前
          </Button>
        )}
      </div>
    </div>
  );
}
