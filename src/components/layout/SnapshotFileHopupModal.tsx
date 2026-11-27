"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { confirmAction, toast } from "@/store/useFeedbackStore";
import {
  buildFilteredExportSnapshot,
  compareSnapshotsBaseline,
  computeSnapshotHealth,
  formatTabsAsBookmarksHtml,
  formatTabsAsMarkdown,
  formatTabsAsPlainUrls,
} from "@/services/snapshotDataService";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  ArrowLeft,
  Check,
  ClipboardPaste,
  Copy,
  Download,
  FileCode,
  FileJson,
  FileText,
  FolderArchive,
  GitCompare,
  Globe,
  RotateCcw,
  Search,
  Trash2,
  Upload,
  X,
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

function downloadTextFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function SnapshotFileHopupModal({ isOpen, onClose }: SnapshotFileHopupModalProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const {
    rawSnapshot,
    initialSnapshot,
    initialLoadedAt,
    fileName,
    rawFileSize,
    activeWindowId,
    rootNodes,
    duplicateUrls,
    undoStack,
    loadSnapshot,
    resetToInitialSnapshot,
    clearAllCache,
  } = useSnapshotStore();

  const [viewMode, setViewMode] = useState<"hub" | "compare">("hub");
  const [isDragOver, setIsDragOver] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteJsonText, setPasteJsonText] = useState("");

  // Export configuration
  const defaultExportBase = useMemo(
    () =>
      fileName
        ? `${fileName.replace(/\.json$/i, "")}-organized`
        : `sidebery-snapshot-${new Date().toISOString().slice(0, 10)}`,
    [fileName]
  );
  const [exportBaseName, setExportBaseName] = useState(defaultExportBase);
  const [scopeMode, setScopeMode] = useState<"all" | "selected">("all");
  const [selectedPanelIds, setSelectedPanelIds] = useState<string[]>([]);
  const [dedupOnExport, setDedupOnExport] = useState(false);
  const [compactJson, setCompactJson] = useState(false);
  const [copiedType, setCopiedType] = useState<"txt" | "md" | null>(null);

  // Baseline comparison subview filter
  const [comparePanelFilter, setComparePanelFilter] = useState<string>("all");
  const [compareSearch, setCompareSearch] = useState("");

  useEffect(() => {
    if (isOpen) {
      setViewMode("hub");
      setPasteMode(false);
      setIsDragOver(false);
      setExportBaseName(defaultExportBase);
      setComparePanelFilter("all");
      setCompareSearch("");
    }
  }, [isOpen, defaultExportBase]);

  const health = useMemo(
    () => computeSnapshotHealth(rawSnapshot, rootNodes, duplicateUrls, activeWindowId),
    [rawSnapshot, rootNodes, duplicateUrls, activeWindowId]
  );

  const baselineDiff = useMemo(
    () => compareSnapshotsBaseline(initialSnapshot, rawSnapshot, activeWindowId),
    [initialSnapshot, rawSnapshot, activeWindowId]
  );

  const exportPreview = useMemo(() => {
    if (!rawSnapshot) return null;
    const panelFilter = scopeMode === "selected" ? selectedPanelIds : null;
    const res = buildFilteredExportSnapshot(rawSnapshot, rootNodes, {
      activeWindowId,
      panelIds: panelFilter,
      dedupUrls: dedupOnExport,
    });
    const jsonString = compactJson
      ? JSON.stringify(res.snapshot)
      : JSON.stringify(res.snapshot, null, 2);
    return {
      ...res,
      jsonString,
      byteSize: new Blob([jsonString]).size,
    };
  }, [rawSnapshot, rootNodes, activeWindowId, scopeMode, selectedPanelIds, dedupOnExport, compactJson]);

  const handleImportJson = async (content: string, sourceName: string) => {
    const trimmed = content.trim();
    if (!trimmed) {
      toast.warning("请提供有效的 JSON 内容");
      return;
    }

    if (rawSnapshot && (baselineDiff.hasChanges || undoStack.length > 0)) {
      const ok = await confirmAction({
        title: "覆盖当前快照确认",
        message: "当前工作台存在未保存或未导出的修改，导入新快照将覆盖当前状态并重置撤销记录。确定继续吗？",
        confirmLabel: "确认导入",
        destructive: true,
      });
      if (!ok) return;
    }

    try {
      loadSnapshot(trimmed, sourceName);
      setPasteMode(false);
      setPasteJsonText("");
      toast.success(`已载入快照「${sourceName}」`);
    } catch (err: any) {
      toast.error(err?.message || "解析快照失败");
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      handleImportJson(String(ev.target?.result || ""), file.name);
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  const handleDropFile = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      handleImportJson(String(ev.target?.result || ""), file.name);
    };
    reader.readAsText(file);
  };

  const handleRestoreInitial = async () => {
    if (!baselineDiff.hasChanges) return;
    const ok = await confirmAction({
      title: "还原至最初导入原件",
      message: "确定将当前工作台恢复到最初导入时的快照状态吗？（还原操作本身可随时通过顶部「撤销」恢复）",
      confirmLabel: "确认还原",
      destructive: true,
    });
    if (!ok) return;
    const done = resetToInitialSnapshot();
    if (done) {
      setViewMode("hub");
      toast.success("已还原至最初导入原件");
    }
  };

  const handleClearCache = async () => {
    const ok = await confirmAction({
      title: "清空本地快照缓存",
      message: "确定清空当前载入的快照、AI 对话历史与撤消缓存吗？（规则配置与 API 密钥将被保留）",
      confirmLabel: "确认清空",
      destructive: true,
    });
    if (!ok) return;
    clearAllCache();
    toast.info("已清空本地快照缓存");
    onClose();
  };

  const toggleExportPanel = (panelId: string) => {
    setSelectedPanelIds((prev) =>
      prev.includes(panelId) ? prev.filter((id) => id !== panelId) : [...prev, panelId]
    );
  };

  const cleanBaseName = (exportBaseName.trim() || "sidebery-snapshot").replace(/\.(json|md|html|txt)$/i, "");

  const handleDownloadJson = () => {
    if (!exportPreview) return;
    downloadTextFile(exportPreview.jsonString, `${cleanBaseName}.json`, "application/json");
    toast.success(`已导出 ${cleanBaseName}.json`);
  };

  const handleDownloadMarkdown = () => {
    if (!exportPreview || !rawSnapshot) return;
    const md = formatTabsAsMarkdown(exportPreview.tabs, rawSnapshot.panels);
    downloadTextFile(md, `${cleanBaseName}.md`, "text/markdown;charset=utf-8");
    toast.success(`已导出 ${cleanBaseName}.md`);
  };

  const handleDownloadBookmarksHtml = () => {
    if (!exportPreview || !rawSnapshot) return;
    const html = formatTabsAsBookmarksHtml(exportPreview.tabs, rawSnapshot.panels);
    downloadTextFile(html, `${cleanBaseName}.html`, "text/html;charset=utf-8");
    toast.success(`已导出书签文件 ${cleanBaseName}.html`);
  };

  const handleCopyList = async (format: "txt" | "md") => {
    if (!exportPreview || !rawSnapshot) return;
    const output =
      format === "txt"
        ? formatTabsAsPlainUrls(exportPreview.tabs)
        : formatTabsAsMarkdown(exportPreview.tabs, rawSnapshot.panels);
    await navigator.clipboard.writeText(output);
    setCopiedType(format);
    toast.success(format === "txt" ? "已复制有效网址列表" : "已复制 Markdown 清单");
    setTimeout(() => setCopiedType(null), 1800);
  };

  const loadedTimeLabel = initialLoadedAt
    ? new Date(initialLoadedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
    : null;

  const filteredComparePanels = useMemo(() => {
    const q = compareSearch.trim().toLowerCase();
    return baselineDiff.panelDiffs
      .filter((p) => comparePanelFilter === "all" || p.panelId === comparePanelFilter)
      .filter((p) => {
        if (!q) return p.changeCount > 0;
        return (
          p.panelName.toLowerCase().includes(q) ||
          p.removedTabs.some((t) => (t.title + t.url).toLowerCase().includes(q)) ||
          p.movedInTabs.some((t) => (t.title + t.url).toLowerCase().includes(q)) ||
          p.newGroups.some((g) => (g.categoryName || g.tab.title || "").toLowerCase().includes(q))
        );
      });
  }, [baselineDiff.panelDiffs, comparePanelFilter, compareSearch]);

  return (
    <Dialog.Root open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 110 }} />
      <Dialog.Positioner style={{ zIndex: 120 }}>
        <Dialog.Content
          style={{
            width: "94vw",
            maxWidth: "880px",
            maxHeight: "88vh",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 20px 44px rgba(0, 0, 0, 0.45)",
          }}
        >
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            style={{ display: "none" }}
            onChange={handleFileChange}
          />

          {/* Header */}
          <div
            style={{
              padding: "0.85rem 1.25rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexShrink: 0,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", minWidth: 0 }}>
              {viewMode === "compare" ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  pill
                  onClick={() => setViewMode("hub")}
                  style={{ padding: "4px 7px" }}
                  title="返回文件与数据中心"
                >
                  <ArrowLeft size={14} />
                </Button>
              ) : (
                <div
                  style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "9999px",
                    backgroundColor: "var(--accent-subtle)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    color: "var(--accent)",
                    flexShrink: 0,
                  }}
                >
                  <FolderArchive size={16} />
                </div>
              )}

              <div style={{ minWidth: 0 }}>
                <Dialog.Title style={{ fontSize: "0.95rem", fontWeight: 600 }}>
                  {viewMode === "compare"
                    ? "最初导入原件 vs 当前修改态"
                    : "快照文件与数据中心"}
                </Dialog.Title>
                <div
                  style={{
                    fontSize: "0.72rem",
                    color: "var(--text-muted)",
                    display: "flex",
                    alignItems: "center",
                    gap: "0.45rem",
                    flexWrap: "wrap",
                  }}
                >
                  <span>{fileName || "暂未载入快照文件"}</span>
                  {loadedTimeLabel && <span>· 载入于 {loadedTimeLabel}</span>}
                  {rawSnapshot && (
                    <Badge
                      variant={baselineDiff.hasChanges ? "subtle" : "outline"}
                      style={{
                        fontSize: "0.65rem",
                        padding: "0 6px",
                        color: baselineDiff.hasChanges ? "var(--accent-text)" : "var(--text-muted)",
                      }}
                    >
                      {baselineDiff.hasChanges
                        ? `已修改${undoStack.length > 0 ? ` (${undoStack.length}步)` : ""}`
                        : "与原件一致"}
                    </Badge>
                  )}
                </div>
              </div>
            </div>

            <Dialog.CloseTrigger asChild>
              <Button variant="ghost" size="xs" pill onClick={onClose} style={{ padding: "4px" }}>
                <X size={16} />
              </Button>
            </Dialog.CloseTrigger>
          </div>

          {/* Body */}
          {viewMode === "compare" ? (
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1.1rem 1.25rem",
                display: "flex",
                flexDirection: "column",
                gap: "0.9rem",
              }}
            >
              {/* Summary & Search Strip */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.75rem",
                  flexWrap: "wrap",
                  padding: "0.7rem 0.9rem",
                  borderRadius: "0.7rem",
                  backgroundColor: "var(--bg-subtle)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap", fontSize: "0.76rem" }}>
                  <span>
                    总标签：<b>{baselineDiff.totalBeforeTabs}</b> → <b>{baselineDiff.totalAfterTabs}</b>
                  </span>
                  <Badge variant="outline" style={{ fontSize: "0.68rem", color: "#ef4444" }}>
                    移除/删重 -{baselineDiff.removedCount}
                  </Badge>
                  <Badge variant="outline" style={{ fontSize: "0.68rem", color: "var(--accent-text)" }}>
                    迁入/重排 {baselineDiff.movedInCount}
                  </Badge>
                  <Badge variant="outline" style={{ fontSize: "0.68rem", color: "#10b981" }}>
                    新建分组 +{baselineDiff.newGroupsCount}
                  </Badge>
                </div>

                <div style={{ position: "relative", width: "220px", maxWidth: "100%" }}>
                  <Search
                    size={13}
                    style={{
                      position: "absolute",
                      left: "0.6rem",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--text-muted)",
                    }}
                  />
                  <Input
                    type="text"
                    value={compareSearch}
                    onChange={(e) => setCompareSearch(e.target.value)}
                    placeholder="过滤变更标签..."
                    style={{ paddingLeft: "1.8rem", fontSize: "0.76rem", height: "30px" }}
                  />
                </div>
              </div>

              {/* Panel Pills */}
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                <Button
                  type="button"
                  variant={comparePanelFilter === "all" ? "solid" : "outline"}
                  size="xs"
                  pill
                  onClick={() => setComparePanelFilter("all")}
                >
                  全部变更面板
                </Button>
                {baselineDiff.panelDiffs
                  .filter((p) => p.changeCount > 0)
                  .map((p) => (
                    <Button
                      key={p.panelId}
                      type="button"
                      variant={comparePanelFilter === p.panelId ? "solid" : "outline"}
                      size="xs"
                      pill
                      onClick={() => setComparePanelFilter(p.panelId)}
                    >
                      <span>{p.panelName}</span>
                      <span style={{ opacity: 0.8 }}>({p.changeCount})</span>
                    </Button>
                  ))}
              </div>

              {/* Panel Diff Cards */}
              {filteredComparePanels.length === 0 ? (
                <div
                  style={{
                    padding: "2rem",
                    textAlign: "center",
                    fontSize: "0.82rem",
                    color: "var(--text-muted)",
                    backgroundColor: "var(--bg-subtle)",
                    borderRadius: "0.75rem",
                  }}
                >
                  {baselineDiff.hasChanges
                    ? "当前过滤条件下暂无面板变更项"
                    : "当前修改态与最初导入原件完全一致"}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
                  {filteredComparePanels.map((panel) => (
                    <div
                      key={panel.panelId}
                      style={{
                        borderRadius: "0.75rem",
                        border: "1px solid var(--border-card)",
                        backgroundColor: "var(--bg-surface)",
                        padding: "0.8rem 0.95rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.55rem",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem" }}>
                        <div style={{ fontSize: "0.84rem", fontWeight: 600 }}>
                          {panel.panelName}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                          {panel.beforeCount} → {panel.afterCount} 标签
                        </div>
                      </div>

                      {panel.newGroups.length > 0 && (
                        <div style={{ fontSize: "0.74rem" }}>
                          <div style={{ color: "#10b981", fontWeight: 600, marginBottom: "0.25rem" }}>
                            + 新建分组 ({panel.newGroups.length})
                          </div>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                            {panel.newGroups.map((g) => (
                              <Badge key={g.id} variant="subtle" style={{ fontSize: "0.7rem" }}>
                                📁 {g.categoryName || g.tab.title} ({g.children.length})
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}

                      {panel.movedInTabs.length > 0 && (
                        <div style={{ fontSize: "0.74rem" }}>
                          <div style={{ color: "var(--accent-text)", fontWeight: 600, marginBottom: "0.2rem" }}>
                            → 迁入本面板 ({panel.movedInTabs.length})
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "110px", overflowY: "auto" }}>
                            {panel.movedInTabs.slice(0, 20).map((t) => (
                              <div
                                key={t.id}
                                style={{
                                  fontSize: "0.72rem",
                                  color: "var(--text-main)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                • {t.title || t.url}
                              </div>
                            ))}
                            {panel.movedInTabs.length > 20 && (
                              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                ...等共 {panel.movedInTabs.length} 项
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {panel.removedTabs.length > 0 && (
                        <div style={{ fontSize: "0.74rem" }}>
                          <div style={{ color: "#ef4444", fontWeight: 600, marginBottom: "0.2rem" }}>
                            - 移出或删除 ({panel.removedTabs.length})
                          </div>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", maxHeight: "110px", overflowY: "auto" }}>
                            {panel.removedTabs.slice(0, 20).map((t) => (
                              <div
                                key={t.id}
                                style={{
                                  fontSize: "0.72rem",
                                  color: "var(--text-muted)",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                • {t.title || t.url}
                              </div>
                            ))}
                            {panel.removedTabs.length > 20 && (
                              <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>
                                ...等共 {panel.removedTabs.length} 项
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            /* Main 2-Column Data & File Hub */
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "1.1rem 1.25rem",
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(330px, 1fr))",
                gap: "1rem",
                alignItems: "start",
              }}
            >
              {/* LEFT COLUMN: Health Check, Baseline Restore & Safe Import */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                {/* 1. Snapshot Health Card */}
                <div
                  style={{
                    padding: "0.95rem 1rem",
                    borderRadius: "0.85rem",
                    backgroundColor: "var(--bg-subtle)",
                    border: "1px solid var(--border-subtle)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.84rem", fontWeight: 600 }}>
                      <FileText size={15} style={{ color: "var(--accent)" }} />
                      <span>快照健康体检</span>
                    </div>
                    {rawSnapshot && (
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        原 {formatBytes(rawFileSize)} · 当前 {formatBytes(health.estimatedJsonBytes)}
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.55rem" }}>
                    <div
                      style={{
                        padding: "0.6rem 0.7rem",
                        borderRadius: "0.55rem",
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-card)",
                      }}
                    >
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>有效 / 豁免标签</div>
                      <div style={{ fontSize: "0.98rem", fontWeight: 700, marginTop: "0.1rem" }}>
                        {health.effectiveTabs}
                        <span style={{ fontSize: "0.72rem", fontWeight: 400, color: "var(--text-muted)", marginLeft: "4px" }}>
                          / {health.exemptPinnedCount + health.exemptInternalCount} 保护
                        </span>
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "0.6rem 0.7rem",
                        borderRadius: "0.55rem",
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-card)",
                      }}
                    >
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>重复 URL 标签</div>
                      <div
                        style={{
                          fontSize: "0.98rem",
                          fontWeight: 700,
                          marginTop: "0.1rem",
                          color: health.duplicateTabCount > 0 ? "#f59e0b" : "var(--text-main)",
                        }}
                      >
                        {health.duplicateTabCount} 个
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "0.6rem 0.7rem",
                        borderRadius: "0.55rem",
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-card)",
                      }}
                    >
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>折叠分组 / 顶层根</div>
                      <div style={{ fontSize: "0.98rem", fontWeight: 700, marginTop: "0.1rem" }}>
                        {health.groupCount} 组 · {health.rootNodeCount} 根
                      </div>
                    </div>

                    <div
                      style={{
                        padding: "0.6rem 0.7rem",
                        borderRadius: "0.55rem",
                        backgroundColor: "var(--bg-card)",
                        border: "1px solid var(--border-card)",
                      }}
                    >
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>面板 / 容器环境</div>
                      <div style={{ fontSize: "0.98rem", fontWeight: 700, marginTop: "0.1rem" }}>
                        {health.panelCount} 面板
                        {health.emptyPanelCount > 0 && (
                          <span style={{ fontSize: "0.7rem", fontWeight: 400, color: "var(--text-muted)", marginLeft: "4px" }}>
                            ({health.emptyPanelCount}空)
                          </span>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Panel Distribution Bars */}
                  {health.panelStats.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.35rem" }}>
                      <div style={{ fontSize: "0.72rem", fontWeight: 600, color: "var(--text-muted)" }}>
                        面板负载分布
                      </div>
                      {health.panelStats.slice(0, 5).map((p) => (
                        <div key={p.id} style={{ display: "flex", alignItems: "center", gap: "0.5rem", fontSize: "0.72rem" }}>
                          <span
                            style={{
                              width: "84px",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                              color: "var(--text-main)",
                              flexShrink: 0,
                            }}
                            title={p.name}
                          >
                            {p.name}
                          </span>
                          <div
                            style={{
                              flex: 1,
                              height: "6px",
                              borderRadius: "9999px",
                              backgroundColor: "var(--bg-card)",
                              overflow: "hidden",
                            }}
                          >
                            <div
                              style={{
                                width: `${Math.max(p.count > 0 ? 4 : 0, p.pct)}%`,
                                height: "100%",
                                backgroundColor: "var(--accent-solid)",
                                borderRadius: "9999px",
                              }}
                            />
                          </div>
                          <span style={{ width: "44px", textAlign: "right", color: "var(--text-muted)", flexShrink: 0 }}>
                            {p.count} ({p.pct}%)
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* 2. Initial Baseline vs Current State */}
                {rawSnapshot && (
                  <div
                    style={{
                      padding: "0.85rem 1rem",
                      borderRadius: "0.85rem",
                      backgroundColor: "var(--bg-subtle)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.6rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                        最初原件 vs 当前修改态
                      </span>
                      <span style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        {baselineDiff.hasChanges
                          ? `${baselineDiff.totalBeforeTabs} → ${baselineDiff.totalAfterTabs} 标签`
                          : "无未保存结构变化"}
                      </span>
                    </div>

                    {baselineDiff.hasChanges && (
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                        <span>移除 -{baselineDiff.removedCount}</span>
                        <span>·</span>
                        <span>迁入 {baselineDiff.movedInCount}</span>
                        <span>·</span>
                        <span>新建组 +{baselineDiff.newGroupsCount}</span>
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        pill
                        disabled={!baselineDiff.hasChanges}
                        onClick={() => setViewMode("compare")}
                      >
                        <GitCompare size={13} />
                        <span>对比原件差异</span>
                      </Button>

                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        pill
                        disabled={!baselineDiff.hasChanges}
                        onClick={handleRestoreInitial}
                        style={{
                          color: baselineDiff.hasChanges ? "#f59e0b" : undefined,
                          borderColor: baselineDiff.hasChanges ? "rgba(245, 158, 11, 0.45)" : undefined,
                        }}
                      >
                        <RotateCcw size={13} />
                        <span>还原最初原件</span>
                      </Button>
                    </div>
                  </div>
                )}

                {/* 3. Multi-source Safe Import */}
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setIsDragOver(true);
                  }}
                  onDragLeave={() => setIsDragOver(false)}
                  onDrop={handleDropFile}
                  style={{
                    padding: "0.85rem 1rem",
                    borderRadius: "0.85rem",
                    backgroundColor: isDragOver ? "var(--accent-subtle)" : "var(--bg-subtle)",
                    border: "1px dashed",
                    borderColor: isDragOver ? "var(--accent-solid)" : "var(--border-card)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.55rem",
                    transition: "all 0.15s ease",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "0.5rem", flexWrap: "wrap" }}>
                    <span style={{ fontSize: "0.82rem", fontWeight: 600 }}>
                      导入新快照（支持拖拽 JSON）
                    </span>
                    <div style={{ display: "flex", gap: "0.4rem" }}>
                      <Button
                        type="button"
                        variant="outline"
                        size="xs"
                        pill
                        onClick={() => fileInputRef.current?.click()}
                      >
                        <Upload size={12} />
                        <span>选择文件</span>
                      </Button>
                      <Button
                        type="button"
                        variant={pasteMode ? "subtle" : "outline"}
                        size="xs"
                        pill
                        onClick={() => setPasteMode((prev) => !prev)}
                      >
                        <ClipboardPaste size={12} />
                        <span>粘贴 JSON</span>
                      </Button>
                    </div>
                  </div>

                  {pasteMode && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                      <textarea
                        rows={4}
                        value={pasteJsonText}
                        onChange={(e) => setPasteJsonText(e.target.value)}
                        placeholder="在此粘贴 Sidebery 导出的快照 JSON 内容..."
                        style={{
                          width: "100%",
                          padding: "0.5rem 0.65rem",
                          borderRadius: "0.5rem",
                          backgroundColor: "var(--bg-card)",
                          border: "1px solid var(--border-subtle)",
                          color: "var(--text-main)",
                          fontSize: "0.75rem",
                          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
                          outline: "none",
                          resize: "vertical",
                        }}
                      />
                      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.4rem" }}>
                        <Button variant="ghost" size="xs" pill onClick={() => setPasteMode(false)}>
                          取消
                        </Button>
                        <Button
                          variant="solid"
                          size="xs"
                          pill
                          onClick={() =>
                            handleImportJson(
                              pasteJsonText,
                              `pasted-snapshot-${new Date().toISOString().slice(0, 10)}.json`
                            )
                          }
                        >
                          <Check size={12} />
                          <span>载入粘贴内容</span>
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* RIGHT COLUMN: Filtered Multi-Format Export Studio & Cache Control */}
              <div style={{ display: "flex", flexDirection: "column", gap: "0.9rem" }}>
                {rawSnapshot && exportPreview ? (
                  <div
                    style={{
                      padding: "0.95rem 1rem",
                      borderRadius: "0.85rem",
                      backgroundColor: "var(--bg-subtle)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "0.75rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", fontSize: "0.84rem", fontWeight: 600 }}>
                        <Download size={15} style={{ color: "var(--accent)" }} />
                        <span>精准导出工作台</span>
                      </div>
                      <span style={{ fontSize: "0.72rem", color: "var(--accent-text)", fontWeight: 600 }}>
                        {exportPreview.effectiveTabCount} 有效标签 · {formatBytes(exportPreview.byteSize)}
                      </span>
                    </div>

                    {/* Export Scope */}
                    <div>
                      <div style={{ fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                        导出范围
                      </div>
                      <div style={{ display: "flex", gap: "0.4rem", marginBottom: scopeMode === "selected" ? "0.45rem" : 0 }}>
                        <Button
                          type="button"
                          variant={scopeMode === "all" ? "subtle" : "outline"}
                          size="xs"
                          pill
                          onClick={() => setScopeMode("all")}
                        >
                          全部面板
                        </Button>
                        <Button
                          type="button"
                          variant={scopeMode === "selected" ? "subtle" : "outline"}
                          size="xs"
                          pill
                          onClick={() => {
                            setScopeMode("selected");
                            if (selectedPanelIds.length === 0 && health.panelStats.length > 0) {
                              setSelectedPanelIds([health.panelStats[0].id]);
                            }
                          }}
                        >
                          仅指定面板
                        </Button>
                      </div>

                      {scopeMode === "selected" && (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "0.3rem" }}>
                          {health.panelStats.map((p) => {
                            const active = selectedPanelIds.includes(p.id);
                            return (
                              <button
                                key={p.id}
                                type="button"
                                onClick={() => toggleExportPanel(p.id)}
                                style={{
                                  padding: "2px 8px",
                                  borderRadius: "9999px",
                                  fontSize: "0.7rem",
                                  border: "1px solid",
                                  borderColor: active ? "var(--accent-border)" : "var(--border-subtle)",
                                  backgroundColor: active ? "var(--accent-subtle)" : "var(--bg-card)",
                                  color: active ? "var(--accent-text)" : "var(--text-muted)",
                                  cursor: "pointer",
                                }}
                              >
                                {p.name} ({p.count})
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    {/* Export Processing Toggles */}
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "0.45rem" }}>
                      <button
                        type="button"
                        onClick={() => setDedupOnExport((prev) => !prev)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          padding: "3px 9px",
                          borderRadius: "9999px",
                          fontSize: "0.71rem",
                          border: "1px solid",
                          borderColor: dedupOnExport ? "var(--accent-border)" : "var(--border-subtle)",
                          backgroundColor: dedupOnExport ? "var(--accent-subtle)" : "var(--bg-card)",
                          color: dedupOnExport ? "var(--accent-text)" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        <Check size={11} style={{ opacity: dedupOnExport ? 1 : 0.3 }} />
                        <span>
                          导出前自动去重 URL
                          {dedupOnExport && exportPreview.removedDuplicateCount > 0
                            ? ` (-${exportPreview.removedDuplicateCount})`
                            : ""}
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setCompactJson((prev) => !prev)}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.3rem",
                          padding: "3px 9px",
                          borderRadius: "9999px",
                          fontSize: "0.71rem",
                          border: "1px solid",
                          borderColor: compactJson ? "var(--accent-border)" : "var(--border-subtle)",
                          backgroundColor: compactJson ? "var(--accent-subtle)" : "var(--bg-card)",
                          color: compactJson ? "var(--accent-text)" : "var(--text-muted)",
                          cursor: "pointer",
                        }}
                      >
                        <Check size={11} style={{ opacity: compactJson ? 1 : 0.3 }} />
                        <span>JSON 紧凑压缩</span>
                      </button>
                    </div>

                    {/* Filename Input */}
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", color: "var(--text-muted)", marginBottom: "0.25rem" }}>
                        导出文件名称
                      </label>
                      <Input
                        type="text"
                        value={exportBaseName}
                        onChange={(e) => setExportBaseName(e.target.value)}
                        placeholder="sidebery-snapshot-organized"
                        style={{ fontSize: "0.78rem" }}
                      />
                    </div>

                    {/* Primary & Secondary Downloads */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "0.45rem" }}>
                      <Button
                        type="button"
                        variant="solid"
                        size="sm"
                        pill
                        onClick={handleDownloadJson}
                        style={{ width: "100%", justifyContent: "center" }}
                      >
                        <FileJson size={14} />
                        <span>下载 Sidebery Snapshot (.json)</span>
                      </Button>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                        <Button type="button" variant="outline" size="xs" pill onClick={handleDownloadMarkdown}>
                          <FileCode size={12} />
                          <span>下载 .md 清单</span>
                        </Button>
                        <Button type="button" variant="outline" size="xs" pill onClick={handleDownloadBookmarksHtml}>
                          <Globe size={12} />
                          <span>下载书签 .html</span>
                        </Button>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.4rem" }}>
                        <Button type="button" variant="ghost" size="xs" pill onClick={() => handleCopyList("txt")}>
                          {copiedType === "txt" ? <Check size={12} style={{ color: "var(--accent)" }} /> : <Copy size={12} />}
                          <span>{copiedType === "txt" ? "已复制网址" : "复制纯网址"}</span>
                        </Button>
                        <Button type="button" variant="ghost" size="xs" pill onClick={() => handleCopyList("md")}>
                          {copiedType === "md" ? <Check size={12} style={{ color: "var(--accent)" }} /> : <Copy size={12} />}
                          <span>{copiedType === "md" ? "已复制 MD" : "复制 Markdown"}</span>
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div
                    style={{
                      padding: "1.5rem 1rem",
                      borderRadius: "0.85rem",
                      backgroundColor: "var(--bg-subtle)",
                      border: "1px solid var(--border-subtle)",
                      textAlign: "center",
                      fontSize: "0.8rem",
                      color: "var(--text-muted)",
                    }}
                  >
                    导入 Sidebery 快照 JSON 后，可在此筛选面板范围并导出为 JSON、Markdown 或浏览器书签 HTML。
                  </div>
                )}

                {/* Local Cache Control Card */}
                {rawSnapshot && (
                  <div
                    style={{
                      padding: "0.8rem 1rem",
                      borderRadius: "0.85rem",
                      backgroundColor: "var(--bg-subtle)",
                      border: "1px solid var(--border-subtle)",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "0.5rem",
                      flexWrap: "wrap",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.8rem", fontWeight: 600 }}>本地快照缓存</div>
                      <div style={{ fontSize: "0.7rem", color: "var(--text-muted)" }}>
                        清空当前快照、对比基线与 AI 会话缓存
                      </div>
                    </div>

                    <Button
                      type="button"
                      variant="outline"
                      size="xs"
                      pill
                      onClick={handleClearCache}
                      style={{
                        color: "var(--danger)",
                        borderColor: "color-mix(in srgb, var(--danger) 40%, transparent)",
                      }}
                    >
                      <Trash2 size={12} />
                      <span>清空缓存</span>
                    </Button>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Footer */}
          <div
            style={{
              padding: "0.7rem 1.25rem",
              borderTop: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              justifyContent: viewMode === "compare" ? "space-between" : "flex-end",
              alignItems: "center",
              gap: "0.5rem",
              flexShrink: 0,
            }}
          >
            {viewMode === "compare" ? (
              <>
                <Button type="button" variant="outline" size="xs" pill onClick={() => setViewMode("hub")}>
                  <ArrowLeft size={13} />
                  <span>返回数据中心</span>
                </Button>
                <Button
                  type="button"
                  variant="solid"
                  size="xs"
                  pill
                  disabled={!baselineDiff.hasChanges}
                  onClick={handleRestoreInitial}
                >
                  <RotateCcw size={13} />
                  <span>还原至最初原件</span>
                </Button>
              </>
            ) : (
              <Button type="button" variant="solid" size="xs" pill onClick={onClose}>
                完成
              </Button>
            )}
          </div>
        </Dialog.Content>
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
