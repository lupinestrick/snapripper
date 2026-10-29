"use client";

import React, { useRef, useState } from "react";
import { FolderUp, Download, Undo2, PlayCircle, Loader2 } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";

interface TopNavProps {
  onOpenExport: () => void;
}

export function TopNav({ onOpenExport }: TopNavProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { loadSnapshot, undoStack, undo, rawSnapshot, fileName } = useSnapshotStore();
  const [loadingUserSnapshot, setLoadingUserSnapshot] = useState(false);

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        loadSnapshot(content, file.name);
      } catch (err: any) {
        alert(err.message || "读取文件失败");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleLoadUserSnapshot = async () => {
    setLoadingUserSnapshot(true);
    try {
      const res = await fetch("/api/user-snapshot");
      if (!res.ok) throw new Error("无法读取目录中的快照文件");
      const jsonText = await res.text();
      loadSnapshot(jsonText, "sidebery-snapshot-2026.10.22-00.48.27.json");
    } catch (err: any) {
      alert(err.message || "载入失败");
    } finally {
      setLoadingUserSnapshot(false);
    }
  };

  const hasData = !!rawSnapshot;

  return (
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
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: "none" }}
        onChange={handleFileUpload}
      />

      {/* Snapshot Info */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
        <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#f8fafc" }}>
          {fileName ? fileName : "未加载快照"}
        </span>
        {rawSnapshot && (
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
        )}
      </div>

      {/* Action Buttons (Pill / Round style) */}
      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
        {!hasData && (
          <button
            onClick={handleLoadUserSnapshot}
            disabled={loadingUserSnapshot}
            style={{
              padding: "0.4rem 1rem",
              borderRadius: "9999px",
              border: "1px solid #0284c7",
              backgroundColor: "rgba(2, 132, 199, 0.15)",
              color: "#38bdf8",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: loadingUserSnapshot ? "not-allowed" : "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
            }}
          >
            {loadingUserSnapshot ? <Loader2 size={14} /> : <PlayCircle size={14} />}
            <span>载入目录快照 (1,174 标签)</span>
          </button>
        )}

        <button
          onClick={() => fileInputRef.current?.click()}
          style={{
            padding: "0.4rem 0.9rem",
            borderRadius: "9999px",
            border: "1px solid #334155",
            backgroundColor: "#1e293b",
            color: "#94a3b8",
            fontSize: "0.8rem",
            fontWeight: 500,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: "0.4rem",
          }}
        >
          <FolderUp size={14} />
          <span>上传 JSON</span>
        </button>

        {hasData && (
          <>
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
              }}
              title="撤销 (Undo)"
            >
              <Undo2 size={15} />
            </button>

            <button
              onClick={onOpenExport}
              style={{
                padding: "0.4rem 1.1rem",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: "#2563eb",
                color: "#ffffff",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <Download size={14} />
              <span>导出快照</span>
            </button>
          </>
        )}
      </div>
    </header>
  );
}
