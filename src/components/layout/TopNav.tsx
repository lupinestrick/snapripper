"use client";

import React, { useState } from "react";
import { FolderArchive, Undo2 } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { SnapshotFileHopupModal, formatBytes } from "./SnapshotFileHopupModal";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface TopNavProps {
  onOpenExport?: () => void;
}

export function TopNav({ onOpenExport }: TopNavProps) {
  const { undoStack, undo, rawSnapshot, fileName, rawFileSize } = useSnapshotStore();
  const [fileHopupOpen, setFileHopupOpen] = useState(false);

  const hasData = !!rawSnapshot;

  return (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.6rem 1.25rem",
          backgroundColor: "#111827",
          borderBottom: "1px solid #1e293b",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        {/* Snapshot Info */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f8fafc" }}>
            {fileName ? fileName : "未加载快照"}
          </span>
          {rawSnapshot ? (
            <Badge
              variant="subtle"
              size="sm"
              style={{
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                color: "#38bdf8",
              }}
            >
              已就绪
            </Badge>
          ) : (
            <Badge
              variant="outline"
              size="sm"
              style={{
                backgroundColor: "#1e293b",
                color: "#94a3b8",
                borderColor: "#334155",
              }}
            >
              等待导入
            </Badge>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {hasData && (
            <Button
              variant="outline"
              size="xs"
              pill
              onClick={undo}
              disabled={undoStack.length === 0}
              style={{
                width: "32px",
                height: "32px",
                padding: 0,
                backgroundColor: "#1e293b",
                color: undoStack.length > 0 ? "#94a3b8" : "#475569",
                borderColor: "#334155",
              }}
              title="撤销 (Undo)"
            >
              <Undo2 size={15} />
            </Button>
          )}

          {/* Single File Icon Button Opening the File Management Hop-up */}
          <Button
            variant={hasData ? "outline" : "solid"}
            size="sm"
            pill
            onClick={() => setFileHopupOpen(true)}
            style={{
              backgroundColor: hasData ? "#1e293b" : "rgba(2, 132, 199, 0.2)",
              borderColor: hasData ? "#334155" : "#0284c7",
              color: hasData ? "#f8fafc" : "#38bdf8",
              boxShadow: hasData ? "none" : "0 0 12px rgba(56, 189, 248, 0.3)",
            }}
            title="快照文件与导入导出管理"
          >
            <FolderArchive size={15} color="#38bdf8" />
            <span>
              {hasData
                ? rawFileSize > 0
                  ? formatBytes(rawFileSize)
                  : "快照管理"
                : "导入文件"}
            </span>
          </Button>
        </div>
      </header>

      {/* Snapshot File & Import/Export Hop-up Modal */}
      <SnapshotFileHopupModal
        isOpen={fileHopupOpen}
        onClose={() => setFileHopupOpen(false)}
      />
    </>
  );
}
