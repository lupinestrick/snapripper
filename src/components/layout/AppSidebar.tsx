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
            backgroundColor: "#111827",
            borderTop: "1px solid #1e293b",
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
                  backgroundColor: isActive ? "#2563eb" : "transparent",
                  color: isActive ? "#ffffff" : "#94a3b8",
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </Button>
            );
          })}
          <Button
            size="xs"
            onClick={() => setOverviewOpen(true)}
            style={{
              padding: "4px 8px",
              gap: "4px",
              fontSize: "0.68rem",
              color: "#38bdf8",
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
          backgroundColor: "#0f172a",
          borderRight: "1px solid #1e293b",
          display: "flex",
          flexDirection: "column",
          flexShrink: 0,
          userSelect: "none",
          position: "relative",
          zIndex: 40,
        }}
      >
        {/* Brand / Logo */}
        <div
          style={{
            height: "56px",
            padding: isCompact ? "0" : "0 1rem",
            display: "flex",
            alignItems: "center",
            justifyContent: isCompact ? "center" : "space-between",
            borderBottom: "1px solid #1e293b",
          }}
        >
          {!isCompact ? (
            <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
              <div
                style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "9999px",
                  backgroundColor: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.8rem",
                }}
              >
                S
              </div>
              <span style={{ fontSize: "0.925rem", fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.02em" }}>
                SnapRipper
              </span>
            </div>
          ) : (
            <div
              style={{
                width: "26px",
                height: "26px",
                borderRadius: "9999px",
                backgroundColor: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.8rem",
              }}
            >
              S
            </div>
          )}

          {/* Compact Toggle Button */}
          {!isCompact && (
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsCompact(true)}
              style={{
                width: "24px",
                height: "24px",
                padding: 0,
                color: "#94a3b8",
              }}
              title="折叠侧边栏"
            >
              <ChevronLeft size={14} />
            </Button>
          )}
        </div>

        {/* Compact expand toggle button if isCompact */}
        {isCompact && (
          <div style={{ display: "flex", justifyContent: "center", padding: "0.5rem 0" }}>
            <Button
              variant="ghost"
              size="xs"
              onClick={() => setIsCompact(false)}
              style={{
                width: "28px",
                height: "28px",
                padding: 0,
                color: "#94a3b8",
              }}
              title="展开侧边栏"
            >
              <ChevronRight size={14} />
            </Button>
          </div>
        )}

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
                  backgroundColor: isActive ? "#1e293b" : "transparent",
                  borderColor: isActive ? "#334155" : "transparent",
                  color: isActive ? "#38bdf8" : "#94a3b8",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "0.825rem",
                  width: "100%",
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

        {/* Sidebar Summary Card (Clickable to open Hop-up) */}
        {rawSnapshot && (
          <div style={{ padding: "0.75rem" }}>
            {!isCompact ? (
              <Button
                onClick={() => setOverviewOpen(true)}
                style={{
                  width: "100%",
                  padding: "0.6rem 0.75rem",
                  borderRadius: "0.75rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "stretch",
                  gap: "0.25rem",
                  textAlign: "left",
                }}
                title="查看概览数据"
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "0.72rem", color: "#94a3b8", fontWeight: 600 }}>快照概览</span>
                  <BarChart2 size={13} color="#38bdf8" />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
                  <span style={{ fontSize: "1.15rem", fontWeight: 700, color: "#f8fafc" }}>{totalTabs}</span>
                  <span style={{ fontSize: "0.7rem", color: "#94a3b8" }}>标签 / {panelCount} 面板</span>
                </div>
              </Button>
            ) : (
              <Button
                onClick={() => setOverviewOpen(true)}
                style={{
                  width: "100%",
                  padding: "0.5rem 0",
                  flexDirection: "column",
                  gap: "2px",
                }}
                title="查看概览数据"
              >
                <BarChart2 size={15} color="#38bdf8" />
                <span style={{ fontSize: "0.65rem", fontWeight: 700 }}>{totalTabs}</span>
              </Button>
            )}
          </div>
        )}
      </aside>

      <OverviewHopup isOpen={overviewOpen} onClose={() => setOverviewOpen(false)} />
    </>
  );
}
