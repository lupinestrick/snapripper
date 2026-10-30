"use client";

import React, { useState } from "react";
import { Download, FileJson, CheckCircle, Info, X } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
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
  const [exportFileName, setExportFileName] = useState(
    fileName
      ? fileName.replace(/\.json$/i, "") + "-reorganized.json"
      : `sidebery-snapshot-${new Date().toISOString().slice(0, 10)}.json`
  );
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen || !rawSnapshot) return null;

  const primaryWinId = Object.keys(rawSnapshot.windows)[0] || "1";
  const allTabs = rawSnapshot.windows[primaryWinId]?.tabs || [];
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
    }, 1500);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content style={{ maxWidth: "520px", padding: "1.5rem" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <div
                style={{
                  padding: "0.4rem",
                  borderRadius: "9999px",
                  backgroundColor: "rgba(56, 189, 248, 0.15)",
                  color: "#38bdf8",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                }}
              >
                <FileJson size={18} />
              </div>
              <div>
                <Dialog.Title>导出 Sidebery 快照</Dialog.Title>
                <Dialog.Description>
                  生成完全符合 Sidebery 导入规范的合法 JSON 快照
                </Dialog.Description>
              </div>
            </div>
            <Dialog.CloseTrigger asChild>
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
            </Dialog.CloseTrigger>
          </div>

          <div
            style={{
              padding: "0.75rem 1rem",
              backgroundColor: "var(--bg-subtle)",
              borderRadius: "0.5rem",
              border: "1px solid var(--border-subtle)",
              marginBottom: "1rem",
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.5rem",
              textAlign: "center",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>整理后标签</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--accent)" }}>{allTabs.length}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>顶层分组/子树</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)" }}>{rootNodes.length}</div>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>面板数量</div>
              <div style={{ fontSize: "1.1rem", fontWeight: 700, color: "var(--text-main)" }}>{panels.length}</div>
            </div>
          </div>

          <div style={{ marginBottom: "1rem" }}>
            <label style={{ fontSize: "0.8rem", color: "var(--text-muted)", display: "block", marginBottom: "0.3rem" }}>
              保存文件名:
            </label>
            <Input
              type="text"
              value={exportFileName}
              onChange={(e) => setExportFileName(e.target.value)}
            />
          </div>

          <div
            style={{
              padding: "0.75rem",
              backgroundColor: "var(--accent-subtle)",
              borderRadius: "0.375rem",
              border: "1px solid var(--border-subtle)",
              marginBottom: "1.25rem",
              fontSize: "0.78rem",
              color: "var(--text-muted)",
              lineHeight: 1.5,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.35rem", color: "var(--accent)", fontWeight: 600, marginBottom: "0.25rem" }}>
              <Info size={14} />
              如何将快照导入 Firefox Sidebery:
            </div>
            <ol style={{ paddingLeft: "1.2rem", margin: 0 }}>
              <li>打开 Firefox Sidebery 侧边栏，点击底部齿轮进入“设置 (Settings)”</li>
              <li>在设置面板中选择 <strong>“快照 (Snapshots)”</strong></li>
              <li>点击 <strong>“从文件导入快照”</strong> 并选择下载的文件恢复即可</li>
            </ol>
          </div>

          {downloadSuccess && (
            <div
              style={{
                padding: "0.5rem 0.75rem",
                borderRadius: "0.375rem",
                backgroundColor: "rgba(34, 197, 94, 0.15)",
                color: "#4ade80",
                border: "1px solid rgba(34, 197, 94, 0.3)",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
                fontSize: "0.8rem",
                marginBottom: "1rem",
              }}
            >
              <CheckCircle size={16} />
              <span>快照已成功下载到您的本地文件夹！</span>
            </div>
          )}

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
            <Button
              variant="outline"
              size="sm"
              pill
              onClick={onClose}
            >
              关闭
            </Button>
            <Button
              variant="solid"
              size="sm"
              pill
              onClick={handleDownload}
            >
              <Download size={14} />
              <span>立即下载快照 JSON</span>
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
