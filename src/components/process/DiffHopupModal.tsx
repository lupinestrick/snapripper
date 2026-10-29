"use client";

import React, { useState, useEffect } from "react";
import { PanelDiffResult, TabTreeNode } from "@/types/sidebery";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
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

  useEffect(() => {
    const checkWidth = () => {
      setIsNarrowScreen(window.innerWidth < 800);
    };
    checkWidth();
    window.addEventListener("resize", checkWidth);
    return () => window.removeEventListener("resize", checkWidth);
  }, []);

  if (panelDiffs.length === 0) return null;

  const currentDiff = panelDiffs.find((p) => p.panelId === activePanelId) || panelDiffs[0];

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          style={{
            width: "100%",
            maxWidth: "1100px",
            height: "88vh",
            display: "flex",
            flexDirection: "column",
            backgroundColor: "#0f172a",
          }}
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
              <Dialog.Title>处理前后对比确认</Dialog.Title>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                {totalDeduped > 0 && (
                  <Badge variant="subtle" size="sm" style={{ backgroundColor: "rgba(239, 68, 68, 0.15)", color: "#f87171" }}>
                    清理去重 {totalDeduped} 项
                  </Badge>
                )}
                {totalGroupsCreated > 0 && (
                  <Badge variant="subtle" size="sm" style={{ backgroundColor: "rgba(16, 185, 129, 0.15)", color: "#34d399" }}>
                    新建 {totalGroupsCreated} 个 Group
                  </Badge>
                )}
              </div>
            </div>

            <Button
              variant="ghost"
              size="xs"
              pill
              onClick={onClose}
              style={{ color: "#94a3b8", padding: "4px" }}
              title="关闭"
            >
              <X size={18} />
            </Button>
          </div>

          {/* Oval Pill / Dropdown Switcher */}
          <div
            style={{
              padding: "0.75rem 1.5rem",
              borderBottom: "1px solid #1e293b",
              backgroundColor: "#0b0f19",
              display: "flex",
              alignItems: "center",
              gap: "1rem",
            }}
          >
            <span style={{ fontSize: "0.8rem", color: "#94a3b8", flexShrink: 0 }}>切换比对面板:</span>

            {isNarrowScreen ? (
              <Select
                value={activePanelId}
                onChange={(e) => setActivePanelId(e.target.value)}
                style={{ flex: 1, maxWidth: "300px" }}
              >
                {panelDiffs.map((p) => (
                  <option key={p.panelId} value={p.panelId}>
                    {p.panelName} ({p.beforeTabs.length} → {p.afterTabs.length})
                  </option>
                ))}
              </Select>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", overflowX: "auto", paddingBottom: "2px" }}>
                {panelDiffs.map((p) => {
                  const isActive = p.panelId === activePanelId;
                  return (
                    <Button
                      key={p.panelId}
                      variant={isActive ? "solid" : "outline"}
                      size="xs"
                      onClick={() => setActivePanelId(p.panelId)}
                      style={{
                        padding: "0.3rem 0.85rem",
                        backgroundColor: isActive ? "#2563eb" : "#1e293b",
                        borderColor: isActive ? "#3b82f6" : "#334155",
                        color: isActive ? "#ffffff" : "#cbd5e1",
                        fontSize: "0.75rem",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <span>{p.panelName}</span>
                      <span style={{ opacity: 0.7, fontSize: "0.7rem" }}>
                        ({p.beforeTabs.length} → {p.afterTabs.length})
                      </span>
                    </Button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Left-Right Diff Content View */}
          <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 1fr", overflow: "hidden" }}>
            {/* Left: Before */}
            <div
              style={{
                borderRight: "1px solid #1e293b",
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                backgroundColor: "rgba(15, 23, 42, 0.4)",
              }}
            >
              <div
                style={{
                  padding: "0.6rem 1rem",
                  backgroundColor: "rgba(30, 41, 59, 0.7)",
                  borderBottom: "1px solid #1e293b",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#94a3b8",
                }}
              >
                <span>处理前 (原始结构)</span>
                <Badge variant="outline" size="sm">{currentDiff?.beforeTabs.length || 0} 标签</Badge>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
                {currentDiff && <DiffTreeColumn nodes={currentDiff.beforeTree} isBefore={true} />}
              </div>
            </div>

            {/* Right: After */}
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                overflow: "hidden",
                backgroundColor: "rgba(15, 23, 42, 0.2)",
              }}
            >
              <div
                style={{
                  padding: "0.6rem 1rem",
                  backgroundColor: "rgba(37, 99, 235, 0.15)",
                  borderBottom: "1px solid #1e293b",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "#38bdf8",
                }}
              >
                <span>处理后 (优化整理结果)</span>
                <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                  <Badge variant="subtle" size="sm" style={{ color: "#38bdf8" }}>
                    {currentDiff?.afterTabs.length || 0} 标签
                  </Badge>
                </div>
              </div>

              <div style={{ flex: 1, overflowY: "auto", padding: "1rem" }}>
                {currentDiff && <DiffTreeColumn nodes={currentDiff.afterTree} isBefore={false} />}
              </div>
            </div>
          </div>

          {/* Bottom Footer Actions */}
          <div
            style={{
              padding: "0.85rem 1.5rem",
              borderTop: "1px solid #1e293b",
              backgroundColor: "#111827",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <div style={{ fontSize: "0.8rem", color: "#94a3b8" }}>
              确认应用后将写入当前快照树，并可随时使用 Undo 撤销。
            </div>

            <div style={{ display: "flex", gap: "0.75rem" }}>
              <Button
                variant="outline"
                size="sm"
                onClick={onClose}
                style={{ borderColor: "#334155", backgroundColor: "transparent", color: "#94a3b8" }}
              >
                放弃返回
              </Button>
              <Button
                variant="solid"
                size="sm"
                onClick={onConfirm}
                style={{ backgroundColor: "#2563eb", color: "#ffffff" }}
              >
                <Check size={15} />
                <span>确认并应用修改</span>
              </Button>
            </div>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
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
