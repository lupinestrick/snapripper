"use client";

import React, { useMemo, useState, useEffect } from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { flattenTabTree } from "@/services/snapshotParser";
import { SearchFilter } from "./SearchFilter";
import { TabTreeView } from "./TabTreeView";
import { BatchBar } from "./BatchBar";
import { LayoutList } from "lucide-react";

export function WorkbenchView() {
  const { rawSnapshot, rootNodes, panelFilter, setActivePanelId } = useSnapshotStore();
  const { uiSettings } = useConfigStore();
  const [isNarrow, setIsNarrow] = useState(false);

  useEffect(() => {
    const check = () => setIsNarrow(window.innerWidth < 900);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const panelLayout = uiSettings?.workbenchPanelLayout || "vertical";

  const allTabs = useMemo(
    () => (rawSnapshot ? flattenTabTree(rootNodes) : []),
    [rawSnapshot, rootNodes]
  );

  const panelEntries = useMemo(() => {
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

    return uiSettings?.hideEmptyPanels
      ? list.filter((p) => p.count > 0)
      : list;
  }, [rawSnapshot?.panels, allTabs, uiSettings?.hideEmptyPanels]);

  const showPanelBar = Boolean(
    rawSnapshot &&
      panelEntries.length > 0 &&
      panelLayout !== "dropdown" &&
      panelLayout !== "sidebar"
  );
  const renderHorizontal = panelLayout === "horizontal" || isNarrow;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: renderHorizontal ? "column" : "row",
        height: "100%",
        width: "100%",
        overflow: "hidden",
      }}
    >
      {/* Panel Rail: Vertical Left Sidebar OR Horizontal Bar Above Search */}
      {showPanelBar && (
        <aside
          style={
            renderHorizontal
              ? {
                  display: "flex",
                  alignItems: "center",
                  gap: "0.35rem",
                  padding: "0.45rem 0.85rem",
                  borderBottom: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-surface)",
                  overflowX: "auto",
                  flexShrink: 0,
                }
              : {
                  width: "184px",
                  flexShrink: 0,
                  borderRight: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-surface)",
                  display: "flex",
                  flexDirection: "column",
                  overflowY: "auto",
                  padding: "0.55rem 0.45rem",
                  gap: "0.15rem",
                }
          }
        >
          {!renderHorizontal && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
                fontSize: "0.68rem",
                fontWeight: 600,
                color: "var(--text-muted)",
                padding: "0.2rem 0.5rem 0.35rem 0.5rem",
                letterSpacing: "0.02em",
              }}
            >
              <LayoutList size={12} />
              <span>面板</span>
            </div>
          )}

          <PanelRailItem
            label="全部"
            count={allTabs.length}
            active={!panelFilter}
            compact={renderHorizontal}
            onClick={() => setActivePanelId(null)}
          />

          {panelEntries.map((p) => (
            <PanelRailItem
              key={p.id}
              label={p.name}
              count={p.count}
              active={panelFilter === p.id}
              compact={renderHorizontal}
              onClick={() => setActivePanelId(p.id)}
            />
          ))}
        </aside>
      )}

      {/* Right / Main Canvas: Sticky Toolbar + Scrollable Tree + Floating BatchBar */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
        }}
      >
        {rawSnapshot && <SearchFilter />}
        <TabTreeView />
        <BatchBar />
      </div>
    </div>
  );
}

function PanelRailItem({
  label,
  count,
  active,
  compact,
  onClick,
}: {
  label: string;
  count: number;
  active: boolean;
  compact: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.4rem",
        padding: compact ? "0.22rem 0.65rem" : "0.38rem 0.55rem",
        borderRadius: compact ? "9999px" : "0.45rem",
        border: "1px solid",
        borderColor: active ? "var(--accent-border)" : "transparent",
        backgroundColor: active ? "var(--accent-subtle)" : "transparent",
        color: active ? "var(--accent-text)" : "var(--text-main)",
        fontSize: "0.75rem",
        fontWeight: active ? 600 : 400,
        cursor: "pointer",
        textAlign: "left",
        whiteSpace: "nowrap",
        flexShrink: 0,
        width: compact ? "auto" : "100%",
        transition: "background-color 0.12s ease",
      }}
    >
      <span
        style={{
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
          minWidth: 0,
        }}
      >
        {label}
      </span>
      <span
        style={{
          fontSize: "0.66rem",
          color: active ? "var(--accent-text)" : "var(--text-muted)",
          flexShrink: 0,
        }}
      >
        {count}
      </span>
    </button>
  );
}
