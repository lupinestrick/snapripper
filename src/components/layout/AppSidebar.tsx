"use client";

import React, { useState, useEffect, useMemo } from "react";
import { useConfigStore, AppPage } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { flattenTabTree } from "@/services/snapshotParser";
import { computeSnapshotComposition } from "@/services/snapshotDataService";
import { extractDomain } from "@/utils/urlHelper";
import { SnapshotFileHopupModal } from "./SnapshotFileHopupModal";
import { Button } from "@/components/ui/button";
import {
  Layers,
  Sparkles,
  SlidersHorizontal,
  Bot,
  Settings,
  ArrowLeft,
  ArrowRight,
  ChevronRight,
  ChevronsUpDown,
  FileText,
  Menu,
  LayoutList,
  History,
  Edit3,
  Check,
  Trash2,
} from "lucide-react";

/**
 * 窄屏 / 低 DPI 模式下放在各页面顶栏最左侧的抽屉导航触发按钮。
 */
export function SidebarDrawerTrigger() {
  const { isMobileViewport, setMobileDrawerOpen } = useConfigStore();
  if (!isMobileViewport) return null;

  return (
    <Button
      type="button"
      variant="ghost"
      size="xs"
      pill
      onClick={() => setMobileDrawerOpen(true)}
      title="打开导航栏"
      style={{ color: "var(--text-main)", padding: "0.35rem", flexShrink: 0 }}
    >
      <Menu size={16} />
    </Button>
  );
}

export function AppSidebar() {
  const {
    activePage,
    setActivePage,
    uiSettings,
    setSidebarCollapsed,
    setIsMobileViewport,
    mobileDrawerOpen,
    setMobileDrawerOpen,
  } = useConfigStore();
  const {
    rawSnapshot,
    rootNodes,
    fileName,
    duplicateUrls,
    panelFilter,
    setActivePanelId,
    aiChatSessions,
    activeChatSessionId,
    selectAiChatSession,
    renameAiChatSession,
    deleteAiChatSession,
    setIsOverviewHopupOpen,
  } = useSnapshotStore();
  const [isCompact, setIsCompact] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [overviewHovered, setOverviewHovered] = useState(false);
  const [selectorHovered, setSelectorHovered] = useState(false);
  const [snapshotFileModalOpen, setSnapshotFileModalOpen] = useState(false);
  const [editingSessionId, setEditingSessionId] = useState<string | null>(null);
  const [editingTitleValue, setEditingTitleValue] = useState("");

  // Responsive screen DPI / width listener
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) {
        setIsMobile(true);
        setIsMobileViewport(true);
        setIsCompact(false);
      } else {
        setIsMobile(false);
        setIsMobileViewport(false);
        setMobileDrawerOpen(false);
        setIsCompact(w < 1100);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [setIsMobileViewport, setMobileDrawerOpen]);

  useEffect(() => {
    setSidebarCollapsed(isMobile || isCompact);
  }, [isMobile, isCompact, setSidebarCollapsed]);

  useEffect(() => {
    if (!isMobile || !mobileDrawerOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setMobileDrawerOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isMobile, mobileDrawerOpen, setMobileDrawerOpen]);

  const allTabs = useMemo(
    () => (rawSnapshot ? flattenTabTree(rootNodes) : []),
    [rawSnapshot, rootNodes]
  );

  const totalTabs = allTabs.length;
  const panelCount = rawSnapshot?.panels ? Object.keys(rawSnapshot.panels).length : 0;
  const domainCount = useMemo(() => {
    const domains = new Set<string>();
    for (const t of allTabs) {
      const domain = extractDomain(t.url);
      if (domain) domains.add(domain);
    }
    return domains.size;
  }, [allTabs]);
  const composition = useMemo(
    () => computeSnapshotComposition(allTabs, duplicateUrls),
    [allTabs, duplicateUrls]
  );
  const duplicateCount = composition.duplicateTabCount;

  const isSidebarPanelMode =
    (uiSettings?.workbenchPanelLayout || "sidebar") === "sidebar" && activePage === "workbench";
  const isSidebarChatHistoryMode =
    (uiSettings?.aiChatHistoryLayout || "sidebar") === "sidebar" && activePage === "ai";

  const panelEntries = useMemo(() => {
    if (!isSidebarPanelMode || !rawSnapshot?.panels) return [];
    const counts = new Map<string, number>();
    for (const t of allTabs) {
      const pId = t.panelId || "main";
      counts.set(pId, (counts.get(pId) || 0) + 1);
    }

    const list = Object.values(rawSnapshot.panels).map((p: any) => ({
      id: p.id,
      name: p.name || p.id,
      count: counts.get(p.id) || 0,
    }));

    return uiSettings?.hideEmptyPanels
      ? list.filter((p) => p.count > 0)
      : list;
  }, [isSidebarPanelMode, rawSnapshot?.panels, allTabs, uiSettings?.hideEmptyPanels]);

  const handleSelectSidebarPanel = (panelId: string | null) => {
    setActivePanelId(panelId);
    if (activePage !== "workbench") {
      setActivePage("workbench");
    }
  };

  const navItems: { page: AppPage; label: string; icon: React.ReactNode }[] = [
    { page: "workbench", label: "工作台", icon: <Layers size={17} /> },
    { page: "process", label: "处理中心", icon: <Sparkles size={17} /> },
    { page: "rules", label: "规则管理", icon: <SlidersHorizontal size={17} /> },
    { page: "ai", label: "AI 架构师", icon: <Bot size={17} /> },
    { page: "settings", label: "系统设置", icon: <Settings size={17} /> },
  ];

  const effectiveCompact = !isMobile && isCompact;

  const sidebarElement = (
      <aside
        className={isMobile ? "sr-drawer-panel" : undefined}
        style={{
          width: effectiveCompact ? "64px" : isMobile ? "224px" : "210px",
          transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          backgroundColor: "var(--bg-surface)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          userSelect: "none",
          ...(isMobile
            ? {
                position: "fixed",
                top: 0,
                bottom: 0,
                left: 0,
                zIndex: 100,
                boxShadow: "8px 0 28px rgba(0, 0, 0, 0.28)",
              }
            : {
                position: "relative",
                zIndex: 40,
              }),
        }}
      >

        {/* Nav Items */}
        <nav
          style={{
            padding: "0.75rem 0.5rem",
            display: "flex",
            flexDirection: "column",
            gap: "0.35rem",
            flex: 1,
            minHeight: 0,
            overflow: "hidden",
          }}
        >
          {navItems.map((item) => {
            const isActive = activePage === item.page;
            return (
              <Button
                key={item.page}
                variant={isActive ? "solid" : "ghost"}
                onClick={() => {
                  setActivePage(item.page);
                  if (isMobile) setMobileDrawerOpen(false);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: effectiveCompact ? "center" : "flex-start",
                  gap: "0.65rem",
                  padding: effectiveCompact ? "0.55rem 0" : "0.5rem 0.75rem",
                  fontSize: "0.825rem",
                  width: "100%",
                  color: isActive ? "var(--accent-fg, #ffffff)" : "var(--text-muted)",
                  flexShrink: 0,
                }}
                title={effectiveCompact ? item.label : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "18px" }}>
                  {item.icon}
                </div>
                {!effectiveCompact && <span>{item.label}</span>}
              </Button>
            );
          })}

          {/* Inserted Panel List below System Settings (when workbenchPanelLayout === "sidebar") */}
          {isSidebarPanelMode && !effectiveCompact && !isMobile && (
            <>
              <div
                style={{
                  marginTop: "0.35rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid var(--border-subtle)",
                  paddingLeft: isCompact ? 0 : "0.75rem",
                  paddingRight: isCompact ? 0 : "0.5rem",
                  paddingBottom: "0.15rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isCompact ? "center" : "flex-start",
                  gap: "0.65rem",
                  color: "var(--text-muted)",
                  fontSize: "0.825rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
                title={isCompact ? "面板" : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "18px" }}>
                  <LayoutList size={17} />
                </div>
                {!isCompact && <span>面板</span>}
              </div>

              {!isCompact && (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.2rem",
                    padding: "0.15rem 0.1rem",
                  }}
                >
                  {!rawSnapshot || panelEntries.length === 0 ? (
                    <div
                      style={{
                        padding: "0.65rem 0.5rem",
                        fontSize: "0.74rem",
                        color: "var(--text-muted)",
                        textAlign: "center",
                      }}
                    >
                      暂无已加载面板
                    </div>
                  ) : (
                    <>
                      <div
                        onClick={() => handleSelectSidebarPanel(null)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "0.35rem",
                          padding: "0.4rem 0.5rem",
                          borderRadius: "0.5rem",
                          backgroundColor: panelFilter === null ? "var(--accent-subtle)" : "transparent",
                          color: panelFilter === null ? "var(--accent-text)" : "var(--text-main)",
                          fontWeight: panelFilter === null ? 600 : 400,
                          cursor: "pointer",
                          fontSize: "0.76rem",
                          transition: "background-color 0.12s ease",
                        }}
                      >
                        <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          全部标签
                        </span>
                        <span style={{ fontSize: "0.7rem", color: panelFilter === null ? "var(--accent-text)" : "var(--text-muted)", flexShrink: 0 }}>
                          {allTabs.length}
                        </span>
                      </div>

                      {panelEntries.map((panel) => {
                        const isActive = panelFilter === panel.id;
                        return (
                          <div
                            key={panel.id}
                            onClick={() => handleSelectSidebarPanel(panel.id)}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "0.35rem",
                              padding: "0.4rem 0.5rem",
                              borderRadius: "0.5rem",
                              backgroundColor: isActive ? "var(--accent-subtle)" : "transparent",
                              color: isActive ? "var(--accent-text)" : "var(--text-main)",
                              fontWeight: isActive ? 600 : 400,
                              cursor: "pointer",
                              fontSize: "0.76rem",
                              transition: "background-color 0.12s ease",
                            }}
                            title={`${panel.name} (${panel.count})`}
                          >
                            <span style={{ flex: 1, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {panel.name}
                            </span>
                            <span style={{ fontSize: "0.7rem", color: isActive ? "var(--accent-text)" : "var(--text-muted)", flexShrink: 0 }}>
                              {panel.count}
                            </span>
                          </div>
                        );
                      })}
                    </>
                  )}
                </div>
              )}
            </>
          )}

          {/* Inserted AI Chat History below System Settings (when aiChatHistoryLayout === "sidebar" on AI page) */}
          {isSidebarChatHistoryMode && !effectiveCompact && !isMobile && (
            <>
              <div
                style={{
                  marginTop: "0.35rem",
                  paddingTop: "0.5rem",
                  borderTop: "1px solid var(--border-subtle)",
                  paddingLeft: isCompact ? 0 : "0.75rem",
                  paddingRight: isCompact ? 0 : "0.5rem",
                  paddingBottom: "0.15rem",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isCompact ? "center" : "flex-start",
                  gap: "0.65rem",
                  color: "var(--text-muted)",
                  fontSize: "0.825rem",
                  fontWeight: 600,
                  flexShrink: 0,
                }}
                title={isCompact ? "对话历史" : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "18px" }}>
                  <History size={17} />
                </div>
                {!isCompact && <span>对话历史</span>}
              </div>

              {!isCompact && (
                <div
                  style={{
                    flex: 1,
                    minHeight: 0,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.2rem",
                    padding: "0.15rem 0.1rem",
                  }}
                >
                  {!aiChatSessions || aiChatSessions.length === 0 ? (
                    <div
                      style={{
                        padding: "0.65rem 0.5rem",
                        fontSize: "0.74rem",
                        color: "var(--text-muted)",
                        textAlign: "center",
                      }}
                    >
                      暂无历史对话
                    </div>
                  ) : (
                    aiChatSessions.map((session) => {
                      const isActive = session.id === activeChatSessionId;
                      const isEditing = editingSessionId === session.id;
                      return (
                        <div
                          key={session.id}
                          onClick={() => {
                            if (!isEditing) {
                              selectAiChatSession(session.id);
                            }
                          }}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            gap: "0.3rem",
                            padding: "0.4rem 0.5rem",
                            borderRadius: "0.5rem",
                            backgroundColor: isActive ? "var(--accent-subtle)" : "transparent",
                            color: isActive ? "var(--accent-text)" : "var(--text-main)",
                            cursor: isEditing ? "default" : "pointer",
                            fontSize: "0.76rem",
                            transition: "background-color 0.12s ease",
                          }}
                        >
                          {isEditing ? (
                            <input
                              type="text"
                              autoFocus
                              value={editingTitleValue}
                              onClick={(e) => e.stopPropagation()}
                              onChange={(e) => setEditingTitleValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  renameAiChatSession(session.id, editingTitleValue);
                                  setEditingSessionId(null);
                                } else if (e.key === "Escape") {
                                  setEditingSessionId(null);
                                }
                              }}
                              style={{
                                flex: 1,
                                minWidth: 0,
                                padding: "2px 6px",
                                borderRadius: "4px",
                                border: "1px solid var(--accent-border)",
                                backgroundColor: "var(--bg-card)",
                                color: "var(--text-main)",
                                fontSize: "0.74rem",
                                outline: "none",
                              }}
                            />
                          ) : (
                            <span
                              style={{
                                flex: 1,
                                minWidth: 0,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                                fontWeight: isActive ? 600 : 400,
                              }}
                              title={session.title}
                            >
                              {session.title}
                            </span>
                          )}

                          <div
                            style={{ display: "flex", alignItems: "center", gap: "0.1rem", flexShrink: 0 }}
                            onClick={(e) => e.stopPropagation()}
                          >
                            {isEditing ? (
                              <button
                                type="button"
                                onClick={() => {
                                  renameAiChatSession(session.id, editingTitleValue);
                                  setEditingSessionId(null);
                                }}
                                title="保存名称"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--success)",
                                  cursor: "pointer",
                                  padding: "2px",
                                }}
                              >
                                <Check size={12} />
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingSessionId(session.id);
                                  setEditingTitleValue(session.title);
                                }}
                                title="编辑名称"
                                style={{
                                  background: "transparent",
                                  border: "none",
                                  color: "var(--text-muted)",
                                  cursor: "pointer",
                                  padding: "2px",
                                }}
                              >
                                <Edit3 size={11} />
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => deleteAiChatSession(session.id)}
                              title="删除对话"
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "var(--text-muted)",
                                cursor: "pointer",
                                padding: "2px",
                              }}
                            >
                              <Trash2 size={11} />
                            </button>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}
            </>
          )}
        </nav>

        {/* Sidebar Footer: Option A Card + Bottom Collapse Control + File Pill */}
        {!effectiveCompact ? (
          <div
            style={{
              padding: "0.55rem 0.65rem 0.7rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.45rem",
            }}
          >
            {/* 1. Option A Hero + Segmented Composition Overview Card */}
            {!uiSettings?.hideSidebarOverviewCard && (
              <button
                type="button"
                onClick={() => {
                  if (isMobile) setMobileDrawerOpen(false);
                  setIsOverviewHopupOpen(true);
                }}
                onMouseEnter={() => setOverviewHovered(true)}
                onMouseLeave={() => setOverviewHovered(false)}
                title={
                  rawSnapshot
                    ? `点击查看快照多维分析 (已成组 ${composition.groupedCount} · 散落 ${composition.looseCount} · 重复 ${composition.duplicateTabCount} · 豁免 ${composition.exemptCount})`
                    : "点击查看快照多维分析"
                }
                style={{
                  width: "100%",
                  padding: "0.65rem 0.72rem",
                  borderRadius: "0.8rem",
                  border: rawSnapshot
                    ? `1px solid ${overviewHovered ? "var(--accent-border)" : "var(--border-subtle)"}`
                    : `1px dashed ${overviewHovered ? "var(--accent-border)" : "var(--border-card)"}`,
                  backgroundColor: overviewHovered ? "var(--bg-card)" : "var(--bg-subtle)",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: "0.38rem",
                  textAlign: "left",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease, background-color 0.15s ease",
                }}
              >
                {rawSnapshot ? (
                  <>
                    {/* Row 1: Hero Total + Analyze Prompt */}
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", gap: "0.35rem" }}>
                      <div style={{ display: "flex", alignItems: "baseline", gap: "0.26rem", minWidth: 0 }}>
                        <span
                          style={{
                            fontSize: "1.12rem",
                            fontWeight: 700,
                            color: "var(--text-main)",
                            lineHeight: 1.1,
                            fontVariantNumeric: "tabular-nums",
                          }}
                        >
                          {totalTabs}
                        </span>
                        <span style={{ fontSize: "0.7rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                          标签
                        </span>
                      </div>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "1px",
                          fontSize: "0.68rem",
                          fontWeight: 500,
                          color: overviewHovered ? "var(--accent)" : "var(--text-muted)",
                          whiteSpace: "nowrap",
                          transition: "color 0.15s ease",
                        }}
                      >
                        <ChevronRight size={12} />
                      </span>
                    </div>

                    {/* Row 2: Secondary Scale Summary */}
                    <div
                      style={{
                        fontSize: "0.67rem",
                        color: "var(--text-muted)",
                        lineHeight: 1.2,
                        fontVariantNumeric: "tabular-nums",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                      }}
                    >
                      {panelCount} 面板 · {domainCount} 域名
                    </div>

                    {/* Row 3: 4px Segmented Structure Bar */}
                    <div
                      style={{
                        width: "100%",
                        height: "4px",
                        borderRadius: "9999px",
                        backgroundColor: "var(--border-subtle)",
                        overflow: "hidden",
                        display: "flex",
                        gap: "1px",
                        marginTop: "0.06rem",
                      }}
                    >
                      {[
                        { key: "grouped", count: composition.groupedCount, color: "var(--accent-solid)" },
                        { key: "loose", count: composition.looseCount, color: "var(--border-card)" },
                        { key: "duplicate", count: composition.duplicateTabCount, color: "#f59e0b" },
                        { key: "exempt", count: composition.exemptCount, color: "#10b981" },
                      ]
                        .filter((seg) => seg.count > 0)
                        .map((seg) => (
                          <div
                            key={seg.key}
                            style={{
                              flexGrow: seg.count,
                              flexBasis: 0,
                              height: "100%",
                              backgroundColor: seg.color,
                              transition: "flex-grow 320ms cubic-bezier(0.22, 1, 0.36, 1), background-color 200ms ease",
                            }}
                          />
                        ))}
                    </div>

                    {/* Row 4: Grouped vs Duplicate Focus Pair */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "0.35rem",
                        fontSize: "0.67rem",
                        fontVariantNumeric: "tabular-nums",
                      }}
                    >
                      <span style={{ color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                        已组 {composition.groupedCount}
                      </span>
                      <span
                        style={{
                          fontWeight: 500,
                          color: duplicateCount > 0 ? "#d97706" : "#059669",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {duplicateCount > 0 ? `重复 ${duplicateCount}` : "无重复"}
                      </span>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "0.35rem" }}>
                      <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "var(--text-main)" }}>
                        快照分析
                      </span>
                      <ChevronRight
                        size={13}
                        style={{ color: overviewHovered ? "var(--accent)" : "var(--text-muted)" }}
                      />
                    </div>
                    <div style={{ fontSize: "0.67rem", color: "var(--text-muted)" }}>
                      暂无快照 · 点击查看详情
                    </div>
                    <div
                      style={{
                        width: "100%",
                        height: "4px",
                        borderRadius: "9999px",
                        backgroundColor: "var(--border-subtle)",
                      }}
                    />
                  </>
                )}
              </button>
            )}

            {/* 2. Bottom Row: Circular Collapse Button + Snapshot File Selector Pill */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.45rem",
                paddingTop: "0.08rem",
                minWidth: 0,
              }}
            >
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  if (isMobile) {
                    setMobileDrawerOpen(false);
                  } else {
                    setIsCompact(true);
                  }
                }}
                style={{
                  width: "30px",
                  height: "30px",
                  minWidth: "30px",
                  padding: 0,
                  borderRadius: "50%",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "var(--text-main)",
                  border: "1px solid var(--border-subtle)",
                  backgroundColor: "var(--bg-subtle)",
                  flexShrink: 0,
                }}
                title={isMobile ? "关闭导航抽屉" : "收起导航栏"}
              >
                <ArrowLeft size={14} />
              </Button>

              <button
                type="button"
                onClick={() => {
                  if (isMobile) setMobileDrawerOpen(false);
                  setSnapshotFileModalOpen(true);
                }}
                onMouseEnter={() => setSelectorHovered(true)}
                onMouseLeave={() => setSelectorHovered(false)}
                title={rawSnapshot ? `管理或切换快照 (${fileName || "未命名快照"})` : "导入或粘贴快照"}
                style={{
                  flex: 1,
                  minWidth: 0,
                  padding: "0.42rem 0.6rem",
                  borderRadius: "0.7rem",
                  border: `1px solid ${selectorHovered ? "var(--accent-border)" : "var(--border-subtle)"}`,
                  backgroundColor: selectorHovered ? "var(--bg-card)" : "var(--bg-subtle)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "0.4rem",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease, background-color 0.15s ease",
                }}
              >
                <span
                  style={{
                    flex: 1,
                    minWidth: 0,
                    fontSize: "0.75rem",
                    fontWeight: 500,
                    color: rawSnapshot ? "var(--text-main)" : "var(--text-muted)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    textAlign: "left",
                  }}
                >
                  {rawSnapshot ? fileName || "已加载快照" : "导入 / 切换快照"}
                </span>
                <ChevronsUpDown size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
              </button>
            </div>
          </div>
        ) : (
          <div
            style={{
              padding: "0.5rem 0.4rem 0.75rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.5rem",
            }}
          >
            <Button
              variant="outline"
              size="xs"
              onClick={() => setSnapshotFileModalOpen(true)}
              style={{
                position: "relative",
                width: "34px",
                height: "34px",
                minWidth: "34px",
                padding: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                backgroundColor: "var(--bg-subtle)",
                borderColor: "var(--border-subtle)",
                borderRadius: "0.6rem",
                color: rawSnapshot ? "var(--accent)" : "var(--text-muted)",
              }}
              title={rawSnapshot ? `快照文件与数据中心 (${fileName || "已加载快照"})` : "快照文件与数据中心"}
            >
              {rawSnapshot && (
                <span
                  style={{
                    position: "absolute",
                    top: "4px",
                    right: "4px",
                    width: "5px",
                    height: "5px",
                    borderRadius: "50%",
                    backgroundColor: duplicateCount > 0 ? "#d97706" : "#3b9b74",
                  }}
                />
              )}
              <FileText size={15} />
            </Button>

            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsCompact(false)}
              style={{
                width: "30px",
                height: "30px",
                minWidth: "30px",
                padding: 0,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-main)",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-subtle)",
              }}
              title="展开导航栏"
            >
              <ArrowRight size={14} />
            </Button>
          </div>
        )}
      </aside>
  );

  return (
    <>
      {isMobile ? (
        mobileDrawerOpen && (
          <>
            <div
              className="sr-drawer-backdrop"
              onClick={() => setMobileDrawerOpen(false)}
              style={{
                position: "fixed",
                inset: 0,
                backgroundColor: "rgba(0, 0, 0, 0.45)",
                backdropFilter: "blur(2px)",
                zIndex: 95,
              }}
            />
            {sidebarElement}
          </>
        )
      ) : (
        sidebarElement
      )}

      <SnapshotFileHopupModal
        isOpen={snapshotFileModalOpen}
        onClose={() => setSnapshotFileModalOpen(false)}
      />
    </>
  );
}
