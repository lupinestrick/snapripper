"use client";

import React from "react";
import { Pin, Copy, GitFork, ListFilter, ShieldCheck } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { flattenTabTree } from "@/services/snapshotParser";

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
        gap: "1rem",
        padding: "0.6rem 1.5rem",
        backgroundColor: "rgba(30, 41, 59, 0.6)",
        borderBottom: "1px solid var(--border-subtle)",
        fontSize: "0.8rem",
        color: "var(--text-muted)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <ListFilter size={15} color="var(--accent)" />
        <span>总标签:</span>
        <strong style={{ color: "var(--text-main)" }}>{totalTabs}</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <GitFork size={15} color="#38bdf8" />
        <span>顶层/子树:</span>
        <strong style={{ color: "var(--text-main)" }}>{rootNodes.length}</strong>
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
        <Pin size={15} color="#f59e0b" />
        <span>置顶固定:</span>
        <strong style={{ color: "var(--text-main)" }}>{pinnedTabs}</strong>
      </div>

      {duplicateCount > 0 && (
        <button
          onClick={() => setOnlyDuplicates(!onlyDuplicates)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "0.35rem",
            padding: "0.2rem 0.5rem",
            borderRadius: "0.25rem",
            border: onlyDuplicates ? "1px solid var(--danger)" : "1px solid var(--border-subtle)",
            backgroundColor: onlyDuplicates ? "rgba(239, 68, 68, 0.15)" : "transparent",
            color: onlyDuplicates ? "var(--danger)" : "var(--text-muted)",
            cursor: "pointer",
            fontSize: "0.8rem",
          }}
        >
          <Copy size={13} />
          <span>重复 URL:</span>
          <strong>{duplicateCount}</strong>
          <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>({onlyDuplicates ? "点击查看全部" : "点击过滤"})</span>
        </button>
      )}

      <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: "0.35rem", fontSize: "0.75rem" }}>
        <ShieldCheck size={14} color="#22c55e" />
        <span>本地纯前端沙盒运算 · 数据无泄露风险</span>
      </div>
    </div>
  );
}
