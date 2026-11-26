"use client";

import React, { useState, useEffect, useMemo } from "react";
import { Download, FileJson, CheckCircle, X } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { flattenTabTree } from "@/services/snapshotParser";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const { rawSnapshot, rootNodes, fileName, getExportSnapshot } = useSnapshotStore();
  const defaultName = fileName
    ? fileName.replace(/\.json$/i, "") + "-reorganized.json"
    : `sidebery-snapshot-${new Date().toISOString().slice(0, 10)}.json`;

  const [exportFileName, setExportFileName] = useState(defaultName);
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setExportFileName(defaultName);
      setDownloadSuccess(false);
    }
  }, [isOpen, defaultName]);

  const allTabs = useMemo(
    () => (rawSnapshot ? flattenTabTree(rootNodes) : []),
    [rawSnapshot, rootNodes]
  );

  if (!isOpen || !rawSnapshot) return null;

  const panels = Object.values(rawSnapshot.panels || {});

  const handleDownload = () => {
    const finalSnapshot = getExportSnapshot("tree");
    if (!finalSnapshot) return;

    const dataStr = JSON.stringify(finalSnapshot, null, 2);
    const blob = new Blob([dataStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = exportFileName.endsWith(".json") ? exportFileName : `${exportFileName}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    setDownloadSuccess(true);
    setTimeout(() => {
      setDownloadSuccess(false);
      onClose();
    }, 1000);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 110 }} />
      <Dialog.Positioner style={{ zIndex: 120 }}>
        <Dialog.Content
          style={{
            maxWidth: "440px",
            width: "92vw",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            overflow: "hidden",
            boxShadow: "0 20px 40px rgba(0, 0, 0, 0.45)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.8rem 1.15rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
              <FileJson size={16} style={{ color: "var(--accent)" }} />
              <Dialog.Title style={{ fontSize: "0.92rem", fontWeight: 600 }}>
                导出 Sidebery 快照
              </Dialog.Title>
            </div>
            <Dialog.CloseTrigger asChild>
              <Button variant="ghost" size="xs" pill onClick={onClose} style={{ padding: "4px" }}>
                <X size={15} />
              </Button>
            </Dialog.CloseTrigger>
          </div>

          {/* Body */}
          <div style={{ padding: "1.1rem 1.15rem", display: "flex", flexDirection: "column", gap: "0.9rem" }}>
            <div
              style={{
                padding: "0.65rem 0.75rem",
                backgroundColor: "var(--bg-surface)",
                borderRadius: "0.65rem",
                border: "1px solid var(--border-subtle)",
                display: "grid",
                gridTemplateColumns: "repeat(3, 1fr)",
                gap: "0.5rem",
                textAlign: "center",
              }}
            >
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>标签总数</div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--accent)" }}>{allTabs.length}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>顶层节点</div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>{rootNodes.length}</div>
              </div>
              <div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>面板数量</div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700 }}>{panels.length}</div>
              </div>
            </div>

            <div>
              <label style={{ fontSize: "0.75rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>
                文件名
              </label>
              <Input
                type="text"
                value={exportFileName}
                onChange={(e) => setExportFileName(e.target.value)}
              />
            </div>

            {downloadSuccess && (
              <div
                style={{
                  padding: "0.45rem 0.7rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "rgba(16, 185, 129, 0.14)",
                  color: "var(--success, #10b981)",
                  fontSize: "0.76rem",
                  display: "flex",
                  alignItems: "center",
                  gap: "0.4rem",
                }}
              >
                <CheckCircle size={14} />
                <span>已生成并开始下载</span>
              </div>
            )}
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "0.75rem 1.15rem",
              borderTop: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              justifyContent: "flex-end",
              gap: "0.45rem",
            }}
          >
            <Button variant="ghost" size="xs" pill onClick={onClose}>
              取消
            </Button>
            <Button variant="solid" size="xs" pill onClick={handleDownload}>
              <Download size={13} />
              <span>导出 JSON</span>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
