"use client";

import React, { useState, useRef, useEffect } from "react";
import { FolderArchive, Undo2, Palette, Check, Moon, Sun, Sparkles } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore, AppTheme } from "@/store/useConfigStore";
import { SnapshotFileHopupModal, formatBytes } from "./SnapshotFileHopupModal";
import { Button } from "@/components/ui/button";

interface TopNavProps {
  onOpenExport?: () => void;
}

const THEME_OPTIONS: { id: AppTheme; name: string; subtitle: string; icon: React.ReactNode; previewDot: string }[] = [
  {
    id: "park-light",
    name: "Park UI 浅色",
    subtitle: "Crimson + Neutral (默认)",
    icon: <Sun size={13} />,
    previewDot: "#e93d82",
  },
  {
    id: "park-dark",
    name: "Park UI 深色",
    subtitle: "Crimson + Neutral Dark",
    icon: <Sparkles size={13} />,
    previewDot: "#e93d82",
  },
  {
    id: "midnight",
    name: "经典暗蓝",
    subtitle: "Dark Slate & Blue",
    icon: <Moon size={13} />,
    previewDot: "#2563eb",
  },
  {
    id: "nord-snow-storm",
    name: "Nord Snow Storm",
    subtitle: "北欧雪暴 浅色",
    icon: <Sun size={13} />,
    previewDot: "#5e81ac",
  },
  {
    id: "rose-pine-dawn",
    name: "Rosé Pine Dawn",
    subtitle: "晨曦玫瑰 浅色",
    icon: <Sun size={13} />,
    previewDot: "#b4637a",
  },
  {
    id: "nord-dark",
    name: "Nord Dark",
    subtitle: "北极暗夜 深色",
    icon: <Moon size={13} />,
    previewDot: "#88c0d0",
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    subtitle: "猫普契诺 摩卡深色",
    icon: <Sparkles size={13} />,
    previewDot: "#cba6f7",
  },
];

export function TopNav({ onOpenExport }: TopNavProps) {
  const { undoStack, undo, rawSnapshot, fileName, rawFileSize } = useSnapshotStore();
  const { theme, setTheme } = useConfigStore();
  const [fileHopupOpen, setFileHopupOpen] = useState(false);
  const [themeMenuOpen, setThemeMenuOpen] = useState(false);
  const themeMenuRef = useRef<HTMLDivElement>(null);

  const hasData = !!rawSnapshot;

  // Click outside to close theme popover
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (themeMenuRef.current && !themeMenuRef.current.contains(e.target as Node)) {
        setThemeMenuOpen(false);
      }
    };
    if (themeMenuOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [themeMenuOpen]);

  const currentTheme = THEME_OPTIONS.find((t) => t.id === (theme || "park-light")) || THEME_OPTIONS[0];

  return (
    <>
      <header
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "0.6rem 1.25rem",
          backgroundColor: "var(--bg-surface)",
          borderBottom: "1px solid var(--border-subtle)",
          position: "sticky",
          top: 0,
          zIndex: 30,
        }}
      >
        {/* Snapshot Info */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
            {fileName ? fileName : "未加载快照"}
          </span>
          {rawSnapshot ? (
            <span
              style={{
                fontSize: "0.7rem",
                padding: "2px 8px",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "var(--accent-subtle)",
                color: "var(--accent-text)",
                border: "1px solid var(--accent-border)",
                fontWeight: 600,
              }}
            >
              已就绪
            </span>
          ) : (
            <span
              style={{
                fontSize: "0.7rem",
                padding: "2px 8px",
                borderRadius: "var(--radius-btn, 6px)",
                backgroundColor: "var(--bg-subtle)",
                color: "var(--text-muted)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              等待导入
            </span>
          )}
        </div>

        {/* Action Controls */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          {/* Quick Theme Switcher */}
          <div ref={themeMenuRef} style={{ position: "relative" }}>
            <Button
              onClick={() => setThemeMenuOpen(!themeMenuOpen)}
              style={{
                gap: "0.35rem",
                color: "var(--text-main)",
                borderColor: themeMenuOpen ? "var(--border-focus)" : "var(--btn-outline-border)",
              }}
              title="切换主题配色"
            >
              <Palette size={13} style={{ color: "var(--accent)" }} />
              <span style={{ fontSize: "0.75rem" }}>{currentTheme.name}</span>
            </Button>

            {/* Theme Dropdown Hop-up */}
            {themeMenuOpen && (
              <div
                style={{
                  position: "absolute",
                  top: "calc(100% + 6px)",
                  right: 0,
                  width: "210px",
                  backgroundColor: "var(--bg-surface)",
                  border: "1px solid var(--border-subtle)",
                  borderRadius: "var(--radius-btn, 6px)",
                  padding: "0.4rem",
                  boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
                  zIndex: 50,
                  display: "flex",
                  flexDirection: "column",
                  gap: "0.25rem",
                }}
              >
                <div
                  style={{
                    fontSize: "0.68rem",
                    fontWeight: 600,
                    color: "var(--text-muted)",
                    padding: "0.25rem 0.5rem",
                    borderBottom: "1px solid var(--border-subtle)",
                    marginBottom: "0.2rem",
                  }}
                >
                  外观与主题 (Themes)
                </div>

                {THEME_OPTIONS.map((item) => {
                  const isActive = (theme || "midnight") === item.id;
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setTheme(item.id);
                        setThemeMenuOpen(false);
                      }}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        padding: "0.45rem 0.6rem",
                        borderRadius: "var(--radius-btn, 6px)",
                        border: "1px solid",
                        borderColor: isActive ? "var(--accent-border)" : "transparent",
                        backgroundColor: isActive ? "var(--accent-subtle)" : "transparent",
                        color: isActive ? "var(--accent-text)" : "var(--text-main)",
                        cursor: "pointer",
                        outline: "none",
                        transition: "all 0.15s ease",
                        textAlign: "left",
                        width: "100%",
                      }}
                      onMouseEnter={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = "var(--bg-subtle)";
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (!isActive) {
                          e.currentTarget.style.backgroundColor = "transparent";
                        }
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                        <span
                          style={{
                            width: "9px",
                            height: "9px",
                            borderRadius: "50%",
                            backgroundColor: item.previewDot,
                            display: "inline-block",
                            flexShrink: 0,
                          }}
                        />
                        <div>
                          <div style={{ fontSize: "0.78rem", fontWeight: 600 }}>{item.name}</div>
                          <div style={{ fontSize: "0.65rem", color: "var(--text-muted)" }}>{item.subtitle}</div>
                        </div>
                      </div>
                      {isActive && <Check size={13} style={{ color: "var(--accent)" }} />}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {hasData && (
            <Button
              onClick={undo}
              disabled={undoStack.length === 0}
              style={{
                width: "30px",
                height: "30px",
                padding: 0,
                color: undoStack.length > 0 ? "var(--text-main)" : "var(--text-muted)",
              }}
              title="撤销 (Undo)"
            >
              <Undo2 size={14} />
            </Button>
          )}

          {/* Single File Icon Button Opening the File Management Hop-up */}
          <Button
            onClick={() => setFileHopupOpen(true)}
            style={{
              color: "var(--text-main)",
              borderColor: "var(--btn-outline-border)",
            }}
            title="快照文件与导入导出管理"
          >
            <FolderArchive size={14} style={{ color: "var(--accent)" }} />
            <span>
              {hasData
                ? rawFileSize > 0
                  ? formatBytes(rawFileSize)
                  : "快照管理"
                : "导入文件"}
            </span>
          </Button>
        </div>
      </header>

      {/* Snapshot File & Import/Export Hop-up Modal */}
      <SnapshotFileHopupModal
        isOpen={fileHopupOpen}
        onClose={() => setFileHopupOpen(false)}
      />
    </>
  );
}
