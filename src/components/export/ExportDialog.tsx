"use client";

import React, { useState } from "react";
import { X, Download, FileJson, CheckCircle, Info, Layers } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { flattenTabTree } from "@/services/snapshotParser";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const { rawSnapshot, rootNodes, fileName, getExportSnapshot } = useSnapshotStore();
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!rawSnapshot) return null;

  const allTabs = flattenTabTree(rootNodes);
  const panels = rawSnapshot.panels ? Object.values(rawSnapshot.panels) : [];
  const containers = rawSnapshot.containers ? Object.values(rawSnapshot.containers) : [];

  const defaultExportName = fileName
    ? fileName.replace(/\.json$/i, "_organized.json")
    : `sidebery_snapshot_${new Date().toISOString().slice(0, 10)}.json`;

  const [exportFileName, setExportFileName] = useState(defaultExportName);

  const handleDownload = () => {
    try {
      const exportData = getExportSnapshot("tree");
      const jsonStr = JSON.stringify(exportData, null, 2);
      const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
      const url = URL.createObjectURL(blob);

      const link = document.createElement("a");
      link.href = url;
      link.download = exportFileName.endsWith(".json") ? exportFileName : `${exportFileName}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setDownloadSuccess(true);
      setTimeout(() => setDownloadSuccess(false), 4000);
    } catch (err: any) {
      alert(`导出快照失败: ${err.message}`);
    }
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          style={{
            width: "100%",
            maxWidth: "520px",
            padding: "1.5rem",
          }}
        >
          {/* Header */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div
                style={{
                  width: "32px",
                  height: "32px",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(56, 189, 248, 0.15)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#38bdf8",
                }}
              >
                <FileJson size={17} />
              </div>
              <Dialog.Title>导出 Sidebery 快照</Dialog.Title>
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

          {/* Snapshot Summary Box */}
          <div
            style={{
              backgroundColor: "#0f172a",
              border: "1px solid #334155",
              borderRadius: "0.5rem",
              padding: "0.85rem",
              marginBottom: "1.25rem",
              fontSize: "0.8rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.4rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
              <span>标签总数:</span>
              <strong style={{ color: "#f8fafc" }}>{allTabs.length} 个</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
              <span>面板数量:</span>
              <strong style={{ color: "#f8fafc" }}>{panels.length} 个</strong>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", color: "#94a3b8" }}>
              <span>容器环境:</span>
              <strong style={{ color: "#f8fafc" }}>{containers.length} 个</strong>
            </div>
          </div>

          {/* Form */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "1.5rem" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", color: "#94a3b8", marginBottom: "0.35rem" }}>
                导出文件名
              </label>
              <Input
                type="text"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
                style={{ backgroundColor: "#0f172a" }}
              />
            </div>
          </div>

          {downloadSuccess && (
            <div
              style={{
                padding: "0.6rem 0.85rem",
                borderRadius: "0.5rem",
                backgroundColor: "rgba(16, 185, 129, 0.15)",
                border: "1px solid #10b981",
                color: "#34d399",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                marginBottom: "1rem",
              }}
            >
              <CheckCircle size={15} />
              <span>快照文件导出成功，请在下载目录中查看！</span>
            </div>
          )}

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.6rem" }}>
            <Button variant="outline" size="sm" onClick={onClose} style={{ borderColor: "#334155", color: "#94a3b8" }}>
              取消
            </Button>
            <Button variant="solid" size="sm" onClick={handleDownload} style={{ backgroundColor: "#2563eb", color: "#fff" }}>
              <Download size={14} />
              <span>下载快照 JSON</span>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
