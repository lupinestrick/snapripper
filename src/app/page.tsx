"use client";

import React, { useState, useEffect } from "react";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { WorkbenchView } from "@/components/editor/WorkbenchView";
import { ProcessPage } from "@/components/process/ProcessPage";
import { RulesPage } from "@/components/rules/RulesPage";
import { AIPage } from "@/components/ai/AIPage";
import { SettingsPage } from "@/components/settings/SettingsPage";
import { AIDiffModal } from "@/components/ai/AIDiffModal";
import { AIMergeReportModal } from "@/components/ai/AIMergeReportModal";
import { OverviewHopup } from "@/components/layout/OverviewHopup";
import { FeedbackHost } from "@/components/ui/FeedbackHost";
import { toast } from "@/store/useFeedbackStore";
import { Button } from "@/components/ui/button";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { isLightTheme } from "@/constants/themes";
import { Loader2 } from "lucide-react";

export default function WorkbenchPage() {
  const {
    rawSnapshot,
    loadSnapshot,
    isAIDiffModalOpen,
    setIsAIDiffModalOpen,
    activeMergeReport,
    setActiveMergeReport,
    isOverviewHopupOpen,
    setIsOverviewHopupOpen,
  } = useSnapshotStore();
  const { activePage, theme } = useConfigStore();

  const [isDragOver, setIsDragOver] = useState(false);

  // Sync theme with HTML document element
  useEffect(() => {
    const activeTheme = theme || "park-light";
    document.documentElement.setAttribute("data-theme", activeTheme);
    document.body.setAttribute("data-theme", activeTheme);
    const isLight = isLightTheme(activeTheme);
    if (isLight) {
      document.documentElement.classList.remove("dark");
      document.documentElement.classList.add("light");
    } else {
      document.documentElement.classList.remove("light");
      document.documentElement.classList.add("dark");
    }
  }, [theme]);

  const isFileDrag = (e: React.DragEvent) =>
    Array.from(e.dataTransfer?.types || []).includes("Files");

  const handleDragOver = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    if (!isFileDrag(e)) return;
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
        toast.error(err.message || "读取文件失败");
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
        backgroundColor: "var(--bg-canvas)",
        color: "var(--text-main)",
        position: "relative",
      }}
    >
      {/* Drag & Drop Overlay */}
      {isDragOver && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "var(--accent-subtle)",
            backdropFilter: "blur(4px)",
            border: "3px dashed var(--accent-solid)",
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
              backgroundColor: "var(--bg-card)",
              borderRadius: "9999px",
              boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
              color: "var(--accent-text)",
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
        <main
          style={{
            flex: 1,
            overflowY: "hidden",
            position: "relative",
            paddingBottom: 0,
            display: "flex",
            flexDirection: "column",
            minHeight: 0,
          }}
        >
          <div
            key={activePage}
            className="sr-page-enter"
            style={{
              flex: 1,
              minHeight: 0,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
            }}
          >
            {activePage === "workbench" && <WorkbenchView />}

            {activePage === "process" && <ProcessPage />}

            {activePage === "rules" && <RulesPage />}

            {activePage === "ai" && <AIPage />}

            {activePage === "settings" && <SettingsPage />}
          </div>
        </main>
      </div>

      <AIDiffModal isOpen={isAIDiffModalOpen} onClose={() => setIsAIDiffModalOpen(false)} />
      <AIMergeReportModal
        isOpen={Boolean(activeMergeReport)}
        report={activeMergeReport}
        onClose={() => setActiveMergeReport(null)}
      />
      <OverviewHopup isOpen={isOverviewHopupOpen} onClose={() => setIsOverviewHopupOpen(false)} />
      <FeedbackHost />
    </div>
  );
}
