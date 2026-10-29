"use client";

import React, { useState } from "react";
import { FolderArchive, Undo2 } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { SnapshotFileHopupModal, formatBytes } from "./SnapshotFileHopupModal";

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
            <span
              style={{
                fontSize: "0.7rem",
                padding: "2px 8px",
                borderRadius: "9999px",
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                color: "#38bdf8",
                fontWeight: 600,
              }}
            >
              已就绪
            </span>
          ) : (
            <span
              style={{
                fontSize: "0.7rem",
                padding: "2px 8px",
                borderRadius: "9999px",
                backgroundColor: "#1e293b",
                color: "#94a3b8",
                border: "1px solid #334155",
              }}
            >
              等待导入
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
          {hasData && (
            <button
              onClick={undo}
              disabled={undoStack.length === 0}
              style={{
                width: "32px",
                height: "32px",
                borderRadius: "9999px",
                border: "1px solid #334155",
                backgroundColor: "#1e293b",
                color: undoStack.length > 0 ? "#94a3b8" : "#475569",
                cursor: undoStack.length > 0 ? "pointer" : "not-allowed",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.15s ease",
              }}
              title="撤销 (Undo)"
            >
              <Undo2 size={15} />
            </button>
          )}

          {/* Single File Icon Button Opening the File Management Hop-up */}
          <button
            onClick={() => setFileHopupOpen(true)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
              padding: "0.4rem 0.95rem",
              borderRadius: "9999px",
              border: hasData ? "1px solid #334155" : "1px solid #0284c7",
              backgroundColor: hasData ? "#1e293b" : "rgba(2, 132, 199, 0.2)",
              color: hasData ? "#f8fafc" : "#38bdf8",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              transition: "all 0.15s ease",
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
          </button>
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
