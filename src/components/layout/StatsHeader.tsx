"use client";

import React from "react";
import { Pin, Copy, GitFork, ListFilter } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { flattenTabTree } from "@/services/snapshotParser";
import { Button } from "@/components/ui/button";

export function StatsHeader() {
  const { rootNodes, duplicateUrls, onlyDuplicates, setOnlyDuplicates } = useSnapshotStore();

  if (rootNodes.length === 0) return null;

  const allTabs = flattenTabTree(rootNodes);
  const totalTabs = allTabs.length;
  const pinnedTabs = allTabs.filter((t) => t.pinned).length;
  const duplicateCount = duplicateUrls.size;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        flexWrap: "wrap",
        gap: "1.25rem",
        padding: "0.5rem 1.5rem",
        backgroundColor: "var(--bg-surface)",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: "0.8rem",
        color: "var(--text-muted)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <ListFilter size={14} style={{ color: "var(--accent)" }} />
        <span>总标签:</span>
        <strong style={{ color: "var(--text-main)" }}>{totalTabs}</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <GitFork size={14} style={{ color: "var(--accent)" }} />
        <span>顶级/子树:</span>
        <strong style={{ color: "var(--text-main)" }}>{rootNodes.length}</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <Pin size={14} style={{ color: "var(--accent)" }} />
        <span>置顶固定:</span>
        <strong style={{ color: "var(--text-main)" }}>{pinnedTabs}</strong>
      </div>

      {duplicateCount > 0 && (
        <Button
          onClick={() => setOnlyDuplicates(!onlyDuplicates)}
          style={{
            padding: "0.2rem 0.65rem",
            borderColor: onlyDuplicates ? "rgba(239, 68, 68, 0.4)" : "var(--border-subtle)",
            backgroundColor: onlyDuplicates ? "rgba(239, 68, 68, 0.15)" : "var(--bg-subtle)",
            color: onlyDuplicates ? "#ef4444" : "var(--text-muted)",
          }}
        >
          <Copy size={12} />
          <span>重复 URL:</span>
          <strong>{duplicateCount}</strong>
          <span style={{ fontSize: "0.65rem", opacity: 0.8 }}>({onlyDuplicates ? "显示全部" : "仅看重复"})</span>
        </Button>
      )}
    </div>
  );
}
