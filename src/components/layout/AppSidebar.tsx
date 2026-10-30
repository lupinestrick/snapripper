"use client";

import React, { useState, useEffect } from "react";
import { useConfigStore, AppPage } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { OverviewHopup } from "./OverviewHopup";
import { Button } from "@/components/ui/button";
import {
  Layers,
  Sparkles,
  SlidersHorizontal,
  Bot,
  Settings,
  BarChart2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";

export function AppSidebar() {
  const { activePage, setActivePage } = useConfigStore();
  const { rawSnapshot } = useSnapshotStore();
  const [overviewOpen, setOverviewOpen] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive screen DPI / width listener
  useEffect(() => {
    const handleResize = () => {
      const w = window.innerWidth;
      if (w < 768) {
        setIsMobile(true);
      } else if (w < 1100) {
        setIsMobile(false);
        setIsCompact(true);
      } else {
        setIsMobile(false);
        setIsCompact(false);
      }
    };

    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  const totalTabs = rawSnapshot
    ? Object.values(rawSnapshot.windows).reduce((acc, w) => acc + (w.tabs?.length || 0), 0)
    : 0;

  const panelCount = rawSnapshot?.panels ? Object.keys(rawSnapshot.panels).length : 0;

  const navItems: { page: AppPage; label: string; icon: React.ReactNode }[] = [
    { page: "workbench", label: "工作台", icon: <Layers size={17} /> },
    { page: "process", label: "处理中心", icon: <Sparkles size={17} /> },
    { page: "rules", label: "规则管理", icon: <SlidersHorizontal size={17} /> },
    { page: "ai", label: "AI 比例", icon: <Bot size={17} /> },
    { page: "settings", label: "系统设置", icon: <Settings size={17} /> },
  ];

  // Mobile Bottom Bar Navigation
  if (isMobile) {
    return (
      <>
        <div
          style={{
            position: "fixed",
            bottom: 0,
            left: 0,
            right: 0,
            height: "56px",
            backgroundColor: "var(--bg-surface)",
            borderTop: "1px solid var(--border-subtle)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-around",
            zIndex: 90,
            padding: "0 0.5rem",
          }}
        >
          {navItems.map((item) => {
            const isActive = activePage === item.page;
            return (
              <Button
                key={item.page}
                variant={isActive ? "solid" : "ghost"}
                size="xs"
                onClick={() => setActivePage(item.page)}
                style={{
                  flexDirection: "column",
                  gap: "2px",
                  padding: "4px 8px",
                  fontSize: "0.68rem",
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </Button>
            );
          })}
          <Button
            size="xs"
            variant="ghost"
            onClick={() => setOverviewOpen(true)}
            style={{
              padding: "4px 8px",
              gap: "4px",
              fontSize: "0.68rem",
              color: "var(--accent-text)",
            }}
          >
            <BarChart2 size={13} />
            <span>{totalTabs}</span>
          </Button>
        </div>
        <OverviewHopup isOpen={overviewOpen} onClose={() => setOverviewOpen(false)} />
      </>
    );
  }

  // Desktop / Tablet Sidebar
  return (
    <>
      <aside
        style={{
          width: isCompact ? "64px" : "210px",
          transition: "width 0.2s cubic-bezier(0.4, 0, 0.2, 1)",
          backgroundColor: "var(--bg-surface)",
          borderRight: "1px solid var(--border-subtle)",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          userSelect: "none",
          position: "relative",
          zIndex: 40,
        }}
      >

        {/* Nav Items */}
        <nav style={{ padding: "0.75rem 0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1 }}>
          {navItems.map((item) => {
            const isActive = activePage === item.page;
            return (
              <Button
                key={item.page}
                variant={isActive ? "solid" : "ghost"}
                onClick={() => setActivePage(item.page)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isCompact ? "center" : "flex-start",
                  gap: "0.65rem",
                  padding: isCompact ? "0.55rem 0" : "0.5rem 0.75rem",
                  fontSize: "0.825rem",
                  width: "100%",
                  color: isActive ? "var(--accent-fg, #ffffff)" : "var(--text-muted)",
                }}
                title={isCompact ? item.label : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "18px" }}>
                  {item.icon}
                </div>
                {!isCompact && <span>{item.label}</span>}
              </Button>
            );
          })}
        </nav>

        {/* Sidebar Footer: Collapse Toggle & Summary Card */}
        {!isCompact ? (
          <div
            style={{
              padding: "0.5rem 0.6rem 0.75rem",
              display: "flex",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            {/* Circular Collapse Button (on the left of Snapshot Overview) */}
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsCompact(true)}
              style={{
                width: "32px",
                height: "32px",
                minWidth: "32px",
                padding: 0,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-subtle)",
                flexShrink: 0,
              }}
              title="折叠侧边栏"
            >
              <ChevronLeft size={15} />
            </Button>

            {/* Snapshot Overview Button (slightly shrunk to fit beside the circle button) */}
            {rawSnapshot && (
              <Button
                variant="outline"
                onClick={() => setOverviewOpen(true)}
                style={{
                  flex: 1,
                  padding: "0.4rem 0.55rem",
                  borderRadius: "0.65rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: "0.2rem",
                  textAlign: "left",
                  backgroundColor: "var(--bg-subtle)",
                  borderColor: "var(--border-subtle)",
                  minWidth: 0,
                }}
                title="查看概览数据"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", fontWeight: 600 }}>快照概览</span>
                  <BarChart2 size={12} style={{ color: "var(--accent)" }} />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem", overflow: "hidden" }}>
                  <span style={{ fontSize: "1.05rem", fontWeight: 700, color: "var(--text-main)", lineHeight: 1.1 }}>
                    {totalTabs}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "var(--text-muted)", whiteSpace: "nowrap" }}>
                    标签 / {panelCount} 面板
                  </span>
                </div>
              </Button>
            )}
          </div>
        ) : (
          <div
            style={{
              padding: "0.5rem 0.4rem 0.75rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.45rem",
            }}
          >
            {rawSnapshot && (
              <Button
                variant="outline"
                onClick={() => setOverviewOpen(true)}
                style={{
                  width: "100%",
                  padding: "0.45rem 0",
                  flexDirection: "column",
                  gap: "2px",
                  backgroundColor: "var(--bg-subtle)",
                  borderColor: "var(--border-subtle)",
                  borderRadius: "0.5rem",
                }}
                title="查看概览数据"
              >
                <BarChart2 size={14} style={{ color: "var(--accent)" }} />
                <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--text-main)" }}>{totalTabs}</span>
              </Button>
            )}

            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsCompact(false)}
              style={{
                width: "32px",
                height: "32px",
                minWidth: "32px",
                padding: 0,
                borderRadius: "50%",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
                backgroundColor: "var(--bg-subtle)",
              }}
              title="展开侧边栏"
            >
              <ChevronRight size={15} />
            </Button>
          </div>
        )}
      </aside>

      <OverviewHopup isOpen={overviewOpen} onClose={() => setOverviewOpen(false)} />
    </>
  );
}
