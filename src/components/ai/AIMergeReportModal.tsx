"use client";

import React, { useState, useMemo, useEffect } from "react";
import { AIMergeReport, AIMergeReportItem } from "@/types/ai";
import { CategorizationRule } from "@/types/sidebery";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore } from "@/store/useConfigStore";
import { serializeSnapshot } from "@/services/snapshotParser";
import { toast } from "@/store/useFeedbackStore";
import { Dialog } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select } from "@/components/ui/select";
import {
  X,
  FileCheck2,
  Search,
  ArrowRight,
  Copy,
  Download,
  ExternalLink,
  Undo2,
  ChevronDown,
  ChevronRight,
  BookmarkPlus,
  Layers,
  List,
} from "lucide-react";

interface AIMergeReportModalProps {
  isOpen: boolean;
  report: AIMergeReport | null;
  onClose: () => void;
}

export function AIMergeReportModal({ isOpen, report, onClose }: AIMergeReportModalProps) {
  const {
    rawSnapshot,
    fileName,
    undoStack,
    undo,
    applySnapshotUpdate,
    setActiveMergeReport,
    setActivePanelId,
    setSearchQuery,
    setContainerFilter,
    setOnlyDuplicates,
  } = useSnapshotStore();
  const { setActivePage, addRule } = useConfigStore();

  const [query, setQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [selectedFlow, setSelectedFlow] = useState<string | null>(null);
  const [onlyMoved, setOnlyMoved] = useState(false);
  const [viewMode, setViewMode] = useState<"grouped" | "flat">("grouped");
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!report) return;
    setSelectedCategory(null);
    setSelectedFlow(null);
    setQuery("");
    setExpandedCats(
      new Set(
        report.categories
          .slice(0, 2)
          .map((c) => `${c.categoryName}::${c.targetPanelId}`)
      )
    );
  }, [report?.id]);

  // Panel-to-panel flow summary
  const flowSummaries = useMemo(() => {
    if (!report) return [];
    const map = new Map<
      string,
      { key: string; fromPanelName: string; toPanelName: string; count: number }
    >();
    for (const item of report.items) {
      if (item.fromPanelId === item.toPanelId) continue;
      const key = `${item.fromPanelId}->${item.toPanelId}`;
      const existing = map.get(key) || {
        key,
        fromPanelName: item.fromPanelName,
        toPanelName: item.toPanelName,
        count: 0,
      };
      existing.count++;
      map.set(key, existing);
    }
    return Array.from(map.values()).sort((a, b) => b.count - a.count);
  }, [report]);

  const filteredItems = useMemo(() => {
    if (!report) return [];
    const q = query.trim().toLowerCase();
    return report.items.filter((item) => {
      if (selectedCategory && item.toCategoryName !== selectedCategory) return false;
      if (selectedFlow && `${item.fromPanelId}->${item.toPanelId}` !== selectedFlow) return false;
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
  }, [report, query, selectedCategory, selectedFlow, onlyMoved]);

  const groupedSections = useMemo(() => {
    if (!report) return [];
    const itemsByCat = new Map<string, AIMergeReportItem[]>();
    for (const item of filteredItems) {
      const key = `${item.toCategoryName}::${item.toPanelId}`;
      if (!itemsByCat.has(key)) itemsByCat.set(key, []);
      itemsByCat.get(key)!.push(item);
    }
    return report.categories
      .map((cat) => {
        const key = `${cat.categoryName}::${cat.targetPanelId}`;
        return {
          key,
          cat,
          items: itemsByCat.get(key) || [],
        };
      })
      .filter((sec) => sec.items.length > 0);
  }, [report, filteredItems]);

  const destinationOptions = useMemo(() => {
    if (!report) return [];
    const seen = new Set<string>();
    const opts: { value: string; label: string; panelId: string; panelName: string; categoryName: string }[] = [];
    for (const cat of report.categories) {
      const val = `${cat.targetPanelId}::${cat.categoryName}`;
      if (seen.has(val)) continue;
      seen.add(val);
      opts.push({
        value: val,
        label: `${cat.categoryName} (${cat.targetPanelName})`,
        panelId: cat.targetPanelId,
        panelName: cat.targetPanelName,
        categoryName: cat.categoryName,
      });
    }
    return opts;
  }, [report]);

  const locateInWorkbench = (panelId: string, searchText: string) => {
    setActivePanelId(panelId);
    setSearchQuery(searchText);
    setContainerFilter(null);
    setOnlyDuplicates(false);
    setActivePage("workbench");
    onClose();
  };

  const handleUndoApply = () => {
    if (undoStack.length === 0) return;
    undo();
    setActiveMergeReport(null);
    toast.info("已撤销本次 AI 重构应用");
    onClose();
  };

  const handleReassignItem = (item: AIMergeReportItem, destValue: string) => {
    if (!report || !rawSnapshot) return;
    let targetPanelId = item.fromPanelId;
    let targetPanelName = item.fromPanelName;
    let targetCategoryName = "保持原位";

    if (destValue !== "__reset__") {
      const found = destinationOptions.find((o) => o.value === destValue);
      if (!found) return;
      targetPanelId = found.panelId;
      targetPanelName = found.panelName;
      targetCategoryName = found.categoryName;
    }

    if (targetPanelId === item.toPanelId && targetCategoryName === item.toCategoryName) return;

    // Update rawSnapshot tab panelId
    const nextWindows = { ...rawSnapshot.windows };
    for (const [winId, win] of Object.entries(nextWindows)) {
      nextWindows[winId] = {
        ...win,
        tabs: (win.tabs || []).map((t) =>
          String(t.id) === String(item.tabId)
            ? { ...t, panelId: targetPanelId, parentId: -1, lvl: 0 }
            : t
        ),
      };
    }
    applySnapshotUpdate({ ...rawSnapshot, windows: nextWindows }, "报告内微调标签归属");

    // Recompute report items & summaries in-place
    const nextItems = report.items.map((it) =>
      String(it.tabId) === String(item.tabId)
        ? {
            ...it,
            toPanelId: targetPanelId,
            toPanelName: targetPanelName,
            toCategoryName: targetCategoryName,
          }
        : it
    );

    const catMap = new Map<
      string,
      {
        categoryName: string;
        targetPanelId: string;
        targetPanelName: string;
        tabCount: number;
        movedAcrossPanelsCount: number;
        sampleTitles: string[];
      }
    >();
    let movedCount = 0;
    let categorizedCount = 0;

    for (const it of nextItems) {
      const moved = it.fromPanelId !== it.toPanelId;
      if (moved) movedCount++;
      if (it.toCategoryName !== "保持原位") categorizedCount++;

      const key = `${it.toCategoryName}::${it.toPanelId}`;
      const existing = catMap.get(key) || {
        categoryName: it.toCategoryName,
        targetPanelId: it.toPanelId,
        targetPanelName: it.toPanelName,
        tabCount: 0,
        movedAcrossPanelsCount: 0,
        sampleTitles: [],
      };
      existing.tabCount++;
      if (moved) existing.movedAcrossPanelsCount++;
      if (existing.sampleTitles.length < 3 && it.title) {
        existing.sampleTitles.push(it.title.trim().slice(0, 40));
      }
      catMap.set(key, existing);
    }

    setActiveMergeReport({
      ...report,
      categorizedCount,
      movedAcrossPanelsCount: movedCount,
      unchangedCount: Math.max(0, nextItems.length - categorizedCount),
      categories: Array.from(catMap.values()).sort((a, b) => b.tabCount - a.tabCount),
      items: nextItems,
    });
    toast.success(`已将「${item.title.slice(0, 18)}」移至 ${targetCategoryName}`);
  };

  const handleSaveAsRule = (categoryName: string, targetPanelId: string) => {
    if (!report) return;
    const catItems = report.items.filter(
      (it) => it.toCategoryName === categoryName && it.toPanelId === targetPanelId
    );
    const domainFreq = new Map<string, number>();
    for (const it of catItems) {
      const d = (it.domain || "").toLowerCase();
      if (!d || d === "unknown" || d === "other" || d.startsWith("about:") || d.startsWith("moz-extension:")) {
        continue;
      }
      domainFreq.set(d, (domainFreq.get(d) || 0) + 1);
    }
    const topDomains = Array.from(domainFreq.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([d]) => d);

    if (topDomains.length === 0) {
      toast.warning("该分类暂无可用于生成规则的有效域名");
      return;
    }

    const newRule: Omit<CategorizationRule, "id"> = {
      name: categoryName,
      enabled: true,
      matchMode: "any",
      conditions: topDomains.map((d, idx) => ({
        id: `cond_${Date.now()}_${idx}`,
        field: "domain",
        operator: "contains",
        value: d,
      })),
      action: {
        type: "groupAndMove",
        targetPanelId,
      },
      matchDomain: topDomains.join(", "),
      matchKeyword: "",
      scope: "all",
      minThreshold: 2,
    };

    addRule(newRule);
    toast.success(`已沉淀为本地规则「${categoryName}」（含 ${topDomains.length} 个高频域名）`);
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

  const handleDownloadSnapshotJson = () => {
    if (!rawSnapshot) {
      toast.warning("当前没有可导出的快照数据");
      return;
    }
    const { uiSettings } = useConfigStore.getState();
    const jsonStr = serializeSnapshot(rawSnapshot, false, {
      resetId: uiSettings?.resetSnapshotIdOnExport,
      resetTime: uiSettings?.resetSnapshotTimeOnExport,
    });
    const blob = new Blob([jsonStr], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const baseName = (fileName || "sidebery-snapshot").replace(/\.json$/i, "");
    a.href = url;
    a.download = `${baseName}-reorganized.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("已导出重构后快照 JSON");
  };

  const toggleExpandCat = (key: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const renderItemRow = (item: AIMergeReportItem, idx: number) => (
    <div
      key={`${item.tabId}_${idx}`}
      style={{
        padding: "0.5rem 0.75rem",
        borderTop: idx === 0 ? "none" : "1px solid var(--border-subtle)",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "0.55rem",
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
            marginTop: "0.15rem",
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

      <div style={{ display: "flex", alignItems: "center", gap: "0.3rem", flexShrink: 0 }}>
        <Select
          value={`${item.toPanelId}::${item.toCategoryName}`}
          onChange={(e) => handleReassignItem(item, e.target.value)}
          style={{ fontSize: "0.68rem", padding: "0.15rem 0.4rem", maxWidth: "155px" }}
          title="改判该标签归属"
        >
          <option value="__reset__">移回原位 ({item.fromPanelName})</option>
          {destinationOptions.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </Select>

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
    </div>
  );

  return (
    <Dialog.Root open={isOpen && Boolean(report)} onOpenChange={(open) => !open && onClose()}>
      <Dialog.Backdrop style={{ zIndex: 130 }} />
      <Dialog.Positioner style={{ zIndex: 140 }}>
        {report && (
          <Dialog.Content
            style={{
              maxWidth: "900px",
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
                flexShrink: 0,
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

              <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", flexWrap: "wrap" }}>
                {undoStack.length > 0 && (
                  <Button
                    variant="outline"
                    size="xs"
                    pill
                    onClick={handleUndoApply}
                    title="撤销本次重构应用"
                    style={{ color: "#ef4444", borderColor: "rgba(239, 68, 68, 0.35)" }}
                  >
                    <Undo2 size={12} />
                    <span>撤销应用</span>
                  </Button>
                )}
                <Button variant="outline" size="xs" pill onClick={handleCopyMarkdown}>
                  <Copy size={12} />
                  <span>复制报告</span>
                </Button>
                <Button variant="outline" size="xs" pill onClick={handleDownloadMarkdown}>
                  <Download size={12} />
                  <span>导出 MD</span>
                </Button>
                <Button variant="solid" size="xs" pill onClick={handleDownloadSnapshotJson}>
                  <Download size={12} />
                  <span>导出 JSON</span>
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
                gap: "0.85rem",
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
                      padding: "0.55rem 0.75rem",
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

              {/* Panel Flow Strip */}
              {flowSummaries.length > 0 && (
                <div>
                  <div style={{ fontSize: "0.73rem", fontWeight: 600, color: "var(--text-muted)", marginBottom: "0.35rem" }}>
                    面板流向（点击筛选）：
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "0.35rem" }}>
                    {flowSummaries.slice(0, 12).map((fl) => {
                      const active = selectedFlow === fl.key;
                      return (
                        <button
                          key={fl.key}
                          type="button"
                          onClick={() => setSelectedFlow(active ? null : fl.key)}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "0.3rem",
                            padding: "0.24rem 0.6rem",
                            borderRadius: "9999px",
                            border: "1px solid",
                            borderColor: active ? "var(--accent-solid)" : "var(--border-subtle)",
                            backgroundColor: active ? "var(--accent-subtle)" : "var(--bg-surface)",
                            color: active ? "var(--accent-text)" : "var(--text-main)",
                            fontSize: "0.71rem",
                            fontWeight: active ? 600 : 400,
                            cursor: "pointer",
                          }}
                        >
                          <span>{fl.fromPanelName}</span>
                          <ArrowRight size={11} />
                          <span>{fl.toPanelName}</span>
                          <span style={{ opacity: 0.75 }}>({fl.count})</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search + View Mode Switcher */}
              <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", flexWrap: "wrap" }}>
                <div style={{ position: "relative", flex: 1, minWidth: "200px" }}>
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
                    placeholder="搜索标签标题、域名或目标分类..."
                    style={{ paddingLeft: "2rem", fontSize: "0.78rem" }}
                  />
                </div>

                {selectedCategory && (
                  <Button
                    variant="outline"
                    size="xs"
                    pill
                    onClick={() => setSelectedCategory(null)}
                    style={{ fontSize: "0.7rem" }}
                  >
                    分类: {selectedCategory} ×
                  </Button>
                )}

                <label style={{ display: "inline-flex", alignItems: "center", gap: "0.35rem", fontSize: "0.73rem", cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={onlyMoved}
                    onChange={(e) => setOnlyMoved(e.target.checked)}
                    style={{ accentColor: "var(--accent-solid)", cursor: "pointer" }}
                  />
                  <span>仅看跨面板</span>
                </label>

                <div style={{ display: "inline-flex", gap: "0.25rem" }}>
                  <Button
                    variant={viewMode === "grouped" ? "solid" : "outline"}
                    size="xs"
                    pill
                    onClick={() => setViewMode("grouped")}
                  >
                    <Layers size={12} />
                    <span>按分类折叠</span>
                  </Button>
                  <Button
                    variant={viewMode === "flat" ? "solid" : "outline"}
                    size="xs"
                    pill
                    onClick={() => setViewMode("flat")}
                  >
                    <List size={12} />
                    <span>全部明细</span>
                  </Button>
                </div>
              </div>

              {/* Grouped Collapsible View vs Flat View */}
              {viewMode === "grouped" ? (
                groupedSections.length === 0 ? (
                  <div style={{ padding: "1.5rem", textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                    没有匹配的标签记录
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.55rem" }}>
                    {groupedSections.map(({ key, cat, items }) => {
                      const isExpanded = expandedCats.has(key) || Boolean(query.trim());
                      return (
                        <div
                          key={key}
                          style={{
                            borderRadius: "0.75rem",
                            border: "1px solid var(--border-subtle)",
                            backgroundColor: "var(--bg-surface)",
                            overflow: "hidden",
                          }}
                        >
                          <div
                            onClick={() => toggleExpandCat(key)}
                            style={{
                              padding: "0.55rem 0.8rem",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "0.5rem",
                              cursor: "pointer",
                              backgroundColor: isExpanded ? "var(--bg-card)" : "transparent",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "0.45rem", minWidth: 0 }}>
                              {isExpanded ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
                              <span style={{ fontSize: "0.82rem", fontWeight: 600, color: "var(--text-main)" }}>
                                {cat.categoryName}
                              </span>
                              <span style={{ fontSize: "0.72rem", color: "var(--text-muted)" }}>
                                → {cat.targetPanelName}
                              </span>
                              <Badge variant="subtle" size="sm" style={{ fontSize: "0.66rem" }}>
                                {items.length}
                              </Badge>
                              {cat.movedAcrossPanelsCount > 0 && (
                                <Badge variant="outline" size="sm" style={{ fontSize: "0.64rem", color: "var(--accent-text)" }}>
                                  跨面板 {cat.movedAcrossPanelsCount}
                                </Badge>
                              )}
                            </div>

                            {cat.categoryName !== "保持原位" && (
                              <Button
                                variant="outline"
                                size="xs"
                                pill
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleSaveAsRule(cat.categoryName, cat.targetPanelId);
                                }}
                                title="将该分类高频域名沉淀为本地自动规则"
                                style={{ fontSize: "0.69rem", flexShrink: 0 }}
                              >
                                <BookmarkPlus size={12} />
                                <span>存为规则</span>
                              </Button>
                            )}
                          </div>

                          {isExpanded && (
                            <div style={{ borderTop: "1px solid var(--border-subtle)" }}>
                              {items.slice(0, 80).map((it, idx) => renderItemRow(it, idx))}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )
              ) : (
                <div
                  style={{
                    borderRadius: "0.75rem",
                    border: "1px solid var(--border-subtle)",
                    backgroundColor: "var(--bg-surface)",
                    overflow: "hidden",
                    flexShrink: 0,
                  }}
                >
                  {filteredItems.length === 0 ? (
                    <div style={{ padding: "1.5rem", textAlign: "center", fontSize: "0.78rem", color: "var(--text-muted)" }}>
                      没有匹配的标签记录
                    </div>
                  ) : (
                    filteredItems.slice(0, 120).map((item, idx) => renderItemRow(item, idx))
                  )}
                </div>
              )}
            </div>

            {/* Footer */}
            <div
              style={{
                padding: "0.75rem 1.2rem",
                borderTop: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-surface)",
                display: "flex",
                justifyContent: "flex-end",
                flexShrink: 0,
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
