"use client";

import React, { useRef, useState } from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileText,
  Upload,
  Download,
  FolderArchive,
  Layers,
  Sparkles,
  Check,
  X,
  FileCode,
  List,
  HardDrive,
  Copy,
  Loader2,
} from "lucide-react";

interface SnapshotFileHopupModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return "0 B";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

export function SnapshotFileHopupModal({ isOpen, onClose }: SnapshotFileHopupModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    rawSnapshot,
    fileName,
    rawFileSize,
    rootNodes,
    loadSnapshot,
    getExportSnapshot,
  } = useSnapshotStore();

  const [copiedType, setCopiedType] = useState<string | null>(null);

  const totalTabs = rawSnapshot
    ? Object.values(rawSnapshot.windows).reduce((acc, w) => acc + (w.tabs?.length || 0), 0)
    : 0;
  const panelCount = rawSnapshot?.panels ? Object.keys(rawSnapshot.panels).length : 0;
  const winCount = rawSnapshot?.windows ? Object.keys(rawSnapshot.windows).length : 0;
  const containerCount = rawSnapshot?.containers ? Object.keys(rawSnapshot.containers).length : 0;

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

  const handleExportJSON = () => {
    if (!rawSnapshot) return;
    const exportData = getExportSnapshot("tree");
    const jsonStr = JSON.stringify(exportData, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = (fileName ? fileName.replace(/\.json$/i, "") : "sidebery-snapshot") + "-organized.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleExportUrls = (format: "txt" | "md") => {
    if (!rawSnapshot) return;
    function collectTabs(nodes: typeof rootNodes, list: { title: string; url: string }[] = []) {
      for (const n of nodes) {
        if (!n.isCategoryHeader && !n.tab.url.startsWith("about:") && !n.tab.url.startsWith("moz-extension:")) {
          list.push({ title: n.tab.title, url: n.tab.url });
        }
        if (n.children) collectTabs(n.children, list);
      }
      return list;
    }
    const allTabs = collectTabs(rootNodes);
    let output = "";
    if (format === "txt") {
      output = allTabs.map((t) => t.url).join("\n");
    } else {
      output = allTabs.map((t) => `- [${t.title}](${t.url})`).join("\n");
    }

    navigator.clipboard.writeText(output);
    setCopiedType(format);
    setTimeout(() => setCopiedType(null), 2000);
  };

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop />
      <Dialog.Positioner>
        <Dialog.Content
          style={{
            width: "100%",
            maxWidth: "580px",
            maxHeight: "85vh",
            overflowY: "auto",
            padding: "1.5rem",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleFileUpload}
          />

          {/* Modal Header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "1.25rem" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div
                style={{
                  width: "36px",
                  height: "36px",
                  borderRadius: "9999px",
                  backgroundColor: "var(--accent-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--accent)",
                }}
              >
                <FolderArchive size={18} />
              </div>
              <div>
                <Dialog.Title>快照文件与数据管理</Dialog.Title>
                <Dialog.Description>查看快照元信息、文件大小与导入导出操作</Dialog.Description>
              </div>
            </div>

            <Dialog.CloseTrigger asChild>
              <Button
                variant="ghost"
                size="xs"
                pill
                onClick={onClose}
                style={{ color: "var(--text-muted)", padding: "4px" }}
                title="关闭"
              >
                <X size={18} />
              </Button>
            </Dialog.CloseTrigger>
          </div>

          {/* Snapshot Info Card */}
          <div
            style={{
              padding: "1.25rem",
              borderRadius: "0.85rem",
              backgroundColor: "var(--bg-subtle)",
              border: "1px solid var(--border-subtle)",
              marginBottom: "1.5rem",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <FileText size={16} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: "0.9rem", fontWeight: 600, color: "var(--text-main)" }}>
                  {fileName || "暂未载入快照文件"}
                </span>
              </div>
              <Badge variant={rawSnapshot ? "subtle" : "outline"} style={{ color: rawSnapshot ? "var(--accent-text)" : "var(--text-muted)" }}>
                {rawSnapshot ? "已就绪" : "未加载"}
              </Badge>
            </div>

            {/* Metrics Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-card)",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                  配置文件数据大小
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--accent)" }}>
                  {rawFileSize > 0 ? formatBytes(rawFileSize) : "0 B"}
                </div>
                {rawFileSize > 0 && (
                  <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", opacity: 0.8, marginTop: "0.15rem" }}>
                    {rawFileSize.toLocaleString()} 字节
                  </div>
                )}
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-card)",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                  标签页总数
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)" }}>
                  {totalTabs.toLocaleString()} 个
                </div>
                <div style={{ fontSize: "0.7rem", color: "var(--text-muted)", opacity: 0.8, marginTop: "0.15rem" }}>
                  {rootNodes.length} 个顶层根节点
                </div>
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-card)",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                  侧边栏面板 (Panels)
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)" }}>
                  {panelCount} 个
                </div>
              </div>

              <div
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.5rem",
                  backgroundColor: "var(--bg-card)",
                  border: "1px solid var(--border-card)",
                }}
              >
                <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginBottom: "0.2rem" }}>
                  容器环境与窗口
                </div>
                <div style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)" }}>
                  {containerCount} 容器 / {winCount} 窗口
                </div>
              </div>
            </div>
          </div>

          {/* Section: Import */}
          <div style={{ marginBottom: "1.5rem" }}>
            <h4 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "0.6rem" }}>
              导入新快照
            </h4>
            <div style={{ display: "flex", gap: "0.6rem", flexWrap: "wrap" }}>
              <Button
                variant="outline"
                size="xs"
                pill
                onClick={() => fileInputRef.current?.click()}
              >
                <Upload size={13} />
                <span>从本地上传 JSON</span>
              </Button>
            </div>
          </div>

          {/* Section: Export */}
          {rawSnapshot && (
            <div>
              <h4 style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)", marginBottom: "0.6rem" }}>
                导出整理成果
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                <div
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                      导出 Sidebery Snapshot JSON
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                      保留 v5 树形缩进与 Group 组折叠结构，可直接导入 Sidebery
                    </div>
                  </div>

                  <Button
                    variant="solid"
                    size="xs"
                    pill
                    onClick={handleExportJSON}
                  >
                    <Download size={13} />
                    <span>下载文件</span>
                  </Button>
                </div>

                <div
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: "0.5rem",
                    backgroundColor: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                  }}
                >
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
                      快捷复制标签清单
                    </div>
                    <div style={{ fontSize: "0.75rem", color: "var(--text-muted)", marginTop: "0.15rem" }}>
                      复制所有有效标签为纯网址或 Markdown 链接列表
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "0.4rem" }}>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportUrls("txt")}
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.3rem 0.75rem",
                      }}
                    >
                      {copiedType === "txt" ? <Check size={13} style={{ color: "var(--accent)" }} /> : <Copy size={13} />}
                      <span>{copiedType === "txt" ? "已复制" : "复制网址"}</span>
                    </Button>

                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleExportUrls("md")}
                      style={{
                        fontSize: "0.75rem",
                        padding: "0.3rem 0.75rem",
                      }}
                    >
                      {copiedType === "md" ? <Check size={13} style={{ color: "var(--accent)" }} /> : <FileCode size={13} />}
                      <span>{copiedType === "md" ? "已复制" : "Markdown"}</span>
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
