"use client";

import React, { useState, useMemo } from "react";
import { AIMergeReport } from "@/types/ai";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { toast } from "@/store/useFeedbackStore";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  X,
  FileCheck2,
  Search,
  ArrowRight,
  Copy,
  Download,
  ExternalLink,
} from "lucide-react";

interface AIMergeReportModalProps {
  isOpen: boolean;
  report: AIMergeReport | null;
  onClose: () => void;
}

export function AIMergeReportModal({ isOpen, report, onClose }: AIMergeReportModalProps) {
  const { setActivePanelId, setSearchQuery, setContainerFilter, setOnlyDuplicates } = useSnapshotStore();
  const { setActivePage } = useConfigStore();

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [onlyMoved, setOnlyMoved] = useState(false);

  const filteredItems = useMemo(() => {
    if (!report) return [];
    const q = query.trim().toLowerCase();
    return report.items.filter((item) => {
      if (selectedCategory && item.toCategoryName !== selectedCategory) return false;
      if (onlyMoved && item.fromPanelId === item.toPanelId) return false;
      if (q) {
        const match =
          item.title.toLowerCase().includes(q) ||
          item.domain.toLowerCase().includes(q) ||
          item.url.toLowerCase().includes(q) ||
          item.toCategoryName.toLowerCase().includes(q) ||
          item.toPanelName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [report, query, selectedCategory, onlyMoved]);

  const locateInWorkbench = (panelId: string, searchText: string) => {
    setActivePanelId(panelId);
    setSearchQuery(searchText);
    setContainerFilter(null);
    setOnlyDuplicates(false);
    setActivePage("workbench");
    onClose();
  };

  const buildMarkdownReport = () => {
    if (!report) return "";
    const lines: string[] = [
      `# AI 架构合并变更报告`,
      `- 时间：${new Date(report.timestamp).toLocaleString()}`,
      `- 总标签：${report.totalTabs} ｜ 已归类：${report.categorizedCount} ｜ 跨面板迁移：${report.movedAcrossPanelsCount} ｜ 保持原位：${report.unchangedCount}`,
      ``,
      `## 分类去向汇总`,
      ...report.categories.map(
        (c) =>
          `- **${c.categoryName}** → 面板「${c.targetPanelName}」：${c.tabCount} 个标签（跨面板 ${c.movedAcrossPanelsCount}）`
      ),
      ``,
      `## 迁移明细（前 100 条）`,
      ...report.items
        .filter((it) => it.fromPanelId !== it.toPanelId || it.toCategoryName !== "保持原位")
        .slice(0, 100)
        .map(
          (it) =>
            `- [${it.title}](${it.url}) ：\`${it.fromPanelName}\` → \`${it.toPanelName} / ${it.toCategoryName}\``
        ),
    ];
    return lines.join("\n");
  };

  const handleCopyMarkdown = () => {
    navigator.clipboard
      ?.writeText(buildMarkdownReport())
      .then(() => toast.success("已复制 Markdown 合并报告"))
      .catch(() => toast.error("复制失败"));
  };

  const handleDownloadMarkdown = () => {
    if (!report) return;
    const blob = new Blob([buildMarkdownReport()], { type: "text/markdown;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ai-merge-report-${new Date(report.timestamp).toISOString().slice(0, 10)}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("已导出合并报告");
  };

  return (
    <Dialog.Root open={isOpen && Boolean(report)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 130 }} />
      <Dialog.Positioner style={{ zIndex: 140 }}>
        {report && (
        <Dialog.Content
          style={{
            maxWidth: "860px",
            width: "94vw",
            maxHeight: "88vh",
            backgroundColor: "var(--bg-card)",
            border: "1px solid var(--border-card)",
            borderRadius: "1rem",
            color: "var(--text-main)",
            display: "flex",
            flexDirection: "column",
            overflow: "hidden",
            boxShadow: "0 24px 48px rgba(0, 0, 0, 0.45)",
          }}
        >
          {/* Header */}
          <div
            style={{
              padding: "0.8rem 1.2rem",
              borderBottom: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "0.75rem",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
              <FileCheck2 size={16} style={{ color: "var(--success, #10b981)" }} />
              <Dialog.Title style={{ fontSize: "0.95rem", fontWeight: 700 }}>
                AI 架构合并变更报告
              </Dialog.Title>
              <Badge variant="subtle" size="sm" style={{ fontSize: "0.68rem" }}>
                已归类 {report.categorizedCount} / {report.totalTabs}
              </Badge>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
              <Button variant="outline" size="xs" pill onClick={handleCopyMarkdown}>
                <Copy size={12} />
                <span>复制报告</span>
              </Button>
              <Button variant="outline" size="xs" pill onClick={handleDownloadMarkdown}>
                <Download size={12} />
                <span>导出 MD</span>
              </Button>
              <Dialog.CloseTrigger asChild>
                <Button variant="ghost" size="xs" pill onClick={onClose} style={{ padding: "4px" }}>
                  <X size={15} />
                </Button>
              </Dialog.CloseTrigger>
            </div>
          </div>

          {/* Body */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              padding: "1rem 1.2rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.95rem",
            }}
          >
            {/* Summary Strip */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: "0.55rem" }}>
              {[
                { label: "总标签数", value: report.totalTabs },
                { label: "已归类标签", value: report.categorizedCount, accent: true },
                { label: "跨面板迁移", value: report.movedAcrossPanelsCount },
                { label: "保持原位", value: report.unchangedCount },
              ].map((stat) => (
                <div
                  key={stat.label}
                  style={{
                    padding: "0.6rem 0.8rem",
                    borderRadius: "0.6rem",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div style={{ fontSize: "0.68rem", color: "var(--text-muted)" }}>{stat.label}</div>
                  <div
                    style={{
                      fontSize: "1.05rem",
                      fontWeight: 700,
                      marginTop: "0.1rem",
                      color: stat.accent ? "var(--accent-text)" : "var(--text-main)",
                    }}
                  >
                    {stat.value}
                  </div>
                </div>
              ))}
            </div>

            {/* Category Destination Pills */}
            <div>
              <div style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.4rem" }}>
                按分类筛选去向（点击查看明细）：
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                <button
                  type="button"
                  onClick={() => setSelectedCategory(null)}
                  style={{
                    padding: "0.28rem 0.65rem",
                    borderRadius: "9999px",
                    border: "1px solid",
                    borderColor: selectedCategory === null ? "var(--accent-solid)" : "var(--border-subtle)",
                    backgroundColor: selectedCategory === null ? "var(--accent-subtle)" : "var(--bg-surface)",
                    color: selectedCategory === null ? "var(--accent-text)" : "var(--text-muted)",
                    fontSize: "0.72rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  全部 ({report.items.length})
                </button>
                {report.categories.map((cat) => {
                  const active = selectedCategory === cat.categoryName;
                  return (
                    <button
                      key={`${cat.categoryName}_${cat.targetPanelId}`}
                      type="button"
                      onClick={() => setSelectedCategory(active ? null : cat.categoryName)}
                      style={{
                        padding: "0.28rem 0.65rem",
                        borderRadius: "9999px",
                        border: "1px solid",
                        borderColor: active ? "var(--accent-solid)" : "var(--border-subtle)",
                        backgroundColor: active ? "var(--accent-subtle)" : "var(--bg-surface)",
                        color: active ? "var(--accent-text)" : "var(--text-main)",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                      }}
                    >
                      {cat.categoryName} → {cat.targetPanelName} ({cat.tabCount})
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Search Bar */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
              <div style={{ position: "relative", flex: 1, minWidth: "220px" }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: "0.7rem",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "var(--text-muted)",
                  }}
                />
                <Input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="搜索标签标题、域名或目标分类，快速定位去向..."
                  style={{ paddingLeft: "2rem", fontSize: "0.78rem" }}
                />
              </div>

              <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.74rem", cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={onlyMoved}
                  onChange={(e) => setOnlyMoved(e.target.checked)}
                  style={{ accentColor: "var(--accent-solid)", cursor: "pointer" }}
                />
                <span>仅看跨面板迁移</span>
              </label>
            </div>

            {/* Searchable Item List */}
            <div
              style={{
                borderRadius: "0.75rem",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-surface)",
                overflow: "hidden",
              }}
            >
              {filteredItems.length === 0 ? (
                <div style={{ padding: "1.5rem", textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                  没有匹配的标签记录
                </div>
              ) : (
                filteredItems.slice(0, 120).map((item, idx) => (
                  <div
                    key={`${item.tabId}_${idx}`}
                    style={{
                      padding: "0.55rem 0.8rem",
                      borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "0.65rem",
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div
                        style={{
                          fontSize: "0.78rem",
                          fontWeight: 500,
                          color: "var(--text-main)",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={item.title}
                      >
                        {item.title}
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "0.35rem",
                          marginTop: "0.18rem",
                          fontSize: "0.7rem",
                          color: "var(--text-muted)",
                          flexWrap: "wrap",
                        }}
                      >
                        <span>{item.fromPanelName}</span>
                        <ArrowRight size={11} />
                        <span style={{ color: "var(--accent-text)", fontWeight: 600 }}>
                          {item.toPanelName} · {item.toCategoryName}
                        </span>
                      </div>
                    </div>

                    <Button
                      variant="ghost"
                      size="xs"
                      pill
                      onClick={() => locateInWorkbench(item.toPanelId, item.domain || item.title.slice(0, 16))}
                      title="在工作台中定位该标签"
                      style={{ flexShrink: 0, fontSize: "0.7rem" }}
                    >
                      <ExternalLink size={12} />
                      <span>定位</span>
                    </Button>
                  </div>
                ))
              )}
              {filteredItems.length > 120 && (
                <div style={{ padding: "0.45rem", textAlign: "center", fontSize: "0.7rem", color: "var(--text-muted)", borderTop: "1px solid var(--border-subtle)" }}>
                  仅显示前 120 条（共 {filteredItems.length} 条），请输入关键字缩小范围
                </div>
              )}
            </div>
          </div>

          {/* Footer */}
          <div
            style={{
              padding: "0.75rem 1.2rem",
              borderTop: "1px solid var(--border-subtle)",
              backgroundColor: "var(--bg-surface)",
              display: "flex",
              justifyContent: "flex-end",
            }}
          >
            <Button variant="solid" size="xs" pill onClick={onClose}>
              完成
            </Button>
          </div>
        </Dialog.Content>
        )}
      </Dialog.Positioner>
    </Dialog.Root>
  );
}
