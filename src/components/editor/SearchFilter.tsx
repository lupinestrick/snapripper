"use client";

import React, { useState } from "react";
import { Search, X, Copy, ChevronsUpDown, ChevronsDownUp, Settings, Undo2 } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { flattenTabTree } from "@/services/snapshotParser";
import { Button } from "@/components/ui/button";
import { SidebarDrawerTrigger } from "@/components/layout/AppSidebar";
import { WorkbenchSettingsModal } from "./WorkbenchSettingsModal";

export function SearchFilter() {
  const {
    rootNodes,
    searchQuery,
    setSearchQuery,
    panelFilter,
    setActivePanelId,
    containerFilter,
    onlyDuplicates,
    setOnlyDuplicates,
    onlyPinned,
    duplicateUrls,
    rawSnapshot,
    expandAll,
    collapseAll,
    selectAll,
    clearSelection,
    selectedIds,
    undoStack,
    undo,
  } = useSnapshotStore();

  const { cascadeSelectChildren, setCascadeSelectChildren, uiSettings } = useConfigStore();
  const [settingsOpen, setSettingsOpen] = useState(false);

  const panelLayout = uiSettings?.workbenchPanelLayout || "sidebar";
  const allTabs = React.useMemo(() => flattenTabTree(rootNodes), [rootNodes]);
  const totalTabs = allTabs.length;
  const pinnedCount = React.useMemo(() => allTabs.filter((t) => t.pinned).length, [allTabs]);
  const duplicateCount = duplicateUrls.size;

  const panelOptions = React.useMemo(() => {
    if (!rawSnapshot?.panels) return [];
    const counts = new Map<string, number>();
    for (const t of allTabs) {
      const pId = t.panelId || "main";
      counts.set(pId, (counts.get(pId) || 0) + 1);
    }
    const list = Object.values(rawSnapshot.panels).map((p: any) => ({
      id: p.id,
      name: p.name || p.id,
      count: counts.get(p.id) || 0,
    }));
    return uiSettings?.hideEmptyPanels ? list.filter((p) => p.count > 0) : list;
  }, [rawSnapshot?.panels, allTabs, uiSettings?.hideEmptyPanels]);

  const hasFilterBadges = Boolean(containerFilter || onlyDuplicates || onlyPinned);

  return (
    <>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "0.5rem",
          padding: "0.55rem 1.25rem",
          minHeight: "50px",
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          flexShrink: 0,
        }}
      >
        {/* Left: Drawer Trigger (Mobile) + Search + Optional Dropdown Panel Selector + Compact Counters */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.45rem",
            flex: 1,
            minWidth: "200px",
            flexWrap: "wrap",
          }}
        >
          <SidebarDrawerTrigger />

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.28rem 0.75rem",
              backgroundColor: "var(--bg-subtle)",
              borderRadius: "9999px",
              border: "1px solid var(--border-subtle)",
              flex: 1,
              minWidth: "130px",
              maxWidth: "260px",
            }}
          >
            <Search size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
            <input
              type="text"
              placeholder="搜索..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: "transparent",
                border: "none",
                outline: "none",
                color: "var(--text-main)",
                fontSize: "0.78rem",
                width: "100%",
              }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--text-muted)",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                }}
                title="清空"
              >
                <X size={12} />
              </button>
            )}
          </div>

          {/* Panel Dropdown Mode (placed next to search bar) */}
          {panelLayout === "dropdown" && panelOptions.length > 0 && (
            <select
              value={panelFilter || ""}
              onChange={(e) => setActivePanelId(e.target.value ? e.target.value : null)}
              style={{
                padding: "0.26rem 0.7rem",
                borderRadius: "9999px",
                backgroundColor: "var(--bg-subtle)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-main)",
                fontSize: "0.72rem",
                cursor: "pointer",
                outline: "none",
                maxWidth: "180px",
              }}
            >
              <option value="">全部面板 ({totalTabs})</option>
              {panelOptions.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} ({p.count})
                </option>
              ))}
            </select>
          )}

          {duplicateCount > 0 && (
            <Button
              size="xs"
              pill
              variant={onlyDuplicates ? "subtle" : "outline"}
              onClick={() => setOnlyDuplicates(!onlyDuplicates)}
              style={{
                borderColor: onlyDuplicates ? "rgba(239, 68, 68, 0.45)" : undefined,
                backgroundColor: onlyDuplicates ? "rgba(239, 68, 68, 0.14)" : undefined,
                color: onlyDuplicates ? "var(--danger)" : "var(--text-muted)",
                fontSize: "0.72rem",
              }}
            >
              <Copy size={11} />
              <span>重复 {duplicateCount}</span>
            </Button>
          )}

          <span
            style={{
              fontSize: "0.72rem",
              color: "var(--text-muted)",
              paddingLeft: "0.2rem",
              whiteSpace: "nowrap",
            }}
          >
            {totalTabs} 项{pinnedCount > 0 ? ` · ${pinnedCount} 置顶` : ""}
          </span>
        </div>

        {/* Right: Controls + Settings Hop-up Trigger at Far Right */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}>
          <label
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "0.3rem",
              padding: "0.24rem 0.6rem",
              borderRadius: "9999px",
              border: "1px solid",
              borderColor: cascadeSelectChildren ? "var(--accent-border)" : "var(--border-subtle)",
              backgroundColor: cascadeSelectChildren ? "var(--accent-subtle)" : "transparent",
              color: cascadeSelectChildren ? "var(--accent-text)" : "var(--text-muted)",
              fontSize: "0.72rem",
              cursor: "pointer",
              userSelect: "none",
            }}
            title="勾选父项时联动子项"
          >
            <input
              type="checkbox"
              checked={cascadeSelectChildren}
              onChange={(e) => setCascadeSelectChildren(e.target.checked)}
              style={{ accentColor: "var(--accent-solid)", cursor: "pointer", width: 12, height: 12 }}
            />
            <span>含子项</span>
          </label>

          <Button size="xs" pill variant="ghost" onClick={expandAll} title="全部展开" style={{ padding: "0.25rem 0.5rem" }}>
            <ChevronsUpDown size={13} />
            <span style={{ fontSize: "0.72rem" }}>展开</span>
          </Button>

          <Button size="xs" pill variant="ghost" onClick={collapseAll} title="全部折叠" style={{ padding: "0.25rem 0.5rem" }}>
            <ChevronsDownUp size={13} />
            <span style={{ fontSize: "0.72rem" }}>折叠</span>
          </Button>

          {selectedIds.size > 0 ? (
            <Button
              size="xs"
              pill
              variant="subtle"
              onClick={clearSelection}
              style={{
                backgroundColor: "rgba(239, 68, 68, 0.14)",
                borderColor: "rgba(239, 68, 68, 0.35)",
                color: "var(--danger)",
                fontSize: "0.72rem",
              }}
            >
              取消 ({selectedIds.size})
            </Button>
          ) : (
            <Button size="xs" pill variant="outline" onClick={selectAll} style={{ fontSize: "0.72rem" }}>
              全选
            </Button>
          )}

          {undoStack.length > 0 && (
            <Button
              size="xs"
              pill
              variant="outline"
              onClick={undo}
              title={`撤销上一步修改 (${undoStack.length})`}
              style={{ fontSize: "0.72rem" }}
            >
              <Undo2 size={12} />
              <span>撤销</span>
            </Button>
          )}

          <Button
            size="xs"
            pill
            variant={hasFilterBadges ? "subtle" : "ghost"}
            onClick={() => setSettingsOpen(true)}
            title="工作台筛选与面板排列设置"
            style={{
              position: "relative",
              color: hasFilterBadges ? "var(--accent)" : "var(--text-muted)",
              padding: "0.35rem",
            }}
          >
            <Settings size={15} />
          </Button>
        </div>
      </div>

      <WorkbenchSettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </>
  );
}
