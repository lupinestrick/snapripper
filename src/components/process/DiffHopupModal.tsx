"use client";

import React, { useState, useEffect } from "react";
import { PanelDiffResult, TabTreeNode } from "@/types/sidebery";
import { X, Check, ArrowRight, Layers, Trash2, FolderPlus } from "lucide-react";

interface DiffHopupModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  panelDiffs: PanelDiffResult[];
  totalDeduped: number;
  totalGroupsCreated: number;
}

export function DiffHopupModal({
  isOpen,
  onClose,
  onConfirm,
  panelDiffs,
  totalDeduped,
  totalGroupsCreated,
}: DiffHopupModalProps) {
  const [activePanelId, setActivePanelId] = useState<string>("");
  const [isNarrowScreen, setIsNarrowScreen] = useState(false);

  useEffect(() => {
    if (panelDiffs.length > 0 && !activePanelId) {
      setActivePanelId(panelDiffs[0].panelId);
    }
  }, [panelDiffs, activePanelId]);

  // Responsive DPI / Screen width check for the oval pill bar vs dropdown
  useEffect(() => {
    const checkWidth = () => {
      setIsNarrowScreen(window.innerWidth < 800);
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  if (!isOpen || panelDiffs.length === 0) return null;

  const currentDiff = panelDiffs.find((p) => p.panelId === activePanelId) || panelDiffs[0];

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "1100px",
          height: "88vh",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0f172a",
          border: "1px solid #1e293b",
          borderRadius: "1.25rem",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.8)",
          overflow: "hidden",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Top Header */}
        <div
          style={{
            padding: "1rem 1.5rem",
            borderBottom: "1px solid #1e293b",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            backgroundColor: "#111827",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <h2 style={{ fontSize: "1.1rem", fontWeight: 700, color: "#f8fafc" }}>处理前后对比确认</h2>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.8rem" }}>
              {totalDeduped > 0 && (
                <span style={{ padding: "2px 8px", borderRadius: "9999px", backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#f87171" }}>
                  清理去重 {totalDeduped} 项
                </span>
              )}
              {totalGroupsCreated > 0 && (
                <span style={{ padding: "2px 8px", borderRadius: "9999px", backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                  新建 {totalGroupsCreated} 个 Group
                </span>
              )}
            </div>
          </div>

          <button
            onClick={onClose}
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "9999px",
              border: "1px solid #334155",
              backgroundColor: "#1e293b",
              color: "#94a3b8",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Panel Switcher (Elongated oval pills on normal screen, dropdown on narrow DPI) */}
        <div
          style={{
            padding: "0.75rem 1.5rem",
            borderBottom: "1px solid #1e293b",
            backgroundColor: "#0b1120",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            overflowX: "auto",
          }}
        >
          <span style={{ fontSize: "0.8rem", color: "#64748b", flexShrink: 0, fontWeight: 600 }}>切换面板:</span>

          {isNarrowScreen ? (
            <select
              value={activePanelId}
              onChange={(e) => setActivePanelId(e.target.value)}
              style={{
                padding: "0.4rem 1rem",
                borderRadius: "9999px",
                backgroundColor: "#1e293b",
                border: "1px solid #334155",
                color: "#f8fafc",
                fontSize: "0.85rem",
                outline: "none",
                cursor: "pointer",
              }}
            >
              {panelDiffs.map((p) => (
                <option key={p.panelId} value={p.panelId}>
                  {p.panelName} ({p.beforeTabs.length} → {p.afterTabs.length})
                </option>
              ))}
            </select>
          ) : (
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", flexWrap: "nowrap" }}>
              {panelDiffs.map((p) => {
                const isActive = p.panelId === activePanelId;
                return (
                  <button
                    key={p.panelId}
                    onClick={() => setActivePanelId(p.panelId)}
                    style={{
                      padding: "0.35rem 0.85rem",
                      borderRadius: "9999px", // Oval pill style
                      border: isActive ? "1px solid #38bdf8" : "1px solid #334155",
                      backgroundColor: isActive ? "#1e293b" : "transparent",
                      color: isActive ? "#38bdf8" : "#94a3b8",
                      fontSize: "0.8rem",
                      fontWeight: isActive ? 600 : 500,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "0.4rem",
                      whiteSpace: "nowrap",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{p.panelName}</span>
                    <span style={{ fontSize: "0.7rem", opacity: 0.8 }}>
                      {p.beforeTabs.length} → {p.afterTabs.length}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Side-by-Side Diff Content */}
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
          {/* Left Column: Before */}
          <div
            style={{
              borderRight: "1px solid #1e293b",
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            <div
              style={{
                padding: "0.6rem 1rem",
                backgroundColor: "#161e2e",
                borderBottom: "1px solid #1e293b",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#94a3b8",
              }}
            >
              <span>处理前 ({currentDiff.beforeTabs.length} 标签)</span>
              <span style={{ fontSize: "0.7rem", color: "#64748b" }}>原始层级</span>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
              <DiffTreeColumn nodes={currentDiff.beforeTree} isBefore />
            </div>
          </div>

          {/* Right Column: After */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              backgroundColor: "#0b1120",
            }}
          >
            <div
              style={{
                padding: "0.6rem 1rem",
                backgroundColor: "#161e2e",
                borderBottom: "1px solid #1e293b",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "#38bdf8",
              }}
            >
              <span>处理后 ({currentDiff.afterTabs.length} 标签)</span>
              <div style={{ display: "flex", gap: "0.5rem", fontSize: "0.7rem" }}>
                {currentDiff.dedupedCount > 0 && (
                  <span style={{ color: "#f87171" }}>- {currentDiff.dedupedCount} 重复</span>
                )}
                {currentDiff.addedGroupsCount > 0 && (
                  <span style={{ color: "#34d399" }}>+ {currentDiff.addedGroupsCount} Group</span>
                )}
              </div>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: "0.75rem" }}>
              <DiffTreeColumn nodes={currentDiff.afterTree} isBefore={false} />
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: "0.75rem 1.5rem",
            borderTop: "1px solid #1e293b",
            backgroundColor: "#111827",
            display: "flex",
            justifyContent: "flex-end",
            alignItems: "center",
            gap: "0.75rem",
          }}
        >
          <button
            onClick={onClose}
            style={{
              padding: "0.5rem 1.25rem",
              borderRadius: "9999px",
              border: "1px solid #334155",
              backgroundColor: "transparent",
              color: "#94a3b8",
              fontSize: "0.85rem",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            放弃返回
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: "0.5rem 1.5rem",
              borderRadius: "9999px",
              border: "none",
              backgroundColor: "#2563eb",
              color: "#ffffff",
              fontSize: "0.85rem",
              fontWeight: 600,
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              cursor: "pointer",
            }}
          >
            <Check size={16} />
            <span>确认并应用修改</span>
          </button>
        </div>
      </div>
    </div>
  );
}

function DiffTreeColumn({ nodes, isBefore }: { nodes: TabTreeNode[]; isBefore: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
      {nodes.map((node) => (
        <DiffNodeItem key={node.id} node={node} isBefore={isBefore} />
      ))}
    </div>
  );
}

function DiffNodeItem({ node, isBefore }: { node: TabTreeNode; isBefore: boolean }) {
  const isGroup = node.isGroup;
  const isNewlyAddedGroup = !isBefore && isGroup && node.id.startsWith("group_");

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.4rem",
          padding: "0.3rem 0.5rem",
          borderRadius: "0.5rem",
          backgroundColor: isNewlyAddedGroup ? "rgba(16, 185, 129, 0.1)" : "rgba(30, 41, 59, 0.5)",
          border: isNewlyAddedGroup ? "1px solid rgba(16, 185, 129, 0.3)" : "1px solid transparent",
          fontSize: "0.8rem",
          color: isNewlyAddedGroup ? "#34d399" : "#e2e8f0",
        }}
      >
        {isGroup && (
          <span style={{ padding: "1px 6px", borderRadius: "9999px", backgroundColor: "#334155", fontSize: "0.65rem", color: "#94a3b8" }}>
            Group
          </span>
        )}
        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>
          {node.tab.title || node.tab.url}
        </span>
        {node.children.length > 0 && (
          <span style={{ fontSize: "0.7rem", color: "#64748b", flexShrink: 0 }}>
            ({node.children.length})
          </span>
        )}
      </div>

      {node.children.length > 0 && (
        <div style={{ paddingLeft: "1.25rem", borderLeft: "1px solid #1e293b", marginTop: "0.25rem", display: "flex", flexDirection: "column", gap: "0.25rem" }}>
          {node.children.map((child) => (
            <DiffNodeItem key={child.id} node={child} isBefore={isBefore} />
          ))}
        </div>
      )}
    </div>
  );
}
