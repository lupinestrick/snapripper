"use client";

import React from "react";
import { Pin, Copy, GitFork, ListFilter, ShieldCheck } from "lucide-react";
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
        backgroundColor: "rgba(15, 23, 42, 0.7)",
        borderBottom: "1px solid #1e293b",
        fontSize: "0.8rem",
        color: "#94a3b8",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <ListFilter size={14} color="#38bdf8" />
        <span>总标签:</span>
        <strong style={{ color: "#f8fafc" }}>{totalTabs}</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <GitFork size={14} color="#10b981" />
        <span>顶级/子树:</span>
        <strong style={{ color: "#f8fafc" }}>{rootNodes.length}</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <Pin size={14} color="#f59e0b" />
        <span>置顶固定:</span>
        <strong style={{ color: "#f8fafc" }}>{pinnedTabs}</strong>
      </div>

      {duplicateCount > 0 && (
        <Button
          onClick={() => setOnlyDuplicates(!onlyDuplicates)}
          style={{
            padding: "0.2rem 0.65rem",
            borderColor: onlyDuplicates ? "#ef4444" : "#334155",
            backgroundColor: onlyDuplicates ? "rgba(239, 68, 68, 0.15)" : "#1e293b",
            color: onlyDuplicates ? "#f87171" : "#94a3b8",
          }}
        >
          <Copy size={12} />
          <span>重复 URL:</span>
          <strong>{duplicateCount}</strong>
          <span style={{ fontSize: "0.65rem", opacity: 0.8 }}>({onlyDuplicates ? "显示全部" : "仅看重复"})</span>
        </Button>
      )}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem", color: "#64748b" }}>
        <ShieldCheck size={13} color="#10b981" />
        <span>本地纯前端沙盒运算</span>
      </div>
    </div>
  );
}
