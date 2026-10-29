"use client";

import React, { useState } from "react";
import { X, Download, FileJson, CheckCircle, Info, Layers } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { flattenTabTree } from "@/services/snapshotParser";

interface ExportDialogProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ExportDialog({ isOpen, onClose }: ExportDialogProps) {
  const { rawSnapshot, rootNodes, fileName, getExportSnapshot } = useSnapshotStore();
  const [downloadSuccess, setDownloadSuccess] = useState(false);

  if (!isOpen || !rawSnapshot) return null;

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
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(0, 0, 0, 0.75)",
        backdropFilter: "blur(4px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 100,
        padding: "1rem",
      }}
      onClick={onClose}
    >
      <div
        style={{
          backgroundColor: "var(--bg-surface)",
          border: "1px solid var(--border-subtle)",
          borderRadius: "0.75rem",
          width: "100%",
          maxWidth: "520px",
          padding: "1.5rem",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.5)",
          color: "var(--text-main)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.25rem" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <div
              style={{
                padding: "0.4rem",
                borderRadius: "0.375rem",
                backgroundColor: "rgba(56, 189, 248, 0.15)",
                color: "var(--accent)",
              }}
            >
              <FileJson size={18} />
            </div>
            <div>
              <h2 style={{ fontSize: "1.1rem", fontWeight: 600 }}>导出 Sidebery 快照</h2>
              <p style={{ fontSize: "0.75rem", color: "var(--text-muted)" }}>
                生成完全符合 Sidebery 导入规范的合法 JSON 快照
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            style={{ background: "transparent", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
          >
            <X size={20} />
          </button>
        </div>

        <div
          style={{
            padding: "0.75rem 1rem",
            backgroundColor: "var(--bg-primary)",
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
          <input
            type="text"
            value={exportFileName}
            onChange={(e) => setExportFileName(e.target.value)}
            style={{
              width: "100%",
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "var(--bg-primary)",
              border: "1px solid var(--border-subtle)",
              color: "var(--text-main)",
              fontSize: "0.85rem",
            }}
          />
        </div>

        <div
          style={{
            padding: "0.75rem",
            backgroundColor: "rgba(56, 189, 248, 0.08)",
            borderRadius: "0.375rem",
            border: "1px solid rgba(56, 189, 248, 0.2)",
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
            <li>点击 <strong>“从文件导入快照 (Import from file)”</strong> 并选择下载的文件</li>
            <li>点击 <strong>“恢复此快照 (Restore)”</strong> 即可完成</li>
          </ol>
        </div>

        {downloadSuccess && (
          <div
            style={{
              padding: "0.5rem 0.75rem",
              borderRadius: "0.375rem",
              backgroundColor: "rgba(34, 197, 94, 0.15)",
              color: "var(--success)",
              border: "1px solid rgba(34, 197, 94, 0.3)",
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.8rem",
              marginBottom: "1rem",
            }}
          >
            <CheckCircle size={16} />
            <span>快照已成功下载到您的本地下载文件夹！</span>
          </div>
        )}

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.5rem" }}>
          <button
            onClick={onClose}
            style={{
              padding: "0.45rem 0.85rem",
              borderRadius: "0.375rem",
              border: "1px solid var(--border-subtle)",
              backgroundColor: "transparent",
              color: "var(--text-muted)",
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            关闭
          </button>
          <button
            onClick={handleDownload}
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              padding: "0.45rem 1.1rem",
              borderRadius: "0.375rem",
              border: "none",
              backgroundColor: "var(--accent)",
              color: "#0f172a",
              fontSize: "0.85rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Download size={15} />
            立即下载快照 JSON
          </button>
        </div>
      </div>
    </div>
  );
}
