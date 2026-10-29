"use client";

import React from "react";
import { Search, X } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";

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
            <Button
              variant="ghost"
              size="xs"
              pill
              onClick={() => setSearchQuery("")}
              style={{ color: "#64748b", padding: "0.1rem" }}
            >
              <X size={13} />
            </Button>
          )}
        </div>

        {/* Panel filter (pill style) */}
        {panels.length > 0 && (
          <Select
            value={panelFilter || ""}
            onChange={(e) => setPanelFilter(e.target.value ? e.target.value : null)}
          >
            <option value="">所有面板</option>
            {panels.map((p) => (
              <option key={p.id} value={p.id}>
                面板: {p.name || p.id}
              </option>
            ))}
          </Select>
        )}

        {/* Container filter (pill style) */}
        {containers.length > 0 && (
          <Select
            value={containerFilter || ""}
            onChange={(e) => setContainerFilter(e.target.value ? e.target.value : null)}
          >
            <option value="">所有容器</option>
            {containers.map((c) => (
              <option key={c.id} value={c.id}>
                容器: {c.name}
              </option>
            ))}
          </Select>
        )}
      </div>

      {/* Action buttons (pill style) */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
        {/* Cascade select children toggle in Workbench */}
        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.3rem 0.75rem",
            borderRadius: "9999px",
            border: cascadeSelectChildren ? "1px solid #3b82f6" : "1px solid #334155",
            backgroundColor: cascadeSelectChildren ? "rgba(37, 99, 235, 0.15)" : "#1e293b",
            color: cascadeSelectChildren ? "#60a5fa" : "#94a3b8",
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
            style={{ accentColor: "#2563eb", cursor: "pointer", width: 14, height: 14 }}
          />
          <span>包含子标签</span>
        </label>

        <Button variant="outline" size="xs" pill onClick={expandAll}>
          全部展开
        </Button>

        <Button variant="outline" size="xs" pill onClick={collapseAll}>
          全部折叠
        </Button>

        {selectedIds.size > 0 ? (
          <Button
            variant="subtle"
            size="xs"
            pill
            onClick={clearSelection}
            style={{
              backgroundColor: "rgba(239, 68, 68, 0.15)",
              color: "#f87171",
              border: "1px solid rgba(239, 68, 68, 0.3)",
            }}
          >
            取消选中 ({selectedIds.size})
          </Button>
        ) : (
          <Button variant="outline" size="xs" pill onClick={selectAll}>
            全选当前
          </Button>
        )}
      </div>
    </div>
  );
}
