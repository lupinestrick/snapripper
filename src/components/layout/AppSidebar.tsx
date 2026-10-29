"use client";

import React, { useState, useEffect } from "react";
import { useConfigStore, AppPage } from "@/store/useConfigStore";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { OverviewHopup } from "./OverviewHopup";
import {
  Layers,
  Sparkles,
  SlidersHorizontal,
  Bot,
  BarChart2,
  ChevronLeft,
  ChevronRight,
  Upload,
} from "lucide-react";

export function AppSidebar() {
  const { activePage, setActivePage } = useConfigStore();
  const { rawSnapshot, loadSnapshot } = useSnapshotStore();
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
    { page: "workbench", label: "工作台", icon: <Layers size={18} /> },
    { page: "process", label: "处理比对", icon: <Sparkles size={18} /> },
    { page: "rules", label: "规则管理", icon: <SlidersHorizontal size={18} /> },
    { page: "ai", label: "AI 比例分析", icon: <Bot size={18} /> },
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
            height: "60px",
            backgroundColor: "#111827",
            borderTop: "1px solid #1f2937",
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
              <button
                key={item.page}
                onClick={() => setActivePage(item.page)}
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "2px",
                  padding: "6px 12px",
                  borderRadius: "9999px",
                  backgroundColor: isActive ? "#1e293b" : "transparent",
                  color: isActive ? "#38bdf8" : "#9ca3af",
                  border: "none",
                  cursor: "pointer",
                  fontSize: "0.7rem",
                }}
              >
                {item.icon}
                <span>{item.label}</span>
              </button>
            );
          })}
          <button
            onClick={() => setOverviewOpen(true)}
            style={{
              padding: "6px 10px",
              borderRadius: "9999px",
              backgroundColor: "#2563eb",
              color: "#fff",
              border: "none",
              cursor: "pointer",
              fontSize: "0.7rem",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            <BarChart2 size={14} />
            <span>{totalTabs}</span>
          </button>
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
          width: isCompact ? "68px" : "220px",
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
                  width: "28px",
                  height: "28px",
                  borderRadius: "9999px",
                  backgroundColor: "#2563eb",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: "0.85rem",
                }}
              >
                S
              </div>
              <span style={{ fontSize: "0.95rem", fontWeight: 700, color: "#f8fafc", letterSpacing: "-0.02em" }}>
                SnapRipper
              </span>
            </div>
          ) : (
            <div
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "9999px",
                backgroundColor: "#2563eb",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#fff",
                fontWeight: 700,
                fontSize: "0.85rem",
              }}
            >
              S
            </div>
          )}

          {/* Compact Toggle Button */}
          {!isCompact && (
            <button
              onClick={() => setIsCompact(true)}
              style={{
                width: "24px",
                height: "24px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: "#1e293b",
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              title="折叠侧边栏"
            >
              <ChevronLeft size={14} />
            </button>
          )}
        </div>

        {/* Compact expand toggle button if isCompact */}
        {isCompact && (
          <div style={{ display: "flex", justifyContent: "center", padding: "0.5rem 0" }}>
            <button
              onClick={() => setIsCompact(false)}
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "9999px",
                border: "none",
                backgroundColor: "#1e293b",
                color: "#94a3b8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
              title="展开侧边栏"
            >
              <ChevronRight size={14} />
            </button>
          </div>
        )}

        {/* Nav Items */}
        <nav style={{ padding: "0.75rem 0.5rem", display: "flex", flexDirection: "column", gap: "0.35rem", flex: 1 }}>
          {navItems.map((item) => {
            const isActive = activePage === item.page;
            return (
              <button
                key={item.page}
                onClick={() => setActivePage(item.page)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: isCompact ? "center" : "flex-start",
                  gap: "0.75rem",
                  padding: isCompact ? "0.6rem 0" : "0.6rem 0.75rem",
                  borderRadius: "9999px",
                  border: "none",
                  backgroundColor: isActive ? "#1e293b" : "transparent",
                  color: isActive ? "#38bdf8" : "#94a3b8",
                  fontWeight: isActive ? 600 : 500,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  transition: "all 0.15s ease",
                  width: "100%",
                }}
                title={isCompact ? item.label : undefined}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "20px" }}>
                  {item.icon}
                </div>
                {!isCompact && <span>{item.label}</span>}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Summary Card (Clickable to open Hop-up) */}
        {rawSnapshot && (
          <div style={{ padding: "0.75rem" }}>
            {!isCompact ? (
              <div
                onClick={() => setOverviewOpen(true)}
                style={{
                  padding: "0.75rem",
                  borderRadius: "0.75rem",
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  cursor: "pointer",
                  transition: "border-color 0.15s ease",
                }}
                onMouseEnter={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "#38bdf8")}
                onMouseLeave={(e) => ((e.currentTarget as HTMLElement).style.borderColor = "#334155")}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "0.35rem" }}>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8", fontWeight: 600 }}>快照概览</span>
                  <BarChart2 size={13} color="#38bdf8" />
                </div>
                <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem" }}>
                  <span style={{ fontSize: "1.25rem", fontWeight: 700, color: "#f8fafc" }}>{totalTabs}</span>
                  <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>标签 / {panelCount} 面板</span>
                </div>
                <div style={{ fontSize: "0.7rem", color: "#64748b", marginTop: "0.25rem" }}>点击查看完整统计</div>
              </div>
            ) : (
              <button
                onClick={() => setOverviewOpen(true)}
                style={{
                  width: "100%",
                  padding: "0.6rem 0",
                  borderRadius: "9999px",
                  backgroundColor: "#1e293b",
                  border: "1px solid #334155",
                  color: "#38bdf8",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "2px",
                  cursor: "pointer",
                }}
                title="查看概览数据"
              >
                <BarChart2 size={16} />
                <span style={{ fontSize: "0.65rem", fontWeight: 700 }}>{totalTabs}</span>
              </button>
            )}
          </div>
        )}
      </aside>

      <OverviewHopup isOpen={overviewOpen} onClose={() => setOverviewOpen(false)} />
    </>
  );
}
