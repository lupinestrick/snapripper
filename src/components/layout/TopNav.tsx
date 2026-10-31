"use client";

import React, { useState, useRef, useEffect } from "react";
import { FolderArchive, Undo2, Palette, Check } from "lucide-react";
import { useSnapshotStore } from "@/store/useSnapshotStore";
import { useConfigStore, AppTheme } from "@/store/useConfigStore";
import { SnapshotFileHopupModal, formatBytes } from "./SnapshotFileHopupModal";
import { Button } from "@/components/ui/button";

interface TopNavProps {
  onOpenExport?: () => void;
}

const THEME_OPTIONS: { id: AppTheme; name: string; previewDot: string }[] = [
  {
    id: "park-light",
    name: "Crimson Light",
    previewDot: "#e93d82",
  },
  {
    id: "park-dark",
    name: "Crimson Dark",
    previewDot: "#e93d82",
  },
  {
    id: "midnight",
    name: "Midnight",
    previewDot: "#2563eb",
  },
  {
    id: "nord-snow-storm",
    name: "Nord Snow Storm",
    previewDot: "#88c0d0",
  },
  {
    id: "rose-pine-dawn",
    name: "Rosé Pine Dawn",
    previewDot: "#d7827e",
  },
  {
    id: "nord-dark",
    name: "Nord Polar Night",
    previewDot: "#88c0d0",
  },
  {
    id: "catppuccin-mocha",
    name: "Catppuccin Mocha",
    previewDot: "#f5c2e7",
  },
];

export function TopNav({ onOpenExport }: TopNavProps) {
  const { undoStack, undo, rawSnapshot, fileName, rawFileSize } = useSnapshotStore();
  const { theme, setTheme, uiSettings } = useConfigStore();
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

  const currentTheme = THEME_OPTIONS.find((t) => t.id === theme) || THEME_OPTIONS[0];

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
        {/* Left Side: File size / Snapshot management button, Config file name */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
          {/* File Size / Snapshot Management Button (left of config file name) */}
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

          {/* Config File Name (can be hidden in UI settings) */}
          {!uiSettings?.hideFileName && (
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "var(--text-main)" }}>
              {fileName ? fileName : "未加载配置文件"}
            </span>
          )}
        </div>

        {/* Right Side: Quick Theme Switcher & Undo */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.45rem" }}>
          {/* Quick Theme Switcher (can be hidden in UI settings) */}
          {!uiSettings?.hideQuickTheme && (
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
                    width: "170px",
                    backgroundColor: "var(--bg-surface)",
                    border: "1px solid var(--border-subtle)",
                    borderRadius: "var(--radius-btn, 6px)",
                    padding: "0.35rem",
                    boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.4)",
                    zIndex: 50,
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.15rem",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.68rem",
                      fontWeight: 600,
                      color: "var(--text-muted)",
                      padding: "0.2rem 0.45rem",
                      borderBottom: "1px solid var(--border-subtle)",
                      marginBottom: "0.15rem",
                    }}
                  >
                    外观与主题
                  </div>

                  {THEME_OPTIONS.map((item) => {
                    const isActive = (theme || "park-light") === item.id;
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
                          padding: "0.35rem 0.5rem",
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
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              backgroundColor: item.previewDot,
                              display: "inline-block",
                              flexShrink: 0,
                            }}
                          />
                          <span style={{ fontSize: "0.78rem", fontWeight: isActive ? 600 : 500 }}>
                            {item.name}
                          </span>
                        </div>
                        {isActive && <Check size={13} style={{ color: "var(--accent)" }} />}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}

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
