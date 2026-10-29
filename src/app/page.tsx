"use client";

import React, { useState, useEffect } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { TopNav } from "@/components/layout/TopNav";
import { StatsHeader } from "@/components/layout/StatsHeader";
import { SearchFilter } from "@/components/editor/SearchFilter";
import { TabTreeView } from "@/components/editor/TabTreeView";
import { BatchBar } from "@/components/editor/BatchBar";
import { ProcessPage } from "@/components/process/ProcessPage";
import { RulesPage } from "@/components/rules/RulesPage";
import { AIPage } from "@/components/ai/AIPage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { ExportDialog } from "@/components/export/ExportDialog";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { Loader2 } from "lucide-react";

export default function WorkbenchPage() {
  const { rawSnapshot, loadSnapshot } = useSnapshotStore();
  const { activePage } = useConfigStore();

  const [exportDialogOpen, setExportDialogOpen] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);

  // Auto load project snapshot on first load if none is present
  useEffect(() => {
    if (!rawSnapshot) {
      fetch("/api/user-snapshot")
        .then((res) => {
          if (res.ok) return res.text();
          throw new Error("No default snapshot file found");
        })
        .then((jsonText) => {
          loadSnapshot(jsonText, "sidebery-snapshot-2026.10.22-00.48.27.json");
        })
        .catch(() => {
          // Ignore if user hasn't put snapshot or error
        });
    }
  }, [rawSnapshot, loadSnapshot]);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = () => {
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
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
  };

  return (
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      style={{
        display: "flex",
        height: "100vh",
        width: "100vw",
        overflow: "hidden",
        backgroundColor: "#0b1120",
        color: "#f8fafc",
        position: "relative",
      }}
    >
      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(56, 189, 248, 0.15)",
            backdropFilter: "blur(4px)",
            border: "3px dashed #38bdf8",
            zIndex: 999,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            pointerEvents: "none",
          }}
        >
          <div
            style={{
              padding: "1.25rem 2.5rem",
              backgroundColor: "#1e293b",
              borderRadius: "9999px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.6)",
              color: "#38bdf8",
              fontWeight: 700,
              fontSize: "1.1rem",
            }}
          >
            松开以导入 Sidebery 快照 JSON
          </div>
        </div>
      )}

      {/* Left Sidebar Navigation */}
      <AppSidebar />

      {/* Main Content Area */}
      <div
        style={{
          flex: 1,
          display: "flex",
          flexDirection: "column",
          minWidth: 0,
          overflow: "hidden",
          position: "relative",
        }}
      >
        <TopNav onOpenExport={() => setExportDialogOpen(true)} />

        <main style={{ flex: 1, overflowY: "auto", position: "relative", paddingBottom: "70px" }}>
          {activePage === "workbench" && (
            <>
              <StatsHeader />
              {rawSnapshot && <SearchFilter />}
              <TabTreeView />
              <BatchBar />
            </>
          )}

          {activePage === "process" && <ProcessPage />}

          {activePage === "rules" && <RulesPage />}

          {activePage === "ai" && <AIPage />}

          {activePage === "settings" && <SettingsPage />}
        </main>
      </div>

      <ExportDialog isOpen={exportDialogOpen} onClose={() => setExportDialogOpen(false)} />
    </div>
  );
}
